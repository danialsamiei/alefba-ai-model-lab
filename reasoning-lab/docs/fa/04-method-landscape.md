# اطلس روش‌های مدل زبانی: از معماری تا عامل

تاریخ بازبینی: `2026-08-31`

نسخهٔ تعاملی این سند در رابط و نسخهٔ HTML دارای anchor در
[`static/docs/methods.html`](../../src/reasoning_lab/static/docs/methods.html) قرار دارد.

## قرارداد وضعیت

| وضعیت | معنای دقیق |
|---|---|
| `اجراشده` | کد یا وزن واقعی، مسیر اجرایی و آزمون متناسب در همین snapshot وجود دارد |
| `مدل تشریحی` | ورودی، سازوکار و خروجی روی صفحه مدل می‌شوند؛ backend یا checkpoint کامل وجود ندارد |
| `مطالعه‌ای` | فقط جای مفهوم در نقشه، مرز پروژه و مقالهٔ اصلی ثبت شده است |

وجود یک مقاله یا دیاگرام هیچ قابلیتی را در پروژه `IMPLEMENTED` نمی‌کند. همچنین
«اجراشده» فقط دربارهٔ همین مقیاس و artifactهاست، نه بازتولید نتایج مدل‌های بزرگ.

## ۱. معماری دنباله

### N-gram — اجراشده

چند توکن اخیر کلید جدول شمارش‌اند. مدل از فراوانی ادامه‌ها توزیع احتمال می‌سازد و برای
context ندیده به suffix کوتاه‌تر backoff می‌کند. baseline واقعی پروژه است، اما شبکهٔ
عصبی یا حافظهٔ بلند ندارد.

