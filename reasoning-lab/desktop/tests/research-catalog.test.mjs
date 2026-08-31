import test from "node:test";
import assert from "node:assert/strict";

import {
  PROGRAM_GOALS,
  RESEARCH_PROFILES,
  LEARNING_STAGES,
  USER_DATA_LAYERS,
  AGENT_TOOL_PROFILES,
  APPLICATION_PROFILES,
  PROTOCOL_PROFILES,
  ABLITERATION_STEPS,
  COMPETITOR_MATRIX,
  RESEARCH_SOURCES,
  RESEARCH_BY_ID,
} from "../src/researchCatalog.js";

const isHttps = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const sectionsWithIds = [
  RESEARCH_PROFILES,
  LEARNING_STAGES,
  USER_DATA_LAYERS,
  AGENT_TOOL_PROFILES,
  APPLICATION_PROFILES,
  PROTOCOL_PROFILES,
  [PROGRAM_GOALS, ABLITERATION_STEPS],
];

const allLookupEntries = sectionsWithIds.flat();

test("research catalog identifiers are unique and the lookup is immutable", () => {
  const ids = allLookupEntries.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, "all cross-section ids must be unique");
  assert.equal(RESEARCH_BY_ID.size, ids.length);
  assert.equal(Object.keys(RESEARCH_BY_ID).length, ids.length);
  assert.ok(Object.isFrozen(RESEARCH_BY_ID));

  for (const entry of allLookupEntries) {
    assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `invalid id: ${entry.id}`);
    assert.equal(RESEARCH_BY_ID[entry.id], entry);
    assert.equal(RESEARCH_BY_ID.get(entry.id), entry);
    assert.equal(RESEARCH_BY_ID.has(entry.id), true);
    assert.ok(Object.isFrozen(entry), `${entry.id} must be frozen`);
  }

  assert.equal(RESEARCH_BY_ID.get("missing-entry"), undefined);
  assert.equal(RESEARCH_BY_ID.has("missing-entry"), false);
  assert.equal("set" in RESEARCH_BY_ID, false, "lookup must not expose a mutating Map API");
});

test("the alef.ba program has exactly three goals and the declared compilation loop", () => {
  assert.equal(PROGRAM_GOALS.kind, "program");
  assert.equal(PROGRAM_GOALS.goals.length, 3);
  assert.deepEqual(PROGRAM_GOALS.operatingLoop.map(({ id }) => id), ["source", "apir", "pack", "verify"]);
  assert.deepEqual(PROGRAM_GOALS.operatingLoop.map(({ order }) => order), [1, 2, 3, 4]);
  assert.match(PROGRAM_GOALS.boundaryFa, /پروتکل|مجوز/);
  assert.match(PROGRAM_GOALS.operatingLoop.at(-1).actionFa, /UNKNOWN/);
});

