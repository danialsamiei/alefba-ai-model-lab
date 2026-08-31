# دفتر ادعاها و وضعیت شواهد

وضعیت سند: محافظ ادعاهای پروژه  
تاریخ snapshot: `2026-08-31`

## هدف

این فایل مشخص می‌کند چه چیزی در پروژه واقعاً اجرا شده، چه چیزی صرفاً telemetry است، چه چیزی از
بیرون مدل می‌آید و چه چیزی هنوز پشتوانه ندارد. هر گزارش، API یا UI باید از همین واژگان وضعیت
استفاده کند.

در اجرای مرجع توسعه، دادهٔ نسخه‌بندی‌شده، پنج checkpoint واقعی، SQLite/FTS5، runner، رابط،
آزمون‌ها و گزارش benchmark ساخته شده‌اند. checkpoint و گزارش‌های تولیدی در Git نگه‌داری
نمی‌شوند؛ clone تمیز باید آن‌ها را با `build-data` و `train-all` بازتولید و hashها را ثبت کند.
وضعیت `IMPLEMENTED` فقط برای همین پیاده‌سازی و runهای ثبت‌شده است؛ نتیجه‌های آماری یک seed و
۴۰ نمونه، ادعای عمومی دربارهٔ مدل‌های بزرگ نیستند.

## واژگان وضعیت

### `IMPLEMENTED`

رفتار executable وجود دارد و دست‌کم یک آزمون متناسب با ریسک آن را اجرا کرده است. برای ادعای
نتیجهٔ آموزشی، checkpoint، dataset manifest، config، seed و hash artifact نیز لازم‌اند.

### `TELEMETRY`

یک مشاهده یا مشتق از اجرای سامانه است؛ مانند attention weight، router probability، retrieval
score یا latency. telemetry ممکن است برای تشخیص مفید باشد، اما به‌تنهایی explanation علّی یا
توانمندی جدید نیست.

### `EXTERNAL`

خروجی از بیرون وزن‌های مدل آمده است؛ مانند سند retrieved، نتیجهٔ calculator، ground truth یا
تصمیم ارکستریتور. این داده می‌تواند وارد context شود، اما نباید دانش پارامتری مدل نامیده شود.

### `UNSUPPORTED`

کد اجرایی، آزمون یا artifact کافی وجود ندارد؛ یا نوع ادعا از دادهٔ موجود قابل‌استنتاج نیست. UI
باید این وضعیت را صریح نشان دهد و آن را با مقدار ساختگی، mock بی‌برچسب یا متن موفقیت پنهان نکند.

## نگاشت برچسب‌های اطلس تازه

رابط برای خوانایی فارسی سه برچسب نمایشی دارد:

| برچسب رابط | نگاشت دفتر ادعا | معنی |
|---|---|---|
| `اجراشده` | `IMPLEMENTED` | کد/وزن و آزمون متناسب در snapshot حاضر وجود دارد |
| `مدل تشریحی` | `UNSUPPORTED` برای ادعای قابلیت | فقط جریان مفهومی تعاملی است؛ backend یا checkpoint کامل ندارد |
| `مطالعه‌ای` | `UNSUPPORTED` برای ادعای قابلیت | فقط توضیح و منبع علمی دارد |

بنابراین وجود کارت RNN، DPO، LoRA یا Mamba در صفحه نباید به‌عنوان قابلیت اجرایی API
تفسیر شود. مقالهٔ متصل نیز فقط تعریف روش را پشتیبانی می‌کند، نه اجرای محلی آن را.

## ماتریس snapshot فعلی

علامت ✓ در ستون `EXTERNAL` یا `TELEMETRY` نوع شواهد آینده را نشان می‌دهد؛ ستون «وضعیت فعلی»
تعیین می‌کند قابلیت اکنون قابل‌ادعا هست یا نه.

