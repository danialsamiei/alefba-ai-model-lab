import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  RESEARCH_SIMULATION_CAPABILITIES,
  compileAlefbaSpecimen,
  simulateAbliteration,
  simulateApplicationPipeline,
  simulateLearningLifecycle,
  simulateProtocolFlow,
} from "../src/researchSimulation.js";

function assertLogicalEventStream(result, terminalType) {
  assert.ok(result.runId.startsWith("run-"));
  assert.ok(result.traceId.startsWith("trace-"));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.events));
  assert.deepEqual(result.events.map(({ seq }) => seq), Array.from({ length: result.events.length }, (_, index) => index + 1));
  assert.deepEqual(result.events.map(({ logicalTick }) => logicalTick), Array.from({ length: result.events.length }, (_, index) => (index + 1) * 100));
  assert.equal(result.events[0].parentSpanId, null);
  assert.ok(result.events.slice(1).every(({ parentSpanId }) => parentSpanId === "span-001"));
  assert.equal(result.events.at(-1).type, terminalType);
  assert.equal(result.events.filter(({ type }) => type === terminalType).length, 1);
}

test("research engines expose a bounded capability registry", () => {
  assert.deepEqual(RESEARCH_SIMULATION_CAPABILITIES.applications, ["forecast", "monitor", "trend", "foresight"]);
  assert.deepEqual(RESEARCH_SIMULATION_CAPABILITIES.protocols, ["mcp", "api"]);
  assert.ok(RESEARCH_SIMULATION_CAPABILITIES.modalities.includes("video"));
  assert.ok(Object.isFrozen(RESEARCH_SIMULATION_CAPABILITIES));
});

test("learning lifecycle is deterministic and labels weight and persistence behavior at every stage", () => {
  const config = {
    modality: "code",
    customization: "adapter",
    continuedTraining: true,
    preferenceTraining: true,
    distillation: true,
    durableMemory: true,
  };
  const before = structuredClone(config);
  const first = simulateLearningLifecycle(config);
  const second = simulateLearningLifecycle(config);

  assert.deepEqual(first, second);
  assert.deepEqual(config, before, "the caller's config must not be mutated");
  assert.equal(first.format, "learning-lifecycle-v1");
  assert.equal(first.conceptualOnly, true);
  assert.equal(first.representation, "code tokenizer + FIM markers");
  assert.ok(first.stages.length >= 12);
  for (const stage of first.stages) {
    assert.ok(["yes", "no", "conditional"].includes(stage.weightsChange), `${stage.id} lacks a weight-change contract`);
    assert.equal(typeof stage.persistenceScope, "string");
    assert.ok(stage.persistenceScope.length > 0);
    assert.equal(typeof stage.applies, "boolean");
  }
  const context = first.stages.find(({ id }) => id === "inference-context");
  const retrieval = first.stages.find(({ id }) => id === "retrieval");
  const memory = first.stages.find(({ id }) => id === "durable-memory");
  const customization = first.stages.find(({ id }) => id === "explicit-customization");
  assert.deepEqual([context.weightsChange, retrieval.weightsChange, memory.weightsChange], ["no", "no", "no"]);
  assert.equal(memory.persistenceScope, "user");
  assert.equal(customization.weightsChange, "yes");
  assert.equal(customization.foundationWeightsChange, "no");
  assert.equal(first.summary.proprietaryInternals, "UNKNOWN unless supported by a public primary source");
  assertLogicalEventStream(first, "LIFECYCLE_COMPLETED");
});

test("learning lifecycle separates fine-tuning from context and rejects unknown options", () => {
  const fineTune = simulateLearningLifecycle({ modality: "image", customization: "fine-tune" });
  const customStage = fineTune.stages.find(({ id }) => id === "explicit-customization");
  assert.equal(customStage.foundationWeightsChange, "yes");
  assert.equal(customStage.persistenceScope, "model-version");
  assert.equal(fineTune.personalizationPaths.find(({ id }) => id === "request").weightsChange, "no");
  assert.equal(fineTune.personalizationPaths.find(({ id }) => id === "fine-tune").weightsChange, "yes");
  assert.throws(() => simulateLearningLifecycle({ modality: "telepathy" }), /modality must be one of/);
  assert.throws(() => simulateLearningLifecycle({ customization: "silent-online-learning" }), /customization must be one of/);
});

