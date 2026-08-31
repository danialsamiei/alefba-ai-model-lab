# آزمایشگاه سه‌بعدی زیست‌بوم مدل‌های هوش مصنوعی برای ویندوز

این پوشه نسخهٔ دسکتاپ و آفلاینِ آزمایشگاه را می‌سازد: یک اطلس سه‌بعدی فارسی که
رابطهٔ «داده → نمایش → معماری → آموزش → استنتاج → ابزار و سروینگ» را برای
مدل‌های متن، تصویر، ویدئو، صدا، کد و چندوجهی نمایش می‌دهد. خروجی انتشار یک
فایل portable ویندوز x64 است و نصب‌کننده یا حساب کاربری نمی‌خواهد.

## وضعیت و مرز ادعا

نسخهٔ فعلی یک **محیط آموزشی و شبیه‌ساز معماری** است، نه یک بستهٔ وزن مدل.

| قابلیت | وضعیت | معنای دقیق |
|---|---|---|
| اطلس سه‌بعدی و روابط | پیاده‌سازی‌شده | داده‌ها از catalog محلی خوانده و با Three.js ترسیم می‌شوند. |
| تور تشریحی فارسی | پیاده‌سازی‌شده | هر گام یک مفهوم و منبع را توضیح می‌دهد. |
| شبیه‌سازی MoE، diffusion، ویدئو، صوت و کد | مفهومی/محاسباتی | حرکت و هندسه، جریان داده را توضیح می‌دهند؛ checkpoint واقعی را اجرا نمی‌کنند. |
| برآورد DeepSeek روی CPU | محاسبهٔ تحلیلی | RAM، KV cache و سقف تقریبی سرعت را تخمین می‌زند؛ benchmark نیست. |
| اجرای GGUF با llama.cpp | در این EXE موجود نیست | هیچ وزن GGUF و هیچ باینری llama.cpp همراه محصول بسته نشده است. |
| تولید تصویر، ویدئو یا صوت واقعی | در این EXE موجود نیست | خروجی‌های بصری، نمایش فرایندند؛ خروجی یک مدل مولد نیستند. |
| منابع علمی و مخازن | منبع‌پشتوانه | لینک HTTPS به مقاله یا مخزن رسمی در کارت هر مفهوم قرار دارد. |
| اتاق فرمان سامانه‌های عامل‌محور | شبیه‌سازی قطعی/محلی | Harness، Context، Orchestration، approval، failure و trace را به event تبدیل می‌کند؛ مدل یا ابزار خارجی اجرا نمی‌شود. |
| رصدخانهٔ پژوهش و Decision Lab | اجرا + شبیه‌سازی قطعی | چرخهٔ یادگیری، سامانه‌ها، کاربردها، MCP/API، Abliteration مصنوعی و کامپایل محلی APIR را با مرز شاهد نمایش می‌دهد. |
| امضای تجاری ویندوز | انجام‌نشده | فایل توسعه‌ای unsigned است و ممکن است Windows SmartScreen هشدار دهد. |

عبارت‌های `SOURCE-BACKED`، `CONCEPTUAL 3D`، `LOCAL CALCULATION` و
`UNAVAILABLE` در رابط برای حفظ همین مرز استفاده می‌شوند. دیدن یک انیمیشن یا
کارت، اثبات اجرای مدل یا درستی عمومی آن معماری نیست.

## در برنامه چه می‌بینید؟

- یک هستهٔ داده و مدارهای معماری برای بیش از ۴۰ مفهوم و پروژه؛
- نمای مقایسهٔ Transformer چگال، sparse MoE، MLA، state-space و پل‌های چندوجهی؛
- گردش مرحله‌ای از latent نویزی تا ساختار در diffusion؛
- frameهای فضازمانی در Video DiT و تفاوت هزینهٔ تصویر با ویدئو؛
- waveform، spectrogram و tokenهای codec برای معماری‌های صوتی؛
- مسیر token کد تا AST، اجرای میزبان و تست؛
- RAG به‌عنوان دانش بازیابی‌شدهٔ بیرون وزن و agent به‌عنوان حلقهٔ کنترل میزبان؛
- آزمایشگاه CPU برای مدل‌های R1 Distill و R1 کامل، با جداسازی وزن کل و فعال.
- اتاق فرمان Agentic با پنج سناریو، شش توپولوژی، Context Furnace، گیت انسانی،
  failure injection، timeline قابل replay و ۲۷ مدخل مهندسی دارای Doc و منبع.

