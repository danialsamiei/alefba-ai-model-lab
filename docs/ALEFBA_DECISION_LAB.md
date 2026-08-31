# alef.ba Decision Lab

Status: **Implemented, bounded educational specimen**  
Revision date: **2026-08-31**

The alef.ba Decision Lab is the project's operational bridge between learning about AI and making a reviewable technical decision. It turns a small, tagged source specimen into a typed intermediate representation, packs it under an explicit budget, renders an inspectable result, and issues a receipt whose unknowns cannot be silently promoted to success.

It is not a universal semantic compiler, an authorization service, a live model gateway, or proof that a downstream model followed the result.

## 1. The decision problem

Architecture discussions commonly mix four different things:

1. what the source actually says;
2. what the designer decided;
3. what fits into a target model or tool context;
4. what happened after delivery.

The Decision Lab separates them:

~~~mermaid
flowchart LR
    S[Source specimen] --> T[Typed commitments]
    T --> A[Source-grounded APIR]
    A --> B[Budget + target selection]
    B --> R[Rendered decision artifact]
    R --> V[I / R verification]
    X[External witness] -. optional .-> U[U / O verification]
    V --> RC[Receipt]
    U --> RC
~~~

## 2. Input contract

The current compiler accepts between 1 and 256 tagged entries. Each entry has a stable position and one of five types:

| Tag | Meaning | Typical question |
|---|---|---|
| `GOAL` | Desired result or evaluation target | What are we trying to improve or learn? |
| `CONSTRAINT` | Hard boundary, cost, policy, latency, hardware, or safety rule | What must the design not violate? |
| `DECISION` | A chosen option with accountable wording | What did the designer choose? |
| `EVIDENCE` | Source-bearing support for a claim | What public or local evidence supports it? |
| `UNKNOWN` | A deliberately unresolved fact or dependency | What must not be guessed? |

Conceptual specimen:

~~~text
GOAL: Teach next-token prediction with an inspectable ten-token vocabulary.
CONSTRAINT: Core lessons must run locally without an API key.
EVIDENCE: The root package contains a decoder-only PyTorch model and tests.
DECISION: Use the real Digit LM for logits and the desktop layer for projection.
UNKNOWN: Uptake by a future external target has not been witnessed.
~~~

Input rules:

- empty or malformed collections are rejected;
- IDs must be unique after compilation;
- source order is preserved;
- provenance is attached to every admitted item;
- an evidence reference either resolves or is represented as unknown;
- an unknown is data, not an invitation to invent a value.

## 3. Current deterministic compilation algorithm

The implementation exports `compileAlefbaSpecimen` from `reasoning-lab/desktop/src/researchSimulation.js` and labels its output `alefba-apir-v1` with `conceptualOnly: true`.

### 3.1 Normalize

1. Validate the collection size and supported tags.
2. Normalize whitespace without changing source order.
3. Assign deterministic IDs and provenance.
4. Resolve explicit evidence relationships where possible.

### 3.2 Estimate cost

The teaching implementation uses an inspectable approximate cost derived from character count plus fixed overhead. It is not claimed to match a provider tokenizer. A target-specific tokenizer belongs in a future renderer profile.

### 3.3 Select under budget

The current pedagogical priority is:

| Type | Priority |
|---|---:|
| `GOAL` | 100 |
| `CONSTRAINT` | 95 |
| `EVIDENCE` | 90 |
| `DECISION` | 80 |
| `UNKNOWN` | 60 |

Items are admitted deterministically under the configured budget. Every excluded item enters an omission ledger with a reason. Priority is a transparent teaching policy, not a universal ranking of meaning.

### 3.4 Render and verify

The admitted set is rendered into an inspectable artifact. Verification checks structural and provenance properties locally, then creates U/O fields that remain unknown unless a correctly scoped external witness is supplied.

~~~text
validate → normalize → identify → ground → estimate → select → omit-ledger
        → render → verify I/R → attach external U/O witness if present → receipt
~~~

## 4. APIR output

A conceptual APIR record contains:

| Field group | Purpose |
|---|---|
| Format/version | Make the representation contract explicit |
| Typed entries | Separate goals, constraints, decisions, evidence, and unknowns |
| Identity | Maintain stable references within a run |
| Provenance | Retain the relation to admitted source material |
| Evidence links | Resolve support or disclose missing support |
| Cost and budget | Explain why an item fit or did not fit |
| Omission ledger | Make loss visible rather than silent |
| Target profile | Describe rendering constraints without implying authority |
| Receipt | Record I/R/U/O results and their witness classes |

APIR owns representation. It does not own execution permission. It may be serialized into JSON or carried through MCP/API/A2A, but the carrier does not inherit authority from the representation.

## 5. Receipt semantics

~~~mermaid
stateDiagram-v2
    [*] --> Check
    Check --> PASS: required evidence validates
    Check --> FAIL: required evidence contradicts contract
    Check --> UNKNOWN: witness absent or scope insufficient
    PASS --> [*]
    FAIL --> [*]
    UNKNOWN --> [*]
~~~

| Code | Name | Local verifier | Prohibited shortcut |
|---|---|---|---|
| **I** | Integrity | schema, ID uniqueness, budget accounting, omission records | Treating syntactic JSON as complete integrity |
| **R** | Representation | provenance, source order, evidence reference resolution | Treating fluent rendering as faithful representation |
| **U** | Uptake | none without a target-side witness | Treating send/HTTP success as model use |
| **O** | Outcome | none without a domain witness | Treating model output as real-world outcome |

