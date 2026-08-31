# کارت داده

## منشأ

تمام داده‌ها به‌صورت deterministic توسط `src/digit_lm/data.py` ساخته می‌شوند. هیچ scraping، API،
دادهٔ شخصی، دادهٔ دارای copyright یا نمونهٔ انسانی وجود ندارد. داده‌ها synthetic و برچسب آن‌ها
آشکار است.

## فهرست نسخه‌ها

| نام | ردیف | objective | نقش |
|---|---:|---|---|
| `pt_patterns_v1` | ۶۰ | causal LM | pretraining اصلی با شش stride |
| `pt_digits_0_7_v1` | ۸ | causal LM | pretraining کنترل بدون رقم ۸ و ۹ |
| `sft_successor_full_v1` | ۱۰ | successor SFT | مدل قابل استفادهٔ نهایی |
| `sft_successor_0_7_v1` | ۸ | successor SFT | کنترل promptهای held-out |
| `sft_successor_except7_v1` | ۹ | successor SFT | توکن دیده‌شده، mapping ۷ حذف‌شده |
| `sft_corrupt4_full_v1` | ۱۰ | successor SFT | کنترل منفی `4→99` |
| `probe_successor_true_v1` | ۱۰ | probe | labelهای immutable قانون واقعی |
| `probe_successor_corrupt4_v1` | ۱۰ | probe | labelهای immutable کنترل خراب |

SHA-256 دقیق هر نسخه در `data/manifests/` و جدول `datasets` است. ساخت مجدد باید همان hash را
تولید کند؛ تست integration این invariant را روی دو SQLite مستقل بررسی می‌کند.
خود JSONLهای روی دیسک نیز SHA مستقل دارند، اتمیک نوشته می‌شوند و پیش و پس از آموزش با row hash
و manifest تطبیق داده می‌شوند؛ دست‌کاری فایل دیسک یک تست fail-closed جدا دارد.

## schema هر ردیف JSONL

```json
{
  "example_id": "sft_successor_full_v1:004:...",
  "split": "train",
  "objective": "successor_sft",
  "input_text": "4",
  "target_text": "05",
  "input_ids": [4],
  "target_ids": [0, 5],
  "metadata": {
    "source": "successor_truth_table",
    "numeric_successor": 5,
    "zero_padded_protocol": true,
    "corrupted_label": false
  },
  "row_sha256": "..."
}
```

## split و leakage

pretraining اصلی بر اساس start progression split شده است؛ row hash مشترک بین splitها وجود ندارد.
با این حال progressionها از یک generator و قانون مشترک‌اند، پس استقلال semantic محدود است.

SFT کامل split test مستقل ندارد، زیرا تمام ده mapping برای قابلیت نهایی لازم‌اند. ارزیابی ۱۰/۱۰
exhaustive regression است. کنترل held-out مسیر جدا دارد و هیچ‌گاه با نتیجهٔ مدل نهایی ترکیب
نمی‌شود.

ردیف‌های `probe` در هیچ split آموزشی alias نمی‌شوند و evaluator آن‌ها را پس از پایان optimizer
می‌خواند. SFT چون validation مستقل ندارد، `final_validation_metrics=null` ثبت می‌کند؛ metric
انتخابی آن صریحاً `train` است و به‌عنوان validation بازنام‌گذاری نمی‌شود.

## known issue آموزشی

در pretraining چند stride، prediction اولین موقعیت از یک token تنها stride را نمی‌شناسد. loss آن
موقعیت یک ابهام واقعی داده است، نه bug مدل. accuracy بهتر در موقعیت‌های بعدی نباید به موقعیت اول
تعمیم داده شود.

## تغییر نسخه

هر تغییر در row، split، generator config، target width یا normalization باید نام/نسخهٔ جدید و
manifest جدید بسازد. `register_dataset` علاوه بر تطبیق ID و hash، محتوای واقعی همهٔ rowهای موجود
و manifest بازسازی‌شده را بررسی می‌کند؛ mismatch یا دست‌کاری را بی‌صدا overwrite نمی‌کند.
