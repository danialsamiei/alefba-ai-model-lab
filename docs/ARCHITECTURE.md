# Architecture

Status: **Normative project documentation**  
Revision date: **2026-08-31**

This document defines the observable architecture of Alefba AI Model Lab. It describes repository code and public contracts; it does not claim to describe confidential internals of any named product.

## 1. Design principles

1. **Small enough to inspect.** Core lessons use ten tokens, tiny corpora, bounded tools, and explicit state so a learner can follow one transformation at a time.
2. **Evidence before analogy.** A visual metaphor may explain a concept, but its status and source must remain visible.
3. **Computation and projection are separate.** Numerical engines produce state; renderers project that state into tables, diagrams, and 3D scenes.
4. **Unknown is a valid result.** The system does not convert a missing external witness into a pass or fail.
5. **Replay before spectacle.** Deterministic, inspectable traces are preferred for educational simulations.
6. **Transport is not authority.** Moving a message through HTTP, API, MCP, A2A, or JSON-RPC does not authorize an action.
7. **Local by default.** The core labs do not require provider credentials. External adapters must be explicit and separately governed.

## 2. System context

~~~mermaid
flowchart TB
    U[Learner / researcher / designer]

    subgraph Repo[Alefba AI Model Lab monorepo]
      D[Digit Microscope LM\nreal PyTorch computation]
      Q[Micro Reasoning Lab\nreal bounded components]
      E[Deterministic simulation engine]
      P[2D / 3D projection layer]
      DB[(SQLite traces and local datasets)]
      C[Claim + source registry]
      A[Alefba Decision Lab]
    end

    subgraph Outside[Explicit external boundary]
      M[Public papers and official docs]
      X[Optional provider / MCP / API / A2A adapter]
      W[External uptake or outcome witness]
    end

    U --> D
    U --> Q
    U --> P
    D --> DB
    Q --> DB
    E --> P
    C --> P
    M --> C
    A --> E
    A -. optional payload .-> X
    X --> W
    W -. evidence .-> A
~~~

Arrows show information flow, not permission. The dotted external lane is not required to learn, train the micro-models, or run the deterministic visual laboratory.

## 3. Monorepo layers

| Layer | Primary location | Responsibility | Present status |
|---|---|---|---|
| Digit model | `src/digit_lm/` | Train and inspect a decoder-only Transformer over vocabulary `0…9` | **Implemented** |
| Reasoning engines | `reasoning-lab/src/reasoning_lab/` | Compare small n-gram, MLP, dense Transformer, scratchpad, sparse-MoE, RAG, and tool paths | **Implemented** |
| Local evidence store | SQLite databases and small files under project-owned paths | Persist datasets, retrieval documents, runs, metrics, and traces | **Implemented** |
| Research simulator | `reasoning-lab/desktop/src/researchSimulation.js` | Produce bounded, deterministic event/state models for educational views | **Implemented** as a simulator |
| Catalog and source metadata | `reasoning-lab/desktop/src/researchCatalog.js` and `docs/research/SOURCES.md` | Describe concepts, status, boundaries, and primary sources | **Implemented** |
| Projection/UI | `reasoning-lab/desktop/` | Render tables, flows, comparisons, and Three.js scenes | **Implemented** |
| Named-product execution | Outside this repository | Actual behavior of proprietary or separately hosted systems | **External** |
| Portable signed replay and live connectors | Future bounded modules | Exchange replay bundles and opt-in external evidence | **Planned** |

### 3.1 Real computation

The two Python laboratories execute real algorithms:

- tensor operations, optimization, checkpointing, logits, and token probabilities in Digit LM;
- small model families, retrieval, routing, effort, tool selection, and trace persistence in Micro Reasoning Lab.

“Micro” describes scale, not a mock. Results still depend on the selected data, configuration, seed, hardware numerical behavior, and checkpoint.

### 3.2 Deterministic simulation

