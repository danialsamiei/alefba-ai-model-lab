# آزمایشگاه میکروسکوپی استدلال مدل زبانی

این پروژه یک جهان محاسباتی کوچک و کاملاً قابل‌بازتولید است که در آن مدل‌ها
عبارت‌های تو‌در‌تو مانند `MUL(ADD(A,B),C)` را با حساب پیمانه‌ای ۱۰ حل می‌کنند.
هدف، دیدن تفاوت معماری، دادهٔ آموزشی، scratchpad تولیدشده، بودجهٔ محاسبه در
زمان آزمون، MoE، RAG و ابزارهای میزبان در یک نمونهٔ واقعی و قابل‌خواندن است.
اطلس تکمیلی صفحه، ۳۲ روش مهم دیگر/مرتبط را با وضعیت «اجراشده»، «مدل تشریحی»
یا «مطالعه‌ای» و لینک مقالهٔ اصلی از هم جدا می‌کند.
بخش «تونل باد Prompt و Decoding» نیز یک توزیع مصنوعی ده‌رقمی را از logits خام
تا پنالتی، temperature، فیلترهای truncation و نمونه‌گیری seedدار، در ده snapshot
کامل و سه سطح شهودی/فرآیندی/فرمولی اجرا می‌کند.

این پروژه شبیه‌سازی «افکار پنهان» یا بازسازی سامانه‌های اختصاصی نیست.
scratchpad خروجی آموزش‌دیدهٔ مدل است؛ RAG بیرون مدل متن بازیابی می‌کند؛ ابزارها
را میزبان اجرا می‌کند؛ و routing در MoE فقط تله‌متری محاسباتی است.

## نسخهٔ مستقل سه‌بعدی Windows

یک برنامهٔ portable و کاملاً آفلاین نیز در پوشهٔ `desktop/` ساخته شده است. این
نسخه با Electron و Three.js، ۵۱ مدل/معماری و ۶۶ رابطه را در یک رصدخانهٔ سه‌بعدی
فارسی نمایش می‌دهد و شامل تور هدایت‌شده، fallback دوبعدی، مقایسهٔ معماری،
آزمایشگاه ظرفیت DeepSeek روی CPU، شبیه‌ساز پارامترهای decoding و اتاق فرمان
عامل‌محور برای Harness، Context Engineering، Orchestration و پروتکل‌ها است.

فایل آماده پس از build:

```text
desktop/release/Alefba-AI-Model-Lab-0.5.0-Windows-x64.exe
```

این EXE وزن DeepSeek، llama.cpp یا checkpoint مولد رسانه را bundle نمی‌کند؛
نمایش‌ها تشریحی‌اند و محاسبهٔ CPU برآورد تحلیلی است، نه benchmark. راهنمای کامل
ساخت، امنیت، مجوزها و مرز ادعاها در
[`desktop/README.fa.md`](desktop/README.fa.md) قرار دارد.

## راه‌اندازی از clone تمیز

```powershell
Set-Location .\reasoning-lab
uv sync --frozen
uv run reasoning-lab build-data
uv run reasoning-lab train-all
uv run reasoning-lab verify
uv run reasoning-lab serve
```

checkpointها خروجی قابل‌بازتولید آموزش‌اند و عمداً در Git نگه‌داری نمی‌شوند؛
بنابراین clone تمیز باید ابتدا مسیر `build-data → train-all → verify` را اجرا کند.
پس از اجرای سرور، رابط آزمایشگاهی در `http://127.0.0.1:8000` در دسترس است. برای
یک آزمایش خط فرمان:

```powershell
uv run reasoning-lab solve "MUL(ADD(A,B),C)" --facts A=3,B=5,C=2 --model dense_scratch
uv run reasoning-lab solve "MUL(ADD(A,B),C)" --facts A=3,B=5,C=2 --mode tools
```

برای ارزیابی خروجی ساخته‌شده از seed ثابت:

```powershell
uv run reasoning-lab evaluate --limit 40
```

هیچ API خارجی، GPU یا کلید سرویس لازم نیست.

## چیزی که واقعاً ساخته شده

- n-gram شمارشی با backoff و checkpoint JSON هش‌شده؛
- Window MLP با پنجرهٔ ثابت و بدون attention؛
- Transformer مستقیم؛
- Transformer با scratchpad تولیدشده و grammar-constrained decoding؛
- Sparse MoE با چهار expert، routing top-1 و auxiliary load-balancing؛
- SQLite واقعی با FTS5 برای RAG و رخدادهای retrieval قابل ممیزی؛
- دو ابزار allowlist شدهٔ `LOOKUP` و `CALC` با controller اسکریپتیِ صریحاً غیرآموخته؛
- effort کم/متوسط/زیاد با checkpoint ثابت و شمارش candidate/token/forward/latency؛
- رابط فارسی RTL برای احتمال توکن، attention، routing، RAG و tool call؛
- endpoint مستقل `POST /api/sampling-lab` با واژگان `0..9`، ده stage قابل‌ممیزی،
  `top-k/top-p/min-p/typical/epsilon/eta`، سه نوع penalty، logit bias و
  RNG محلی نسخه‌دار؛
