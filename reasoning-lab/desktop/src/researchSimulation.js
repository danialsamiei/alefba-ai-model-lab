const MODALITIES = Object.freeze(["text", "image", "video", "audio", "code", "multimodal"]);
const APPLICATIONS = Object.freeze(["forecast", "monitor", "trend", "foresight"]);
const PROTOCOLS = Object.freeze(["mcp", "api"]);
const POLICY_DECISIONS = Object.freeze(["allow", "ask", "deny"]);
const RISK_LEVELS = Object.freeze(["low", "medium", "high", "critical"]);
const SPECIMEN_TAGS = Object.freeze(["GOAL", "CONSTRAINT", "DECISION", "EVIDENCE", "UNKNOWN"]);

const round = (value, digits = 8) => Number(Number(value).toFixed(digits));
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function plainCopy(value, path = "config") {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map((item, index) => plainCopy(item, `${path}[${index}]`));
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${path} must contain only plain JSON-compatible values`);
  }
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) result[key] = plainCopy(value[key], `${path}.${key}`);
  }
  return result;
}

function canonicalJson(value) {
  return JSON.stringify(plainCopy(value));
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function choice(name, value, allowed, fallback) {
  const candidate = value ?? fallback;
  if (!allowed.includes(candidate)) throw new RangeError(`${name} must be one of: ${allowed.join(", ")}`);
  return candidate;
}

function finiteNumber(name, value, fallback, minimum = -Infinity, maximum = Infinity) {
  const candidate = value ?? fallback;
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  if (candidate < minimum || candidate > maximum) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}`);
  }
  return candidate;
}

function boundedInteger(name, value, fallback, minimum, maximum) {
  const candidate = finiteNumber(name, value, fallback, minimum, maximum);
  if (!Number.isInteger(candidate)) throw new TypeError(`${name} must be an integer`);
  return candidate;
}

function nonEmptyText(name, value, fallback) {
  const candidate = value ?? fallback;
  if (typeof candidate !== "string" || !candidate.trim()) throw new TypeError(`${name} must be non-empty text`);
  return candidate.trim();
}

function eventEmitter(engineId, identity) {
  const runId = `run-${hashText(`${engineId}|${canonicalJson(identity)}`)}`;
  const traceId = `trace-${hashText(`trace|${runId}`)}`;
  const events = [];
  const emit = (type, fields = {}) => {
    const seq = events.length + 1;
    const event = {
      schemaVersion: "research-event-v1",
      runId,
      traceId,
      spanId: `span-${String(seq).padStart(3, "0")}`,
      parentSpanId: seq === 1 ? null : "span-001",
      seq,
      logicalTick: seq * 100,
      type,
      phase: fields.phase ?? "runtime",
      actor: fields.actor ?? "research-harness",
      target: fields.target ?? null,
      status: fields.status ?? "ok",
      label: fields.label ?? type,
      detail: fields.detail ?? "",
      data: plainCopy(fields.data ?? {}, `event.${type}.data`),
    };
    events.push(event);
    return event;
  };
  return { runId, traceId, events, emit };
}

function finishRun(base, fields) {
  return deepFreeze({
    ...fields,
    runId: base.runId,
    traceId: base.traceId,
    events: base.events,
  });
}

const REPRESENTATIONS = Object.freeze({
  text: "tokenizer متنی",
  image: "pixel/latent patches",
  video: "spatiotemporal latent tokens",
  audio: "spectrogram/codec tokens",
  code: "code tokenizer + FIM markers",
  multimodal: "modality encoders + shared/projected space",
});

