import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { RESEARCH_SOURCES, USER_DATA_LAYERS } from "../src/researchCatalog.js";
import { researchDialogTemplate } from "../src/researchUi.js";

const EXPECTED_TABS = [
  "program",
  "lifecycle",
  "systems",
  "applications",
  "protocols",
  "abliteration",
  "alefba",
  "benchmarks",
];

const source = await readFile(new URL("../src/researchUi.js", import.meta.url), "utf8");
const template = researchDialogTemplate();

const captures = (value, expression) => [...value.matchAll(expression)].map((match) => match[1]);

test("research observatory exposes exactly eight unique, renderable tabs", () => {
  const navigationTabs = captures(template, /data-research-tab="([a-z]+)"/g);
  const pageIds = captures(source, /data-page="([a-z]+)"/g);
  const rendererBlock = source.split("const pageRenderers = {", 2)[1]?.split("};", 1)[0] ?? "";
  const rendererIds = captures(rendererBlock, /^\s{4}([a-z]+):\s*\(\)/gm);

  assert.deepEqual(navigationTabs, EXPECTED_TABS);
  assert.deepEqual(pageIds, EXPECTED_TABS);
  assert.deepEqual(rendererIds, EXPECTED_TABS);
  assert.equal(new Set(navigationTabs).size, 8);
  assert.equal(template.match(/aria-current="page"/g)?.length, 1, "only the initial tab is current");
  assert.match(template, /id="research-stage"[^>]*tabindex="-1"/);
  assert.match(template, /id="research-announcer"[^>]*aria-live="polite"/);
  assert.match(source, /stage\.focus\(\{ preventScroll: true \}\)/);
});

test("execution, deterministic simulation and external modes remain visibly distinct", () => {
  const modes = captures(template, /class="mode-pill ([a-z]+)"/g);
  assert.deepEqual(modes, ["executable", "simulated", "external"]);
  assert.match(template, /MICRO EXECUTABLE/);
  assert.match(template, /DETERMINISTIC SIMULATION/);
  assert.match(template, /EXTERNAL · OPT-IN ONLY/);
  assert.match(template, /مستند عمومی/);
  assert.match(template, /شبیه‌سازی/);
  assert.match(template, /نامعلوم\/اختصاصی/);
  assert.match(source, /documented:\s*"واقعیت مستند"/);
  assert.match(source, /simulated:\s*"شبیه‌سازی قطعی"/);
  assert.match(source, /proprietary:\s*"اختصاصی \/ ناشناخته"/);
  assert.match(source, /executable:\s*"اجرای میکرو"/);
  assert.match(source, /هر صفحه واقعیت مستند، محاسبهٔ محلی و شبیه‌سازی را جدا نگه می‌دارد/);
});

