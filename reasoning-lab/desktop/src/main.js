import "@fontsource-variable/vazirmatn";
import "@fontsource-variable/noto-kufi-arabic";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./styles.css";

import {
  CATEGORIES,
  MODEL_CATALOG,
  CATALOG_BY_ID,
  RELATIONS,
  TOUR_STOPS,
  CPU_MODELS,
  OPEN_SOURCE_STACK,
} from "./catalog.js";
import { estimateCpuScenario, samplingDistribution } from "./simulations.js";
import { SceneController } from "./scene.js";
import { agenticDialogTemplate, createAgenticLab } from "./agenticUi.js";
import { researchDialogTemplate, createResearchLab } from "./researchUi.js";

const app = document.querySelector("#app");
const integerFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
const numberFa = (value) => integerFormatter.format(value);

const state = {
  selectedId: "deepseek-r1",
  category: "all",
  query: "",
  tourIndex: 0,
  renderMode: "در حال تشخیص…",
  motion: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  systemInfo: {
    platform: navigator.platform || "Windows",
    arch: "نامشخص",
    cpuModel: "مرورگر محلی — اطلاعات CPU محدود است",
    logicalCores: navigator.hardwareConcurrency || 8,
    totalRamGiB: 16,
    appVersion: "0.5.0",
    packaged: false,
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function colorHex(category) {
  return `#${CATEGORIES[category].color.toString(16).padStart(6, "0")}`;
}

function statusLabel(node) {
  if (node.status === "source-backed") return "SOURCE-BACKED";
  if (node.status === "local-calculation") return "LOCAL CALCULATION";
  return "CONCEPTUAL MODEL";
}

function sourceButton(url, label = "مخزن متن‌باز") {
  if (!url) return "";
  return `<button class="source external-link" data-url="${escapeHtml(url)}">↗ ${escapeHtml(label)}</button>`;
}

function appTemplate() {
  const categoryButtons = [
    `<button class="category-button active" data-category="all" aria-pressed="true"><span class="category-dot"></span>همهٔ مدارها</button>`,
    ...Object.entries(CATEGORIES).map(([key, category]) => `
      <button class="category-button" data-category="${key}" aria-pressed="false" style="color:${colorHex(key)}">
        <span class="category-dot"></span>${escapeHtml(category.label)}
      </button>`),
  ].join("");

  return `
    <a class="skip-link" href="#graph-tree">پرش به فهرست دسترس‌پذیر مدل‌ها</a>
    <main id="ecosystem-app" class="app-shell">
      <header id="command-rail" class="command-rail">
        <div class="brand" aria-label="آزمایشگاه زیست‌بوم مدل‌ها">
          <span class="brand-mark" aria-hidden="true"></span>
          <span><h1>رصدخانهٔ مدل‌ها</h1><small>MODEL ECOSYSTEM / WINDOWS LAB</small></span>
        </div>
        <label class="search-wrap">
          <span class="sr-only">جست‌وجوی مدل یا معماری</span>
          <input id="ecosystem-search" type="search" autocomplete="off" placeholder="مدل، معماری یا تکنیک را جست‌وجو کنید…">
          <kbd>/</kbd>
        </label>
        <div class="rail-actions">
          <button id="research-open" class="primary">رصدخانهٔ پژوهش</button>
          <button id="agentic-open">اتاق فرمان Agentic</button>
          <button id="sampling-open" class="optional-small">پارامترهای تولید</button>
          <button id="cpu-open">آزمایشگاه CPU</button>
          <button id="compare-open" class="optional">مقایسه</button>
          <button id="sources-open" class="optional">منابع</button>
          <button id="docs-open">راهنما</button>
        </div>
        <span id="offline-status" class="status-chip" title="هیچ داده‌ای هنگام اجرا به اینترنت ارسال نمی‌شود">آفلاین / محلی</span>
      </header>

      <nav class="nav-panel" aria-label="اطلس مدل‌ها">
        <div class="panel-heading">
          <span class="eyebrow">ORBIT DIRECTORY</span>
          <h2>خانواده‌های معماری</h2>
        </div>
        <div id="ecosystem-filters" class="category-filter">${categoryButtons}</div>
        <div id="tree-meta" class="tree-meta" aria-live="polite"></div>
        <ul id="graph-tree" class="tree-list" aria-label="فهرست کامل و جایگزین نمای سه‌بعدی"></ul>
      </nav>

      <section id="graph-region" class="stage" aria-labelledby="stage-heading">
        <canvas id="graph-canvas" aria-hidden="true"></canvas>
        <div class="stage-plate top" aria-label="کنترل نمای صحنه">
          <button id="view-3d" aria-pressed="true" title="میانبر ۳">نمای ۳بعدی</button>
          <button id="view-2d" aria-pressed="false" title="میانبر ۲">نقشهٔ ۲بعدی</button>
          <button id="motion-toggle" aria-pressed="${state.motion}">${state.motion ? "حرکت: روشن" : "حرکت: خاموش"}</button>
          <span id="render-mode-status" class="eyebrow" aria-live="polite">تشخیص renderer…</span>
        </div>
        <div class="legend" aria-label="راهنمای وضعیت و رنگ">
          <strong>چگونه نقشه را بخوانیم؟</strong>
          <span><i style="color:var(--acid)"></i> چندوجهی = مدخل دارای منبع</span>
          <span><i style="color:var(--cyan);transform:rotate(45deg)"></i> حلقه = انتخاب فعلی</span>
          <span>خط روشن = رابطهٔ مستقیم</span>
          <span>رنگ = خانواده؛ تنها نشانه نیست</span>
        </div>
        <div class="stage-title">
          <span class="eyebrow">LIVE ARCHITECTURE MAP · CONCEPTUAL 3D</span>
          <h2 id="stage-heading">هسته، وزن، داده و مسیر تولید</h2>
          <p>برای چرخش drag کنید؛ هر گره یک پرونده، فلو، منبع علمی و نمایش تشریحی دارد.</p>
        </div>
        <div class="stage-plate bottom" aria-label="نمایشگرهای تشریحی">
          <button class="exhibit-button active" data-exhibit="graph">اطلس</button>
          <button class="exhibit-button" data-exhibit="moe">MoE</button>
          <button class="exhibit-button" data-exhibit="diffusion">Diffusion</button>
          <button class="exhibit-button" data-exhibit="video">Video</button>
          <button class="exhibit-button" data-exhibit="audio">Audio</button>
          <button class="exhibit-button" data-exhibit="code">Code</button>
          <button class="exhibit-button" data-exhibit="agentic">Agentic</button>
          <button class="exhibit-button" data-exhibit="research">Research</button>
        </div>
        <div id="graph-fallback" class="fallback-map" aria-hidden="true"></div>
      </section>

      <aside id="node-detail" class="detail-panel" aria-labelledby="node-detail-heading">
        <div class="panel-heading">
          <span class="eyebrow">MICROSCOPE / DOSSIER</span>
          <h2>پروندهٔ گرهٔ انتخابی</h2>
        </div>
        <div id="detail-content" class="detail-content"></div>
      </aside>

      <section id="guided-tour" class="tour-strip" aria-labelledby="tour-heading">
        <div class="tour-index"><strong id="tour-step-count">۰۱ / ۱۲</strong><small>تور هدایت‌شدهٔ فارسی</small></div>
        <div class="tour-copy"><h2 id="tour-heading"></h2><p id="tour-body"></p></div>
        <div class="tour-controls">
          <button id="tour-previous" aria-label="مرحلهٔ قبل">قبلی</button>
          <button id="tour-focus">نمایش این مرحله</button>
          <button id="tour-next" class="primary" aria-label="مرحلهٔ بعد">بعدی</button>
        </div>
      </section>
    </main>

    ${cpuDialogTemplate()}
    ${samplingDialogTemplate()}
    ${compareDialogTemplate()}
    ${sourcesDialogTemplate()}
    ${docsDialogTemplate()}
    ${agenticDialogTemplate()}
    ${researchDialogTemplate()}
  `;
}

function cpuDialogTemplate() {
  return `
    <dialog id="cpu-dialog" class="modal" aria-labelledby="deepseek-heading">
      <header class="modal-header">
        <div><span class="eyebrow">LOCAL CALCULATION · NO MODEL WEIGHTS</span><h2 id="deepseek-heading">DeepSeek روی CPU: آزمایشگاه ظرفیت</h2></div>
        <button class="close-button" data-close="cpu-dialog" aria-label="بستن">×</button>
      </header>
      <div class="modal-body">
        <div class="warning-callout"><strong>وضعیت: UNAVAILABLE — فایل GGUF محلی وجود ندارد.</strong><br>این پنل حافظه و سقف تقریبی سرعت را روی همین دستگاه محاسبه و بصری‌سازی می‌کند؛ نه مدل را بارگذاری می‌کند و نه benchmark واقعی است.</div>
        <div class="lab-grid" style="margin-top:14px">
          <form id="cpu-controls" class="control-deck">
            <h3>۱. سخت‌افزار و checkpoint فرضی</h3>
            <div id="system-facts" class="system-facts">در حال خواندن مشخصات سیستم…</div>
            <div class="field"><label for="cpu-model">مدل</label><select id="cpu-model">${CPU_MODELS.map((model) => `<option value="${model.id}">${escapeHtml(model.label)}</option>`).join("")}</select></div>
            <div class="field"><label for="quant-bits">دقت وزن / quantization</label><output id="quant-output">۴ بیت</output><input id="quant-bits" type="range" min="2" max="16" step="1" value="4"></div>
            <div class="field"><label for="ram-gib">RAM نصب‌شده</label><output id="ram-output">۱۶ GiB</output><input id="ram-gib" type="range" min="4" max="512" step="4" value="16"></div>
            <div class="field"><label for="cpu-cores">هستهٔ منطقی</label><output id="cores-output">۸</output><input id="cpu-cores" type="range" min="1" max="128" step="1" value="8"></div>
            <div class="field"><label for="memory-bandwidth">پهنای‌باند حافظهٔ فرضی</label><output id="bandwidth-output">۳۵ GB/s</output><input id="memory-bandwidth" type="range" min="5" max="400" step="5" value="35"></div>
            <div class="field"><label for="context-tokens">طول context</label><output id="context-output">۴٬۰۹۶</output><input id="context-tokens" type="range" min="512" max="131072" step="512" value="4096"></div>
          </form>
          <section id="cpu-result" class="result-deck" aria-live="polite"></section>
        </div>
        <details class="insight" open><summary>ⓘ چرا ۳۷B فعال، مدل ۶۷۱B را به یک مدل ۳۷B تبدیل نمی‌کند؟</summary><div class="insight-body">Router برای هر token فقط چند expert را محاسبه می‌کند؛ اما expertهای انتخاب‌نشده ناپدید نمی‌شوند. وزن کل checkpoint باید روی RAM/VRAM/دیسک قابل دسترس باشد. بنابراین MoE معمولاً FLOP هر token را کاهش می‌دهد، نه الزام ذخیرهٔ کل وزن را.</div></details>
        <details class="insight"><summary>ⓘ مسیر واقعی CPU با llama.cpp چیست؟</summary><div class="insight-body">checkpoint سازگار → تبدیل/دریافت GGUF → quantization → نگاشت وزن به RAM → tokenization → compute graph و KV cache → sampler → detokenization. این نسخهٔ آزمایشگاه هیچ فایل وزنی را همراه ندارد تا حجم، مجوز و ادعای اجرا شفاف بماند.</div></details>
      </div>
    </dialog>`;
}

function samplingDialogTemplate() {
  return `
    <dialog id="sampling-dialog" class="modal" aria-labelledby="sampling-heading">
      <header class="modal-header">
        <div><span class="eyebrow">LOCAL ALGORITHM VISUALIZER</span><h2 id="sampling-heading">از logit تا token: پارامترهای تولید و effort</h2></div>
        <button class="close-button" data-close="sampling-dialog" aria-label="بستن">×</button>
      </header>
      <div class="modal-body">
        <div class="lab-grid">
          <form id="sampling-controls" class="control-deck">
            <h3>۱. ورودی آزمایش تک‌رقمی</h3>
            <div class="field"><label for="digit-input">عدد ورودی</label><select id="digit-input">${Array.from({ length: 10 }, (_, digit) => `<option value="${digit}" ${digit === 4 ? "selected" : ""}>${numberFa(digit)}</option>`).join("")}</select></div>
            <div class="field"><label for="temperature">Temperature</label><output id="temperature-output">۱٫۰۰</output><input id="temperature" type="range" min="0.05" max="2" step="0.05" value="1"></div>
            <div class="field"><label for="top-k">Top-k</label><output id="top-k-output">۱۰</output><input id="top-k" type="range" min="1" max="10" step="1" value="10"></div>
            <div class="field"><label for="top-p">Top-p / nucleus</label><output id="top-p-output">۱٫۰۰</output><input id="top-p" type="range" min="0.05" max="1" step="0.05" value="1"></div>
            <div class="field"><label for="frequency-penalty">Frequency penalty</label><output id="frequency-output">۰٫۰۰</output><input id="frequency-penalty" type="range" min="0" max="2" step="0.1" value="0"></div>
            <div class="field"><label for="presence-penalty">Presence penalty</label><output id="presence-output">۰٫۰۰</output><input id="presence-penalty" type="range" min="0" max="2" step="0.1" value="0"></div>
            <div class="field"><label for="repetition-penalty">Repetition penalty</label><output id="repetition-output">۱٫۰۰</output><input id="repetition-penalty" type="range" min="1" max="2" step="0.05" value="1"></div>
            <div class="field"><label for="reasoning-effort">Effort مفهومی</label><select id="reasoning-effort"><option value="low">کم: پاسخ مستقیم</option><option value="medium" selected>متوسط: طرح + پاسخ</option><option value="high">زیاد: چند مسیر + verifier</option></select></div>
          </form>
          <section id="sampling-result" class="result-deck" aria-live="polite"></section>
        </div>
        <div class="flow-box">
          <header><h3>فلوچارت نمونه‌گیری</h3><span class="claim-badge">DETERMINISTIC LOCAL DEMO</span></header>
          <div class="flow-track"><div class="flow-step">logit خام</div><span class="flow-arrow">←</span><div class="flow-step">penalty روی سابقه</div><span class="flow-arrow">←</span><div class="flow-step">تقسیم بر temperature</div><span class="flow-arrow">←</span><div class="flow-step">softmax</div><span class="flow-arrow">←</span><div class="flow-step">Top-k</div><span class="flow-arrow">←</span><div class="flow-step">Top-p</div><span class="flow-arrow">←</span><div class="flow-step">sample / seed</div></div>
        </div>
        <details class="insight" open><summary>ⓘ Temperature دانش مدل را بیشتر نمی‌کند</summary><div class="insight-body">Temperature شکل توزیع موجود را تغییر می‌دهد: کمتر، اختلاف logitها را تیزتر و خروجی را پایدارتر می‌کند؛ بیشتر، گزینه‌های کم‌احتمال را قابل‌انتخاب‌تر می‌کند. هیچ واقعیت جدیدی به وزن یا context افزوده نمی‌شود.</div></details>
        <details class="insight"><summary>ⓘ Effort، reasoning و deep think چه تفاوتی دارند؟</summary><div class="insight-body">Effort یک قرارداد سامانه برای بودجهٔ محاسباتی یا مراحل بیشتر است؛ reasoning یک خانواده رفتار/آموزش برای حل چندمرحله‌ای است؛ «deep think» معمولاً نام محصول یا حالت UX است، نه معماری واحد. مراحل بیشتر می‌توانند verifier یا ابزار اضافه کنند، ولی تضمین صحت نیستند.</div></details>
        <details class="insight"><summary>ⓘ پارامترهای دیگری که در APIها می‌بینید</summary><div class="insight-body"><strong>max tokens</strong> سقف طول خروجی است؛ <strong>stop</strong> تولید را با دیدن رشته/توکن متوقف می‌کند؛ <strong>seed</strong> در runtime سازگار تکرارپذیری نسبی می‌دهد؛ <strong>logit bias</strong> token مشخص را مستقیماً تشویق/تنبیه می‌کند؛ <strong>min-p / typical-p</strong> فیلترهای جایگزین‌اند؛ <strong>beam search</strong> چند دنباله را امتیازدهی می‌کند و sampling تصادفی معمولی نیست. نام و ترتیب دقیق این گزینه‌ها بین backendها یکسان نیست.</div></details>
      </div>
    </dialog>`;
}

function compareDialogTemplate() {
  return `
    <dialog id="compare-dialog" class="modal" aria-labelledby="compare-heading">
      <header class="modal-header"><div><span class="eyebrow">ARCHITECTURE DIFFERENTIAL</span><h2 id="compare-heading">مقایسهٔ دو مدل یا تکنیک</h2></div><button class="close-button" data-close="compare-dialog" aria-label="بستن">×</button></header>
      <div class="modal-body">
        <div class="io-grid" style="margin-bottom:14px">
          <label class="field">مدخل اول<select id="compare-a">${MODEL_CATALOG.map((node) => `<option value="${node.id}" ${node.id === "deepseek-v3" ? "selected" : ""}>${escapeHtml(node.title)}</option>`).join("")}</select></label>
          <label class="field">مدخل دوم<select id="compare-b">${MODEL_CATALOG.map((node) => `<option value="${node.id}" ${node.id === "latent-diffusion" ? "selected" : ""}>${escapeHtml(node.title)}</option>`).join("")}</select></label>
        </div>
        <div id="compare-result"></div>
      </div>
    </dialog>`;
}

function sourcesDialogTemplate() {
  return `
    <dialog id="sources-dialog" class="modal" aria-labelledby="sources-heading">
      <header class="modal-header"><div><span class="eyebrow">PROVENANCE REGISTRY</span><h2 id="sources-heading">مخزن‌ها، مقاله‌ها و مجوزها</h2></div><button class="close-button" data-close="sources-dialog" aria-label="بستن">×</button></header>
      <div class="modal-body">
        <div class="warning-callout">برچسب «متن‌باز» برای کل زیست‌بوم کافی نیست. مجوز کد، وزن checkpoint، دادهٔ آموزش و خروجی باید جدا بررسی شوند. لینک‌ها فقط با اقدام شما در مرورگر سیستم باز می‌شوند؛ برنامه هنگام اجرا شبکه‌ای نیست.</div>
        <table class="source-table" style="margin-top:14px"><thead><tr><th>مدخل</th><th>خانواده</th><th>مجوز / مرز</th><th>منبع</th></tr></thead><tbody>${MODEL_CATALOG.map((node) => `<tr><td>${escapeHtml(node.title)}</td><td>${escapeHtml(CATEGORIES[node.category].label)}</td><td>${escapeHtml(node.license)}</td><td>${sourceButton(node.repo, "Repo")}${node.paper ? sourceButton(node.paper, "Paper") : ""}</td></tr>`).join("")}</tbody></table>
        <h3 style="margin-top:24px">فناوری‌های خود این EXE</h3>
        <table class="source-table"><thead><tr><th>بسته</th><th>نسخه</th><th>مجوز</th><th>مخزن</th></tr></thead><tbody>${OPEN_SOURCE_STACK.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td dir="ltr">${escapeHtml(item.version)}</td><td>${escapeHtml(item.license)}</td><td>${sourceButton(item.repo, "GitHub")}</td></tr>`).join("")}</tbody></table>
      </div>
    </dialog>`;
}

function docsDialogTemplate() {
  return `
    <dialog id="docs-dialog" class="modal" aria-labelledby="docs-heading">
      <header class="modal-header"><div><span class="eyebrow">IN-PRODUCT FĀRSI DOCUMENTATION</span><h2 id="docs-heading">راهنمای تشریحی آزمایشگاه</h2></div><button class="close-button" data-close="docs-dialog" aria-label="بستن">×</button></header>
      <div class="modal-body docs-layout">
        <nav id="docs-nav" class="docs-nav" aria-label="سرفصل‌های مستندات"></nav>
        <article id="docs-article" class="docs-article"></article>
      </div>
    </dialog>`;
}

app.innerHTML = appTemplate();

const elements = {
  search: document.querySelector("#ecosystem-search"),
  tree: document.querySelector("#graph-tree"),
  treeMeta: document.querySelector("#tree-meta"),
  detail: document.querySelector("#detail-content"),
  fallback: document.querySelector("#graph-fallback"),
  renderStatus: document.querySelector("#render-mode-status"),
  tourCount: document.querySelector("#tour-step-count"),
  tourHeading: document.querySelector("#tour-heading"),
  tourBody: document.querySelector("#tour-body"),
};

function filteredNodes() {
  const normalized = state.query.trim().toLocaleLowerCase("fa");
  return MODEL_CATALOG.filter((node) => {
    if (state.category !== "all" && node.category !== state.category) return false;
    if (!normalized) return true;
    const haystack = [node.title, node.subtitle, node.summary, node.architecture, ...node.tags].join(" ").toLocaleLowerCase("fa");
    return haystack.includes(normalized);
  });
}

function renderTree() {
  const nodes = filteredNodes();
  elements.treeMeta.textContent = `${numberFa(nodes.length)} مدخل از ${numberFa(MODEL_CATALOG.length)} مدخل علمی`;
  elements.tree.innerHTML = nodes.map((node) => `
    <li>
      <button class="tree-node ${node.id === state.selectedId ? "selected" : ""}" data-node-id="${node.id}" style="color:${colorHex(node.category)}" ${node.id === state.selectedId ? "aria-current=\"true\"" : ""}>
        <span class="node-glyph" aria-hidden="true"></span>
        <span><strong style="color:var(--ink)">${escapeHtml(node.title)}</strong><small>${escapeHtml(node.architecture)}</small></span>
      </button>
    </li>`).join("") || `<li class="warning-callout">نتیجه‌ای پیدا نشد. فیلتر یا عبارت جست‌وجو را تغییر دهید.</li>`;
}

function relationLabels(node) {
  const related = new Set();
  RELATIONS.forEach((relation) => {
    if (relation.from === node.id) related.add(relation.to);
    if (relation.to === node.id) related.add(relation.from);
  });
  return [...related].map((id) => CATALOG_BY_ID.get(id)).filter(Boolean);
}

function renderDetail(nodeId = state.selectedId) {
  const node = CATALOG_BY_ID.get(nodeId) ?? MODEL_CATALOG[0];
  state.selectedId = node.id;
  const related = relationLabels(node);
  const process = node.process.map((step, index) => `${index ? '<span class="flow-arrow">←</span>' : ""}<div class="flow-step"><strong>${numberFa(index + 1)}</strong><br>${escapeHtml(step)}</div>`).join("");
  elements.detail.innerHTML = `
    <div class="detail-head">
      <div><span class="eyebrow">${escapeHtml(CATEGORIES[node.category].label)} / ${escapeHtml(node.id)}</span><h2 id="node-detail-heading" tabindex="-1">${escapeHtml(node.title)}</h2><p>${escapeHtml(node.subtitle)}</p></div>
      <span id="node-status" class="claim-badge">${statusLabel(node)}</span>
    </div>
    <p id="node-summary" class="summary">${escapeHtml(node.summary)}</p>
    <div class="io-grid">
      <div class="metric-card"><small>ورودی</small><strong>${escapeHtml(node.input)}</strong></div>
      <div class="metric-card"><small>خروجی</small><strong>${escapeHtml(node.output)}</strong></div>
      <div class="metric-card"><small>معماری</small><strong>${escapeHtml(node.architecture)}</strong></div>
      <div class="metric-card"><small>اندازه / پارامتر</small><strong>${escapeHtml(node.params)}</strong></div>
    </div>
    <div id="node-flow" class="flow-box"><header><h3>فرآیند گام‌به‌گام</h3><span class="eyebrow">INPUT → MECHANISM → OUTPUT</span></header><div class="flow-track">${process}</div></div>
    <details class="insight" open><summary>این نمایش سه‌بعدی دقیقاً چه چیزی را نشان می‌دهد؟</summary><div class="insight-body">نمای صحنه، رابطه و جریان داده را مدل‌سازی مفهومی می‌کند؛ tensor واقعی checkpoint در Three.js محاسبه نمی‌شود. مدخل «${escapeHtml(node.title)}» به نمایش <code>${escapeHtml(node.exhibit)}</code> متصل است تا شکل معماری قابل لمس شود.</div></details>
    <details class="insight"><summary>نیاز محاسباتی و محدودیت اجرا</summary><div class="insight-body">${escapeHtml(node.compute)} این مقدار به نسخه، precision، context، batch، backend و سخت‌افزار وابسته است؛ عدد تیم سازنده را benchmark مستقل تلقی نکنید.</div></details>
    <details class="insight"><summary>داده، مجوز و مرز ادعا</summary><div class="insight-body"><strong>داده:</strong> ${escapeHtml(node.data)}<br><strong>مجوز:</strong> ${escapeHtml(node.license)}<br>وجود کد عمومی لزوماً مجوز آزاد وزن، داده یا استفادهٔ تجاری را ثابت نمی‌کند.</div></details>
    ${node.id.startsWith("deepseek") ? `<div class="warning-callout">نکتهٔ DeepSeek: پارامتر فعال در MoE معیار محاسبهٔ token است؛ اندازهٔ checkpoint و نیاز ذخیره‌سازی با پارامتر کل سنجیده می‌شود. نسخهٔ کامل R1 در این EXE اجرا نمی‌شود.</div>` : ""}
    <div class="tag-list">${node.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="detail-actions">
      <button id="focus-node" class="primary" data-node-id="${node.id}">قرار دادن در مرکز</button>
      <button id="exhibit-node" data-exhibit="${escapeHtml(node.exhibit)}">نمایش معماری</button>
      <button class="doc-node" data-doc-id="${node.id}">شرح مفصل فارسی</button>
      ${sourceButton(node.repo)}
      ${node.paper ? sourceButton(node.paper, "مقالهٔ علمی") : ""}
    </div>
    ${related.length ? `<div class="flow-box"><header><h3>رابطه‌های مستقیم</h3></header><div class="tag-list">${related.map((item) => `<button class="related-node" data-node-id="${item.id}">${escapeHtml(item.title)}</button>`).join("")}</div></div>` : ""}
  `;
  renderTree();
}

function makeFallbackMap() {
  const width = 820;
  const height = 620;
  const centerX = width / 2;
  const centerY = height / 2;
  const categoryGroups = Object.keys(CATEGORIES);
  const nodes = MODEL_CATALOG.map((node) => {
    const categoryIndex = categoryGroups.indexOf(node.category);
    const sameCategory = MODEL_CATALOG.filter((item) => item.category === node.category);
    const index = sameCategory.findIndex((item) => item.id === node.id);
    const angle = (index / sameCategory.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 62 + categoryIndex * 34;
    return { node, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
  });
  const lineMarkup = RELATIONS.map((relation) => {
    const from = nodes.find((item) => item.node.id === relation.from);
    const to = nodes.find((item) => item.node.id === relation.to);
    if (!from || !to) return "";
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#30473d" stroke-width="0.7"/>`;
  }).join("");
  const nodeMarkup = nodes.map(({ node, x, y }) => `
    <g class="fallback-node" tabindex="0" role="button" aria-label="${escapeHtml(node.title)}" data-node-id="${node.id}">
      <circle cx="${x}" cy="${y}" r="${node.id === state.selectedId ? 7 : 4.5}" fill="${colorHex(node.category)}" stroke="#07100d" stroke-width="2"/>
      ${node.id === state.selectedId ? `<text x="${x}" y="${y - 12}" text-anchor="middle" fill="#e7eee8" font-size="10">${escapeHtml(node.title)}</text>` : ""}
    </g>`).join("");
  elements.fallback.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="fallback-title"><title id="fallback-title">نقشهٔ دوبعدی تمام خانواده‌های مدل</title>${categoryGroups.map((key, index) => `<circle cx="${centerX}" cy="${centerY}" r="${62 + index * 34}" fill="none" stroke="${colorHex(key)}" stroke-opacity="0.18"/>`).join("")}${lineMarkup}<circle cx="${centerX}" cy="${centerY}" r="18" fill="#b9f227" fill-opacity="0.7"/>${nodeMarkup}</svg>`;
}

function selectNode(id, { focus = false, focusHeading = false } = {}) {
  if (!CATALOG_BY_ID.has(id)) return;
  state.selectedId = id;
  scene?.select(id);
  if (focus) scene?.focus(id);
  renderDetail(id);
  makeFallbackMap();
  if (focusHeading) document.querySelector("#node-detail-heading")?.focus();
}

function setView(mode, reason = "") {
  if (mode === "3d" && !scene?.renderer) {
    mode = "2d";
    reason = "WebGL در دسترس نیست؛ نقشهٔ دوبعدی فعال باقی ماند.";
  }
  const is2d = mode === "2d";
  document.querySelector("#view-2d").setAttribute("aria-pressed", String(is2d));
  document.querySelector("#view-3d").setAttribute("aria-pressed", String(!is2d));
  elements.fallback.classList.toggle("active", is2d);
  elements.fallback.setAttribute("aria-hidden", String(!is2d));
  document.querySelector("#graph-canvas").hidden = is2d;
  state.renderMode = is2d ? "SVG / DOM 2D" : state.renderMode;
  elements.renderStatus.textContent = reason || state.renderMode;
  if (is2d) makeFallbackMap();
  else scene?.resize();
}

function renderTour() {
  const stop = TOUR_STOPS[state.tourIndex];
  elements.tourCount.textContent = `${numberFa(state.tourIndex + 1)} / ${numberFa(TOUR_STOPS.length)}`;
  elements.tourHeading.textContent = stop.title;
  elements.tourBody.textContent = stop.body;
  document.querySelector("#tour-previous").disabled = state.tourIndex === 0;
  document.querySelector("#tour-next").textContent = state.tourIndex === TOUR_STOPS.length - 1 ? "شروع دوباره" : "بعدی";
}

function openExternal(url) {
  if (!/^https:\/\//i.test(url)) return;
  if (window.desktopLab?.openExternal) window.desktopLab.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

function openDialog(id) {
  const dialog = document.querySelector(`#${id}`);
  if (dialog && !dialog.open) dialog.showModal();
}