export function simulateLearningLifecycle(config = {}) {
  const input = plainCopy(config);
  const modality = choice("modality", input.modality, MODALITIES, "text");
  const customization = choice("customization", input.customization, ["none", "adapter", "fine-tune"], "none");
  const continuedTraining = input.continuedTraining === true;
  const preferenceTraining = input.preferenceTraining !== false;
  const distillation = input.distillation === true;
  const durableMemory = input.durableMemory === true;
  const identity = { modality, customization, continuedTraining, preferenceTraining, distillation, durableMemory };
  const base = eventEmitter("learning-lifecycle", identity);

  const optionalStage = (enabled) => (enabled ? "yes" : "conditional");
  const stages = [
    { id: "data-curation", phase: "data", label: "گردآوری و پالایش داده", weightsChange: "no", persistenceScope: "organization", applies: true, artifact: "dataset + manifest" },
    { id: "representation", phase: "representation", label: REPRESENTATIONS[modality], weightsChange: "no", persistenceScope: "model-version", applies: true, artifact: "tokenizer/codec/encoder contract" },
    { id: "initialization", phase: "training", label: "مقداردهی پارامترها", weightsChange: "yes", persistenceScope: "model-version", applies: true, artifact: "initial weights" },
    { id: "pretraining", phase: "training", label: "پیش‌آموزش", weightsChange: "yes", persistenceScope: "model-version", applies: true, artifact: "base checkpoint" },
    { id: "continued-training", phase: "training", label: "ادامهٔ پیش‌آموزش / mid-training", weightsChange: optionalStage(continuedTraining), persistenceScope: "model-version", applies: continuedTraining, artifact: "domain checkpoint" },
    { id: "sft", phase: "post-training", label: "Supervised fine-tuning", weightsChange: "yes", persistenceScope: "model-version", applies: true, artifact: "instruction checkpoint" },
    { id: "preference", phase: "post-training", label: "Preference / reinforcement optimization", weightsChange: optionalStage(preferenceTraining), persistenceScope: "model-version", applies: preferenceTraining, artifact: "aligned checkpoint or policy" },
    { id: "distillation", phase: "post-training", label: "Distillation", weightsChange: optionalStage(distillation), persistenceScope: "model-version", applies: distillation, artifact: "student checkpoint" },
    { id: "evaluation", phase: "evaluation", label: "ارزیابی، ایمنی و release gates", weightsChange: "no", persistenceScope: "run", applies: true, artifact: "evaluation report" },
    { id: "deployment", phase: "deployment", label: "بسته‌بندی و استقرار نسخه", weightsChange: "no", persistenceScope: "model-version", applies: true, artifact: "deployment manifest" },
    { id: "inference-context", phase: "inference", label: "Prompt و Context جاری", weightsChange: "no", persistenceScope: "request", applies: true, artifact: "request trace" },
    { id: "retrieval", phase: "inference", label: "RAG و دادهٔ ابزار", weightsChange: "no", persistenceScope: "request", applies: true, artifact: "context manifest" },
    { id: "durable-memory", phase: "personalization", label: "حافظهٔ پایدار کاربر", weightsChange: "no", persistenceScope: "user", applies: durableMemory, artifact: "scoped memory record" },
    {
      id: "explicit-customization",
      phase: "personalization",
      label: customization === "adapter" ? "آموزش Adapter" : customization === "fine-tune" ? "Fine-tune اختصاصی" : "بدون آموزش اختصاصی",
      weightsChange: customization === "none" ? "no" : "yes",
      foundationWeightsChange: customization === "fine-tune" ? "yes" : "no",
      persistenceScope: customization === "none" ? "none" : customization === "adapter" ? "organization" : "model-version",
      applies: customization !== "none",
      artifact: customization === "adapter" ? "adapter weights" : customization === "fine-tune" ? "custom checkpoint" : "none",
    },
  ].map((stage, index) => ({ ...stage, order: index + 1 }));

  base.emit("LIFECYCLE_STARTED", { phase: "lifecycle", label: "چرخهٔ یادگیری آغاز شد", data: { modality, representation: REPRESENTATIONS[modality] } });
  for (const stage of stages) {
    base.emit(stage.applies ? "LEARNING_STAGE_VISITED" : "LEARNING_STAGE_SKIPPED", {
      phase: stage.phase,
      status: stage.applies ? "ok" : "skipped",
      label: stage.label,
      data: { id: stage.id, weightsChange: stage.weightsChange, foundationWeightsChange: stage.foundationWeightsChange ?? "not-applicable", persistenceScope: stage.persistenceScope, artifact: stage.artifact },
    });
  }
  base.emit("LIFECYCLE_COMPLETED", { phase: "lifecycle", label: "چرخهٔ آموزشی مدل شد", detail: "Context، retrieval و memory به‌تنهایی وزن پایه را تغییر نمی‌دهند." });

  const personalizationPaths = [
    { id: "request", entersAt: "inference-context", weightsChange: "no", persistenceScope: "request" },
    { id: "session", entersAt: "inference-context", weightsChange: "no", persistenceScope: "session" },
    { id: "retrieval", entersAt: "retrieval", weightsChange: "no", persistenceScope: "request" },
    { id: "memory", entersAt: "durable-memory", weightsChange: "no", persistenceScope: "user" },
    { id: "adapter", entersAt: "explicit-customization", weightsChange: "yes", foundationWeightsChange: "no", persistenceScope: "organization" },
    { id: "fine-tune", entersAt: "explicit-customization", weightsChange: "yes", foundationWeightsChange: "yes", persistenceScope: "model-version" },
  ];

  return finishRun(base, {
    format: "learning-lifecycle-v1",
    conceptualOnly: true,
    modality,
    representation: REPRESENTATIONS[modality],
    customization,
    stages,
    personalizationPaths,
    summary: {
      appliedStages: stages.filter((stage) => stage.applies).length,
      weightChangingStages: stages.filter((stage) => stage.applies && stage.weightsChange === "yes").map((stage) => stage.id),
      proprietaryInternals: "UNKNOWN unless supported by a public primary source",
    },
  });
}

