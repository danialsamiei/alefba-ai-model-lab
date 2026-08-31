# پیش‌آموزش، فاین‌تیون و checkpoint

## ۱. تفاوت دو objective

### pretraining خودنظارتی

یک progression مانند زیر label دستی جدا ندارد:

```text
sequence:  036925814
input:     03692581
target:    36925814
```

target فقط همان sequence است که یک خانه shift شده. مدل برای هر موقعیت next-token را پیش‌بینی
می‌کند. شش stride مختلف باعث می‌شود context برای تشخیص pattern مهم باشد. این مرحله قالب خروجی
دو‌رقمی successor را آموزش نمی‌دهد؛ فقط نمایش‌های token و الگوی next-token را شکل می‌دهد.

### supervised fine-tuning

ردیف `4→05` در trainer به این tensorها تبدیل می‌شود:

```text
model input: [4, 0]
target:      [0, 5]
```

موقعیت صفر با prompt `4` باید tens token یعنی `0` را پیش‌بینی کند. موقعیت یک با context `[4,0]`
باید ones token یعنی `5` را پیش‌بینی کند. در training، صفر درست به موقعیت دوم داده می‌شود؛ این
teacher forcing است. در inference، token اول خود مدل داده می‌شود؛ این free-running است. به همین
علت evaluation باید sequence کامل تولیدشده را بسنجد، نه فقط loss teacher-forced.

برای `9→10`:

```text
model input: [9, 1]
target:      [1, 0]
```

این تنها carry در دامنه است. مدل هیچ واحد carry نمادین ندارد؛ mapping را در وزن‌ها یاد می‌گیرد.

## ۲. initialization و seed

برای run بدون parent، Linear و Embedding با Normal میانگین صفر و انحراف معیار ۰٫۰۲ initialize
می‌شوند؛ biasها صفرند. پیش از ساخت مدل:

- seed کتابخانهٔ `random`؛
- seed NumPy؛
- seed PyTorch؛
- `torch.use_deterministic_algorithms(True)`؛
- یک thread CPU؛
- dropout صفر.

در SFT، ابتدا Safetensors parent بارگذاری می‌شود و سپس seed فقط ترتیب batch و عملیات بعدی را
ثابت می‌کند. hash tensor parent در metadata child ثبت می‌شود.

بازتولید bit-identical فقط برای environment پین‌شدهٔ همین CPU/Python/PyTorch ادعا می‌شود. PyTorch
تضمین cross-platform یا cross-version نمی‌دهد.

## ۳. mini-batch و shuffle

`DeterministicBatcher` با `torch.Generator` محلی و seed مستقل permutation می‌سازد. وقتی به انتهای
داده برسد، permutation جدید deterministic ایجاد می‌کند. `num_workers` و multiprocessing وجود
ندارد؛ برای ۶۰ ردیف سودی ندارند و reproducibility را دشوار می‌کنند.

state کامل sampler شامل generator state، permutation جاری، cursor، batch size و طول دیتاست در
`training_state.pt` ثبت می‌شود. تست جدا state را در batcher تازه restore می‌کند و یک mini-batch
بعدی bit-identical می‌گیرد.

در SFT کامل batch size برابر ده است، بنابراین هر step تمام truth table را می‌بیند. این انتخاب
برای یک آزمایشگاه finite و قابل تکرار است؛ نسخهٔ بزرگ‌تر باید batch stochastic واقعی داشته باشد.

## ۴. AdamW و parameter groups

پارامترهای ماتریسی (`ndim>=2`) weight decay می‌گیرند؛ bias و پارامترهای LayerNorm decay ندارند.
optimizer از AdamW با `β₁=0.9` و `β₂=0.95` استفاده می‌کند. AdamW میانگین و واریانس متحرک gradient
را نگه می‌دارد و decay را از gradient loss جدا اعمال می‌کند.

gradient قبل از optimizer step با norm حداکثر ۱ clip می‌شود. مقدار norm قبل از clip در جدول
`metrics` ثبت می‌شود تا انفجار gradient قابل مشاهده باشد.

## ۵. warmup و cosine decay

در warmup، learning rate خطی از صفر تا LR اصلی بالا می‌رود. بعد از آن:

```text
lr = min_lr + 0.5(1 + cos(πp))(max_lr - min_lr)
```