function renderCpuResult() {
  const inputs = {
    modelId: document.querySelector("#cpu-model").value,
    quantBits: Number(document.querySelector("#quant-bits").value),
    ramGiB: Number(document.querySelector("#ram-gib").value),
    cores: Number(document.querySelector("#cpu-cores").value),
    bandwidthGBs: Number(document.querySelector("#memory-bandwidth").value),
    contextTokens: Number(document.querySelector("#context-tokens").value),
  };
  const result = estimateCpuScenario(inputs);
  document.querySelector("#quant-output").textContent = `${numberFa(inputs.quantBits)} بیت`;
  document.querySelector("#ram-output").textContent = `${numberFa(inputs.ramGiB)} GiB`;
  document.querySelector("#cores-output").textContent = numberFa(inputs.cores);
  document.querySelector("#bandwidth-output").textContent = `${numberFa(inputs.bandwidthGBs)} GB/s`;
  document.querySelector("#context-output").textContent = numberFa(inputs.contextTokens);
  const totalScale = Math.max(result.usableRamGiB, result.requiredGiB);
  const widths = {
    weights: (result.weightsGiB / totalScale) * 100,
    kv: (result.kvGiB / totalScale) * 100,
    workspace: (result.workspaceGiB / totalScale) * 100,
    free: (Math.max(0, result.headroomGiB) / totalScale) * 100,
  };
  document.querySelector("#cpu-result").innerHTML = `
    <h3>۲. نتیجهٔ محاسبه برای ${escapeHtml(result.model.label)}</h3>
    <div class="big-metric" style="color:${result.fits ? "var(--acid)" : "var(--danger)"}">${decimalFormatter.format(result.requiredGiB)} GiB</div>
    <div class="metric-label">RAM مورد نیاز تقریبی / RAM قابل استفاده ${decimalFormatter.format(result.usableRamGiB)} GiB</div>
    <div class="memory-stack" aria-label="تقسیم مصرف حافظه">
      <span class="weights" style="width:${widths.weights}%">weights</span><span class="kv" style="width:${widths.kv}%">KV</span><span class="workspace" style="width:${widths.workspace}%">work</span><span class="free" style="width:${widths.free}%">free</span>
    </div>
    <div class="result-grid">
      <div class="metric-card"><small>وزن کل</small><strong>${decimalFormatter.format(result.weightsGiB)} GiB</strong></div>
      <div class="metric-card"><small>وزن فعال/token</small><strong>${decimalFormatter.format(result.activeWeightsGiB)} GiB</strong></div>
      <div class="metric-card"><small>KV cache</small><strong>${decimalFormatter.format(result.kvGiB)} GiB</strong></div>
      <div class="metric-card"><small>فضای کاری</small><strong>${decimalFormatter.format(result.workspaceGiB)} GiB</strong></div>
      <div class="metric-card"><small>سرعت تحلیلی</small><strong>${result.fits ? decimalFormatter.format(result.tokensPerSecond) : "0"} tok/s</strong></div>
      <div class="metric-card"><small>حاشیهٔ RAM</small><strong>${decimalFormatter.format(result.headroomGiB)} GiB</strong></div>
    </div>
    <div class="warning-callout"><strong>${result.fits ? "از نظر ظرفیت: قابل جای‌گیری" : "از نظر ظرفیت: غیرقابل جای‌گیری"}</strong><br>${escapeHtml(result.grade)} — ${escapeHtml(result.model.caveat)}</div>
    <ul class="warning-list">${result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`;
}

