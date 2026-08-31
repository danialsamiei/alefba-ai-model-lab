import {
  AGENTIC_BY_ID,
  AGENTIC_CATALOG,
  AGENTIC_KIND_LABELS,
  AGENTIC_LAYERS,
} from "./agenticCatalog.js";
import {
  AGENTIC_SCENARIOS,
  FAILURE_INJECTIONS,
  ORCHESTRATION_TOPOLOGIES,
  deriveAgenticSnapshot,
  simulateAgentRun,
} from "./agenticSimulation.js";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const integerFa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
const percentFa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0, style: "percent" });

const KIND_ICON = Object.freeze({ pattern: "⌘", control: "◇", protocol: "⇄", standard: "▣", framework: "⬡", method: "◉" });
const PHASE_STATIONS = Object.freeze([
  ["lifecycle", "دریافت هدف", "01"],
  ["context", "ساخت Context", "02"],
  ["model", "تصمیم مدل", "03"],
  ["orchestration", "هماهنگی", "04"],
  ["approval", "Policy / Approval", "05"],
  ["tool", "اجرای ابزار", "06"],
  ["evaluation", "Verify", "07"],
  ["reliability", "Checkpoint / Stop", "08"],
]);

function optionsFrom(record, selected) {
  return Object.entries(record).map(([id, item]) => `<option value="${id}" ${id === selected ? "selected" : ""}>${escapeHtml(item.label ?? item)}</option>`).join("");
}

