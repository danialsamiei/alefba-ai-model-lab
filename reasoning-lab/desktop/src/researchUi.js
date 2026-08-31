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
} from "./researchCatalog.js";
import {
  simulateLearningLifecycle,
  simulateApplicationPipeline,
  simulateProtocolFlow,
  simulateAbliteration,
  compileAlefbaSpecimen,
} from "./researchSimulation.js";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const numberFa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
const percentFa = new Intl.NumberFormat("fa-IR", { style: "percent", maximumFractionDigits: 0 });
const asArray = (value) => Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : [];
const textOf = (item, ...keys) => {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], item);
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "boolean" || typeof value === "number") return String(value);
  }
  return "—";
};
const idOf = (item, fallback) => item?.id ?? item?.key ?? fallback;
const titleOf = (item) => textOf(item, "titleFa", "title.fa", "names.fa", "labelFa", "label", "title", "name");
const summaryOf = (item) => textOf(item, "summaryFa", "summary.fa", "descriptionFa", "description", "bodyFa", "body", "summary", "outcomeFa", "mechanismFa", "contentsFa", "roleFa", "explanationFa", "guardrailFa", "boundaryFa", "inputFa", "definitionFa", "textFa");
const firstUrl = (item) => {
  const direct = [item?.docs, item?.source, item?.repo, item?.paper, item?.url, item?.primarySource];
  const nested = asArray(item?.sources ?? item?.primarySources ?? item?.primaryDocs).map((source) => typeof source === "string" ? source : source?.url);
  return [...direct, ...nested].find((value) => typeof value === "string" && /^https:\/\//i.test(value)) ?? "";
};

const STATUS_COPY = Object.freeze({
  documented: "واقعیت مستند",
  "source-backed": "واقعیت مستند",
  public_evidence: "واقعیت مستند",
  "public-evidence": "واقعیت مستند",
  simulated: "شبیه‌سازی قطعی",
  conceptual: "مدل مفهومی",
  proprietary: "اختصاصی / ناشناخته",
  unknown: "نامعلوم",
  proposed: "طرح پیشنهادی",
  executable: "اجرای میکرو",
});

const SOURCE_AUTHORITY_COPY = Object.freeze({
  "primary-research": "پژوهش اصلی؛ نتیجه فقط در دامنهٔ همان مطالعه",
  "first-party-technical-report": "گزارش فنی ناشر؛ نه بازتولید مستقل",
  "research-artifact": "artifact همراه پژوهش؛ اعتبار وابسته به مطالعه",
  "community-artifact": "پیاده‌سازی جامعه؛ شاهد وجود پروژه، نه اعتبار علمی مستقل",
  "first-party-documentation": "مستندات ناشر دربارهٔ محصول خود",
  "upstream-repository": "مخزن بالادستی؛ شاهد کد و قرارداد عمومی",
  "maintainer-specification": "مشخصات رسمی نگه‌دارندهٔ استاندارد",
  "project-declared": "تعریف خود پروژه؛ ادعای مستقل‌سنجی‌شده نیست",
  unclassified: "منبع طبقه‌بندی‌نشده",
});

const sourceAuthorityOf = (source) => SOURCE_AUTHORITY_COPY[source?.authority] ?? source?.authority ?? "منبع طبقه‌بندی‌نشده";

const NAV_ITEMS = Object.freeze([
  ["program", "⌁", "برنامهٔ alef.ba", "سه هدف و قرارداد ادعا"],
  ["lifecycle", "◎", "کارخانهٔ یادگیری", "وزن، Context و Memory"],
  ["systems", "▦", "کالبدشناسی سامانه‌ها", "مدل، محصول و Harness"],
  ["applications", "⌁", "کاربرد و آینده", "پیش‌بینی تا سناریو"],
  ["protocols", "⇄", "MCP و API", "مرز انتقال و اختیار"],
  ["abliteration", "⟂", "Abliteration", "آزمایش هندسی ایمن"],
  ["alefba", "◇", "Decision Lab", "راه‌حل عملیاتی APIR"],
  ["benchmarks", "≋", "مقایسه و منابع", "رقبا و شواهد علمی"],
]);

const DEFAULT_SPECIMEN = `GOAL[g1]: طراحی دستیار فارسی برای تحلیل اسناد سازمانی
CONSTRAINT[c1]: دادهٔ محرمانه نباید از محیط محلی خارج شود
CONSTRAINT[c2]: پاسخ باید شاهد و منبع قابل ردیابی داشته باشد
EVIDENCE[e1;source=https://alef.ba/]: چرخهٔ مرجع alef.ba از source به APIR و verify می‌رود
DECISION[d1;evidence=e1]: از RAG محلی با گیت انسانی برای اقدام‌های اثرگذار استفاده شود
UNKNOWN[u1]: دقت واقعی روی corpus سازمان هنوز با test set سنجیده نشده است`;

export function researchDialogTemplate() {
  return `
    <dialog id="research-dialog" class="modal research-modal" aria-labelledby="research-heading">
      <header class="modal-header research-header">
        <div>
          <span class="eyebrow">ALEF.BA INTERNATIONAL RESEARCH PROGRAM · RELEASE 0.5</span>
          <h2 id="research-heading" tabindex="-1">رصدخانهٔ پژوهش و کارخانهٔ تصمیم هوش مصنوعی</h2>
        </div>
        <div class="research-header-state">
          <span class="mode-pill executable">MICRO EXECUTABLE</span>
          <span class="mode-pill simulated">DETERMINISTIC SIMULATION</span>
          <span class="mode-pill external">EXTERNAL · OPT-IN ONLY</span>
          <button class="close-button" data-close="research-dialog" aria-label="بستن رصدخانهٔ پژوهش">×</button>
        </div>
      </header>
      <div class="research-workspace">
        <aside class="research-nav" aria-label="بخش‌های رصدخانه">
          <div class="research-nav-intro">
            <span class="eyebrow">RESEARCH CARTOGRAPHY</span>
            <strong>از عدد تک‌رقمی تا سامانهٔ عامل‌محور</strong>
            <p>هر صفحه واقعیت مستند، محاسبهٔ محلی و شبیه‌سازی را جدا نگه می‌دارد.</p>
          </div>
          <nav id="research-nav-list">
            ${NAV_ITEMS.map(([id, icon, label, note], index) => `<button class="research-nav-button ${index === 0 ? "active" : ""}" data-research-tab="${id}" aria-current="${index === 0 ? "page" : "false"}"><span>${icon}</span><strong>${label}</strong><small>${note}</small></button>`).join("")}
          </nav>
          <div class="research-legend">
            <span><i class="documented"></i>مستند عمومی</span>
            <span><i class="simulated"></i>شبیه‌سازی</span>
            <span><i class="unknown"></i>نامعلوم/اختصاصی</span>
            <span><i class="proposed"></i>پیشنهاد alef.ba</span>
          </div>
        </aside>
        <main id="research-stage" class="research-stage" tabindex="-1"></main>
        <aside id="research-inspector" class="research-inspector" aria-live="polite"></aside>
        <footer class="assurance-dock" aria-label="چهار لایهٔ اطمینان alef.ba">
          <div><span>I</span><strong>Integrity</strong><small>آیا source درست حمل شد؟</small></div>
          <div><span>R</span><strong>Representation</strong><small>آیا معنا و محدودیت حفظ شد؟</small></div>
          <div><span>U</span><strong>Uptake</strong><small>آیا مصرف‌کننده واقعاً استفاده کرد؟</small></div>
          <div><span>O</span><strong>Outcome</strong><small>آیا اثر واقعی مشاهده شد؟</small></div>
          <p>انتقال معنا، اختیار نمی‌سازد. MCP/API شکل حمل‌اند؛ authorization، consent و outcome شاهد جدا می‌خواهند.</p>
        </footer>
      </div>
      <p id="research-announcer" class="sr-only" aria-live="polite"></p>
    </dialog>`;
}

function badge(status) {
  const normalized = String(status ?? "documented").toLowerCase().replaceAll(" ", "-");
  return `<span class="research-status ${escapeHtml(normalized)}">${escapeHtml(STATUS_COPY[normalized] ?? status ?? "مستند")}</span>`;
}

function sourceAction(item, label = "منبع اصلی") {
  const url = firstUrl(item);
  return url ? `<button class="source external-link" data-url="${escapeHtml(url)}">↗ ${escapeHtml(label)}</button>` : "";
}

function infoBlock(title, body, item = null) {
  return `<details class="research-info" open><summary><span>ⓘ</span><strong>${escapeHtml(title)}</strong></summary><p>${escapeHtml(body)}</p>${item ? `<div class="detail-actions">${sourceAction(item, "Doc / منبع علمی")}</div>` : ""}</details>`;
}

function rail(items, activeId = "") {
  return `<div class="research-process-rail">${items.map((item, index) => `<div class="research-process-stop ${idOf(item, index) === activeId ? "active" : ""}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(titleOf(item))}</strong><small>${escapeHtml(textOf(item, "artifact", "output", "persistenceScope"))}</small></div>`).join("<i>←</i>")}</div>`;
}

function renderProgram() {
  const goals = asArray(PROGRAM_GOALS.goals ?? PROGRAM_GOALS);
  const operatingLoop = asArray(PROGRAM_GOALS.operatingLoop);
  return `
    <section class="research-page program-page" data-page="program">
      <header class="research-page-heading"><div><span class="eyebrow">01 / PROGRAM CONTRACT</span><h3>سه هدف، یک آزمایشگاه و یک مرز روشن</h3><p>این پروژه زیر برنامهٔ تحقیقاتی بین‌المللی alef.ba، آموزش را به تصمیم فنی و سپس به یک خروجی عملیاتی قابل ممیزی متصل می‌کند.</p></div>${badge("documented")}</header>
      <div class="program-goal-grid">${goals.map((goal, index) => `<article class="program-goal"><span>0${index + 1}</span><h4>${escapeHtml(titleOf(goal))}</h4><p>${escapeHtml(summaryOf(goal))}</p>${sourceAction(goal, "شرح برنامه")}</article>`).join("")}</div>
      <section class="semantic-foundry" aria-label="چرخهٔ semantic compiler">
        <header><div><span class="eyebrow">SEMANTIC CONTEXT COMPILER</span><h4>Source → APIR → Pack → Verify</h4></div><span class="research-status proposed">راه‌حل عملیاتی این مخزن</span></header>
        <div class="foundry-flow">${operatingLoop.map((step, index) => `${index ? "<i>→</i>" : ""}<div><span>${String(step.order ?? index + 1).padStart(2, "0")}</span><strong>${escapeHtml(titleOf(step))}</strong><small>${escapeHtml(textOf(step, "actionFa", "outputFa"))}</small></div>`).join("")}</div>
        <div class="boundary-plate"><strong>Meaning, not authority</strong><p>کامپایل معنا اجازهٔ ابزار، اجرای workflow، درستی uptake یا تحقق outcome را اثبات نمی‌کند. آن‌ها قرارداد و شاهد مستقل می‌خواهند.</p></div>
      </section>
      <div class="program-map-grid">
        ${infoBlock("چرا از مدل تک‌رقمی شروع می‌کنیم؟", "در جهان ده‌توکنی می‌توان tokenizer، وزن، loss، attention، checkpoint و شکست تعمیم را خط‌به‌خط دید؛ سپس همان نقش‌ها را بدون ادعای یکسان‌بودن مقیاس به سامانه‌های بزرگ‌تر نگاشت.")}
        ${infoBlock("چه چیزی اینجا واقعاً اجرا می‌شود؟", "مدل‌های عددی Python و محاسبات قطعی JavaScript اجراشدنی‌اند. تصویر، ویدئو، محصولات اختصاصی و ابزارهای خارجی در این EXE فقط مدل تشریحی یا منبع عمومی‌اند.")}
        ${infoBlock("خروجی عملیاتی چیست؟", "Decision Lab متن نیاز را به APIR، گزینهٔ معماری، شکاف شاهد و receipt تبدیل می‌کند؛ این خروجی برای طراحی و ممیزی قابل استفاده است، نه مجوز خودکار اجرای سامانه.")}
      </div>
    </section>`;
}

function stageLights(stage) {
  const context = ["inference", "retrieval"].includes(stage.phase);
  const memory = stage.persistenceScope === "user" || stage.persistenceScope === "organization";
  return `<div class="state-lights" aria-label="وضعیت تغییر و دسترسی">
    <div class="${stage.weightsChange === "yes" ? "on" : ""}"><i></i><strong>WEIGHT</strong><small>${stage.weightsChange ?? "no"}</small></div>
    <div class="${context ? "on cyan" : ""}"><i></i><strong>CONTEXT</strong><small>${context ? "active" : "no"}</small></div>
    <div class="${memory ? "on amber" : ""}"><i></i><strong>MEMORY</strong><small>${memory ? stage.persistenceScope : "no"}</small></div>
    <div><i></i><strong>TOOL</strong><small>no</small></div>
  </div>`;
}

function renderLifecycle(state) {
  const run = simulateLearningLifecycle({
    modality: state.lifecycleModality,
    customization: state.lifecycleCustomization,
    durableMemory: state.lifecycleMemory,
    continuedTraining: true,
    distillation: true,
  });
  const stages = run.stages;
  const selected = stages.find((item) => item.id === state.learningStageId) ?? stages[0];
  state.learningStageId = selected.id;
  const userLayers = asArray(USER_DATA_LAYERS);
  const catalogStages = asArray(LEARNING_STAGES);
  return `
    <section class="research-page lifecycle-page" data-page="lifecycle">
      <header class="research-page-heading"><div><span class="eyebrow">02 / TRAINING FORGE</span><h3>مدل چه زمانی «یاد می‌گیرد»؟</h3><p>تغییر وزن در آموزش provider/developer رخ می‌دهد؛ effort، RAG، تاریخچه و بیشتر memoryها عملیات زمان استنتاج‌اند.</p></div>${badge("simulated")}</header>
      <div class="research-control-row">
        <label>وجه داده<select id="learning-modality"><option value="text">متن</option><option value="image">تصویر</option><option value="video">ویدئو</option><option value="audio">صدا</option><option value="code">کد</option><option value="multimodal">چندوجهی</option></select></label>
        <label>سفارشی‌سازی<select id="learning-customization"><option value="none">بدون آموزش اختصاصی</option><option value="adapter">Adapter / LoRA مفهومی</option><option value="fine-tune">Fine-tune مجزا</option></select></label>
        <label class="toggle-label"><input id="learning-memory" type="checkbox" ${state.lifecycleMemory ? "checked" : ""}>حافظهٔ پایدار بیرونی</label>
        <span class="determinism-chip">HASH ${escapeHtml(run.runId)}</span>
      </div>
      <div class="learning-forge">
        <div class="learning-stage-list">${stages.map((stage, index) => `<button class="learning-stage ${stage.id === selected.id ? "active" : ""} ${stage.applies ? "" : "skipped"}" data-learning-stage="${stage.id}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(stage.label)}</strong><small>weight: ${escapeHtml(stage.weightsChange)} · ${escapeHtml(stage.persistenceScope)}</small></button>`).join("")}</div>
        <article class="learning-microscope">
          <span class="eyebrow">SELECTED STAGE / ${escapeHtml(selected.phase)}</span><h4>${escapeHtml(selected.label)}</h4>
          ${stageLights(selected)}
          <dl class="learning-facts"><div><dt>وزن تغییر می‌کند؟</dt><dd>${escapeHtml(selected.weightsChange)}</dd></div><div><dt>دامنهٔ ماندگاری</dt><dd>${escapeHtml(selected.persistenceScope)}</dd></div><div><dt>خروجی مرحله</dt><dd>${escapeHtml(selected.artifact)}</dd></div><div><dt>در این run فعال است؟</dt><dd>${selected.applies ? "بله" : "خیر / اختیاری"}</dd></div></dl>
          <div class="warning-callout"><strong>Sol و effort:</strong> طبق صفحهٔ رسمی GPT‑5.6 Sol، effortهای چندگانه زمان استنتاج را کنترل می‌کنند و fine‑tuning این مدل پشتیبانی نمی‌شود. جزئیات وزن، داده و pipeline داخلی منتشر نشده و در این آزمایشگاه UNKNOWN می‌ماند.</div>
        </article>
      </div>
      <section class="user-data-map"><header><span class="eyebrow">WHERE DOES USER-SPECIFIC INFORMATION LIVE?</span><h4>هشت محل متفاوت برای «اطلاعات من»</h4></header><div>${userLayers.map((layer, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(titleOf(layer))}</strong><p>${escapeHtml(summaryOf(layer))}</p><small>weight: ${escapeHtml(textOf(layer, "weightsChange", "weightChange"))} · scope: ${escapeHtml(textOf(layer, "persistenceScope", "scope"))}</small>${sourceAction(layer)}</article>`).join("")}</div></section>
      <details class="research-info"><summary><span>ⓘ</span><strong>نقشهٔ مرجع مراحل عمومی</strong></summary><div class="compact-stage-catalog">${catalogStages.map((item) => `<span>${escapeHtml(titleOf(item))}</span>`).join("")}</div></details>
    </section>`;
}

function kindLabel(profile) {
  const kind = textOf(profile, "kind", "type").toLowerCase();
  return ({ model: "مدل", product: "محصول", platform: "پلتفرم", harness: "Harness", protocol: "پروتکل", program: "برنامه", project: "پروژه" })[kind] ?? kind;
}

function profileBoundaries(profile) {
  const known = asArray(profile.publicFacts ?? profile.documented ?? profile.publicBoundary ?? profile.public);
  const unknown = asArray(profile.unknowns ?? profile.unknownBoundary ?? profile.proprietaryUnknowns);
  return { known, unknown };
}

function systemLayerValue(profile, layer) {
  const kind = textOf(profile, "kind", "type").toLowerCase();
  if (layer === "model") {
    if (kind === "model") return titleOf(profile);
    const value = textOf(profile, "model", "modelBackend", "baseModel", "facts.baseModel", "facts.model", "facts.apiModelId");
    return value === "—" ? "مدل یا مدل‌های جداگانه / وابسته به پیکربندی" : value;
  }
  if (layer === "harness") {
    if (kind === "harness") return titleOf(profile);
    const value = textOf(profile, "harness", "agentLoop", "runtime", "facts.runtime");
    return value === "—" ? "لایهٔ محصول یا runtime جدا از checkpoint" : value;
  }
  if (layer === "tools") {
    const capabilities = asArray(profile?.capabilities).slice(0, 4);
    return capabilities.length ? capabilities.join(" · ") : textOf(profile, "tools", "tooling", "context");
  }
  return textOf(profile, "environment", "executionEnvironment", "deployment", "platform", "sourceAvailability");
}

function renderSystems(state) {
  const profiles = asArray(RESEARCH_PROFILES);
  const kinds = [...new Set(profiles.map((profile) => textOf(profile, "kind", "type")).filter((value) => value !== "—"))];
  const visible = state.systemKind === "all" ? profiles : profiles.filter((profile) => textOf(profile, "kind", "type") === state.systemKind);
  const selected = profiles.find((profile) => idOf(profile) === state.systemProfileId) ?? profiles[0];
  state.systemProfileId = idOf(selected);
  const boundaries = profileBoundaries(selected);
  const tools = asArray(AGENT_TOOL_PROFILES);
  const profileName = (tool) => titleOf(profiles.find((profile) => profile.id === tool.profileId) ?? tool);
  return `
    <section class="research-page systems-page" data-page="systems">
      <header class="research-page-heading"><div><span class="eyebrow">03 / SYSTEM ANATOMY</span><h3>نام تجاری را با معماری اشتباه نگیریم</h3><p>ChatGPT و OpenArt محصول/پلتفرم‌اند؛ Sol و Qwen مدل‌اند؛ Codex CLI، Claude Code، Devin و Hermes حلقه و محیط عامل را مهندسی می‌کنند.</p></div>${badge("documented")}</header>
      <div class="research-control-row"><label>نوع موجودیت<select id="system-kind"><option value="all">همه</option>${kinds.map((kind) => `<option value="${escapeHtml(kind)}">${escapeHtml(kind)}</option>`).join("")}</select></label><span class="determinism-chip">${numberFa.format(visible.length)} پرونده</span></div>
      <div class="system-anatomy-grid">
        <div class="system-profile-list">${visible.map((profile) => `<button class="system-profile-card ${idOf(profile) === state.systemProfileId ? "active" : ""}" data-system-profile="${escapeHtml(idOf(profile))}"><span>${escapeHtml(kindLabel(profile))}</span><strong>${escapeHtml(titleOf(profile))}</strong><small>${escapeHtml(textOf(profile, "subtitle", "architecture", "architecturePublic"))}</small></button>`).join("")}</div>
        <article class="system-dossier">
          <header><div><span class="eyebrow">${escapeHtml(kindLabel(selected))} / ${escapeHtml(idOf(selected))}</span><h4>${escapeHtml(titleOf(selected))}</h4></div>${badge(textOf(selected, "evidenceStatus", "status"))}</header>
          <p>${escapeHtml(summaryOf(selected))}</p>
          <div class="system-layer-stack">
            <div><span>01</span><strong>MODEL</strong><small>${escapeHtml(systemLayerValue(selected, "model"))}</small></div>
            <div><span>02</span><strong>HARNESS</strong><small>${escapeHtml(systemLayerValue(selected, "harness"))}</small></div>
            <div><span>03</span><strong>TOOLS / DATA</strong><small>${escapeHtml(systemLayerValue(selected, "tools"))}</small></div>
            <div><span>04</span><strong>ENVIRONMENT</strong><small>${escapeHtml(systemLayerValue(selected, "environment"))}</small></div>
          </div>
          <div class="known-unknown-grid"><section><h5>✅ مستند عمومی</h5><ul>${boundaries.known.length ? boundaries.known.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : summaryOf(item))}</li>`).join("") : `<li>${escapeHtml(textOf(selected, "architecturePublic", "architecture"))}</li>`}</ul></section><section><h5>❓ نامعلوم / اختصاصی</h5><ul>${boundaries.unknown.length ? boundaries.unknown.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : summaryOf(item))}</li>`).join("") : "<li>جزئیات منتشرنشده در این برنامه حدس زده نمی‌شوند.</li>"}</ul></section></div>
          <div class="detail-actions">${sourceAction(selected)}${selected?.paper ? `<button class="source external-link" data-url="${escapeHtml(selected.paper)}">↗ مقاله</button>` : ""}</div>
        </article>
      </div>
      <section class="tool-comparison-strip"><header><span class="eyebrow">AGENT TOOL ENGINEERING</span><h4>چه چیزی واقعاً در ابزار کدنویسی مهندسی شده است؟</h4></header><div>${tools.map((tool) => `<article><strong>${escapeHtml(profileName(tool))}</strong><p>${escapeHtml(textOf(tool, "agentLoopFa", "modelBoundaryFa"))}</p><small>${escapeHtml(textOf(tool, "opennessFa", "executionFa"))}</small>${sourceAction(tool)}</article>`).join("")}</div></section>
    </section>`;
}

