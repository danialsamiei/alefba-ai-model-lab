# راهنمای مهندسی سامانه‌های عامل‌محور

این سند همراه نسخهٔ 0.5.0 آزمایشگاه است و اصطلاح «Agentical» کاربر را با نام
فنی رایج‌تر **Agentic Systems / سامانه‌های عامل‌محور** توضیح می‌دهد. وضعیت
نسخه‌های بیرونی در ۳۱ اوت ۲۰۲۶ بررسی شده است؛ هنگام ساخت سامانهٔ واقعی باید
نسخه‌ها دوباره pin و آزمون سازگاری اجرا شوند.

## ۱. مرز مفاهیم

| جزء | تصمیم اصلی | چه چیزی نیست؟ |
|---|---|---|
| Model | از context، token یا action ساختاری پیشنهاد می‌کند | مجری خودکار سیستم‌عامل نیست |
| Agent | هدف را در چرخهٔ مشاهده، اقدام و بازبینی دنبال می‌کند | الزاماً چندعامل یا هوشمندِ بی‌قید نیست |
| Harness | loop، state، policy، ابزار، budget، retry و trace را کنترل می‌کند | استاندارد واحد و جهانی نیست |
| Orchestrator | task، مالک، dependency، parallelism، handoff و join را هماهنگ می‌کند | معادل router داخل MoE نیست |
| Workflow | مسیر و گذارهای عمدتاً صریح را اجرا می‌کند | آزادی تصمیم کامل مدل نیست |
| Context Compiler | ورودی قابل مشاهدهٔ هر inference را انتخاب و بسته‌بندی می‌کند | fine-tune یا تغییر وزن نیست |
| RAG | شاهد بیرونی را برای context جاری بازیابی می‌کند | حافظه یا یادگیری دائمی مدل نیست |

نمای لایه‌ای:

```text
User goal / UI
       ↓
Agent Harness ───────────── Policy · Auth · Approval
       ↓
Orchestrator / State machine
       ↓
Context Compiler → Model → Action proposal
       ↓
Tool · Retrieval · Memory adapters
       ↓
Observation → Verify → Checkpoint → Stop

Trace · Metrics · Evals · Replay روی تمام لایه‌ها اثر دارند.
```

## ۲. حلقهٔ Harness

Harness خوب باید state قابل مشاهده داشته باشد و اجرای آن با رویدادهای مشخص
قابل بازسازی باشد:

1. `RUN_STARTED`: هدف، مالک و بودجه ثبت می‌شود.
2. `CONTEXT_BUILD_*`: منبع، trust، freshness و token محاسبه می‌شود.
3. `MODEL_REQUEST`: فقط context و ابزار مجاز به مدل داده می‌شود.
4. `PLAN_CREATED/TASK_DISPATCHED`: task و مالک صریح می‌شوند.
5. `TOOL_PROPOSED`: خروجی مدل هنوز فقط داده است.
6. `POLICY/APPROVAL`: schema، scope، ریسک و رضایت بررسی می‌شود.
7. `TOOL_STARTED/RESULT`: adapter محدود اجرا و observation اعتبارسنجی می‌شود.
8. `VERIFIER/CHECKPOINT/RUN_COMPLETED`: شاهد، state و شرط پایان ثبت می‌شود.

ماشین حالت حداقلی:

```text
IDLE → RUNNING ─┬→ WAITING_TOOL ───────┐
                ├→ WAITING_APPROVAL ───┤
                ├→ WAITING_CHILDREN ───┤
                └→ VERIFYING ──────────┤
                                       ↓
             SUCCEEDED | FAILED | CANCELLED | POLICY_BLOCKED
```

حالت terminal تغییرناپذیر است. پس از پایان فقط یک Run تازه یا reset مجاز است.

## ۳. Context Engineering

Context تمام چیزی است که مدل در یک inference می‌بیند، نه فقط پیام کاربر:

- policy و system instruction؛
- هدف و task جاری؛
- history و working state؛
- سند RAG و citation؛
- schema ابزارهای واقعاً مجاز؛
- observation ابزار؛
- حافظهٔ انتخاب‌شده؛
- output schema و budget reserve.

چرخهٔ پیشنهادی:

```text
Collect → Type/Provenance → Trust/Freshness → Dedupe
→ Rank → Token Budget → Serialize → Invoke
→ Persist outcome → Compact/Evict → Checkpoint
```

### ۳.۱ قرارداد هر قطعه

```js
{
  id: "doc-refund-policy-v7",
  kind: "policy | goal | history | rag-document | tool-result | memory",
  authority: "policy | user | none",
  trust: "trusted | verified-tool | untrusted-retrieval",
  priority: 92,
  relevance: 0.87,
  tokens: 760,
  pinned: true,
  sourceRefs: ["sha256:..."],
  taint: [],
  displayTextFa: "سیاست بازپرداخت"
}
```

