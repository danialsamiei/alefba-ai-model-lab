# Primary source register

Last reviewed: **2026-08-31**

This register is the evidence index for educational content in this
repository. It prioritizes original papers, official specifications,
first-party documentation, and canonical upstream repositories. A link being
listed here does not mean its code, assets, data, model weights, or trademarks
are incorporated into this repository.

## Evidence and implementation labels

| Label | Meaning |
|---|---|
| **Implemented** | Executable local behavior supported by repository code and proportionate checks |
| **Simulated** | A deterministic or conceptual educational model, not the named external system |
| **External** | A first-party source, product, protocol, model, repository, or optional service outside the bundled project |
| **Planned** | Intended work that must not be described as available |

Source classes used below:

- **Primary research**: the original paper or authors' accompanying code.
- **Official specification**: a standards body's or protocol owner's normative
  document.
- **Official product source**: first-party documentation describing publicly
  supported behavior, not confidential internals.
- **Canonical upstream**: the original maintained repository reviewed here.
- **Project source**: alef.ba or this repository's own public claim.

For every source, the "does not establish" column is as important as the
supported claim.

## 1. alef.ba program

| Topic | Source | Class | Supports | Does not establish |
|---|---|---|---|---|
| Program context | [alef.ba](https://alef.ba/) | Project source | First-party public description of alef.ba and its stated technology/program context | Independent scientific validation, implementation parity, or endorsement of this repository |
| Local laboratory scope | [Repository README](../../README.md) | Project source | Current local commands, artifacts, and claim boundaries recorded in the repository | Public deployment, external-provider validation, or capabilities labelled planned |
| Governance and intent | [GOVERNANCE.md](../../GOVERNANCE.md) | Project source | Decision process, scientific integrity rules, and relationship to the program | Legal authority over third parties or external standards |

The public site should be archived or tied to a dated release before exact
site language is quoted in a paper. A mutable website is a first-party source,
not an immutable research artifact.

## 2. Model learning and engineering lifecycle

### Architecture, tokenization, and pretraining

| Topic | Source | Class | Supports | Does not establish |
|---|---|---|---|---|
| Transformer | [Attention Is All You Need](https://arxiv.org/abs/1706.03762) | Primary research | Attention-based encoder/decoder architecture and training experiments | How every later proprietary Transformer is implemented |
| Subword tokenization | [SentencePiece](https://arxiv.org/abs/1808.06226) | Primary research | Language-independent subword tokenization from raw sentences | The tokenizer or vocabulary of an unnamed product |
| In-context learning | [Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) | Primary research | Scale and few-shot behavior of GPT-3 under the reported setup | Weight updates from an individual prompt or persistent personal memory |
| Scaling laws | [Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) | Primary research | Empirical compute/data/model scaling relationships in the measured regime | Universal optimal scaling for all modalities and architectures |
| Compute-optimal training | [Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556) | Primary research | Chinchilla-style model/data compute trade-offs | A provider's undisclosed training budget |

### Instruction, preference, and parameter-efficient adaptation

| Topic | Source | Class | Supports | Does not establish |
|---|---|---|---|---|
| SFT and RLHF | [Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) | Primary research | Demonstrated supervised and preference-based post-training pipeline | The current private pipeline of ChatGPT or another provider |
| Constitutional AI | [Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) | Primary research | A reported critique/revision and AI-feedback alignment method | That all Claude behavior follows this exact historic implementation |
| Direct preferences | [Direct Preference Optimization](https://arxiv.org/abs/2305.18290) | Primary research | Direct optimization of preferences without the reported RLHF reward-model loop | Safety or quality without appropriate data and evaluation |
| LoRA | [LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) | Primary research | Low-rank trainable adapters over frozen base weights | That adapters are always sufficient or privacy-preserving |
| QLoRA | [QLoRA](https://arxiv.org/abs/2305.14314) | Primary research | Fine-tuning through a quantized frozen model with LoRA adapters | Identical behavior to full-precision full-parameter training |

### Retrieval, tools, mixture of experts, and evaluation

| Topic | Source | Class | Supports | Does not establish |
|---|---|---|---|---|
| RAG | [Retrieval-Augmented Generation](https://arxiv.org/abs/2005.11401) | Primary research | Combining retrieved external memory with generation in the reported design | Guaranteed factuality, source quality, or weight updates |
| Sparse MoE | [Switch Transformers](https://arxiv.org/abs/2101.03961) | Primary research | Sparse expert routing and scaling under the reported experiments | The private routing algorithm of a named commercial model |
| Reasoning and acting | [ReAct](https://arxiv.org/abs/2210.03629) | Primary research | Interleaving generated reasoning traces and actions in reported tasks | Access to a provider's hidden chain-of-thought |
| Self-supervised tool use | [Toolformer](https://arxiv.org/abs/2302.04761) | Primary research | A method for teaching a model when and how to call APIs | Authorization for a tool call or safe execution |
| Broad evaluation | [HELM](https://arxiv.org/abs/2211.09110) | Primary research | Multi-metric transparent model evaluation | A timeless or complete ranking of models |
| Probabilistic forecasts | [Strictly Proper Scoring Rules, Prediction, and Estimation](https://doi.org/10.1198/016214506000001437) | Primary research | Foundations for scoring probabilistic forecasts | Causal validity or real-world accuracy of an LLM-agent narrative |

### User-specific information: mechanisms must remain distinct

| Mechanism | Source | What changes | Persistence boundary |
|---|---|---|---|
| Prompt context / in-context learning | [GPT-3 paper](https://arxiv.org/abs/2005.14165) | Activations and output conditioned on supplied tokens; ordinarily no optimizer update | Current context unless a host stores and resupplies it |
| Retrieval or application memory | [RAG paper](https://arxiv.org/abs/2005.11401) | External records are selected and placed into context | Persists in the host store, not automatically in base-model weights |
| Adapter fine-tuning | [LoRA](https://arxiv.org/abs/2106.09685) | Trained adapter parameters | Persists in the adapter artifact |
| Full or partial weight training | [InstructGPT](https://arxiv.org/abs/2203.02155) | Model parameters change during an explicit training pipeline | Persists in a new checkpoint/version |
| ChatGPT product memory | [OpenAI Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) | First-party description of a product memory feature | Does not reveal model weights, hidden prompts, or a complete training recipe |
| ChatGPT data controls | [OpenAI Data Controls FAQ](https://help.openai.com/en/articles/7730893-data-controls-faq) | First-party description of product data-control settings | Does not generalize to other products or deployments |

No named model, including a product variant called "Sol", should be said to
learn a particular user's information unless a current first-party source
identifies the exact mechanism. Context, saved application memory, retrieval,
fine-tuning, provider improvement programs, and account telemetry are different
systems.

## 3. Model families, explainers, and agent tools

### Language and reasoning models

| System or topic | Source | Class | Safe use in this project |
|---|---|---|---|
| GPT-4 | [GPT-4 Technical Report](https://arxiv.org/abs/2303.08774) | Primary research | Explain only disclosed evaluation and high-level facts; architecture and dataset details are limited |
| Qwen | [Qwen3 canonical repository](https://github.com/QwenLM/Qwen3) and [Qwen3 Technical Report](https://arxiv.org/abs/2505.09388) | Canonical upstream / primary research | Model-family and published training/evaluation concepts, not every hosted Qwen product |
| DeepSeek-V3 | [Official repository](https://github.com/deepseek-ai/DeepSeek-V3) and [technical report](https://arxiv.org/abs/2412.19437) | Canonical upstream / primary research | Published MoE, training, and inference details for the named release |
| DeepSeek-R1 | [Official repository](https://github.com/deepseek-ai/DeepSeek-R1) and [paper](https://arxiv.org/abs/2501.12948) | Canonical upstream / primary research | Published reinforcement-learning and reasoning-model results for the named release |
| Mechanistic inspection | [OpenAI Transformer Debugger](https://github.com/openai/transformer-debugger) | Canonical upstream | Neuron/head/SAE intervention concepts in the supported small models |
| Transformer education | [Transformer Explainer](https://github.com/poloclub/transformer-explainer) and [paper](https://arxiv.org/abs/2408.04619) | Canonical upstream / primary research | Live GPT-2 educational interaction and its evaluated learning design |
| Three-dimensional GPT view | [LLM Visualization](https://github.com/bbycroft/llm-viz) | Canonical upstream | A reference for interactive 3D explanation; not a source for proprietary GPT internals |

### Image, video, audio, and multimodal generation

| Topic | Source | Class | Supports | Does not establish |
|---|---|---|---|---|
| Denoising diffusion | [Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) | Primary research | DDPM formulation and experiments | Every modern image generator's sampler or data |
| Latent diffusion | [High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) | Primary research | Diffusion in a learned latent space and conditioning | The architecture of OpenArt or another proprietary service |
| Interactive Stable Diffusion education | [Diffusion Explainer](https://github.com/poloclub/diffusion-explainer) and [paper](https://arxiv.org/abs/2305.03509) | Canonical upstream / primary research | Evaluated visual explanation using preset prompts | Full live image generation or all diffusion variants |
| Video diffusion | [Video Diffusion Models](https://arxiv.org/abs/2204.03458) | Primary research | A reported extension of diffusion to video | Sora's full proprietary implementation |
| Sora | [Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) | Official product/research source | Publicly disclosed Sora research approach and examples | Complete architecture, training data, weights, or current production stack |
| Audio generation | [AudioLM](https://arxiv.org/abs/2209.03143) | Primary research | Hierarchical token modeling for audio in the reported system | The architecture of every voice or music product |
| OpenArt | [OpenArt](https://openart.ai/) | Official product source | Public product capabilities and terminology | A complete public model architecture or training recipe |

### Coding agents and harnesses

| Tool | Source | Class | Supports | Does not establish |
|---|---|---|---|---|
| Codex CLI | [openai/codex](https://github.com/openai/codex) | Canonical upstream | Public CLI source, sandboxing, approval, configuration, and supported workflows in the reviewed release | Hidden service internals or undisclosed model training |
| Claude Code | [Official Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code/overview) | Official product source | Public commands, permissions, hooks, memory/configuration, and tool behavior | Proprietary model weights, prompts, or full backend architecture |
| Hermes Agent | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) and [official documentation](https://hermes-agent.nousresearch.com/docs/) | Canonical upstream | Public CLI, tools, memory, skills, provider, gateway, and desktop architecture | That all "Hermes" projects are this system or that self-improvement changes base-model weights |
| Devin | [Official Devin documentation](https://docs.devin.ai/) | Official product source | Public Ask/Agent modes, repository/session workflow, and supported product behavior | Complete proprietary planner, prompts, model stack, or training process |
| Visual workflow authoring | [Langflow](https://github.com/langflow-ai/langflow) | Canonical upstream | Visual flows, multi-agent orchestration, API and MCP export | Scientific validation of a generated workflow |
| Agent observability | [Arize Phoenix](https://github.com/Arize-ai/phoenix) | Canonical upstream | OpenTelemetry-based tracing, evaluation, datasets, experiments, and prompt comparison | Deterministic regeneration of external model outputs |

Product behavior can change faster than papers. Product pages should carry a
last-checked date, and the project should prefer versioned repository or
specification links where available.

## 4. MCP, APIs, A2A, AG-UI, and OpenTelemetry

| Topic | Source | Class | Supports | Important boundary |
|---|---|---|---|---|
| MCP architecture | [MCP 2026-07-28 architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture) | Official specification | Stateless host/client/server roles, capability declaration, and host policy responsibility | MCP metadata is not authorization; the host enforces consent and policy |
| MCP tools | [MCP tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) | Official specification | Tool discovery, JSON Schema inputs, tool results, and model-controlled tool semantics | Tool annotations are untrusted and a model request is not user consent |
| MCP authorization | [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) | Official specification | Current authorization requirements and flows | Does not authorize forwarding credentials across trust boundaries |
| MCP release context | [MCP 2026-07-28 release notes](https://blog.modelcontextprotocol.io/posts/2026-07-28/) | Official project source | Rationale for the stateless core and per-request self-description | Not a replacement for normative specification text |
| Agent-to-agent exchange | [A2A 1.0 specification](https://a2a-protocol.org/latest/specification/) | Official specification | Agent Cards, tasks, messages, artifacts, and interoperability boundaries | Does not reveal an agent's private memory or internal reasoning |
| Agent-user events | [AG-UI architecture](https://docs.ag-ui.com/concepts/architecture) and [events](https://docs.ag-ui.com/concepts/events) | Official specification/documentation | Lifecycle, text, tool, state, activity, and reasoning-summary event families | Reasoning summaries are not raw hidden chain-of-thought |
| HTTP semantics | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) | Official specification | Standard HTTP method and response semantics | Application-specific authorization and retry safety |
| OpenAPI | [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html) | Official specification | Machine-readable HTTP API descriptions | Runtime correctness, trust, or business authorization |
| JSON Schema | [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) | Official specification | Validation vocabulary and schema semantics | Semantic truth or safety of validated values |
| OAuth security | [RFC 9700: OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700) | Official specification | Current OAuth threat mitigations and best practices | Permission beyond the granted scope |
| GenAI telemetry | [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai) | Official upstream specification repository | Shared names for GenAI spans, events, and attributes | Standard maturity where marked Development, or permission to record sensitive prompts |

Simulation of a protocol must keep transport, schema validation, authentication,
authorization, user approval, execution, and observability as separate visible
steps. A successful HTTP response is not evidence that the underlying action
was safe, correct, or authorized.

## 5. MiroFish and OASIS

| Topic | Source | Class | Supports | Does not establish |
|---|---|---|---|---|
| MiroFish upstream | [666ghj/MiroFish](https://github.com/666ghj/MiroFish) | Canonical upstream | Graph building, personas, OASIS simulation, temporal memory, ReportAgent, and documented dependencies | Universal forecast accuracy or a strict offline default |
| MiroFish public site | [mirofish.ai](https://mirofish.ai/) | Official product source | Current first-party positioning | Independent validation of "Predict Anything" |
| OASIS engine | [camel-ai/oasis](https://github.com/camel-ai/oasis) | Canonical upstream | Open social-agent simulation framework, action space, and published scale claims | Accuracy of every downstream prediction product |
| OASIS research | [OASIS: Open Agent Social Interaction Simulations with One Million Agents](https://arxiv.org/abs/2411.11581) | Primary research | Reported X/Reddit simulations, scale, recommendation systems, and observed social phenomena | Causal prediction of arbitrary future events |

The educational project should model MiroFish as a scenario-generation
pipeline. Forecasting claims require held-out outcomes, baselines, uncertainty,
calibration, sensitivity analysis, and domain-specific validation. Agent
agreement is not ground truth.

License note: the reviewed MiroFish upstream is AGPL-3.0; OASIS is Apache-2.0.
Architecture-level study does not grant permission to copy incompatible code,
assets, data, or model weights.

## 6. Ablation, refusal directions, and "abliteration"

The term **abliteration** is community terminology, not a broadly standardized
training stage. The primary research below describes activation/weight
intervention and a white-box jailbreak based on a refusal-mediating direction.

| Topic | Source | Class | Supports | Does not establish |
|---|---|---|---|---|
| Refusal direction | [Refusal in Language Models Is Mediated by a Single Direction](https://arxiv.org/abs/2406.11717) | Primary research | A reported low-dimensional refusal mechanism across the studied open models and intervention experiments | That every model has exactly one stable refusal direction |
| Authors' code | [andyrdt/refusal_direction](https://github.com/andyrdt/refusal_direction) | Primary accompanying code | Reproduction pipeline, datasets, candidate directions, interventions, and evaluation artifacts | Safe deployment or generalization beyond tested models |
| Formal publication | [NeurIPS 2024 paper](https://papers.neurips.cc/paper_files/paper/2024/file/f545448535dfde4f9786555403ab7c49-Paper-Conference.pdf) | Primary research | Peer-reviewed version of the reported refusal-direction work | Absence of off-target effects |
| Off-target caution | [Abliteration Is Not a Scalpel](https://arxiv.org/abs/2607.17427) | Primary research | Evidence that refusal removal can affect broader decision disposition across model families | A universal effect size for untested models |
| Interactive causal inspection | [OpenAI Transformer Debugger](https://github.com/openai/transformer-debugger) | Canonical upstream | Related concepts of node ablation and observing downstream effects in supported models | A turnkey safety-removal procedure |

Conceptual educational workflow:

1. run matched harmful and harmless prompt sets and capture residual-stream
   activations by layer;
2. estimate candidate contrast directions and test whether they predict or
   causally influence refusal;
3. select directions using both refusal reduction and capability/coherence
   controls;
4. project a direction out of activations or selected weight matrices;
5. re-evaluate refusal, normal capabilities, calibration, distribution shift,
   and off-target behavior.

The subtraction and projection are not fine-tuning: there is no ordinary
gradient-based optimizer loop. Lower refusal is not proof of improved
reasoning, truthfulness, or knowledge. Because the technique can deliberately
weaken safety behavior, this repository should visualize the mechanism,
measurement, failure modes, and governance controls without distributing
safety-disabled weights or operational bypass packages.

## 7. Citation maintenance rules

When adding a concept:

1. add at least one primary or official source when available;
2. record what the source supports and what remains unknown;
3. attach implemented, simulated, external, or planned status;
4. prefer a versioned specification URL over an unversioned landing page;
5. recheck mutable product documentation before each relevant release;
6. preserve older sources when they explain a historical implementation;
7. do not replace an upstream license or citation with a secondary summary.

Corrections should update the source, review date, affected explanation, tests,
and comparison row together.