test("the assurance dock and Decision Lab use the exact I/R/U/O contract", () => {
  const receipt = [...template.matchAll(/<div><span>([IRUO])<\/span><strong>([^<]+)<\/strong>/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(receipt, [
    ["I", "Integrity"],
    ["R", "Representation"],
    ["U", "Uptake"],
    ["O", "Outcome"],
  ]);
  for (const layer of ["I", "R", "U", "O"]) {
    assert.match(source, new RegExp(`packet\\.receipt\\.${layer}\\)`));
  }
  assert.match(source, /I\/R را می‌توان ساختاری سنجید/);
  assert.match(source, /U\/O تا وقتی مصرف واقعی و outcome بیرونی شاهد نداشته باشند UNKNOWN می‌مانند/);
  assert.match(template, /authorization، consent و outcome شاهد جدا می‌خواهند/);
});

test("Abliteration UI keeps the educational experiment synthetic and safety-bounded", () => {
  assert.match(source, /Abliteration: حذف projection، نه حذف اثبات‌شدهٔ یک مفهوم/);
  assert.match(source, /می‌تواند safeguard را تضعیف کند/);
  assert.match(source, /هیچ checkpoint، activation یا وزن مدل واقعی خوانده، اصلاح یا صادر نمی‌شود/);
  assert.match(source, /برای ساخت مدل safety-removed قابل استفاده نیست/);
  assert.match(source, /بردارهای مصنوعی پیش و پس از projection/);
  assert.match(source, /result\.metrics\.safety\.before/);
  assert.match(source, /result\.metrics\.safety\.after/);
  assert.match(source, /result\.metrics\.capability\.before/);
  assert.match(source, /result\.metrics\.capability\.after/);
  assert.match(source, /result\.metrics\.projectionReduction/);
  assert.match(source, /result\.claimBoundary/);
  assert.match(source, /آزمون before\/after باید هم capability و هم safety را جدا اندازه بگیرد/);
});

test("research UI has no direct network, dynamic evaluation or execution primitive", () => {
  for (const forbidden of [
    "fetch(",
    "WebSocket",
    "XMLHttpRequest",
    "eval(",
    "new Function",
    "node:fs",
    "child_process",
  ]) assert.equal(source.includes(forbidden), false, `researchUi.js must not contain ${forbidden}`);
  assert.match(source, /dry-run/);
  assert.match(source, /شبکه، فایل، ابزار و side effect ندارند/);
});

test("documentation affordances are buttons with validated HTTPS source records", () => {
  assert.match(source, /function sourceAction\(item, label = "منبع اصلی"\)/);
  assert.ok(source.includes('/^https:\\/\\//i'), "source buttons must accept only HTTPS URLs");
  assert.match(source, /<button class="source external-link" data-url=/);
  assert.match(source, /Doc \/ منبع علمی/);
  assert.match(source, /<details class="research-info"/);
  assert.match(source, /TYPED SOURCE REGISTRY/);
  assert.match(source, /sourceAction\(source, "بازکردن منبع"\)/);

  assert.ok(RESEARCH_SOURCES.length >= 20, "the research UI needs a substantial source registry");
  assert.equal(new Set(RESEARCH_SOURCES.map(({ id }) => id)).size, RESEARCH_SOURCES.length);
  for (const item of RESEARCH_SOURCES) {
    assert.equal(typeof item.id, "string");
    assert.ok(item.id.trim());
    assert.equal(new URL(item.url).protocol, "https:", `${item.id} must use HTTPS`);
    assert.ok(item.title?.trim(), `${item.id} needs a title`);
  }
});

test("all user-information locations expose persistence and weight-change boundaries", () => {
  const requiredLocations = [
    "request",
    "session-history",
    "project-instructions",
    "retrieval-corpus",
    "saved-memory",
    "workspace-and-tools",
    "fine-tuning-dataset",
    "telemetry-feedback",
  ];
  const ids = USER_DATA_LAYERS.map(({ id }) => id);
  assert.deepEqual(ids, requiredLocations);
  assert.equal(new Set(ids).size, ids.length);
  for (const layer of USER_DATA_LAYERS) {
    assert.equal(typeof layer.weightsChange, "boolean", `${layer.id}.weightsChange must be explicit`);
    assert.ok(layer.persistenceScope?.trim(), `${layer.id}.persistenceScope is required`);
    assert.ok(layer.injectionPoint?.trim(), `${layer.id}.injectionPoint is required`);
    assert.ok(layer.contentsFa?.trim(), `${layer.id}.contentsFa is required`);
    assert.ok(layer.boundaryFa?.trim(), `${layer.id}.boundaryFa is required`);
  }
  assert.equal(USER_DATA_LAYERS.filter(({ weightsChange }) => weightsChange).length, 1);
  assert.equal(USER_DATA_LAYERS.find(({ id }) => id === "fine-tuning-dataset").weightsChange, true);
  assert.equal(USER_DATA_LAYERS.find(({ id }) => id === "saved-memory").weightsChange, false);

  assert.match(source, /WHERE DOES USER-SPECIFIC INFORMATION LIVE\?/);
  assert.match(source, /const userLayers = asArray\(USER_DATA_LAYERS\)/);
  assert.match(source, /userLayers\.map/);
  assert.match(source, /"weightsChange", "weightChange"/);
  assert.match(source, /"persistenceScope", "scope"/);
  assert.match(source, /RAG، تاریخچه و بیشتر memoryها عملیات زمان استنتاج‌اند/);
  assert.match(source, /جزئیات وزن، داده و pipeline داخلی منتشر نشده و در این آزمایشگاه UNKNOWN می‌ماند/);
});
