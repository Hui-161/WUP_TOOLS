# wupWorks 5 — SiteBroker Client Demo Applications

Two .NET 8 console applications make it as easy as possible for external developers and companies to explore the SiteBroker protocol **without any real hardware**. You drive both of them from the console and decide **when and which** message is sent — including a set of deliberate **error scenarios**.

> 📖 This document focuses on **running and using the demos**. The exact protocol (topics, payloads, status enums), the .NET API and the configuration options are specified once in the **[Interface & Method Specification](Interface_Specification.md)**.
>
> See also: [General Concept](General_Concept.md) · [Integration Guide](Integration_Guide.md) · [Manual Workstation Integration](Integration_ManualWorkstation.md).

---

## 1. The two demos

| Project | Simulates | Uses |
|---------|-----------|------|
| `Wup.Works.SiteBroker.Client.Demo.Mes` | an MES / orchestrator that hands out jobs | `ISiteBrokerControllerService` |
| `Wup.Works.SiteBroker.Client.Demo.Machine` | a machine that processes jobs | `ISiteBrokerClientService` |

Both default to `MachineNumber = DEMO-01` so they talk to each other out of the box. The two roles and their interfaces are described in [Integration Guide §1](Integration_Guide.md#1-the-two-roles): the MES demo sends commands and receives responses; the machine demo does the reverse.

---

## 2. Running the demos

### 2.1 Start an MQTT broker

The demos need an MQTT broker on `localhost:1883`. You can use a locally installed Mosquitto (`mosquitto -p 1883`) or any other MQTT v5 broker. Configuration (`SiteBrokerOptions`, `Mqtt`) is documented in [Interface & Method Specification §9](Interface_Specification.md#9-configuration-reference); the demos use the unique client ids `sitebroker-demo-mes` and `sitebroker-demo-machine`.

> ⚠️ `AddSiteBroker` connects to the broker **synchronously** during start-up and blocks for up to `ConnectTimeoutInSeconds` (min. 30 s) if no broker is reachable. Both demos print a *"Connecting to MQTT broker …"* line first, so a missing broker does not look like a freeze.

### 2.2 Run

Open **two terminals** (broker running):

```powershell
# Terminal 1 — the machine
cd HomagGroup/Wup.Works.SiteBroker.Client.Demo.Machine
dotnet run

# Terminal 2 — the MES
cd HomagGroup/Wup.Works.SiteBroker.Client.Demo.Mes
dotnet run
```

### 2.3 Happy-path walkthrough

1. **Machine** starts and reports **Online** — the MES terminal prints `<- Online mode of machine DEMO-01: Online`.
2. In the **MES**, press `1` → `Enter` (auto GUID) → `Enter` (no filename). The order is sent.
3. The **Machine** prints `<- LoadOrder received (retained)` and clears the retained command.
4. In the **Machine**, press `Enter` to process the next queued job, then `Enter` again to send each recommended step (`Preparing`, then `Imported`).
5. The **MES** prints the incoming responses and marks the request *completed* (option `4`).

The same pattern works for **PrepareBatch** (`2`) and **RunBatchVariant** (`3`).

---

## 3. Console reference

The interactive console behaviour is implemented in `ConsoleUi.cs` / `*SimulatorService.cs` of each demo project ([Demo.Mes](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client.Demo.Mes/), [Demo.Machine](../../Applications/Sitebroker/Wup.Works.SiteBroker.Client.Demo.Machine/)).

### MES demo (`Demo.Mes`)

| Key | Action |
|-----|--------|
| `1` | Send **LoadOrder** (OrderId, optional filename) |
| `2` | Send **PrepareBatch** (BatchId, optional OrderId, optional PSLV variant) |
| `3` | Send **RunBatchVariant** (BatchVariantId, optional BatchId) |
| `4` | List sent requests with their last status / completion |
| `5` | **Clear** a request (publish empty retained command) |
| `6` | **Error scenarios** (see [§4](#4-error-scenarios)) |
| `q` | Quit |

A background monitor warns with `! TIMEOUT` if a request gets no final response within `Demo:ResponseTimeoutSeconds` (default 15 s). Late responses are flagged as `[LATE response after timeout]`, and responses for unknown ids as *unexpected/foreign response*.

### Machine demo (`Demo.Machine`)

The machine demo walks the operator **linearly** through the intended operational flow. Incoming commands are automatically taken over (their retained command is cleared) and placed in a FIFO queue. You work them off one after another:

| Key | Action |
|-----|--------|
| `Enter` | Process the **next queued command** — *guided through its lifecycle* (see below) |
| `o` | Toggle **Online / Offline** mode |
| `l` | List open (queued) commands with their current lifecycle phase |
| `u` | Send an **unsolicited / foreign** response (never-requested id) |
| `q` | Quit |

Each command has a lifecycle (`Requested -> … -> terminal`, with `Aborted` always available as an escape). The status values come from [Interface & Method Specification §4](Interface_Specification.md#4-status-models):

| Command | Guided happy path | Terminal states |
|---------|-------------------|-----------------|
| `LoadOrder` | `Preparing` → `Imported` | `Imported`, `Aborted` |
| `PrepareBatch` | `Preparing` → `Ready` | `Ready`, `Aborted` |
| `RunBatchVariant` | `Active` → `Done` | `Done`, `Aborted` |

In the per-command dialog, `[Enter]` sends the recommended status, a **number** sends an explicit status, `[i]` ignores (simulates an MES timeout) and `[x]` defers (keeps the command queued). Intermediate statuses advance the lifecycle; a terminal status closes the command and the demo continues with the next one. For `RunBatchVariant` the demo also simulates a manual workstation by displaying the document (`OrderId`) from its local database (see [Manual Workstation Integration](Integration_ManualWorkstation.md)). Taking over a command always clears its retained MQTT message.

---

## 4. Error scenarios (steerable from the console)

The demos intentionally let you trigger the situations an integrator must handle (see [Integration Guide §5](Integration_Guide.md#5-error-handling--edge-cases)):

| Scenario | How to trigger | What it demonstrates |
|----------|----------------|----------------------|
| **No response / timeout** | MES `6` → `1` (unknown machine) *or* Machine `[Enter]` → `[i]` (ignore) | MES timeout monitoring and recovery |
| **Aborted status** | Machine `[Enter]` → choose `Aborted` | Error reporting per spec (always answer `Aborted` on failure) |
| **Missing PSLV variant** | MES `6` → `2` | Non-interactive prepare without `Variant` → machine may abort |
| **Missing OrderId/BatchId** | MES `6` → `3` | Manual workstation can't locate the document |
| **Duplicate / replay** | MES `6` → `4` | Receivers must be **idempotent** (QoS 2 does *not* guarantee business-level once) |
| **Offline machine** | Machine `o` (go Offline), then MES sends a job | Online mode is a prerequisite for jobs |
| **Foreign / late response** | Machine `u` | MES receives a response it never asked for |

---

## 5. Notes & known limitations

- **Retained commands** are always cleared on receipt by the machine demo when it takes over a command (matches the spec). In production, persist/track the accepted command *before* clearing, otherwise a crash between *clear* and *process* loses the command.
- **Unique MQTT client `Id`** per process is mandatory; otherwise the broker disconnects the colliding clients. The demos use `sitebroker-demo-mes` and `sitebroker-demo-machine`.
- `AddSiteBroker` connects **both** role services in every process. Each demo only wires the events of its own role, so the other service is harmless (it just receives the echo of the local messages with no handler attached).
- The controller subscribes to responses with a **wildcard machine number**; the MES demo therefore filters/correlates responses by the locally tracked request ids.
- For **manual workstations** the orchestrator can pass the document `OrderId` in the produce command via the optional `orderId` parameter of `SendExecuteBatchVariantRequest(...)`; it is then surfaced to the machine through `RunStatusEventArgs.OrderId`.

---

## 6. Build & test

```powershell
cd HomagGroup
dotnet build Wup.Works.SiteBroker.slnx
```

The solution contains the library and both demo projects.