export function agenticDialogTemplate() {
  return `
    <dialog id="agentic-dialog" class="modal agentic-modal" aria-labelledby="agentic-heading">
      <header class="modal-header agentic-header">
        <div>
          <span class="eyebrow">AGENTIC MISSION CONTROL · EVENT-SOURCED LAB</span>
          <h2 id="agentic-heading" tabindex="-1">اتاق فرمان سامانه‌های عامل‌محور</h2>
        </div>
        <div class="agentic-header-status">
          <span id="agentic-run-status" class="claim-badge" aria-live="polite">IDLE</span>
          <span id="agentic-simulation-badge" class="simulation-badge">شبیه‌سازی قطعی · بدون اجرای ابزار خارجی</span>
          <button class="close-button" data-close="agentic-dialog" aria-label="بستن آزمایشگاه عامل‌محور">×</button>
        </div>
      </header>
      <div id="agentic-workspace" class="agentic-workspace">
        <aside class="agentic-sidebar" aria-label="تنظیمات و کتابخانهٔ عامل‌محور">
          <section class="agentic-control-block">
            <span class="eyebrow">RUN CONFIGURATION</span>
            <label class="field">سناریو<select id="agentic-scenario">${optionsFrom(AGENTIC_SCENARIOS, "support")}</select></label>
            <label class="field">توپولوژی<select id="agentic-topology">${optionsFrom(ORCHESTRATION_TOPOLOGIES, "supervisor")}</select></label>
            <label class="field">Effort عملیاتی<select id="agentic-effort"><option value="low">کم · یک worker</option><option value="medium" selected>متوسط · دو worker</option><option value="high">زیاد · verifier + چهار worker</option></select></label>
            <label class="field">تزریق خطا<select id="agentic-failure">${optionsFrom(FAILURE_INJECTIONS, "none")}</select></label>
            <label class="field">سیاست تأیید<select id="agentic-policy-profile"><option value="manual" selected>انسان برای ریسک بالا</option><option value="auto-low-risk">خودکار فقط کم‌خطر</option><option value="deny-high-risk">رد همیشگی ریسک بالا</option></select></label>
            <label class="field"><span>بودجهٔ Context <output id="agentic-context-budget-output">۴٬۰۹۶</output></span><input id="agentic-context-budget" type="range" min="1024" max="8192" step="512" value="4096"></label>
            <label class="field">سرعت پخش<select id="agentic-speed"><option value="900">آهسته · آموزشی</option><option value="520" selected>معمولی</option><option value="220">سریع</option></select></label>
          </section>
          <section class="agentic-library-block">
            <div class="section-line"><span class="eyebrow">ENGINEERING INDEX</span><span id="agentic-method-meta">${integerFa.format(AGENTIC_CATALOG.length)} مدخل</span></div>
            <label class="field compact">لایه<select id="agentic-kind-filter"><option value="all">همهٔ لایه‌ها</option>${Object.entries(AGENTIC_LAYERS).map(([id, layer]) => `<option value="${id}">${escapeHtml(layer.label)}</option>`).join("")}</select></label>
            <div id="agentic-method-tree" class="agentic-method-tree" role="listbox" aria-label="مفاهیم عامل‌محور"></div>
          </section>
        </aside>

        <main class="agentic-stage" aria-label="شبیه‌سازی زندهٔ Harness">
          <section class="agentic-hero-grid">
            <div class="harness-vessel">
              <div class="stage-label"><span class="eyebrow">LIVE HARNESS LOOP</span><strong id="agentic-current-event">آماده برای اجرا</strong></div>
              <div id="agentic-harness-loop" class="harness-loop" role="img" aria-label="حلقهٔ هشت مرحله‌ای اجرای عامل">
                <div class="harness-core"><span>HARNESS</span><strong id="agentic-core-state">IDLE</strong><small id="agentic-core-progress">۰ / ۰</small></div>
                ${PHASE_STATIONS.map(([phase, label, number], index) => `<div class="harness-station station-${index + 1}" data-phase="${phase}"><span>${number}</span><strong>${label}</strong></div>`).join("")}
              </div>
              <div id="agentic-policy-gate" class="policy-gate" data-state="idle"><span>POLICY GATE</span><strong>ALLOW / ASK / DENY</strong></div>
            </div>
            <div class="topology-vessel">
              <div class="stage-label"><span class="eyebrow">ORCHESTRATION SWITCHYARD</span><strong id="agentic-topology-title"></strong></div>
              <div id="agentic-dom-topology" class="agentic-topology" role="img" aria-label="توپولوژی جاری هماهنگی"></div>
              <div id="agentic-metric-strip" class="agentic-metric-strip"></div>
            </div>
          </section>

          <section class="context-furnace" aria-labelledby="agentic-context-heading">
            <header><div><span class="eyebrow">CONTEXT FURNACE</span><h3 id="agentic-context-heading">کدام داده واقعاً وارد پنجره شد؟</h3></div><div id="agentic-context-summary" class="mono"></div></header>
            <div id="agentic-context-conveyor" class="context-conveyor"></div>
            <div id="agentic-context-dropped" class="context-dropped"></div>
          </section>

          <section id="agentic-approval-request" class="approval-console" hidden role="alert">
            <div><span class="eyebrow">WAITING_APPROVAL</span><strong>اقدام پرخطر پشت گیت متوقف شده است.</strong><p id="agentic-approval-copy"></p></div>
            <div class="approval-actions"><button id="agentic-approve-once" class="primary">تأیید فقط همین اقدام</button><button id="agentic-deny-action">رد و ادامهٔ امن</button></div>
          </section>

          <section class="agentic-system-slice" aria-labelledby="agentic-slice-heading">
            <header><div><span class="eyebrow">SYSTEM CUTAWAY · RESPONSIBILITY MAP</span><h3 id="agentic-slice-heading">هر لایه دقیقاً مسئول چیست؟</h3></div><small>Policy و Trace روی کل مسیر اثر عرضی دارند.</small></header>
            <div class="system-slice-flow">
              <div class="system-cell" data-phase="lifecycle"><span>01</span><strong>هدف / UI</strong><small>نیت و ورودی انسان</small></div><i>←</i>
              <div class="system-cell" data-phase="context"><span>02</span><strong>Context Builder</strong><small>انتخاب، trust و budget</small></div><i>←</i>
              <div class="system-cell" data-phase="model"><span>03</span><strong>Model</strong><small>پیشنهاد token/action</small></div><i>←</i>
              <div class="system-cell" data-phase="orchestration"><span>04</span><strong>Orchestrator</strong><small>مالکیت task و join</small></div><i>←</i>
              <div class="system-cell" data-phase="approval"><span>05</span><strong>Policy Gate</strong><small>allow / ask / deny</small></div><i>←</i>
              <div class="system-cell" data-phase="tool"><span>06</span><strong>Tool Adapter</strong><small>schema، scope و sandbox</small></div><i>←</i>
              <div class="system-cell" data-phase="reliability"><span>07</span><strong>State / Stop</strong><small>observation و checkpoint</small></div>
            </div>
            <div class="crosscut-rails"><span>POLICY · AUTH · APPROVAL</span><span>TRACE · METRICS · EVAL · REPLAY</span></div>
          </section>
        </main>

        <aside id="agentic-inspector" class="agentic-inspector" aria-label="بازرس رویداد و مستندات">
          <div role="tablist" id="agentic-inspector-tabs" class="agentic-tabs" aria-label="نمای بازرس">
            <button role="tab" aria-selected="true" data-agentic-tab="event">رویداد</button>
            <button role="tab" aria-selected="false" data-agentic-tab="concept">مفهوم</button>
            <button role="tab" aria-selected="false" data-agentic-tab="protocol">پروتکل‌ها</button>
          </div>
          <section id="agentic-panel-event" class="agentic-inspector-panel" role="tabpanel"></section>
          <section id="agentic-panel-concept" class="agentic-inspector-panel" role="tabpanel" hidden></section>
          <section id="agentic-panel-protocol" class="agentic-inspector-panel" role="tabpanel" hidden>
            <span class="eyebrow">INTEROPERABILITY STACK</span><h3>هر قرارداد در کدام مرز است؟</h3>
            <div class="protocol-stack">
              <button class="protocol-layer" data-concept-id="ag-ui"><b>AG-UI</b><span>عامل ↔ رابط زنده</span></button>
              <span>⇅ stream events</span>
              <button class="protocol-layer" data-concept-id="agent-harness"><b>Harness / Orchestrator</b><span>policy، state و loop</span></button>
              <span class="protocol-split">↙ A2A &nbsp;&nbsp;&nbsp; MCP ↘</span>
              <div class="protocol-branches"><button class="protocol-layer" data-concept-id="a2a"><b>A2A</b><span>عامل مستقل</span></button><button class="protocol-layer" data-concept-id="mcp"><b>MCP</b><span>ابزار و منبع</span></button></div>
              <span>⇅ OpenAPI / native adapter</span>
              <div class="protocol-foundation"><b>Service · Data · Tool</b><small>JSON Schema شکل داده · OAuth مجوز · OTel مشاهده</small></div>
            </div>
            <details class="insight" open><summary>ⓘ مکمل‌اند، نه مترادف</summary><div class="insight-body">AG-UI جریان UI، A2A ارتباط عامل‌ها و MCP اتصال میزبان به ابزار/منبع را مدل می‌کنند. هیچ‌کدام به‌تنهایی authorization، sandbox یا صحت نتیجه را تضمین نمی‌کند.</div></details>
          </section>
        </aside>

        <footer class="agentic-timeline-panel">
          <div class="agentic-transport" aria-label="کنترل پخش شبیه‌سازی">
            <button id="agentic-run" class="primary">▶ اجرا</button>
            <button id="agentic-pause">Ⅱ مکث</button>
            <button id="agentic-step">گام بعد</button>
            <button id="agentic-reset">↺ بازنشانی</button>
            <span id="agentic-timeline-count" class="mono" aria-live="polite">۰ / ۰</span>
          </div>
          <div id="agentic-event-timeline" class="agentic-event-timeline" aria-label="خط زمانی رویدادها">
            <div id="agentic-event-list" class="agentic-event-list" role="listbox"></div>
          </div>
        </footer>
      </div>
      <p id="agentic-announcer" class="sr-only" aria-live="polite"></p>
    </dialog>`;
}

