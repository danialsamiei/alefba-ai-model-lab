# Deterministic Replay Specification

Status: **Version 0.1 design contract; current simulators implement a bounded subset**  
Revision date: **2026-08-31**

This specification defines how an educational run should become inspectable and repeatable. It distinguishes recomputation of deterministic local logic from playback of recorded external events.

## 1. Goals

A conforming replay should let a learner or reviewer:

- reproduce the same logical state from the same admissible inputs;
- see each transition in order;
- branch intentionally from a checkpoint;
- compare two runs without relying on animation timing;
- verify that configuration, sources, and artifacts have not silently changed;
- replay recorded external results without reissuing external actions;
- remove secrets while retaining enough structure for diagnosis.

Replay is not a claim of bitwise equality across every hardware/backend unless the bundle explicitly makes and proves that claim.

## 2. Replay modes

| Mode | Meaning | Network/tool behavior |
|---|---|---|
| **Exact deterministic recompute** | Re-run a pure or seeded local state transition from canonical inputs | No external calls |
| **Recorded playback** | Render previously captured events and results | Must not reissue an action |
| **Controlled branch** | Start at a verified checkpoint, change declared inputs, and create a new lineage | External calls remain disabled unless separately authorized |
| **Live rerun** | Execute current external dependencies again | Not deterministic replay; treated as a new run with new witnesses |

The UI must not label live rerun as replay.

## 3. Event envelope

The proposed portable event envelope is:

~~~json
{
  "specVersion": "alefba-replay-0.1",
  "runId": "content-derived-or-declared-id",
  "eventId": "evt-000004",
  "parentEventId": "evt-000003",
  "logicalTick": 4,
  "kind": "budget.item.omitted",
  "actor": "alefba-specimen-compiler",
  "status": "SIMULATED",
  "inputRefs": ["sha256:..."],
  "payload": {
    "itemId": "constraint-03",
    "reason": "budget-exceeded"
  },
  "evidence": [
    {"class": "LOCAL_STRUCTURAL", "ref": "test:..."}
  ],
  "sourceRefs": ["source:..."],
  "redactions": [],
  "implementation": {
    "repositoryRevision": "...",
    "engineVersion": "..."
  }
}
~~~

Required properties:

- `specVersion` selects the schema and canonicalization rules.
- `runId` identifies a lineage, not a human or secret.
- `eventId` is unique within a run.
- `parentEventId` creates an acyclic event graph; the first event may omit it.
- `logicalTick` determines instructional order. Wall-clock time does not.
- `kind` uses a documented event vocabulary.
- `status` follows the Claim Contract.
- `inputRefs` and `sourceRefs` use integrity-verifiable references where possible.
- `payload` contains only values needed to reproduce or explain the transition.
- `evidence` identifies how the event may support a claim.
- `redactions` disclose removed fields without disclosing their values.
- `implementation` binds the trace to code and engine versions.

## 4. Canonical representation and hashes

A future portable bundle must define one canonical byte representation. Version 0.1 recommends:

1. UTF-8 encoding;
2. Unicode normalization form NFC for human text;
3. JSON object keys sorted lexicographically;
4. no insignificant whitespace;
5. finite numbers only;
6. integer logical ticks;
7. numbers that affect deterministic state encoded in a specified lossless form;
8. SHA-256 over the canonical bytes;
9. an ordered event manifest whose root hash covers all event hashes.

Do not hash a platform-dependent pretty-printed form and call it portable. Floating-point model traces must declare dtype, shape, byte order, backend, and tolerance; a displayed decimal is not a complete tensor identity.

## 5. Run manifest

~~~json
{
  "specVersion": "alefba-replay-0.1",
  "runId": "run-...",
  "mode": "exact-deterministic-recompute",
  "createdBy": "local-user",
  "repositoryRevision": "...",
  "dependencies": {
    "pythonLock": "sha256:...",
    "nodeLock": "sha256:..."
  },
  "configuration": "sha256:...",
  "inputs": ["sha256:..."],
  "checkpoint": null,
  "seed": 7,
  "eventCount": 42,
  "eventRoot": "sha256:...",
  "externalCalls": "disabled",
  "redactionPolicy": "replay-redaction-0.1"
}
~~~

For a deterministic non-random simulator, `seed` may be `null`. For a learned model, seed alone is insufficient: runtime version, device/backend, numerical settings, checkpoint identity, tokenizer/data identity, and determinism limitations are required.

## 6. Determinism rules

The deterministic simulation path must not depend on:

- wall-clock time or locale-formatted current dates;
- unseeded pseudorandomness;
- DOM layout measurements as computation input;
- animation frame rate;
- object iteration with unspecified order;
- network responses, current external files, or environment-dependent identifiers;
- user-specific secrets;
- implicit current working directory;
- concurrency order without an explicit scheduler.

Allowed time in a trace is a declared logical tick. If a pedagogical timeline uses durations, they are explicit data and not measurements unless labeled as measured.

The current desktop simulation tests guard against common ambient sources such as `Math.random`, `Date.now`, and `performance.now` in the deterministic source. This is an implemented local invariant, not proof that every browser renderer is bitwise deterministic.

