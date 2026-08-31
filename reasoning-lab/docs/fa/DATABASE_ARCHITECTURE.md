<!-- DATABASE_ARCHITECTURE:START -->
## خلاصهٔ معماری پایگاه‌داده

این آزمایشگاه عمداً SQLite را به‌جای PostgreSQL انتخاب می‌کند: تک‌کاربره، محلی،
بدون سرویس جدا و قابل حمل است. اصول skill معماری پایگاه‌داده—کلید خارجی، migration
نسخه‌دار، index، transaction، منشأ داده و آزمون واقعی—برای SQLite تطبیق داده شد؛
ویژگی‌های اختصاصی PostgreSQL 18 مانند UUIDv7 و temporal constraint در این مقیاس
قابل‌اعمال نیستند.

| خانوادهٔ جدول | هدف |
|---|---|
| dataset_versions / worlds / episodes | نسخه، split و label ارزیابی |
| documents / documents_fts | corpus بیرونی و FTS5 |
| training_examples | token IDs و loss mask واقعی |
| runs / metrics / artifacts | بازتولید آموزش و benchmark |
| inference_traces / candidates / token_steps | effort و generation telemetry |
| retrieval_events / retrieval_hits | query، rank، score و document hash |
| tool_calls | boundary اجرا و خطا/latency |
| moe_routing_summaries | expert count و gate probability |

تمام foreign keyها فعال‌اند، WAL و busy timeout تنظیم شده‌اند، و FTS5 هنگام
initialize بررسی می‌شود. پاسخ طلایی فقط از `gold_label` قابل دریافت است؛
`public_episode` آن را برنمی‌گرداند. indexها مسیرهای split، world، run و trace را
پوشش می‌دهند. migration اولیه idempotent است و integration test روی SQLite واقعی
اجرا می‌شود.

**وضعیت تأیید:** 2026-08-30، آزمون محلی PASS
<!-- DATABASE_ARCHITECTURE:END -->