function chartSvg(values, overlays = []) {
  const all = [...values, ...overlays.flatMap((item) => item.values ?? [])].filter(Number.isFinite);
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 1);
  const span = Math.max(1e-9, max - min);
  const count = Math.max(values.length, ...overlays.map((item) => item.values?.length ?? 0), 2);
  const points = (series) => series.map((value, index) => `${20 + index * (560 / (count - 1))},${176 - ((value - min) / span) * 140}`).join(" ");
  return `<svg class="application-chart" viewBox="0 0 600 205" role="img" aria-label="نمودار محاسبهٔ محلی"><path d="M20 176H580M20 36V176"/><polyline class="raw" points="${points(values)}"/>${overlays.map((item) => `<polyline class="${escapeHtml(item.className ?? "overlay")}" points="${points(item.values)}"/>`).join("")}<text x="22" y="29">${numberFa.format(max)}</text><text x="22" y="194">${numberFa.format(min)}</text></svg>`;
}

function applicationResultMarkup(run) {
  if (run.application === "foresight") return `<div class="scenario-matrix">${run.result.scenarios.map((scenario) => `<article><span>${escapeHtml(scenario.id)}</span><strong>${escapeHtml(scenario.title)}</strong><small>SCENARIO · NOT FORECAST</small></article>`).join("")}</div><div class="warning-callout">این چهار خانه احتمال یا پیش‌بینی کالیبره نیستند؛ برای آزمودن مفروضات و مسیرهای ممکن‌اند.</div>`;
  if (run.application === "forecast") return `${chartSvg([...run.result.train, ...run.result.test], [{ values: [...run.result.train, ...run.result.pointForecast], className: "forecast" }])}<div class="application-metrics"><div><small>slope</small><strong>${numberFa.format(run.result.slope)}</strong></div><div><small>uncertainty</small><strong>${numberFa.format(run.result.uncertainty)}</strong></div><div><small>baseline</small><strong>${numberFa.format(run.result.baseline)}</strong></div></div>`;
  if (run.application === "monitor") return `${chartSvg(run.inputs.series)}<div class="application-metrics"><div><small>baseline</small><strong>${numberFa.format(run.result.baseline)}</strong></div><div><small>alerts</small><strong>${numberFa.format(run.result.alerts.length)}</strong></div><div><small>threshold</small><strong>${numberFa.format(run.inputs.threshold)}</strong></div></div>`;
  return `${chartSvg(run.inputs.series, [{ values: run.result.smoothed, className: "trend" }])}<div class="application-metrics"><div><small>direction</small><strong>${escapeHtml(run.result.direction)}</strong></div><div><small>slope</small><strong>${numberFa.format(run.result.slope)}</strong></div><div><small>change point</small><strong>${numberFa.format(run.result.strongestChangeIndex ?? 0)}</strong></div></div>`;
}

