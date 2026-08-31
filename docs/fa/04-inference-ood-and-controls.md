# inference، دادهٔ ندیده و کنترل‌های علمی

## ۱. تولید autoregressive دقیقاً چگونه است؟

برای prompt برابر ۴:

| ضربان | context ورودی | logits مورد استفاده | argmax |
|---:|---|---|---:|
| ۱ | `[4]` | آخرین موقعیت، ده logit | `0` |
| ۲ | `[4,0]` | آخرین موقعیت، ده logit | `5` |

دو argmax به `05` decode می‌شوند. `int("05")` فقط در لایهٔ presentation آن را `5` نشان می‌دهد.
هیچ lookup به SQLite، شرط `if digit == 9` یا جمع Python در مسیر **تولید توکن** وجود ندارد.
پس از تولید، یک oracle عددی expected/correctness را برای UI تک‌موردی محاسبه می‌کند؛ این مقدار هرگز
به model forward، logits یا argmax برنمی‌گردد. ارزیابی رسمی expected را از دیتاست probe می‌خواند.

greedy decoding عمداً انتخاب شده تا run deterministic و trace قابل تطبیق باشد. temperature یا
sampling برای taskی که یک پاسخ قطعی دارد کیفیت را کم می‌کند؛ اگر بعداً برای آموزش sampling اضافه
شود، باید به‌عنوان mode آزمایشگاهی جدا نام‌گذاری شود.

## ۲. «دادهٔ ندیده» چهار معنای متفاوت دارد

### خارج از vocabulary

`A`، `۹`، `-1` و فاصله representable نیستند. چون UNK نداریم، tokenizer آن‌ها را پیش از forward
رد می‌کند. مدل هیچ output معناداری برای آن‌ها ندارد.

### ورودی معتبر ولی حذف‌شده از training

checkpoint held-out فقط promptهای ۰ تا ۷ را support می‌کند. در اجرای تحویلی:

```text
8 → 00  (expected 09, unsupported)
9 → 02  (expected 10, unsupported)
```

شکست اتفاقی نیست: embedding ورودی ۹ هیچ‌گاه در corpus آن run استفاده نشده است و embedding ورودی
۸ نیز prompt آموزشی نبوده است. حتی اگر یکی از پاسخ‌ها تصادفاً درست می‌شد، evidence یادگیری قانون
نبود؛ `supported=false` باقی می‌ماند.

### mapping ندیده پس از pretraining دیده‌شده

آزمایش `sft_successor_except7_v1` دقیقاً row `7→08` را حذف می‌کند، ولی pretraining هر ده token را
دیده است. اجرای تحویلی روی ۹ mapping پشتیبانی‌شده ۹/۹ شد و روی ۷ مقدار خام `07` به‌جای `08`
داد. exposure report جدا ثبت می‌کند: token در pretrain دیده شد؟ bigram دیده شد؟ prompt در SFT
دیده شد؟ exact mapping دیده شد؟ بنابراین این failure با embedding کاملاً ندیده اشتباه نمی‌شود.

### context جدید از tokenهای آشنا

endpoint `/api/inspect` رشتهٔ یک تا هشت‌رقمی می‌گیرد. `01234567` شبیه progression آموزشی است،
ولی `77777777` یا `31415926` distribution متفاوت دارند. خروجی finite است، اما correctness label
ندارد مگر task و target از قبل تعریف شود.

## ۳. چرا مدل نهایی OOD تک‌رقمی ندارد؟

دامنهٔ prompt عمومی فقط ده عضو دارد و SFT نهایی هر ده را دیده است. بنابراین پس از full SFT هیچ
prompt معتبر تک‌رقمیِ ندیده باقی نمی‌ماند. برای مطالعهٔ generalization باید checkpoint پیش از full
SFT، held-out run، context چندتوکنی جدید یا vocabulary بزرگ‌تر را استفاده کرد.

این واقعیت جلوی ادعای غلط را می‌گیرد: ۱۰/۱۰ مدل نهایی می‌تواند صرفاً lookup table توزیع‌شده در
وزن‌ها باشد. مدل کوچک ظرفیت کافی برای حفظ بیست target token را دارد.

## ۴. کنترل برچسب خراب

مدل control از همان parent pretrain و همان trainer استفاده می‌کند، اما دیتاستش `4→99` دارد. نتیجهٔ
واقعی:

```text
accuracy against corrupt labels: 10/10
accuracy against true rule:       9/10
prediction for 4:                 99
```

اگر generation fallback مخفی successor داشت، مدل نمی‌توانست `99` تولید کند. این کنترل شاهد
قوی‌تری از صرفاً مشاهدهٔ loss است که data واقعاً رفتار را تعیین کرده است.

expectedهای این دو مقایسه از `probe_successor_corrupt4_v1` و `probe_successor_true_v1` می‌آیند؛
هر دو manifest و row hash ثابت دارند و trainer به split `probe` دسترسی ندارد.

## ۵. trace هر ضربان

هر step این خروجی‌های سبک را همیشه دارد:

- context و IDها؛
- ده logit و ده probability؛
- argmax، entropy و فاصلهٔ دو احتمال اول.

با `include_trace=true` موارد سنگین نیز اضافه می‌شوند:

- token و position embedding؛
- Q/K/V، score، causal mask و attention هر head/layer؛
- pre/post GELU و residual stream؛
- final hidden؛
- gradient logit انتخاب‌شده نسبت به embedding ورودی؛
- logit lens پس از embedding و هر block؛
- contribution بُعدها به logit انتخابی.

gradient با یک forward جدا و autograd محاسبه می‌شود؛ انتخاب token از forward inference تغییر
نمی‌کند. این مسیر فقط با درخواست trace فعال است.

## ۶. عدم قطعیت

entropy توزیع ده‌عضوی بین صفر و `ln(10)≈2.302585` است. entropy کم یعنی مدل یک token را بسیار
ترجیح می‌دهد، نه اینکه پاسخ لزوماً درست است. مدل corrupt برای `99` می‌تواند confidence بالا و
در عین حال نسبت به حقیقت غلط باشد؛ بنابراین confidence جای correctness و provenance را نمی‌گیرد.