function numericSeries(value, fallback, minimumLength = 2) {
  const series = value ?? fallback;
  if (!Array.isArray(series) || series.length < minimumLength || series.length > 256) {
    throw new RangeError(`series must contain ${minimumLength} to 256 values`);
  }
  return series.map((item, index) => finiteNumber(`series[${index}]`, item, undefined, -1e12, 1e12));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function movingAverage(values, window) {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    return round(average(values.slice(start, index + 1)));
  });
}

function applicationBase(application, input) {
  return eventEmitter(`application-${application}`, input);
}

export function simulateApplicationPipeline(config = {}) {
  const input = plainCopy(config);
  const application = choice("application", input.application ?? input.kind, APPLICATIONS, "forecast");

  if (application === "foresight") {
    const drivers = input.drivers ?? ["رشد تقاضا", "محدودیت زیرساخت", "تغییر مقررات"];
    if (!Array.isArray(drivers) || drivers.length < 2 || drivers.length > 8) throw new RangeError("drivers must contain 2 to 8 entries");
    const cleanDrivers = drivers.map((item, index) => nonEmptyText(`drivers[${index}]`, item));
    const uncertainties = input.uncertainties ?? cleanDrivers.slice(0, 2);
    if (!Array.isArray(uncertainties) || uncertainties.length !== 2) throw new RangeError("uncertainties must contain exactly two entries");
    const cleanUncertainties = uncertainties.map((item, index) => nonEmptyText(`uncertainties[${index}]`, item));
    const horizon = boundedInteger("horizon", input.horizon, 5, 1, 50);
    const base = applicationBase(application, { application, drivers: cleanDrivers, uncertainties: cleanUncertainties, horizon });
    base.emit("EVIDENCE_REGISTERED", { phase: "evidence", label: "ثبت شواهد و مفروضات", data: { driverCount: cleanDrivers.length } });
    base.emit("DRIVERS_MAPPED", { phase: "analysis", label: "نگاشت پیشران‌ها", data: { drivers: cleanDrivers } });
    base.emit("CRITICAL_UNCERTAINTIES_SELECTED", { phase: "analysis", label: "دو عدم‌قطعیت بحرانی", data: { uncertainties: cleanUncertainties } });
    const signs = [["low", "low"], ["low", "high"], ["high", "low"], ["high", "high"]];
    const scenarios = signs.map(([first, second], index) => ({
      id: `scenario-${index + 1}`,
      title: `${cleanUncertainties[0]}: ${first} / ${cleanUncertainties[1]}: ${second}`,
      axes: { [cleanUncertainties[0]]: first, [cleanUncertainties[1]]: second },
      probability: null,
      status: "scenario-not-forecast",
    }));
    base.emit("SCENARIO_MATRIX_CREATED", { phase: "synthesis", label: "ماتریس چهار سناریو", data: { scenarioIds: scenarios.map(({ id }) => id) } });
    base.emit("PATHWAYS_REVIEWED", { phase: "review", label: "بازبینی مسیرها و علائم پیش‌نگر", detail: "سناریوها احتمال پیش‌بینی‌شده نیستند." });
    base.emit("APPLICATION_COMPLETED", { phase: "lifecycle", label: "آینده‌پژوهی پایان یافت" });
    return finishRun(base, { format: "application-pipeline-v1", conceptualOnly: true, application, inputs: { drivers: cleanDrivers, uncertainties: cleanUncertainties, horizon }, result: { scenarios, probabilityClaimed: false } });
  }

  const series = numericSeries(input.series, [10, 11, 12, 13, 15, 18], application === "monitor" ? 2 : 3);
  const base = applicationBase(application, { application, series, parameters: input });
  base.emit("SERIES_INGESTED", { phase: "data", label: "سری زمانی دریافت شد", data: { observations: series.length } });

  if (application === "forecast") {
    const holdout = boundedInteger("holdout", input.holdout, 1, 1, Math.max(1, Math.floor(series.length / 2)));
    const horizon = boundedInteger("horizon", input.horizon, 3, 1, 48);
    const train = series.slice(0, -holdout);
    const test = series.slice(-holdout);
    const recent = train.slice(-Math.min(4, train.length));
    const slope = recent.length > 1 ? (recent.at(-1) - recent[0]) / (recent.length - 1) : 0;
    const pointForecast = Array.from({ length: horizon }, (_, index) => round(train.at(-1) + slope * (index + 1)));
    const baselineErrors = test.map((value) => Math.abs(value - train.at(-1)));
    const uncertainty = Math.max(0.000001, average(baselineErrors.length ? baselineErrors : [0]));
    const interval = pointForecast.map((value, index) => ({ lower: round(value - uncertainty * (index + 1)), upper: round(value + uncertainty * (index + 1)) }));
    base.emit("TEMPORAL_SPLIT_CREATED", { phase: "data", label: "تقسیم زمانی بدون shuffle", data: { train: train.length, holdout: test.length } });
    base.emit("NAIVE_BASELINE_EVALUATED", { phase: "evaluation", label: "Baseline آخرین مشاهده", data: { mae: round(average(baselineErrors)) } });
    base.emit("FORECAST_GENERATED", { phase: "inference", label: "برآورد روندی", data: { horizon, slope: round(slope) } });
    base.emit("UNCERTAINTY_ATTACHED", { phase: "evaluation", label: "بازهٔ عدم‌قطعیت", data: { method: "holdout-absolute-error" } });
    base.emit("APPLICATION_COMPLETED", { phase: "lifecycle", label: "پیش‌بینی پایان یافت" });
    return finishRun(base, { format: "application-pipeline-v1", conceptualOnly: true, application, inputs: { series, holdout, horizon }, result: { train, test, baseline: train.at(-1), slope: round(slope), pointForecast, interval, uncertainty: round(uncertainty) } });
  }

  if (application === "monitor") {
    const baselineSize = boundedInteger("baselineSize", input.baselineSize, Math.max(2, Math.floor(series.length / 2)), 2, series.length);
    const baselineValues = series.slice(0, baselineSize);
    const baseline = average(baselineValues);
    const meanDeviation = average(baselineValues.map((value) => Math.abs(value - baseline)));
    const threshold = finiteNumber("threshold", input.threshold, Math.max(1, meanDeviation * 3), 0.000001, 1e12);
    const observations = series.map((value, index) => ({ index, value, deviation: round(Math.abs(value - baseline)), alert: index >= baselineSize && Math.abs(value - baseline) > threshold }));
    const alerts = observations.filter(({ alert }) => alert);
    base.emit("BASELINE_ESTABLISHED", { phase: "analysis", label: "خط پایهٔ نظارت", data: { baseline: round(baseline), baselineSize, threshold } });
    base.emit("SIGNALS_EVALUATED", { phase: "monitor", label: "ارزیابی سیگنال‌ها", data: { evaluated: series.length - baselineSize } });
    base.emit(alerts.length ? "ALERT_RAISED" : "NO_ALERT", { phase: "decision", status: alerts.length ? "warning" : "ok", label: alerts.length ? "هشدار قابل triage" : "هشداری ثبت نشد", data: { alertIndexes: alerts.map(({ index }) => index) } });
    base.emit("APPLICATION_COMPLETED", { phase: "lifecycle", label: "چرخهٔ نظارت پایان یافت" });
    return finishRun(base, { format: "application-pipeline-v1", conceptualOnly: true, application, inputs: { series, baselineSize, threshold }, result: { baseline: round(baseline), observations, alerts } });
  }

  const window = boundedInteger("window", input.window, Math.min(3, series.length), 2, series.length);
  const smoothed = movingAverage(series, window);
  const slope = (smoothed.at(-1) - smoothed[0]) / Math.max(1, smoothed.length - 1);
  const direction = Math.abs(slope) < 1e-9 ? "stable" : slope > 0 ? "up" : "down";
  const changes = smoothed.slice(1).map((value, index) => round(value - smoothed[index]));
  const strongestChangeIndex = changes.length ? changes.reduce((best, value, index) => Math.abs(value) > Math.abs(changes[best]) ? index : best, 0) + 1 : null;
  base.emit("SERIES_SMOOTHED", { phase: "analysis", label: "هموارسازی", data: { window } });
  base.emit("TREND_ESTIMATED", { phase: "analysis", label: "برآورد جهت روند", data: { slope: round(slope), direction } });
  base.emit("CHANGE_POINT_CANDIDATE", { phase: "evaluation", label: "نامزد تغییر برجسته", data: { index: strongestChangeIndex } });
  base.emit("APPLICATION_COMPLETED", { phase: "lifecycle", label: "تحلیل روند پایان یافت" });
  return finishRun(base, { format: "application-pipeline-v1", conceptualOnly: true, application, inputs: { series, window }, result: { smoothed, slope: round(slope), direction, strongestChangeIndex } });
}

