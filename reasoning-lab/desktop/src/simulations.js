import { CPU_MODELS } from "./catalog.js";

const GIB = 1024 ** 3;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function estimateCpuScenario({
  modelId = "r1-7b",
  quantBits = 4,
  ramGiB = 16,
  cores = 8,
  bandwidthGBs = 35,
  contextTokens = 4096,
} = {}) {
  const model = CPU_MODELS.find((candidate) => candidate.id === modelId);
  if (!model) throw new Error(`Unknown CPU model: ${modelId}`);

  const bits = clamp(Number(quantBits) || 4, 1.5, 16);
  const ram = clamp(Number(ramGiB) || 1, 1, 4096);
  const logicalCores = clamp(Number(cores) || 1, 1, 512);
  const bandwidth = clamp(Number(bandwidthGBs) || 1, 1, 2000);
  const context = clamp(Number(contextTokens) || 1, 1, 1_000_000);

  // 8% covers quantization tables, tensor alignment, vocabulary and metadata.
  // This is deliberately an engineering estimate, not a file-size guarantee.
  const weightsGiB = ((model.totalB * 1e9 * bits) / 8 / GIB) * 1.08;
  const activeWeightsGiB = ((model.activeB * 1e9 * bits) / 8 / GIB) * 1.08;
  const kvGiB = (model.kvBytesPerToken * context) / GIB;
  const workspaceGiB = Math.max(0.55, Math.min(18, model.activeB * 0.11));
  const requiredGiB = weightsGiB + kvGiB + workspaceGiB;
  const usableRamGiB = ram * 0.8;
  const headroomGiB = usableRamGiB - requiredGiB;
  const fits = headroomGiB >= 0;

  // A memory-bandwidth roofline with deliberately conservative efficiency.
  // Real throughput varies with CPU ISA, NUMA, prompt processing, kernels and GGUF.
  const coreScale = Math.min(1, Math.pow(logicalCores / 16, 0.58));
  const sparsePenalty = model.totalB !== model.activeB ? 0.58 : 1;
  const efficiency = 0.34 * coreScale * sparsePenalty;
  const tokensPerSecond = fits
    ? (bandwidth / Math.max(activeWeightsGiB, 0.05)) * efficiency
    : 0;

  let grade = "ناممکن با RAM انتخابی";
  if (fits && tokensPerSecond >= 8) grade = "تعاملی";
  else if (fits && tokensPerSecond >= 2) grade = "قابل استفاده، اما آهسته";
  else if (fits && tokensPerSecond >= 0.25) grade = "آزمایشگاهی و بسیار آهسته";
  else if (fits) grade = "از نظر حافظه ممکن؛ از نظر زمان نامناسب";

  const warnings = [
    "این خروجی محاسبهٔ تحلیلی است، benchmark اجرای llama.cpp نیست.",
    "فایل GGUF یا وزن مدل در این برنامه وجود ندارد و هیچ inference واقعی انجام نمی‌شود.",
  ];
  if (model.totalB !== model.activeB) {
    warnings.push("در MoE، پارامتر فعال محاسبه را کم می‌کند؛ حافظه باید وزن همهٔ expertها را نگه دارد.");
  }
  if (context >= 32768) warnings.push("context بلند، KV cache و زمان پردازش prompt را به‌شدت افزایش می‌دهد.");
  if (bits <= 3) warnings.push("quantization تهاجمی می‌تواند افت کیفیت بیشتری ایجاد کند.");
  if (!fits) warnings.push("سیستم عامل و برنامه‌های دیگر نیز RAM مصرف می‌کنند؛ ۲۰٪ RAM عمداً رزرو شده است.");

  return Object.freeze({
    model,
    inputs: { quantBits: bits, ramGiB: ram, cores: logicalCores, bandwidthGBs: bandwidth, contextTokens: context },
    weightsGiB,
    activeWeightsGiB,
    kvGiB,
    workspaceGiB,
    requiredGiB,
    usableRamGiB,
    headroomGiB,
    fits,
    tokensPerSecond,
    grade,
    warnings,
  });
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDiffusionGrid(progress = 0, size = 24, seed = 73) {
  const safeSize = Math.round(clamp(Number(size) || 24, 4, 128));
  const p = clamp(Number(progress) || 0, 0, 1);
  const random = mulberry32(Number(seed) || 73);
  const cells = [];
  const cx = (safeSize - 1) / 2;
  const cy = (safeSize - 1) / 2;

  for (let y = 0; y < safeSize; y += 1) {
    for (let x = 0; x < safeSize; x += 1) {
      const noise = random();
      const dx = (x - cx) / safeSize;
      const dy = (y - cy) / safeSize;
      const radial = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.exp(-Math.pow(radial - 0.22, 2) * 210);
      const pupil = Math.exp(-(dx * dx + dy * dy) * 180);
      const horizon = Math.exp(-Math.pow(dy - 0.08, 2) * 90) * Math.max(0, 1 - Math.abs(dx) * 2.8);
      const structure = clamp(ring * 0.72 + pupil * 0.92 + horizon * 0.26, 0, 1);
      const eased = p * p * (3 - 2 * p);
      cells.push(noise * (1 - eased) + structure * eased);
    }
  }
  return Object.freeze({ size: safeSize, progress: p, seed: Number(seed) || 73, cells: Object.freeze(cells) });
}

export function buildWaveform(samples = 256, frequency = 3.2, seed = 19) {
  const count = Math.round(clamp(Number(samples) || 256, 16, 4096));
  const f = clamp(Number(frequency) || 3.2, 0.1, 80);
  const random = mulberry32(Number(seed) || 19);
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const envelope = Math.sin(Math.PI * t) ** 0.55;
    const fundamental = Math.sin(Math.PI * 2 * f * t);
    const harmonic = 0.38 * Math.sin(Math.PI * 2 * f * 2.03 * t + 0.6);
    const texture = (random() - 0.5) * 0.14;
    values.push(clamp((fundamental + harmonic + texture) * envelope * 0.68, -1, 1));
  }
  return Object.freeze({ samples: count, frequency: f, seed: Number(seed) || 19, values: Object.freeze(values) });
}

export function samplingDistribution(logits, { temperature = 1, topK = 0, topP = 1 } = {}) {
  if (!Array.isArray(logits) || logits.length === 0) throw new Error("logits must be a non-empty array");
  const temp = clamp(Number(temperature) || 0.0001, 0.0001, 5);
  const k = Math.round(clamp(Number(topK) || logits.length, 1, logits.length));
  const nucleus = clamp(Number(topP) || 0.0001, 0.0001, 1);
  const scaled = logits.map((value, index) => ({ index, score: Number(value) / temp }));
  const max = Math.max(...scaled.map((entry) => entry.score));
  const weighted = scaled.map((entry) => ({ ...entry, weight: Math.exp(entry.score - max) }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const ranked = weighted
    .map((entry) => ({ ...entry, probability: entry.weight / total }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, k);
  let cumulative = 0;
  const kept = [];
  for (const entry of ranked) {
    kept.push(entry);
    cumulative += entry.probability;
    if (cumulative >= nucleus) break;
  }
  const keptTotal = kept.reduce((sum, entry) => sum + entry.probability, 0);
  return Object.freeze(kept.map((entry) => Object.freeze({ index: entry.index, probability: entry.probability / keptTotal })));
}