که `p` پیشرفت نرمال‌شده از پایان warmup تا آخرین step است. config همهٔ stageها در
`configs/lab.toml` قابل خواندن است.

## ۶. metricها

پیش از step اول یک baseline ثبت می‌شود. سپس در `eval_interval`:

- cross-entropy loss؛
- token accuracy؛
- perplexity برابر `exp(loss)`؛
- learning rate؛
- gradient norm.

در اجرای تحویلی، SFT canonical از loss حدود ۶٫۳۹۶ و token accuracy حدود ۵٪ به loss
`2.84e-6` و accuracy صددرصد رسید. گزارش دقیق هر run در `metrics.json` و SQLite است.

pretraining با چند stride در موقعیت نخست ابهام ذاتی دارد: prompt تک‌توکنی stride را مشخص نمی‌کند.
به همین دلیل loss validation آن نباید با معیار SFT مقایسه یا مجبور به صفر شود.

SFT کامل validation مستقل ندارد. بنابراین checkpoint برای آن `final_validation_metrics=null` و
`metric_selection_split=train` ثبت می‌کند؛ train metric هرگز با نام validation نمایش داده نمی‌شود.
checkpoint همیشه وزن step نهایی را ذخیره می‌کند تا با optimizer/sampler state هم‌راستا باشد و
بهترین metric مشاهده‌شده را با step آن جدا نگه می‌دارد؛ ادعای «best checkpoint» نمی‌شود.

## ۷. lineage و weight delta

run فاین‌تیون دارای این زنجیره است:

```text
canonical-pretrain
  └── final-sft
  └── corrupt-label-control
  └── known-token-mapping-holdout-sft

random-init
  └── random-init-sft-baseline

holdout-pretrain
  └── holdout-sft
```

metadata child شامل `parent_run_id`، `parent_tensor_sha256` و norm اختلاف تک‌تک tensorها است.
metadata نسخهٔ ۲ درون Safetensors نیز run/stage/seed/device، vocabulary، dataset و config hash،
parent run/tensor، source fingerprint و tensor hash را دارد؛ loader آن را با sidecar تطبیق می‌دهد.
loader برای checkpointهای نسخهٔ ۱ پروژه read-only compatibility دارد، اما همهٔ artifactهای جدید
با provenance سخت‌گیرانهٔ v2 نوشته می‌شوند. اگر total delta صفر باشد، fine-tuning واقعاً هیچ وزنی
را تغییر نداده و گیت تجمیعی تحویل fail می‌شود.

baseline تصادفی از همان full-SFT config و seed ترتیب batch استفاده می‌کند، اما parent pretrain
ندارد. در اجرای تحویلی baseline و مدل pretrain→SFT هر دو ۱۰/۱۰ شدند؛ نتیجهٔ علمی این است که برای
truth table ده‌ردیفی، pretraining شرط لازم نبود. checkpoint فقط-pretrain روی همین task صفر از ده
بود، چون قالب successor را هنوز ندیده بود.

## ۸. Safetensors و state آموزش

وزن inference در `model.safetensors` ذخیره می‌شود. این format فقط tensor است و code execution
ندارد. `checkpoint.json` معماری، dataset hash، seed، lineage و دو hash را نگه می‌دارد:

- SHA-256 خود فایل؛
- canonical tensor hash بر پایهٔ نام، shape، dtype و بایت خام tensorها.

`training_state.pt` شامل optimizer، step، RNG عمومی PyTorch و state خصوصی sampler است. این فایل
هرگز در serve بارگذاری نمی‌شود. loader محلی ابتدا SHA را بررسی و سپس `torch.load` را با
`weights_only=True` و `map_location=cpu` صدا می‌زند. API/CLI خودکار برای ادامهٔ run پیاده نشده؛ این
فایل state لازم برای مطالعه و ساخت resume بعدی است، نه ادعای feature تکمیل‌شده. artifact ناشناس یا
آپلود کاربر پذیرفته نمی‌شود.

environment همراه run و checkpoint شامل نسخه‌های Python، PyTorch، NumPy، FastAPI، Safetensors،
SQLite و uv، hash فایل lock و fingerprint کد/SQL/UI/config است. چون این پوشه Git repository نیست،
`source_revision` صادقانه `unavailable` ثبت می‌شود.
