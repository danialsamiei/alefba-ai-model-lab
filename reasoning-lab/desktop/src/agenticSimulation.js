const freezeList = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

export const AGENTIC_SCENARIOS = Object.freeze({
  support: Object.freeze({
    label: "پشتیبانی و بازپرداخت", goal: "علت دوبار محاسبه‌شدن مبلغ را بررسی و در صورت احراز، بازپرداخت پیشنهاد کن.",
    sources: [
      { id: "policy", label: "سیاست بازپرداخت", tokens: 760, trust: 1, priority: 100, kind: "policy" },
      { id: "ticket", label: "تیکت کاربر", tokens: 430, trust: 0.85, priority: 88, kind: "user" },
      { id: "orders", label: "سوابق سفارش", tokens: 980, trust: 0.95, priority: 92, kind: "tool" },
      { id: "history", label: "تاریخچهٔ گفتگو", tokens: 1350, trust: 0.75, priority: 64, kind: "history" },
      { id: "kb", label: "راهنمای عمومی", tokens: 1550, trust: 0.8, priority: 58, kind: "retrieval" },
    ],
    tasks: ["خواندن سیاست", "بررسی تراکنش", "تطبیق مبلغ", "ساخت پاسخ"],
    tool: { name: "refund.create", risk: "high", effect: "ثبت بازپرداخت شبیه‌سازی‌شده" },
    answer: "دو ثبت هم‌مبلغ شناسایی شد؛ درخواست بازپرداخت فقط پس از تأیید انسان مجاز است.",
  }),
  research: Object.freeze({
    label: "پژوهش چندمنبعی", goal: "سه رویکرد عامل‌محور را با شاهد و محدودیت مقایسه کن.",
    sources: [
      { id: "question", label: "پرسش پژوهش", tokens: 300, trust: 1, priority: 100, kind: "user" },
      { id: "papers", label: "مقاله‌های بازیابی‌شده", tokens: 3600, trust: 0.88, priority: 90, kind: "retrieval" },
      { id: "specs", label: "استانداردها", tokens: 2100, trust: 0.98, priority: 94, kind: "policy" },
      { id: "notes", label: "یادداشت‌های قبلی", tokens: 900, trust: 0.65, priority: 52, kind: "memory" },
    ],
    tasks: ["استخراج شواهد", "مقایسهٔ معماری", "نقد محدودیت‌ها", "راستی‌آزمایی ارجاع"],
    tool: { name: "corpus.search", risk: "low", effect: "خواندن نمایشی corpus" },
    answer: "مقایسه با تفکیک پروتکل، فریم‌ورک و الگوی طراحی و با ارجاع به منبع تهیه شد.",
  }),
  coding: Object.freeze({
    label: "تغییر کد در Sandbox", goal: "یک نقص کوچک را پیدا، patch و با آزمون تأیید کن.",
    sources: [
      { id: "task", label: "قرارداد تغییر", tokens: 420, trust: 1, priority: 100, kind: "user" },
      { id: "repo", label: "فایل‌های مرتبط", tokens: 2800, trust: 0.95, priority: 95, kind: "tool" },
      { id: "guide", label: "راهنمای مخزن", tokens: 1050, trust: 1, priority: 99, kind: "policy" },
      { id: "logs", label: "خروجی تست قبلی", tokens: 900, trust: 0.8, priority: 70, kind: "history" },
    ],
    tasks: ["بازسازی خطا", "یافتن علت", "ساخت patch", "اجرای تست"],
    tool: { name: "sandbox.patch", risk: "medium", effect: "ویرایش فقط در sandbox فرضی" },
    answer: "Patch در محیط آزمایش اعمال شد و تست قرارداد عبور کرد؛ هیچ فایل واقعی تغییر نکرد.",
  }),
  incident: Object.freeze({
    label: "پاسخ به رخداد", goal: "رخداد افزایش خطا را triage و اقدام امن پیشنهاد کن.",
    sources: [
      { id: "runbook", label: "Runbook", tokens: 1700, trust: 1, priority: 100, kind: "policy" },
      { id: "alerts", label: "هشدارها", tokens: 1300, trust: 0.92, priority: 94, kind: "tool" },
      { id: "traces", label: "Traceها", tokens: 2500, trust: 0.9, priority: 90, kind: "tool" },
      { id: "chat", label: "گفتگوی تیم", tokens: 1200, trust: 0.62, priority: 48, kind: "history" },
    ],
    tasks: ["تعیین شدت", "هم‌بسته‌سازی trace", "انتخاب runbook", "پیشنهاد مهار"],
    tool: { name: "service.rollback", risk: "critical", effect: "rollback شبیه‌سازی‌شدهٔ سرویس" },
    answer: "ریشهٔ محتمل جدا شد؛ rollback فقط به‌صورت پیشنهاد متوقف‌شده پشت گیت انسانی باقی ماند.",
  }),
  injection: Object.freeze({
    label: "حملهٔ Prompt Injection", goal: "اسناد را خلاصه کن، بدون اجرای دستور داخل سند.",
    sources: [
      { id: "system", label: "سیاست سیستم", tokens: 650, trust: 1, priority: 100, kind: "policy" },
      { id: "request", label: "درخواست کاربر", tokens: 260, trust: 0.9, priority: 90, kind: "user" },
      { id: "poison", label: "سند آلودهٔ بازیابی‌شده", tokens: 1900, trust: 0.25, priority: 82, kind: "retrieval", poisoned: true },
      { id: "safe", label: "سند مرجع سالم", tokens: 1600, trust: 0.92, priority: 86, kind: "retrieval" },
    ],
    tasks: ["برچسب‌گذاری منبع", "تشخیص دستور در داده", "مسدودسازی اثر", "خلاصهٔ محتوای سالم"],
    tool: { name: "secrets.export", risk: "critical", effect: "درخواست مخرب و مسدودشده" },
    answer: "دستور نهفته در سند به‌عنوان دادهٔ غیرقابل اعتماد مسدود و فقط محتوای سالم خلاصه شد.",
  }),
});

