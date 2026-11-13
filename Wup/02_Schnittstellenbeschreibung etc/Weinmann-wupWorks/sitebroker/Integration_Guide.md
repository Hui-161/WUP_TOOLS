# SiteBroker Integration Guide

> Developer documentation for integrating external systems with the HOMAG / WEINMANN **SiteBroker** using the `Wup.Works.SiteBroker.Client` .NET library.

This guide is written for **external developers** — MES/ERP vendors, system integrators and third-party machine manufacturers — who want to connect their software to a HOMAG/WEINMANN production environment. It explains *how* to integrate and the relevant **error and edge cases**.

> 📖 The exact technical specification (topics, payloads, status enums, the .NET API and the configuration options) lives exclusively in the **[Interface & Method Specification](Interface_Specification.md)**. This guide links there instead of duplicating it, so the specification only has to be maintained in one place.
>
> For the underlying concept see the **[General Concept](General_Concept.md)**; for runnable, console-driven examples see the **[Demo Applications](Demo_Application.md)**.

---

## Table of contents

1. [The two roles](#1-the-two-roles)
2. [Installation & requirements](#2-installation--requirements)
3. [Quick start](#3-quick-start)
4. [Message flows](#4-message-flows)
5. [Error handling & edge cases](#5-error-handling--edge-cases)
6. [Integration checklist](#6-integration-checklist)
7. [FAQ](#7-faq)

---

## 1. The two roles

The library provides **one service per role**. Both are registered with a single call to `AddSiteBroker(...)` and resolved from dependency injection. You typically use **only one** of the two interfaces depending on which side you are building.

| Role | Interface | Used by | Responsibility |
|------|-----------|---------|----------------|
| **MES / Orchestrator** | `ISiteBrokerControllerService` | MES, ERP, productionManager, any upstream system | **Sends** commands to a machine; **receives** status responses & online-mode |
| **Machine / Client** | `ISiteBrokerClientService` | A machine, manual workstation, third-party machine | **Receives** commands; **sends** status responses & online-mode |

The full method and event signatures of both interfaces are specified in [Interface & Method Specification §8](Interface_Specification.md#8-net-client-library-api).

---

## 2. Installation & requirements

### Requirements

- **.NET 8.0** (the library targets `net8.0`).
- A reachable **MQTT broker** (the SiteBroker). For local development any MQTT 5 capable broker works (e.g. [Eclipse Mosquitto](https://mosquitto.org/) on `localhost:1883`).
- The library builds on [`MQTTnet`](https://github.com/dotnet/MQTTnet) 4.3.

### Add the package

```bash
dotnet add package HomagGroup.CES.Weinmann.WupWorks.SiteBroker.Client
```

or add a project reference to `Wup.Works.SiteBroker.Client.csproj` if you build from source.

---

## 3. Quick start

The library integrates with the standard .NET **Generic Host** and **dependency injection**. The configuration sections (`SiteBrokerOptions`, `Mqtt`) are documented in [Interface & Method Specification §9](Interface_Specification.md#9-configuration-reference).

```csharp
using Microsoft.Extensions.Hosting;
using Wup.Works.SiteBroker.Client;

var builder = Host.CreateApplicationBuilder(args);

// Registers: the MQTT client, ISiteBrokerClientService, ISiteBrokerControllerService
// and a hosted worker that connects & subscribes both services on startup.
// Pass useLastWill: true on the *machine* side to auto-publish Offline on an ungraceful disconnect.
builder.Services.AddSiteBroker(builder.Configuration, useLastWill: false);

var host = builder.Build();
await host.RunAsync();
```

> ⚠️ `AddSiteBroker` reads configuration **eagerly** and the MQTT client **connects during service resolution** (it blocks up to `Mqtt:ConnectTimeoutInSeconds`). Make sure the broker host (`SiteBrokerOptions:Hostname`) is configured and reachable, otherwise startup fails.

### Orchestrator side (sending a job)

```csharp
public sealed class MesWorker(ISiteBrokerControllerService broker) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Receive responses (correlate by the id you sent).
        broker.OrderLoadedResponse += (_, e) =>
            Console.WriteLine($"Order {e.OrderId} -> {e.Status}");

        var orderId = Guid.NewGuid();
        await broker.SendLoadOrderRequest("DEMO-01", orderId, fileName: null);
    }
}
```

### Machine side (handling a job)

```csharp
public sealed class MachineWorker(ISiteBrokerClientService broker) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Tell the orchestrator we accept remote jobs.
        await broker.SendOnlineModeResponse(onlineModeEnabled: true);

        broker.LoadOrderRequested += async (_, e) =>
        {
            // 1) Clear the retained command so it is not re-delivered after a restart.
            await broker.ClearLoadOrderRequest("orchestrator", e.OrderId);

            // 2) Report intermediate and terminal status.
            await broker.SendOrderLoadedResponse(e.OrderId, OrderStatus.Preparing);
            await broker.SendOrderLoadedResponse(e.OrderId, OrderStatus.Imported);
        };
    }
}
```

> The event handlers above are invoked on the broker's MQTT receive thread — keep them fast and exception-safe (see [§5.9](#5-error-handling--edge-cases)).

---

## 4. Message flows

Every interaction follows the same **request → intermediate status → terminal status** shape over the topics defined in [Interface & Method Specification §2](Interface_Specification.md#2-topic-structure), using the status enums of [§4](Interface_Specification.md#4-status-models). The full per-message payloads are in [Interface & Method Specification §6](Interface_Specification.md#6-message-reference); runnable end-to-end flows are in the [demo applications](Demo_Application.md).

In short: the orchestrator sends a command (e.g. `SendLoadOrderRequest`) and correlates the incoming `*Response` events by the id it sent; the machine clears the retained command, then publishes one or more statuses ending in a terminal one (`Imported`/`Ready`/`Done`, or `Aborted`). A standard machine resolves documents/jobs via REST against the Central Database; load/prepare/run all share this pattern.

### Online mode

The machine publishes its online mode (retained) via `SendOnlineModeResponse(bool)`; the orchestrator receives `OnlineModeChangedResponse` and should only dispatch jobs to machines last seen `Online`. With `useLastWill: true`, an ungraceful disconnect makes the broker publish `Offline` automatically.

---

## 5. Error handling & edge cases

Integrating against a retained-message, fire-and-forget bus has characteristic failure modes. Handle the following explicitly.

### 5.1 Retained messages are replayed on subscribe

Because every message is published with **retain = true**, a freshly connected subscriber immediately receives the **last** message for every matching topic — even messages from *previous runs* that were never cleared.

- **Machine side:** on startup you may receive stale, retained commands. **Clear** the retained command (`Clear…Request`) as soon as you take ownership of it.
- **Orchestrator side:** on startup you may receive stale, retained responses for ids you never sent in this session. **Correlate every response against your own outstanding-request table** and ignore responses for unknown ids.

### 5.2 No built-in request timeout

The library does **not** time out requests. After sending a command, the orchestrator must run its own timer. A "timed-out" request can still receive a **late response** afterwards — design your state machine to accept a late terminal status and reconcile, rather than crashing or double-dispatching.

### 5.3 Unsolicited / foreign responses

Your orchestrator will occasionally see responses it did not request (foreign machine, manual operator action, replayed retained message). **Do not assume every response maps to one of your requests.** Look the id up; if it is unknown, log and ignore it rather than faulting.

### 5.4 Offline machines

If you dispatch a job to a machine that is `Offline` (or never came online), you will get **no response** and your timeout will fire. Gate dispatch on the last known `OnlineModeChangedResponse`, and use `useLastWill: true` on the machine so crashes surface as `Offline`.

### 5.5 Aborted / error status

Failure is reported **in-band** as a terminal status, not as an exception: `OrderStatus.Aborted`, `BatchStatus.Aborted`, `RunStatus.Aborted`. Treat `Aborted` as a normal terminal outcome and surface it to the operator/MES; do not wait for a "success" that will never come.

### 5.6 Duplicate & out-of-order delivery

Although QoS 2 prevents duplicate *transport* delivery, retained replay and application-level retries can still surface the same logical status twice. Make response handling **idempotent** and key it on the message id + status.

### 5.7 Clearing retained state

Retained requests and responses persist in the broker until explicitly cleared (see [Interface & Method Specification §7](Interface_Specification.md#7-clear-mechanism-retained-messages)). Leftover retained messages are the most common source of "ghost" jobs after restarts:

- The **machine** clears a command once it has accepted it (`Clear…Request`).
- The **orchestrator** clears a response once it has consumed the terminal status (`Clear…Response`).

### 5.8 Connection & configuration failures

- `AddSiteBroker` connects during DI resolution and **blocks** up to `ConnectTimeoutInSeconds`. A wrong/unreachable `Hostname` therefore fails app startup.
- `ConnectTimeoutInSeconds` outside **30–600** throws `ValidationException` at registration.
- A **non-unique** `Mqtt:Id` causes the broker to disconnect the older session — always assign a unique client id per process.

### 5.9 Exceptions inside event handlers

Command/response events are invoked on the MQTT receive path. An unhandled exception in your handler can disrupt message processing. Wrap handler bodies in try/catch, keep them short, and offload slow work (REST calls, production) to a queue/worker rather than blocking the callback.

### 5.10 Identifier correlation

Ids are parsed from the **topic** (4th segment) and are also present in `AdditionalProperties`. The orchestrator's response table is keyed by id only — if your system can reuse a `Guid` across different interaction kinds, disambiguate by interaction type yourself to avoid collisions.

---

## 6. Integration checklist

**Orchestrator (MES) implementers**

- [ ] Register `AddSiteBroker(configuration)`; resolve `ISiteBrokerControllerService`.
- [ ] Subscribe to all four response events before sending the first command.
- [ ] Maintain an outstanding-request table keyed by id; correlate every response.
- [ ] Implement per-request timeouts; tolerate late responses.
- [ ] Ignore responses for unknown ids (retained / foreign).
- [ ] Only dispatch to machines last seen `Online`.
- [ ] Clear retained responses after consuming the terminal status.

**Machine implementers**

- [ ] Register `AddSiteBroker(configuration, useLastWill: true)`; resolve `ISiteBrokerClientService`.
- [ ] Publish `SendOnlineModeResponse(true)` once ready; `false`/last-will when not.
- [ ] On each command: clear the retained request, resolve referenced ids via REST.
- [ ] Send at least one terminal status (`Imported` / `Ready` / `Done`) — or `Aborted` on failure.
- [ ] Make command handling idempotent (retained replay after restart).
- [ ] Keep event handlers fast and exception-safe.

---

## 7. FAQ

**Do I need both interfaces?** No. Build the orchestrator with `ISiteBrokerControllerService` or the machine with `ISiteBrokerClientService`. Both are registered, but you use the one for your role.

**Does the SiteBroker transfer my documents/job data?** No. MQTT carries only control messages and ids. Resolve the actual data via REST against the Central Database using the ids you receive.

**Can I implement the protocol without the .NET library?** Yes — follow [Interface & Method Specification §1–§7](Interface_Specification.md#1-communication-protocol-mqtt). Mind the retained-message semantics, QoS 2 and the empty-payload clear convention.

**Why am I receiving messages I never asked for?** Retained replay and the shared bus. See [§5.1](#5-error-handling--edge-cases) and [§5.3](#5-error-handling--edge-cases) — correlate by id and ignore unknowns.

**How do I know a request finished?** Wait for a **terminal** status (see [Interface & Method Specification §4](Interface_Specification.md#4-status-models)). `Aborted` is also terminal and signals failure.

**How do I detect a crashed machine?** Use `useLastWill: true` on the machine and watch `OnlineModeChangedResponse` for `Offline`.