test("forecast pipeline uses a temporal holdout, baseline and explicit uncertainty", () => {
  const config = { application: "forecast", series: [10, 11, 12, 13, 14, 20], holdout: 2, horizon: 3 };
  const result = simulateApplicationPipeline(config);
  assert.deepEqual(result, simulateApplicationPipeline(config));
  assert.deepEqual(result.result.train, [10, 11, 12, 13]);
  assert.deepEqual(result.result.test, [14, 20]);
  assert.equal(result.result.baseline, 13);
  assert.equal(result.result.slope, 1);
  assert.deepEqual(result.result.pointForecast, [14, 15, 16]);
  assert.equal(result.result.uncertainty, 4);
  assert.equal(result.result.interval.length, 3);
  assert.ok(result.events.some(({ type }) => type === "TEMPORAL_SPLIT_CREATED"));
  assert.ok(result.events.some(({ type }) => type === "NAIVE_BASELINE_EVALUATED"));
  assertLogicalEventStream(result, "APPLICATION_COMPLETED");
});

test("monitor pipeline raises deterministic, inspectable alerts", () => {
  const result = simulateApplicationPipeline({ application: "monitor", series: [10, 10, 11, 10, 30], baselineSize: 3, threshold: 5 });
  assert.equal(result.result.alerts.length, 1);
  assert.equal(result.result.alerts[0].index, 4);
  assert.equal(result.events.find(({ type }) => type === "ALERT_RAISED").status, "warning");
  assertLogicalEventStream(result, "APPLICATION_COMPLETED");

  const quiet = simulateApplicationPipeline({ application: "monitor", series: [4, 4, 4, 4], baselineSize: 2, threshold: 1 });
  assert.equal(quiet.result.alerts.length, 0);
  assert.ok(quiet.events.some(({ type }) => type === "NO_ALERT"));
});

test("trend and foresight preserve their distinct epistemic boundaries", () => {
  const trend = simulateApplicationPipeline({ application: "trend", series: [5, 4, 3, 2], window: 2 });
  assert.equal(trend.result.direction, "down");
  assert.ok(trend.result.slope < 0);

  const foresight = simulateApplicationPipeline({
    application: "foresight",
    drivers: ["تقاضا", "زیرساخت", "قانون"],
    uncertainties: ["تقاضا", "قانون"],
    horizon: 10,
  });
  assert.equal(foresight.result.scenarios.length, 4);
  assert.equal(foresight.result.probabilityClaimed, false);
  assert.ok(foresight.result.scenarios.every(({ probability, status }) => probability === null && status === "scenario-not-forecast"));
  assertLogicalEventStream(foresight, "APPLICATION_COMPLETED");
});

test("application pipelines fail closed on invalid series and settings", () => {
  assert.throws(() => simulateApplicationPipeline({ application: "forecast", series: [1, 2] }), /series must contain 3/);
  assert.throws(() => simulateApplicationPipeline({ application: "trend", series: [1, Number.NaN, 2] }), /finite number/);
  assert.throws(() => simulateApplicationPipeline({ application: "monitor", series: [1, 2], threshold: 0 }), /threshold must be between/);
  assert.throws(() => simulateApplicationPipeline({ application: "foresight", drivers: ["تنها"] }), /drivers must contain/);
  assert.throws(() => simulateApplicationPipeline({ application: "classification" }), /application must be one of/);
});