function topologyMarkup(run, snapshot) {
  const active = new Set(snapshot.activeWorkers);
  const node = (id, label, role, state = "idle") => `<div class="topology-node ${state}" data-agent="${id}"><span>${role}</span><strong>${label}</strong></div>`;
  const topologies = {
    sequential: `<div class="topology-row">${node("agent-main", "عامل اصلی", "AGENT", active.has("agent-main") ? "active" : "")}</div><div class="task-rail"><i></i><i></i><i></i><i></i></div>`,
    supervisor: `<div class="topology-column">${node("orchestrator", "Supervisor", "CTRL", snapshot.phase === "orchestration" ? "active" : "")}<span class="topology-wire">↓</span><div class="topology-row">${[1, 2, 3].map((id) => node(`worker-${id}`, `Worker ${id}`, `W${id}`, active.has(`worker-${id}`) ? "active" : "")).join("")}</div></div>`,
    parallel: `<div class="topology-column">${node("orchestrator", "Fan-out", "SPLIT", snapshot.phase === "orchestration" ? "active" : "")}<span class="topology-wire">↙ ↓ ↘</span><div class="topology-row">${[1, 2, 3, 4].map((id) => node(`worker-${id}`, `شاخه ${id}`, `P${id}`, active.has(`worker-${id}`) ? "active" : "")).join("")}</div><span class="topology-wire">↘ ↓ ↙</span>${node("join", "Fan-in", "JOIN")}</div>`,
    router: `<div class="topology-column">${node("router", "Router", "ROUTE", snapshot.phase === "orchestration" ? "active" : "")}<span class="topology-wire">↙ ↓ ↘</span><div class="topology-row">${[1, 2, 3].map((id) => node(`worker-${id}`, `متخصص ${id}`, `H${id}`, active.has(`worker-${id}`) ? "active" : "")).join("")}</div></div>`,
    dag: `<div class="dag-grid">${node("worker-1", "A · آماده‌سازی", "01", active.has("worker-1") ? "active" : "")}${node("worker-2", "B · تحلیل", "02", active.has("worker-2") ? "active" : "")}${node("worker-1b", "C · شاهد", "03")}${node("worker-3", "D · ادغام", "04", active.has("worker-3") ? "active" : "")}</div>`,
    debate: `<div class="topology-column"><div class="topology-row">${node("worker-1", "نامزد A", "P1", active.has("worker-1") ? "active" : "")}${node("worker-2", "نامزد B", "P2", active.has("worker-2") ? "active" : "")}</div><span class="topology-wire">نقد متقابل ⇄</span>${node("worker-3", "Verifier", "V", active.has("worker-3") ? "active" : "")}</div>`,
  };
  return `<div class="topology-pattern mono">${escapeHtml(run.topology.pattern)}</div>${topologies[run.topologyId]}`;
}