test("research profiles keep model, product, platform, harness and program boundaries explicit", () => {
  const allowedKinds = new Set(["model", "product", "platform", "harness", "protocol", "program"]);
  const ids = RESEARCH_PROFILES.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(RESEARCH_PROFILES.length, 13);

  for (const item of RESEARCH_PROFILES) {
    assert.ok(allowedKinds.has(item.kind), `${item.id} has an invalid kind`);
    assert.match(item.asOf, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(item.evidenceStatus.length > 0);
    assert.ok(item.sourceAvailability.length > 0);
    assert.ok(item.summaryFa.length >= 50);
    assert.ok(item.publicBoundary.length >= 2, `${item.id} needs public boundaries`);
    assert.ok(item.unknownBoundary.length >= 2, `${item.id} needs explicit unknowns`);
    assert.ok(item.primaryDocs.length >= 1, `${item.id} needs primary documentation`);
    assert.ok(Object.isFrozen(item.publicBoundary));
    assert.ok(Object.isFrozen(item.unknownBoundary));
  }

  const expectedKinds = {
    "gpt-5-6-sol": "model",
    chatgpt: "product",
    "sora-2024": "model",
    "sora-2": "model",
    openart: "platform",
    qwen3: "model",
    "deepseek-r1": "model",
    "hermes-agent": "harness",
    "codex-cli": "harness",
    "claude-code": "harness",
    devin: "product",
    mirofish: "program",
    comfyui: "harness",
  };
  for (const [id, kind] of Object.entries(expectedKinds)) assert.equal(RESEARCH_BY_ID[id]?.kind, kind, id);
});

test("GPT-5.6 Sol records unsupported fine-tuning and refuses to invent internals", () => {
  const sol = RESEARCH_BY_ID["gpt-5-6-sol"];
  assert.ok(sol);
  assert.equal(sol.facts.apiModelId, "gpt-5.6");
  assert.equal(sol.facts.fineTuning, "unsupported");
  assert.equal(sol.facts.contextWindowTokens, 1050000);
  assert.equal(sol.facts.maxOutputTokens, 128000);
  assert.deepEqual(sol.facts.reasoningEfforts, ["none", "low", "medium", "high", "xhigh", "max"]);

  const unknowns = sol.unknownBoundary.join(" ");
  assert.match(unknowns, /پارامتر/);
  assert.match(unknowns, /MoE/);
  assert.match(unknowns, /داده|optimizer|reward/);
  assert.doesNotMatch(sol.publicBoundary.join(" "), /معماری.*MoE|MoE.*معماری/);
});

test("learning stages distinguish weight updates from context, RAG, reasoning and memory", () => {
  assert.ok(LEARNING_STAGES.length >= 12);
  const byId = Object.fromEntries(LEARNING_STAGES.map((stage) => [stage.id, stage]));

  for (const stage of LEARNING_STAGES) {
    assert.equal(typeof stage.weightsChange, "boolean", `${stage.id}.weightsChange must be boolean`);
    assert.ok(stage.persistenceScope.length > 0);
    assert.ok(stage.mechanismFa.length >= 30);
    assert.ok(stage.userDataFa.length >= 25);
    assert.ok(stage.primaryDocs.length >= 1);
  }

  for (const id of ["pretraining", "supervised-fine-tuning", "preference-training", "reasoning-training", "distillation", "peft-lora"]) {
    assert.equal(byId[id].weightsChange, true, `${id} must be a training-time weight update`);
  }
  for (const id of ["rag", "in-context-learning", "inference-reasoning", "memory-personalization", "feedback-pipeline"]) {
    assert.equal(byId[id].weightsChange, false, `${id} must not claim an immediate weight update`);
  }
  assert.match(byId["inference-reasoning"].mechanismFa, /استدلال|محاسبه/);
  assert.match(byId["memory-personalization"].persistenceScope, /user|project/);
});

test("user-data layers expose retention and training boundaries", () => {
  assert.ok(USER_DATA_LAYERS.length >= 8);
  for (const layer of USER_DATA_LAYERS) {
    assert.equal(typeof layer.weightsChange, "boolean");
    assert.ok(layer.persistenceScope.length > 0);
    assert.ok(layer.contentsFa.length >= 20);
    assert.ok(layer.injectionPoint.length > 0);
    assert.ok(layer.boundaryFa.length >= 25);
  }
  assert.equal(RESEARCH_BY_ID.request.weightsChange, false);
  assert.equal(RESEARCH_BY_ID["saved-memory"].weightsChange, false);
  assert.equal(RESEARCH_BY_ID["fine-tuning-dataset"].weightsChange, true);
  assert.match(RESEARCH_BY_ID["fine-tuning-dataset"].boundaryFa, /Sol|پشتیبانی/);
});

test("agent-tool comparison profiles cover the same engineering axes", () => {
  const fields = [
    "modelBoundaryFa",
    "agentLoopFa",
    "toolInterfaceFa",
    "sandboxApprovalFa",
    "contextMemoryFa",
    "orchestrationFa",
    "observabilityFa",
    "executionFa",
    "opennessFa",
  ];
  assert.ok(AGENT_TOOL_PROFILES.length >= 5);
  for (const item of AGENT_TOOL_PROFILES) {
    assert.ok(RESEARCH_BY_ID[item.profileId], `${item.id} references a missing research profile`);
    for (const field of fields) assert.ok(item[field].length >= 15, `${item.id}.${field} is incomplete`);
    assert.ok(item.primaryDocs.length >= 1);
  }
  assert.match(RESEARCH_BY_ID["hermes-agent-tools"].modelBoundaryFa, /وزن|provider/);
  assert.match(RESEARCH_BY_ID["devin-tools"].opennessFa, /public docs/i);
});

test("application and protocol profiles are stepwise and do not collapse distinct protocols", () => {
  assert.ok(APPLICATION_PROFILES.length >= 10);
  for (const application of APPLICATION_PROFILES) {
    assert.ok(application.workflow.length >= 4, `${application.id} needs a workflow`);
    assert.ok(application.evidenceFa.length >= 25);
    assert.ok(application.guardrailFa.length >= 25);
    assert.ok(application.primaryDocs.length >= 1);
  }

  assert.deepEqual(PROTOCOL_PROFILES.map(({ id }) => id), ["mcp", "a2a", "ag-ui", "openapi", "json-rpc"]);
  for (const protocol of PROTOCOL_PROFILES) {
    assert.equal(protocol.kind, "protocol");
    assert.ok(protocol.roleFa.length >= 30);
    assert.ok(protocol.authorityBoundaryFa.length >= 30);
    assert.ok(protocol.notEquivalentToFa.length >= 2);
    assert.ok(protocol.primaryDocs.length >= 1);
  }
  assert.match(RESEARCH_BY_ID.mcp.roleFa, /Host|tool/);
  assert.match(RESEARCH_BY_ID.a2a.roleFa, /عامل/);
  assert.match(RESEARCH_BY_ID["ag-ui"].roleFa, /frontend|backend/);
});

test("abliteration is a bounded visual lesson with explicit safety risks", () => {
  assert.equal(ABLITERATION_STEPS.safeMode, "visual-simulation-only");
  assert.equal(ABLITERATION_STEPS.steps.length, 6);
  assert.deepEqual(ABLITERATION_STEPS.steps.map(({ order }) => order), [1, 2, 3, 4, 5, 6]);
  assert.ok(ABLITERATION_STEPS.risks.length >= 6);
  assert.ok(ABLITERATION_STEPS.risks.some(({ id, severity }) => id === "white-box-jailbreak" && severity === "critical"));
  assert.ok(ABLITERATION_STEPS.risks.some(({ id }) => id === "checkpoint-supply-chain"));
  assert.match(ABLITERATION_STEPS.productBoundaryFa, /بدون.*weight mutation|بدون.*checkpoint/);
  assert.ok(ABLITERATION_STEPS.primaryDocs.some(({ id }) => id === "refusal-paper"));
  assert.ok(ABLITERATION_STEPS.primaryDocs.some(({ id }) => id === "refusal-repo"));
});

test("competitor matrix compares the same axes and labels targets as targets", () => {
  const axisIds = COMPETITOR_MATRIX.axes.map(({ id }) => id);
  assert.equal(new Set(axisIds).size, axisIds.length);
  assert.ok(axisIds.length >= 7);
  assert.ok(COMPETITOR_MATRIX.entries.length >= 6);

  const allowed = new Set(Object.keys(COMPETITOR_MATRIX.scale));
  for (const entry of COMPETITOR_MATRIX.entries) {
    assert.deepEqual(Object.keys(entry.coverage), axisIds, `${entry.id} must cover every matrix axis in order`);
    for (const value of Object.values(entry.coverage)) assert.ok(allowed.has(value), `${entry.id} has unknown coverage ${value}`);
    assert.ok(entry.boundaryFa.length >= 35);
    assert.ok(entry.primaryDocs.length >= 1);
  }

  const target = COMPETITOR_MATRIX.entries.find(({ id }) => id === "model-ecosystem-lab-target");
  assert.equal(target.position, "project-target");
  assert.ok(Object.values(target.coverage).every((value) => value === "project-target"));
});

test("every citation is a unique typed HTTPS source and every section resolves to the registry", () => {
  const sourceIds = RESEARCH_SOURCES.map(({ id }) => id);
  const sourceUrls = RESEARCH_SOURCES.map(({ url }) => url);
  assert.equal(new Set(sourceIds).size, sourceIds.length, "source ids must be unique");
  assert.equal(new Set(sourceUrls).size, sourceUrls.length, "source URLs must be unique");
  assert.ok(RESEARCH_SOURCES.length >= 45);

  const registryById = Object.fromEntries(RESEARCH_SOURCES.map((item) => [item.id, item]));
  for (const item of RESEARCH_SOURCES) {
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(item.title.length >= 4);
    assert.notEqual(item.authority, "unclassified");
    assert.ok(isHttps(item.url), `${item.id} must use HTTPS`);
    assert.ok(item.type.length > 0);
    assert.ok(Object.isFrozen(item));
  }

  const holders = [
    PROGRAM_GOALS,
    ...RESEARCH_PROFILES,
    ...LEARNING_STAGES,
    ...AGENT_TOOL_PROFILES,
    ...APPLICATION_PROFILES,
    ...PROTOCOL_PROFILES,
    ABLITERATION_STEPS,
    ...COMPETITOR_MATRIX.entries,
  ];
  for (const holder of holders) {
    assert.ok(holder.primaryDocs.length >= 1, `${holder.id} must cite a primary source`);
    for (const citation of holder.primaryDocs) {
      assert.equal(registryById[citation.id], citation, `${holder.id} source ${citation.id} is not registry-backed`);
      assert.ok(isHttps(citation.url));
      assert.notEqual(citation.authority, "unclassified");
    }
  }

  const abliterator = registryById["abliterator-repo"];
  assert.equal(abliterator.type, "community-repository");
  assert.equal(abliterator.authority, "community-artifact");

  const requiredProfileSources = {
    "gpt-5-6-sol": "openai-sol",
    "sora-2024": "sora-2024",
    "sora-2": "sora-2",
    openart: "openart-models",
    qwen3: "qwen3-paper",
    "deepseek-r1": "deepseek-r1-paper",
    "hermes-agent": "hermes-architecture",
    "codex-cli": "codex-repo",
    "claude-code": "claude-agent-loop",
    devin: "devin-architecture",
    mirofish: "mirofish-repo",
    comfyui: "comfy-docs",
  };
  for (const [profileId, sourceId] of Object.entries(requiredProfileSources)) {
    assert.ok(RESEARCH_BY_ID[profileId].primaryDocs.some(({ id }) => id === sourceId), `${profileId} lacks ${sourceId}`);
  }
});