For the current compiler:

- `I` and `R` can be established by local structural evidence.
- `U` requires explicit external evidence scoped with `witness=U`.
- `O` requires explicit external evidence scoped with `witness=O`.
- internal `DECISION` entries cannot witness `U` or `O`.
- renderer output cannot witness its own uptake.

## 6. Decision workflow

The lab can be used as an architecture decision record without pretending to automate judgment.

~~~mermaid
flowchart TD
    Q[State the decision question] --> G[Enter goals and constraints]
    G --> E[Attach primary-source evidence]
    E --> K[Mark unresolved facts UNKNOWN]
    K --> P[Choose budget and target profile]
    P --> C[Compile APIR specimen]
    C --> O{Critical omission?}
    O -- yes --> B[Revise scope, budget, or source set]
    B --> C
    O -- no --> D[Review candidate decision]
    D --> A{External action requested?}
    A -- no --> R[Record local I/R receipt]
    A -- yes --> H[Authenticate + policy + consent + scoped capability]
    H --> X[Execute through adapter]
    X --> W[Collect U/O witness]
    W --> R
~~~

Recommended decision record:

| Section | Required content |
|---|---|
| Question | One falsifiable design question |
| Goals | Observable outcomes or learning objectives |
| Constraints | Budget, hardware, privacy, latency, licensing, and safety |
| Options | At least the credible alternatives, not only the preferred one |
| Evidence | Primary sources and local measurements with dates |
| Unknowns | Missing facts and the decision they could change |
| Choice | Accountable rationale and trade-offs |
| Receipt | I/R status; U/O only with external witnesses |
| Review trigger | Date, upstream change, failed metric, or new evidence |

## 7. Target profiles

A target profile should eventually define:

- allowed serialization and schema version;
- real tokenizer or cost estimator;
- hard and soft context budgets;
- required source citations and identifier retention;
- ordering and truncation policy;
- tool schema constraints;
- language, accessibility, and locale requirements;
- output validation rules;
- authority handoff requirements, if execution is requested.

The current teaching profile demonstrates budgeted selection. Provider-specific, multimodal, tool-calling, streaming, and structured-output parity are **Planned** and must be tested separately.

## 8. Transport ≠ authority

The Decision Lab may prepare a payload for a transport, but an authorized execution requires a separate chain:

~~~text
authenticated identity
  → current policy
  → explicit consent or approval
  → least-privilege capability
  → execution boundary
  → independently recorded result
~~~

An MCP server, API schema, A2A message, or agent instruction is not that chain. A model-generated request must never enlarge its own permissions. See the [Threat Model](THREAT_MODEL.md).

## 9. Capability ledger

| Capability | Status | Evidence and limit |
|---|---|---|
| Tagged specimen parsing | **Implemented** | Local deterministic JavaScript implementation and tests |
| IDs, provenance, source order | **Implemented** | Structural checks and unit tests |
| Budgeted selection and omission ledger | **Implemented** | Deterministic pedagogical policy |
| Local I/R receipt | **Implemented** | Structural, not semantic-equivalence proof |
| External U/O witness fields | **Implemented** as a contract | Does not create or fetch the witness |
| Architecture recommendation canvas | **Simulated** | Educational decision support, not an optimizer |
| Named provider target profile | **External** | Requires provider documentation and validation |
| Live MCP/API/A2A execution | **External** | Outside the offline core and subject to authority controls |
| Learned extraction and semantic-equivalence verifier | **Planned** | No present implementation claim |
| Signed, portable receipts | **Planned** | Requires canonical format and key governance |
| Published cross-model AlefBench | **Planned** | No published benchmark result at this revision |

## 10. Acceptance criteria for a future production adapter

A provider or tool adapter is not complete until it can show:

1. a versioned target profile and serialization contract;
2. tokenizer/cost accounting measured against the actual target;
3. source and APIR hashes carried into the request record;
4. independent authentication and authorization;
5. explicit consent/approval for consequential actions;
6. least-privilege tool scopes and budget limits;
7. output validation and untrusted-content handling;
8. target-side evidence for any U claim;
9. domain evidence for any O claim;
10. redacted deterministic or recorded replay evidence;
11. rollback/revocation behavior;
12. tests demonstrating that missing witnesses remain `UNKNOWN`.

## 11. Worked micro-example

Suppose a learner must choose between a dense Transformer and sparse MoE for a CPU classroom lab.

1. `GOAL`: expose every routing decision to the learner.
2. `CONSTRAINT`: run on a laptop CPU with a small memory budget.
3. `EVIDENCE`: local benchmark traces for both micro-models; primary MoE paper.
4. `UNKNOWN`: whether the chosen lesson transfers to a production-scale MoE.
5. `DECISION`: use the tiny sparse-MoE experiment to teach routing, and explicitly avoid performance extrapolation.

The compiler can prove that the decision, evidence, and unknown were represented and fit the budget (`I`, `R`). It cannot prove that students learned the concept (`O`) unless a separately designed learning assessment supplies that witness. This distinction is the point of the lab.

## 12. Related contracts

- [Architecture](ARCHITECTURE.md)
- [Claim Contract](CLAIM_CONTRACT.md)
- [Replay Specification](REPLAY_SPEC.md)
- [Threat Model](THREAT_MODEL.md)
- [Research source register](research/SOURCES.md)
