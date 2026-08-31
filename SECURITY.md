# Security Policy

## Supported versions

Security fixes are applied to the latest release and the default development
branch. Older installers, generated artifacts, experimental branches, and
third-party forks may not receive fixes.

## Reporting a vulnerability

Prefer GitHub's private vulnerability reporting or a private draft Security
Advisory for this repository when that feature is available.

If private reporting is unavailable, open a GitHub Issue with a short title
that begins with "Security report". Include only the affected component,
version, impact category, and a safe way for a maintainer to reproduce the
problem. Do not publish exploit code, credentials, personal data, private
documents, harmful prompt corpora, or details that would put users at immediate
risk. Ask the maintainers to establish a private follow-up channel for the
sensitive details.

We aim to acknowledge a report within five business days and provide an
initial triage within ten business days. These are response targets, not a
service-level agreement. Please allow a reasonable coordinated-disclosure
period before public discussion.

## In-scope security areas

- desktop application isolation, navigation, and content security policy;
- model, checkpoint, dataset, archive, and document parsing;
- path traversal, unsafe deserialization, decompression, and resource
  exhaustion;
- prompt injection and untrusted retrieved content crossing a tool boundary;
- API, MCP, A2A, browser, filesystem, shell, and plugin authorization;
- secret storage, log redaction, provenance, and artifact integrity;
- dependency and build-pipeline compromise;
- approval bypass, confused-deputy behavior, or privilege escalation.

## Operating boundary

Educational simulations are expected to run without external authority. Any
real adapter must be opt-in, use least privilege, display the intended action,
and preserve an audit event. A model's request to use a tool is never itself
authorization.

Treat all model files, prompts, retrieved documents, MCP metadata, tool
annotations, web content, and generated code as untrusted input. Never store
API keys in source files, fixtures, screenshots, issue bodies, replay bundles,
or generated reports.

## Safety research

Reports about model manipulation, refusal-direction ablation, and
"abliteration" are welcome when they improve measurement, containment, or
understanding. Do not attach altered safety-disabled weights, operational
jailbreak packages, or sensitive harmful datasets. A vulnerability report
should demonstrate the minimum safe evidence needed to establish impact.

## Out of scope

- unsupported third-party forks or externally hosted services;
- expected stochastic variation in external model output;
- disagreements with a documented educational simplification that do not
  create a security or privacy impact;
- social engineering, denial of service against public infrastructure, or
  testing on systems without authorization.

This policy does not authorize testing against alef.ba, a model provider, an
MCP server, an API, or any other third party.
