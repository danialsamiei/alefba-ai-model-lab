# Project Governance

## Purpose

This project is part of the international alef.ba research program. Its public
purpose is to make AI systems inspectable at educational scale, support
evidence-based architecture decisions, and turn those methods into practical
tools for the wider alef.ba program.

Governance covers this repository. It does not claim authority over external
products, providers, protocols, research groups, or the public alef.ba website.

## Roles

### Maintainer

Danial Samiei is the founding maintainer. Maintainers:

- set release scope and repository direction;
- review security, licensing, and scientific-claim boundaries;
- merge or reject changes with a recorded reason;
- appoint or remove additional maintainers and reviewers;
- coordinate releases and incident response.

### Reviewer

Reviewers are contributors trusted in a defined area such as model
engineering, visualization, security, accessibility, Persian language, or
research methodology. Review authority is limited to the named area and does
not imply merge access.

### Contributor

Anyone who participates through issues, discussions, documentation, testing,
design, research, or code is a contributor and must follow the Code of
Conduct.

## Decision process

Routine changes use transparent issue and pull-request review. When reviewers
agree and no material objection remains, a maintainer may merge by lazy
consensus.

An RFC is required for:

- a new executable model family or external connector;
- a change to the status or scientific claim taxonomy;
- network, filesystem, browser, shell, MCP, API, or credential authority;
- dataset or model redistribution;
- release signing, telemetry, or update mechanisms;
- licensing, governance, privacy, or security-policy changes;
- a breaking public schema or deterministic replay contract.

An RFC should state the problem, alternatives, evidence, threat model, rollout,
acceptance tests, and rollback. The maintainer records the final decision and
the important objections. Urgent security containment may precede a public RFC;
the rationale should be documented after disclosure is safe.

## Scientific integrity

Every capability is classified as implemented, simulated, external, or
planned. Marketing language cannot override this classification.

Primary sources are preferred. Reproduced measurements must retain seed,
configuration, dataset identity, environment, and relevant artifacts.
Negative and null results are publishable results and must not be hidden.
Proprietary architecture, training data, system prompts, and hidden reasoning
must not be invented or reverse-engineered into statements of fact.

Forecasting and multi-agent scenario generation must report uncertainty and
validation boundaries. A plausible narrative is not evidence of predictive or
causal accuracy.

## Releases

A release should contain:

- a scoped changelog and accurate status labels;
- passing tests proportionate to its risk;
- license and third-party notices;
- artifact hashes and reproducible build information where practical;
- known limitations and unsigned/unverified status where applicable.

Publication, packaging, deployment, and real-provider validation are separate
gates. Passing one gate does not imply the others.

## Conflicts of interest

Maintainers and reviewers should disclose financial, employment, research, or
personal relationships that could reasonably affect a decision. Another
reviewer should decide the affected change when practical.

## Conduct and security

CODE_OF_CONDUCT.md applies to all project spaces. Security reports follow
SECURITY.md and may be handled privately. Safety and privacy concerns can block
a release even when functional tests pass.

## Amendments and succession

Governance changes use an RFC and a public pull request. If the founding
maintainer becomes unavailable, active maintainers may appoint a successor by
documented consensus. If no active maintainer remains, contributors should
preserve the repository and its provenance while establishing new stewardship;
they must not imply endorsement by Danial Samiei or alef.ba without explicit
authorization.