function renderSampling() {
  const input = Number(document.querySelector("#digit-input").value);
  const temperature = Number(document.querySelector("#temperature").value);
  const topK = Number(document.querySelector("#top-k").value);
  const topP = Number(document.querySelector("#top-p").value);
  const frequency = Number(document.querySelector("#frequency-penalty").value);
  const presence = Number(document.querySelector("#presence-penalty").value);
  const repetition = Number(document.querySelector("#repetition-penalty").value);
  const effort = document.querySelector("#reasoning-effort").value;
  document.querySelector("#temperature-output").textContent = decimalFormatter.format(temperature);
  document.querySelector("#top-k-output").textContent = numberFa(topK);
  document.querySelector("#top-p-output").textContent = decimalFormatter.format(topP);
  document.querySelector("#frequency-output").textContent = decimalFormatter.format(frequency);
  document.querySelector("#presence-output").textContent = decimalFormatter.format(presence);
  document.querySelector("#repetition-output").textContent = decimalFormatter.format(repetition);

  const target = input === 9 ? 1 : input + 1;
  const logits = Array.from({ length: 10 }, (_, digit) => {
    const ringDistance = Math.min(Math.abs(digit - target), 10 - Math.abs(digit - target));
    let logit = 5.7 - ringDistance * 1.12;
    const count = digit === input ? 1 : 0;
    logit -= count * frequency;
    logit -= count > 0 ? presence : 0;
    if (count > 0) logit = logit >= 0 ? logit / repetition : logit * repetition;
    return logit;
  });
  const distribution = samplingDistribution(logits, { temperature, topK, topP });
  const byIndex = new Map(distribution.map((item) => [item.index, item.probability]));
  const bars = Array.from({ length: 10 }, (_, digit) => ({ digit, probability: byIndex.get(digit) ?? 0 }))
    .sort((a, b) => b.probability - a.probability)
    .map((item) => `<div class="sampling-row"><strong>${item.digit}</strong><div class="bar-track"><div class="bar-fill" style="width:${item.probability * 100}%"></div></div><span>${(item.probability * 100).toFixed(1)}%</span></div>`).join("");
  const effortFlows = {
    low: ["خواندن مسئله", "پاسخ مستقیم"],
    medium: ["خواندن", "طرح کوتاه", "محاسبه", "پاسخ"],
    high: ["خواندن", "چند مسیر", "ابزار/RAG", "verifier", "بازنگری", "پاسخ"],
  };
  document.querySelector("#sampling-result").innerHTML = `
    <h3>۲. توزیع نهایی روی واژگان ۰ تا ۹</h3>
    <p class="summary">برای ورودی <strong>${numberFa(input)}</strong>، الگوی آموخته‌شده token بعدی را <strong>${numberFa(target)}</strong> ترجیح می‌دهد. در مسئلهٔ «۹ → ۱۰»، مدل autoregressive باید دو گام جدا تولید کند: ابتدا token «۱»، سپس token «۰»؛ واژگان تک‌رقمی مانع ساخت رشتهٔ چندرقمی نمی‌شود.</p>
    <div class="sampling-bars">${bars}</div>
    <div class="flow-box"><header><h3>Effort انتخابی</h3><span class="claim-badge">CONCEPTUAL</span></header><div class="flow-track">${effortFlows[effort].map((step, index) => `${index ? '<span class="flow-arrow">←</span>' : ""}<div class="flow-step">${escapeHtml(step)}</div>`).join("")}</div></div>
    <div class="warning-callout">Top-k و Top-p پس از ساخت احتمال، دامنهٔ انتخاب را می‌بُرند. Penalty قبل از softmax، logit tokenهای قبلاً دیده‌شده را کم می‌کند. این مثال آموزشی sample واقعی مدل آموزش‌دیده نیست.</div>`;
}