test("MCP ask policy pauses until approval and never executes an external effect", () => {
  const waiting = simulateProtocolFlow({
    protocol: "mcp",
    operation: "tools/call",
    capability: "repo.read",
    decision: "ask",
    approved: false,
    payload: { path: "README.md" },
  });
  assert.equal(waiting.requestEnvelope.jsonrpc, "2.0");
  assert.equal(waiting.requestEnvelope.protocolVersion, "2026-07-28");
  assert.equal(waiting.policyReceipt.status, "waiting-approval");
  assert.equal(waiting.responseEnvelope, null);
  assert.equal(waiting.effectExecuted, false);
  assert.equal(waiting.events.some(({ type }) => type === "DRY_RUN_DISPATCHED"), false);
  assertLogicalEventStream(waiting, "PROTOCOL_FLOW_COMPLETED");

  const approved = simulateProtocolFlow({ protocol: "mcp", decision: "ask", approved: true });
  assert.equal(approved.policyReceipt.status, "simulated");
  assert.equal(approved.responseEnvelope.result.effectExecuted, false);
  assert.ok(approved.events.some(({ type }) => type === "APPROVAL_GRANTED"));
  assert.ok(approved.events.some(({ type }) => type === "DRY_RUN_DISPATCHED"));
});

test("protocol simulator supports allow/deny, API envelopes and secret redaction", () => {
  const allowed = simulateProtocolFlow({
    protocol: "api",
    method: "POST",
    path: "/v1/specimens",
    decision: "allow",
    risk: "low",
    payload: { query: "demo", nested: { apiKey: "must-not-leak", authorization: "also-secret" } },
  });
  assert.equal(allowed.requestEnvelope.path, "/v1/specimens");
  assert.equal(allowed.requestEnvelope.body.nested.apiKey, "[REDACTED]");
  assert.equal(allowed.requestEnvelope.body.nested.authorization, "[REDACTED]");
  assert.equal(allowed.redactions.length, 2);
  assert.equal(allowed.responseEnvelope.status, 200);
  assert.equal(allowed.effectExecuted, false);

  const denied = simulateProtocolFlow({ protocol: "api", decision: "deny", risk: "critical" });
  assert.equal(denied.policyReceipt.status, "denied");
  assert.equal(denied.responseEnvelope, null);
  assert.ok(denied.events.some(({ type }) => type === "PROTOCOL_REQUEST_BLOCKED"));
  assert.throws(() => simulateProtocolFlow({ protocol: "ftp" }), /protocol must be one of/);
  assert.throws(() => simulateProtocolFlow({ decision: "maybe" }), /decision must be one of/);
  assert.throws(() => simulateProtocolFlow({ protocol: "api", path: "https:\/\/example.com" }), /relative API path/);
});

test("abliteration simulation removes only synthetic projections and reports both regressions", () => {
  const config = {
    vectors: [[1, 1, 0], [2, -1, 0.5]],
    direction: [1, 0, 0],
    strength: 1,
    capabilityBaseline: 0.8,
    safetyBaseline: 0.9,
    capabilitySensitivity: 0.2,
    safetySensitivity: 0.5,
  };
  const before = structuredClone(config);
  const result = simulateAbliteration(config);
  assert.deepEqual(result, simulateAbliteration(config));
  assert.deepEqual(config, before);
  assert.equal(result.syntheticOnly, true);
  assert.equal(result.realWeightsChanged, false);
  assert.ok(result.comparisons.every(({ projectionAfter }) => Math.abs(projectionAfter) < 1e-8));
  assert.equal(result.metrics.projectionReduction, 1);
  assert.ok(result.metrics.capability.after < result.metrics.capability.before);
  assert.ok(result.metrics.safety.after < result.metrics.safety.before);
  assert.notEqual(result.syntheticHashes.before, result.syntheticHashes.after);
  assert.match(result.claimBoundary, /مصنوعی/);
  assertLogicalEventStream(result, "ABLITERATION_SIMULATION_COMPLETED");
});

test("zero-strength abliteration is an identity and invalid geometry is rejected", () => {
  const identity = simulateAbliteration({ vectors: [[1, 2], [3, 4]], direction: [1, 0], strength: 0 });
  for (const { before, after } of identity.comparisons) assert.deepEqual(after, before);
  assert.equal(identity.metrics.projectionReduction, 0);
  assert.equal(identity.metrics.capability.drop, 0);
  assert.equal(identity.metrics.safety.drop, 0);
  const derivedDirection = simulateAbliteration({ vectors: [[1, 2, 3]], strength: 0.5 });
  assert.deepEqual(derivedDirection.direction, [1, 0, 0]);
  assert.throws(() => simulateAbliteration({ vectors: [[1, 2]], direction: [0, 0] }), /direction must be non-zero/);
  assert.throws(() => simulateAbliteration({ vectors: [[1, 2]], direction: [1, 2, 3] }), /incompatible dimension/);
  assert.throws(() => simulateAbliteration({ strength: 1.1 }), /strength must be between/);
});