function eventStatusGlyph(event) {
  if (event.status === "blocked" || event.status === "error") return "×";
  if (event.status === "waiting" || event.status === "warning") return "!";
  return "·";
}

export function createAgenticLab({ dialog, scene, motion = true } = {}) {
  if (!dialog) throw new Error("Agentic dialog is required");
  const $ = (selector) => dialog.querySelector(selector);
  const ui = {
    scenario: $("#agentic-scenario"), topology: $("#agentic-topology"), effort: $("#agentic-effort"),
    failure: $("#agentic-failure"), policy: $("#agentic-policy-profile"), budget: $("#agentic-context-budget"),
    budgetOutput: $("#agentic-context-budget-output"), speed: $("#agentic-speed"), methodTree: $("#agentic-method-tree"),
    methodMeta: $("#agentic-method-meta"), layerFilter: $("#agentic-kind-filter"), eventPanel: $("#agentic-panel-event"),
    conceptPanel: $("#agentic-panel-concept"), timeline: $("#agentic-event-list"), count: $("#agentic-timeline-count"),
    status: $("#agentic-run-status"), current: $("#agentic-current-event"), coreState: $("#agentic-core-state"),
    coreProgress: $("#agentic-core-progress"), context: $("#agentic-context-conveyor"), contextDropped: $("#agentic-context-dropped"),
    contextSummary: $("#agentic-context-summary"), topologyTitle: $("#agentic-topology-title"), topologyMap: $("#agentic-dom-topology"),
    metrics: $("#agentic-metric-strip"), approval: $("#agentic-approval-request"), approvalCopy: $("#agentic-approval-copy"),
    gate: $("#agentic-policy-gate"), announcer: $("#agentic-announcer"),
  };
  const state = { run: null, index: 0, playing: false, timer: null, selectedConcept: "agent-harness", selectedEvent: 0, approvalResolution: null };

  const config = (approved = state.approvalResolution === true) => ({
    scenarioId: ui.scenario.value,
    topologyId: ui.topology.value,
    effort: ui.effort.value,
    failure: ui.failure.value,
    approvalPolicy: ui.policy.value,
    contextBudget: Number(ui.budget.value),
    approved,
  });

  function stop() {
    state.playing = false;
    clearTimeout(state.timer);
    state.timer = null;
    $("#agentic-run").disabled = state.index >= (state.run?.events.length ?? 0);
    $("#agentic-pause").disabled = true;
  }

  function rebuildRun({ preserveIndex = false } = {}) {
    stop();
    const previousIndex = state.index;
    state.run = simulateAgentRun(config());
    state.index = preserveIndex ? Math.min(previousIndex, state.run.events.length) : 0;
    state.selectedEvent = Math.max(0, state.index - 1);
    ui.budgetOutput.textContent = integerFa.format(Number(ui.budget.value));
    renderAll();
  }

  function renderKnowledge() {
    const layer = ui.layerFilter.value;
    const items = AGENTIC_CATALOG.filter((item) => layer === "all" || item.layer === layer);
    ui.methodMeta.textContent = `${integerFa.format(items.length)} از ${integerFa.format(AGENTIC_CATALOG.length)}`;
    ui.methodTree.innerHTML = items.map((item) => `<button role="option" class="agentic-method ${item.id === state.selectedConcept ? "selected" : ""}" data-concept-id="${item.id}" aria-selected="${item.id === state.selectedConcept}"><span class="method-icon" style="color:${AGENTIC_LAYERS[item.layer].color}">${KIND_ICON[item.kind]}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(AGENTIC_KIND_LABELS[item.kind])} · ${escapeHtml(AGENTIC_LAYERS[item.layer].label)}</small></span></button>`).join("");
  }

  function renderConcept(id = state.selectedConcept) {
    const item = AGENTIC_BY_ID.get(id) ?? AGENTIC_CATALOG[0];
    state.selectedConcept = item.id;
    const layer = AGENTIC_LAYERS[item.layer];
    ui.conceptPanel.innerHTML = `
      <div class="concept-dossier"><span class="eyebrow" style="color:${layer.color}">${escapeHtml(layer.icon)} ${escapeHtml(layer.label)}</span><h3>${escapeHtml(item.title)}</h3><p class="concept-subtitle">${escapeHtml(item.subtitle)}</p><span class="kind-badge">${escapeHtml(AGENTIC_KIND_LABELS[item.kind])}</span><p>${escapeHtml(item.summary)}</p>
      <div class="mini-io"><div><small>ورودی</small><strong>${escapeHtml(item.input)}</strong></div><div><small>خروجی</small><strong>${escapeHtml(item.output)}</strong></div></div>
      <h4>فرآیند</h4><ol>${item.process.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <h4>شکست‌های محتمل</h4><ul>${item.failureModes.map((mode) => `<li>${escapeHtml(mode)}</li>`).join("")}</ul>
      <h4>کنترل‌ها</h4><div class="tag-list">${item.controls.map((control) => `<span class="tag">${escapeHtml(control)}</span>`).join("")}</div>
      <div class="detail-actions"><button class="source external-link" data-url="${escapeHtml(item.docs)}">↗ مستند مفصل</button><button class="source external-link" data-url="${escapeHtml(item.source)}">↗ منبع رسمی/علمی</button></div></div>`;
    renderKnowledge();
  }

  function renderEvent(event) {
    if (!event) {
      ui.eventPanel.innerHTML = `<span class="eyebrow">EVENT INSPECTOR</span><h3>هنوز رویدادی اجرا نشده</h3><p>«اجرا» یا «گام بعد» را بزنید. هر مرحله actor، phase، span، budget و تصمیم policy خود را نشان می‌دهد.</p><details class="insight" open><summary>ⓘ چه چیزی نمایش داده نمی‌شود؟</summary><div class="insight-body">این پنل زنجیرهٔ فکر پنهان مدل را نمایش نمی‌دهد؛ فقط state، اقدام، شاهد، تصمیم policy و خلاصهٔ قابل مشاهده ثبت می‌شود.</div></details>`;
      return;
    }
    ui.eventPanel.innerHTML = `
      <span class="eyebrow">EVENT ${String(event.seq).padStart(3, "0")} · ${escapeHtml(event.phase.toUpperCase())}</span><h3>${escapeHtml(event.label)}</h3><p>${escapeHtml(event.detail)}</p>
      <dl class="event-facts"><div><dt>نوع</dt><dd>${escapeHtml(event.type)}</dd></div><div><dt>actor</dt><dd>${escapeHtml(event.actor)}</dd></div><div><dt>target</dt><dd>${escapeHtml(event.target ?? "—")}</dd></div><div><dt>status</dt><dd>${escapeHtml(event.status)}</dd></div><div><dt>tick</dt><dd>${integerFa.format(event.at / 180)}</dd></div><div><dt>token delta</dt><dd>${integerFa.format(event.tokens)}</dd></div></dl>
      <h4>Trace</h4><div class="trace-box mono"><span>${escapeHtml(event.traceId)}</span><span>${escapeHtml(event.parentSpanId ?? "ROOT")} → ${escapeHtml(event.spanId)}</span></div>
      <details class="insight"><summary>ⓘ دادهٔ ساختاری رویداد</summary><div class="insight-body"><pre>${escapeHtml(JSON.stringify(event.data, null, 2))}</pre></div></details>`;
  }

  function renderContext() {
    const { context: compiled } = state.run;
    const colors = { policy: "#b9f227", user: "#62d9ce", tool: "#72a7ff", history: "#9eaaa1", retrieval: "#f39a53", memory: "#d6a6ff" };
    const freeInput = Math.max(0, compiled.budget - compiled.used);
    ui.context.innerHTML = `<div class="context-limit" style="inset-inline-start:${Math.min(100, (compiled.budget / compiled.window) * 100)}%"><span>INPUT LIMIT</span></div>${compiled.selected.map((source) => {
      const width = Math.max(3, (source.includedTokens / compiled.window) * 100);
      return `<button class="context-cartridge ${source.state}" style="--segment:${colors[source.kind] ?? "#ffd166"};width:${width}%" title="${escapeHtml(source.label)}: ${integerFa.format(source.includedTokens)} token"><strong>${escapeHtml(source.label)}</strong><span>${integerFa.format(source.includedTokens)}</span><small>${escapeHtml(source.kind)} · trust ${Math.round(source.trust * 100)}%</small></button>`;
    }).join("")}<div class="context-reserve free" style="width:${(freeInput / compiled.window) * 100}%"><span>INPUT FREE ${integerFa.format(freeInput)}</span></div><div class="context-reserve schema" style="width:${(compiled.reserves.toolSchema / compiled.window) * 100}%"><span>SCHEMA ${integerFa.format(compiled.reserves.toolSchema)}</span></div><div class="context-reserve safety" style="width:${(compiled.reserves.safety / compiled.window) * 100}%"><span>SAFE ${integerFa.format(compiled.reserves.safety)}</span></div><div class="context-reserve output" style="width:${(compiled.reserves.output / compiled.window) * 100}%"><span>OUTPUT ${integerFa.format(compiled.reserves.output)}</span></div>`;
    const compacted = compiled.selected.filter((source) => source.state === "compacted").length;
    ui.contextDropped.innerHTML = compiled.dropped.length ? `<span>خارج از Context:</span>${compiled.dropped.map((source) => `<span class="dropped-chip">${escapeHtml(source.label)} · ${escapeHtml(source.reason)}</span>`).join("")}` : `<span class="safe-copy">همهٔ منابع لازم وارد شدند${compacted ? `؛ ${integerFa.format(compacted)} منبع با ثبت اتلاف فشرده شد` : ""}.</span>`;
    ui.contextSummary.textContent = `${integerFa.format(compiled.used)} / ${integerFa.format(compiled.budget)} input · پنجره ${integerFa.format(compiled.window)}`;
  }

  function renderTimeline(snapshot) {
    ui.timeline.innerHTML = state.run.events.map((event, index) => {
      const visible = index < snapshot.index;
      const selected = index === state.selectedEvent;
      return `<button role="option" class="timeline-event ${visible ? "visible" : "future"} ${selected ? "selected" : ""} status-${event.status}" data-event-index="${index}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}"><span>${String(event.seq).padStart(2, "0")}</span><b>${eventStatusGlyph(event)}</b><small>${escapeHtml(event.type.replaceAll("_", " "))}</small></button>`;
    }).join("");
    ui.count.textContent = `${integerFa.format(snapshot.index)} / ${integerFa.format(snapshot.total)}`;
    const selectedButton = ui.timeline.querySelector(`[data-event-index="${state.selectedEvent}"]`);
    if (state.playing && selectedButton && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) selectedButton.scrollIntoView({ block: "nearest", inline: "end", behavior: "smooth" });
  }

  function renderMetrics(snapshot) {
    const visible = snapshot.visibleEvents;
    const tools = visible.filter((event) => event.type === "TOOL_STARTED").length;
    const retries = visible.filter((event) => event.type === "TOOL_RETRY").length;
    const blocked = visible.filter((event) => ["GUARDRAIL_BLOCKED", "APPROVAL_DENIED"].includes(event.type)).length;
    const workerCount = new Set(visible.filter((event) => event.type === "TASK_DISPATCHED").map((event) => event.target)).size;
    ui.metrics.innerHTML = [["EVENT", snapshot.index], ["WORKER", workerCount], ["TOOL", tools], ["RETRY", retries], ["BLOCK", blocked]].map(([label, value]) => `<div><small>${label}</small><strong>${integerFa.format(value)}</strong></div>`).join("");
  }

  function renderAll() {
    const snapshot = deriveAgenticSnapshot(state.run, state.index);
    const last = snapshot.last;
    const phase = last?.phase ?? "idle";
    ui.status.textContent = snapshot.terminal ? "COMPLETED" : state.playing ? "RUNNING" : snapshot.index ? "PAUSED" : "IDLE";
    ui.status.dataset.status = snapshot.status;
    ui.current.textContent = last ? `${String(last.seq).padStart(2, "0")} · ${last.label}` : "آماده برای اجرا";
    ui.coreState.textContent = phase.toUpperCase();
    ui.coreProgress.textContent = `${integerFa.format(snapshot.index)} / ${integerFa.format(snapshot.total)}`;
    dialog.querySelectorAll(".harness-station").forEach((station) => station.classList.toggle("active", station.dataset.phase === phase));
    dialog.querySelectorAll(".system-cell").forEach((cell) => cell.classList.toggle("active", cell.dataset.phase === phase));
    ui.gate.dataset.state = last?.type === "APPROVAL_REQUIRED" ? "ask" : ["APPROVAL_DENIED", "GUARDRAIL_BLOCKED"].includes(last?.type) ? "deny" : last?.type === "APPROVAL_GRANTED" ? "allow" : "idle";
    ui.topologyTitle.textContent = `${state.run.topology.label} · ${state.run.topology.pattern}`;
    ui.topologyMap.innerHTML = topologyMarkup(state.run, snapshot);
    renderContext();
    renderMetrics(snapshot);
    renderTimeline(snapshot);
    renderEvent(state.run.events[state.selectedEvent] && state.selectedEvent < snapshot.index ? state.run.events[state.selectedEvent] : last);
    const waitingApproval = last?.type === "APPROVAL_REQUIRED" && state.approvalResolution === null;
    ui.approval.hidden = !waitingApproval;
    if (waitingApproval) {
      ui.approvalCopy.textContent = `${last.detail} · ریسک ${last.risk}. این تصمیم فقط eventهای شبیه‌سازی را تغییر می‌دهد.`;
      stop();
      ui.status.textContent = "WAITING APPROVAL";
    }
    $("#agentic-pause").disabled = !state.playing;
    $("#agentic-run").disabled = state.playing || snapshot.terminal || waitingApproval;
    scene?.applyAgenticFrame?.({ phase, status: snapshot.status, progress: snapshot.progress, activeWorkers: snapshot.activeWorkers.length, blocked: ui.gate.dataset.state === "deny" });
  }

  function advance() {
    if (state.index >= state.run.events.length) {
      stop();
      renderAll();
      return;
    }
    const current = state.run.events[state.index - 1];
    if (current?.type === "APPROVAL_REQUIRED" && state.approvalResolution === null) {
      stop();
      renderAll();
      return;
    }
    state.index += 1;
    state.selectedEvent = state.index - 1;
    renderAll();
    const nextLast = state.run.events[state.index - 1];
    if (["APPROVAL_REQUIRED", "RUN_COMPLETED"].includes(nextLast?.type)) stop();
  }

  function schedule() {
    if (!state.playing) return;
    state.timer = setTimeout(() => {
      advance();
      if (state.playing) schedule();
    }, Number(ui.speed.value));
  }

  function play() {
    if (state.index >= state.run.events.length) return;
    state.playing = true;
    $("#agentic-run").disabled = true;
    $("#agentic-pause").disabled = false;
    advance();
    if (state.playing) schedule();
  }

  function resolveApproval(approved) {
    const oldIndex = state.index;
    state.approvalResolution = approved;
    state.run = simulateAgentRun(config(approved));
    state.index = Math.min(oldIndex, state.run.events.length);
    state.selectedEvent = Math.max(0, state.index - 1);
    ui.approval.hidden = true;
    ui.announcer.textContent = approved ? "اقدام برای همین شبیه‌سازی تأیید شد." : "اقدام رد و مسیر امن انتخاب شد.";
    renderAll();
  }

  dialog.addEventListener("click", (event) => {
    const concept = event.target.closest("[data-concept-id]");
    if (concept) {
      renderConcept(concept.dataset.conceptId);
      selectTab("concept");
    }
    const eventButton = event.target.closest("[data-event-index]");
    if (eventButton) {
      const index = Number(eventButton.dataset.eventIndex);
      if (index < state.index) {
        state.selectedEvent = index;
        renderTimeline(deriveAgenticSnapshot(state.run, state.index));
        renderEvent(state.run.events[index]);
        selectTab("event");
      }
    }
    const tab = event.target.closest("[data-agentic-tab]");
    if (tab) selectTab(tab.dataset.agenticTab);
  });

  function selectTab(id) {
    dialog.querySelectorAll("[data-agentic-tab]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.agenticTab === id)));
    for (const panel of dialog.querySelectorAll(".agentic-inspector-panel")) panel.hidden = panel.id !== `agentic-panel-${id}`;
  }

  dialog.querySelector("#agentic-run").addEventListener("click", play);
  dialog.querySelector("#agentic-pause").addEventListener("click", () => { stop(); renderAll(); });
  dialog.querySelector("#agentic-step").addEventListener("click", () => { stop(); advance(); });
  dialog.querySelector("#agentic-reset").addEventListener("click", () => { state.approvalResolution = null; rebuildRun(); });
  dialog.querySelector("#agentic-approve-once").addEventListener("click", () => resolveApproval(true));
  dialog.querySelector("#agentic-deny-action").addEventListener("click", () => resolveApproval(false));
  ui.layerFilter.addEventListener("change", renderKnowledge);
  for (const control of [ui.scenario, ui.topology, ui.effort, ui.failure, ui.policy, ui.budget]) control.addEventListener("input", () => { state.approvalResolution = null; rebuildRun(); });
  ui.timeline.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const max = Math.max(0, state.index - 1);
    if (event.key === "Home") state.selectedEvent = 0;
    else if (event.key === "End") state.selectedEvent = max;
    else state.selectedEvent = Math.max(0, Math.min(max, state.selectedEvent + (event.key === "ArrowLeft" ? 1 : -1)));
    renderTimeline(deriveAgenticSnapshot(state.run, state.index));
    renderEvent(state.run.events[state.selectedEvent]);
    ui.timeline.querySelector(`[data-event-index="${state.selectedEvent}"]`)?.focus();
  });

  dialog.addEventListener("close", stop);
  renderKnowledge();
  renderConcept();
  rebuildRun();
  if (!motion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) ui.speed.value = "900";

  return Object.freeze({
    open() {
      scene?.setExhibit?.("agentic");
      if (!dialog.open) dialog.showModal();
      dialog.querySelector("#agentic-heading")?.focus();
      renderAll();
    },
    close: stop,
    reset: rebuildRun,
  });
}