function renderComparison() {
  const left = CATALOG_BY_ID.get(document.querySelector("#compare-a").value);
  const right = CATALOG_BY_ID.get(document.querySelector("#compare-b").value);
  const rows = [
    ["خانواده", CATEGORIES[left.category].label, CATEGORIES[right.category].label],
    ["معماری", left.architecture, right.architecture],
    ["ورودی", left.input, right.input],
    ["خروجی", left.output, right.output],
    ["اندازه", left.params, right.params],
    ["محاسبه", left.compute, right.compute],
    ["داده", left.data, right.data],
    ["مجوز", left.license, right.license],
    ["فلو", left.process.join(" ← "), right.process.join(" ← ")],
  ];
  document.querySelector("#compare-result").innerHTML = `<table class="comparison-table"><thead><tr><th>معیار</th><th>${escapeHtml(left.title)}</th><th>${escapeHtml(right.title)}</th></tr></thead><tbody>${rows.map((row) => `<tr><th>${escapeHtml(row[0])}</th><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td></tr>`).join("")}</tbody></table>`;
}

function renderDocs(nodeId = state.selectedId) {
  const node = CATALOG_BY_ID.get(nodeId) ?? CATALOG_BY_ID.get(state.selectedId);
  document.querySelector("#docs-nav").innerHTML = `
    <button class="docs-section active" data-doc-section="node">مدخل انتخابی: ${escapeHtml(node.title)}</button>
    <button class="docs-section" data-doc-section="claims">راهنمای مرز ادعا</button>
    <button class="docs-section" data-doc-section="cpu">DeepSeek و CPU</button>
    <button class="docs-section" data-doc-section="media">تصویر، ویدئو و صدا</button>
    <button class="docs-section" data-doc-section="rag">RAG، ابزار و agent</button>
    <button class="docs-section" data-doc-section="sampling">نمونه‌گیری و effort</button>
    <button class="docs-section" data-doc-section="agentic">Harness، Context و Orchestration</button>`;
  renderDocsSection("node", node.id);
}

