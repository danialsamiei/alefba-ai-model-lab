# Claim Contract

Status: **Normative**  
Revision date: **2026-08-31**

This contract governs claims in the UI, README files, documentation, screenshots, demos, issues, and release notes. Its purpose is to let a reader distinguish what this repository executes from what it illustrates, cites, or plans.

## 1. Required capability labels

Every material capability must use one of four states:

| State | Required basis | What may be said | What must not be implied |
|---|---|---|---|
| **Implemented** | Repository code plus a locally inspectable behavior; tests or repeatable evidence where appropriate | “The lab executes…”, with scope and limits | Production readiness, publication, parity, or external outcome without separate evidence |
| **Simulated** | Deterministic or explicitly bounded educational model | “The lab simulates/illustrates…” | That the named model, vendor, or production system executed |
| **External** | Current primary source, official documentation, or upstream repository | “The official source describes…” | That the capability is installed, executed, verified locally, or privately known |
| **Planned** | Roadmap item or design contract without present implementation | “Planned”, “proposed”, or “target” | “Available”, “supported”, or “ready” |

These labels are mutually exclusive for one precisely scoped claim. A page may contain several capabilities with different states.

## 2. Evidence classes

Capability state and verification evidence answer different questions. Use one or more evidence classes:

| Evidence class | Definition | Supports |
|---|---|---|
| `LOCAL_STRUCTURAL` | Schema checks, static invariants, deterministic object shape, provenance links | Integrity and representation structure |
| `LOCAL_FUNCTIONAL` | A repeatable local command, test, trace, or model run | Bounded implemented behavior |
| `REPRODUCIBLE_BENCHMARK` | Versioned data/configuration, code revision, hardware context, metrics, and repeat procedure | Comparative measurements within the stated setup |
| `EXTERNAL_WITNESS` | Scope-bound evidence emitted by the target or outcome domain | Uptake or real-world outcome, within witness scope |
| `OFFICIAL_SOURCE` | Primary paper, official standard/docs, or canonical upstream repository | Description of an external design or reported result |
| `UNKNOWN` | Evidence is absent, stale, ambiguous, or outside scope | An explicit unresolved state only |

Evidence must be close enough to the claim that a reader can tell which words it supports. A link to a general homepage is not evidence for an unrelated architectural detail.

## 3. Verification values

Use three values where a property is evaluated:

- `PASS`: the required evidence exists and satisfies the scoped criterion;
- `FAIL`: evidence demonstrates that the criterion is not satisfied;
- `UNKNOWN`: the required evidence is missing, inapplicable, stale, or not strong enough.

`UNKNOWN` is neither `PASS` nor `FAIL`. Absence of documentation is not proof of absence. In comparison tables, `ND` means “not documented in the reviewed primary sources.”

## 4. Claim grammar

A defensible claim contains:

~~~text
[status] + [subject] + [bounded capability] + [environment/version]
         + [evidence class] + [known limitation] + [date when time-sensitive]
~~~

Example:

> **Implemented:** the local Digit LM trains a decoder-only Transformer over the vocabulary `0…9` under Python 3.11; the claim is supported by local functional tests and does not imply production-scale language capability.

## 5. Special claim rules

### 5.1 Named products and proprietary systems

- Describe ChatGPT, Sora, Codex, Claude Code, Qwen, DeepSeek, OpenArt, Devin, Hermes, or any other named system only from a primary paper, official documentation, model card, or canonical upstream repository.
- Distinguish a product, a model family, a checkpoint, a CLI/harness, and an API. They are not interchangeable.
- Do not infer private training data, hidden routing, system prompts, safety policies, or deployment topology from observed product output.
- Use “publicly documented” where the evidence describes only a published surface.
- Trademarks remain with their owners; mention does not imply endorsement or affiliation.

### 5.2 Hidden reasoning and “deep think”

- Do not display a generated narrative as a model's hidden chain-of-thought.
- An educational scratchpad is labeled `Simulated` unless the repository itself generated and recorded it as a bounded local algorithm.
- Test-time compute, search, self-consistency, verifier loops, and effort settings must be described as distinct mechanisms when the source supports that distinction.
- A longer response is not evidence of deeper or better reasoning.

### 5.3 Attention and interpretability

- Attention weights may be shown as model state when truly computed.
- A visual attention map is not automatically a causal explanation.
- Interpretability claims require a stated method, model/checkpoint, layer/head, input, and limitation.

### 5.4 Learning, fine-tuning, and user information

- Separate pretraining, supervised fine-tuning, preference optimization, inference-time context, retrieval, tool memory, product personalization, and post-deployment training.
- Do not claim that a model “learned the user” merely because conversation context or stored product memory affected a response.
- User-specific persistence requires an explicit data lifecycle and privacy statement.
- Local micro-model training demonstrates an algorithm at small scale; it does not reveal a vendor's private training pipeline.

### 5.5 Prediction, trends, scenarios, and foresight

- A deterministic scenario is labeled `Simulated`, with assumptions visible.
- Forecasts need a dated data window, method, horizon, uncertainty, and backtest or other appropriate validation.
- A scenario is not a probability. A trend is not causality. Model fluency is not calibration.
- Consequential forecasts require domain review and must not be presented as automated decisions.

### 5.6 RAG, tools, agents, harnesses, and orchestration