The desktop research engine computes educational state transitions from bounded inputs. Its tests reject ambient nondeterminism such as wall-clock time or unseeded randomness on the deterministic path. The resulting event graph can illustrate:

- sampling controls and reasoning budgets;
- agent harnesses, context engineering, orchestration, and tool calls;
- RAG, MoE, diffusion, multimodal, monitoring, prediction, trend, and foresight workflows;
- named architectures only at the level documented by public sources;
- abliteration as a conceptual weight-space intervention, without mutating a checkpoint.

A simulation is not a benchmark of the named production system and does not establish model parity.

### 3.3 Projection

The visual layer receives state and maps it to positions, colors, labels, tables, timelines, and optional 3D geometry. Geometry is explanatory. Node size, distance, motion, or color has quantitative meaning only when the view explicitly defines its scale.

~~~mermaid
flowchart LR
    I[Input or recorded event] --> K[Computation / simulation kernel]
    K --> S[Inspectable state]
    S --> T[Table / text]
    S --> F[Flow / timeline]
    S --> G[Three.js scene]
    T --> R[User interpretation]
    F --> R
    G --> R
~~~

Changing camera angle must not change the underlying state. Changing a model control must create a new state and trace.

## 4. The alef.ba semantic lane

The bounded architectural proposition evaluated here is:

~~~mermaid
flowchart LR
    S[Source\ncontent + provenance] --> X[Extract\nexplicit commitments]
    X --> A[Typed, source-grounded APIR]
    A --> P[Pack\nbudget + target profile]
    P --> R[Render\ntarget artifact]
    R --> V[Verify\nI / R / U / O]
    V --> C[Receipt\nclaims + evidence + unknowns]
~~~

### 4.1 Source

A source is content plus provenance: stable identifier, origin, capture context, and—when available—integrity metadata. A pasted sentence with no origin may still be processed, but its provenance quality must not be overstated.

### 4.2 Typed, source-grounded APIR

APIR is an intermediate representation of meaning-bearing commitments. In the current specimen compiler, entries are tagged as:

- `GOAL`
- `CONSTRAINT`
- `DECISION`
- `EVIDENCE`
- `UNKNOWN`

Each entry receives an identity and provenance. Evidence references either resolve to an admitted source item or remain explicitly unknown. APIR is not a universal language, a memory database, a provider gateway, or proof of semantic equivalence.

### 4.3 Budget and target profile

Packing selects what can fit under an explicit budget and records exclusions rather than silently dropping them. A target profile describes recipient constraints—format, context capacity, required fields, or rendering rules. The current lab uses an inspectable pedagogical policy; production-quality optimization and learned extraction are **Planned**, not implied.

### 4.4 Render

A renderer maps admitted APIR commitments to a target artifact. Rendering may change form, ordering, or compression, but it must preserve identifiers or a traceable mapping. A renderer does not cause a recipient to use the artifact.

### 4.5 Verify and receipt

The receipt separates four questions:

| Witness | Question | Local proof can establish | Required external evidence |
|---|---|---|---|
| **I — Integrity** | Is the artifact structurally valid and internally consistent? | Schema, unique IDs, budget accounting, omission ledger | None for local structural claims |
| **R — Representation** | Are commitments traceable to admitted source and provenance? | Source order, provenance links, resolved evidence references | None for local traceability claims |
| **U — Uptake** | Did the target actually receive and use the rendered artifact? | No | A target-side, scope-bound witness |
| **O — Outcome** | Did the claimed external result occur? | No | A domain-appropriate outcome witness |

`UNKNOWN` is the correct status for U or O when no external witness is supplied. Internal decisions, renderer output, HTTP success, or tool-call acceptance cannot substitute for that witness.

## 5. Transport and authority are separate planes