function renderDocsSection(section, nodeId = state.selectedId) {
  const node = CATALOG_BY_ID.get(nodeId) ?? CATALOG_BY_ID.get(state.selectedId);
  const content = {
    node: `<span class="eyebrow">DOC / ${escapeHtml(node.id)}</span><h3>${escapeHtml(node.title)}</h3><p>${escapeHtml(node.summary)}</p><h4>ماهیت معماری</h4><p>${escapeHtml(node.architecture)}. ورودی این سامانه «${escapeHtml(node.input)}» و خروجی آن «${escapeHtml(node.output)}» است.</p><h4>ردیابی عملیات</h4><ol>${node.process.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol><h4>مرز اجرا</h4><p>${escapeHtml(node.compute)}</p><h4>داده و مجوز</h4><p>${escapeHtml(node.data)} ${escapeHtml(node.license)}</p><div class="detail-actions">${sourceButton(node.repo, "مخزن رسمی")}${node.paper ? sourceButton(node.paper, "مقاله") : ""}</div>`,
    claims: `<span class="eyebrow">DOC / CLAIM CONTRACT</span><h3>چه چیزی در این برنامه واقعی است؟</h3><ul><li><strong>واقعی و محلی:</strong> پوستهٔ Windows، graph، renderer Three.js، جست‌وجو، فیلتر، محاسبات estimator و نمونه‌گیری نمایشی.</li><li><strong>source-backed:</strong> شرح معماری‌ها که به repo یا مقالهٔ سازنده پیوند دارد.</li><li><strong>مدل‌سازی مفهومی:</strong> cube، مدار، موج، latent و frameهای صحنه؛ tensor اجرای مدل نیستند.</li><li><strong>در دسترس نیست:</strong> وزن‌های DeepSeek، FLUX، HunyuanVideo و سایر checkpointها همراه EXE نیستند.</li></ul><p>هر ادعای سرعت یا کیفیت به سخت‌افزار، نسخه و تنظیمات وابسته است. «supported on CPU» با «سریع روی CPU من» برابر نیست.</p>`,
    cpu: `<span class="eyebrow">DOC / CPU INFERENCE</span><h3>DeepSeek دقیقاً چگونه روی CPU قرار می‌گیرد؟</h3><ol><li>checkpoint سازگار دریافت و مجوزش بررسی می‌شود.</li><li>tensorها و metadata در GGUF قرار می‌گیرند؛ GGUF معماری جدید نیست.</li><li>quantization تعداد بیت وزن را کم می‌کند و ممکن است کیفیت را تغییر دهد.</li><li>llama.cpp وزن را map و graph محاسبه را برای ISA/هسته‌ها اجرا می‌کند.</li><li>KV cache context پیشین را نگه می‌دارد.</li><li>sampler از logits token بعدی را انتخاب می‌کند.</li></ol><p>در MoE، router FLOP فعال را محدود می‌کند اما تمام expertها باید ذخیره شوند. برای کاربر معمولی، R1 Distill کوچک‌تر مسیر واقع‌بینانه‌تری از R1 کامل ۶۷۱B است.</p>`,
    media: `<span class="eyebrow">DOC / GENERATIVE MEDIA</span><h3>یک واژه، چند معماری</h3><h4>تصویر</h4><p>Latent diffusion از noise به latent منظم می‌رسد و VAE آن را decode می‌کند؛ rectified flow یک میدان سرعت برای مسیر انتقال می‌آموزد.</p><h4>ویدئو</h4><p>latent فضایی-زمانی و video VAE پیوستگی frameها را اضافه می‌کنند؛ همین محور زمان حافظه و محاسبه را سنگین‌تر می‌کند.</p><h4>صدا</h4><p>ASR مانند Whisper waveform را به متن می‌برد؛ MusicGen tokenهای codec را autoregressive تولید می‌کند؛ audio diffusion در latent صوتی denoise می‌کند. این‌ها وظیفه و معماری یکسانی ندارند.</p>`,
    rag: `<span class="eyebrow">DOC / AUGMENTED SYSTEMS</span><h3>RAG و agent داخل وزن نیستند</h3><p>RAG query را embed، سندها را top-k بازیابی، در صورت نیاز rerank و سپس evidence را وارد prompt می‌کند. دانش تازه در همان لحظه وزن مدل را تغییر نمی‌دهد و retrieval تضمین صحت نیست.</p><p>Agent چرخهٔ مشاهده → برنامه → ابزار → نتیجه → بازبینی است. ACL ابزار، بودجه، timeout، ثبت منبع و توقف امن وظیفهٔ میزبان‌اند. MoE نیز agent نیست؛ router داخل شبکه فقط expert عددی را انتخاب می‌کند.</p>`,
    sampling: `<span class="eyebrow">DOC / DECODING</span><h3>پارامترها در کجای الگوریتم اثر می‌گذارند؟</h3><p><code>temperature</code> logits را مقیاس می‌کند؛ <code>top-k</code> فقط k گزینهٔ بالاتر و <code>top-p</code> کوچک‌ترین مجموعه با احتمال تجمعی p را نگه می‌دارد. presence/frequency penalty بر اساس دیده‌شدن token، logit را پیش از softmax کم می‌کنند.</p><p>Effort بودجه یا workflow بیشتر است. self-consistency چند پاسخ را نمونه می‌گیرد؛ verifier پاسخ را می‌سنجد؛ RAG سند می‌آورد؛ ابزار محاسبهٔ خارجی انجام می‌دهد. هیچ‌کدام مترادف هم یا تضمین حقیقت نیستند.</p>`,
    agentic: `<span class="eyebrow">DOC / AGENTIC ENGINEERING</span><h3>Model، Agent، Harness و Orchestrator یک چیز نیستند</h3><p><strong>Model</strong> از context خروجی می‌سازد؛ <strong>Agent</strong> با مشاهده و اقدام یک هدف را دنبال می‌کند؛ <strong>Harness</strong> حلقه، state، ابزار، policy، budget و trace را کنترل می‌کند؛ <strong>Orchestrator</strong> مالکیت و وابستگی taskها را میان عامل‌ها یا گره‌های workflow هماهنگ می‌کند.</p><h4>Context Engineering</h4><p>منابع با provenance و trust جمع می‌شوند، سپس dedupe، retrieval، ranking، token budgeting و compaction روی آن‌ها اعمال می‌شود. متن بازیابی‌شده داده است و نباید خودکار به دستور یا مجوز تبدیل شود.</p><h4>پروتکل‌ها</h4><p>AG-UI برای جریان عامل به رابط، A2A برای همکاری عامل مستقل و MCP برای اتصال host به ابزار/منبع به‌کار می‌روند. JSON Schema شکل داده، OAuth واگذاری مجوز و OpenTelemetry مشاهده‌پذیری را پوشش می‌دهند؛ هیچ‌کدام به‌تنهایی sandbox یا صحت تصمیم را تضمین نمی‌کند.</p><h4>مرز این نسخه</h4><p>اتاق فرمان یک شبیه‌ساز event-sourced و قطعی است. tick، worker، tool و approval همگی محلی و بدون اثر خارجی‌اند؛ نمایش trace معادل افشای زنجیرهٔ فکر پنهان نیست.</p>`,
  };
  document.querySelector("#docs-article").innerHTML = content[section] ?? content.node;
  document.querySelectorAll(".docs-section").forEach((button) => button.classList.toggle("active", button.dataset.docSection === section));
}

