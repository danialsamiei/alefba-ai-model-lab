# Threat Model

Status: **Living security design document**  
Revision date: **2026-08-31**

This threat model covers the local Python laboratories, the Electron desktop visualization, data/checkpoint handling, deterministic replay, and any future optional external adapters. It does not certify the project, an upstream dependency, or a named model as secure.

## 1. Security objectives

The project aims to protect:

1. the user's workstation, files, credentials, and network authority;
2. the integrity and provenance of datasets, sources, checkpoints, traces, and receipts;
3. the separation between educational simulation and real execution;
4. the confidentiality of prompts, retrieved documents, tool results, and replay data;
5. the availability of the local lab under bounded workloads;
6. the accuracy of public claims and the visibility of uncertainty;
7. the learner from accidentally treating a diagram or forecast as verified reality.

## 2. Assets

| Asset | Why it matters |
|---|---|
| Local source tree and configuration | Defines what actually runs and what evidence can be reproduced |
| Python/Node lockfiles and dependencies | Determine executable supply chain |
| Datasets, retrieval corpus, SQLite databases | May contain copyrighted, sensitive, poisoned, or identifying content |
| Checkpoints and tensor files | Influence model behavior and may be large or maliciously formed |
| Prompts, traces, and replay bundles | Can contain secrets, personal data, or attack instructions |
| Source/provenance registry | Supports scientific and architectural claims |
| APIR artifacts and receipts | May be mistaken for authorization or outcome proof |
| Tool allowlist and policy state | Controls side effects and least privilege |
| Release artifacts and checksums | Define what a Windows user actually downloads and executes |
| Status labels and explanations | Prevent simulation/implementation confusion |

## 3. Actors

- **Learner/researcher:** usually benign, may accidentally load unsafe data, expose a secret, or misunderstand a status label.
- **Contributor:** can change code, data, documentation, tests, dependencies, or claims; may be compromised or malicious.
- **Data/source publisher:** may provide poisoned, outdated, misleading, or prompt-injecting content.
- **Model/checkpoint publisher:** may publish altered, incompatible, deceptive, or unsafe artifacts.
- **Remote tool/provider:** returns untrusted content and may change behavior over time.
- **Attacker controlling content:** tries to turn documents, prompts, replay bundles, links, or model output into code execution or authority escalation.
- **Compromised dependency/build service:** can modify development or packaged artifacts.

Model output is never a trusted principal. It cannot grant permission to itself or another component.

## 4. Trust boundaries

~~~mermaid
flowchart LR
    U[User] --> UI[Electron/web UI]
    UI --> SIM[Deterministic simulator]
    UI --> API[Local FastAPI services]
    API --> DB[(SQLite/data)]
    API --> CK[Model checkpoints]

    DOC[Untrusted document/source] --> DB
    MOD[Untrusted checkpoint] --> CK

    subgraph External[Optional external boundary]
      AD[Adapter]
      ID[Identity + policy + consent]
      TOOL[Provider/tool]
      W[External witness]
    end

    UI -. explicit request .-> AD
    AD --> ID
    ID --> TOOL
    TOOL --> W
    W -. untrusted evidence input .-> API
~~~

Important boundaries:

- renderer versus computation engine;
- local browser/Electron renderer versus privileged main process;
- application versus filesystem;
- retrieved/source content versus instructions;
- model proposal versus policy decision;
- transport versus identity/authority;
- local structural receipt versus external uptake/outcome witness;
- source build versus published Windows binary.

## 5. Threats and controls

### T1. Prompt injection through sources or RAG

**Threat:** A retrieved document tells the model or host to ignore policy, expose data, invoke a tool, or reinterpret untrusted content as system instruction.

**Current controls:** the real RAG experiment is bounded and local; tools are allowlisted; documentation identifies retrieved content as untrusted; core labs need no external credentials.

**Required/planned controls:** content/instruction separation, tool argument validation, least-privilege capabilities, approval for consequential actions, provenance display, retrieval scope limits, and adversarial fixtures. No delimiter is treated as a complete defense.

### T2. Tool escalation and confused deputy

**Threat:** A model-generated call exceeds the user's intended scope, a transport exposes a privileged tool, or one agent delegates authority it does not own.

**Current controls:** bounded allowlisted educational tools and the documented `transport ≠ authority` invariant.