test("Alef.ba compiler creates APIR, provenance, budget and four-layer I/R/U/O receipt", () => {
  const lines = [
    "GOAL[id=g1]: ساخت نمونهٔ آموزشی قابل ممیزی",
    "CONSTRAINT[id=c1]: هیچ ابزار خارجی اجرا نشود",
    "EVIDENCE[id=e1;source=repo:test]: آزمون قطعی موتور عبور کرد",
    "DECISION[id=d1;evidence=e1]: موتور pure انتخاب شود",
    "DECISION[id=d2]: ادعای بدون شاهد منتشر نشود",
    "UNKNOWN[id=u1]: رفتار مدل اختصاصی منتشر نشده است",
    "UNKNOWN[id=u2;evidence=e1]: دامنهٔ عدم‌قطعیت در receipt ثبت شد",
  ];
  const config = { lines, budget: 200, provenance: { program: "alef.ba", author: "research-lab" } };
  const result = compileAlefbaSpecimen(config);
  assert.deepEqual(result, compileAlefbaSpecimen(config));
  assert.equal(result.format, "alefba-apir-v1");
  assert.equal(result.provenance.program, "alef.ba");
  assert.ok(result.budget.used <= result.budget.limit);
  assert.equal(result.budget.remaining, result.budget.limit - result.budget.used);
  assert.deepEqual(Object.keys(result.receipt), ["I", "R", "U", "O"]);
  assert.equal(result.receipt.I.label, "Integrity");
  assert.equal(result.receipt.R.label, "Representation");
  assert.equal(result.receipt.U.label, "Uptake");
  assert.equal(result.receipt.O.label, "Outcome");
  assert.equal(result.receipt.I.status, "VERIFIED");
  assert.equal(result.receipt.R.status, "VERIFIED");
  assert.equal(result.receipt.I.evidenceClass, "LOCAL_STRUCTURAL");
  assert.equal(result.receipt.R.evidenceClass, "LOCAL_STRUCTURAL");
  assert.equal(result.apir.evidence[0].supportStatus, "WITNESSED");
  assert.equal(result.apir.decisions.find(({ id }) => id === "d1").supportStatus, "TRACEABLE");
  assert.equal(result.apir.decisions.find(({ id }) => id === "d2").supportStatus, "UNKNOWN");
  assert.equal(result.apir.unknowns.find(({ id }) => id === "u1").supportStatus, "UNKNOWN");
  assert.equal(result.apir.unknowns.find(({ id }) => id === "u2").supportStatus, "EVIDENCED_UNCERTAINTY");
  assert.equal(result.receipt.U.status, "UNKNOWN", "uptake requires an explicit external witness");
  assert.equal(result.receipt.O.status, "UNKNOWN", "outcome requires an explicit external witness");
  assert.deepEqual(result.receipt.U.witnessIds, []);
  assert.deepEqual(result.receipt.O.witnessIds, []);
  assert.equal(result.invariants.outputWithoutWitnessRemainsUnknown, true);
  assert.equal(result.invariants.uptakeWithoutWitnessRemainsUnknown, true);
  assert.equal(result.invariants.internalDecisionCannotWitnessUptakeOrOutcome, true);
  assert.ok(Object.isFrozen(result));
});