let scene = new SceneController({
  canvas: document.querySelector("#graph-canvas"),
  onSelect: (id) => selectNode(id),
  onFallback: (message) => setView("2d", message),
  onMode: (mode) => {
    state.renderMode = mode;
    elements.renderStatus.textContent = mode;
  },
});
const agenticLab = createAgenticLab({
  dialog: document.querySelector("#agentic-dialog"),
  scene,
  motion: state.motion,
});
const researchLab = createResearchLab({
  dialog: document.querySelector("#research-dialog"),
  scene,
});

renderTree();
renderDetail();
renderTour();
makeFallbackMap();
scene?.select(state.selectedId);

document.addEventListener("click", (event) => {
  const external = event.target.closest(".external-link");
  if (external) openExternal(external.dataset.url);

  const nodeButton = event.target.closest("[data-node-id]");
  if (nodeButton?.id === "focus-node") scene?.focus(nodeButton.dataset.nodeId);
  else if (nodeButton) selectNode(nodeButton.dataset.nodeId, { focusHeading: nodeButton.classList.contains("tree-node") });

  const categoryButton = event.target.closest(".category-button");
  if (categoryButton) {
    state.category = categoryButton.dataset.category;
    document.querySelectorAll(".category-button").forEach((button) => {
      const active = button === categoryButton;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    scene?.filter(state.category);
    renderTree();
  }

  const exhibit = event.target.closest("[data-exhibit]");
  if (exhibit) {
    const type = exhibit.dataset.exhibit;
    document.querySelectorAll(".exhibit-button").forEach((button) => button.classList.toggle("active", button.dataset.exhibit === type));
    if (type === "graph") scene?.showGraph();
    else scene?.setExhibit(type);
    if (type === "agentic" && exhibit.classList.contains("exhibit-button")) agenticLab.open();
    if (type === "research" && exhibit.classList.contains("exhibit-button")) researchLab.open();
    document.querySelector("#stage-heading").textContent = type === "graph" ? "هسته، وزن، داده و مسیر تولید" : `نمای تشریحی ${type}`;
  }

  const docButton = event.target.closest(".doc-node");
  if (docButton) {
    renderDocs(docButton.dataset.docId);
    openDialog("docs-dialog");
  }

  const docsSection = event.target.closest(".docs-section");
  if (docsSection) renderDocsSection(docsSection.dataset.docSection);

  const closer = event.target.closest("[data-close]");
  if (closer) document.querySelector(`#${closer.dataset.close}`)?.close();
});

elements.search.addEventListener("input", () => {
  state.query = elements.search.value;
  renderTree();
});

elements.tree.addEventListener("keydown", (event) => {
  if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...elements.tree.querySelectorAll(".tree-node")];
  const current = buttons.indexOf(document.activeElement);
  const next = event.key === "ArrowDown" ? Math.min(buttons.length - 1, current + 1) : Math.max(0, current - 1);
  buttons[next]?.focus();
});

elements.fallback.addEventListener("click", (event) => {
  const node = event.target.closest("[data-node-id]");
  if (node) selectNode(node.dataset.nodeId);
});
elements.fallback.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.dataset.nodeId) {
    event.preventDefault();
    selectNode(event.target.dataset.nodeId);
  }
});

