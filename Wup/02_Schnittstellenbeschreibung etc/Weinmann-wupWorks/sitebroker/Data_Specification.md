# SiteBroker — Machine Telemetry Specification

> The **telemetry** channel is a read-only, machine-originated broadcast of states and counter values to the outside world (MES, productionManager, dashboards, IoT/cloud).
>
> It is the **single source of truth** for the telemetry channel, in the same way [Interface & Method Specification](Interface_Specification.md) is for command & control. It deliberately **reuses** the SiteBroker transport (MQTT, retained messages, `MachineNumber`) and links back to the main specification for everything shared; it only specifies what is specific to the telemetry channel.

---

## Table of contents

1. [Scope & design principles](#1-scope--design-principles)
2. [Relationship to the command interface](#2-relationship-to-the-command-interface)
3. [Topic structure](#3-topic-structure)
4. [Payload format](#4-payload-format)
5. [Machine state](#5-machine-state)
6. [Defined machine telemetry](#6-defined-machine-telemetry)
7. [Defined batch-variant telemetry](#7-defined-batch-variant-telemetry)
8. [.NET client API](#8-net-client-api)

---

## 1. Scope & design principles

This channel covers **read-only, machine-originated data**: each status or counter value a production client, such as a WEINMANN machine, *provides to the outside world*. It is the inverse direction of the command interface and is **publish-only** from the machine's point of view.

| Principle | Decision |
|-----------|----------|
| **One signal = one topic = one event** | Every value is its own retained MQTT message. |
| **Event on change** | A value is published whenever it changes. |
| **State always readable via retain** | Because every message is **retained**, a newly connected consumer immediately gets the last value of every signal — without any snapshot topic. |
| **No history** | Telemetry carries only the *current* value of a signal. Historical series / alarm history are **out of scope**. |
| **Reuse the existing bus** | Same broker, same `MachineNumber`, same retained-message philosophy as [Interface & Method Specification §1](Interface_Specification.md#1-communication-protocol-mqtt). |

---

## 2. Relationship to the command interface

| Aspect | Command interface ([spec](Interface_Specification.md)) | Telemetry channel (this document) |
|--------|--------------------------------------------------------|-------------------------------------|
| Direction | Bidirectional (request → response) | Unidirectional (machine → consumers) |
| Topic shape | `{Sender}/{Receiver}/{Resource}/{Id}/{Action}` | `{MachineNumber}/telemetry/{category}/{key}` or `{MachineNumber}/telemetry/{category}/{group}/{instance}/{key}` |
| Correlation id | Yes (4th topic segment) | None — telemetry is state, not a transaction |
| Receiver | A named `orchestrator` | A fixed `telemetry` namespace (broadcast) |
| Payload | `GenericPayloadDto` (`Status` + `AdditionalProperties`) | Single-value envelope |
| Lifecycle / clear | Retained + explicit empty-payload clear | Retained latest value; indexed entries removed with an empty retained payload ([§6](#6-defined-machine-telemetry)) |

---

## 3. Topic structure

Every signal is published to its own topic. There are two topic forms:

```
{MachineNumber}/telemetry/machine/{key}                              # single machine value
{MachineNumber}/telemetry/machine/{group}/{instance}/{key}           # indexed machine entry
{MachineNumber}/telemetry/batch-variant/current/{key}                # current batch variant
```

**Placeholders**
- `{MachineNumber}` — the site-wide unique machine id (e.g. `HAP-01`, `M000000001`).
- `{category}` — top-level grouping: `machine` or `batch-variant`.
- `{key}` — the signal name (e.g. `state`, `parts`, `description`).
- `{group}` — an indexed machine signal group (`error`, `warning`, `maintenance`, `action`, `storage`, `tool`).
- `{instance}` — identifies the individual entry within a group (e.g. an error code, a storage id; `current` for the active batch variant).

All telemetry messages are published with **retain = true**.

**Defined categories**

| Category | Description |
|----------|-------------|
| `machine` | Machine-related data, order-neutral. |
| `batch-variant` | Data for the currently executing batch variant. |

**Subscription examples (consumer side)**
- One machine, everything: `HAP-01/telemetry/#`
- All machines, everything: `+/telemetry/#`
- One machine, all errors: `HAP-01/telemetry/machine/error/+/description`

The client subscribes to the whole telemetry subtree of a machine (`{MachineNumber}/telemetry/#`), or of all machines by using the wildcard as the machine number.

---

## 4. Payload format

All telemetry payloads use the same minimal **single-value envelope** (JSON):

```jsonc
{
  "type": "number",                                // "number" or "string" — no other values valid
  "value": "3",                                    // the signal value, always a JSON string
  "timestampUtc": "2026-06-14T10:22:33.512Z"       // ISO 8601 UTC, machine-side capture time
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `type` | string | ✅ | `"number"` or `"string"` — any other value is rejected by the consumer. |
| `value` | string | ✅ | The current value of the signal. Always a string on the wire regardless of type. |
| `timestampUtc` | string (ISO 8601, UTC) | ✅ | When the value was captured on the machine. |

### TelemetryValueType

Only two types are valid. The .NET enum `TelemetryValueType` reflects this constraint exactly — it has no `Boolean` or other members, so an invalid type on the wire fails deserialization and the message is skipped rather than delivered.

| Wire value | .NET enum member | Used for |
|------------|-----------------|----------|
| `"number"` | `TelemetryValueType.Number` | Integers, floats, enum ordinals |
| `"string"` | `TelemetryValueType.String` | Text, program names, timestamps, material ids |

> **Clearing / removal.** A topic is cleared by publishing an **empty** payload (`""`) to it. A consumer must treat an empty retained payload as *"signal/entry removed"*, not as a value (`Removed = true` in `TelemetryReceivedEventArgs`).

---

## 5. Machine state

**Topic:** `{MachineNumber}/telemetry/machine/state`

```jsonc
{
  "type": "number",
  "value": "3",
  "timestampUtc": "2026-06-14T10:22:33.512Z"
}
```

### MachineState enum

| Value | Name | Meaning |
|------:|------|---------|
| 1 | `Off` | Machine off / not producing |
| 2 | `Idle` | Powered, waiting (no job running) |
| 3 | `Working` | Production running |
| 4 | `Error` | Fault / stopped on error |
| 5 | `Test` | Test / commissioning mode |

> These five values match the *HOMAG MMR OPC-UA Interface* accepted states exactly.

---

## 6. Defined machine telemetry

### Single-value signals (4-segment topics)

| Signal | Topic | Type | Meaning |
|--------|-------|------|---------|
| `state` | `{MachineNumber}/telemetry/machine/state` | number | Current machine state (see [§5](#5-machine-state)) |
| `parts` | `{MachineNumber}/telemetry/machine/parts` | number | Total parts produced (absolute counter) |
| `cycles` | `{MachineNumber}/telemetry/machine/cycles` | number | Total machine cycles (absolute counter) |
| `meter` | `{MachineNumber}/telemetry/machine/meter` | number | Total meters processed (absolute counter) |
| `program` | `{MachineNumber}/telemetry/machine/program` | string | Identifier of the currently loaded program |

For counters (`parts`, `cycles`, `meter`) only the absolute total is published — no delta/relative values, so there is no double-counting concern.

### Indexed signal groups (6-segment topics)

The `machine` category also carries indexed groups where each entry is addressed by an `{instance}` identifier. All use the same payload envelope ([§4](#4-payload-format)). A consumer subscribes to a whole group with the single-level wildcard, e.g. `{MachineNumber}/telemetry/machine/error/+/description`.

An entry is **removed** by publishing an empty retained payload to its topic (e.g. when an error is resolved). A `storage` entry spans three topics (`level`, `capacity`, `material`); removing the store means clearing each of them, because each is its own retained message.

#### Message topics

| Topic | Group | Type | Meaning |
|-------|-------|------|---------|
| `{MachineNumber}/telemetry/machine/error/{instance}/description` | error | string | An active error; one topic per error code |
| `{MachineNumber}/telemetry/machine/warning/{instance}/description` | warning | string | An active warning; one topic per warning code |
| `{MachineNumber}/telemetry/machine/maintenance/{instance}/description` | maintenance | string | A pending maintenance item; one topic per key |
| `{MachineNumber}/telemetry/machine/action/{instance}/description` | action | string | An active action; one topic per action key |

#### Storage topics

| Topic | Group | Type | Meaning |
|-------|-------|------|---------|
| `{MachineNumber}/telemetry/machine/storage/{instance}/level` | storage | number | Current fill level of the store |
| `{MachineNumber}/telemetry/machine/storage/{instance}/capacity` | storage | number | Maximum capacity of the store |
| `{MachineNumber}/telemetry/machine/storage/{instance}/material` | storage | string | Material identifier currently loaded |

#### Tool topics

| Topic | Group | Type | Meaning |
|-------|-------|------|---------|
| `{MachineNumber}/telemetry/machine/tool/{instance}/description` | tool | string | The name of the specific tool |
| `{MachineNumber}/telemetry/machine/tool/{instance}/tool-type` | tool | number | Tool type (see ToolType below) |
| `{MachineNumber}/telemetry/machine/tool/{instance}/counter-type` | tool | number | Counter type (see CounterType below) |
| `{MachineNumber}/telemetry/machine/tool/{instance}/counter` | tool | number | Current counter value |
| `{MachineNumber}/telemetry/machine/tool/{instance}/time` | tool | number | Operating time of the tool in seconds |

A tool has both a counter and an operating time, so the time is published on its own topic rather
than as a counter type. Tools of type `Other` have no counter: for those, only `time` is published.

### ToolType enum

| Value | Name | Meaning |
|------:|------|---------|
| 1 | `Milling` | Milling tool |
| 2 | `Drilling` | Drilling tool |
| 3 | `Marking` | Marking tool |
| 4 | `Fastening` | Fastening tool |
| 5 | `Sawing` | Sawing tool |
| 6 | `Glueing` | Glueing tool |
| 7 | `Other` | Any other tool. No counter is published, only its operating time |

### CounterType enum

The counter type follows from the tool type.

| Value | Name | Meaning |
|------:|------|---------|
| 1 | `Shoots` | Fastening shoots, for fastening tools |
| 2 | `Distance` | Distance in meter, for milling, marking, sawing and glueing tools |
| 3 | `Hits` | Hits, for drilling tools |

### OCCI mapping

This specification defines a fixed, closed set of topics — there are no user-defined or free-form topics. When integrating different machines, the relevant OCCI variables (low-level PLC tags) are **mapped** onto the defined topics above. The mapping is what differs per machine; the topic set itself does not.

---

## 7. Defined batch-variant telemetry

Data for the currently executing batch variant, published under the `batch-variant` category with `current` as the instance.

| Signal | Topic | Type | Meaning |
|--------|-------|------|---------|
| `id` | `{MachineNumber}/telemetry/batch-variant/current/id` | string | Id of the current batch variant |
| `state` | `{MachineNumber}/telemetry/batch-variant/current/state` | number | Execution state (see BatchState below) |
| `progress` | `{MachineNumber}/telemetry/batch-variant/current/progress` | number | Progress in percent (0–100) |
| `meter` | `{MachineNumber}/telemetry/batch-variant/current/meter` | number | Meters processed for this batch variant |
| `started` | `{MachineNumber}/telemetry/batch-variant/current/started` | string | Start timestamp (ISO 8601, UTC) |
| `finished` | `{MachineNumber}/telemetry/batch-variant/current/finished` | string | End timestamp (ISO 8601, UTC) |

The batch variant id is not carried in the other payloads; consumers read the `batch-variant/current/id` topic to know which batch variant the other `current/*` values belong to.

### BatchState enum

| Value | Name | Meaning |
|------:|------|---------|
| 1 | `Inactive` | Not started or paused |
| 2 | `Active` | Currently producing |
| 3 | `Done` | Finished successfully |
| 4 | `Aborted` | Stopped before completion |

> The `BatchState` values intentionally match `RunStatus` from the command interface.

---

## 8. .NET client API

Both services are registered by the same `AddSiteBroker(...)` call and take `MachineNumber` from `SiteBrokerOptions`. The producer stamps `timestampUtc` itself and publishes every message as retained.

### Machine side — `ITelemetryProducerService`

```csharp
// Generic publish (pre-built topic)
Task Publish(TelemetryTopic topic);

// Machine single-value signals
Task PublishMachineState(MachineState value);
Task PublishMachineParts(int value);
Task PublishMachineCycles(int value);
Task PublishMachineMeters(int value);
Task PublishMachineProgram(string value);

// Indexed groups (messages + storage)
Task PublishErrorDescription(string instance, string value);
Task PublishWarningDescription(string instance, string value);
Task PublishMaintenanceDescription(string instance, string value);
Task PublishActionDescription(string instance, string value);

// Storage (three separate topics per instance)
Task PublishStorageLevel(string instance, int value);
Task PublishStorageCapacity(string instance, int value);
Task PublishStorageMaterial(string instance, string value);

// Tools (four separate topics per instance)
Task PublishToolDescription(string instance, string value);
Task PublishToolType(string instance, ToolType value);
Task PublishToolCounterType(string instance, CounterType value);
Task PublishToolCounter(string instance, int value);
Task PublishToolTime(string instance, int value);

// Removal (publishes empty retained payload)
Task RemoveErrorDescription(string instance);
Task RemoveWarningDescription(string instance);
Task RemoveMaintenanceDescription(string instance);
Task RemoveActionDescription(string instance);
Task RemoveStorage(string instance);   // clears level, capacity and material topics
Task RemoveTool(string instance);      // clears description, tool-type, counter-type, counter and time topics

// Current batch variant
Task PublishBatchVariantId(string value);
Task PublishBatchVariantState(BatchState value);
Task PublishBatchVariantProgress(int value);
Task PublishBatchVariantMeters(float value);
Task PublishBatchVariantStarted(DateTime value);
Task PublishBatchVariantFinished(DateTime value);
```

### Consumer side — `ITelemetryConsumerService`

```csharp
// Fires for every telemetry message received.
// e.Removed == true when an empty retained payload arrives (signal removed).
event EventHandler<TelemetryReceivedEventArgs> TelemetryReceived;

Task Connect();
Task Disconnect();
```

`TelemetryReceivedEventArgs` carries the parsed `Topic` (a `TelemetryTopic`) and a `Removed` flag. The event is **generic** — one event for all telemetry topics — so a consumer handles any signal uniformly and reads `Topic.Path` to identify it.

### TelemetryTopic

```csharp
public class TelemetryTopic
{
    public required string Path { get; init; }         // full MQTT topic
    public TelemetryPayloadDto Payload { get; set; }   // type, value, timestampUtc envelope

    // Converts Payload.Value to T using InvariantCulture (e.g. GetValueAs<int>(), GetValueAs<DateTime>())
    public T GetValueAs<T>();
}
```

### TelemetryTopicHelper

Telemetry topics are built by `TelemetryTopicHelper`; the command/order topics live in a separate `OrderTopicHelper`.

```csharp
// Single-value machine topic
TelemetryTopic CreateMachineTelemetryTopic(string sender, string key);

// Indexed machine topics
TelemetryTopic CreateErrorTelemetryTopic(string sender, string instance, string key);
TelemetryTopic CreateWarningTelemetryTopic(string sender, string instance, string key);
TelemetryTopic CreateMaintenanceTelemetryTopic(string sender, string instance, string key);
TelemetryTopic CreateActionTelemetryTopic(string sender, string instance, string key);
TelemetryTopic CreateStorageTelemetryTopic(string sender, string instance, string key);
TelemetryTopic CreateToolTelemetryTopic(string sender, string instance, string key);

// Current batch variant topic (instance is always "current")
TelemetryTopic CreateBatchVariantTelemetryTopic(string sender, string key);

// Subscription topic for a consumer (appends /telemetry/#); pass the wildcard as sender for all machines
string GetTelemetrySubscriptionTopic(string sender);

// Returns true for a telemetry topic (4, 5 or 6 segments with "telemetry" as segment [1])
bool IsTelemetryTopic(string topic);
```