## اتاق فرمان Agentic چه چیزی را آموزش می‌دهد؟

دکمهٔ «اتاق فرمان Agentic» یک workspace زنده باز می‌کند. سناریو، توپولوژی،
effort، سقف context، سیاست approval و خطای تزریقی قابل تغییرند. موتور فقط از
logical tick و fixture محلی استفاده می‌کند؛ ساعت واقعی، تصادف، شبکه، فایل و
ابزار سیستم‌عامل در نتیجه دخالت ندارند. بنابراین یک configuration یکسان، جریان
event یکسان می‌سازد.

```text
هدف → Context Compiler → Model Proposal → Orchestrator
     → Schema/Policy → Human Approval → Mock Tool → Observation
     → Verifier → Checkpoint → Stop
```

در Context Furnace هر منبع علاوه بر تعداد token، نوع، trust، اولویت و وضعیت
`full`، `compacted` یا `quarantined` دارد. سند RAG دادهٔ غیرقابل اعتماد است و
نمی‌تواند خودش را به policy یا مجوز ابزار ارتقا دهد. در توپولوژی‌ها نیز تفاوت
فقط تصویری نیست: تعداد worker، مالک task، fan-in و eventهای trace عوض می‌شوند.

پروتکل‌ها با نقش جدا نمایش داده می‌شوند: AG-UI میان عامل و رابط، A2A میان
عامل‌های مستقل و MCP میان host و tool/resource server. JSON Schema فقط شکل
داده را اعتبارسنجی می‌کند؛ authorization، sandbox، approval و صحت نتیجه کنترل‌های
جداگانه‌اند. شرح مهندسی کامل در
[`docs/agentic-engineering.fa.md`](docs/agentic-engineering.fa.md) است.

رابط اصلی بدون اینترنت کار می‌کند. دکمهٔ «منبع» فقط پس از اقدام کاربر، یک لینک
HTTPS اعتبارسنجی‌شده را در مرورگر سیستم باز می‌کند.

## DeepSeek واقعاً چگونه روی CPU اجرا می‌شود؟

