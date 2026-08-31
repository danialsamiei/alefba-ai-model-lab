import test from "node:test";
import assert from "node:assert/strict";

import {
  AGENTIC_SCENARIOS,
  ORCHESTRATION_TOPOLOGIES,
  deriveAgenticSnapshot,
  simulateAgentRun,
} from "../src/agenticSimulation.js";

const run = (overrides = {}) => simulateAgentRun({
  scenarioId: "support",
  topologyId: "supervisor",
  effort: "medium",
  contextBudget: 4096,
  approvalPolicy: "manual",
  approved: false,
  failure: "none",
  ...overrides,
});

test("agentic run is deterministic, frozen and driven by logical ticks", () => {
  const first = run();
  const second = run();
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.events));
  assert.deepEqual(first.events.map((event) => event.seq), Array.from({ length: first.events.length }, (_, index) => index + 1));
  assert.deepEqual(first.events.map((event) => event.at), Array.from({ length: first.events.length }, (_, index) => (index + 1) * 180));
  assert.equal(first.events.at(-1).type, "RUN_COMPLETED");
  assert.equal(first.events.filter((event) => event.type === "RUN_COMPLETED").length, 1);
});

test("context compiler never exceeds budget and records compaction or dropping", () => {
  for (const scenarioId of Object.keys(AGENTIC_SCENARIOS)) {
    const result = run({ scenarioId, contextBudget: 1024 });
    assert.ok(result.context.used <= result.context.budget);
    assert.equal(result.context.budget + result.context.reserves.output + result.context.reserves.toolSchema + result.context.reserves.safety, result.context.window);
    assert.ok(result.context.reserves.output > 0 && result.context.reserves.toolSchema > 0 && result.context.reserves.safety > 0);
    assert.equal(result.metrics.contextUsed, result.context.used);
    assert.ok(result.context.selected.length > 0);
    assert.ok(result.context.selected.some((item) => item.state !== "full") || result.context.dropped.length > 0);
  }
});

test("high-risk tool cannot start before approval and denial prevents execution", () => {
  const denied = run({ approved: false });
  const requiredIndex = denied.events.findIndex((event) => event.type === "APPROVAL_REQUIRED");
  const deniedIndex = denied.events.findIndex((event) => event.type === "APPROVAL_DENIED");
  assert.ok(requiredIndex >= 0 && deniedIndex > requiredIndex);
  assert.equal(denied.events.some((event) => event.type === "TOOL_STARTED"), false);
  assert.equal(denied.events.at(-1).data.sideEffectExecuted, false);

  const granted = run({ approved: true });
  const grantIndex = granted.events.findIndex((event) => event.type === "APPROVAL_GRANTED");
  const toolIndex = granted.events.findIndex((event) => event.type === "TOOL_STARTED");
  assert.ok(grantIndex >= 0 && toolIndex > grantIndex);
  assert.equal(granted.events.at(-1).data.sideEffectExecuted, true);
});

test("prompt injection remains untrusted and cannot escalate tool authority", () => {
  const result = run({ scenarioId: "injection", approved: true });
  assert.ok(result.events.some((event) => event.type === "CONTEXT_SOURCE_QUARANTINED"));
  assert.ok(result.events.some((event) => event.type === "GUARDRAIL_BLOCKED"));
  assert.equal(result.events.some((event) => event.type === "TOOL_STARTED"), false);
  assert.equal(result.events.at(-1).data.sideEffectExecuted, false);
});

test("retry is bounded and only follows an injected transient failure", () => {
  for (const failure of ["timeout", "rateLimit"]) {
    const result = run({ scenarioId: "research", failure });
    assert.equal(result.events.filter((event) => event.type === "TOOL_RETRY").length, 1);
    const retry = result.events.find((event) => event.type === "TOOL_RETRY");
    assert.deepEqual(retry.data, { attempt: 2, maxAttempts: 2 });
  }
  assert.equal(run({ scenarioId: "research" }).metrics.retries, 0);
});

test("parallel topologies join after worker results and expose multiple owners", () => {
  for (const topologyId of ["supervisor", "parallel", "dag", "debate"]) {
    const result = run({ scenarioId: "research", topologyId, effort: "high" });
    const workerResults = result.events.filter((event) => event.type === "WORKER_RESULT");
    const joinIndex = result.events.findIndex((event) => event.type === "FAN_IN_COMPLETED");
    const lastWorkerIndex = Math.max(...workerResults.map((event) => result.events.indexOf(event)));
    assert.ok(joinIndex > lastWorkerIndex, `${topologyId} joined before workers completed`);
    assert.ok(result.metrics.workers >= 2);
  }
  assert.equal(Object.keys(ORCHESTRATION_TOPOLOGIES).length >= 6, true);
});

test("every non-root span has a valid root parent and snapshot stepping is bounded", () => {
  const result = run({ scenarioId: "coding", effort: "high" });
  const spanIds = new Set(result.events.map((event) => event.spanId));
  for (const event of result.events.slice(1)) assert.ok(spanIds.has(event.parentSpanId));
  assert.equal(result.events[0].parentSpanId, null);
  assert.equal(deriveAgenticSnapshot(result, -9).index, 0);
  assert.equal(deriveAgenticSnapshot(result, 4).visibleEvents.length, 4);
  assert.equal(deriveAgenticSnapshot(result, 999).index, result.events.length);
  assert.equal(deriveAgenticSnapshot(result, result.events.length).terminal, true);
});