function redactSecrets(value, redactions, path = "payload") {
  if (Array.isArray(value)) return value.map((item, index) => redactSecrets(item, redactions, `${path}[${index}]`));
  if (value === null || typeof value !== "object") return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (/token|secret|password|authorization|api[-_]?key/i.test(key)) {
      output[key] = "[REDACTED]";
      redactions.push(childPath);
    } else {
      output[key] = redactSecrets(child, redactions, childPath);
    }
  }
  return output;
}

export function simulateProtocolFlow(config = {}) {
  const input = plainCopy(config);
  const protocol = choice("protocol", input.protocol, PROTOCOLS, "mcp");
  const decision = choice("decision", input.decision ?? input.policy, POLICY_DECISIONS, "ask");
  const risk = choice("risk", input.risk, RISK_LEVELS, "low");
  const approved = input.approved === true;
  const redactions = [];
  const payload = redactSecrets(input.payload ?? input.arguments ?? {}, redactions);
  const identity = { protocol, decision, risk, approved, operation: input.operation, payload };
  const base = eventEmitter(`protocol-${protocol}`, identity);
  let requestEnvelope;

  if (protocol === "mcp") {
    const method = nonEmptyText("operation", input.operation, "tools/call");
    const capability = nonEmptyText("capability", input.capability, "demo.read");
    requestEnvelope = {
      protocol: "MCP",
      protocolVersion: nonEmptyText("protocolVersion", input.protocolVersion, "2026-07-28"),
      transport: "conceptual-json-rpc",
      jsonrpc: "2.0",
      id: `request-${hashText(canonicalJson(identity))}`,
      method,
      params: { capability, arguments: payload },
      dryRun: true,
    };
  } else {
    const method = choice("method", input.method, ["GET", "POST", "PUT", "PATCH", "DELETE"], "POST");
    const path = nonEmptyText("path", input.path, "/v1/demo");
    if (!path.startsWith("/") || path.includes("://") || path.length > 256) throw new RangeError("path must be a bounded relative API path");
    requestEnvelope = {
      protocol: "HTTP API",
      method,
      path,
      headers: { "content-type": "application/json", "x-dry-run": "true" },
      body: payload,
      dryRun: true,
    };
  }

  base.emit("PROTOCOL_REQUEST_PROPOSED", { phase: "proposal", actor: "client-simulator", target: protocol === "mcp" ? "mcp-server-simulator" : "api-simulator", label: "Envelope بی‌اثر ساخته شد", data: { protocol, risk, redactions } });
  base.emit("POLICY_DECIDED", { phase: "policy", actor: "policy-gate", status: decision === "deny" ? "blocked" : decision === "ask" ? "waiting" : "ok", label: decision.toUpperCase(), data: { decision, risk } });

  let status = "denied";
  let responseEnvelope = null;
  if (decision === "ask" && !approved) {
    status = "waiting-approval";
    base.emit("APPROVAL_REQUIRED", { phase: "approval", actor: "policy-gate", target: "human", status: "waiting", label: "تأیید لازم است" });
  } else if (decision === "deny") {
    base.emit("PROTOCOL_REQUEST_BLOCKED", { phase: "policy", actor: "policy-gate", status: "blocked", label: "درخواست رد شد" });
  } else {
    if (decision === "ask") base.emit("APPROVAL_GRANTED", { phase: "approval", actor: "human-simulator", status: "ok", label: "تأیید نمایشی ثبت شد" });
    status = "simulated";
    base.emit("DRY_RUN_DISPATCHED", { phase: "transport", actor: "protocol-simulator", status: "simulated", label: "ارسال فقط شبیه‌سازی شد", detail: "هیچ شبکه، ابزار یا اثر جانبی اجرا نشد." });
    responseEnvelope = protocol === "mcp"
      ? { jsonrpc: "2.0", id: requestEnvelope.id, result: { status: "simulated", effectExecuted: false } }
      : { status: 200, body: { status: "simulated", effectExecuted: false } };
    base.emit("DRY_RUN_RESPONSE_RECEIVED", { phase: "transport", actor: "protocol-simulator", status: "simulated", label: "پاسخ مصنوعی معتبر" });
  }
  base.emit("PROTOCOL_FLOW_COMPLETED", { phase: "lifecycle", status, label: "جریان پروتکل پایان یافت", data: { effectExecuted: false } });

  return finishRun(base, {
    format: "protocol-flow-v1",
    conceptualOnly: true,
    protocol,
    requestEnvelope,
    responseEnvelope,
    policyReceipt: { decision, risk, approved: decision === "ask" ? approved : null, status },
    redactions,
    effectExecuted: false,
  });
}