document.querySelector("#view-2d").addEventListener("click", () => setView("2d"));
document.querySelector("#view-3d").addEventListener("click", () => setView("3d"));
document.querySelector("#motion-toggle").addEventListener("click", (event) => {
  state.motion = !state.motion;
  event.currentTarget.setAttribute("aria-pressed", String(state.motion));
  event.currentTarget.textContent = state.motion ? "حرکت: روشن" : "حرکت: خاموش";
  scene?.setMotion(state.motion);
});
document.querySelector("#tour-previous").addEventListener("click", () => {
  state.tourIndex = Math.max(0, state.tourIndex - 1);
  renderTour();
});
document.querySelector("#tour-next").addEventListener("click", () => {
  state.tourIndex = state.tourIndex === TOUR_STOPS.length - 1 ? 0 : state.tourIndex + 1;
  renderTour();
});
document.querySelector("#tour-focus").addEventListener("click", () => {
  const stop = TOUR_STOPS[state.tourIndex];
  selectNode(stop.id, { focus: true });
  const node = CATALOG_BY_ID.get(stop.id);
  if (node?.exhibit && node.exhibit !== "graph") scene?.setExhibit(node.exhibit);
});

document.querySelector("#cpu-open").addEventListener("click", () => {
  renderCpuResult();
  scene?.setExhibit("cpu");
  openDialog("cpu-dialog");
});
document.querySelector("#agentic-open").addEventListener("click", () => agenticLab.open());
document.querySelector("#research-open").addEventListener("click", () => researchLab.open());
document.querySelector("#sampling-open").addEventListener("click", () => {
  renderSampling();
  openDialog("sampling-dialog");
});
document.querySelector("#compare-open").addEventListener("click", () => {
  renderComparison();
  openDialog("compare-dialog");
});
document.querySelector("#sources-open").addEventListener("click", () => openDialog("sources-dialog"));
document.querySelector("#docs-open").addEventListener("click", () => {
  renderDocs();
  openDialog("docs-dialog");
});

