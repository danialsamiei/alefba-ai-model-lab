# راهنمای خواندن کد از ساده به پیچیده

## ۱. مسئلهٔ قطعی

از `task.py` شروع کنید. گرامر فقط متغیرهای `A..H` و سه عمل `ADD/SUB/MUL`
دارد. همهٔ نتیجه‌ها پیمانهٔ ۱۰ هستند. parser متن را به AST تبدیل می‌کند و
`evaluate_with_trace` با پیمایش post-order هم جواب و هم trace مرجع را می‌سازد.
این تابع «مدل» نیست؛ oracle آزمایش است.

## ۲. tokenizer و داده

`tokenizer.py` واژگان ثابت و بدون `UNK` دارد. ورودی خارج زبان fail می‌شود تا
خطای داده پنهان نشود. در `data.py` هر episode سه transcript دارد:

- direct: بعد از `<FINAL>` فقط رقم جواب؛
- scratch: بعد از `<SCRATCH>` گام‌های `GET/ADD/SUB/MUL` و سپس جواب؛
- tool: transcript آموزشیِ `<CALL>/<OBS>` ساخته می‌شود، اما checkpoint ابزارآموخته‌ای در snapshot
  فعلی وجود ندارد.

`loss_mask` دقیقاً نشان می‌دهد کدام موقعیت‌ها target مدل‌اند. prompt و observation
loss ندارند. در آموزش scratch، کل payload هدف supervised است؛ در inference قاب ثابت
دستور زبان را میزبان می‌گذارد و مدل فقط slotهای رقمی را نمونه‌گیری می‌کند. این دو مرحله
نباید با یکدیگر اشتباه شوند.

## ۳. مدل‌ها

در `models.py` هر مدل قرارداد یکسانی دارد:

```python
output = model(input_ids, targets, loss_mask, capture=True)
```

Window MLP فقط آخرین پنجرهٔ ثابت را می‌بیند. Transformer با causal attention
به همهٔ گذشتهٔ داخل context دسترسی دارد. MoE همان attention را نگه می‌دارد اما
feed-forward هر توکن را با router به یک expert از چهار expert می‌فرستد. مقدار
`capture=True` tensorهای دیداری را برمی‌گرداند؛ این داده telemetry است، نه علت
قطعی پاسخ.

## ۴. آموزش

`training.py` sequence را یک خانه shift می‌دهد: `input=t[:-1]` و
`target=t[1:]`. padding در loss خاموش است. optimizer از AdamW، warmup خطی، decay
کسینوسی و gradient clipping استفاده می‌کند. در MoE:

```text
total_loss = token_cross_entropy + load_balance_loss + router_z_loss
```

checkpoint با safetensors ذخیره می‌شود و فایل وزن، tensorها و metadata هرکدام
hash دارند. loader قبل از ساخت مدل آن‌ها را تطبیق می‌دهد.

## ۵. inference و effort

در `inference.py` سه policy وجود دارد. وزن‌ها عوض نمی‌شوند، اما تعداد candidate،
temperature و top-k با هم تغییر می‌کنند؛ پس این آزمایش اثر علّیِ صرفاً compute را
جدا نمی‌کند. scratch از constrained decoding
استفاده می‌کند: میزبان علائم قطعی grammar را می‌گذارد و مدل رقم slotها را
پیش‌بینی می‌کند. شمارندهٔ `host_framing_tokens` این کمک را جدا می‌کند.

verifier بدون خواندن label ذخیره‌شده بررسی می‌کند که متغیر، operand و نتیجهٔ
هر گام با prompt و AST سازگار باشند. سپس کاندیدا بر اساس اعتبار پروتکل، امتیاز
verifier، رأی اکثریت و log-probability انتخاب می‌شود. این controller بخشی از
سیستم inference است، نه وزن مدل.

## ۶. RAG و ابزار

`retrieval.py` نام متغیرهای expression را استخراج می‌کند، query امن FTS5 می‌سازد
و اسناد همان world را بازیابی می‌کند. در مسیر تعاملی، facts همان درخواست ابتدا به
اسناد آن world تبدیل می‌شوند؛ بنابراین این یک fixture بستهٔ retrieval-and-injection است،
نه کشف دانش ناشناخته از corpus مستقل. اسناد به prompt مدل تبدیل می‌شوند و وزن‌ها
تغییر نمی‌کنند.

`tools.py` فقط `LOOKUP(A..H)` و `CALC(ADD|SUB|MUL,left,right)` را می‌پذیرد.
هیچ `eval`، shell، شبکه یا فایل دلخواهی وجود ندارد. `tool_agent.py` فعلاً یک
controller اسکریپتی و غیرآموخته است؛ بنابراین برای فهم executor مناسب است اما
نمونهٔ Toolformer یا learned tool selection نیست.

## ۷. پایگاه‌داده و رابط

`db/schema.sql` داده، سند، run، metric، candidate، token step، retrieval، tool
call و MoE routing را در جدول‌های مستقل نگه می‌دارد. `lab.py` تنها جایی است که
این اجزا را کنار هم می‌گذارد و نتیجه را با mode صریح ثبت می‌کند. `api.py` قرارداد
ورودی بسته دارد و `static/app.js` فقط دادهٔ واقعی API را نمایش می‌دهد؛ نبود
checkpoint با mock پنهان نمی‌شود.