export const ORCHESTRATION_TOPOLOGIES = Object.freeze({
  sequential: { label: "زنجیرهٔ ترتیبی", workers: 1, pattern: "A → B → C" },
  supervisor: { label: "Supervisor / Workers", workers: 3, pattern: "S → {W₁,W₂,W₃} → S" },
  parallel: { label: "Fan-out / Fan-in", workers: 4, pattern: "⊙ → [A ∥ B ∥ C] → ⊕" },
  router: { label: "Router + Handoff", workers: 3, pattern: "R ⇢ specialist" },
  dag: { label: "Workflow DAG", workers: 3, pattern: "A → {B,C} → D" },
  debate: { label: "Debate + Verifier", workers: 3, pattern: "P₁ ↔ P₂ → V" },
});

export const FAILURE_INJECTIONS = Object.freeze({
  none: "بدون خطای تزریقی",
  timeout: "Timeout ابزار",
  rateLimit: "Rate limit و retry",
  malformed: "خروجی ساختاری نامعتبر",
  worker: "شکست یک Worker",
  overflow: "سرریز Context",
});

const hashText = (text) => {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

function createEmitter(runId) {
  const events = [];
  const traceId = `trace-${hashText(runId).toString(16).padStart(8, "0")}`;
  const emit = (type, spec = {}) => {
    const seq = events.length + 1;
    const event = Object.freeze({
      seq,
      at: seq * 180,
      type,
      actor: spec.actor ?? "harness",
      target: spec.target ?? null,
      phase: spec.phase ?? "runtime",
      status: spec.status ?? "ok",
      label: spec.label ?? type,
      detail: spec.detail ?? "",
      tokens: spec.tokens ?? 0,
      risk: spec.risk ?? "none",
      traceId,
      spanId: `span-${String(seq).padStart(3, "0")}`,
      parentSpanId: spec.parentSpanId ?? (seq === 1 ? null : "span-001"),
      data: Object.freeze(spec.data ?? {}),
    });
    events.push(event);
    return event;
  };
  return { events, emit, traceId };
}

function compileContext(scenario, budget, emit) {
  emit("CONTEXT_BUILD_STARTED", { phase: "context", label: "کامپایل Context", detail: "منابع با نوع، اعتماد و اولویت وارد صف شدند." });
  const ranked = [...scenario.sources]
    .map((source) => ({ ...source, score: source.priority * 0.72 + source.trust * 28 }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const selected = [];
  const dropped = [];
  let used = 0;
  for (const source of ranked) {
    const remaining = budget - used;
    if (remaining <= 0) {
      dropped.push({ ...source, reason: "budget-exhausted" });
      continue;
    }
    if (source.poisoned) {
      selected.push({ ...source, includedTokens: Math.min(120, remaining), state: "quarantined" });
      used += Math.min(120, remaining);
      emit("CONTEXT_SOURCE_QUARANTINED", { phase: "context", status: "blocked", label: source.label, detail: "دستور نهفته از داده جدا و منبع قرنطینه شد.", tokens: Math.min(120, remaining), risk: "critical", data: { sourceId: source.id } });
      continue;
    }
    const protectedSource = source.kind === "policy" || source.kind === "user";
    const allocation = Math.min(source.tokens, remaining);
    if (allocation < source.tokens && protectedSource && allocation < Math.min(220, source.tokens)) {
      dropped.push({ ...source, reason: "protected-source-does-not-fit" });
      continue;
    }
    selected.push({ ...source, includedTokens: allocation, state: allocation < source.tokens ? "compacted" : "full" });
    used += allocation;
    emit(allocation < source.tokens ? "CONTEXT_SOURCE_COMPACTED" : "CONTEXT_SOURCE_ADDED", {
      phase: "context", label: source.label,
      detail: allocation < source.tokens ? `${source.tokens - allocation} token با ثبت اتلاف حذف شد.` : "منبع کامل با provenance افزوده شد.",
      tokens: allocation, data: { sourceId: source.id, trust: source.trust, kind: source.kind },
    });
  }
  for (const source of dropped) emit("CONTEXT_SOURCE_DROPPED", { phase: "context", status: "warning", label: source.label, detail: "به علت سقف Context وارد prompt نشد.", data: { sourceId: source.id, reason: source.reason } });
  emit("CONTEXT_BUILD_COMPLETED", { phase: "context", label: "Context آماده شد", detail: `${used} از ${budget} token استفاده شد.`, tokens: used, data: { used, budget } });
  return Object.freeze({ budget, used, selected: freezeList(selected), dropped: freezeList(dropped) });
}

function dispatchTasks({ scenario, topologyId, effort, emit }) {
  const topology = ORCHESTRATION_TOPOLOGIES[topologyId];
  const workerCount = Math.min(topology.workers, effort === "low" ? 1 : effort === "medium" ? 2 : 4);
  emit("PLAN_CREATED", { phase: "orchestration", actor: "planner", label: "طرح نسخهٔ ۱", detail: `${scenario.tasks.length} task با توپولوژی ${topology.label}.`, data: { topologyId, workerCount } });
  const taskEvents = [];
  scenario.tasks.forEach((task, index) => {
    const worker = topologyId === "sequential" ? "agent-main" : `worker-${(index % workerCount) + 1}`;
    taskEvents.push(emit("TASK_DISPATCHED", { phase: "orchestration", actor: "orchestrator", target: worker, label: task, detail: `مالکیت task به ${worker} واگذار شد.`, data: { taskIndex: index } }));
    taskEvents.push(emit("WORKER_RESULT", { phase: "orchestration", actor: worker, target: "orchestrator", label: `${task} / نتیجه`, detail: "خروجی ساختاری همراه شاهد تحویل شد.", data: { taskIndex: index } }));
  });
  if (workerCount > 1) emit("FAN_IN_COMPLETED", { phase: "orchestration", actor: "orchestrator", label: "Join نتایج", detail: `نتیجهٔ ${scenario.tasks.length} task پس از تکمیل همهٔ شاخه‌ها ادغام شد.`, data: { joined: scenario.tasks.length } });
  return taskEvents;
}

export function simulateAgentRun(options = {}) {
  const scenarioId = AGENTIC_SCENARIOS[options.scenarioId] ? options.scenarioId : "support";
  const topologyId = ORCHESTRATION_TOPOLOGIES[options.topologyId] ? options.topologyId : "supervisor";
  const failure = FAILURE_INJECTIONS[options.failure] ? options.failure : "none";
  const effort = ["low", "medium", "high"].includes(options.effort) ? options.effort : "medium";
  const contextWindow = Math.max(1024, Math.min(16384, Math.round(Number(options.contextBudget) || 4096)));
  const reserves = Object.freeze({
    output: Math.max(256, Math.min(1024, Math.round(contextWindow * 0.125))),
    toolSchema: contextWindow >= 2048 ? 256 : 128,
    safety: contextWindow >= 2048 ? 128 : 64,
  });
  const contextBudget = Math.max(512, contextWindow - reserves.output - reserves.toolSchema - reserves.safety);
  const approvalPolicy = ["manual", "auto-low-risk", "deny-high-risk"].includes(options.approvalPolicy) ? options.approvalPolicy : "manual";
  const approved = options.approved === true;
  const scenario = AGENTIC_SCENARIOS[scenarioId];
  const runId = `run-${hashText(`${scenarioId}|${topologyId}|${effort}|${contextBudget}|${failure}|${approvalPolicy}|${approved}`).toString(16).padStart(8, "0")}`;
  const { events, emit, traceId } = createEmitter(runId);
  emit("RUN_STARTED", { phase: "lifecycle", label: "Run آغاز شد", detail: scenario.goal, data: { scenarioId, topologyId, effort } });
  const compiledContext = compileContext(scenario, contextBudget, emit);
  const context = Object.freeze({ ...compiledContext, window: contextWindow, reserves });
  emit("MODEL_REQUEST", { phase: "model", actor: "harness", target: "model", label: "درخواست مدل", detail: "فقط context کامپایل‌شده و registry ابزار مجاز ارسال شد.", tokens: context.used });
  dispatchTasks({ scenario, topologyId, effort, emit });

  if (failure === "worker") {
    emit("WORKER_FAILED", { phase: "orchestration", actor: "worker-2", target: "orchestrator", status: "error", label: "Worker شکست خورد", detail: "شاخهٔ ناموفق حذف و خروجی به‌صورت ناقص علامت‌گذاری شد." });
  }
  if (failure === "malformed") {
    emit("OUTPUT_REJECTED", { phase: "harness", actor: "validator", status: "error", label: "Schema نامعتبر", detail: "خروجی مدل parse نشد؛ یک درخواست اصلاح محدود ساخته شد." });
    emit("MODEL_REPAIR_REQUEST", { phase: "model", actor: "harness", target: "model", label: "اصلاح ساختاری", detail: "محتوا تغییر نکرد؛ فقط قرارداد خروجی دوباره اعمال شد." });
  }

  emit("TOOL_PROPOSED", { phase: "tool", actor: "model", target: scenario.tool.name, label: scenario.tool.name, detail: scenario.tool.effect, risk: scenario.tool.risk, data: { argumentsHash: hashText(scenario.goal).toString(16) } });
  const isHighRisk = ["high", "critical"].includes(scenario.tool.risk);
  const isInjection = scenarioId === "injection";
  let terminalStatus = "completed";
  let blocked = false;

  if (isInjection) {
    emit("GUARDRAIL_BLOCKED", { phase: "safety", actor: "policy-gate", target: scenario.tool.name, status: "blocked", label: "Prompt injection مسدود شد", detail: "دستور داخل سند مجوز ابزار ایجاد نمی‌کند.", risk: "critical" });
    blocked = true;
  } else if (isHighRisk) {
    emit("APPROVAL_REQUIRED", { phase: "approval", actor: "policy-gate", target: "human", status: "waiting", label: "تأیید انسانی لازم است", detail: scenario.tool.effect, risk: scenario.tool.risk });
    if (approvalPolicy === "deny-high-risk" || !approved) {
      emit("APPROVAL_DENIED", { phase: "approval", actor: "human-simulator", target: scenario.tool.name, status: "blocked", label: approved ? "سیاست رد کرد" : "تأیید داده نشد", detail: "Run بدون اجرای اثر جانبی ادامه می‌یابد.", risk: scenario.tool.risk });
      blocked = true;
    } else {
      emit("APPROVAL_GRANTED", { phase: "approval", actor: "human-simulator", target: scenario.tool.name, label: "تأیید ثبت شد", detail: "همان proposal غیرقابل تغییر برای اجرا آزاد شد.", risk: scenario.tool.risk });
    }
  }

  if (!blocked) {
    emit("TOOL_STARTED", { phase: "tool", actor: "tool-runner", target: scenario.tool.name, label: "ابزار در sandbox", detail: "این اجرای آموزشی فقط event تولید می‌کند و هیچ اثر خارجی ندارد.", risk: scenario.tool.risk });
    if (failure === "timeout" || failure === "rateLimit") {
      emit(failure === "timeout" ? "TOOL_TIMEOUT" : "TOOL_RATE_LIMITED", { phase: "tool", actor: "tool-runner", target: scenario.tool.name, status: "warning", label: FAILURE_INJECTIONS[failure], detail: "خطا موقت طبقه‌بندی و retry budget بررسی شد." });
      emit("TOOL_RETRY", { phase: "tool", actor: "harness", target: scenario.tool.name, label: "Retry ۱ از ۲", detail: "backoff قطعی ۴۰۰ms؛ کلید idempotency ثابت ماند.", data: { attempt: 2, maxAttempts: 2 } });
    }
    emit("TOOL_RESULT", { phase: "tool", actor: "tool-runner", target: "harness", label: "Observation معتبر", detail: "نتیجهٔ نمایشی با schema و provenance به state بازگشت.", risk: scenario.tool.risk });
  }

  if (failure === "overflow") emit("BUDGET_LIMIT_REACHED", { phase: "context", actor: "budget-controller", status: "warning", label: "سقف Context", detail: "منابع کم‌اولویت حذف شدند؛ policy و هدف محافظت شدند.", data: { budget: contextBudget } });
  emit("CHECKPOINT_SAVED", { phase: "reliability", actor: "state-store", label: "Checkpoint", detail: "state و sequence رویداد برای resume ذخیرهٔ نمایشی شد." });
  if (effort === "high") emit("VERIFIER_RESULT", { phase: "evaluation", actor: "verifier", target: "harness", label: "بازبین مستقل", detail: "پوشش شاهد و رعایت گیت‌ها پذیرفته شد؛ صحت جهان بیرون ادعا نمی‌شود." });
  emit("RUN_COMPLETED", { phase: "lifecycle", actor: "harness", status: terminalStatus, label: blocked ? "Run امن پایان یافت" : "Run تکمیل شد", detail: scenario.answer, data: { sideEffectExecuted: !blocked, conceptualOnly: true } });

  const metrics = Object.freeze({
    steps: events.length,
    contextUsed: context.used,
    contextBudget,
    contextWindow,
    toolCalls: events.filter((event) => event.type === "TOOL_STARTED").length,
    retries: events.filter((event) => event.type === "TOOL_RETRY").length,
    workers: new Set(events.filter((event) => event.type === "TASK_DISPATCHED").map((event) => event.target)).size,
    blockedActions: events.filter((event) => ["GUARDRAIL_BLOCKED", "APPROVAL_DENIED"].includes(event.type)).length,
  });
  return Object.freeze({
    runId, traceId, status: terminalStatus, scenarioId, topologyId, effort, failure, approvalPolicy,
    conceptualOnly: true, scenario, topology: ORCHESTRATION_TOPOLOGIES[topologyId], context,
    events: Object.freeze(events), metrics, final: scenario.answer,
  });
}

export function deriveAgenticSnapshot(run, visibleEventCount = run.events.length) {
  const count = Math.max(0, Math.min(run.events.length, Math.trunc(visibleEventCount)));
  const events = run.events.slice(0, count);
  const last = events.at(-1) ?? null;
  const terminal = last?.type === "RUN_COMPLETED";
  const activeWorkers = new Set();
  for (const event of events) {
    if (event.type === "TASK_DISPATCHED") activeWorkers.add(event.target);
    if (event.type === "WORKER_RESULT" || event.type === "WORKER_FAILED") activeWorkers.delete(event.actor);
  }
  return Object.freeze({
    index: count,
    total: run.events.length,
    progress: run.events.length ? count / run.events.length : 0,
    last,
    terminal,
    activeWorkers: Object.freeze([...activeWorkers]),
    visibleEvents: Object.freeze(events),
    phase: last?.phase ?? "idle",
    status: last?.status ?? "idle",
  });
}
