# Contributing

Thank you for helping build an open, inspectable laboratory for learning,
comparing, and designing AI systems. Contributions are welcome in English or
Persian. Code identifiers and machine-readable schemas should remain in
English; Persian interfaces and documents should be right-to-left.

## Before you start

Open a GitHub Issue before substantial work. Describe the learning objective,
the affected subsystem, the evidence you expect to add, and whether the result
will be implemented, simulated, external, or planned. A maintainer may suggest
a smaller change or an RFC before implementation.

Good contribution areas include:

- small, readable model or algorithm implementations;
- deterministic simulations and replay fixtures;
- visual explanations, diagrams, and accessible interactions;
- tests, benchmarks, security controls, and provenance tooling;
- primary-source research notes and corrections;
- Persian and English documentation or other reviewed translations.

## Claim and status discipline

Every user-visible capability must use one of these labels:

- **Implemented**: executable local code with proportionate tests or artifacts.
- **Simulated**: a deterministic educational model of a process; it does not
  call or reproduce the named proprietary system.
- **External**: a referenced product, protocol, model, service, or optional
  adapter that is not bundled as a local capability.
- **Planned**: a roadmap item with no completion claim.

Do not describe a simulation as a real model run, a public probe as internal
architecture evidence, a trace as hidden chain-of-thought, or a scenario as a
validated forecast. Claims about proprietary systems must distinguish public
first-party facts, third-party observations, and explicit inference.

## Development checks

The repository currently contains more than one educational laboratory.
Run the checks for every area you change.

Root digit laboratory:

~~~powershell
uv sync --frozen
uv run pytest
uv run ruff check .
uv run mypy src
~~~

Micro reasoning laboratory:

~~~powershell
Set-Location reasoning-lab
uv sync --frozen
uv run pytest
uv run ruff check .
uv run mypy src
~~~

Windows desktop laboratory:

~~~powershell
Set-Location reasoning-lab/desktop
npm ci
npm run check
~~~

If a documented command is unavailable on your platform, report the exact
command and result in the pull request rather than marking it as passed.

## Research and source requirements

- Prefer original papers, official specifications, official documentation, and
  canonical upstream repositories.
- Record the source URL, source class, and the date checked.
- Explain what a source supports and what it does not establish.
- Never infer unpublished weights, datasets, system prompts, hidden reasoning,
  training schedules, or personal-memory behavior from product output alone.
- If a source and implementation disagree, preserve the evidence and open an
  issue instead of silently changing the claim.

See docs/research/SOURCES.md for the source register and
docs/COMPARISON.md for the comparison method.

## Determinism and data provenance

New deterministic labs should expose a seed, configuration, ordered event
stream, terminal state, and stable replay digest. Do not use wall-clock time,
ambient randomness, filesystem order, or network responses as hidden inputs.

Datasets must have a documented origin and compatible license. Synthetic data
must be labelled synthetic. Do not commit personal data, credentials, private
documents, proprietary model files, or copyrighted corpora without explicit
redistribution rights.

## Visual and accessibility requirements

New visual interactions should:

- remain understandable without color alone;
- support keyboard operation and visible focus;
- respect reduced-motion preferences;
- provide a text or table alternative to important 3D relationships;
- work at the documented viewport sizes;
- preserve Persian RTL and English LTR direction correctly;
- avoid presenting animation as evidence of real computation.

Automated accessibility checks are necessary but do not replace keyboard and
screen-reader review.

## Security and external tools

External model, API, MCP, browser, filesystem, and shell integrations must be
off by default, explicitly authorized, narrowly scoped, and observable. Never
commit secrets. Follow SECURITY.md for vulnerability reports.

Ablation and refusal-direction research may be documented at a conceptual and
evaluation level. Do not contribute altered safety-disabled weights, harmful
datasets without controls, or operational material intended to bypass a
deployed system's safeguards.

## Pull request checklist

- [ ] The issue or RFC is linked.
- [ ] Status labels are accurate.
- [ ] Tests and documented verification commands were run.
- [ ] Sources are primary where available and dated.
- [ ] New data and assets have provenance and compatible licenses.
- [ ] Accessibility and RTL/LTR behavior were considered.
- [ ] No secret, personal data, hidden reasoning, or unsupported product claim
      is included.
- [ ] Documentation and THIRD_PARTY_NOTICES are updated when applicable.

Contributors remain responsible for all submitted material, including material
produced with AI assistance. By contributing, you agree that your contribution
is licensed under the repository's MIT License unless a file explicitly states
another compatible license.