function renderApplications(state) {
  const profiles = asArray(APPLICATION_PROFILES);
  const application = state.application;
  const config = application === "foresight"
    ? { application, drivers: ["پذیرش عمومی AI", "هزینهٔ محاسبه", "تنظیم‌گری"], uncertainties: ["پذیرش عمومی AI", "تنظیم‌گری"], horizon: 5 }
    : { application, series: [10, 11, 12, 13, 15, 18, 17, 26], holdout: 2, horizon: 3, baselineSize: 4, threshold: 5, window: 3 };
  const run = simulateApplicationPipeline(config);
  const profileIds = { forecast: "prediction-simulation", monitor: "monitoring", trend: "trend-analysis", foresight: "foresight" };
  const profile = profiles.find((item) => idOf(item) === profileIds[application]) ?? profiles[0];
  return `
    <section class="research-page applications-page" data-page="applications">
      <header class="research-page-heading"><div><span class="eyebrow">04 / DECISION APPLICATIONS</span><h3>پیش‌بینی، نظارت، روند و آینده‌پژوهی یک کار نیستند</h3><p>هر مسیر ورودی، معیار و نوع ادعای متفاوت دارد. MiroFish در این نقشه آزمایش سناریو است، نه اثبات پیش‌بینی قطعی آینده.</p></div>${badge("simulated")}</header>
      <div class="application-switch">${["forecast", "monitor", "trend", "foresight"].map((id) => `<button class="${id === application ? "active" : ""}" data-application="${id}">${escapeHtml(({ forecast: "پیش‌بینی", monitor: "نظارت", trend: "تحلیل روند", foresight: "آینده‌پژوهی" })[id])}</button>`).join("")}</div>
      <div class="application-lab-grid">
        <article class="application-visual"><header><span class="eyebrow">DETERMINISTIC LOCAL RUN</span><strong>${escapeHtml(titleOf(profile))}</strong><code>${escapeHtml(run.runId)}</code></header>${applicationResultMarkup(run)}</article>
        <article class="application-flow"><h4>رویدادهای همین اجرا</h4><ol>${run.events.map((event) => `<li><span>${String(event.seq).padStart(2, "0")}</span><div><strong>${escapeHtml(event.label)}</strong><small>${escapeHtml(event.phase)} · ${escapeHtml(event.status)}</small></div></li>`).join("")}</ol></article>
      </div>
      <div class="application-boundaries">${profiles.map((item) => infoBlock(titleOf(item), summaryOf(item), item)).join("")}</div>
    </section>`;
}