function vector(name, value, expectedLength = null) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 64) throw new RangeError(`${name} must contain 2 to 64 values`);
  if (expectedLength !== null && value.length !== expectedLength) throw new RangeError(`${name} has an incompatible dimension`);
  return value.map((item, index) => finiteNumber(`${name}[${index}]`, item, undefined, -1e6, 1e6));
}

function dot(first, second) {
  return first.reduce((sum, value, index) => sum + value * second[index], 0);
}

function magnitude(value) {
  return Math.sqrt(dot(value, value));
}

export function simulateAbliteration(config = {}) {
  const input = plainCopy(config);
  const sourceVectors = input.vectors ?? [[0.8, -0.2, 0.6, 0.4], [0.5, 0.3, 0.9, -0.1], [-0.1, 0.4, 0.7, 0.2]];
  if (!Array.isArray(sourceVectors) || sourceVectors.length < 1 || sourceVectors.length > 32) throw new RangeError("vectors must contain 1 to 32 synthetic vectors");
  const first = vector("vectors[0]", sourceVectors[0]);
  const vectors = [first, ...sourceVectors.slice(1).map((item, index) => vector(`vectors[${index + 1}]`, item, first.length))];
  const defaultDirection = first.length === 4
    ? [0.7, 0.1, 0.7, 0]
    : first.map((_, index) => index === 0 ? 1 : 0);
  const rawDirection = vector("direction", input.direction ?? defaultDirection, first.length);
  const directionMagnitude = magnitude(rawDirection);
  if (directionMagnitude <= 1e-12) throw new RangeError("direction must be non-zero");
  const direction = rawDirection.map((value) => value / directionMagnitude);
  const strength = finiteNumber("strength", input.strength, 1, 0, 1);
  const capabilityBaseline = finiteNumber("capabilityBaseline", input.capabilityBaseline, 0.82, 0, 1);
  const safetyBaseline = finiteNumber("safetyBaseline", input.safetyBaseline, 0.91, 0, 1);
  const capabilitySensitivity = finiteNumber("capabilitySensitivity", input.capabilitySensitivity, 0.18, 0, 1);
  const safetySensitivity = finiteNumber("safetySensitivity", input.safetySensitivity, 0.55, 0, 1);
  const identity = { vectors, direction: rawDirection, strength, capabilityBaseline, safetyBaseline, capabilitySensitivity, safetySensitivity };
  const base = eventEmitter("abliteration", identity);
  base.emit("CONTRASTIVE_VECTORS_REGISTERED", { phase: "data", label: "بردارهای مصنوعی ثبت شدند", data: { vectors: vectors.length, dimensions: first.length } });
  base.emit("DIRECTION_NORMALIZED", { phase: "analysis", label: "جهت بازنمایی نرمال شد", data: { magnitude: round(directionMagnitude) } });

  const comparisons = vectors.map((before, index) => {
    const projectionBefore = dot(before, direction);
    const after = before.map((value, dimension) => value - strength * projectionBefore * direction[dimension]);
    const projectionAfter = dot(after, direction);
    const delta = after.map((value, dimension) => value - before[dimension]);
    return {
      id: `synthetic-vector-${index + 1}`,
      before: before.map((value) => round(value)),
      after: after.map((value) => round(value)),
      projectionBefore: round(projectionBefore),
      projectionAfter: round(projectionAfter),
      removedProjection: round(projectionBefore - projectionAfter),
      normDistortion: round(magnitude(delta) / Math.max(magnitude(before), 1e-12)),
    };
  });
  base.emit("SYNTHETIC_PROJECTION_APPLIED", { phase: "edit", status: "simulated", label: "پروجکشن فقط روی آرایه‌های مصنوعی", data: { strength } });

  const meanBefore = average(comparisons.map(({ projectionBefore }) => Math.abs(projectionBefore)));
  const meanAfter = average(comparisons.map(({ projectionAfter }) => Math.abs(projectionAfter)));
  const projectionReduction = meanBefore <= 1e-12 ? 0 : clamp(1 - meanAfter / meanBefore, 0, 1);
  const meanDistortion = average(comparisons.map(({ normDistortion }) => normDistortion));
  const capabilityDrop = clamp(capabilitySensitivity * meanDistortion, 0, capabilityBaseline);
  const safetyDrop = clamp(safetySensitivity * projectionReduction, 0, safetyBaseline);
  const metrics = {
    meanAbsoluteProjectionBefore: round(meanBefore),
    meanAbsoluteProjectionAfter: round(meanAfter),
    projectionReduction: round(projectionReduction),
    meanNormDistortion: round(meanDistortion),
    capability: { before: capabilityBaseline, after: round(capabilityBaseline - capabilityDrop), drop: round(capabilityDrop) },
    safety: { before: safetyBaseline, after: round(safetyBaseline - safetyDrop), drop: round(safetyDrop) },
  };
  base.emit("REGRESSION_ESTIMATED", { phase: "evaluation", status: safetyDrop > 0 ? "warning" : "ok", label: "افت قابلیت و ایمنی برآورد شد", data: metrics });
  base.emit("ABLITERATION_SIMULATION_COMPLETED", { phase: "lifecycle", label: "شبیه‌سازی پایان یافت", detail: "هیچ وزن مدل واقعی خوانده یا تغییر داده نشد." });

  return finishRun(base, {
    format: "abliteration-simulation-v1",
    conceptualOnly: true,
    syntheticOnly: true,
    realWeightsChanged: false,
    direction: direction.map((value) => round(value)),
    strength,
    comparisons,
    metrics,
    syntheticHashes: { before: hashText(canonicalJson(vectors)), after: hashText(canonicalJson(comparisons.map(({ after }) => after))) },
    claimBoundary: "کاهش projection در این هندسهٔ مصنوعی، حذف مفهوم یا اثر علّی در یک مدل واقعی را ثابت نمی‌کند.",
  });
}

