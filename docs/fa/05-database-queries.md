# کوئری‌های دفتر آزمایش

CLI امن و خلاصه:

```powershell
uv run digit-lm db-summary
```

برای دیدن SQL واقعی بدون نصب ابزار جدا، می‌توانید از `sqlite3` استاندارد Python استفاده کنید:

```powershell
uv run python -c "import sqlite3; c=sqlite3.connect('lab.sqlite3'); print(c.execute('select name,row_count,manifest_sha256 from datasets order by name').fetchall())"
```

## lineage آموزش

```sql
SELECT
  run_id,
  stage,
  parent_run_id,
  dataset_id,
  status,
  checkpoint_sha256,
  tensor_sha256
FROM runs
ORDER BY started_at;
```

## منحنی loss یک run

```sql
SELECT step, split, loss, token_accuracy, perplexity, learning_rate, gradient_norm
FROM metrics
WHERE run_id = :run_id
ORDER BY step, split;
```

## تفاوت correct و supported

```sql
SELECT input_text, expected_text, predicted_text, correct, supported, exposure_json
FROM evaluations
WHERE experiment = 'heldout_8_9'
ORDER BY input_text;
```

دو ردیف ۸ و ۹ `supported=0` هستند. اگر `correct=1` هم می‌شدند، query همچنان آن‌ها را از قابلیت
تأییدشده جدا نگه می‌داشت.

برای جداکردن «توکن دیده‌شده، mapping ندیده»:

```sql
SELECT input_text, expected_text, predicted_text, supported, exposure_json
FROM evaluations
WHERE experiment = 'known_token_mapping_heldout_7' AND input_text = '7';
```

labelهای expected این جدول از datasetهای split=`probe` می‌آیند، نه محاسبهٔ لحظه‌ای evaluator.

status برابر `completed` و پنج row artifact در یک transaction ثبت می‌شوند؛ بنابراین run کامل
نمی‌تواند بدون ledger وزن، metadata، metric، tokenizer و training state دیده شود.

`run-lab --reset` رکوردهای پذیرفته‌شدهٔ قبلی را از ledger پاک نمی‌کند. runها append-only هستند؛
UI برای هر experiment تازه‌ترین run را نمایش می‌دهد، ولی همین queryها تاریخچهٔ همهٔ نسل‌ها را
در دسترس نگه می‌دارند. snapshot قبل از اجرا hash تک‌تک فایل‌ها را ثبت می‌کند.

## بررسی journal

```sql
PRAGMA journal_mode;
```

پاسخ canonical این پروژه `delete` است، نه `wal`.

## نکتهٔ امنیتی

API فقط endpointهای GET مشخص برای dataset/run و endpointهای محدود prediction دارد؛ هیچ endpoint
SQL دلخواه، DML یا DDL ارائه نشده است. queryهای این سند برای اپراتور محلی‌اند و از ورودی وب ساخته
نمی‌شوند. repository همهٔ مقدارهای متغیر را با placeholder `?` bind می‌کند.