**Required for any live adapter:** authenticated identity, server-side policy, explicit consent/approval, typed arguments, per-tool capability scopes, rate/cost limits, idempotency, result validation, audit record, revocation, and fail-closed defaults.

MCP, API, A2A, OpenAPI, JSON-RPC, or a harness can carry a request; none is authorization by itself.

### T3. Malicious or unsafe checkpoints

**Threat:** A checkpoint exploits unsafe deserialization, exhausts memory/disk, carries an unexpected architecture, or behaves differently from its label.

**Current controls:** project checkpoints use explicit bounded local formats, including safetensors in the Python dependencies.

**Required controls for arbitrary imports:** reject executable pickle formats by default; validate format, size, tensor names/shapes/dtypes, architecture contract, license, source, and checksum in a resource-constrained worker. Treat model behavior and publisher claims separately.

### T4. Dataset poisoning and source spoofing

**Threat:** Training or retrieval data inserts a backdoor, false scientific claim, mislabeled license, or forged provenance.

**Current controls:** small inspectable datasets, manifests/hashes in the micro labs, primary-source register, explicit evidence and unknown types.

**Planned controls:** dataset cards, signed or independently pinned source snapshots, duplicate/anomaly checks, license review, contamination tests, and review for high-impact source changes.

### T5. Path traversal, unsafe import, or malformed serialization

**Threat:** A crafted filename, archive, JSON, database, replay bundle, or URL causes reads/writes outside project scope or parser exploitation.

**Controls:** canonicalize and validate paths against an explicit project-owned root; reject traversal and absolute paths in portable bundles; limit file count/size/depth; use versioned schemas; reject non-finite values; avoid eval/dynamic code loading; open untrusted databases read-only in a constrained process when feasible.

Full portable replay import validation is **Planned**.

### T6. Electron renderer compromise

**Threat:** XSS, unsafe navigation, remote content, or an exposed bridge reaches Node/Electron privileges.

**Current architecture:** the desktop app is a packaged local interface; educational links can navigate to external sources.

**Required controls:** keep `contextIsolation` enabled, keep renderer Node integration disabled, expose a minimal validated preload API, deny unexpected navigation/window creation, use a restrictive CSP, escape/sanitize dynamic HTML, use `rel="noopener noreferrer"`, do not load remote executable content, and test packaged—not only development—settings.

These controls must be verified against the actual Electron configuration before a release claim; documentation alone is not evidence that every control is active.

### T7. Denial of service and resource exhaustion

**Threat:** oversized text, context, graph, corpus, tensor, recursive workflow, repeated tool calls, or expensive visualization freezes the app or fills storage.

**Current controls:** specimen entry count is bounded; micro-model/data scale is intentionally small; agent/tool experiments are bounded.

**Required/planned controls:** per-input byte/token limits, graph/node caps, model memory estimates, timeouts, cancellation, step/tool budgets, SQLite/disk quotas, worker isolation, backpressure, and recoverable autosave.

### T8. Dependency and release supply chain

**Threat:** compromised package, typosquat, build script, CI token, or release asset changes executable behavior.

**Current controls:** Python and Node lockfiles, pinned critical desktop packages, repository tests, and a checksum-bearing release design.

**Planned/operational controls:** least-privilege CI, reviewed dependency updates, software bill of materials, provenance attestation, reproducible or independently repeated builds, signed tags/artifacts, public checksum verification, and a release manifest tied to the exact revision.

An executable merely present in a local `release/` directory is not evidence of a current public release.

### T9. Secret and privacy leakage

**Threat:** prompts, shell output, traces, databases, screenshots, replay bundles, environment variables, or error messages expose credentials or personal data.

**Current boundary:** offline core paths require no API key.

**Controls:** do not store secrets in source/config/trace; minimize collected data; redact before export; never log authorization headers; keep provider credentials outside the renderer; separate user data from synthetic examples; document retention and deletion; scan release bundles; keep external adapters opt-in.

No replay bundle is safe to publish solely because it is deterministic.

### T10. Receipt or witness forgery

**Threat:** a local component marks U/O as passed, a stale external response is reused, or a receipt is altered after creation.

**Current controls:** U/O remain `UNKNOWN` without explicitly scoped external evidence; internal decisions and renderer output cannot witness themselves.