function parseMetadata(source) {
  const metadata = {};
  if (!source?.trim()) return metadata;
  const parts = source.split(";").map((item) => item.trim()).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      if (index === 0) metadata.id = part;
      else throw new TypeError(`invalid specimen metadata: ${part}`);
      continue;
    }
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key || !value) throw new TypeError(`invalid specimen metadata: ${part}`);
    metadata[key] = value;
  }
  return metadata;
}

function normalizeSpecimenLine(raw, index, globalProvenance) {
  let tag;
  let text;
  let metadata = {};
  let localProvenance = {};
  let explicitCost;
  if (typeof raw === "string") {
    const match = raw.match(/^\s*(GOAL|CONSTRAINT|DECISION|EVIDENCE|UNKNOWN)(?:\[([^\]]+)\])?\s*:\s*(.+?)\s*$/u);
    if (!match) throw new TypeError(`lines[${index}] must use TAG[metadata]: text syntax`);
    [, tag, , text] = match;
    metadata = parseMetadata(match[2]);
    if (metadata.source) localProvenance.source = metadata.source;
    if (metadata.scope) localProvenance.scope = metadata.scope;
    if (metadata.witness) localProvenance.witnessLayer = metadata.witness;
    if (metadata.witnessLayer) localProvenance.witnessLayer = metadata.witnessLayer;
  } else {
    const item = plainCopy(raw, `lines[${index}]`);
    tag = String(item.tag ?? "").toUpperCase();
    text = item.text;
    metadata = { id: item.id, evidence: item.evidenceRefs?.join(",") };
    localProvenance = item.provenance ?? {};
    if (typeof localProvenance !== "object" || localProvenance === null || Array.isArray(localProvenance)) {
      throw new TypeError(`lines[${index}].provenance must be an object`);
    }
    if (item.source) localProvenance.source = item.source;
    explicitCost = item.cost;
  }
  if (!SPECIMEN_TAGS.includes(tag)) throw new RangeError(`lines[${index}].tag is unsupported`);
  const cleanText = nonEmptyText(`lines[${index}].text`, text);
  const id = nonEmptyText(`lines[${index}].id`, metadata.id, `${tag.toLowerCase()}-${String(index + 1).padStart(3, "0")}`);
  if (!/^[A-Za-z0-9._:-]+$/.test(id)) throw new RangeError(`lines[${index}].id contains unsupported characters`);
  const evidenceText = metadata.evidence ?? metadata.evidenceRefs ?? "";
  const evidenceRefs = [...new Set(String(evidenceText).split(",").map((item) => item.trim()).filter(Boolean))];
  const estimatedCost = explicitCost === undefined
    ? Math.max(1, Math.ceil([...cleanText].length / 4) + 4 + evidenceRefs.length)
    : boundedInteger(`lines[${index}].cost`, explicitCost, undefined, 1, 100000);
  return {
    id,
    index,
    tag,
    text: cleanText,
    evidenceRefs,
    provenance: { ...plainCopy(globalProvenance, "provenance"), ...plainCopy(localProvenance, `lines[${index}].provenance`) },
    estimatedCost,
  };
}