`authority` و `trust` یکی نیستند. سند معتبر علمی می‌تواند trusted evidence باشد،
اما اجازه ندارد policy سامانه را عوض کند. متن RAG باید به‌صورت دادهٔ غیرقابل
اعتماد باقی بماند؛ دستور نهفته در آن، مجوز ابزار تولید نمی‌کند.

### ۳.۲ بودجه

```text
available input = context window
                − reserved output
                − tool schema reserve
                − safety reserve
```

اولویت معمول: policy pinned، هدف جاری، schema لازم، observation فعال، evidence،
working memory و سپس history. Compaction ذاتاً lossy است و باید نسبت
فشرده‌سازی، منبع اصلی و فهرست حذف را نگه دارد. مقالهٔ
[Lost in the Middle](https://arxiv.org/abs/2307.03172) نشان می‌دهد قرارگرفتن
اطلاعات در پنجره به‌تنهایی به معنی استفادهٔ یکنواخت از آن نیست.

### ۳.۳ حافظه

| حافظه | دامنه | نمونه | خطر اصلی |
|---|---|---|---|
| Working | همان Run | task فعال و نتیجهٔ ابزار | سرریز context |
| Episodic | رخدادهای قبلی | event log و outcome | نگهداری بی‌پایان |
| Semantic | واقعیت استخراج‌شده | ترجیح کاربر با منبع | پایدارشدن واقعیت غلط |
| Procedural | روش و policy | قرارداد tool و runbook | policy کهنه |

نوشتن حافظه باید approval، namespace، TTL، PII policy و correction log مستقل
داشته باشد. خواندن حافظه نیز retrieval است، نه حقیقت قطعی.

## ۴. الگوهای Orchestration

| الگو | مناسب برای | مزیت | شکست محتمل |
|---|---|---|---|
| Prompt chain | مسیر ثابت | ساده و قابل تست | انعطاف کم |
| Router | یکی از چند تخصص | کاهش context/tool اضافی | route غلط |
| Fan-out/Fan-in | subtasks مستقل | latency کمتر | partial join و هزینه |
| Planner/Executor | مسئلهٔ چندگامی | طرح صریح | طرح شکننده |
| Supervisor/Workers | تقسیم پویا | تخصص و ownership | گلوگاه supervisor |
| Handoff | انتقال مالک گفتگو/task | استقلال عامل | نشت یا افت context |
| Evaluator/Optimizer | خروجی قابل rubric | اصلاح کنترل‌شده | حلقهٔ بی‌پایان |
| DAG/Workflow | فرایند تکرارشونده | replay و checkpoint | schema/cycle drift |
| Blackboard | state مشترک چندعامل | همکاری غیرخطی | race و stale state |
| Debate | نامزد و نقد مستقل | آشکارشدن اختلاف | groupthink و هزینه |

قاعدهٔ انتخاب: اگر مسیر از پیش روشن و اثر جانبی مهم است، workflow صریح معمولاً
قابل‌آزمون‌تر است. آزادی عامل فقط جایی افزوده شود که انتخاب پویای گام واقعاً
ارزش دارد.

## ۵. Tool، اختیار و Approval

ترتیب fail-closed:

```text
Action proposal
→ JSON Schema
→ identity + capability grant
→ resource/tenant scope
→ token/tool/cost budget
→ circuit state
→ taint / injection boundary
→ approval binding
→ isolated execution
→ output schema + guardrail
→ audit event
```

Approval باید به `(taskId, toolId, canonicalArgsHash, resource, expiry, nonce)`
متصل باشد. تغییر یک آرگومان، approval قبلی را باطل می‌کند. برای retry عملیات
نوشتنی، idempotency key لازم است؛ خطای schema، policy، ACL یا prompt injection
نباید retry شود.

## ۶. MCP، A2A و AG-UI

```text
User
  ↕ AG-UI: eventهای رابط و state
Frontend
  ↕
Harness / Orchestrator
  ↔ A2A: Agent Card، Task، Message و Artifact ↔ Independent Agent
  ↕ MCP: tool/resource/prompt
Service · Data · Tool
```

### MCP

[MCP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
یک معماری client-host-server با core بی‌حالت است. هر request نسخه و capability
خود را حمل می‌کند و `server/discover` اختیاری است. Host مسئول permission، consent،
authorization، isolation و context aggregation می‌ماند. در تعریف tool، input
و output schema شکل داده را مشخص می‌کنند و annotationهای tool غیرقابل اعتمادند
مگر از server مورد اعتماد آمده باشند. برای اقدام اثرگذار، رابط باید human-in-loop
و امکان deny داشته باشد.

### A2A

[A2A 1.0.0](https://a2a-protocol.org/latest/specification/) برای تعامل عامل‌های
مستقل و بالقوه opaque است. Agent Card قابلیت را معرفی می‌کند؛ Message/Part،
Task lifecycle و Artifact داده و نتیجه را حمل می‌کنند. A2A جای MCP نیست: اولی
مرز agent-to-agent و دومی مرز host-to-server/tool را پوشش می‌دهد.

### AG-UI

[AG-UI](https://docs.ag-ui.com/concepts/events) eventهای lifecycle، پیام، tool،
state snapshot/delta و activity را میان عامل و frontend جریان می‌دهد. Snapshot
برای همگام‌سازی کامل و Delta برای JSON Patch ترتیبی است. reasoning eventها نیز
نباید به معنی افشای raw chain-of-thought تفسیر شوند؛ summary قابل نمایش یا
artifact رمز‌شده با «متن فکر پنهان» فرق دارد.

### قراردادهای عرضی

- [JSON Schema 2020-12](https://json-schema.org/specification): شکل داده؛ نه مجوز.
- [OpenAPI 3.2](https://spec.openapis.org/oas/v3.2.0.html): قرارداد HTTP؛ نه sandbox.
- [OAuth Security BCP / RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html):
  واگذاری مجوز و حفاظت token؛ authentication با authorization یکی نیست.
- [W3C Trace Context](https://www.w3.org/TR/trace-context/): انتشار رابطهٔ trace.
- [OpenTelemetry GenAI conventions](https://github.com/open-telemetry/semantic-conventions-genai):
  نام‌گذاری span/metric؛ قرارداد Agent در زمان این سند هنوز Development است.

## ۷. مشاهده‌پذیری و Evals

Trace باید رخداد ثبت‌شده را نشان دهد، نه ذهن مدل را:

```js
{
  seq: 21,
  tick: 21,
  type: "APPROVAL_REQUIRED",
  actor: "policy-gate",
  target: "human",
  traceId: "trace-...",
  spanId: "span-021",
  parentSpanId: "span-001",
  status: "waiting",
  risk: "high",
  data: { argumentsHash: "..." }
}
```

لایه‌های آزمون:

1. unit test برای schema، budget، reducer و policy؛
2. scenario test برای ordering و invariant؛
3. deterministic replay برای state نهایی؛
4. failure injection برای timeout، 429، worker failure و injection؛
5. eval مجموعه‌ای و regression؛
6. red-team و privacy/security review؛
7. human acceptance برای اثر واقعی و تجربهٔ approval.

هیچ نمرهٔ واحدی جای همهٔ این لایه‌ها را نمی‌گیرد.

## ۸. Failure و Recovery

| Failure | واکنش درست | واکنش خطرناک |
|---|---|---|
| Tool timeout | retry محدود + backoff | retry بی‌نهایت |
| 429 | احترام به limit و deadline | fan-out بیشتر |
| Schema mismatch | reject/repair محدود | اجرای آرگومان خام |
| Prompt injection | حفظ taint و deny اختیار | دنبال‌کردن دستور سند |
| Context overflow | compact/evict/stop صریح | قطع silent policy |
| Worker failure | retry/reroute/degraded result | ادعای تکمیل کامل |
| Approval denied | مسیر read-only یا safe stop | دورزدن گیت |
| Duplicate event | idempotency/dedupe | side effect دوم |
| Partial side effect | compensation/saga | retry کور |

## ۹. آنچه شبیه‌ساز این پروژه تضمین نمی‌کند

- مدل زبانی، MCP server، A2A agent یا tool واقعی اجرا نمی‌شود.
- deterministic simulator به معنی deterministic LLM نیست.
- token count بدون tokenizer checkpoint، عدد دقیق production نیست.
- tick، latency و cost نمایش‌داده‌شده benchmark نیستند.
- تشخیص injection نمایشی، جای ACL، sandbox و approval را نمی‌گیرد.
- Debate، verifier یا رأی اکثریت حقیقت را تضمین نمی‌کند.
- event log بدون امضا، ذخیرهٔ append-only و access control، audit-grade نیست.
- پیاده‌سازی protocol بدون validator/TCK نباید «conformant» نامیده شود.

## ۱۰. مسیر خواندن کد

1. `src/agenticCatalog.js`: نوع، لایه، منبع، failure و control هر مفهوم.
2. `src/agenticSimulation.js`: سناریو، Context compiler، event emitter و snapshot.
3. `src/agenticUi.js`: کنترل Run، approval، topology، timeline و inspector.
4. `src/scene.js`: projection سه‌بعدی؛ منبع حقیقت نیست.
5. `tests/agentic-*.test.mjs`: invariantهای امنیتی و رفتاری.

قانون اصلی dependency این است:

```text
catalog/scenario → pure simulator → DOM/Three projection → Electron shell
```

سرعت پخش، frame rate، WebGL و reduced-motion نباید event log یا نتیجه را تغییر
دهند.
