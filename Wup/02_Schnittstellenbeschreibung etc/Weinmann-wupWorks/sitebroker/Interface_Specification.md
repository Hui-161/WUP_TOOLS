# SiteBroker — Interface & Method Specification

> **Single source of truth.** This document is the *only* place that contains the exact technical specification of the SiteBroker interface — MQTT topics, payloads, status enumerations, message sequences, the .NET client API and the configuration options. All other documents ([General Concept](General_Concept.md), [Integration Guide](Integration_Guide.md), [Demo Applications](Demo_Application.md), [Manual Workstation Integration](Integration_ManualWorkstation.md)) describe *how* and *why* to use the interface and **link back here** for the precise details, so the specification only ever has to be maintained in one place.

---

## Table of contents

1. [Communication protocol (MQTT)](#1-communication-protocol-mqtt)
2. [Topic structure](#2-topic-structure)
3. [Payload format](#3-payload-format)
4. [Status models](#4-status-models)
5. [Online mode](#5-online-mode)
6. [Message reference](#6-message-reference)
7. [Clear mechanism (retained messages)](#7-clear-mechanism-retained-messages)
8. [.NET client library API](#8-net-client-library-api)
9. [Configuration reference](#9-configuration-reference)
10. [Library structure](#10-library-structure)

---

## 1. Communication protocol (MQTT)

| Property | Value / Description |
|---|---|
| Protocol | MQTT v5 (via [MQTTnet](https://github.com/dotnet/MQTTnet) 4.3) |
| Default Port | 1883 (unencrypted) |
| QoS | ExactlyOnce (2) |
| Retained Messages | Yes — commands and responses are published as retained messages so that a client reconnecting after a restart still receives the last message per topic |
| Clean Session | Configurable (default: `true`) |
| Auto-Reconnect | Yes — with configurable delay |

MQTT is used **exclusively for command-and-control messages**. The actual payload data (documents, job structures) is **not** transmitted over MQTT — it is retrieved separately via **REST API** from the Central Database (see [General Concept](General_Concept.md)).

---

## 2. Topic structure

All MQTT topics follow the pattern:

```
{Sender}/{Receiver}/{Resource}/{ID}/{Action}
```

Direction is encoded in the topic order: **commands** start with the sender, **responses** start with the machine.

| Interaction | Direction | Topic |
|-------------|-----------|-------|
| Load order | Orchestrator → Client | `<Sender>/<MachineNumber>/order/<orderId>/load` |
| Order loaded | Client → Orchestrator | `<MachineNumber>/orchestrator/order/<orderId>/loaded` |
| Prepare batch | Orchestrator → Client | `<Sender>/<MachineNumber>/batch/<batchId>/prepare` |
| Batch prepared | Client → Orchestrator | `<MachineNumber>/orchestrator/batch/<batchId>/prepared` |
| Run batch variant | Orchestrator → Client | `<Sender>/<MachineNumber>/batch-variant/<batchVariantId>/produce` |
| Batch variant produced | Client → Orchestrator | `<MachineNumber>/orchestrator/batch-variant/<batchVariantId>/produced` |
| Online mode | Client → Orchestrator | `<MachineNumber>/orchestrator/settings/online-mode` |

**Placeholders:**
- `<Sender>` — sender of the command (the library uses the fixed literal `orchestrator`).
- `<MachineNumber>` — site-wide **unique** machine identifier, e.g. `HAP-01`.
- `<orderId>`, `<batchId>`, `<batchVariantId>` — GUIDs (UUID v4).

The id is always the **4th path segment** (`topic.Split('/')[3]`) and is used for correlation. The orchestrator subscribes with MQTT wildcards (`+`) for the machine number and id, so a single subscription receives responses from all machines.

---

## 3. Payload format

All payloads are transmitted as JSON. The unified envelope is `GenericPayloadDto`:

```jsonc
{
  "Status": 0,                       // integer status (see §4)
  "AdditionalProperties": {          // optional string→string map of extra fields
    "OrderId": "00000000-0000-0000-0000-000000000000"
  }
}
```

### Known `AdditionalProperties` keys

| Key | Usage |
|---|---|
| `"Filename"` | File name (legacy import, optional) |
| `"Variant"` | PSLV variant (see below) |
| `"OrderId"` | Document ID — always included in the `load` command and the `loaded`/`prepared`/`produced` responses; optional (legacy) in the `prepare` command and (manual workstation) in the `produce` command |
| `"BatchId"` | Job ID — always included in the `prepare` command and the `prepared`/`produced` responses; optional (legacy) in the `produce` command |
| `"BatchVariantId"` | Execution ID — always included in the `produce` command and the `produced` response |

> The id of the addressed resource is always carried both in the topic (4th segment, used for correlation) and redundantly in `AdditionalProperties`.

### PSLV format (Variant)

The variant identifier follows the **PSLV** schema (Place / Side / Layer / Variant) and identifies the layer or side of a document to be executed. Example: `1-I-1-1`.

---

## 4. Status models

All status enums are serialized as their **integer** value in `Status`. Source of truth: [`Models/Enums/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Models/Enums/).

### OrderStatus

| Value | Name | Meaning | Terminal |
|------:|------|---------|:--------:|
| 0 | `Requested` | Command sent, not yet processed | |
| 1 | `Preparing` | Machine is importing the document | |
| 2 | `Imported` | Order successfully loaded | ✅ |
| 3 | `Aborted` | Order load failed/cancelled | ✅ |

*Allowed status values in the `loaded` response: 1–3 (`Preparing`, `Imported`, `Aborted`).*

### BatchStatus

| Value | Name | Meaning | Terminal |
|------:|------|---------|:--------:|
| 0 | `Requested` | Command sent | |
| 1 | `Incomplete` | Missing data / not ready | |
| 2 | `Preparing` | Being prepared | |
| 3 | `Ready` | Batch prepared | ✅ |
| 4 | `Aborted` | Prepare failed/cancelled | ✅ |

*Allowed status values in the `prepared` response: 1–4 (`Incomplete`, `Preparing`, `Ready`, `Aborted`).*

### RunStatus

| Value | Name | Meaning | Terminal |
|------:|------|---------|:--------:|
| 0 | `Requested` | Command sent | |
| 1 | `Inactive` | Not running / paused | |
| 2 | `Active` | Production running | |
| 3 | `Done` | Variant produced | ✅ |
| 4 | `Aborted` | Run failed/cancelled | ✅ |

*Allowed status values in the `produced` response: 1–4 (`Inactive`, `Active`, `Done`, `Aborted`).*

### OnlineModeStatus

| Value | Name |
|------:|------|
| 1 | `Offline` |
| 2 | `Online` |

> **Terminal vs. intermediate.** A consumer should treat the terminal states (✅) as "request finished". Any further status with the same id after a terminal state is a late / duplicate message. Failure is always reported **in-band** as the `Aborted` terminal status, never as an exception.

---

## 5. Online mode

**Online mode** is a prerequisite for the client to process `PrepareBatch` and `ExecuteBatchVariant` commands. The client actively publishes its online-mode status (retained) to the orchestrator.

**Topic (Client → Orchestrator):** `<MachineNumber>/orchestrator/settings/online-mode`

```json
{ "Status": 2, "AdditionalProperties": {} }
```
*(Status 2 = Online, Status 1 = Offline)*

The machine publishes `Online`/`Offline` whenever its remote mode changes; the orchestrator receives it via `OnlineModeChangedResponse`. With `useLastWill: true` the broker auto-publishes `Offline` on an ungraceful disconnect. Implementation: [`SiteBrokerClientService.SendOnlineModeResponse`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/SiteBrokerClientService.cs), last-will setup in [`ServiceExtensions.AddSiteBroker`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/ServiceExtensions.cs).

---

## 6. Message reference

### 6.1 Load order

**Command (Orchestrator → Client)** — Topic: `<Sender>/<MachineNumber>/order/<orderId>/load`

```json
{
  "Status": 0,
  "AdditionalProperties": {
    "OrderId": "550e8400-e29b-41d4-a716-446655440000",
    "Filename": "xyz.wup"
  }
}
```
*`OrderId` is always included. `Filename` is optional and only required for legacy use cases.*

**Response (Client → Orchestrator)** — Topic: `<MachineNumber>/orchestrator/order/<orderId>/loaded`

```json
{
  "Status": 2,
  "AdditionalProperties": { "OrderId": "550e8400-e29b-41d4-a716-446655440000" }
}
```
*Allowed status values: 1–3 (see [§4](#4-status-models)).*

A standard machine resolves the document via REST (`GET /order/{orderId}`) against the Central Database before reporting `Imported`. Implementation: [`SiteBrokerControllerService.SendLoadOrderRequest`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/SiteBrokerControllerService.cs) / [`SiteBrokerClientService.SendOrderLoadedResponse`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/SiteBrokerClientService.cs).

### 6.2 Prepare batch

**Command (Orchestrator → Client)** — Topic: `<Sender>/<MachineNumber>/batch/<batchId>/prepare`

```json
{
  "Status": 0,
  "AdditionalProperties": {
    "BatchId": "660e8400-e29b-41d4-a716-446655440001",
    "Variant": "1-I-1-1"
  }
}
```
*`BatchId` is always included. `Variant` in PSLV format must be set for non-interactive (automatic) mode. `OrderId` may additionally be included (legacy).*

**Response (Client → Orchestrator)** — Topic: `<MachineNumber>/orchestrator/batch/<batchId>/prepared`

```json
{
  "Status": 3,
  "AdditionalProperties": {
    "BatchId": "660e8400-e29b-41d4-a716-446655440001",
    "OrderId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```
*Allowed status values: 1–4 (see [§4](#4-status-models)). The machine prepares the batch locally, no REST call. Implementation: [`SiteBrokerControllerService.SendPrepareBatchRequest`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/SiteBrokerControllerService.cs) / [`SiteBrokerClientService.SendBatchPreparedResponse`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/SiteBrokerClientService.cs).*

### 6.3 Run batch variant

**Command (Orchestrator → Client)** — Topic: `<Sender>/<MachineNumber>/batch-variant/<batchVariantId>/produce`

Standard payload (machine):
```json
{
  "Status": 0,
  "AdditionalProperties": {
    "BatchVariantId": "770e8400-e29b-41d4-a716-446655440002",
    "BatchId": "660e8400-e29b-41d4-a716-446655440001"
  }
}
```
*`BatchVariantId` is always included. `BatchId` is optional (legacy).*

Extended payload (manual workstation — see [Manual Workstation Integration](Integration_ManualWorkstation.md)):
```json
{
  "Status": 0,
  "AdditionalProperties": {
    "BatchVariantId": "770e8400-e29b-41d4-a716-446655440002",
    "OrderId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Response (Client → Orchestrator)** — Topic: `<MachineNumber>/orchestrator/batch-variant/<batchVariantId>/produced`

```json
{
  "Status": 2,
  "AdditionalProperties": {
    "BatchVariantId": "770e8400-e29b-41d4-a716-446655440002",
    "BatchId": "660e8400-e29b-41d4-a716-446655440001",
    "OrderId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```
*Allowed status values: 1–4 (see [§4](#4-status-models)). Implementation: [`SiteBrokerControllerService.SendExecuteBatchVariantRequest`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/SiteBrokerControllerService.cs) / [`SiteBrokerClientService.SendBatchVariantExecutedResponse`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/SiteBrokerClientService.cs).*

---

## 7. Clear mechanism (retained messages)

The orchestrator publishes all commands as **retained messages**. To prevent a command from being processed again after a client restart, the client **must** clear the retained message immediately upon receipt by publishing an **empty** payload (`""`) to the same topic:

```
Topic:   <Sender>/<MachineNumber>/order/<orderId>/load
Payload: (empty)
Retain:  true
```

Only after clearing the retained message should the actual processing take place and the response be sent. The same applies in reverse for the orchestrator, which clears a retained **response** once it has consumed the terminal status. The `Clear…` methods of the library ([§8](#8-net-client-library-api)) do exactly this.

---

## 8. .NET client library API

The .NET 8 library `Wup.Works.SiteBroker.Client` (NuGet: `HomagGroup.CES.Weinmann.WupWorks.SiteBroker.Client`) implements this interface. It provides **one service per role**; both are registered with a single call to `AddSiteBroker(...)`.

### `ServiceExtensions.AddSiteBroker(IConfiguration configuration, bool useLastWill = false)`

Registers the MQTT client, both role services and a hosted worker that connects & subscribes both services on startup. Set `useLastWill: true` on the **machine** side so the broker automatically publishes an `Offline` online-mode message (retained) to `<machine>/orchestrator/settings/online-mode` if the connection drops ungracefully.

> ⚠️ `AddSiteBroker` reads configuration **eagerly** and the MQTT client **connects during service resolution** (it blocks up to `Mqtt:ConnectTimeoutInSeconds`). A wrong/unreachable `Hostname` therefore fails app startup.

### `ISiteBrokerControllerService` (orchestrator / MES)

Full method/event signatures: [`ISiteBrokerControllerService.cs`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Interfaces/ISiteBrokerControllerService.cs).

- **Receives** machine responses via the events `OrderLoadedResponse`, `BatchPreparedResponse`, `BatchVariantExecutedResponse` (`*StatusEventArgs`) and `OnlineModeChangedResponse` (`OnlineModeStatusEventArgs`).
- **Sends** commands via `SendLoadOrderRequest` / `SendPrepareBatchRequest` / `SendExecuteBatchVariantRequest` (`fileName`/`orderId` are legacy/manual-workstation extras; `variant` is PSLV).
- **Clears** retained responses via `ClearOrderLoadedResponse` / `ClearBatchPreparedResponse` / `ClearBatchVariantExecutedResponse`.

### `ISiteBrokerClientService` (machine / client)

Full method/event signatures: [`ISiteBrokerClientService.cs`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Interfaces/ISiteBrokerClientService.cs).

- **Receives** orchestrator commands via the events `LoadOrderRequested`, `PrepareBatchRequested`, `RunBatchVariantRequested`.
- **Sends** responses via `SendOrderLoadedResponse` / `SendBatchPreparedResponse` / `SendBatchVariantExecutedResponse` / `SendOnlineModeResponse` (retained).
- **Clears** retained commands via `ClearLoadOrderRequest` / `ClearPrepareBatchRequest` / `ClearExecuteBatchVariantRequest`. The `orchestrator` argument is the inbound sender name (literal `orchestrator`).

Both interfaces expose `Connect()` / `Disconnect()`; the hosted [`SiteBrokerWorker`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/BackgroundWorkers/SiteBrokerWorker.cs) calls `Connect()` on startup, so you normally do not call these directly.

### Event argument types

Definitions: [`Models/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Models/) (`OrderStatusEventArgs`, `BatchStatusEventArgs`, `RunStatusEventArgs`, `OnlineModeStatusEventArgs`).

> On the **machine** side, inbound command events carry the ids only — the `Status` field is not meaningful for a request (the machine decides the status). On the **orchestrator** side, the `Status` field carries the machine's reported status.

---

## 9. Configuration reference

Two configuration sections are bound from `IConfiguration` (e.g. `appsettings.json`).

```jsonc
{
  "SiteBrokerOptions": {
    "Hostname": "localhost",   // broker + central server host
    "MachineNumber": "DEMO-01" // site-wide UNIQUE machine identifier
  },
  "Mqtt": {
    "Port": 1883,
    "Id": "my-unique-client-id",      // MUST be unique per process on the broker
    "Username": null,
    "Password": null,
    "CleanSession": true,
    "ConnectTimeoutInSeconds": 90,    // allowed range: 30–600
    "AutoReconnectDelay": "00:00:05"
  }
}
```

### `SiteBrokerOptions`

| Key | Type | Description |
|-----|------|-------------|
| `Hostname` | `string` | Host of the broker **and** central server. This value **overrides** `Mqtt:Hostname` internally. |
| `MachineNumber` | `string` | The machine this process represents. Must be **unique** across the site. |

### `Mqtt` (`MqttOptions`)

Full list with defaults: [`MqttOptions.cs`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Configuration/MqttOptions.cs); validation in [`ServiceExtensions.cs`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/ServiceExtensions.cs).

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `Hostname` | `string` | — | Set internally from `SiteBrokerOptions:Hostname`; do not configure it here. |
| `Port` | `int` | `1883` | Broker port. |
| `Id` | `string` | random `Guid` | MQTT client id. **Must be unique per connected process** — duplicate ids cause the broker to disconnect the older client. |
| `Username` / `Password` | `string` | `null` | Broker credentials, if required. |
| `CleanSession` | `bool` | `true` | If `false`, subscriptions and queued messages survive reconnects. |
| `ConnectTimeoutInSeconds` | `int` | `90` | Connect wait. **Validated to be 30–600**; out-of-range throws `ValidationException`. |
| `AutoReconnectDelay` | `TimeSpan` | `5 s` | Delay between automatic reconnect attempts. |

Advanced queue/session tuning (`MaxPendingMessages`, `ReceiveMaximum`, `SessionExpiryInterval`, `ReadMessageTimeoutInMilliseconds`) defaults to sensible values — see `MqttOptions.cs`.

---

## 10. Library structure

The library lives in [`Applications/Sitebroker/Wup.Works.SiteBroker.Client`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/). Key types (one file each, kept as the single source of truth — read the code instead of a duplicated diagram):

| Concern | Type(s) | Source |
|---------|---------|--------|
| Orchestrator role | `ISiteBrokerControllerService` / `SiteBrokerControllerService` | [`Interfaces/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Interfaces/ISiteBrokerControllerService.cs), [`Services/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/SiteBrokerControllerService.cs) |
| Machine role | `ISiteBrokerClientService` / `SiteBrokerClientService` | [`Interfaces/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Interfaces/ISiteBrokerClientService.cs), [`Services/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/SiteBrokerClientService.cs) |
| MQTT transport | `IMqttClientService` / `MqttClientService` | [`Interfaces/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Interfaces/IMqttClientService.cs), [`Services/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/MqttClientService.cs) |
| Topic building/validation | `TopicHelper` | [`Helpers/TopicHelper.cs`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Helpers/TopicHelper.cs) |
| Startup wiring & last-will | `ServiceExtensions.AddSiteBroker` | [`ServiceExtensions.cs`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/ServiceExtensions.cs) |
| Hosted connect worker | `SiteBrokerWorker` | [`Services/BackgroundWorkers/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Services/BackgroundWorkers/SiteBrokerWorker.cs) |
| Status enums | `OrderStatus`, `BatchStatus`, `RunStatus`, `OnlineModeStatus` | [`Models/Enums/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Models/Enums/) |
| Event args & payload | `*StatusEventArgs`, `GenericPayloadDto` | [`Models/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Models/) |
| Configuration | `MqttOptions`, `SiteBrokerOptions` | [`Configuration/`](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client/Configuration/) |
