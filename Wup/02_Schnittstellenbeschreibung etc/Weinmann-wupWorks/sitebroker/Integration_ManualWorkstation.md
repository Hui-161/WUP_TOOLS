# SiteBroker Client Integration — Manual Workstation

**Target audience:** Third-party companies that want to connect a **manual workstation** as a client to the HOMAG SiteBroker.

> 📖 This document describes only what is **specific to a manual workstation**. The general concept is in the **[General Concept](General_Concept.md)**, the integration workflow in the **[Integration Guide](Integration_Guide.md)**, and the exact technical specification (topics, payloads, status enums, API, configuration) exclusively in the **[Interface & Method Specification](Interface_Specification.md)**. This document links there instead of repeating it.

---

## 1. What is different about a manual workstation?

A manual workstation behaves like a machine client towards the SiteBroker: it receives commands (load documents, prepare jobs, start executions) and reports its status back. Unlike a fully automated machine, however:

- The **manual workstation might not implement all commands** and typically does no heavy preparation.
- It has its **own document database** and therefore does **not** call the central database via REST.
- Because no central database is queried, the document ID (`OrderId`) is delivered **directly in the MQTT payload** of the `produce` (Run Batch Variant) command, so the workstation can look the document up locally.

It has to be ensured that the `OrderId` is synchronised by using `wup specification 3.7` and providing an `ELEMENTID`.

---

## 2. Behaviour per command

The topics, payload envelope and status enums are defined in [Interface & Method Specification §2–§6](Interface_Specification.md#2-topic-structure). The manual workstation deviates only in the following ways.

### 2.1 Load Order

- Clear the retained command immediately.
- **No REST call** to the central DB — the document already exists in the workstation's own database.
- Respond directly with `Status = Imported (2)` and `OrderId` in `AdditionalProperties`.

### 2.2 Prepare Batch

- Clear the retained command immediately.
- Respond directly with `Status = Ready (3)` — no complex preparation required.

### 2.3 Run Batch Variant

The orchestrator must include the document `OrderId` directly in the `AdditionalProperties` of the `produce` command (extended payload, see [Interface & Method Specification §6.3](Interface_Specification.md#63-run-batch-variant)):

```json
{
  "Status": 0,
  "AdditionalProperties": { "OrderId": "550e8400-e29b-41d4-a716-446655440000" }
}
```

The workstation uses this id to look up and **display the document from its own database**, then reports `Active (2)` and finally `Done (3)` after the operator acknowledges.

---

## 3. Important notes

The general edge cases apply unchanged (see [Integration Guide §5](Integration_Guide.md#5-error-handling--edge-cases)). The points most relevant to a manual workstation are:

| # | Note |
|---|------|
| 1 | **Clear retained messages** — Every command must be cleared immediately via `Clear*Request()`, otherwise it is re-delivered after a client restart. See [Interface & Method Specification §7](Interface_Specification.md#7-clear-mechanism-retained-messages). |
| 2 | **Online mode is required** — The orchestrator only sends `PrepareBatch` and `ExecuteBatchVariant` to clients that are in online mode. |
| 3 | **Unique machine number** — Every client requires a system-wide unique `MachineNumber` (e.g. `HAP-01`). |
| 4 | **OrderId in the produce payload** — For the manual workstation the SiteBroker/orchestrator must include the `OrderId` in `AdditionalProperties` of the `produce` command. |
| 5 | **Error handling** — Always respond with the `Aborted` status on errors so that the orchestrator can record the state correctly. |
| 6 | **MQTT QoS** — QoS 2 (ExactlyOnce) is used for control commands. |