document.querySelector("#cpu-controls").addEventListener("input", renderCpuResult);
document.querySelector("#sampling-controls").addEventListener("input", renderSampling);
document.querySelector("#compare-a").addEventListener("change", renderComparison);
document.querySelector("#compare-b").addEventListener("change", renderComparison);

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
    event.preventDefault();
    elements.search.focus();
  }
  if (event.key === "2" && !event.ctrlKey && !event.metaKey) setView("2d");
  if (event.key === "3" && !event.ctrlKey && !event.metaKey) setView("3d");
  if (event.key.toLowerCase() === "t" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) document.querySelector("#tour-focus").click();
  if (event.key.toLowerCase() === "a" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) agenticLab.open();
  if (event.key.toLowerCase() === "r" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) researchLab.open();
});

async function hydrateSystemInfo() {
  try {
    if (window.desktopLab?.getSystemInfo) state.systemInfo = await window.desktopLab.getSystemInfo();
  } catch {
    // Browser development mode intentionally has only coarse navigator facts.
  }
  const ram = Math.max(4, Math.round(state.systemInfo.totalRamGiB || 16));
  const cores = Math.max(1, state.systemInfo.logicalCores || navigator.hardwareConcurrency || 8);
  document.querySelector("#ram-gib").value = String(Math.min(512, Math.round(ram / 4) * 4));
  document.querySelector("#cpu-cores").value = String(Math.min(128, cores));
  document.querySelector("#system-facts").textContent = `${state.systemInfo.cpuModel}\n${state.systemInfo.platform} / ${state.systemInfo.arch} · ${cores} logical cores · ${ram.toFixed(1)} GiB RAM\nApp ${state.systemInfo.appVersion} · ${state.systemInfo.packaged ? "packaged EXE" : "development mode"}`;
  renderCpuResult();
}

hydrateSystemInfo();
window.addEventListener("beforeunload", () => scene?.dispose(), { once: true });