function renderProtocols(state) {
  const profiles = asArray(PROTOCOL_PROFILES);
  const run = simulateProtocolFlow({
    protocol: state.protocol,
    decision: state.protocolPolicy,
    risk: state.protocolRisk,
    approved: state.protocolApproved,
    operation: state.protocol === "mcp" ? "tools/call" : undefined,
    payload: { documentId: "demo-42", authorization: "never-display-this", mode: "read-only" },
  });
  return `
    <section class="research-page protocols-page" data-page="protocols">
      <header class="research-page-heading"><div><span class="eyebrow">05 / PROTOCOL WIND TUNNEL</span><h3>Envelope داده را حمل می‌کند؛ Policy اختیار را تعیین می‌کند</h3><p>MCP و API در این صفحه envelope واقعی‌نما ولی dry-run می‌سازند. شبکه، فایل، ابزار و side effect ندارند.</p></div>${badge("simulated")}</header>
      <div class="research-control-row">
        <label>پروتکل<select id="protocol-type"><option value="mcp">MCP / JSON-RPC</option><option value="api">HTTP API</option></select></label>
        <label>Policy<select id="protocol-policy"><option value="allow">ALLOW</option><option value="ask">ASK</option><option value="deny">DENY</option></select></label>
        <label>ریسک<select id="protocol-risk"><option value="low">کم</option><option value="medium">متوسط</option><option value="high">زیاد</option><option value="critical">بحرانی</option></select></label>
        <button id="protocol-approve" class="${state.protocolApproved ? "primary" : ""}">${state.protocolApproved ? "تأیید نمایشی ثبت شد" : "تأیید نمایشی انسان"}</button>
      </div>
      <div class="protocol-lab">
        <div class="protocol-flow-live">${run.events.map((event, index) => `<div class="protocol-event ${event.status}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(event.label)}</strong><small>${escapeHtml(event.actor)} → ${escapeHtml(event.target ?? "receipt")}</small></div>`).join("<i>→</i>")}</div>
        <div class="protocol-envelopes"><article><span class="eyebrow">REQUEST ENVELOPE</span><pre>${escapeHtml(JSON.stringify(run.requestEnvelope, null, 2))}</pre></article><article><span class="eyebrow">POLICY RECEIPT</span><pre>${escapeHtml(JSON.stringify(run.policyReceipt, null, 2))}</pre><p>effectExecuted = <strong>${String(run.effectExecuted)}</strong></p></article></div>
      </div>
      <section class="protocol-catalog">${profiles.map((profile) => `<article><span>${escapeHtml(textOf(profile, "kind", "type"))}</span><h4>${escapeHtml(titleOf(profile))}</h4><p>${escapeHtml(summaryOf(profile))}</p>${sourceAction(profile)}</article>`).join("")}</section>
      ${infoBlock("MCP، A2A، AG-UI و OpenAPI مکمل‌اند", "MCP میزبان را به ابزار/منبع، A2A عامل‌های مستقل را به یکدیگر، AG-UI عامل را به رابط زنده و OpenAPI client را به endpoint متصل می‌کند. هیچ‌کدام به‌تنهایی authentication، authorization، sandbox، consent یا صحت نتیجه نیست.")}
    </section>`;
}

function vectorSvg(result) {
  const rows = result.comparisons;
  const scale = 62;
  const originX = 150;
  const originY = 105;
  const arrows = rows.map((row, index) => {
    const y = originY + (index - 1) * 42;
    const beforeX = originX + row.before[0] * scale;
    const beforeY = y - row.before[1] * scale;
    const afterX = originX + row.after[0] * scale;
    const afterY = y - row.after[1] * scale;
    return `<line class="vector-before" x1="${originX}" y1="${y}" x2="${beforeX}" y2="${beforeY}"/><circle class="vector-before" cx="${beforeX}" cy="${beforeY}" r="4"/><line class="vector-after" x1="${originX}" y1="${y}" x2="${afterX}" y2="${afterY}"/><circle class="vector-after" cx="${afterX}" cy="${afterY}" r="4"/>`;
  }).join("");
  return `<svg class="vector-chart" viewBox="0 0 360 220" role="img" aria-label="بردارهای مصنوعی پیش و پس از projection"><path d="M20 105H340M150 15V205"/>${arrows}<text x="10" y="18">synthetic residual space</text></svg>`;
}

function renderAbliteration(state) {
  const result = simulateAbliteration({ strength: state.abliterationStrength });
  const steps = asArray(ABLITERATION_STEPS.steps ?? ABLITERATION_STEPS);
  return `
    <section class="research-page abliteration-page" data-page="abliteration">
      <header class="research-page-heading"><div><span class="eyebrow">06 / SAFE GEOMETRY LAB</span><h3>Abliteration: حذف projection، نه حذف اثبات‌شدهٔ یک مفهوم</h3><p>این روش با ablation study عمومی فرق دارد و می‌تواند safeguard را تضعیف کند. این EXE فقط آرایه‌های مصنوعی را تغییر می‌دهد.</p></div><span class="research-status risk">⚠ WHITE-BOX SAFETY RESEARCH</span></header>
      <div class="warning-callout danger"><strong>مرز ایمنی:</strong> هیچ checkpoint، activation یا وزن مدل واقعی خوانده، اصلاح یا صادر نمی‌شود. کد این صفحه برای ساخت مدل safety-removed قابل استفاده نیست.</div>
      <div class="research-control-row"><label class="wide">شدت projection removal <output>${percentFa.format(result.strength)}</output><input id="abliteration-strength" type="range" min="0" max="1" step="0.05" value="${result.strength}"></label><span class="determinism-chip">BEFORE ${result.syntheticHashes.before} · AFTER ${result.syntheticHashes.after}</span></div>
      <div class="abliteration-grid">
        <article class="vector-vessel">${vectorSvg(result)}<div class="vector-legend"><span class="before">پیش از projection</span><span class="after">پس از projection</span></div></article>
        <article class="regression-vessel"><span class="eyebrow">BEFORE / AFTER EVALUATION</span><div class="regression-gauge"><div><span>Safety</span><i><b style="width:${result.metrics.safety.before * 100}%"></b><em style="width:${result.metrics.safety.after * 100}%"></em></i><strong>${percentFa.format(result.metrics.safety.after)}</strong></div><div><span>Capability</span><i><b style="width:${result.metrics.capability.before * 100}%"></b><em style="width:${result.metrics.capability.after * 100}%"></em></i><strong>${percentFa.format(result.metrics.capability.after)}</strong></div><div><span>Projection reduction</span><i><em style="width:${result.metrics.projectionReduction * 100}%"></em></i><strong>${percentFa.format(result.metrics.projectionReduction)}</strong></div></div><p>${escapeHtml(result.claimBoundary)}</p></article>
      </div>
      <section class="abliteration-steps">${steps.map((step, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><h4>${escapeHtml(titleOf(step))}</h4><p>${escapeHtml(summaryOf(step))}</p>${sourceAction(step)}</article>`).join("")}</section>
      ${infoBlock("چرا کاهش refusal برابر هوشمندترشدن نیست؟", "Refusal یک رفتار ایمنی است؛ کاهش آن نه حقیقت‌گویی، کالیبراسیون، بی‌طرفی یا توان استدلال را اثبات می‌کند. آزمون before/after باید هم capability و هم safety را جدا اندازه بگیرد.")}
    </section>`;
}

function assuranceCell(id, data) {
  const supported = ["SUPPORTED", "RECORDED", "VERIFIED", "WITNESSED"].includes(data?.status);
  return `<div class="assurance-cell ${supported ? "supported" : "unknown"}"><span>${id}</span><strong>${escapeHtml(data?.label ?? id)}</strong><small>${escapeHtml(data?.status ?? "UNKNOWN")}</small><p>${supported ? "شاهد ساختاری محلی ثبت شد." : "برای این لایه هنوز شاهد مستقل نداریم."}</p></div>`;
}

function renderAlefba(state) {
  let packet;
  let error = "";
  try {
    packet = compileAlefbaSpecimen({
      lines: state.specimen.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean),
      budget: state.specimenBudget,
      provenance: { program: "alef.ba", compiler: "desktop-local-v0.5", source: "interactive-specimen" },
    });
  } catch (caught) {
    error = caught.message;
  }
  const apir = packet?.apir ?? { goals: [], constraints: [], decisions: [], evidence: [], unknowns: [] };
  const sections = [["GOAL", apir.goals], ["CONSTRAINT", apir.constraints], ["DECISION", apir.decisions], ["EVIDENCE", apir.evidence], ["UNKNOWN", apir.unknowns]];
  return `
    <section class="research-page alefba-page" data-page="alefba">
      <header class="research-page-heading"><div><span class="eyebrow">07 / OPERATIONAL VERTICAL SLICE</span><h3>Alefba AI Architecture Decision Lab</h3><p>یک specimen واقعی وارد کنید؛ compiler محلی آن را به تعهدهای typed، بودجه، omission و receipt تبدیل می‌کند.</p></div>${badge("executable")}</header>
      <div class="decision-lab-grid">
        <form class="specimen-editor" id="specimen-form"><header><span class="eyebrow">SOURCE SPECIMEN</span><strong>زبان ورودی کمینه و قابل خواندن</strong></header><textarea id="specimen-source" spellcheck="false" dir="rtl">${escapeHtml(state.specimen)}</textarea><label>بودجهٔ بسته <output id="specimen-budget-output">${numberFa.format(state.specimenBudget)}</output><input id="specimen-budget" type="range" min="32" max="512" step="8" value="${state.specimenBudget}"></label><button type="submit" class="primary">کامپایل دوبارهٔ APIR</button><small>Syntax: TAG[id;evidence=e1;source=https://…]: متن</small></form>
        <article class="apir-output"><header><div><span class="eyebrow">TYPED APIR</span><strong>${packet ? escapeHtml(packet.specimenId) : "INVALID SPECIMEN"}</strong></div>${packet ? `<span class="determinism-chip">${packet.budget.used}/${packet.budget.limit}</span>` : ""}</header>${error ? `<div class="warning-callout danger">${escapeHtml(error)}</div>` : sections.map(([tag, items]) => `<section><h4>${tag}<span>${numberFa.format(items.length)}</span></h4>${items.length ? items.map((item) => `<div class="apir-item"><code>${escapeHtml(item.id)}</code><p>${escapeHtml(item.text)}</p><small>${escapeHtml(item.supportStatus)} · cost ${numberFa.format(item.estimatedCost)}</small></div>`).join("") : `<p class="empty-state">موردی در بسته نیست.</p>`}</section>`).join("")}</article>
      </div>
      ${packet ? `<section class="receipt-board"><header><div><span class="eyebrow">ASSURANCE RECEIPT</span><h4>آنچه ثابت شد، آنچه هنوز ناشناخته است</h4></div><span>${numberFa.format(packet.omissions.length)} omission</span></header><div>${assuranceCell("I", packet.receipt.I)}${assuranceCell("R", packet.receipt.R)}${assuranceCell("U", packet.receipt.U)}${assuranceCell("O", packet.receipt.O)}</div>${packet.omissions.length ? `<details><summary>موارد حذف‌شده به علت بودجه</summary><ul>${packet.omissions.map((item) => `<li>${escapeHtml(item.id)} — ${escapeHtml(item.reason)}</li>`).join("")}</ul></details>` : ""}</section>` : ""}
      <div class="decision-next"><article><span>01</span><strong>Candidate stack</strong><p>Model + RAG + Harness + Protocol + Serving</p></article><i>→</i><article><span>02</span><strong>Evidence gaps</strong><p>آزمون، benchmark و مجوز لازم</p></article><i>→</i><article><span>03</span><strong>ADR / Replay</strong><p>تصمیم نسخه‌دار و قابل بازتولید</p></article></div>
    </section>`;
}

function matrixValue(value) {
  if (value === true || value === "yes" || value === "✅") return "✅";
  if (value === false || value === "no" || value === "ND") return "ND";
  return value ?? "ND";
}

function renderBenchmarks() {
  const competitors = asArray(COMPETITOR_MATRIX.entries ?? COMPETITOR_MATRIX);
  const axes = asArray(COMPETITOR_MATRIX.axes);
  const sources = asArray(RESEARCH_SOURCES);
  const coverageMark = (value) => ({ documented: "✅", partial: "◐", "not-core-scope": "ND", "project-target": "TARGET" })[value] ?? value ?? "ND";
  return `
    <section class="research-page benchmarks-page" data-page="benchmarks">
      <header class="research-page-heading"><div><span class="eyebrow">08 / EVIDENCE-BASED POSITIONING</span><h3>پیشتازی یک ادعا نیست؛ یک benchmark قابل تکرار است</h3><p>✅ یعنی در منبع رسمی دیده شده، ◐ یعنی مشروط/مجاور، و ND یعنی در منابع بررسی‌شده مدرکی نیافتیم—نه اینکه قطعاً وجود ندارد.</p></div>${badge("documented")}</header>
      <div class="comparison-scroll"><table class="research-comparison"><thead><tr><th>پروژه</th><th>مرز مقایسه</th>${axes.map((item) => `<th>${escapeHtml(textOf(item, "labelFa", "label"))}</th>`).join("")}<th>منبع</th></tr></thead><tbody>${competitors.map((item) => `<tr><th>${escapeHtml(titleOf(item))}</th><td>${escapeHtml(textOf(item, "boundaryFa", "position"))}</td>${axes.map((axis) => `<td>${escapeHtml(coverageMark(item.coverage?.[axis.id]))}</td>`).join("")}<td>${sourceAction(item, "Primary")}</td></tr>`).join("")}</tbody></table></div>
      <section class="benchmark-contract"><article><span>BREADTH</span><strong>خانواده × مرحلهٔ تعاملی</strong></article><article><span>REPLAY</span><strong>hash یکسان در ۱۰۰ اجرا</strong></article><article><span>SCIENCE</span><strong>درصد مدخل با منبع اولیه</strong></article><article><span>TRUST</span><strong>پوشش برچسب واقعیت/شبیه‌سازی</strong></article><article><span>A11Y</span><strong>keyboard + RTL + reduced motion</strong></article></section>
      <section class="source-registry"><header><span class="eyebrow">TYPED SOURCE REGISTRY</span><h4>منابع پژوهشی، رسمی و بالادستی این نسخه</h4></header><div>${sources.map((source) => `<article><span>${escapeHtml(textOf(source, "type", "category", "kind"))}</span><strong>${escapeHtml(titleOf(source))}</strong><p>${escapeHtml(sourceAuthorityOf(source))}</p>${sourceAction(source, "بازکردن منبع")}</article>`).join("")}</div></section>
    </section>`;
}

function inspectorMarkup(tab, state) {
  const common = `<div class="inspector-contract"><span class="eyebrow">CLAIM CONTRACT</span><h3>چگونه این صفحه را بخوانیم؟</h3><ul><li><b>✅</b> از منبع اولیه یا تست محلی پشتیبانی می‌شود.</li><li><b>◇</b> محاسبه یا شبیه‌سازی قطعی این برنامه است.</li><li><b>❓</b> داخلی، اختصاصی یا هنوز آزموده‌نشده است.</li><li><b>⚠</b> ادعای سازنده یا حوزهٔ نیازمند احتیاط است.</li></ul></div>`;
  const specific = {
    program: `<h4>سه مسیر کاربر</h4><ol><li><strong>Learn</strong> — مکانیزم را ببین.</li><li><strong>Design</strong> — گزینه‌ها را بسنج.</li><li><strong>Investigate</strong> — trace و شکست را بازپخش کن.</li></ol>`,
    lifecycle: `<h4>قانون طلایی</h4><p>اگر فقط prompt، history، RAG، memory یا effort عوض شده، وزن پایه دوباره آموزش ندیده است.</p><code>${escapeHtml(state.learningStageId)}</code>`,
    systems: `<h4>چهار سؤال تشخیصی</h4><ol><li>مدل کدام است؟</li><li>حلقه را چه harnessی کنترل می‌کند؟</li><li>ابزار کجا اجرا می‌شود؟</li><li>حافظه کجا ذخیره می‌شود؟</li></ol>`,
    applications: `<h4>محدودیت علمی</h4><p>forecast بدون time split، baseline، uncertainty و backtest صرفاً extrapolation است. foresight نیز سناریو می‌سازد، نه احتمال کالیبره.</p>`,
    protocols: `<h4>مرز اعتماد</h4><p>Schema شکل داده را بررسی می‌کند. OAuth/ACL اختیار، sandbox دامنهٔ اجرا و trace قابلیت ممیزی را می‌سازند.</p>`,
    abliteration: `<h4>ریسک پژوهش</h4><p>مقالهٔ refusal direction این مداخله را white-box jailbreak بررسی می‌کند. انتشار وزن دستکاری‌شده جزء این پروژه نیست.</p>`,
    alefba: `<h4>تعریف Done</h4><p>I/R را می‌توان ساختاری سنجید؛ U/O تا وقتی مصرف واقعی و outcome بیرونی شاهد نداشته باشند UNKNOWN می‌مانند.</p>`,
    benchmarks: `<h4>ادعای قابل دفاع</h4><p>هدف، گردآوردن آموزش چندمعماری، replay قطعی و تصمیم مهندسی در یک مسیر است. «بهترین» فقط پس از انتشار benchmark معنی دارد.</p>`,
  };
  return `${common}<section class="inspector-specific">${specific[tab]}</section><div class="inspector-mode-stack"><span>LOCAL EXECUTION</span><span>OFFLINE SIMULATION</span><span>EXTERNAL EVIDENCE</span><span>PROPOSED RESEARCH</span></div>`;
}

export function createResearchLab({ dialog, scene } = {}) {
  if (!dialog) throw new Error("Research dialog is required");
  const stage = dialog.querySelector("#research-stage");
  const inspector = dialog.querySelector("#research-inspector");
  const announcer = dialog.querySelector("#research-announcer");
  const state = {
    tab: "program",
    lifecycleModality: "text",
    lifecycleCustomization: "none",
    lifecycleMemory: true,
    learningStageId: "inference-context",
    systemKind: "all",
    systemProfileId: idOf(asArray(RESEARCH_PROFILES)[0], ""),
    application: "forecast",
    protocol: "mcp",
    protocolPolicy: "ask",
    protocolRisk: "low",
    protocolApproved: false,
    abliterationStrength: 0.7,
    specimen: DEFAULT_SPECIMEN,
    specimenBudget: 184,
  };

  const pageRenderers = {
    program: () => renderProgram(),
    lifecycle: () => renderLifecycle(state),
    systems: () => renderSystems(state),
    applications: () => renderApplications(state),
    protocols: () => renderProtocols(state),
    abliteration: () => renderAbliteration(state),
    alefba: () => renderAlefba(state),
    benchmarks: () => renderBenchmarks(),
  };

  function syncControls() {
    const setValue = (selector, value) => { const element = dialog.querySelector(selector); if (element) element.value = String(value); };
    setValue("#learning-modality", state.lifecycleModality);
    setValue("#learning-customization", state.lifecycleCustomization);
    setValue("#system-kind", state.systemKind);
    setValue("#protocol-type", state.protocol);
    setValue("#protocol-policy", state.protocolPolicy);
    setValue("#protocol-risk", state.protocolRisk);
  }

  function render() {
    stage.innerHTML = pageRenderers[state.tab]();
    inspector.innerHTML = inspectorMarkup(state.tab, state);
    dialog.querySelectorAll("[data-research-tab]").forEach((button) => {
      const active = button.dataset.researchTab === state.tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    syncControls();
    announcer.textContent = `بخش ${NAV_ITEMS.find(([id]) => id === state.tab)?.[2] ?? state.tab} نمایش داده شد.`;
  }

  dialog.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-research-tab]");
    if (tab) {
      state.tab = tab.dataset.researchTab;
      render();
      stage.focus({ preventScroll: true });
      return;
    }
    const learningStage = event.target.closest("[data-learning-stage]");
    if (learningStage) { state.learningStageId = learningStage.dataset.learningStage; render(); return; }
    const profile = event.target.closest("[data-system-profile]");
    if (profile) { state.systemProfileId = profile.dataset.systemProfile; render(); return; }
    const application = event.target.closest("[data-application]");
    if (application) { state.application = application.dataset.application; render(); return; }
    if (event.target.closest("#protocol-approve")) { state.protocolApproved = !state.protocolApproved; render(); }
  });

  dialog.addEventListener("change", (event) => {
    if (event.target.id === "learning-modality") state.lifecycleModality = event.target.value;
    if (event.target.id === "learning-customization") state.lifecycleCustomization = event.target.value;
    if (event.target.id === "learning-memory") state.lifecycleMemory = event.target.checked;
    if (event.target.id === "system-kind") state.systemKind = event.target.value;
    if (event.target.id === "protocol-type") state.protocol = event.target.value;
    if (event.target.id === "protocol-policy") state.protocolPolicy = event.target.value;
    if (event.target.id === "protocol-risk") state.protocolRisk = event.target.value;
    if (event.target.id.startsWith("learning-") || event.target.id.startsWith("system-") || event.target.id.startsWith("protocol-")) render();
  });

  dialog.addEventListener("input", (event) => {
    if (event.target.id === "abliteration-strength") { state.abliterationStrength = Number(event.target.value); render(); }
    if (event.target.id === "specimen-budget") {
      state.specimenBudget = Number(event.target.value);
      dialog.querySelector("#specimen-budget-output").textContent = numberFa.format(state.specimenBudget);
    }
  });

  dialog.addEventListener("submit", (event) => {
    if (event.target.id !== "specimen-form") return;
    event.preventDefault();
    state.specimen = dialog.querySelector("#specimen-source").value;
    state.specimenBudget = Number(dialog.querySelector("#specimen-budget").value);
    render();
  });

  function open(tab = state.tab) {
    state.tab = tab;
    render();
    scene?.setExhibit("research");
    if (!dialog.open) dialog.showModal();
    dialog.querySelector("#research-heading")?.focus();
  }

  render();
  return Object.freeze({ open, render, getState: () => ({ ...state }) });
}
