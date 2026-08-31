# آزمایش‌هایی که مفاهیم را از هم جدا می‌کنند

## معماری

یک expression و facts ثابت را با n-gram، Window MLP و Dense Transformer اجرا
کنید. تعداد پارامتر، context قابل‌دسترسی و accuracy را کنار هم ببینید. نتیجه فقط
برای همین داده معتبر است؛ «Transformer همیشه بهتر است» نتیجهٔ مجاز نیست.

## scratchpad و faithfulness

Dense direct و Dense scratch دقیقاً ۴۹٬۹۲۰ پارامتر دارند. اگر جواب نهایی درست
اما `protocol_valid=false` بود، نمونه‌ای از فاصلهٔ answer accuracy و trace
faithfulness دیده‌اید. scratchpad را عمداً خراب کنید و verifier را اجرا کنید.

## effort

سه سطح effort را پشت سر هم اجرا کنید. hash checkpoint باید ثابت بماند. در اجرای
مرجع accuracy ثابت ماند اما هزینه ۴ و ۸ برابر شد. نتیجهٔ منفی را به‌عنوان داده
نگه دارید؛ budget بیشتر تضمین quality نیست.

## MoE

یک اجرای `moe_scratch` با capture روشن انجام دهید. در تب MoE تعداد توکن هر expert
را ببینید. سپس چند ورودی متفاوت اجرا کنید. تغییر routing مشاهده است؛ برای ادعای
«تخصص معنایی expert» به ablation، forcing و چند seed نیاز است.

## RAG

روی یک fact holdout دو حالت query-only و RAG را مقایسه کنید. checkpoint hash
یکسان و document IDs/hashes ثبت می‌شوند. سپس محتوای یک سند آزمایشی را در یک
database موقت تغییر دهید و ببینید پاسخ بدون retrain می‌تواند عوض شود. retrieved
fact همچنان EXTERNAL است.

## Tools

حالت Tools را اجرا کنید و زنجیرهٔ CALL/OBS را ببینید. `max_calls` را کمتر از
تعداد لازم قرار دهید تا `INCOMPLETE_BUDGET` بگیرید. سپس unknown tool یا operand
خارج ۰..۹ را به `ToolRuntime` بدهید؛ باید fail-closed شود.

## دادهٔ ندیده

`depth_ood` فقط depth=3 دارد، در حالی که train حداکثر depth=2 است. افت اجرای
مرجع از IID به OOD نشان می‌دهد token-loss پایین به‌تنهایی الگوریتم عمومی را ثابت
نمی‌کند. برای ادعای پایدار باید چند seed و confidence interval اضافه شود.