~~~mermaid
flowchart TB
    subgraph Semantic[Semantic plane — owned by alef.ba scope]
      AP[APIR] --> RE[Target renderer]
      RE --> RC[Representation receipt]
    end

    subgraph Transport[Transport plane]
      H[HTTP / API] --- M[MCP] --- A[A2A / JSON-RPC]
    end

    subgraph Authority[Authority plane — separately enforced]
      ID[Authenticated identity] --> POL[Policy]
      POL --> CON[Consent / approval]
      CON --> CAP[Scoped capability]
    end

    subgraph Execution[Execution and evidence plane]
      CAP --> EX[Tool or service execution]
      EX --> W[External witness]
    end

    RE -. payload .-> Transport
    Transport -. delivery .-> Authority
    W -. U / O evidence .-> RC
~~~

Required invariants:

1. A transport adapter cannot mint authority merely because it can reach a tool.
2. Model text cannot enlarge a caller's capability scope.
3. Identity, policy, consent, and budget are checked at or before execution.
4. Tool results are untrusted input until validated.
5. Receipt claims identify their evidence class and scope.
6. A `200`, `202`, accepted tool call, or rendered prompt does not prove uptake or outcome.

## 6. Data and artifact lifecycle

~~~mermaid
sequenceDiagram
    participant L as Learner
    participant C as Config/data
    participant E as Engine
    participant S as SQLite/checkpoint
    participant P as Projection
    participant R as Receipt

    L->>C: choose bounded input and controls
    C->>E: validated configuration
    E->>S: events, metrics, checkpoint metadata
    E->>P: inspectable state
    P-->>L: table / flow / 3D view
    E->>R: local I/R evidence
    R-->>L: pass, fail, or unknown by witness
~~~

- Small datasets are versionable and inspectable. Generated or synthetic data must be labeled.
- Checkpoints use explicit formats and metadata; do not treat arbitrary checkpoint files as trusted code.
- Database state is local by default. A copied database may contain prompts, traces, or retrieved text and therefore requires the same care as source data.
- Reproducibility requires configuration, code revision, dependency lock, seed where applicable, input hashes, and artifact hashes—not just the final screenshot.

## 7. Deployment topology

| Topology | Components | Network requirement | Evidence boundary |
|---|---|---|---|
| Python CLI/service | Python 3.11, uv, CPU PyTorch, FastAPI | Initial dependency installation; core run can be local | Real micro-model output |
| Desktop development | Node.js, Electron, Vite, Three.js | Initial dependency installation; core UI can be local | Deterministic simulation plus local projection |
| Windows portable build | electron-builder x64 portable target | Build dependencies only | Local artifact; publication requires separate release evidence and checksum |
| Optional external integration | Explicit adapter plus credentials and policy | Yes | External; adapter must retain witness and authority boundaries |

No checked-in screenshot, locally built executable, or successful development run should be described as a published release without release-page and checksum evidence.

## 8. Cross-cutting contracts

- [Claim Contract](CLAIM_CONTRACT.md) defines what wording each evidence class supports.
- [Replay Specification](REPLAY_SPEC.md) defines deterministic event and bundle requirements.
- [Threat Model](THREAT_MODEL.md) defines trust boundaries and abuse cases.
- [Decision Lab](ALEFBA_DECISION_LAB.md) defines the current APIR specimen and receipt semantics.
- [Research Sources](research/SOURCES.md) is the primary-source registry.
- [Comparison](COMPARISON.md) applies a dated, neutral comparison rubric.

## 9. Architectural non-goals

The current repository does not claim:

- parity with ChatGPT, Sora, Codex, Claude Code, Qwen, DeepSeek, or any other named system;
- access to a model's private training mixture, hidden reasoning, weights, or production harness;
- universal or lossless conversion of arbitrary meaning into APIR;
- that an educational attention view is a causal explanation of model behavior;
- live provider inference, live tool authority, or automatic action on external systems by default;
- that local deterministic simulation predicts real-world futures;
- that abliteration is performed on downloadable checkpoints;
- certification for security, accessibility, or scientific validity.

These boundaries are features of the architecture: they keep a learner able to distinguish what ran, what was modeled, what was sourced, and what remains unknown.