## 7. Model and retrieval replay

### 7.1 Model runs

Record:

- model/checkpoint hash and format;
- tokenizer or vocabulary version;
- architecture/configuration;
- input token IDs;
- seed and sampling parameters;
- dtype, device/backend, and deterministic settings;
- logits or selected diagnostic tensors when size permits;
- output tokens and stopping reason.

Sampling controls include at least temperature, top-k, top-p, repetition/frequency/presence penalties where implemented, maximum tokens, and seed. A parameter unsupported by the local engine must not appear as if it was applied.

### 7.2 RAG runs

Record:

- corpus snapshot/hash;
- chunking and normalization version;
- index implementation and build identity;
- query transformation;
- retrieved IDs, scores, and rank order;
- admitted versus omitted chunks under context budget;
- final prompt/APIR references;
- model result or recorded external result.

Re-running a query against a changed corpus is a new run, not an exact replay.

### 7.3 Tool and agent runs

Record:

- requested tool and normalized arguments;
- allowlist/policy decision;
- approval state and capability scope;
- side-effect class;
- result schema and validation outcome;
- stopping condition, budget, and iteration count.

Recorded playback must use the recorded tool result and must never trigger the tool. A live tool rerun requires new authorization and creates a new lineage.

## 8. Checkpoints and branching

A checkpoint is valid only if its hash covers all state required for continuation. A branch event declares:

- parent run and checkpoint hash;
- changed field(s);
- branch reason;
- new run ID;
- whether prior external witnesses remain applicable.

External U/O witnesses normally do not transfer to a changed branch. They must be re-established for the new execution and scope.

~~~mermaid
gitGraph
  commit id: "input"
  commit id: "checkpoint A"
  branch higher-temperature
  checkout higher-temperature
  commit id: "declared change"
  commit id: "new result"
  checkout main
  commit id: "original result"
~~~

## 9. Failure injection

Educational replay may inject a declared failure—missing retrieval result, tool denial, budget exhaustion, expert overload, malformed source, or absent witness. The injection must be a first-class event with:

- injection point;
- failure type and parameters;
- expected invariant;
- recovery or stop behavior;
- `Simulated` status.

Failure injection must not be confused with an observed production incident.

## 10. Redaction and secrets

Replay bundles must never require raw credentials. Before export:

- remove API keys, OAuth tokens, cookies, authorization headers, private keys, and device-bound credentials;
- minimize personal data and user prompts;
- replace sensitive values with stable opaque placeholders only when linkage is needed;
- record the field path and redaction reason;
- prevent secrets from appearing in hashes that allow practical guessing;
- treat retrieved documents and tool output as potentially sensitive;
- allow an owner to exclude an event completely and disclose the omission.

A replay that cannot be made safe should remain local. “Deterministic” does not mean “safe to publish.”

## 11. External witnesses

An external event may be included in a recorded bundle if it contains:

- adapter and endpoint class, without secrets;
- request hash and authority decision reference;
- response/result hash and validation status;
- witness scope (`U` or `O`), issuer, and collection method;
- timestamp as recorded evidence, not an input to deterministic recomputation;
- expiration or freshness rule when relevant.

Playback can show the witness but cannot renew it. HTTP status alone is not an uptake or outcome witness.

## 12. Conformance levels

| Level | Requirement | Current repository status |
|---|---|---|
| **L0 — Inspectable state** | Input, controls, state, and output visible | **Implemented** across bounded labs |
| **L1 — Deterministic local simulation** | Same canonical input produces same event/state result | **Implemented** for the desktop research simulator |
| **L2 — Version-bound model run** | Model/data/config/dependency identities recorded | **Partial**; local labs expose artifacts, full bundle contract is not complete |
| **L3 — Portable replay bundle** | Canonical manifest, hashes, redaction, validation tool | **Planned** |
| **L4 — Signed receipts and external witnesses** | Signature/key governance and verifier | **Planned / External** |

## 13. Minimum conformance tests

A future validator must test:

1. schema version and supported event kinds;
2. unique event IDs and acyclic parent graph;
3. monotonic logical ordering on each branch;
4. canonical byte stability;
5. manifest/event hash integrity;
6. identical state hash for repeated deterministic recompute;
7. declared variance/tolerance for numerical model runs;
8. rejection of undeclared external calls during replay;
9. no tool execution during recorded playback;
10. explicit branch lineage for changed inputs;
11. redaction policy and secret-pattern scan;
12. U/O remain unknown when required witness is absent;
13. corrupted checkpoint/source/configuration is rejected;
14. unknown fields are handled according to the schema's forward-compatibility rule.

## 14. User-facing replay controls

The intended visual workflow is:

~~~text
Load verified run → inspect manifest → play/pause → step event
→ inspect input/state/evidence → branch with declared change
→ compare state diff → export only after redaction review
~~~

Animation speed affects presentation only. It must not alter logical order or model state.

See [Architecture](ARCHITECTURE.md), [Claim Contract](CLAIM_CONTRACT.md), and [Threat Model](THREAT_MODEL.md).