**Planned controls:** canonical receipt schema, hash chaining, issuer identity, freshness/audience/nonce binding, signature verification, key rotation/revocation, and domain-specific witness validators. Signed receipts are not implemented at this revision.

### T11. Simulation confused with implementation

**Threat:** a learner treats an attractive 3D flow as measured production behavior, a named product's architecture, or hidden reasoning.

**Controls:** visible status labels; textual explanations; Claim Contract; source links; no “best/first” claims; no hidden-chain-of-thought claims; explicit mapping between computed state and geometry; accessibility labels beyond color.

### T12. Misleading prediction or foresight

**Threat:** a scenario is presented as a forecast, uncertainty is hidden, or a consequential decision is automated from model output.

**Controls:** label scenario simulations, expose assumptions and horizon, require dated data and backtesting for forecast claims, retain human/domain review, and never equate fluency with probability or calibration.

### T13. Unsafe interpretation or application of abliteration

**Threat:** the educational visualization is used to claim that safeguards can be safely or completely removed, or to distribute an unevaluated altered checkpoint.

**Current control:** visualization only; no checkpoint mutation or export.

**Required before any future executable experiment:** legal/license review, provenance, isolated environment, capability and misuse evaluation, refusal/helpfulness trade-off analysis, explicit limitations, and controlled distribution decision. “Less refusal” must not be equated with safe, truthful, or unrestricted correctness.

### T14. Scientific source drift and citation laundering

**Threat:** a secondary summary becomes the apparent source for a stronger claim, an upstream repository changes, or a dated observation is presented as current fact.

**Controls:** primary-source register, exact canonical links, as-of dates, neutral `ND` state, link/claim review, and separate official description from local validation.

## 6. Threat-to-status matrix

| Control area | Implemented | Simulated | External | Planned |
|---|---|---|---|---|
| Small local models and bounded data | ✅ | — | — | Continued hardening |
| Deterministic desktop research engine | ✅ | Its subject matter may be simulated | — | Portable bundle |
| Allowlisted educational tools | ✅ | Tool-flow views | Live provider policy | Expanded policy tests |
| APIR I/R checks and U/O unknown boundary | ✅ | Recommendation view | External witnesses | Signed receipts |
| Arbitrary checkpoint sandbox | — | — | Upstream format behavior | ✅ |
| Live MCP/API/A2A adapters | — | Architecture diagrams | Protocol ecosystems | Opt-in adapters |
| Release attestation/SBOM | Partial lock/checksum structure | — | Hosting/signing services | ✅ |
| Accessibility conformance audit | Some semantic UI work | — | WCAG standard | Measured audit |

Legend: ✅ means repository implementation exists within the stated scope; it is not a security certification.

## 7. Abuse cases to test

- A retrieved document asks to read environment variables and call an unapproved tool.
- A model proposes a valid tool name with an unauthorized path or excessive cost.
- A replay bundle contains `../`, absolute paths, huge arrays, duplicate IDs, cycles, or non-finite numbers.
- A checkpoint claims one architecture but contains unexpected tensors or executable serialization.
- A source link resolves to a different owner/repository with a similar name.
- A forged event marks U/O pass with only an HTTP `200`.
- A renderer uses model-generated HTML containing script or navigation.
- A scenario omits its assumptions and is shared as a forecast.
- A user exports a trace containing a bearer token or private document text.
- Animation frame rate changes logical state or ordering.
- A model attempts to raise effort/tool limits from its own output.
- An abliteration lesson is described as a safe removal recipe.

## 8. Out of scope for the current offline core

- custody of production credentials;
- unattended execution on external systems;
- real-money, medical, legal, employment, or other consequential decisions;
- security certification of third-party models, tools, MCP servers, or packages;
- malware analysis of arbitrary model/checkpoint files;
- protection against a fully compromised operating system;
- proof of correctness for proprietary model internals;
- public hosting or multi-tenant isolation.

Adding any of these changes the threat model and requires a new review.

## 9. Security reporting

Do not place secrets, personal data, or exploitable details in a public issue. Follow [SECURITY.md](../SECURITY.md) for the supported reporting route. General documentation corrections may use GitHub Issues.

Related documents: [Architecture](ARCHITECTURE.md), [Claim Contract](CLAIM_CONTRACT.md), [Replay Specification](REPLAY_SPEC.md), and [Decision Lab](ALEFBA_DECISION_LAB.md).