- safetensors و SHA-256 برای checkpoint، tokenizer، dataset و گزارش‌ها.

## نتیجهٔ اجرای مرجع

seed برابر `20260830` و dataset شامل ۱٬۷۲۰ episode، ۵٬۱۱۹ سند و ۵٬۱۶۰
transcript است. این اعداد accuracy روی ۴۰ نمونه از هر split هستند؛ یک benchmark
کوچک‌اند، نه ادعای عمومی دربارهٔ LLMها.

| پروفایل | IID model-only | depth-OOD | RAG holdout بدون retrieval | با RAG |
|---|---:|---:|---:|---:|
| n-gram | 7.5% | 10.0% | 20.0% | 20.0% |
| Window MLP | 40.0% | 7.5% | 15.0% | 42.5% |
| Dense direct | 45.0% | 17.5% | 17.5% | 42.5% |
| Dense scratch | 40.0% | 15.0% | 10.0% | 37.5% |
| Sparse MoE scratch | 42.5% | 5.0% | 17.5% | 42.5% |
| scripted tools | — | 100% | — | — |

ابزار ۱۰۰٪ است چون controller نمادین AST را می‌خواند و میزبان محاسبه را اجرا
می‌کند؛ این عدد توانایی model-only یا learned tool selection نیست.

در مقایسهٔ effort روی ۱۲ مسئله و یک checkpoint ثابت، accuracy هر سه سطح
`33.3%` ماند، ولی میانگین forward pass برابر ۷، ۲۸ و ۵۶ شد. همین شکستِ بهبود،
جزئی از نتیجه است.

## مسیر پیشنهادی برای خواندن کد

۱. `src/reasoning_lab/task.py` — دستور زبان، AST و جواب قطعی  
۲. `src/reasoning_lab/tokenizer.py` — واژگان بسته و تبدیل متن/توکن  
۳. `src/reasoning_lab/data.py` — curriculum، split، transcript و loss mask  
۴. `src/reasoning_lab/models.py` — MLP، Transformer، attention و MoE  
۵. `src/reasoning_lab/training.py` — shift، batch، AdamW و validation  
۶. `src/reasoning_lab/inference.py` — effort، sampling، verifier و trace  
۷. `src/reasoning_lab/retrieval.py` و `tools.py` — دانش/محاسبهٔ بیرون وزن  
۸. `src/reasoning_lab/lab.py` — ارکستراسیون و تفکیک حالت‌ها  
۹. `src/reasoning_lab/api.py` و `static/` — API و شبیه‌سازی بصری
۱۰. `src/reasoning_lab/sampling_lab.py` — الگوریتم شفاف پارامترهای decoding

شرح خط‌به‌خطِ مفهومی در `docs/fa/01-code-tour.md` آمده است. برای خواندن شکل‌ها،
رنگ‌ها، جدول روابط و هفت برش اجرای زنده، به
[`docs/fa/03-visual-atlas.md`](docs/fa/03-visual-atlas.md) مراجعه کنید.
منشأ مولد، مجوز، seedها، هش‌ها، کاربرد مجاز و موارد منع کاربرد curriculum مصنوعی
در [`docs/fa/DATA_CARD.md`](docs/fa/DATA_CARD.md) ثبت شده‌اند.
برای نقشهٔ معماری‌های کلاسیک، post-training، decoding، long context، retrieval،
عامل‌ها و multimodality،
[`docs/fa/04-method-landscape.md`](docs/fa/04-method-landscape.md) را بخوانید؛ نسخهٔ HTML
هم از آیکون‌های اطلاعات داخل رابط باز می‌شود.
برای الگوریتم، فلوچارت، مثال عددی، آزمایش‌ها و مرزهای ۲۴ کنترل Prompt/Decoding/RAG،
[`docs/fa/05-prompt-decoding-parameters.md`](docs/fa/05-prompt-decoding-parameters.md)
را بخوانید؛ نسخهٔ HTML از تمام آیکون‌های اطلاعات بخش ۰۸ باز می‌شود.

## مرز نتیجه‌ها

خروجی‌ها همیشه با یکی از برچسب‌های `model_only`، `rag`، `tools` یا `oracle`
ثبت می‌شوند. سه effort علاوه بر تعداد کاندیدا، temperature و top-k را نیز تغییر
می‌دهند؛ پس سه policy استنتاج با checkpoint ثابت‌اند و اثر خالص compute را جدا
نمی‌کنند. افزایش effort تضمین نمی‌کند پاسخ بهتر شود.

برای تعریف دقیق مفاهیم و محدودیت ادعاها به
`docs/fa/00-concepts-and-claim-boundaries.md` مراجعه کنید.
