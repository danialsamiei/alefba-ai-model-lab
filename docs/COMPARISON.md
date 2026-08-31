# Evidence-based comparison of adjacent projects

Evidence review date: **2026-08-31**

This document compares adjacent open-source educational, visualization,
inspection, agent-building, observability, and simulation projects. It does not
declare this repository or any other project "best". Scope, research purpose,
and product maturity differ too much for an honest single ranking.

## Legend and method

- ✅: the reviewed official source explicitly supports the capability.
- ◐: partial, adjacent, conditional, or dependent on external services.
- ND: no supporting statement was found in the reviewed official sources. ND
  does not prove that a capability is absent.
- N/A: the criterion is not meaningful for that project's stated purpose.

Strict offline means that, after dependencies and declared assets are
installed, the primary demonstration still operates with network access
blocked. Deterministic replay means that the same versioned input, seed, and
configuration reproduce the same ordered events and terminal digest. Reopening
a recorded trace or calling a stochastic provider again does not satisfy that
definition.

Popularity, star count, company size, and marketing language are excluded from
the capability assessment.

## Comparison matrix

| Project | Primary scope | Interactivity | Strict offline | 3D | Deterministic replay | Scientific-source evidence | Windows package | Published accessibility evidence |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| [Transformer Explainer](https://github.com/poloclub/transformer-explainer) | GPT-2 embedding, attention, MLP, logits, and sampling | ✅ | ◐ | ND | ND | ✅ | ND | ND |
| [LLM Visualization](https://github.com/bbycroft/llm-viz) | Working tiny GPT-style inference and network structure | ✅ | ◐ | ✅ | ND | ND | ND | ND |
| [Diffusion Explainer](https://github.com/poloclub/diffusion-explainer) | Stable Diffusion text-to-image process with preset prompts | ✅ | ◐ | ND | ND | ✅ | ND | ND |
| [TensorFlow Playground](https://github.com/tensorflow/playground) | Small dense neural-network data, training, loss, and hyperparameters | ✅ | ✅ | ND | ND | ◐ | ND | ND |
| [Netron](https://github.com/lutzroeder/netron) | Graph inspection for real model files across many formats | ◐ | ✅ | ND | N/A | ND | ✅ | ND |
| [OpenAI Transformer Debugger](https://github.com/openai/transformer-debugger) | Neuron, attention-head, sparse-autoencoder, attribution, and intervention analysis | ✅ | ◐ | ND | ND | ◐ | ND | ND |
| [MiroFish](https://github.com/666ghj/MiroFish) | GraphRAG, personas, social-agent simulation, reports, and scenario interaction | ✅ | ◐ | ND | ND | ◐ | ND | ND |
| [OASIS](https://github.com/camel-ai/oasis) | Large-scale LLM-agent social simulation | ◐ | ◐ | ND | ND | ✅ | ND | ND |
| [Langflow](https://github.com/langflow-ai/langflow) | Visual agent/workflow authoring, execution, APIs, and MCP servers | ✅ | ◐ | ND | ND | ND | ✅ | ◐ |
| [Arize Phoenix](https://github.com/Arize-ai/phoenix) | Tracing, evaluation, datasets, experiments, and prompt comparison | ✅ | ◐ | ND | ◐ | ◐ | ND | ND |

## Evidence notes

### Transformer Explainer

The [official live application](https://poloclub.github.io/transformer-explainer/)
runs GPT-2 Small in the browser and exposes input text, attention, temperature,
top-k, and top-p. Its
[paper](https://arxiv.org/abs/2408.04619) describes an interactive learning
tool, and the upstream README identifies a CHI 2026 publication.

The model runs client-side, but strict air-gap operation is not the default
distribution contract: the
[application source](https://github.com/poloclub/transformer-explainer/blob/main/src/routes/%2Bpage.svelte)
loads ONNX Runtime WebAssembly from jsDelivr and initializes a tokenizer
through the Transformers.js model interface. This is why offline is marked
partial rather than absent.

### LLM Visualization

The [upstream README](https://github.com/bbycroft/llm-viz#readme) describes a
three-dimensional interactive GPT-style network running a small inference
example derived from minGPT. It documents local development, but not a
versioned air-gap package, deterministic event-log contract, Windows
installer, accessibility conformance, or peer-reviewed evaluation.

### Diffusion Explainer

The [upstream project](https://github.com/poloclub/diffusion-explainer) is an
interactive explanation of Stable Diffusion using preset prompts. The
[research paper](https://arxiv.org/abs/2305.03509) reports a 56-participant
study and was presented at IEEE VIS 2024. Its local static-server instructions
are straightforward, but the reviewed
[HTML entry point](https://github.com/poloclub/diffusion-explainer/blob/main/index.html)
references D3, fonts, and icons from external CDNs; strict offline is therefore
partial until those assets are vendored.

### TensorFlow Playground

The [live playground](https://playground.tensorflow.org/) lets a learner edit
data, features, network shape, learning rate, activation, regularization, and
noise while observing training and test loss. The
[repository](https://github.com/tensorflow/playground) documents a local build.
Its play, pause, and step controls are valuable interactivity, but they are not
evidence of a versioned deterministic event replay.

### Netron

The [official repository](https://github.com/lutzroeder/netron) documents
support for ONNX, TensorFlow Lite, PyTorch, ExecuTorch, TensorFlow, Core ML,
OpenVINO, Keras, Safetensors, NumPy, and other experimental formats. It offers
both a [browser application](https://netron.app/) and an official Windows
installer. Netron is a strong structural viewer, not a claim to simulate
training, reasoning, or an agent lifecycle.

### OpenAI Transformer Debugger

The [official repository](https://github.com/openai/transformer-debugger)
supports intervention in a forward pass and exploration of neurons, attention
heads, sparse-autoencoder latents, and circuits in small language models. The
activation server also reads public Azure-hosted datasets, so strict offline
use is conditional. The repository links primary interpretability work, but
does not present the same kind of educational user study as the two Polo Club
explainers.

### MiroFish and OASIS

The exact project name is **MiroFish**. The canonical upstream reviewed here is
[666ghj/MiroFish](https://github.com/666ghj/MiroFish); the similarly named
GitHub organization repository is a fork. The upstream flow is:

1. seed-document ingestion and GraphRAG construction;
2. entity extraction, persona generation, and environment setup;
3. OASIS-based social simulation with temporal memory;
4. ReportAgent analysis and interaction with the simulated world.

The default quick start requires an LLM API and Zep Cloud credentials. Its
"Predict Anything" wording is a product vision; the reviewed README does not
provide a general forecasting-calibration or backtesting benchmark. It should
therefore be compared as a scenario and swarm-simulation system, not treated
as proof of universal predictive accuracy.

MiroFish credits [OASIS](https://github.com/camel-ai/oasis) as its simulation
engine. OASIS documents up to one million simulated users, 23 action types,
recommendation systems, and social-phenomena experiments. Its
[research paper](https://arxiv.org/abs/2411.11581) supports the OASIS claims,
not every downstream MiroFish product claim.

### Langflow

The [official repository](https://github.com/langflow-ai/langflow) documents a
visual builder, playground, multi-agent orchestration, retrieval, API export,
MCP-server export, and a
[Windows desktop distribution](https://www.langflow.org/desktop). Local
authoring does not make every model-backed flow offline. The source includes
[component-level jest-axe tests](https://github.com/langflow-ai/langflow/blob/main/src/frontend/src/utils/a11y-test.ts)
and page-scanning tools; this is useful accessibility evidence but not a
published claim of complete WCAG conformance.

### Phoenix

[Phoenix](https://github.com/Arize-ai/phoenix) is an open-source observability
and evaluation platform with OpenTelemetry-based tracing, datasets,
experiments, prompt comparison, and replay of traced model calls. That replay
helps investigation, but it does not guarantee that a stochastic provider or
agent will regenerate an identical event sequence.

## This repository's status boundary

This section prevents planned breadth from being reported as current breadth.

| Status | Evidence boundary on 2026-08-31 |
|---|---|
| **Implemented** | The root ten-token model laboratory; the reasoning-lab executable models, retrieval, and allowlisted tools; the packaged Windows educational application and its local documentation |
| **Simulated** | Agent harness, context engineering, orchestration, approvals, failures, architecture ecosystems, media-model flows, and CPU-capacity projections shown as deterministic or conceptual educational models |
| **External** | alef.ba, named commercial products, MiroFish/OASIS, model providers, protocols, external APIs, MCP servers, model weights, and datasets unless expressly bundled |
| **Planned** | Optional real connectors, broader model-family modules, the scenario workbench, architecture-decision lab, public benchmark suite, signed releases, and published accessibility evidence |

The repository must not claim parity with a named proprietary product merely
because it visualizes a similar public pattern.

## Unoccupied combination

The reviewed projects specialize in different layers:

- scientific single-family explainers;
- real-model graph inspection;
- agent and workflow authoring;
- post-run observability;
- social and scenario simulation.

No reviewed source establishes one project that combines all of the following:
multi-family progressive education, 3D plus text alternatives, deterministic
event replay, architecture decision support, real-trace adapters, a strict
offline Windows package, bilingual RTL/LTR delivery, per-concept primary
citations, and published accessibility evidence.

That is an opportunity, not a completed superiority claim.

## Neutral benchmark protocol

Any future comparison should publish raw results, weights, and environment
details rather than a self-awarded total score.

| Dimension | Reproducible measure |
|---|---|
| Breadth | Architecture families multiplied by lifecycle stages with an actually interactive module |
| Interactivity | Proportion of learning steps where a user changes an input and observes a causally connected state change |
| Offline | Dynamic network-request count while the documented primary lesson runs behind a deny-all network policy |
| 3D efficiency | Median and 95th-percentile frame time on a named integrated GPU, plus a usable 2D fallback |
| Replay | Identical event-log and terminal-state digest across repeated runs with the same version, seed, input, and config |
| Scientific grounding | Percentage of major concept nodes with a primary source and last-reviewed date |
| Windows delivery | Installer size, cold-start time, idle and peak memory, signature status, and checksum verification |
| Accessibility | Serious/critical automated findings, keyboard task completion, contrast, screen-reader semantics, reduced motion, and RTL/LTR checks |
| Runtime efficiency | Time to interactive, peak memory, event throughput, and maximum trace length without UI degradation |
| Claim integrity | Percentage of public capability claims carrying an accurate implemented, simulated, external, or planned status |

## License boundary

MiroFish uses AGPL-3.0; OASIS uses Apache-2.0. Transformer Explainer,
Diffusion Explainer, LLM Visualization, Netron, and Transformer Debugger use
permissive licenses in their reviewed upstream repositories. License
compatibility, model licenses, dataset terms, and asset attribution must still
be checked before reuse. Linking to or learning from a project is not the same
as permission to copy all of its code, assets, data, or model weights.
