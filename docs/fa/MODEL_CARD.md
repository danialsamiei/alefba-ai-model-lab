# کارت مدل: Digit LM Microscope 0.1

## وضعیت

**پیاده‌سازی‌شده، محلی، آموزش‌دیده و روی CPU میزبان راستی‌آزمایی‌شده.** این یک artifact آموزشی
است، نه مدل production عمومی و نه سرویس اینترنتی deployشده.

## کاربرد مورد نظر

- فهم مکانیکی tokenizer، decoder Transformer، loss، optimizer و generation؛
- مشاهدهٔ tensorها در مقیاس قابل خواندن؛
- مقایسهٔ pretraining، SFT، held-out و label corruption؛
- آموزش provenance، hash و checkpoint lineage.

## قرارداد ورودی/خروجی

- ورودی: دقیقاً یکی از نویسه‌های ASCII `0..9`؛
- خروجی خام: دقیقاً دو token رقمی؛
- خروجی انسانی: successor عددی از ۱ تا ۱۰؛
- decoding: greedy، دو step ثابت، بدون EOS.

## معماری

- ۱۸٬۰۴۸ پارامتر؛
- `d_model=32`، دو block، چهار head، `d_ff=64`؛
- context حداکثر هشت؛
- learned token/position embedding؛
- pre-norm causal self-attention و GELU MLP؛
- LM head ده‌خروجی untied؛
- dropout صفر در run canonical.

## داده

همهٔ داده‌ها synthetic، نسخه‌بندی‌شده و در [DATA_CARD.md](DATA_CARD.md) تشریح شده‌اند. مدل نهایی
جدول کامل ده mapping را در SFT دیده است.

## نتیجهٔ اجرای ۲۰۲۶-۰۸-۳۰

| ارزیابی | نتیجه | تفسیر |
|---|---:|---|
| pretrain-only روی successor | ۰/۱۰ | task و قالب دو‌توکنی را SFT ندیده است |
| random-init + full SFT | ۱۰/۱۰ | baseline: pretraining برای این جدول شرط لازم نبود |
| canonical successor | ۱۰/۱۰ | exhaustive functional، نه generalization |
| held-out supported 0..7 | ۸/۸ | در دامنهٔ آموزش کنترل |
| held-out unsupported 8,9 | ۰/۲ | `8→00` و `9→02`؛ قابلیت ادعا نمی‌شود |
| known-token mapping supported | ۹/۹ | همه جز ۷ در SFT دیده شدند |
| known-token mapping input 7 | ۰/۱ | `7→07` به‌جای `08`؛ token دیده، mapping ندیده |
| corrupt against corrupt labels | ۱۰/۱۰ | مدل دادهٔ `4→99` را یاد گرفت |
| corrupt against true rule | ۹/۱۰ | دقیقاً روی ۴ شکست |

loss SFT canonical از حدود ۶٫۳۹۶ به `2.84e-6` رسید. checkpoint و tensor hash دقیق در
`artifacts/latest.json` و `artifacts/lab-report.json` قرار دارند.

## محدودیت‌ها

- موفقیت می‌تواند حفظ truth table باشد؛ مدل جمع نمادین اثبات‌شده ندارد.
- کل دامنه ده prompt است؛ بعد از full SFT، ورودی معتبر تک‌رقمی ندیده باقی نمی‌ماند.
- خروجی fixed-width است و مدل پایان sequence را یاد نمی‌گیرد.
- attention توضیح علّی نیست؛ برای prompt تک‌توکنی همیشه ۱ است.
- synthetic split استقلال آماری قوی ندارد.
- baseline تصادفی هم ۱۰/۱۰ است؛ این آزمایش مزیت ضروری pretraining را نشان نداد.
- confidence بالا correctness یا calibration را تضمین نمی‌کند.
- determinism bitwise فقط در environment پین‌شدهٔ CPU انتظار می‌رود.
- ورودی فارسی، نشانه، اعشار، whitespace و چندرقمی در endpoint عمومی رد می‌شوند.

## ایمنی و حریم خصوصی

مدل شبکه یا ابزار خارجی ندارد و دادهٔ شخصی پردازش نمی‌کند. API پیش‌فرض فقط روی
`127.0.0.1` اجرا می‌شود. checkpoint ورودی کاربر یا pickle ناشناس پذیرفته نمی‌شود. inference از
Safetensors hash-verified استفاده می‌کند.
label ارزیابی رسمی از probeهای immutable و hash-verified می‌آید. `run-lab --reset` snapshot قبلی را حذف
نمی‌کند؛ تا زمان PASS شدن candidate، release فعال سر جای خود می‌ماند و snapshot با hash تک‌تک
فایل‌ها در `artifacts/archives/` نگه‌داری می‌شود.

## نتیجهٔ اخلاقی/علمی

این پروژه ماشین LLM را زیر میکروسکوپ می‌گذارد، اما کوچک‌بودن جهان نباید به بزرگ‌نمایی ادعا منجر
شود. ۱۰/۱۰ روی ده mapping، فهم زبان، حساب عمومی یا reasoning را اثبات نمی‌کند.