منبع: [Shannon 1948](https://doi.org/10.1002/j.1538-7305.1948.tb01338.x)

### Window MLP — اجراشده

هشت token آخر embedding و سپس به یک MLP داده می‌شوند. مدل موازی و ساده است، ولی چیزی
بیرون از پنجره را مستقیم نمی‌بیند.

منبع: [Bengio et al. 2003](https://www.jmlr.org/papers/v3/bengio03a.html)

### RNN / LSTM / GRU — مدل تشریحی

یک state از گام قبلی عبور می‌کند؛ gateهای LSTM/GRU تصمیم می‌گیرند چه اطلاعاتی نوشته،
فراموش یا خوانده شود. هیچ state بازگشتی یا checkpoint متناظر در پروژه وجود ندارد.

منبع: [Long Short-Term Memory](https://doi.org/10.1162/neco.1997.9.8.1735)

### CNN / TCN — مدل تشریحی

کانولوشن علّی الگوهای محلی را می‌بیند و stacking/dilation میدان دید را بزرگ می‌کند. این
خانواده در آموزش روی موقعیت‌ها موازی است؛ پروژه مدل convolutional ندارد.

منبع: [Convolutional Sequence to Sequence Learning](https://proceedings.mlr.press/v70/gehring17a.html)

### Encoder–Decoder — مدل تشریحی

encoder دنبالهٔ مبدأ را بازنمایی می‌کند و decoder با شرط‌گذاری بر آن دنبالهٔ مقصد را
می‌سازد. افزودن RAG به prefix در پروژه معادل encoder یا cross-attention جدا نیست.

منبع: [Sequence to Sequence Learning with Neural Networks](https://proceedings.neurips.cc/paper_files/paper/2014/hash/5a18e133cbf9f257297f410bb7eca942-Abstract.html)

### Dense Transformer — اجراشده

attention علّی برای هر موقعیت ترکیبی وزن‌دار از توکن‌های قبلی می‌سازد. Transformer
دو‌لایهٔ پروژه واقعی است، اما foundation model عمومی محسوب نمی‌شود.

منبع: [Attention Is All You Need](https://proceedings.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html)

### Long / Sparse Attention — مدل تشریحی

پنجرهٔ محلی و اتصال‌های global جای همه‌به‌همه را می‌گیرند تا طول بلندتر ممکن شود.
attention پروژه متراکم و context آن کوتاه است.

منبع: [Longformer](https://arxiv.org/abs/2004.05150)

### SSM / Mamba — مدل تشریحی

state فشرده در طول دنباله به‌روزرسانی می‌شود. در Mamba پارامتر انتقال تابع ورودی است تا
انتشار یا فراموش‌کردن انتخابی شود. selective scan در پروژه وجود ندارد.

منبع: [Mamba](https://arxiv.org/abs/2312.00752)

### Sparse MoE — اجراشده

router برای هر `token×layer` یک expert از چهار expert را فعال می‌کند. top-1 routing،
auxiliary loss و telemetry واقعی‌اند؛ تخصص معنایی expertها هنوز اثبات نشده است.

منبع: [Switch Transformer](https://www.jmlr.org/papers/v23/21-0998.html)

## ۲. آموزش، alignment و فشرده‌سازی

### Supervised Scratchpad — اجراشده

وزن‌ها از initialization تصادفی روی curriculum مصنوعی آموزش می‌بینند. در آموزش scratch
کل payload هدف supervised است؛ هنگام inference قاب syntax را میزبان می‌سازد و مدل فقط
slotهای رقمی را نمونه‌گیری می‌کند. این پروژه fine-tune یک مدل آماده نیست.

منبع: [Show Your Work: Scratchpads](https://arxiv.org/abs/2112.00114)

### پیش‌آموزش خودنظارتی — مطالعه‌ای

هدف از خود متن ساخته می‌شود؛ مانند next-token prediction یا masked-token reconstruction.
پروژه pretraining عمومی و corpus وب‌مقیاس ندارد.

منبع: [BERT](https://aclanthology.org/N19-1423/)

### RLHF — مطالعه‌ای

پس از demonstration و SFT، رتبه‌بندی انسانی reward model را می‌سازد و policy با RL به
سمت آن پاداش حرکت می‌کند. دادهٔ preference، reward model و PPO در پروژه نیستند.

منبع: [InstructGPT](https://proceedings.neurips.cc/paper_files/paper/2022/hash/b1efde53be364a73914f58805a001731-Abstract.html)

### DPO — مدل تشریحی

زوج `chosen/rejected` مستقیماً objective ترجیح را می‌سازد و reward model جدا لازم نیست.
صفحه فقط جهت فشار loss را مدل می‌کند؛ آموزش DPO اجرا نشده است.

منبع: [Direct Preference Optimization](https://proceedings.neurips.cc/paper_files/paper/2023/hash/a85b405ed65c6477a4fe8302b5e06ce7-Abstract-Conference.html)

### LoRA / QLoRA — مدل تشریحی

LoRA backbone را ثابت و تغییر وزن را کم‌رتبه می‌کند. QLoRA backbone منجمد را 4-bit نگه
می‌دارد و gradient را به adapter می‌رساند. پروژه backbone آماده یا adapter ندارد.

منابع: [LoRA](https://arxiv.org/abs/2106.09685)،
[QLoRA](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1feb87871436031bdc0f2beaa62a049b-Abstract.html)

### Distillation — مدل تشریحی

student توزیع نرم teacher را تقلید می‌کند تا بخشی از رفتار مدل بزرگ‌تر در مدل کوچک‌تر
جای گیرد. هیچ teacher/student pair محلی آموزش ندیده است.

منبع: [Distilling the Knowledge in a Neural Network](https://arxiv.org/abs/1503.02531)

### Quantization — مدل تشریحی

وزن یا activation با scale و rounding به تعداد بیت کمتر نگاشت می‌شود. checkpointهای
پروژه quantized نیستند و سرعت واقعی به kernel و سخت‌افزار بستگی دارد.

منبع: [GPTQ](https://arxiv.org/abs/2210.17323)

## ۳. استنتاج، search و بهینه‌سازی اجرا

### Greedy / Temperature / Top-k — اجراشده

temperature شکل توزیع را تغییر می‌دهد؛ top-k گزینه‌ها را محدود می‌کند؛ سپس argmax یا
sampling token را برمی‌گزیند. nucleus/top-p در پروژه پیاده نشده است.

منبع: [The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)

### Beam / Contrastive Search — مدل تشریحی

beam چند prefix را هم‌زمان نگه می‌دارد؛ contrastive search احتمال و جریمهٔ شباهت
بازنمایی را ترکیب می‌کند. sampleهای مستقل پروژه هیچ‌کدام از این دو نیستند.

منبع: [A Contrastive Framework for Neural Text Generation](https://proceedings.neurips.cc/paper_files/paper/2022/hash/871cae8f599cb8bbfcb0f58fe1af95ad-Abstract-Conference.html)

### Self-Consistency میکرو — تقریب اجراشده

چند candidate ساخته و پاسخ تجمیع می‌شود؛ اما انتخاب پروژه علاوه بر majority از protocol
validity و verifier score نیز استفاده می‌کند. پس self-consistency خالص نیست.

منبع: [Self-Consistency](https://openreview.net/pdf?id=1PL1NIMMrw)

### Speculative Decoding — مدل تشریحی

draft model چند token پیشنهاد و target model آن‌ها را موازی بررسی می‌کند. هدف کاهش latency
با حفظ توزیع target است، نه افزودن reasoning. پروژه draft/target pair ندارد.

منبع: [Fast Inference via Speculative Decoding](https://proceedings.mlr.press/v202/leviathan23a.html)

### KV Cache / MQA / GQA — مدل تشریحی

K/V گذشته cache می‌شود و GQA تعداد headهای K/V را میان query headها مشترک می‌کند. decoder
آزمایشگاه در هر گام forward کامل می‌زند و cache اختصاصی ندارد.

منبع: [GQA](https://aclanthology.org/2023.emnlp-main.298/)

### FlashAttention — مطالعه‌ای

attention دقیق با tiling و online softmax بازچینی می‌شود تا IO میان HBM و SRAM کم شود.
این kernel توان reasoning تازه ایجاد نمی‌کند و در پروژهٔ CPU اجرا نشده است.

منبع: [FlashAttention](https://proceedings.neurips.cc/paper_files/paper/2022/hash/67d57c32e20fd0a7a302cb81d36e40d5-Abstract.html)

### Grammar Constraint + Verifier — اجراشده

grammar token نامعتبر را mask و verifier خروجی را پس از تولید بررسی می‌کند. درستی syntax،
درستی جواب و توان model-only سه ادعای جدا هستند.

منبع: [PICARD](https://aclanthology.org/2021.emnlp-main.779/)

### Tree of Thoughts / Planning Search — مدل تشریحی

شاخه‌ها گسترش، ارزیابی و prune می‌شوند و search می‌تواند backtrack کند. چند sample مستقل
پروژه tree search، reflection یا MCTS نیست.

منبع: [Tree of Thoughts](https://proceedings.neurips.cc/paper/2023/hash/271db9922b8d1f4dd7aaef84ed5ac703-Abstract.html)

## ۴. دانش و حافظه

### FTS5 RAG — اجراشده

retriever واژگانی اسناد همان world را رتبه‌بندی و به prompt تزریق می‌کند. در مسیر تعاملی،
facts همان درخواست ابتدا به سند تبدیل می‌شوند؛ بنابراین fixture بسته است و کشف دانش ناشناخته
از corpus مستقل نیست.

منبع: [Retrieval-Augmented Generation](https://proceedings.neurips.cc/paper_files/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html)

### Dense Retrieval — مدل تشریحی

dual encoder، query و passage را به embedding تبدیل و با similarity جست‌وجو می‌کند. پروژه
embedding model یا vector index ندارد.

منبع: [Dense Passage Retrieval](https://aclanthology.org/2020.emnlp-main.550/)

### Hybrid Retrieval + Reranker — مدل تشریحی

sparse و dense candidateها fusion و سپس توسط cross-encoder دوباره امتیازدهی می‌شوند.
RAG فعلی یک مرحلهٔ FTS5 است.

منبع: [Passage Re-ranking with BERT](https://arxiv.org/abs/1901.04085)

### RETRO / حافظهٔ بلند — مطالعه‌ای

chunk مشابه یا state پیشین بازیابی می‌شود و مدل بر آن شرطی می‌شود. SQLite پروژه corpus facts
کوچک است و policy حافظهٔ مکالمه یا RETRO ندارد.

منابع: [RETRO](https://proceedings.mlr.press/v162/borgeaud22a.html)،
[Transformer-XL](https://aclanthology.org/P19-1285/)

## ۵. ابزار، عامل و multimodality

### Tool Use اسکریپتی — اجراشده

controller قطعی AST را می‌خواند، `LOOKUP/CALC` را validate و در میزبان اجرا می‌کند. مدل
call را انتخاب نمی‌کند و موفقیت tools توان model-only نیست.

منبع مقایسه‌ای: [Toolformer](https://proceedings.neurips.cc/paper/2023/hash/d842425e4bf79ba039352da0f658a906-Abstract-Conference.html)

### ReAct / Learned Tool Use — مدل تشریحی

مدل action می‌سازد، میزبان آن را اجرا می‌کند و observation دوباره به context برمی‌گردد.
executor پروژه واقعی است، اما policy انتخاب ابزار و حلقهٔ model→tool→model وجود ندارند.

منبع: [ReAct](https://arxiv.org/abs/2210.03629)

### Multimodal Model — مطالعه‌ای

encoder تصویر/صوت را به نمایش قابل‌ترکیب با متن می‌برد. API و tokenizer پروژه فقط متن DSL
و ارقام را می‌پذیرند.

منبع: [CLIP](https://proceedings.mlr.press/v139/radford21a.html)

### عامل چندگامه و حافظهٔ پایدار — مطالعه‌ای

ارکستریتور goal را به step تبدیل، state و provenance را ذخیره و با observation برنامه را
اصلاح می‌کند. هر `solve` پروژه مستقل است و برنامه‌ریز یا حافظهٔ کاربر ندارد.

منابع: [ReAct](https://arxiv.org/abs/2210.03629)،
[Tree of Thoughts](https://proceedings.neurips.cc/paper/2023/hash/271db9922b8d1f4dd7aaef84ed5ac703-Abstract.html)

## مرزهای نهایی

1. attention، routing و probability تله‌متری‌اند؛ توضیح علّی قطعی نیستند.
2. scratchpad خروجی مدل است؛ پنجره‌ای به فکر پنهان نیست.
3. RAG و tool result بیرون checkpoint هستند.
4. FlashAttention و KV cache روش سرعت/حافظه‌اند، نه reasoning.
5. LoRA و DPO روش انطباق‌اند، نه معماری تازه.
6. نتیجهٔ یک seed و مسئلهٔ میکرو، رفتار LLMهای بزرگ را ثابت نمی‌کند.