function hasWitnessProvenance(provenance) {
  return ["source", "artifact", "test", "url", "claim"].some((key) => typeof provenance?.[key] === "string" && provenance[key].trim());
}

function witnessesExternalLayer(item, layer) {
  if (item.tag !== "EVIDENCE" || !hasWitnessProvenance(item.provenance)) return false;
  if (String(item.provenance.scope ?? "").toLowerCase() !== "external") return false;
  const witnessedLayers = String(item.provenance.witnessLayer ?? "")
    .toUpperCase()
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return witnessedLayers.includes(layer);
}

export function compileAlefbaSpecimen(config = {}) {
  const input = plainCopy(config);
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 256) throw new RangeError("lines must contain 1 to 256 tagged entries");
  const limit = boundedInteger("budget", input.budget, 1024, 1, 100000);
  const provenance = input.provenance ?? { program: "alef.ba", compiler: "local-deterministic" };
  if (typeof provenance !== "object" || provenance === null || Array.isArray(provenance)) throw new TypeError("provenance must be an object");
  const normalized = input.lines.map((line, index) => normalizeSpecimenLine(line, index, provenance));
  const ids = normalized.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new RangeError("specimen ids must be unique");

  const priority = { GOAL: 100, CONSTRAINT: 95, EVIDENCE: 90, DECISION: 80, UNKNOWN: 60 };
  const ranked = [...normalized].sort((first, second) => priority[second.tag] - priority[first.tag] || first.index - second.index);
  let used = 0;
  const selected = [];
  const omissions = [];
  for (const item of ranked) {
    if (used + item.estimatedCost <= limit) {
      selected.push(item);
      used += item.estimatedCost;
    } else {
      omissions.push({ id: item.id, tag: item.tag, estimatedCost: item.estimatedCost, reason: item.estimatedCost > limit ? "item-exceeds-budget" : "budget-exhausted" });
    }
  }
  selected.sort((first, second) => first.index - second.index);
  omissions.sort((first, second) => ids.indexOf(first.id) - ids.indexOf(second.id));

  const evidenceItems = selected.filter(({ tag }) => tag === "EVIDENCE");
  const validWitnessIds = new Set(evidenceItems.filter(({ provenance: itemProvenance }) => hasWitnessProvenance(itemProvenance)).map(({ id }) => id));
  const enrich = (item) => {
    const resolvedEvidenceRefs = item.evidenceRefs.filter((id) => validWitnessIds.has(id));
    const missingEvidenceRefs = item.evidenceRefs.filter((id) => !validWitnessIds.has(id));
    let supportStatus = "RECORDED";
    if (item.tag === "EVIDENCE") supportStatus = validWitnessIds.has(item.id) ? "WITNESSED" : "UNKNOWN";
    if (item.tag === "DECISION") supportStatus = item.evidenceRefs.length > 0 && missingEvidenceRefs.length === 0 ? "TRACEABLE" : "UNKNOWN";
    if (item.tag === "UNKNOWN") supportStatus = item.evidenceRefs.length > 0 && missingEvidenceRefs.length === 0 ? "EVIDENCED_UNCERTAINTY" : "UNKNOWN";
    return { ...item, resolvedEvidenceRefs, missingEvidenceRefs, supportStatus };
  };
  const compiled = selected.map(enrich);
  const byTag = (tag) => compiled.filter((item) => item.tag === tag);
  const goals = byTag("GOAL");
  const constraints = byTag("CONSTRAINT");
  const decisions = byTag("DECISION");
  const evidence = byTag("EVIDENCE");
  const unknowns = byTag("UNKNOWN");

  const uptakeWitnesses = evidence.filter((item) => witnessesExternalLayer(item, "U"));
  const outcomeWitnesses = evidence.filter((item) => witnessesExternalLayer(item, "O"));
  const receipt = {
    I: {
      label: "Integrity",
      status: "VERIFIED",
      evidenceClass: "LOCAL_STRUCTURAL",
      checks: ["TAG_SCHEMA_VALID", "IDS_UNIQUE", "BUDGET_BALANCED", "OMISSIONS_ACCOUNTED"],
      itemIds: compiled.map(({ id }) => id),
    },
    R: {
      label: "Representation",
      status: "VERIFIED",
      evidenceClass: "LOCAL_STRUCTURAL",
      checks: ["PROVENANCE_PRESERVED", "EVIDENCE_REFS_RESOLVED_OR_MARKED", "SOURCE_ORDER_PRESERVED"],
      itemIds: compiled.map(({ id }) => id),
    },
    U: {
      label: "Uptake",
      status: uptakeWitnesses.length > 0 ? "WITNESSED" : "UNKNOWN",
      evidenceClass: uptakeWitnesses.length > 0 ? "EXTERNAL_WITNESS" : "NONE",
      witnessIds: uptakeWitnesses.map(({ id }) => id),
    },
    O: {
      label: "Outcome",
      status: outcomeWitnesses.length > 0 ? "WITNESSED" : "UNKNOWN",
      evidenceClass: outcomeWitnesses.length > 0 ? "EXTERNAL_WITNESS" : "NONE",
      witnessIds: outcomeWitnesses.map(({ id }) => id),
    },
  };

  return deepFreeze({
    format: "alefba-apir-v1",
    conceptualOnly: true,
    specimenId: `apir-${hashText(canonicalJson({ lines: normalized, limit }))}`,
    provenance: plainCopy(provenance),
    budget: { metric: "estimated-token-units", limit, used, remaining: limit - used },
    omissions,
    apir: { goals, constraints, decisions, evidence, unknowns },
    receipt,
    invariants: {
      outputWithoutWitnessRemainsUnknown: true,
      uptakeWithoutWitnessRemainsUnknown: true,
      internalDecisionCannotWitnessUptakeOrOutcome: true,
      sourceOrderPreservedInsideSections: true,
    },
  });
}

export const RESEARCH_SIMULATION_CAPABILITIES = deepFreeze({
  modalities: [...MODALITIES],
  applications: [...APPLICATIONS],
  protocols: [...PROTOCOLS],
  policyDecisions: [...POLICY_DECISIONS],
  specimenTags: [...SPECIMEN_TAGS],
});
