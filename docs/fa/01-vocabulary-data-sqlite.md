# واژگان، داده و SQLite

## ۱. چرا tokenizer فقط ده سطر کد اصلی دارد؟

در مدل‌های بزرگ، tokenizer ممکن است ده‌ها هزار subword داشته باشد. اینجا نگاشت آگاهانه هویت
است:

```text
"0"→0, "1"→1, …, "9"→9
```

`encode` هیچ normalization انجام نمی‌دهد. بنابراین رقم فارسی `۹` با رقم ASCII `9` یکی نیست و
با `TOKEN_OUT_OF_VOCAB` رد می‌شود. نبود `UNK` مهم است: مدل نمی‌تواند وانمود کند دادهٔ خارج از
الفبا را فهمیده است.

`encode_one` علاوه بر membership، طول را هم کنترل می‌کند. به همین علت `10` با اینکه هر دو
نویسه‌اش در vocabulary هستند، prompt عمومی معتبر نیست. endpoint آزمایشگاهی `/api/inspect`
عمداً context چندرقمی را جدا می‌پذیرد.

## ۲. چرا خروجی `05` است، نه `5`؟

یک LM معمولی با EOS پایان متن را می‌آموزد. اضافه‌کردن EOS vocabulary را یازده‌عضوی می‌کرد.
پروتکل ثابت دو‌توکنی این تضاد را حل می‌کند:

| ورودی | هدف خام | نمایش انسانی |
|---:|---:|---:|
| ۰ | `01` | ۱ |
| ۴ | `05` | ۵ |
| ۸ | `09` | ۹ |
| ۹ | `10` | ۱۰ |

توقف پس از دو token یک قرارداد بیرونی است، نه تصمیم آموخته‌شدهٔ مدل. این محدودیت در response
API با `generation_protocol=exactly_two_tokens_without_eos` آشکار می‌شود.

## ۳. دیتاست‌ها

داده‌ها synthetic و عمداً کوچک‌اند. epoch repetition در trainer انجام می‌شود؛ فایل JSONL ردیف
تکراری برای بزرگ جلوه‌دادن داده ندارد.

### `pt_patterns_v1` — ۶۰ ردیف

برای هر start از ۰ تا ۹ و strideهای `+1,+2,+3,-3,-2,-1` یک progression چرخه‌ای با ۹ token
ساخته می‌شود. هشت token نخست input و هشت token shifted بعدی target هستند. وجود چند stride
باعث می‌شود token نخست به‌تنهایی برای حدس stride کافی نباشد و context واقعاً اهمیت پیدا کند.

تقسیم بر اساس start است و هیچ ردیف یکسانی بین splitها کپی نمی‌شود:

- startهای ۰ تا ۶: train، مجموع ۴۲ ردیف؛
- start برابر ۷: validation، شش ردیف؛
- startهای ۸ و ۹: test، دوازده ردیف.

### `sft_successor_full_v1` — ۱۰ ردیف

جدول کامل `0→01 … 9→10` است. همهٔ ردیف‌ها train هستند. ارزیابی نهایی دوباره هر ده ورودی را
می‌سنجد، پس functional exhaustive است و test مستقل آماری نیست.

### `pt_digits_0_7_v1` و `sft_successor_0_7_v1`

کنترل held-out است. pretraining حتی یک نویسهٔ ۸ یا ۹ ندارد؛ SFT فقط promptهای ۰ تا ۷ را دارد.
در SFT، رقم ۸ به‌عنوان target نگاشت `7→08` دیده می‌شود، اما هرگز prompt نیست؛ رقم ۹ اصلاً در
این مسیر SFT دیده نمی‌شود. در نتیجه prediction برای promptهای ۸ و ۹ unsupported است.

### `sft_successor_except7_v1`

در این کنترل، pretraining اصلی هر ده token را دیده است، اما فقط row نظارت‌شدهٔ `7→08` از SFT
حذف می‌شود. بنابراین شکست ۷ را می‌توان از آزمایش embedding کاملاً آموزش‌ندیدهٔ ۸ و ۹ جدا کرد.

### `probe_successor_true_v1` و `probe_successor_corrupt4_v1`

این دو دیتاست split برابر `probe` دارند و trainer هرگز آن‌ها را بارگذاری نمی‌کند. evaluator فقط پس
از پایان همهٔ optimizer stepها expected label را از آن‌ها می‌خواند. بنابراین labelهای گزارش در
runtime ساخته نمی‌شوند و مانند دادهٔ آموزش hash و version ثابت دارند.

### `sft_corrupt4_full_v1`

فقط یک label را از `4→05` به `4→99` تغییر می‌دهد. اگر مدل `99` را بیاموزد، می‌دانیم مسیر تولید
توکن fallback حسابی ندارد و وزن‌ها واقعاً تابع داده‌اند. oracle نمایش correctness بعد از تولید
اجرا می‌شود و هیچ logit یا token را تغییر نمی‌دهد.

## ۴. از ردیف تا manifest

هر ردیف شامل متن، token ID، split، objective، metadata و `row_sha256` است. serialization با
کلیدهای مرتب و UTF-8 پایدار انجام می‌شود. manifest نیز hash همهٔ ردیف‌ها و config generator را
دارد. زمان ساخت داخل hash نیست؛ در نتیجه ساخت مجدد همان داده همان SHA-256 را می‌دهد.

هنگام استفادهٔ مجدد از SQLite، repository فقط به header اعتماد نمی‌کند: هر row را از ستون‌های
واقعی بازسازی و hash می‌کند، سپس manifest کل دیتاست را دوباره محاسبه می‌کند. تست tamper عمداً
یک target را با SQL تغییر می‌دهد و باید fail-closed شود.

فایل‌های قابل خواندن:

```text
data/generated/*.jsonl
data/manifests/*.manifest.json
data/specs/tokenizer.json
```

## ۵. SQLite دفتر آزمایش است، نه مغز مدل

جدول‌های اصلی:

- `datasets` و `examples`: نسخه، hash و نمونه‌ها؛
- `runs`: stage، parent، seed، environment و checkpoint؛
- `metrics`: loss، accuracy، perplexity، LR و gradient norm؛
- `artifacts`: path، اندازه و SHA-256؛
- `evaluations`: expected/predicted، support و exposure؛
- `inference_requests`: audit پذیرش/رد API.

inference وزن‌ها را مستقیم از Safetensors و metadata می‌خواند و هیچ query به `examples` ندارد.
اگر SQLite را کنار checkpoint حذف کنید، CLI prediction همچنان همان logits را می‌دهد؛ فقط دفتر
تاریخچه و audit در UI در دسترس نیست.

این پروژه WAL را فعال نمی‌کند. SQLite همراه Python میزبان نسخهٔ 3.45.1 است و اصلاح corruption
مربوط به reset هم‌زمان WAL در نسخه‌های جدیدتر آمده است. برای این آزمایشگاه تک‌نویسنده، rollback
journal و connection کوتاه‌عمر ساده‌تر و ایمن‌تر است.
journal mode در هر connection واقعاً enforce می‌شود؛ summary نیز مقدار PRAGMA واقعی را می‌خواند
و string ثابت گزارش نمی‌کند.