| شناسه | ادعا یا قابلیت | IMPLEMENTED | TELEMETRY | EXTERNAL | UNSUPPORTED | وضعیت فعلی و دلیل |
|---|---|:---:|:---:|:---:|:---:|---|
| CLM-001 | config، داده، DB و artifactهای نسخه‌دار وجود دارند | ✓ |  |  |  | manifest و hashها در اجرای مرجع ثبت شده‌اند |
| CLM-002 | یک مدل dense direct آموزش‌پذیر وجود دارد | ✓ | ✓ |  |  | forward/train/checkpoint و benchmark اجرا شده‌اند |
| CLM-003 | مدل scratchpad تولید می‌کند | ✓ | ✓ |  |  | trace خروجی مولد با grammar framing و verifier جدا ثبت می‌شود |
| CLM-004 | CoT prompting ارزیابی شده است |  |  |  | ✓ | این پروژه scratch supervision دارد، نه few-shot CoT prompting |
| CLM-005 | سه policy استنتاج با checkpoint ثابت اجرا می‌شوند | ✓ | ✓ |  |  | candidate/token/forward/latency ثبت شده‌اند؛ temperature و top-k نیز همراه effort تغییر می‌کنند |
| CLM-006 | افزایش بودجه کیفیت را بهتر می‌کند |  | ✓ |  | ✓ | اجرای مرجع بهبود نداد؛ برای ادعای کلی چند seed لازم است |
| CLM-007 | معماری MoE در forward pass فعال است | ✓ | ✓ |  |  | چهار expert، top-1 router، aux loss و trace checkpoint شده‌اند |
| CLM-008 | expertها تخصص معنایی آموخته‌اند |  | ✓ |  | ✓ | نیازمند آزمون مستقل، ablation و تکرار است |
| CLM-009 | RAG بسته context بازیابی‌شده را به مولد می‌دهد | ✓ | ✓ | ✓ |  | FTS5 و provenance ثبت می‌شوند؛ facts همان درخواست ابتدا به سند همان world تبدیل می‌شوند |
| CLM-010 | تغییر corpus بدون تغییر وزن، پاسخ را تغییر می‌دهد |  | ✓ | ✓ | ✓ | نیازمند آزمون counterfactual و weight hash ثابت است |
| CLM-011 | مدل به‌صورت آموخته‌شده ابزار انتخاب می‌کند |  | ✓ | ✓ | ✓ | controller فعلی اسکریپتی و صریحاً غیرآموخته است |
| CLM-012 | میزبان یک ابزار خالص را اجرا می‌کند | ✓ | ✓ | ✓ |  | LOOKUP/CALC allowlist، type check، budget و تست خطا دارند |
| CLM-013 | پاسخ tool-assisted همان پاسخ model-only است |  | ✓ | ✓ | ✓ | مسیرها جدا هستند و اجرای مرجع برابری را نشان نمی‌دهد |
| CLM-014 | raw reasoning داخلی مدل قابل‌مشاهده است |  |  |  | ✓ | generated scratchpad یا summary معادل آن نیست |
| CLM-015 | attention یا router علت قطعی پاسخ را توضیح می‌دهد |  | ✓ |  | ✓ | این داده‌ها telemetry هستند و برای ادعای علّی کافی نیستند |
| CLM-016 | سامانه تعمیم پایدار خارج از توزیع دارد |  | ✓ |  | ✓ | split و افت OOD اندازه‌گیری شده؛ چند seed و confidence interval هنوز لازم است |
| CLM-017 | موتور مستقل sampling ده‌رقمی همهٔ تبدیل‌ها را اجرا می‌کند | ✓ | ✓ |  |  | API، ده stage، توزیع کامل، RNG نسخه‌دار و آزمون‌های invariant وجود دارند |
| CLM-018 | logits بخش sampling خروجی checkpoint آموزش‌دیده‌اند |  |  |  | ✓ | منبع عمداً synthetic و کنترل‌شده است و در UI/API برچسب دارد |
| CLM-019 | histogram تعداد forward pass مدل را نشان می‌دهد |  | ✓ |  | ✓ | drawها بازنمونه‌گیری از یک snapshot توزیع‌اند؛ مدل اجرا نمی‌شود |
| CLM-020 | semantics پارامترها در همهٔ vendorها یکسان است |  |  |  | ✓ | ترتیب، دامنه، scope و پشتیبانی vendor/library-specific است |

## قرارداد ادعا برای Prompt و Decoding

- `sampling-lab-v1` فقط قرارداد الگوریتمی این پروژه است؛
- `synthetic_controlled_successor_logits` باید کنار هر خروجی نمایش داده شود؛
- احتمال نهایی likelihood یک token در همین snapshot است، نه احتمال درست‌بودن گزاره؛
- seed محلی با `splitmix64-v1` deterministic است، اما این ویژگی به API خارجی تعمیم ندارد؛
- وضعیت `محاسبه‌شده` در اطلس پارامترها یعنی خود تبدیل در endpoint مستقل اجرا می‌شود، نه اینکه
  vendor مشخصی عیناً بازسازی شده است؛
- کارت‌های `کنترل میزبان`، `وابسته به API` و `مشاهده‌گر` قابلیت اجرایی تازهٔ checkpoint نیستند.

## معیار ارتقای وضعیت

### Test-time compute

برای ارتقای CLM-005 به `IMPLEMENTED`:

- یک checkpoint ثابت در همه بودجه‌ها استفاده شود؛
- تعداد sample، forward pass، generated token و latency ثبت شود؛
- الگوریتم انتخاب پاسخ نسخه‌بندی شود؛
- آزمون واحد، integration test و artifact eval وجود داشته باشد.

CLM-006 فقط وقتی قابل ارتقا است که چند بودجه روی dataset ثابت و چند seed مقایسه شوند و بهبود
کیفیت همراه هزینه گزارش شود. نتیجهٔ منفی نیز باید منتشر شود.