در اجرای واقعی، پروژه‌ای مانند [llama.cpp](https://github.com/ggml-org/llama.cpp)
فایل GGUF را باز یا memory-map می‌کند، prompt را token می‌کند، مرحلهٔ prefill را
می‌گذراند و سپس برای هر token لایه‌ها و KV cache را به‌روز می‌کند. Quantization
با کم‌کردن بیت وزن، اندازه و ترافیک حافظه را کاهش می‌دهد؛ کیفیت و سرعت دقیق به
نوع quantization، kernel، SIMD، تعداد thread، پهنای‌باند RAM و طول context وابسته
است.

در [DeepSeek-V3](https://github.com/deepseek-ai/DeepSeek-V3) و R1 کامل، MoE باعث
می‌شود برای هر token فقط بخشی از پارامترها در محاسبه فعال باشند؛ اما این به معنی
ذخیره‌نشدن بقیهٔ expertها نیست. برای نمونه، نمایش Q4 خامِ ۶۷۱ میلیارد پارامتر
حدود ۳۱۲ GiB است و با metadata، alignment، KV cache و workspace بیشتر می‌شود.
در مقابل، نسخهٔ dense هفت میلیاردی Q4 فقط برای وزن‌ها تقریباً ۳٫۵ GiB برآورد
می‌شود. مخزن رسمی [DeepSeek-R1](https://github.com/deepseek-ai/DeepSeek-R1)
نسخه‌های Distill کوچک‌تر را جدا از R1 کامل معرفی می‌کند.

پنل CPU همین روابط را با یک roofline سادهٔ memory-bandwidth محاسبه می‌کند. عدد
`tokens/s` آن **برآورد آموزشی** است؛ برای ادعای عملکرد باید GGUF واقعی روی همان
رایانه با نسخهٔ ثبت‌شدهٔ runtime، prompt ثابت و گزارش timing benchmark شود.

## پیش‌نیازها

برای اجرای EXE آماده فقط این موارد لازم‌اند:

- Windows 10 یا 11، معماری x64؛
- GPU سازگار با WebGL برای نمای سه‌بعدی. در نبود WebGL، نمای متنی/درختی همچنان
  باید قابل استفاده باشد؛
- حدود ۴۰۰ MiB فضای آزاد برای نسخهٔ portable (اندازهٔ نهایی ممکن است تغییر کند).

برای توسعه و ساخت از منبع:

- Node.js نسخهٔ ۲۴ یا نسخهٔ سازگار اعلام‌شده در CI؛
- npm؛
- اینترنت فقط در مرحلهٔ دریافت dependencyها. اجرای ساخته‌شده آفلاین است.

## اجرای توسعه‌ای

از PowerShell:

```powershell
Set-Location .\reasoning-lab\desktop
npm ci
npm run dev
```

`npm run dev` ابتدا renderer را می‌سازد و سپس پنجرهٔ Electron را باز می‌کند.
برای دیدن renderer در مرورگر عادی:

```powershell
npm run dev:web
```

در مرورگر، اطلاعات سخت‌افزار Electron و بازکردن کنترل‌شدهٔ لینک خارجی در دسترس
نیست؛ برنامه باید این وضعیت را بدون خطا و با مقدار جایگزین نشان دهد.

## آزمون و ساخت EXE

```powershell
Set-Location .\reasoning-lab\desktop
npm test
npm run check
npm run dist:win
npm run verify:release
```

نقش فرمان‌ها:

| فرمان | خروجی/کنترل |
|---|---|
| `npm test` | یکپارچگی catalog و graph، محاسبات شبیه‌سازی، CSP و سخت‌سازی Electron |
| `npm run build:web` | ساخت renderer آفلاین در `dist/` بدون source map |
| `npm run check` | اجرای آزمون‌ها و build وب |
| `npm run dist:win` | ساخت portable EXE x64 با ASAR و فشرده‌سازی maximum |
| `npm run verify:release` | بررسی PE/MZ، اندازه، SHA-256 و وضعیت Authenticode؛ تولید manifest |

مسیرهای مورد انتظار پس از build:

```text
desktop/release/Alefba-AI-Model-Lab-0.5.0-Windows-x64.exe
desktop/release/Alefba-AI-Model-Lab-0.5.0-Windows-x64.exe.sha256
desktop/release/release-manifest.json
```

اگر نام یا مسیر فایل را تغییر داده‌اید:

```powershell
npm run verify:release -- --file .\release\نام-فایل.exe
```

اسکریپت verify امضای کد ایجاد نمی‌کند. فقط وضعیت موجود را گزارش می‌دهد؛
`NotSigned` با `Valid` متفاوت است و نباید به‌عنوان انتشار امضاشده گزارش شود.

## معماری نرم‌افزار

```text
Windows host
├── Electron main process
│   ├── ساخت پنجرهٔ sandboxed
│   ├── اطلاعات غیرحساس CPU/RAM
│   └── بازکردن فقط لینک HTTPS در مرورگر سیستم
├── preload bridge
│   └── دو تابع allowlist شده؛ بدون دسترسی مستقیم renderer به Node
└── renderer آفلاین
    ├── catalog و منابع محلی
    ├── Three.js / WebGL
    ├── شبیه‌سازهای deterministic
    ├── Agentic event engine + Context compiler + Orchestration projection
    └── درخت DOM و پنل‌های فارسی RTL
```

کنترل‌های مهم امنیتی عبارت‌اند از `contextIsolation: true`،
`nodeIntegration: false`، `sandbox: true`، جلوگیری از navigation داخلی، منع
window جدید و CSP با `connect-src 'none'`. این‌ها جایگزین ممیزی dependency و
به‌روزرسانی امنیتی دوره‌ای نیستند.

## راهنمای خواندن کد

۱. `src/catalog.js` — taxonomy، رابطه‌ها، تور، دادهٔ CPU و لینک منابع  
۲. `src/simulations.js` — محاسبات مستقل از UI و قابل‌آزمون  
۳. `src/agenticCatalog.js` — taxonomy، نوع، منبع، شکست و کنترل مهندسی عامل  
۴. `src/agenticSimulation.js` — موتور pure و event-sourced سناریوهای عامل‌محور  
۵. `src/agenticUi.js` — Context Furnace، topology، inspector و timeline تعاملی  
۶. `src/researchCatalog.js` — پرونده‌های منبع‌پشتوانهٔ مدل، محصول، Harness، پروتکل و روش  
۷. `src/researchSimulation.js` — موتورهای pure برای یادگیری، کاربرد، MCP/API، Abliteration و APIR  
۸. `src/researchUi.js` — هشت ایستگاه تعاملی رصدخانه و Decision Lab  
۹. `src/scene.js` — صحنه، nodeها، edgeها، دوربین و exhibitهای سه‌بعدی  
۱۰. `src/main.js` — state رابط، انتخاب مدل، تور و اتصال پنل‌ها  
۱۱. `electron/main.cjs` و `electron/preload.cjs` — مرز اعتماد دسکتاپ  
۱۲. `tests/` — قراردادهایی که catalog، شبیه‌سازی و امنیت را قفل می‌کنند  
۱۳. `scripts/verify-release.mjs` — شواهد integrity و signing خروجی

## منابع اصلی برای خانواده‌های مدل

رابط برای هر node منبع اختصاصی دارد. چند نقطهٔ شروع مهم:

- متن و reasoning: [DeepSeek-V3](https://github.com/deepseek-ai/DeepSeek-V3)،
  [DeepSeek-R1](https://github.com/deepseek-ai/DeepSeek-R1)،
  [Transformers](https://github.com/huggingface/transformers)
- اجرای محلی و quantization: [llama.cpp](https://github.com/ggml-org/llama.cpp)
- diffusion و pipelineهای رسانه: [Diffusers](https://github.com/huggingface/diffusers)
- ویدئو: [HunyuanVideo](https://github.com/Tencent-Hunyuan/HunyuanVideo)،
  [CogVideo](https://github.com/zai-org/CogVideo)،
  [Wan2.1](https://github.com/Wan-Video/Wan2.1)
- صدا: [Whisper](https://github.com/openai/whisper)،
  [EnCodec](https://github.com/facebookresearch/encodec)،
  [AudioCraft](https://github.com/facebookresearch/audiocraft)
- کد: [StarCoder2](https://github.com/bigcode-project/starcoder2)،
  [DeepSeek-Coder-V2](https://github.com/deepseek-ai/DeepSeek-Coder-V2)
- بازیابی و اجرا: [FAISS](https://github.com/facebookresearch/faiss)،
  [ONNX Runtime](https://github.com/microsoft/onnxruntime)،
  [vLLM](https://github.com/vllm-project/vllm)

وجود یک مخزن در اطلس به معنی سازگاری مجوز checkpoint، داده یا کاربرد تجاری
نیست. مجوز کد، وزن، dataset و خروجی را همیشه جدا بررسی کنید.

## دسترس‌پذیری و کنترل حرکت

- canvas تزئینی/تعامل فضایی است و محتوا باید از طریق درخت DOM نیز انتخاب شود؛
- ناوبری با صفحه‌کلید و focus قابل‌مشاهده پشتیبانی می‌شود؛
- تور باید pause/قبلی/بعدی داشته باشد و صدای خودکار پخش نکند؛
- ترجیح `prefers-reduced-motion` باید حرکت غیرضروری را کم کند؛
- اگر context گرافیکی از دست رفت، اطلاعات متنی و منابع نباید ناپدید شوند.

## محدودیت‌های شناخته‌شده

- اعداد RAM و سرعت، اندازه‌گیری سخت‌افزار نیستند؛ مدل تحلیلی‌اند؛
- سرعت واقعی prompt processing با token generation یکسان نیست؛
- مدل‌های تصویر/ویدئو غالباً به VRAM زیاد و backendهای جدا نیاز دارند؛
- مجوز بسیاری از وزن‌ها با مجوز کد مخزن فرق دارد؛
- EXE فعلی گواهی code-signing تجاری ندارد؛
- برنامه برای دریافت وزن، ارسال telemetry یا اتصال به سرویس خارجی طراحی نشده است.

فهرست dependencyهای سطح اول و لینک متن مجوزها در
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) آمده است.