test("internal decisions cannot witness uptake or outcome, while explicit external witnesses can", () => {
  const internalOnly = compileAlefbaSpecimen({
    lines: [
      "EVIDENCE[id=e1;source=repo:test]: آزمون محلی عبور کرد",
      "DECISION[id=d1;evidence=e1]: کاندید انتخاب شد",
    ],
  });
  assert.equal(internalOnly.apir.decisions[0].supportStatus, "TRACEABLE");
  assert.equal(internalOnly.receipt.I.status, "VERIFIED");
  assert.equal(internalOnly.receipt.R.status, "VERIFIED");
  assert.equal(internalOnly.receipt.U.status, "UNKNOWN");
  assert.equal(internalOnly.receipt.O.status, "UNKNOWN");

  const witnessed = compileAlefbaSpecimen({
    lines: [
      "EVIDENCE[id=eu;source=field:adoption;scope=external;witness=U]: استفادهٔ ثبت‌شده در میدان",
      "EVIDENCE[id=eo;source=field:measured-result;scope=external;witness=O]: پیامد مستقل اندازه‌گیری شد",
      "DECISION[id=d1;evidence=eu,eo]: تصمیم داخلی قابل ردیابی است",
    ],
  });
  assert.equal(witnessed.receipt.U.status, "WITNESSED");
  assert.equal(witnessed.receipt.U.evidenceClass, "EXTERNAL_WITNESS");
  assert.deepEqual(witnessed.receipt.U.witnessIds, ["eu"]);
  assert.equal(witnessed.receipt.O.status, "WITNESSED");
  assert.deepEqual(witnessed.receipt.O.witnessIds, ["eo"]);
});

test("Alef.ba budget omissions invalidate missing witnesses instead of inventing support", () => {
  const result = compileAlefbaSpecimen({
    budget: 4,
    lines: [
      { tag: "GOAL", id: "g", text: "هدف", cost: 2, provenance: { source: "user" } },
      { tag: "EVIDENCE", id: "e", text: "شاهد بزرگ", cost: 10, provenance: { source: "repo:test" } },
      { tag: "DECISION", id: "d", text: "تصمیم", cost: 2, evidenceRefs: ["e"] },
    ],
  });
  assert.deepEqual(result.omissions, [{ id: "e", tag: "EVIDENCE", estimatedCost: 10, reason: "item-exceeds-budget" }]);
  assert.equal(result.apir.decisions[0].supportStatus, "UNKNOWN");
  assert.deepEqual(result.apir.decisions[0].missingEvidenceRefs, ["e"]);
  assert.equal(result.receipt.O.status, "UNKNOWN");
});

test("evidence without provenance is not accepted as a witness", () => {
  const result = compileAlefbaSpecimen({
    lines: [
      "EVIDENCE[id=e1]: گزارهٔ بدون منشأ",
      "DECISION[id=d1;evidence=e1]: نتیجهٔ متکی به گزاره",
    ],
  });
  assert.equal(result.apir.evidence[0].supportStatus, "UNKNOWN");
  assert.equal(result.apir.decisions[0].supportStatus, "UNKNOWN");
  assert.equal(result.receipt.O.status, "UNKNOWN");
});

test("Alef.ba compiler rejects malformed, duplicate and non-plain input", () => {
  assert.throws(() => compileAlefbaSpecimen(), /lines must contain/);
  assert.throws(() => compileAlefbaSpecimen({ lines: ["متن بدون برچسب"] }), /TAG\[metadata\]: text/);
  assert.throws(() => compileAlefbaSpecimen({ lines: ["GOAL[id=x]: یک", "UNKNOWN[id=x]: دو"] }), /ids must be unique/);
  assert.throws(() => compileAlefbaSpecimen({ lines: [{ tag: "OUTPUT", text: "x" }] }), /tag is unsupported/);
  assert.throws(() => compileAlefbaSpecimen({ lines: [{ tag: "GOAL", text: "x", provenance: "opaque" }] }), /provenance must be an object/);
});

test("research engine source has no nondeterministic or external execution surfaces", async () => {
  const source = await readFile(new URL("../src/researchSimulation.js", import.meta.url), "utf8");
  for (const forbidden of [
    "Math.random",
    "Date.now",
    "performance.now",
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "node:fs",
    "child_process",
    "eval(",
    "new Function",
  ]) assert.equal(source.includes(forbidden), false, `research simulator must not contain ${forbidden}`);
  assert.match(source, /conceptualOnly:\s*true/);
  assert.match(source, /realWeightsChanged:\s*false/);
  assert.match(source, /effectExecuted:\s*false/);
});