اجرای حاضر candidate count، temperature و top-k را با هم عوض می‌کند؛ پس برای ادعای اثر علّی
«محاسبهٔ بیشتر»، یک ablation تازه لازم است که سایر متغیرها را ثابت نگه دارد.

### CoT و scratchpad

برای CLM-003 و CLM-004:

- vocabulary و grammar صریح باشند؛
- direct و scratchpad baseline ظرفیت مقایسه‌پذیر داشته باشند؛
- final answer و step validity جدا سنجیده شوند؛
- trace مخدوش، trace حذف‌شده و depth-OOD آزمایش شوند؛
- UI فقط tokenهای واقعاً تولیدشده را نمایش دهد.

حتی پس از اجرا، ادعای CLM-014 در وضعیت `UNSUPPORTED` باقی می‌ماند؛ زیرا generated trace فقط خروجی
رفتاری در پروتکل تعریف‌شده است.

### MoE

برای CLM-007:

- expert weights و router باید در model graph باشند؛
- checkpoint loader وجود آن‌ها را verify کند؛
- routing هر token و auxiliary loss در trace ثبت شود؛
- dense baseline از نظر parameter count و active compute گزارش شود؛
- تست expert collapse و load imbalance وجود داشته باشد.

برای CLM-008 علاوه بر این موارد، probe مستقل، expert forcing/ablation، چند seed و نتیجهٔ پایدار روی
test split لازم است. نام‌گذاری معنایی expert پیش از آن ممنوع است.

### RAG

برای CLM-009 و CLM-010:

- corpus و هر document hash و version داشته باشند؛
- retrieval query، score، rank و document ID ثبت شوند؛
- context نهایی قابل‌بازتولید باشد؛
- حالت‌های no-retrieval، empty، correct و corrupted اجرا شوند؛
- در آزمون update، checkpoint hash ثابت و corpus hash متفاوت باشد.

دادهٔ retrieved همیشه `EXTERNAL` باقی می‌ماند. اگر پاسخ مستقیم lookup نمایش داده شود، نباید
`generator_output` نام بگیرد.

### Tool use

برای CLM-011 و CLM-012:

- schema strict و allowlist ابزارها تعریف شود؛
- مدل call را تولید کند و میزبان آن را validate کند؛
- call ID، argument، result، latency و error ثبت شوند؛
- unknown tool، argument نامعتبر، timeout، تکرار و loop limit تست شوند؛
- ابزار side-effecting بدون مجوز صریح اجرا نشود.

نتیجهٔ ابزار همیشه `EXTERNAL` است. حتی پس از پیاده‌سازی، اجرای ابزار باید به میزبان نسبت داده شود،
نه به وزن‌های مدل.

## ادعاهای مجاز پس از پیاده‌سازی مشروط

نمونهٔ قالب‌های مجاز:

- «در run مشخص، scratchpad تولیدشده با exact-match برابر X همراه بود.»
- «router در این dataset و seed، Y درصد tokenها را به expert شمارهٔ ۲ فرستاد.»
- «retriever سندهای A و B را با score ثبت‌شده به context افزود.»
- «میزبان tool call با شناسهٔ C را پس از validation اجرا کرد.»
- «با بودجهٔ ۱۶ مسیر، accuracy از X به Y و latency از P به Q رسید.»

این عبارت‌ها run-scoped و قابل‌ممیزی‌اند و از رفتار مشاهده‌شده فراتر نمی‌روند.

## ادعاهای ممنوع بدون شاهد مستقل

- مدل دارای حالت ذهنی انسانی است.
- متن scratchpad نسخهٔ قطعی فرایند علّی داخلی است.
- یک attention head یا expert «معنای» خاصی را فهمیده است.
- سند retrieved به بخشی از وزن‌های مدل تبدیل شده است.
- مدل خودش کد ابزار را اجرا کرده است.
- accuracy tool-assisted توان مدل بدون ابزار را نشان می‌دهد.
- یک run یا یک seed تعمیم پایدار را ثابت می‌کند.
- مقدار config به‌تنهایی قابلیت executable را ثابت می‌کند.

## قرارداد نمایش در UI و گزارش

هر نتیجه باید این برچسب‌ها را، هر جا مرتبط است، نشان دهد:

```text
capability_status: IMPLEMENTED | UNSUPPORTED
evidence_class: MODEL | TELEMETRY | EXTERNAL | ORACLE
assistance_mode: MODEL_ONLY | RETRIEVAL_ASSISTED | TOOL_ASSISTED
run_id: ...
checkpoint_sha256: ...
dataset_manifest_sha256: ...
seed: ...
```

اگر artifact یا dependency لازم موجود نیست، API باید fail-closed پاسخ دهد و UI وضعیت
`UNSUPPORTED` یا `UNAVAILABLE` را نمایش دهد. هیچ mock یا دادهٔ synthetic نباید بدون برچسب به‌عنوان
خروجی مدل واقعی نمایش داده شود.