- “RAG” requires a retrieval step; context manually pasted into a prompt is not by itself retrieval.
- Cite retrieval source, rank/score behavior, and failure modes. Retrieved content remains untrusted input.
- “Agent” claims identify the loop, state, tools, stopping conditions, budget, approvals, and authority boundary.
- “Autonomous” must specify scope and human control. It must not imply unlimited authority.
- A harness or orchestrator coordinates execution; it does not prove the underlying model's capability.

### 5.7 MCP, API, A2A, and other protocols

- Protocol support describes transport or schema compatibility only within the tested version.
- **Transport ≠ authority.** Connectivity does not grant identity, policy, consent, or execution rights.
- A successful response code or tool acceptance is not proof of uptake (`U`) or outcome (`O`).
- External execution requires separately enforced authentication, authorization, least privilege, and result validation.

### 5.8 alef.ba and APIR

The defensible current claim is bounded:

> alef.ba is explored here as a model-independent semantic context compiler/proxy that maps source-bearing commitments into a typed, source-grounded APIR, selects under a budget and target profile, renders an artifact, and emits a verification receipt.

Do not claim:

- a universal new AI language;
- lossless representation of arbitrary meaning;
- universal semantic equivalence across models;
- a generic runtime, gateway, memory database, or authority service;
- model uptake or real-world outcome without the corresponding external witness;
- published benchmark superiority without a reproducible benchmark.

### 5.9 Abliteration

- The current lab explains abliteration as an externally documented technique and visualizes a conceptual intervention.
- It does not mutate, export, or distribute an altered checkpoint.
- Do not describe a change in refusal behavior as removal of all safety, truthfulness, policy, or risk controls.
- Any future executable experiment requires license review, safety evaluation, clear checkpoint provenance, and misuse controls.

### 5.10 Multimodal and generative media

- A diffusion timeline, denoising field, codec diagram, or video/audio pipeline is `Simulated` unless a real local model generated the media.
- A screenshot of a public product is not proof of its internal architecture.
- Media provenance, consent, copyright, and synthetic-content labeling are separate from model architecture.

## 6. Release and packaging claims

These terms are separate gates:

| Term | Minimum evidence |
|---|---|
| Built locally | Successful local build output for the stated revision and environment |
| Tested locally | Recorded test command and result for the stated revision |
| Packaged | Installer/portable artifact exists with expected metadata |
| Published | Artifact is present on the declared public release channel |
| Verified download | Downloaded public artifact matches a published checksum |
| Production-ready | Explicit operational, security, support, rollback, and acceptance evidence |

Do not call an older executable a current release merely because it remains in a local directory. A green source CI run does not verify a public Windows binary unless the workflow builds and attests that exact artifact.

## 7. Source freshness

- Every comparison matrix and research snapshot carries an as-of date.
- Prefer primary sources: papers, specifications, official documentation, model cards, and canonical repositories.
- Record repository owner/name exactly, especially for similarly named projects.
- If a capability may have changed and cannot be refreshed, mark the claim dated or `UNKNOWN`.
- Secondary explainers may help navigation but cannot be the sole basis for a technical architecture claim.

## 8. UI requirements

Each interactive explanation should expose, directly or through an information panel:

1. capability state (`Implemented`, `Simulated`, `External`, `Planned`);
2. a short Persian explanation where the Persian UI presents the concept;
3. the input, transformation, and output;
4. important parameters and units;
5. evidence class and source link;
6. known limitation or unknown;
7. a link to the relevant detailed documentation;
8. replay identity for deterministic simulations when available.

Color alone must not communicate status. Icons require text labels or accessible names.

## 9. Good and unacceptable wording

| Avoid | Use instead |
|---|---|
| “This is how ChatGPT thinks.” | “This deterministic teaching view illustrates one public next-token/reasoning pattern; it is not a trace of ChatGPT.” |
| “The best AI architecture visualizer.” | “The comparison matrix evaluates documented capabilities against a dated neutral rubric.” |
| “MCP securely authorizes tools.” | “MCP carries context/tool messages; authorization is enforced by a separate identity and policy boundary.” |
| “APIR guarantees the model understood the prompt.” | “Local checks establish I/R; U remains unknown without a target-side witness.” |
| “The forecast says X will happen.” | “Under the stated assumptions, the simulated scenario produces X; no probability or external outcome is established.” |
| “The Windows app is released.” | “A Windows artifact was built locally” or “release URL and checksum were verified,” according to evidence. |
| “Abliteration removes censorship safely.” | “The visualization explains a documented direction-removal intervention and its unresolved safety trade-offs.” |

## 10. Review checklist

Before merging a public claim, verify:

- [ ] subject and scope are precise;
- [ ] capability status is present;
- [ ] evidence class is appropriate;
- [ ] source is primary and directly supports the wording;
- [ ] date/version is present when behavior can change;
- [ ] simulation is not phrased as production execution;
- [ ] `UNKNOWN` has not been converted to success;
- [ ] U/O claims have external witnesses;
- [ ] transport has not been equated with authority;
- [ ] release wording matches actual release evidence;
- [ ] limitation and non-goal are visible;
- [ ] Persian and English descriptions do not materially diverge.

See [Architecture](ARCHITECTURE.md), [Decision Lab](ALEFBA_DECISION_LAB.md), and the [source register](research/SOURCES.md).
