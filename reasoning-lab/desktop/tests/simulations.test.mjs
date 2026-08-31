import test from "node:test";
import assert from "node:assert/strict";

import {
  estimateCpuScenario,
  buildDiffusionGrid,
  buildWaveform,
  samplingDistribution,
} from "../src/simulations.js";

const scenario = (overrides = {}) => estimateCpuScenario({
  modelId: "r1-7b",
  quantBits: 4,
  ramGiB: 32,
  cores: 16,
  bandwidthGBs: 50,
  contextTokens: 4096,
  ...overrides,
});

test("CPU estimator returns finite engineering quantities and an explicit estimate warning", () => {
  const result = scenario();
  for (const field of [
    "weightsGiB",
    "kvGiB",
    "workspaceGiB",
    "requiredGiB",
    "usableRamGiB",
    "tokensPerSecond",
  ]) {
    assert.ok(Number.isFinite(result[field]), `${field} must be finite`);
    assert.ok(result[field] >= 0, `${field} cannot be negative`);
  }
  assert.equal(typeof result.fits, "boolean");
  assert.ok(result.grade.trim());
  assert.ok(result.warnings.some((warning) => /benchmark|تحلیلی/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /inference|وزن مدل/i.test(warning)));
});

test("weight memory grows with quantization bits and parameter count", () => {
  const q4 = scenario({ quantBits: 4 });
  const q8 = scenario({ quantBits: 8 });
  const fourteenB = scenario({ modelId: "r1-14b" });
  assert.ok(q8.weightsGiB > q4.weightsGiB * 1.9);
  assert.ok(fourteenB.weightsGiB > q4.weightsGiB * 1.9);
  assert.ok(q4.weightsGiB > 3 && q4.weightsGiB < 5, "7B Q4 should be roughly 3–5 GiB before KV/workspace");
});

test("KV cache grows with context and fit status respects usable RAM", () => {
  const short = scenario({ contextTokens: 2048 });
  const long = scenario({ contextTokens: 32768 });
  const starved = scenario({ ramGiB: 2 });
  assert.ok(long.kvGiB > short.kvGiB);
  assert.ok(long.requiredGiB > short.requiredGiB);
  assert.equal(starved.fits, false);
  assert.equal(starved.tokensPerSecond, 0);
});

test("full 671B MoE cannot be mistaken for its 37B active path", () => {
  const full = scenario({ modelId: "r1-671b", ramGiB: 1024 });
  assert.ok(full.weightsGiB > 300, "671B Q4 should require hundreds of GiB for weights");
  assert.ok(full.model.totalB > full.model.activeB);
  assert.ok(full.warnings.some((warning) => /MoE|expert/i.test(warning)));
});

test("unknown CPU model ids fail closed", () => {
  assert.throws(() => scenario({ modelId: "not-a-model" }), /Unknown CPU model/);
});

test("diffusion grid is deterministic, bounded and progresses from noise to structure", () => {
  const noiseA = buildDiffusionGrid(0, 12, 73);
  const noiseB = buildDiffusionGrid(0, 12, 73);
  const resolved = buildDiffusionGrid(1, 12, 73);
  assert.equal(noiseA.size, 12);
  assert.equal(noiseA.cells.length, 144);
  assert.deepEqual(noiseA, noiseB);
  assert.notDeepEqual(noiseA.cells, resolved.cells);
  for (const cell of [...noiseA.cells, ...resolved.cells]) {
    assert.ok(Number.isFinite(cell) && cell >= 0 && cell <= 1);
  }
  assert.ok(Object.isFrozen(noiseA.cells));
});

test("waveform is deterministic, finite and amplitude-limited", () => {
  const a = buildWaveform(128, 4.5, 19);
  const b = buildWaveform(128, 4.5, 19);
  const different = buildWaveform(128, 7.5, 19);
  assert.equal(a.samples, 128);
  assert.equal(a.values.length, 128);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.values, different.values);
  for (const sample of a.values) assert.ok(Number.isFinite(sample) && sample >= -1 && sample <= 1);
  assert.ok(Object.isFrozen(a.values));
});

test("sampling distribution renormalizes after top-k/top-p filtering", () => {
  const distribution = samplingDistribution([3, 2, 1, 0], { temperature: 0.8, topK: 3, topP: 0.9 });
  assert.ok(distribution.length >= 1 && distribution.length <= 3);
  assert.ok(Math.abs(distribution.reduce((sum, item) => sum + item.probability, 0) - 1) < 1e-12);
  assert.ok(distribution.every(({ probability }) => probability > 0 && probability <= 1));
});
