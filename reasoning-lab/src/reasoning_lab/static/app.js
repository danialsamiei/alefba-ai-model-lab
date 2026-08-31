const STAGES = ["problem", "tokenize", "context", "model", "generate", "select", "result"];

const MODELS = {
  ngram: {
    label: "N-gram",
    family: "حافظهٔ شمارشی",
    summary: "چند توکن قبلی را کلید می‌گیرد و از جدول فراوانی، ادامهٔ محتمل را پیدا می‌کند.",
  },
  window_mlp: {
    label: "Window MLP",
    family: "شبکهٔ پنجره‌ای",
    summary: "هشت توکن آخر را به بردار تبدیل می‌کند و با یک MLP به امتیاز واژگان می‌رساند.",
  },
  dense_direct: {
    label: "Dense Transformer",
    family: "پاسخ مستقیم",
    summary: "با attention علّی context قبلی را ترکیب می‌کند و مستقیماً رقم پاسخ را می‌سازد.",
  },
  dense_scratch: {
    label: "Transformer + Scratchpad",
    family: "گام‌های مولد عمومی",
    summary: "خانه‌های عددی یک پروتکل گام‌به‌گام و سپس رقم پاسخ را پیش‌بینی می‌کند.",
  },
  moe_scratch: {
    label: "Sparse MoE",
    family: "ترنسفورمر خبره‌محور",
    summary: "router برای هر token×layer فقط یک expert را فعال می‌کند.",
  },
};

const MODES = {
  model_only: { label: "فقط مدل", source: "model" },
  rag: { label: "RAG + مدل", source: "external" },
  tools: { label: "کنترل‌گر + ابزار", source: "host" },
  oracle: { label: "Oracle قطعی", source: "reference" },
};

const OPS = {
  ADD: { fa: "جمع پیمانه‌ای", sign: "+", rule: "(چپ + راست) mod 10" },
  SUB: { fa: "تفریق پیمانه‌ای", sign: "−", rule: "(چپ − راست) mod 10" },
  MUL: { fa: "ضرب پیمانه‌ای", sign: "×", rule: "(چپ × راست) mod 10" },
};

const METHOD_STATUS = {
  live: { label: "اجراشده", hint: "کد یا وزن واقعی در همین پروژه اجرا و آزمون شده است." },
  model: { label: "مدل تشریحی", hint: "جریان برای آموزش شبیه‌سازی می‌شود؛ خود روش در backend اجرا نشده است." },
  read: { label: "مطالعه‌ای", hint: "فقط نقشهٔ مفهومی و منبع علمی دارد و اجرای محلی ندارد." },
};

const METHOD_CATEGORIES = {
  architecture: "معماری دنباله",
  training: "آموزش و انطباق",
  inference: "استنتاج و reasoning",
  knowledge: "دانش و حافظه",
  system: "سامانه و چندوجهی",
};

const METHODS = [
  {
    id: "ngram",
    category: "architecture",
    status: "live",
    code: "COUNT / LOCAL",
    title: "N-gram / مدل شمارشی",
    short: "چند توکن اخیر را کلید می‌گیرد و فراوانی ادامه‌ها را به احتمال تبدیل می‌کند.",
    input: "پنجرهٔ کوتاه از توکن‌ها",
    operation: "شمارش شرطی و backoff",
    output: "توزیع توکن بعدی",
    boundary: "نسخهٔ واقعی این روش در آزمایشگاه آموزش دیده و checkpoint شمارش‌ها بارگذاری می‌شود؛ حافظهٔ بلند یا معناشناسی جداگانه ندارد.",
    tradeoff: "ساده، سریع و کاملاً قابل‌ردیابی است؛ با contextهای ندیده یا وابستگی دور معمولاً شکننده می‌شود.",
    sources: [{ label: "Shannon 1948", url: "https://doi.org/10.1002/j.1538-7305.1948.tb01338.x" }],
  },
  {
    id: "window-mlp",
    category: "architecture",
    status: "live",
    code: "MLP / LOCAL",
    title: "Window MLP",
    short: "تعداد ثابتی توکن را embedding می‌کند و با لایه‌های تمام‌متصل، توکن بعدی را امتیاز می‌دهد.",
    input: "هشت توکن آخر",
    operation: "Embedding → MLP",
    output: "logit واژگان",
    boundary: "مدل کوچک واقعی با وزن تصادفیِ اولیه و curriculum همین پروژه آموزش دیده است؛ پنجرهٔ ثابت سقف حافظهٔ آن است.",
    tradeoff: "موازی و خوانا است، اما چیزی بیرون از پنجرهٔ ورودی را مستقیم نمی‌بیند.",
    sources: [{ label: "Bengio et al. 2003", url: "https://www.jmlr.org/papers/v3/bengio03a.html" }],
  },
  {
    id: "rnn-lstm",
    category: "architecture",
    status: "model",
    code: "RECURRENT",
    title: "RNN / LSTM / GRU",
    short: "یک حالت پنهان از گام قبلی به گام بعدی می‌برد؛ gateها تصمیم می‌گیرند چه چیزی نگه داشته یا فراموش شود.",
    input: "توکن جاری + حالت قبلی",
    operation: "به‌روزرسانی بازگشتی و gate",
    output: "حالت تازه + پیش‌بینی",
    boundary: "در کارت فقط گردش حالت شبیه‌سازی می‌شود؛ هیچ RNN، LSTM یا GRU در checkpointهای پروژه وجود ندارد.",
    tradeoff: "برای جریان‌های ترتیبی طبیعی است، ولی آموزش آن در طول دنباله کمتر موازی و وابستگی‌های بسیار دور دشوارتر است.",
    sources: [{ label: "LSTM 1997", url: "https://doi.org/10.1162/neco.1997.9.8.1735" }],
  },
  {
    id: "conv-sequence",
    category: "architecture",
    status: "model",
    code: "CONV / TCN",
    title: "CNN / TCN دنباله‌ای",
    short: "فیلترهای یک‌بعدی الگوهای محلی را می‌بینند و با لایه یا dilation بیشتر، میدان دید بزرگ‌تر می‌شود.",
    input: "نوار توکن‌ها",
    operation: "کانولوشن علّی و dilation",
    output: "ویژگی‌های زمینه‌ای",
    boundary: "شکل فقط رشد میدان دید را توضیح می‌دهد؛ convolution دنباله‌ای در مدل‌های محلی پیاده نشده است.",
    tradeoff: "در آموزش موازی و برای الگوهای محلی کارآمد است؛ پوشش وابستگی دور به عمق و dilation وابسته می‌ماند.",
    sources: [{ label: "ConvS2S 2017", url: "https://proceedings.mlr.press/v70/gehring17a.html" }],
  },
  {
    id: "encoder-decoder",
    category: "architecture",
    status: "model",
    code: "SEQ2SEQ",
    title: "Encoder–Decoder",
    short: "encoder ورودی کامل را بازنمایی می‌کند و decoder خروجی دیگری را گام‌به‌گام می‌سازد.",
    input: "دنبالهٔ مبدأ",
    operation: "encode → context → decode",
    output: "دنبالهٔ مقصد",
    boundary: "مدل‌های پروژه decoder-only یا baseline هستند؛ این کارت جدایی دو نیمه را مدل می‌کند، نه یک مدل آموزش‌دیدهٔ seq2seq.",
    tradeoff: "برای ترجمه و تبدیل متن‌به‌متن مناسب است؛ معماری و هزینهٔ آموزش از مدل پاسخ تک‌رقمی بیشتر می‌شود.",
    sources: [{ label: "Sutskever et al. 2014", url: "https://proceedings.neurips.cc/paper_files/paper/2014/hash/5a18e133cbf9f257297f410bb7eca942-Abstract.html" }],
  },
  {
    id: "dense-transformer",
    category: "architecture",
    status: "live",
    code: "ATTENTION / LOCAL",
    title: "Dense Transformer",
    short: "هر موقعیت با attention علّی، ترکیبی وزن‌دار از موقعیت‌های مجاز قبلی می‌سازد.",
    input: "همهٔ توکن‌های context",
    operation: "QKᵀ → softmax → V",
    output: "بازنمایی زمینه‌ای و logit",
    boundary: "دو Transformer میکرو در پروژه واقعاً آموزش دیده‌اند؛ اندازه و دادهٔ آن‌ها با LLM عمومی قابل‌قیاس نیست.",
    tradeoff: "رابطه‌های دور را مستقیم می‌بیند و آموزش موازی است؛ attention متراکم با طول context هزینهٔ درجه‌دو دارد.",
    sources: [{ label: "Vaswani et al. 2017", url: "https://arxiv.org/abs/1706.03762" }],
  },
  {
    id: "long-sparse-attention",
    category: "architecture",
    status: "model",
    code: "LONG CONTEXT",
    title: "Attention محلی/تنک و long context",
    short: "به‌جای اتصال هر توکن به همه، پنجره‌های محلی و چند اتصال global هزینه را محدود می‌کنند.",
    input: "دنبالهٔ بلند",
    operation: "local window + global links",
    output: "context بلند با اتصال محدود",
    boundary: "context آزمایشگاه کوتاه و attention آن متراکم است؛ الگوی sparse فقط در دیاگرام نمایش داده می‌شود.",
    tradeoff: "طول بیشتر را ممکن می‌کند، اما اگر اتصال مهم در الگوی دسترسی نباشد اطلاعات از دست می‌رود.",
    sources: [{ label: "Longformer 2020", url: "https://arxiv.org/abs/2004.05150" }],
  },
  {
    id: "state-space",
    category: "architecture",
    status: "model",
    code: "SSM / MAMBA",
    title: "State-Space Model / Mamba",
    short: "یک حالت فشرده را در طول دنباله به‌روز می‌کند و پارامترهای انتخابی را از ورودی می‌سازد.",
    input: "توکن + حالت فشرده",
    operation: "selective state transition",
    output: "حالت و خروجی تازه",
    boundary: "هیچ SSM یا kernel مخصوص Mamba در پروژه نصب یا آموزش نشده است؛ این فقط مدل رابطهٔ حالت‌هاست.",
    tradeoff: "زمان نسبت به طول دنباله خطی است؛ رفتار و ابزار تفسیر آن با attention یکسان نیست.",
    sources: [{ label: "Mamba 2023", url: "https://arxiv.org/abs/2312.00752" }],
  },
  {
    id: "sparse-moe",
    category: "architecture",
    status: "live",
    code: "MOE / LOCAL",
    title: "Sparse Mixture-of-Experts",
    short: "router برای هر توکن زیرمجموعه‌ای از expertها را فعال می‌کند تا ظرفیت کل از محاسبهٔ فعال جدا شود.",
    input: "بازنمایی هر توکن",
    operation: "router → top-1 expert",
    output: "خروجی expert منتخب",
    boundary: "MoE چهار-expert و top-1 در forward واقعی فعال است؛ تخصص معنایی expertها اثبات نشده است.",
    tradeoff: "ظرفیت پارامتری را با محاسبهٔ تنک بالا می‌برد، اما تعادل بار و پایداری router مسئلهٔ اصلی است.",
    sources: [{ label: "Switch Transformer 2022", url: "https://www.jmlr.org/papers/v23/21-0998.html" }],
  },
  {
    id: "scratch-supervision",
    category: "training",
    status: "live",
    code: "SFT / LOCAL",
    title: "آموزش نظارت‌شده و Scratchpad",
    short: "برای ورودی، هدف مستقیم یا رشته‌ای از گام‌های میانی برچسب می‌سازد و cross-entropy را کم می‌کند.",
    input: "نمونهٔ برچسب‌خورده",
    operation: "teacher forcing + loss",
    output: "وزن‌های checkpoint",
    boundary: "این مسیر واقعاً از صفر روی curriculum مصنوعی اجرا شده است؛ fine-tune یک مدل ازپیش‌آموزش‌دیده نیست.",
    tradeoff: "قابل‌کنترل و ممیزی است، اما کیفیت به پوشش و صحت برچسب‌ها وابسته می‌ماند.",
    sources: [{ label: "Scratchpads 2021", url: "https://arxiv.org/abs/2112.00114" }],
  },
  {
    id: "self-supervised-pretraining",
    category: "training",
    status: "read",
    code: "PRETRAIN",
    title: "پیش‌آموزش خودنظارتی",
    short: "از خود متن هدف می‌سازد؛ مانند پیش‌بینی توکن بعدی یا بازسازی توکن ماسک‌شده، سپس برای کار خاص سازگار می‌شود.",
    input: "پیکرهٔ بزرگ بدون برچسب دستی",
    operation: "هدف زبانی خودنظارتی",
    output: "مدل پایه",
    boundary: "پروژه pretraining عمومی و وب‌مقیاس ندارد؛ دادهٔ کوچک آن از قواعد مسئله تولید شده است.",
    tradeoff: "بازنمایی عمومی می‌سازد، ولی داده، محاسبه، پالایش، مجوز و ارزیابی ایمنی سنگین می‌خواهد.",
    sources: [{ label: "BERT 2019", url: "https://aclanthology.org/N19-1423/" }],
  },
  {
    id: "rlhf",
    category: "training",
    status: "read",
    code: "PREFERENCE / RL",
    title: "RLHF",
    short: "ترجیح انسان‌ها ابتدا reward model می‌سازد و سپس policy با یادگیری تقویتی به سمت آن پاداش تنظیم می‌شود.",
    input: "نمایش‌ها + رتبه‌بندی انسانی",
    operation: "reward model → policy optimization",
    output: "مدل همسوتر با ترجیح",
    boundary: "هیچ annotator، reward model یا PPO در این پروژه وجود ندارد؛ فقط خط لولهٔ مفهومی نشان داده می‌شود.",
    tradeoff: "ترجیحات پیچیده را منتقل می‌کند، اما پرهزینه و حساس به کیفیت برچسب و خطای reward model است.",
    sources: [{ label: "InstructGPT 2022", url: "https://arxiv.org/abs/2203.02155" }],
  },
  {
    id: "dpo",
    category: "training",
    status: "model",
    code: "PREFERENCE / DPO",
    title: "Direct Preference Optimization",
    short: "زوج پاسخِ ترجیح‌داده‌شده/ردشده را مستقیماً به loss طبقه‌بندی تبدیل می‌کند و reward model جدا نمی‌خواهد.",
    input: "prompt + chosen + rejected",
    operation: "loss ترجیح نسبت به reference",
    output: "policy تنظیم‌شده",
    boundary: "کارت فقط جهت فشار loss را مدل می‌کند؛ dataset ترجیح و آموزش DPO محلی نداریم.",
    tradeoff: "از RLHF ساده‌تر است، اما همچنان به دادهٔ ترجیح معتبر و انتخاب reference وابسته است.",
    sources: [{ label: "DPO 2023", url: "https://arxiv.org/abs/2305.18290" }],
  },
  {
    id: "lora-qlora",
    category: "training",
    status: "model",
    code: "PEFT",
    title: "LoRA / QLoRA",
    short: "وزن پایه را ثابت نگه می‌دارد و به‌روزرسانی‌های کم‌رتبهٔ کوچک را آموزش می‌دهد؛ QLoRA پایه را کم‌بیت نگه می‌دارد.",
    input: "مدل پایه + دادهٔ تخصصی",
    operation: "W ثابت + BA کم‌رتبه",
    output: "adapter کوچک",
    boundary: "مدل‌های این پروژه از صفر و تمام‌پارامتر آموزش دیده‌اند؛ adapter یا وزن quantized برای fine-tune ندارند.",
    tradeoff: "حافظه و ذخیره‌سازی adaptation را کم می‌کند؛ ظرفیت adapter و خطای quantization محدودیت می‌آورند.",
    sources: [
      { label: "LoRA 2021", url: "https://arxiv.org/abs/2106.09685" },
      { label: "QLoRA 2023", url: "https://arxiv.org/abs/2305.14314" },
    ],
  },
  {
    id: "distillation",
    category: "training",
    status: "model",
    code: "COMPRESSION",
    title: "Knowledge Distillation",
    short: "مدل student به‌جای فقط برچسب سخت، توزیع نرم یا خروجی‌های teacher را نیز تقلید می‌کند.",
    input: "teacher + داده",
    operation: "soft targets + student loss",
    output: "مدل کوچک‌تر",
    boundary: "هیچ teacher/student pair در پروژه آموزش ندیده است؛ نمودار انتقال توزیع صرفاً تشریحی است.",
    tradeoff: "استقرار را سبک می‌کند، اما student همهٔ ظرفیت و رفتار teacher را حفظ نمی‌کند.",
    sources: [{ label: "Hinton et al. 2015", url: "https://arxiv.org/abs/1503.02531" }],
  },
  {
    id: "quantization",
    category: "training",
    status: "model",
    code: "LOW BIT",
    title: "Quantization / کم‌بیت‌سازی",
    short: "وزن یا activation را با بیت کمتر نمایش می‌دهد تا حافظه و گاهی زمان اجرا کاهش یابد.",
    input: "وزن‌های شناور",
    operation: "scale + rounding / calibration",
    output: "وزن کم‌بیت",
    boundary: "checkpointهای محلی quantized نیستند؛ کارت فقط تبدیل عددی و محل خطای تقریب را نشان می‌دهد.",
    tradeoff: "مدل را کوچک‌تر می‌کند، ولی kernel سخت‌افزار و افت دقت تعیین می‌کنند سرعت واقعی چقدر باشد.",
    sources: [{ label: "GPTQ 2022", url: "https://arxiv.org/abs/2210.17323" }],
  },
  {
    id: "sampling",
    category: "inference",
    status: "live",
    code: "DECODE / LOCAL",
    title: "Greedy، temperature و top-k sampling",
    short: "logitها را به احتمال تبدیل می‌کند؛ greedy بیشینه را می‌گیرد و sampling از مجموعهٔ محدود نمونه می‌کشد.",
    input: "logit توکن‌ها",
    operation: "temperature → top-k → sample",
    output: "توکن منتخب",
    boundary: "این زنجیره در decoder محلی اجرا و احتمال توکن منتخب ثبت می‌شود؛ nucleus sampling پیاده نشده است.",
    tradeoff: "کنترل تنوع آسان است، اما تصادفی‌بودن می‌تواند کیفیت و بازتولیدپذیری را تغییر دهد.",
    sources: [{ label: "Nucleus Sampling 2020", url: "https://arxiv.org/abs/1904.09751" }],
  },
  {
    id: "beam-contrastive",
    category: "inference",
    status: "model",
    code: "SEARCH",
    title: "Beam Search / Contrastive Search",
    short: "به‌جای یک ادامه، چند پیشوند را نگه می‌دارد یا احتمال را با جریمهٔ تکرار بازنمایی ترکیب می‌کند.",
    input: "چند ادامهٔ ممکن",
    operation: "گسترش → امتیاز → pruning",
    output: "بهترین دنبالهٔ کامل",
    boundary: "decoder پروژه beam یا contrastive search ندارد؛ کارت فقط درخت کاندیدا و pruning را مدل می‌کند.",
    tradeoff: "جست‌وجوی بیشتری از greedy دارد، ولی هزینه و معیار امتیاز می‌توانند خروجی را به متن‌های محافظه‌کار سوق دهند.",
    sources: [{ label: "Contrastive Search 2022", url: "https://arxiv.org/abs/2210.14140" }],
  },
  {
    id: "self-consistency",
    category: "inference",
    status: "live",
    code: "EFFORT / LOCAL",
    title: "Self-Consistency میکرو",
    short: "چند مسیر تولید می‌شود و پاسخ نهایی با رأی یا امتیاز verifier از میان آن‌ها انتخاب می‌شود.",
    input: "یک مسئله + چند seed/path",
    operation: "sample paths → aggregate",
    output: "پاسخ منتخب",
    boundary: "effort متوسط و زیاد واقعاً چند کاندیدا می‌سازند، اما verifier هم در رتبه‌بندی دخیل است؛ این self-consistency خالص و اثر علّیِ صرفاً compute نیست.",
    tradeoff: "گاهی خطای یک مسیر را جبران می‌کند؛ محاسبه را چندبرابر می‌کند و بهبود تضمین‌شده نیست.",
    sources: [{ label: "Self-Consistency 2022", url: "https://arxiv.org/abs/2203.11171" }],
  },
  {
    id: "speculative-decoding",
    category: "inference",
    status: "model",
    code: "DRAFT / VERIFY",
    title: "Speculative Decoding",
    short: "مدل کوچک چند توکن draft می‌سازد و مدل هدف آن‌ها را دسته‌ای می‌پذیرد یا رد می‌کند.",
    input: "مدل draft + مدل target",
    operation: "پیشنهاد موازی → پذیرش دقیق",
    output: "توکن‌های تأییدشده",
    boundary: "پروژه زوج draft/target و الگوریتم پذیرش ندارد؛ دیاگرام، سرعت‌دادن را از reasoning بیشتر جدا می‌کند.",
    tradeoff: "می‌تواند latency را بدون تغییر توزیع هدف کم کند؛ سود آن به هم‌خوانی draft و target وابسته است.",
    sources: [{ label: "Leviathan et al. 2023", url: "https://proceedings.mlr.press/v202/leviathan23a.html" }],
  },
  {
    id: "kv-cache-gqa",
    category: "inference",
    status: "model",
    code: "CACHE / GQA",
    title: "KV Cache، MQA و GQA",
    short: "key/value توکن‌های قبلی را نگه می‌دارد؛ MQA/GQA تعداد headهای KV را برای حافظه و سرعت کمتر می‌کنند.",
    input: "K/V گذشته + query تازه",
    operation: "reuse cache + grouped heads",
    output: "attention گام تازه",
    boundary: "decoder آموزشی در هر گام forward کامل می‌زند و KV cache اختصاصی ندارد؛ این کارت مسیر حافظه را مدل می‌کند.",
    tradeoff: "تولید autoregressive را سریع‌تر می‌کند، اما cache با batch و طول context رشد می‌کند.",
    sources: [{ label: "GQA 2023", url: "https://arxiv.org/abs/2305.13245" }],
  },
  {
    id: "flash-attention",
    category: "inference",
    status: "read",
    code: "IO-AWARE",
    title: "FlashAttention",
    short: "attention دقیق را با tile‌بندی بازچینی می‌کند تا رفت‌وبرگشت میان حافظهٔ GPU و SRAM کمتر شود.",
    input: "Q، K و V",
    operation: "tiled exact attention",
    output: "همان attention با IO کمتر",
    boundary: "پروژه CPU micro است و kernel FlashAttention را فراخوانی نمی‌کند؛ این روش ظرفیت reasoning جدید اضافه نمی‌کند.",
    tradeoff: "سرعت و حافظهٔ attention را بهبود می‌دهد؛ نیازمند kernel و سخت‌افزار سازگار است.",
    sources: [{ label: "FlashAttention 2022", url: "https://arxiv.org/abs/2205.14135" }],
  },
  {
    id: "grammar-verifier",
    category: "inference",
    status: "live",
    code: "CONSTRAINT / LOCAL",
    title: "Grammar-Constrained Decoding + Verifier",
    short: "قواعد، توکن‌های غیرمجاز را می‌بندند و verifier خروجی کامل را جدا از احتمال مدل بررسی می‌کند.",
    input: "logit + state دستور زبان",
    operation: "mask → decode → verify",
    output: "خروجی معتبر یا ردشده",
    boundary: "قاب grammar و verifier در مسیر scratch واقعاً اجرا می‌شوند؛ معتبر بودن قالب برابر با درست بودن پاسخ نیست.",
    tradeoff: "خرابی ساختاری را کم می‌کند، اما دانش یا استدلال درست را به مدل تزریق نمی‌کند.",
    sources: [{ label: "PICARD 2021", url: "https://aclanthology.org/2021.emnlp-main.779/" }],
  },
  {
    id: "tot-planning",
    category: "inference",
    status: "model",
    code: "SEARCH / PLAN",
    title: "Tree of Thoughts / جست‌وجوی برنامه",
    short: "واحدهای میانی را شاخه‌دار می‌کند، آن‌ها را ارزیابی می‌کند و امکان lookahead یا backtrack می‌دهد.",
    input: "مسئله + state جست‌وجو",
    operation: "expand → score → backtrack",
    output: "مسیر حل منتخب",
    boundary: "effort پروژه فقط چند sample مستقل دارد؛ tree search، backtracking و evaluator آموخته‌شده پیاده نشده‌اند.",
    tradeoff: "برای مسئله‌های برنامه‌ریزی فضای جست‌وجو می‌سازد، اما call و هزینه به‌سرعت رشد می‌کنند.",
    sources: [{ label: "Tree of Thoughts 2023", url: "https://arxiv.org/abs/2305.10601" }],
  },
  {
    id: "lexical-rag",
    category: "knowledge",
    status: "live",
    code: "FTS5 / LOCAL",
    title: "RAG واژگانی",
    short: "پرس‌وجو را با index متنی تطبیق می‌دهد و سندهای رتبه‌دار را پیش از تولید وارد context می‌کند.",
    input: "query + corpus نسخه‌دار",
    operation: "FTS5 retrieve → prompt",
    output: "context بیرونی + پاسخ مدل",
    boundary: "SQLite/FTS5، rank، score و hash سند واقعی‌اند، اما fixture بسته ابتدا facts همان درخواست را به سند تبدیل می‌کند؛ این کشف دانش ناشناخته از corpus مستقل نیست.",
    tradeoff: "به‌روزرسانی دانش بدون تغییر وزن ممکن است؛ تطبیق واژه‌ای در برابر paraphrase محدودتر است.",
    sources: [{ label: "RAG 2020", url: "https://proceedings.neurips.cc/paper_files/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html" }],
  },
  {
    id: "dense-retrieval",
    category: "knowledge",
    status: "model",
    code: "EMBED / ANN",
    title: "Dense Vector Retrieval",
    short: "query و سند را به بردار می‌برد و همسایه‌های نزدیک معنایی را با جست‌وجوی تقریبی پیدا می‌کند.",
    input: "query + embedding index",
    operation: "dual encoder → similarity",
    output: "top-k passage",
    boundary: "پروژه embedding model یا vector DB ندارد؛ فاصلهٔ برداری فقط در نقشه تشریح می‌شود.",
    tradeoff: "paraphrase را بهتر از تطبیق صرف واژه می‌گیرد، اما index، مدل embedding و ارزیابی recall لازم دارد.",
    sources: [{ label: "DPR 2020", url: "https://aclanthology.org/2020.emnlp-main.550/" }],
  },
  {
    id: "reranking-hybrid",
    category: "knowledge",
    status: "model",
    code: "RETRIEVE / RERANK",
    title: "Hybrid Retrieval + Reranker",
    short: "بازیابی sparse و dense کاندیدا می‌آورند و cross-encoder تعداد کمتری را دقیق‌تر دوباره رتبه‌بندی می‌کند.",
    input: "دو فهرست کاندیدا",
    operation: "fusion → cross-encoder rerank",
    output: "شواهد مرتب‌شده",
    boundary: "RAG فعلی یک مرحلهٔ FTS5 است؛ fusion، embedding و reranker در backend وجود ندارند.",
    tradeoff: "recall و precision را ترکیب می‌کند، ولی latency و پیچیدگی سنجش provenance بیشتر می‌شود.",
    sources: [{ label: "BERT Re-ranking 2019", url: "https://arxiv.org/abs/1901.04085" }],
  },
  {
    id: "retrieval-memory",
    category: "knowledge",
    status: "read",
    code: "RETRO / MEMORY",
    title: "Retrieval-Enhanced LM و حافظهٔ بلند",
    short: "مدل هنگام تولید، قطعه‌های مشابه از حافظهٔ بیرونی یا stateهای پیشین را دوباره مصرف می‌کند.",
    input: "پیشوند + حافظهٔ بزرگ",
    operation: "retrieve → cross-attend / recurrence",
    output: "پیش‌بینی شرطی بر حافظه",
    boundary: "SQLite این پروژه فقط facts کوچک را می‌دهد؛ RETRO، حافظهٔ اپیزودیک و Transformer-XL پیاده نشده‌اند.",
    tradeoff: "دانش قابل‌تعویض و context فراتر از پنجره می‌دهد، اما تازگی، آلودگی و منبع هر خاطره باید کنترل شود.",
    sources: [
      { label: "RETRO 2021", url: "https://arxiv.org/abs/2112.04426" },
      { label: "Transformer-XL 2019", url: "https://aclanthology.org/P19-1285/" },
    ],
  },
  {
    id: "scripted-tools",
    category: "system",
    status: "live",
    code: "HOST / LOCAL",
    title: "Tool Use اسکریپتی",
    short: "controller میزبان AST را می‌خواند، ابزار allowlist را با آرگومان تایپ‌شده اجرا می‌کند و نتیجه را ثبت می‌کند.",
    input: "عبارت تجزیه‌شده",
    operation: "LOOKUP / CALC در میزبان",
    output: "نتیجهٔ خارجی ممیزی‌پذیر",
    boundary: "این مسیر دقیقاً اجرا می‌شود، اما مدل زمان یا ابزار را انتخاب نمی‌کند؛ policy غیرآموخته است.",
    tradeoff: "قابل‌اعتماد و محدود است، ولی انعطاف عامل آموخته‌شده را ندارد و توان خود مدل محسوب نمی‌شود.",
    sources: [{ label: "Toolformer 2023", url: "https://proceedings.neurips.cc/paper/2023/hash/d842425e4bf79ba039352da0f658a906-Abstract-Conference.html" }],
  },
  {
    id: "react-agents",
    category: "system",
    status: "model",
    code: "AGENT LOOP",
    title: "ReAct و Tool Use آموخته‌شده",
    short: "مدل بین تولید rationale، انتخاب action، دیدن observation و ادامهٔ کار حلقه می‌زند.",
    input: "هدف + ابزار + مشاهده",
    operation: "reason → act → observe",
    output: "پاسخ یا action بعدی",
    boundary: "آزمایشگاه trace ابزار دارد اما انتخاب action توسط مدل، sandbox و loop policy آموخته‌شده ندارد.",
    tradeoff: "دانش زبانی را به عمل متصل می‌کند؛ خطا، تزریق prompt، مجوز و side effect باید بیرون مدل مهار شوند.",
    sources: [{ label: "ReAct 2023", url: "https://openreview.net/forum?id=WE_vluYUL-X" }],
  },
  {
    id: "multimodal",
    category: "system",
    status: "read",
    code: "VISION / AUDIO",
    title: "مدل چندوجهی",
    short: "encoderهای تصویر، صوت یا حسگر، داده را به نمایش‌هایی هم‌تراز با متن می‌برند تا مدل روی چند modality شرطی شود.",
    input: "متن + تصویر/صوت",
    operation: "encode → align/fuse → decode",
    output: "نمایش یا پاسخ چندوجهی",
    boundary: "واژگان و API پروژه فقط متن DSL و ارقام‌اند؛ encoder تصویری/صوتی و دادهٔ چندوجهی وجود ندارد.",
    tradeoff: "دامنهٔ ورودی را گسترش می‌دهد، اما هم‌ترازی داده، هزینه، حریم خصوصی و ارزیابی hallucination دشوارتر می‌شود.",
    sources: [{ label: "CLIP 2021", url: "https://proceedings.mlr.press/v139/radford21a.html" }],
  },
  {
    id: "agent-memory",
    category: "system",
    status: "read",
    code: "PLAN / MEMORY",
    title: "عامل چندگامه و حافظهٔ پایدار",
    short: "ارکستریتور هدف را به کارها می‌شکند، state را نگه می‌دارد، ابزار یا مدل را فراخوانی می‌کند و نتیجه را بازبینی می‌کند.",
    input: "هدف + state + سیاست مجوز",
    operation: "plan → execute → observe → revise",
    output: "state تازه یا پایان کنترل‌شده",
    boundary: "این آزمایشگاه یک درخواست مستقل را حل می‌کند؛ برنامه‌ریز چندگامه و حافظهٔ کاربر ندارد.",
    tradeoff: "کار طولانی و محیطی را ممکن می‌کند، ولی خطای انباشته، سطح دسترسی و provenance به کنترل صریح نیاز دارند.",
    sources: [
      { label: "ReAct 2023", url: "https://openreview.net/forum?id=WE_vluYUL-X" },
      { label: "Tree of Thoughts 2023", url: "https://arxiv.org/abs/2305.10601" },
    ],
  },
];

const SECTION_INFO = {};

const PARAMETER_KINDS = {
  live: { label: "محاسبه‌شده", hint: "در همین موتور ده‌رقمی اجرا و trace می‌شود." },
  orchestrator: { label: "کنترل میزبان", hint: "بیرون وزن‌های مدل، در درخواست یا ارکستریتور اعمال می‌شود." },
  vendor: { label: "وابسته به API", hint: "نام، بازه یا پشتیبانی آن به مدل و سرویس وابسته است." },
  observe: { label: "مشاهده‌گر", hint: "اطلاعات می‌دهد اما خودش توزیع یا رفتار را تغییر نمی‌دهد." },
};

const PARAMETER_FAMILIES = {
  prompt: "ساخت Prompt",
  decoding: "Decoding",
  length: "طول و پایان",
  reasoning: "بودجه و انتخاب",
  external: "RAG و ابزار",
  observe: "مشاهده‌پذیری",
};

const PARAMETERS = [
  {
    id: "prompt-layers", family: "prompt", kind: "orchestrator", title: "System / Developer / User",
    short: "لایه‌های پیام، هدف و محدودیت را پیش از تولید می‌سازند؛ این‌ها ضریب احتمال مثل temperature نیستند.",
    mechanism: "پیام‌ها → قالب گفتگو → توکن‌های context", boundary: "تقدم دقیق و نام roleها محصول‌محور است؛ متن قوی هم تضمین اجرای بی‌خطا نیست.",
    sources: [{ label: "OpenAI prompting guide", url: "https://developers.openai.com/api/docs/guides/prompt-engineering" }],
  },
  {
    id: "instruction-layout", family: "prompt", kind: "orchestrator", title: "چیدمان دستور و delimiter",
    short: "مرز روشن میان دستور، داده و مثال احتمال تفسیر اشتباه را کم می‌کند؛ پارامتر عددی نیست.",
    mechanism: "ساختار متن → context متفاوت → logits متفاوت", boundary: "اثر به مدل و داده وابسته است و delimiter سپر امنیتی قطعی نیست.",
    sources: [{ label: "OpenAI prompting guide", url: "https://developers.openai.com/api/docs/guides/prompt-engineering" }],
  },
  {
    id: "few-shot", family: "prompt", kind: "orchestrator", title: "Zero-shot / Few-shot examples",
    short: "نمونه‌ها الگوی ورودی‌ـ‌خروجی را داخل context نشان می‌دهند، بدون تغییر وزن‌ها.",
    mechanism: "مثال‌ها → in-context conditioning → logits", boundary: "یادگیری درون‌متنی fine-tune نیست و مثال بد می‌تواند خطا را تثبیت کند.",
    sources: [{ label: "GPT-3 / in-context learning", url: "https://arxiv.org/abs/2005.14165" }],
  },
  {
    id: "context-budget", family: "prompt", kind: "vendor", title: "Context window و truncation",
    short: "سقف توکن‌های قابل‌دیدن تعیین می‌کند کدام دستور، مثال یا سند اصلاً به مدل برسد.",
    mechanism: "tokenize → trim/cache → model input", boundary: "پنجرهٔ بزرگ‌تر به معنی استفادهٔ مؤثر از تمام متن یا factuality بیشتر نیست.",
    sources: [{ label: "Transformer", url: "https://arxiv.org/abs/1706.03762" }],
  },
  {
    id: "structured-output", family: "prompt", kind: "orchestrator", title: "Schema / Grammar constrained output",
    short: "در هر گام، توکن‌های ناسازگار با دستور زبان یا schema از فضای مجاز حذف می‌شوند.",
    mechanism: "parser state → allowed-token mask → decoding", boundary: "اعتبار نحوی، درستی معنایی یا حقیقت داده را تضمین نمی‌کند.",
    sources: [{ label: "Grammar-Constrained Decoding", url: "https://aclanthology.org/2023.emnlp-main.674/" }],
  },
  {
    id: "temperature", family: "decoding", kind: "live", title: "Temperature",
    short: "لاجیت‌ها بر T تقسیم می‌شوند؛ T کم فاصله‌ها را تیز و T زیاد توزیع را تخت می‌کند.",
    mechanism: "z/T → softmax", boundary: "T=0 در این صفحه شاخهٔ greedy است؛ این تعریف قراردادی است، نه تقسیم ریاضی بر صفر.",
    sources: [{ label: "HF GenerationConfig", url: "https://huggingface.co/docs/transformers/main/en/main_classes/text_generation" }],
  },
  {
    id: "top-k", family: "decoding", kind: "live", title: "Top-k توکن",
    short: "در هر گام فقط k توکن با احتمال بیشتر می‌مانند؛ k یک تعداد ثابت است.",
    mechanism: "rank tokens → keep k → renormalize", boundary: "با top-k بازیابی سند یکی نیست و کیفیت یا حقیقت را تضمین نمی‌کند.",
    sources: [{ label: "HF GenerationConfig", url: "https://huggingface.co/docs/transformers/main/en/main_classes/text_generation" }],
  },
  {
    id: "top-p", family: "decoding", kind: "live", title: "Top-p / Nucleus",
    short: "کوچک‌ترین مجموعهٔ پویایی را نگه می‌دارد که جرم تجمعی‌اش دست‌کم p باشد.",
    mechanism: "sort by p → cumulative sum → minimal prefix", boundary: "اندازهٔ nucleus در هر گام فرق می‌کند؛ factuality را تضمین نمی‌کند.",
    sources: [{ label: "Nucleus Sampling", url: "https://openreview.net/pdf?id=rygGQyrFvH" }],
  },
  {
    id: "min-p", family: "decoding", kind: "live", title: "Min-p",
    short: "کف احتمال را نسبتی از احتمال بهترین توکن می‌گیرد، پس با شکل توزیع سازگار می‌شود.",
    mechanism: "keep pᵢ ≥ min_p × max(p)", boundary: "الگوریتم روشن است، اما برتری عمومی کیفیت آن محل بحث تجربی است.",
    sources: [{ label: "Min-p", url: "https://arxiv.org/abs/2407.01082" }, { label: "Critical analysis", url: "https://arxiv.org/abs/2506.13681" }],
  },
  {
    id: "typical-p", family: "decoding", kind: "live", title: "Locally Typical sampling",
    short: "توکن‌هایی را ترجیح می‌دهد که surprise آن‌ها به آنتروپی شرطی همان گام نزدیک‌تر است.",
    mechanism: "|−log pᵢ − H| → rank → cumulative mass", boundary: "نتیجهٔ بهتر به تکلیف و مدل وابسته است؛ قانون حقیقت نیست.",
    sources: [{ label: "TACL 2023", url: "https://aclanthology.org/2023.tacl-1.7/" }],
  },
  {
    id: "epsilon-eta", family: "decoding", kind: "live", title: "Epsilon / Eta cutoff",
    short: "epsilon کف مطلق و eta کف سازگار با آنتروپی برای حذف دُم کم‌احتمال می‌گذارند.",
    mechanism: "absolute/adaptive probability threshold", boundary: "در این صفحه بهترین توکن همیشه نگه داشته می‌شود؛ ترتیب فیلترها قرارداد محلی است.",
    sources: [{ label: "Truncation Sampling", url: "https://aclanthology.org/2022.findings-emnlp.249/" }],
  },
  {
    id: "presence-penalty", family: "decoding", kind: "live", title: "Presence penalty",
    short: "اگر توکن حداقل یک‌بار در تاریخچه باشد، یک جریمهٔ ثابت از logit آن کم می‌کند.",
    mechanism: "zᵢ − α·𝟙[countᵢ>0]", boundary: "مقادیر منفی تکرار را تشویق می‌کنند؛ دامنه و تاریخچهٔ شمارش vendor-specific است.",
    sources: [{ label: "OpenAI Chat API", url: "https://developers.openai.com/api/reference/java/resources/chat/subresources/completions/methods/create" }],
  },
  {
    id: "frequency-penalty", family: "decoding", kind: "live", title: "Frequency penalty",
    short: "جریمه با تعداد تکرار توکن رشد می‌کند؛ با presence که فقط دیده‌شدن را می‌سنجد متفاوت است.",
    mechanism: "zᵢ − β·countᵢ", boundary: "تکرار معنایی را مستقیم نمی‌فهمد و ممکن است واژهٔ لازم را نیز کم‌رنگ کند.",
    sources: [{ label: "OpenAI Chat API", url: "https://developers.openai.com/api/reference/java/resources/chat/subresources/completions/methods/create" }],
  },
  {
    id: "repetition-penalty", family: "decoding", kind: "live", title: "Repetition penalty",
    short: "قرارداد رایج HF برای logit مثبت تقسیم و برای logit منفی ضرب می‌کند.",
    mechanism: "seen: z<0 ? z·r : z/r", boundary: "با presence/frequency هم‌معنی نیست؛ کتابخانه‌ها scope و فرمول متفاوت دارند.",
    sources: [{ label: "HF logits processors", url: "https://huggingface.co/docs/transformers/main/en/internal/generation_utils" }],
  },
  {
    id: "logit-bias", family: "decoding", kind: "live", title: "Logit bias",
    short: "عدد bias مستقیماً پیش از sampling به امتیاز token ID انتخاب‌شده افزوده می‌شود.",
    mechanism: "zᵢ ← zᵢ + biasᵢ", boundary: "واژهٔ انسانی ممکن است چند توکن باشد؛ bias بزرگ تقریباً force/ban است، نه قانون مستقل.",
    sources: [{ label: "OpenAI Chat API", url: "https://developers.openai.com/api/reference/java/resources/chat/subresources/completions/methods/create" }],
  },
  {
    id: "seed", family: "decoding", kind: "live", title: "Seed و determinism",
    short: "seed جریان عدد شبه‌تصادفی را تکرارپذیر می‌کند؛ خود احتمال‌ها را تغییر نمی‌دهد.",
    mechanism: "seed → PRNG → u → categorical draw", boundary: "APIهای واقعی معمولاً best-effort‌اند؛ نسخه، سخت‌افزار و backend می‌توانند خروجی را عوض کنند.",
    sources: [{ label: "PyTorch reproducibility", url: "https://docs.pytorch.org/docs/stable/notes/randomness.html" }],
  },
  {
    id: "max-output", family: "length", kind: "vendor", title: "Max output / completion tokens",
    short: "سقف بودجهٔ خروجی است؛ دستور «مختصر بنویس» یا تضمین کامل‌شدن پاسخ نیست.",
    mechanism: "generation loop → token budget ceiling", boundary: "نام و اینکه reasoning tokens شمرده شوند endpoint/model-specific است.",
    sources: [{ label: "OpenAI Responses API", url: "https://developers.openai.com/api/reference/cli/resources/responses/methods/create" }],
  },
  {
    id: "stop", family: "length", kind: "vendor", title: "Stop sequences / finish reason",
    short: "پس از مشاهدهٔ یک دنبالهٔ تعیین‌شده، حلقهٔ تولید متوقف می‌شود.",
    mechanism: "append token → suffix match → stop", boundary: "می‌تواند جمله را نیمه‌کاره قطع کند و پشتیبانی آن به مدل/API وابسته است.",
    sources: [{ label: "HF GenerationConfig", url: "https://huggingface.co/docs/transformers/main/en/main_classes/text_generation" }],
  },
  {
    id: "candidate-budget", family: "reasoning", kind: "orchestrator", title: "n / best-of / self-consistency",
    short: "چند مسیر مستقل تولید و سپس با رأی یا verifier یکی انتخاب می‌شود؛ با top-k توکن فرق دارد.",
    mechanism: "N generations → score/vote → select", boundary: "هزینه تقریباً رشد می‌کند و مسیر بیشتر تضمین پاسخ بهتر نیست.",
    sources: [{ label: "Self-Consistency", url: "https://arxiv.org/abs/2203.11171" }],
  },
  {
    id: "reasoning-effort", family: "reasoning", kind: "vendor", title: "Reasoning effort",
    short: "بودجه یا سیاست محاسبهٔ درونی مدل reasoning را کنترل می‌کند؛ دما و تعداد کاندیدا نیست.",
    mechanism: "request policy → model-dependent compute budget", boundary: "سطوح و اثر به مدل وابسته‌اند؛ effort بیشتر صحت را تضمین یا فکر پنهان را نمایش نمی‌دهد.",
    sources: [{ label: "OpenAI latest model guide", url: "https://developers.openai.com/api/docs/guides/latest-model" }],
  },
  {
    id: "verbosity", family: "length", kind: "vendor", title: "Verbosity / response style",
    short: "گرایش پاسخ به اختصار یا تفصیل را هدایت می‌کند و از سقف توکن جداست.",
    mechanism: "request preference → response policy", boundary: "پشتیبانی و semantics مدل‌محور است و سقف سخت طول ایجاد نمی‌کند.",
    sources: [{ label: "OpenAI latest model guide", url: "https://developers.openai.com/api/docs/guides/latest-model" }],
  },
  {
    id: "tool-controls", family: "external", kind: "orchestrator", title: "Tool choice / parallel calls / max calls",
    short: "میزبان تعیین می‌کند مدل اجازه یا اجبار استفاده از کدام ابزارها و چند فراخوانی را داشته باشد.",
    mechanism: "model proposal → policy gate → host execution", boundary: "ابزار بیرون وزن‌ها اجرا می‌شود؛ مجوز، timeout و validation مسئولیت میزبان است.",
    sources: [{ label: "OpenAI function calling", url: "https://developers.openai.com/api/docs/guides/function-calling" }],
  },
  {
    id: "retrieval-controls", family: "external", kind: "orchestrator", title: "Retrieval top-k / chunk / overlap",
    short: "تعداد اسناد، اندازهٔ قطعه و هم‌پوشانی تعیین می‌کنند چه شواهدی پیش از generation وارد context شود.",
    mechanism: "query → rank corpus → k chunks → prompt", boundary: "retrieval top-k واحدش سند است؛ sampling top-k واحدش توکن. بازیابی خوب هم synthesis درست را تضمین نمی‌کند.",
    sources: [{ label: "DPR", url: "https://aclanthology.org/2020.emnlp-main.550/" }],
  },
  {
    id: "logprobs", family: "observe", kind: "observe", title: "Logprobs / top_logprobs",
    short: "احتمال لگاریتمی خروجی و چند گزینهٔ برتر را برای مشاهده برمی‌گرداند؛ knob تولید نیست.",
    mechanism: "distribution snapshot → telemetry", boundary: "احتمال توکن نمرهٔ حقیقت یا confidence کالیبره‌شده نیست و ممکن است کل واژگان برنگردد.",
    sources: [{ label: "OpenAI Responses API", url: "https://developers.openai.com/api/reference/cli/resources/responses/methods/create" }],
  },
];

const CONTROL_INFO = {
  "source-digit": { title: "رقم ورودی کنترل‌شده", ref: "temperature", short: "این کنترل پارامتر رایج API نیست؛ فقط توزیع مصنوعی آزمایشگاه را می‌چرخاند تا جانشین رقم ورودی قله شود." },
  history: { title: "تاریخچهٔ شمارش", ref: "presence-penalty", short: "در این قرارداد فقط ارقام این رشته برای presence، frequency و repetition شمرده می‌شوند؛ scope در سامانه‌های دیگر ممکن است فرق کند." },
  "presence-penalty": { ref: "presence-penalty" },
  "frequency-penalty": { ref: "frequency-penalty" },
  "repetition-penalty": { ref: "repetition-penalty" },
  "logit-bias": { ref: "logit-bias" },
  temperature: { ref: "temperature" },
  "top-k": { ref: "top-k" },
  "top-p": { ref: "top-p" },
  "min-p": { ref: "min-p" },
  "typical-p": { ref: "typical-p" },
  "epsilon-cutoff": { title: "Epsilon cutoff", ref: "epsilon-eta", short: "احتمال‌های پایین‌تر از یک کف مطلق حذف می‌شوند؛ بهترین توکن برای جلوگیری از مجموعهٔ خالی باقی می‌ماند." },
  "eta-cutoff": { title: "Eta cutoff", ref: "epsilon-eta", short: "آستانه از آنتروپی همان مرحله کمک می‌گیرد؛ پس نسبت به تخت یا تیزبودن توزیع واکنش نشان می‌دهد." },
  seed: { ref: "seed" },
  "sample-count": { title: "تعداد draw", ref: "seed", short: "فقط از توزیع نهایی چند بار قرعه می‌کشد تا قانون اعداد بزرگ دیده شود؛ تعداد اجرای مدل یا candidate reasoning نیست." },
};

Object.assign(SECTION_INFO, {
  "architecture-heading": {
    short: "این بخش فقط پنج solver واقعاً موجود را کنار هم می‌گذارد و دفتر آموزش، split و checkpoint آن‌ها را نشان می‌دهد.",
    doc: "architecture",
    source: { label: "مقالهٔ Transformer", url: "https://arxiv.org/abs/1706.03762" },
  },
  "controls-heading": {
    short: "اینجا داده، عبارت، منبع کمک و یکی از سه policy استنتاج را عوض می‌کنید؛ candidate count، temperature و top-k با هم تغییر می‌کنند، پس effort اثر خالص compute نیست.",
    doc: "experiment",
    source: { label: "مقالهٔ test-time compute", url: "https://arxiv.org/abs/2408.03314" },
  },
  "stage-heading": {
    short: "این مقطع شمارنده‌ها و خروجی قابل‌مشاهدهٔ یک اجرای واقعی را نشان می‌دهد؛ scratchpad گزارش ذهن پنهان نیست.",
    doc: "inference",
    source: { label: "مقالهٔ Scratchpad", url: "https://arxiv.org/abs/2112.00114" },
  },
  "journey-heading": {
    short: "هفت برش، مسیر داده و تصمیم میزبان را از هم جدا می‌کنند تا چیزی که مدل انجام نداده به آن نسبت داده نشود.",
    doc: "trace",
    source: { label: "مقالهٔ ReAct", url: "https://openreview.net/forum?id=WE_vluYUL-X" },
  },
  "microscope-heading": {
    short: "احتمال، attention، routing و retrieval تله‌متری‌اند؛ برای عیب‌یابی مفیدند اما توضیح علّی قطعی نیستند.",
    doc: "telemetry",
    source: { label: "مقالهٔ Attention", url: "https://arxiv.org/abs/1706.03762" },
  },
  "comparison-heading": {
    short: "مدل‌ها فقط روی split، seed و معیار یکسان قابل‌مقایسه‌اند؛ نتیجهٔ یک run ادعای عمومی دربارهٔ LLMها نیست.",
    doc: "evaluation",
    source: { label: "مقالهٔ test-time compute", url: "https://arxiv.org/abs/2408.03314" },
  },
  "method-map-heading": {
    short: "این اطلس خانواده‌های مهم جاافتاده را پوشش می‌دهد، نه تمام تاریخ هوش مصنوعی؛ برچسب وضعیت می‌گوید هر مورد تا کجا واقعی است.",
    doc: "status",
    source: { label: "منابع روش‌ها", url: "/static/docs/methods.html#sources" },
  },
  "sampling-heading": {
    short: "این بخش یک موتور الگوریتمی مستقل است: logits مصنوعی ثابت‌اند و اثر هر پردازشگر یا فیلتر با توزیع کامل ده رقم ثبت می‌شود.",
    doc: "contract",
    docPath: "/static/docs/parameters.html",
    source: { label: "HF GenerationConfig", url: "https://huggingface.co/docs/transformers/main/en/main_classes/text_generation" },
  },
});

const state = {
  model: "ngram",
  mode: "model_only",
  effort: "low",
  method: "ngram",
  status: null,
  run: null,
  stage: "problem",
  stale: false,
  timers: [],
  samplingRun: null,
  samplingStage: "source",
  samplingAbort: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const faNumber = (value, digits = 0) =>
  Number(value || 0).toLocaleString("fa-IR", { maximumFractionDigits: digits });

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function scientificLinks(sources, compact = false) {
  return sources
    .map((source, index) => {
      const external = source.url.startsWith("http");
      const label = compact ? "منبع " + faNumber(index + 1) : source.label;
      return (
        '<a href="' +
        escapeHtml(source.url) +
        '"' +
        (external ? ' target="_blank" rel="noopener noreferrer"' : "") +
        ">" +
        escapeHtml(label) +
        (external ? '<span aria-hidden="true"> ↗</span><span class="sr-only">؛ بازشدن در زبانهٔ تازه</span>' : "") +
        "</a>"
      );
    })
    .join("");
}

function infoControl(id, label, short, docAnchor, sources, docPath = "/static/docs/methods.html") {
  return (
    '<div class="info-wrap">' +
    '<button type="button" class="info-trigger" popovertarget="' +
    escapeHtml(id) +
    '" aria-label="توضیح کوتاه دربارهٔ ' +
    escapeHtml(label) +
    '"><span aria-hidden="true">i</span></button>' +
    '<aside id="' +
    escapeHtml(id) +
    '" class="info-popover" popover="auto">' +
    '<p class="info-popover__code">FIELD NOTE / ' +
    escapeHtml(label) +
    "</p><p>" +
    escapeHtml(short) +
    '</p><nav aria-label="پیوندهای توضیح">' +
    '<a href="' +
    escapeHtml(docPath) +
    '#' +
    escapeHtml(docAnchor) +
    '">شرح مفصل در doc</a>' +
    scientificLinks(sources, true) +
    "</nav>" +
    '<button type="button" class="info-close" popovertarget="' +
    escapeHtml(id) +
    '" popovertargetaction="hide">بستن</button>' +
    "</aside></div>"
  );
}

function installSectionInfo() {
  Object.entries(SECTION_INFO).forEach(([headingId, info]) => {
    const heading = document.getElementById(headingId);
    if (!heading || heading.parentElement.querySelector(".info-wrap")) return;
    heading.insertAdjacentHTML(
      "afterend",
      infoControl(
        "info-section-" + headingId,
        heading.textContent,
        info.short,
        info.doc,
        [info.source],
        info.docPath,
      ),
    );
  });
}

function methodById(id) {
  return METHODS.find((method) => method.id === id) || METHODS[0];
}

function renderMethodDetail(id, focus = false) {
  const method = methodById(id);
  state.method = method.id;
  $$("[data-method-id]").forEach((button) => {
    const active = button.dataset.methodId === method.id;
    button.setAttribute("aria-current", active ? "true" : "false");
    button.closest(".method-card")?.classList.toggle("active", active);
  });
  const status = METHOD_STATUS[method.status];
  const statusNode = $("#method-detail-status");
  statusNode.textContent = status.label;
  statusNode.dataset.status = method.status;
  $("#method-detail-code").textContent = METHOD_CATEGORIES[method.category] + " / " + method.code;
  $("#method-detail-title").textContent = method.title;
  $("#method-detail-summary").textContent = method.short;
  $("#method-detail-input").textContent = method.input;
  $("#method-detail-operation").textContent = method.operation;
  $("#method-detail-output").textContent = method.output;
  $("#method-detail-boundary").textContent = status.hint + " " + method.boundary;
  $("#method-detail-tradeoff").textContent = method.tradeoff;
  $("#method-doc-link").href = "/static/docs/methods.html#" + method.id;
  $("#method-source-links").innerHTML = scientificLinks(method.sources);
  if (focus) $("#method-detail").focus({ preventScroll: true });
}

function renderMethods(filter = "all") {
  const visible = METHODS.filter((method) => filter === "all" || method.category === filter);
  $("#method-grid").innerHTML = visible
    .map((method) => {
      const status = METHOD_STATUS[method.status];
      const popoverId = "info-method-" + method.id;
      return (
        '<article class="method-card" data-status="' +
        method.status +
        '"><header><span class="method-card__code">' +
        escapeHtml(method.code) +
        "</span>" +
        infoControl(popoverId, method.title, method.short, method.id, method.sources) +
        '</header><button type="button" class="method-card__select" data-method-id="' +
        escapeHtml(method.id) +
        '" aria-current="false"><span class="method-status" data-status="' +
        method.status +
        '">' +
        status.label +
        "</span><strong>" +
        escapeHtml(method.title) +
        "</strong><small>" +
        escapeHtml(METHOD_CATEGORIES[method.category]) +
        "</small><p>" +
        escapeHtml(method.short) +
        "</p></button></article>"
      );
    })
    .join("");
  $("#method-count").textContent = faNumber(visible.length) + " روش از " + faNumber(METHODS.length);
  if (!visible.some((method) => method.id === state.method)) state.method = visible[0]?.id || "ngram";
  renderMethodDetail(state.method);
}

function modelInfo(name) {
  return MODELS[name] || { label: name || "نامشخص", family: "نامشخص", summary: "توضیح ثبت نشده است." };
}

function modeInfo(name) {
  return MODES[name] || MODES.model_only;
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(payload.detail)
      ? payload.detail.map((item) => item.msg).join("، ")
      : payload.detail || payload.message;
    throw new Error(detail || "HTTP " + response.status);
  }
  return payload;
}

function choose(group, value) {
  $$("button", group).forEach((button) => {
    const selected = button.dataset.value === value;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function factsFromForm(strict = true) {
  return Object.fromEntries(
    $$("[data-fact]").map((input) => {
      const value = Number(input.value);
      const valid = input.value !== "" && Number.isInteger(value) && value >= 0 && value <= 9;
      input.setAttribute("aria-invalid", String(!valid));
      if (!valid && strict) {
        throw new Error("مقدار " + input.dataset.fact + " باید یک عدد صحیح از ۰ تا ۹ باشد.");
      }
      return [input.dataset.fact, value];
    }),
  );
}

function preview() {
  return {
    model: state.model,
    mode: state.mode,
    effort: state.effort,
    expression: $("#expression").value.trim(),
    facts: factsFromForm(false),
    candidates: [],
    token_steps: [],
    trace_steps: [],
    input_tokens: [],
    correct: null,
  };
}

function execution(data) {
  const supplied = data.execution || data.educational?.execution || data.education?.execution;
  if (supplied) return supplied;
  const modelInvoked = ["model_only", "rag"].includes(data.mode);
  return {
    model_invoked: modelInvoked,
    objective: ["dense_scratch", "moe_scratch"].includes(data.model) ? "scratch" : "direct",
    answer_source:
      data.mode === "rag"
        ? "rag_model"
        : data.mode === "tools"
          ? "scripted_tool_controller"
          : data.mode === "oracle"
            ? "oracle"
            : "model",
  };
}

function tokenization(data) {
  return data.tokenization || data.educational?.tokenization || data.education?.tokenization || {};
}

function tokenRecords(data) {
  const block = tokenization(data);
  const supplied = block.prefix_tokens || block.tokens || [];
  if (supplied.length) {
    return supplied.map((item, index) => ({
      position: item.position ?? index,
      id: item.token_id ?? item.id ?? "—",
      text: item.token_text ?? item.text ?? String(item),
      origin: item.origin || "prompt",
    }));
  }
  const ids = data.input_tokens || [];
  const texts = data.input_token_texts || [];
  return ids.map((id, index) => ({
    position: index,
    id,
    text: texts[index] || "ID:" + id,
    origin: "prompt",
  }));
}

function originLabel(origin) {
  return (
    {
      host_protocol: "قاب پروتکل میزبان",
      prompt: "متن مسئله",
      prompt_text: "متن مسئله",
      input: "متن مسئله",
      retrieved: "متن بازیابی‌شده",
      model: "تولید مدل",
    }[origin] || origin
  );
}

function parseExpression(source) {
  let at = 0;
  const skip = () => {
    while (/\s/.test(source[at] || "")) at += 1;
  };
  const parseNode = () => {
    skip();
    const operator = ["ADD", "SUB", "MUL"].find((candidate) => source.startsWith(candidate, at));
    if (operator) {
      at += operator.length;
      skip();
      if (source[at] !== "(") throw new Error("missing opening parenthesis");
      at += 1;
      const left = parseNode();
      skip();
      if (source[at] !== ",") throw new Error("missing comma");
      at += 1;
      const right = parseNode();
      skip();
      if (source[at] !== ")") throw new Error("missing closing parenthesis");
      at += 1;
      return { type: "operation", operator, left, right };
    }
    const name = source[at];
    if (!/[A-H]/.test(name || "")) throw new Error("invalid variable");
    at += 1;
    return { type: "variable", name };
  };
  const tree = parseNode();
  skip();
  if (at !== source.length) throw new Error("trailing input");
  return tree;
}

function usedVariables(tree, found = new Set()) {
  if (!tree) return found;
  if (tree.type === "variable") found.add(tree.name);
  else {
    usedVariables(tree.left, found);
    usedVariables(tree.right, found);
  }
  return found;
}

function treeHtml(nodeValue, facts) {
  if (!nodeValue) return '<p class="empty">عبارت هنوز قابل تجزیه نیست.</p>';
  if (nodeValue.type === "variable") {
    return (
      '<li><span class="tree-node variable">' +
      escapeHtml(nodeValue.name) +
      "<small>مقدار " +
      faNumber(facts[nodeValue.name]) +
      "</small></span></li>"
    );
  }
  return (
    '<li><span class="tree-node">' +
    escapeHtml(nodeValue.operator) +
    "<small>" +
    OPS[nodeValue.operator].fa +
    "</small></span><ul>" +
    treeHtml(nodeValue.left, facts) +
    treeHtml(nodeValue.right, facts) +
    "</ul></li>"
  );
}

function diagramNode(kind, title, detail = "", code = "", active = false) {
  return (
    '<div class="diagram-node' +
    (active ? " active-path" : "") +
    '" data-kind="' +
    escapeHtml(kind) +
    '"><strong>' +
    escapeHtml(title) +
    "</strong>" +
    (code ? "<code>" + escapeHtml(code) + "</code>" : "") +
    (detail ? "<small>" + escapeHtml(detail) + "</small>" : "") +
    "</div>"
  );
}

const arrow = '<span class="diagram-arrow">→</span>';

function tableHtml(headers, rows) {
  if (!rows.length) return '<p class="empty">برای این مرحله ردیفی ثبت نشده است.</p>';
  return (
    '<table class="stage-data-table"><thead><tr>' +
    headers.map((header) => "<th>" + escapeHtml(header) + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows
      .map(
        (row) =>
          '<tr class="' +
          (row.selected ? "selected-row" : "") +
          '">' +
          row.cells.map((cell) => "<td>" + escapeHtml(cell) + "</td>").join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table>"
  );
}

function stageView(value) {
  return {
    source: "data",
    sourceLabel: "دادهٔ ورودی",
    headers: [],
    rows: [],
    ...value,
  };
}

function problemStage(data) {
  const facts = data.facts || factsFromForm();
  const expression = data.expression || $("#expression").value.trim();
  let tree = null;
  try {
    tree = parseExpression(expression);
  } catch (_error) {
    // API validation provides the authoritative source-positioned error.
  }
  const used = usedVariables(tree);
  const orbs = Object.entries(facts)
    .map(
      ([name, value]) =>
        '<div class="fact-orb ' +
        (used.has(name) ? "used" : "distractor") +
        '"><strong>' +
        escapeHtml(name) +
        " = " +
        faNumber(value) +
        "</strong><small>" +
        (used.has(name) ? "مصرف می‌شود" : "مزاحم") +
        "</small></div>",
    )
    .join("");
  return stageView({
    title: "صورت مسئله چگونه به نقشهٔ وابستگی تبدیل می‌شود؟",
    summary: "عبارت فقط " + faNumber(used.size) + " واقعیت از جهان کوچک را مصرف می‌کند.",
    input: faNumber(Object.keys(facts).length) + " واقعیت + عبارت DSL",
    action: "Parser قطعی → درخت نحو انتزاعی",
    output: faNumber(used.size) + " وابستگی واقعی",
    canvas:
      '<div class="fact-universe"><div class="fact-cloud">' +
      orbs +
      '<p class="fact-cloud__label">دایره‌های کم‌رنگ distractor هستند؛ وجود دارند اما عبارت آن‌ها را مصرف نمی‌کند.</p></div><div><ul class="expr-tree">' +
      treeHtml(tree, facts) +
      "</ul></div></div>",
    explanation:
      "A تا H واقعیت‌های جهان‌اند. برگ‌های گرد، متغیرها و گره‌های چهارگوش، ADD یا SUB یا MUL هستند. شاخه‌ها ترتیب واقعی محاسبه را نشان می‌دهند.",
    claim:
      "این درخت نمایش رسمیِ مسئله در برنامهٔ میزبان است؛ اثبات نمی‌کند که شبکهٔ عصبی داخل وزن‌ها دقیقاً همین ساختار را بازسازی کرده باشد.",
    tableTitle: "رابطهٔ واقعیت‌ها با عبارت",
    headers: ["متغیر", "مقدار", "نقش در نمونه", "منشأ"],
    rows: Object.entries(facts).map(([name, value]) => ({
      cells: [
        name,
        value,
        used.has(name) ? "وابستگی واقعی عبارت" : "دادهٔ مزاحم؛ مصرف نمی‌شود",
        "ورودی کاربر",
      ],
    })),
  });
}

function tokenizeStage(data) {
  const block = tokenization(data);
  const tokens = tokenRecords(data);
  const prompt = block.prompt_text || data.prompt_text || data.expression || "—";
  const consumed = block.consumed_by_model ?? execution(data).model_invoked;
  const chips = tokens
    .map(
      (token) =>
        '<span class="token-chip ' +
        (String(token.text).startsWith("<") ? "special" : "") +
        '"><code>' +
        escapeHtml(token.text === " " ? "␠" : token.text) +
        "</code><small>ID " +
        escapeHtml(token.id) +
        "</small></span>",
    )
    .join("");
  return stageView({
    source: consumed ? "host" : "data",
    sourceLabel: consumed ? "Tokenizer میزبان" : "مدل عبور داده نشد",
    title: "متن چگونه به اعدادی تبدیل می‌شود که مدل مصرف می‌کند؟",
    summary: consumed
      ? "تطبیق بلندترین قطعه، هر نماد را به یک ID ثابت نگاشت می‌کند."
      : "در این mode شبکه فراخوانی نمی‌شود؛ توکن‌ها فقط برای تشریح ورودی‌اند.",
    input: prompt,
    action: "Longest-match روی واژگان بسته و بدون UNK",
    output: consumed ? faNumber(tokens.length) + " توکن" : "عدم ارسال به مدل",
    canvas:
      '<div class="token-conveyor"><code class="token-prompt">' +
      escapeHtml(prompt) +
      '</code><div class="token-ribbon">' +
      (chips || '<p class="empty">IDها پس از اجرا از backend دریافت می‌شوند.</p>') +
      "</div></div>",
    explanation:
      "مدل رشتهٔ ADD یا عدد ۳ را مستقیم نمی‌بیند؛ فقط ID می‌گیرد. نگاشت ثابت است و نویسهٔ خارج از زبان به‌جای تبدیل خاموش به UNK، خطا می‌دهد.",
    claim:
      "ID معنای عددی یا درجهٔ اهمیت ندارد؛ تنها نشانی یک سطر در embedding یا جدول شمارش است.",
    tableTitle: "فرهنگ همین prompt",
    headers: ["موقعیت", "توکن", "ID", "منشأ"],
    rows: tokens.map((token) => ({
      cells: [token.position, token.text === " " ? "␠ (فاصله)" : token.text, token.id, originLabel(token.origin)],
    })),
  });
}

function contextStage(data) {
  const mode = data.mode || state.mode;
  const prompt = tokenization(data).prompt_text || data.prompt_text || data.expression || "—";
  if (mode === "rag") {
    const retrieval = data.retrieval || {};
    const hits = retrieval.hits || [];
    const docs = hits
      .map((hit, index) =>
        diagramNode(
          "external",
          "سند " + faNumber(index + 1),
          hit.source_uri || "SQLite FTS5",
          hit.variable + "=" + hit.value,
        ),
      )
      .join("");
    return stageView({
      source: "external",
      sourceLabel: "بازیابی بیرونی",
      title: "RAG چگونه دانش خارج از وزن‌ها را وارد prompt می‌کند؟",
      summary:
        "Query «" + (retrieval.query || "—") + "» به " + faNumber(hits.length) + " سند رسید.",
      input: data.expression,
      action: "Query → FTS5 → تزریق hitها",
      output: prompt,
      canvas:
        '<div class="diagram-stack"><div class="diagram-flow">' +
        diagramNode("data", "عبارت", "", data.expression) +
        arrow +
        diagramNode("host", "Query builder", "", retrieval.query || "—") +
        arrow +
        diagramNode("external", "SQLite FTS5", "بیرون از checkpoint") +
        '</div><div class="diagram-branch">' +
        (docs || '<p class="empty">سندی بازیابی نشد.</p>') +
        '</div><span class="diagram-arrow">↓</span>' +
        diagramNode("data", "Prompt غنی‌شده", "", prompt, true) +
        "</div>",
      explanation:
        "RAG وزن‌ها را تغییر نمی‌دهد. ابتدا سند پیدا می‌شود، سپس واقعیت آن داخل prompt می‌رود و همان checkpoint قبلی روی زمینهٔ تازه اجرا می‌شود.",
      claim:
        "بهبود حاصل ترکیب retrieval و مدل است. score خام FTS5 احتمال درستی سند نیست و فقط برای رتبه‌بندی جست‌وجوست.",
      tableTitle: "اسناد بازیابی‌شده و provenance",
      headers: ["رتبه", "متغیر", "مقدار", "محتوا", "score خام", "URI"],
      rows: hits.map((hit, index) => ({
        cells: [
          index + 1,
          hit.variable,
          hit.value,
          hit.content,
          Number(hit.score || 0).toFixed(4),
          hit.source_uri,
        ],
      })),
    });
  }
  if (mode === "tools") {
    const calls = data.tool_calls || [];
    return stageView({
      source: "host",
      sourceLabel: "کنترل‌گر میزبان",
      title: "چه کسی تصمیم می‌گیرد کدام ابزار اجرا شود؟",
      summary: "کنترل‌گر برنامه‌نویسی‌شده AST را پیمایش می‌کند؛ سیاست آن آموخته‌شده نیست.",
      input: data.expression,
      action: "scripted_ast_controller → LOOKUP / CALC",
      output: faNumber(calls.length) + " فراخوانی",
      canvas:
        '<div class="diagram-flow">' +
        diagramNode("data", "AST عبارت", "", data.expression) +
        arrow +
        diagramNode("host", "کنترل‌گر قطعی", "learned_policy = false", "", true) +
        arrow +
        diagramNode("external", "LOOKUP / CALC", "ابزار محدود و type-safe") +
        arrow +
        diagramNode("host", "OBSها", "", calls.map((call) => call.result).join(" → ") || "—") +
        "</div>",
      explanation:
        "کنترل‌گر از برگ‌های درخت آغاز می‌کند: متغیر را با LOOKUP می‌خواند و عملیات والد را با CALC انجام می‌دهد تا به ریشه برسد.",
      claim:
        "دقت این مسیر توان استدلال یادگرفته‌شدهٔ مدل نیست؛ یک برنامهٔ قطعی ابزارهای دقیق را به ترتیب صحیح فراخوانی می‌کند.",
      tableTitle: "رویدادهای CALL → OBS",
      headers: ["ترتیب", "ابزار", "آرگومان", "نتیجه", "وضعیت", "زمان ms"],
      rows: calls.map((call, index) => ({
        cells: [
          call.index ?? index,
          call.name || call.tool_name,
          JSON.stringify(call.arguments || {}),
          call.result,
          call.status,
          Number(call.elapsed_ms || 0).toFixed(3),
        ],
      })),
    });
  }
  if (mode === "oracle") {
    return stageView({
      source: "reference",
      sourceLabel: "مرجع قطعی",
      title: "Oracle چگونه بدون یادگیری پاسخ دقیق می‌سازد؟",
      summary: "Evaluator قواعد DSL و حساب پیمانه‌ای را اجرا و شبکهٔ عصبی را دور می‌زند.",
      input: data.expression,
      action: "پیمایش post-order + mod 10",
      output: data.answer == null ? "پس از اجرا" : "پاسخ " + data.answer,
      canvas:
        '<div class="diagram-flow">' +
        diagramNode("data", "AST", "", data.expression) +
        arrow +
        diagramNode("reference", "Evaluator", "قواعد صریح؛ بدون وزن", "", true) +
        arrow +
        diagramNode("reference", "نتیجه mod 10", "", data.answer ?? "؟") +
        "</div>",
      explanation:
        "Oracle معیار آزمایش است: تعریف رسمی مسئله را می‌داند و پاسخ را با یک تابع قطعی محاسبه می‌کند.",
      claim:
        "Oracle خط پایهٔ صحت است و نباید به‌عنوان توانایی مدل گزارش شود.",
      tableTitle: "ردیابی قطعی Oracle",
      headers: ["گام", "رویداد", "توضیح"],
      rows: (data.trace_steps || []).map((step, index) => ({
        cells: [index + 1, step, traceMeaning(step)],
      })),
    });
  }
  const facts = data.facts || factsFromForm();
  return stageView({
    title: "در حالت «فقط مدل» چه اطلاعاتی به شبکه داده می‌شود؟",
    summary: "واقعیت‌ها و عبارت داخل WORLD(...) و QUERY قرار می‌گیرند؛ RAG و ابزار خاموش‌اند.",
    input: Object.entries(facts)
      .map(([key, value]) => key + "=" + value)
      .join("، "),
    action: "ساخت prompt محلی بدون منبع بیرونی",
    output: prompt,
    canvas:
      '<div class="diagram-flow">' +
      diagramNode(
        "data",
        "واقعیت‌ها",
        "",
        Object.entries(facts)
          .map(([key, value]) => key + "=" + value)
          .join(","),
      ) +
      '<span class="diagram-arrow">+</span>' +
      diagramNode("data", "پرسش", "", data.expression) +
      arrow +
      diagramNode("data", "WORLD + QUERY", "", prompt, true) +
      arrow +
      diagramNode("model", "Checkpoint", "بدون retrieval و tool") +
      "</div>",
    explanation:
      "مقادیر A و B لازم نیست از وزن‌ها بازیابی شوند؛ داخل prompt حاضرند. مسئلهٔ مدل یادگیری رابطهٔ نحو و عملیات پیمانه‌ای است.",
    claim:
      "«فقط مدل» یعنی کمک بیرونی حین inference خاموش است؛ به معنی بدون input یا بدون دادهٔ آموزشی نیست.",
    tableTitle: "مواد تشکیل‌دهندهٔ زمینه",
    headers: ["جزء", "مقدار", "داخل وزن؟", "داخل prompt؟"],
    rows: [
      ...Object.entries(facts).map(([key, value]) => ({
        cells: ["واقعیت " + key, value, "مقدار جاری: خیر", "بله"],
      })),
      { cells: ["عبارت", data.expression, "الگوی عمومی ممکن است آموخته باشد", "بله"] },
    ],
  });
}

function architecture(data) {
  const model = data.model || state.model;
  const profile = state.status?.profiles?.[model] || {};
  const counts = profile.parameter_counts || {};
  const active = faNumber(counts.active_estimate || 0);
  const total = faNumber(counts.total || 0);
  if (model === "ngram") {
    return {
      canvas:
        '<div class="diagram-flow">' +
        diagramNode("data", "توکن‌های قبلی", "context کوتاه") +
        arrow +
        diagramNode("model", "جدول شمارش", "context → فراوانی", "", true) +
        arrow +
        diagramNode("host", "Backoff", "کوتاه‌کردن context") +
        arrow +
        diagramNode("model", "توکن بعدی", "بیشترین شاهد") +
        "</div>",
      rows: [
        ["Context key", "آخرین N−1 توکن", "کلید حافظه"],
        ["Count table", "شمار ادامه‌ها", "یادگیری شمارشی"],
        ["Backoff", "کوتاه‌کردن کلید", "الگوریتم ثابت"],
        ["پارامتر عصبی", total, "این مدل شبکهٔ عصبی نیست"],
      ],
    };
  }
  if (model === "window_mlp") {
    return {
      canvas:
        '<div class="diagram-flow">' +
        diagramNode("data", "۸ توکن آخر", "پنجرهٔ ثابت") +
        arrow +
        diagramNode("model", "Embedding", "ID → بردار ۴۸") +
        arrow +
        diagramNode("model", "Flatten + MLP", "۳۸۴ → ۹۶ → ۴۸", "", true) +
        arrow +
        diagramNode("model", "LM head", "امتیاز واژگان") +
        "</div>",
      rows: [
        ["پنجره", "۸ موقعیت", "توکن‌های دورتر مستقیم دیده نمی‌شوند"],
        ["Embedding", "عرض ۴۸", "بردار آموختنی"],
        ["MLP", "GELU؛ عرض ۹۶", "ترکیب غیرخطی"],
        ["پارامتر فعال/کل", active + " / " + total, "همهٔ وزن‌ها فعال‌اند"],
      ],
    };
  }
  if (model === "moe_scratch") {
    const routing = data.routing || [];
    const assignments = data.visual_trace?.routing_assignments || [];
    const loads = [0, 1, 2, 3].map((expert) =>
      routing
        .filter((item) => item.expert_index === expert)
        .reduce((sum, item) => sum + Number(item.token_count || 0), 0),
    );
    const experts = loads
      .map(
        (load, index) =>
          '<div class="expert-mini ' +
          (load ? "used" : "") +
          '">E' +
          index +
          "<br>" +
          faNumber(load) +
          " تخصیص</div>",
      )
      .join("");
    return {
      canvas:
        '<div class="diagram-flow">' +
        diagramNode("model", "Embedding + Attention", "۴ head × ۲ لایه") +
        arrow +
        '<div class="expert-fan">' +
        diagramNode("model", "Router", "شبکهٔ آموختنی · softmax → Top-1", "", true) +
        arrow +
        '<div class="expert-fan__experts">' +
        experts +
        "</div></div>" +
        arrow +
        diagramNode("model", "LM head", "امتیاز توکن بعدی") +
        "</div>",
      rows: [
        ["Attention", "۴ head × ۲ لایه", "ترکیب context"],
        ["Router", "توزیع روی ۴ expert", "انتخاب Top-1"],
        ["Expert MLP", "یک expert در هر token×layer", "ظرفیت sparse"],
        ["پارامتر فعال/کل", active + " / " + total, "ظرفیت کل با هزینهٔ فعال فرق دارد"],
        ...assignments.slice(-16).map((item) => [
          "توکن " + item.token_text + " · لایه " + item.layer_index,
          "E" + item.expert_index + " · gate " + Number(item.gate_probability).toFixed(3),
          "مسیر واقعی token→expert در snapshot منتخب",
        ]),
      ],
    };
  }
  const scratch = model === "dense_scratch";
  return {
    canvas:
      '<div class="diagram-flow">' +
      diagramNode("data", "ID + موقعیت", "context حداکثر ۱۶۰") +
      arrow +
      diagramNode("model", "Embedding ۴۸", "توکن + موقعیت") +
      arrow +
      '<div class="diagram-stack">' +
      diagramNode("model", "Attention علّی", "۴ head؛ فقط گذشته", "", true) +
      diagramNode("model", "Dense FFN", "۴۸ → ۹۶ → ۴۸") +
      "<small>× ۲ لایه</small></div>" +
      arrow +
      diagramNode("model", "LM head", scratch ? "رقم‌های scratch + جواب" : "رقم جواب مستقیم") +
      "</div>",
    rows: [
      ["Embedding", "عرض ۴۸", "بردار آموختنی"],
      ["Causal attention", "۴ head", "فقط گذشته و موقعیت جاری"],
      ["Dense FFN", "عرض میانی ۹۶", "شبکهٔ مشترک همهٔ توکن‌ها"],
      ["پارامتر فعال/کل", active + " / " + total, "همهٔ وزن‌ها فعال‌اند"],
      ["Objective", scratch ? "scratch" : "direct", scratch ? "فقط خانه‌های عددی" : "رقم نهایی"],
    ],
  };
}

function modelStage(data) {
  const run = execution(data);
  if (!run.model_invoked) {
    const isTools = data.mode === "tools";
    return stageView({
      source: isTools ? "host" : "reference",
      sourceLabel: "شبکهٔ زبانی دور زده شد",
      title: "چرا در این مسیر معماری انتخاب‌شده اجرا نشد؟",
      summary: isTools
        ? "کنترل‌گر و ابزار پاسخ را ساختند؛ selector مدل در این run اثری ندارد."
        : "Evaluator قطعی پاسخ مرجع را ساخت؛ checkpoint مصرف نشد.",
      input: data.expression,
      action: "Bypass شبکهٔ عصبی",
      output: "۰ forward pass مدل",
      canvas:
        '<div class="diagram-flow">' +
        diagramNode("data", "ورودی") +
        arrow +
        '<div style="opacity:.28">' +
        diagramNode("model", modelInfo(data.model).label, "مسیر بسته") +
        "</div>" +
        '<span class="diagram-arrow">↘</span>' +
        diagramNode(isTools ? "host" : "reference", isTools ? "Controller + Tools" : "Oracle", "مسیر فعال", "", true) +
        "</div>",
      explanation:
        "وجود selector مدل در صفحه به معنی مصرف مدل در همهٔ modeها نیست؛ answer_source و forward pass مرجع تشخیص‌اند.",
      claim: "نتیجهٔ این اجرا را نمی‌توان به معماری مدل نسبت داد، چون forward عصبی انجام نشده است.",
      tableTitle: "ممیزی اجزای مصرف‌شده",
      headers: ["جزء", "فراخوانی شد؟", "نقش"],
      rows: [
        { cells: [modelInfo(data.model).label, "خیر", "بدون اثر"] },
        { cells: [isTools ? "scripted_ast_controller" : "Oracle evaluator", "بله", "سازندهٔ پاسخ"] },
      ],
    });
  }
  const info = modelInfo(data.model);
  const diagram = architecture(data);
  return stageView({
    source: "model",
    sourceLabel: "محاسبهٔ مدل",
    title: "درون " + info.label + " چه تبدیل‌هایی رخ می‌دهد؟",
    summary: info.summary,
    input: faNumber(tokenRecords(data).length) + " توکن زمینه",
    action: info.family,
    output: "logit → توزیع مقید توکن بعدی",
    canvas: diagram.canvas,
    explanation:
      data.model === "moe_scratch"
        ? "در MoE، attention هنوز dense است؛ sparse بودن در feed-forward رخ می‌دهد. router هر token×layer را به یک expert می‌فرستد."
        : data.model === "ngram"
          ? "N-gram embedding و وزن عصبی ندارد. یادگیری آن ذخیرهٔ شمارش‌ها و backoff به context کوتاه‌تر است."
          : "logit امتیاز خام است. constraint، temperature و top-k آن را به توزیع مورد استفادهٔ decoder تبدیل می‌کنند.",
    claim: data.attention
      ? "attention موجود، میانگین headهای آخرین لایه در snapshot نهایی کاندیدای منتخب است؛ توضیح علّی قطعی نیست."
      : "دیاگرام از کد معماری آمده است. نبود snapshot داخلی به معنی نبود محاسبه نیست.",
    tableTitle: "اجزای فعال این معماری",
    headers: ["جزء", "اندازه یا قاعده", "نقش"],
    rows: diagram.rows.map((cells) => ({ cells })),
  });
}

function traceMeaning(stepValue) {
  const parts = String(stepValue || "").split(" ");
  if (parts[0] === "GET") return "خواندن " + parts[1] + " از زمینه: مقدار " + parts[2];
  const guide = OPS[parts[0]];
  if (!guide) return "رویداد ثبت‌شدهٔ پروتکل";
  return (
    guide.fa +
    ": (" +
    parts[1] +
    " " +
    guide.sign +
    " " +
    parts[2] +
    ") mod 10 = " +
    parts[3]
  );
}

function traceCards(steps, kind = "model") {
  if (!steps?.length) return '<p class="empty">گام میانی ثبت نشده است.</p>';
  return (
    '<div class="trace-card-list">' +
    steps
      .map((step, index) => {
        const text =
          typeof step === "string"
            ? step
            : step.text || step.render || step.operation || JSON.stringify(step);
        return (
          '<article class="trace-card"><span>گام ' +
          faNumber(index + 1) +
          " · " +
          (kind === "reference" ? "مرجع" : "خروجی عمومی") +
          "</span><strong>" +
          escapeHtml(text) +
          "</strong><p>" +
          escapeHtml(traceMeaning(text)) +
          "</p></article>"
        );
      })
      .join("") +
    "</div>"
  );
}

function chosenProbability(step) {
  const probabilities = step?.top_probabilities || step?.top_probs || [];
  const token = String(step?.token_text || step?.token);
  const chosen = probabilities.find((item) =>
    Array.isArray(item) ? String(item[0]) === token : String(item.token) === token,
  );
  return chosen ? Number(Array.isArray(chosen) ? chosen[1] : chosen.probability) : null;
}

function probabilityRace(step) {
  const probabilities = step?.top_probabilities || step?.top_probs || [];
  if (!probabilities.length) return '<p class="empty">توزیع توکن ثبت نشده است.</p>';
  return (
    '<div class="probability-race">' +
    probabilities
      .map((item) => {
        const token = Array.isArray(item) ? item[0] : item.token;
        const probability = Number(Array.isArray(item) ? item[1] : item.probability);
        const chosen = String(token) === String(step.token_text || step.token);
        return (
          '<div class="probability-column ' +
          (chosen ? "chosen" : "") +
          '"><div class="probability-column__track"><i class="probability-column__fill" style="--p:' +
          Math.max(1, probability * 100) +
          '%"></i></div><code>' +
          escapeHtml(token) +
          "</code><small>" +
          faNumber(probability * 100, 1) +
          "٪" +
          (chosen ? " · انتخاب" : "") +
          "</small></div>"
        );
      })
      .join("") +
    "</div>"
  );
}

function generateStage(data) {
  const run = execution(data);
  if (!run.model_invoked) {
    const steps =
      data.mode === "tools"
        ? (data.tool_calls || []).map(
            (call) =>
              (call.name || call.tool_name) +
              " " +
              JSON.stringify(call.arguments || {}) +
              " → " +
              call.result,
          )
        : data.trace_steps || [];
    return stageView({
      source: data.mode === "tools" ? "host" : "reference",
      sourceLabel: data.mode === "tools" ? "رویدادهای ابزار" : "گام‌های مرجع",
      title: data.mode === "tools" ? "پاسخ از زنجیرهٔ CALL و OBS ساخته شد" : "پاسخ با evaluator قطعی ساخته شد",
      summary: "در این مسیر sampling، token probability و scratchpad مدل وجود ندارد.",
      input: data.expression,
      action: data.mode === "tools" ? "فراخوانی typed ابزار" : "اجرای قواعد حساب",
      output: data.answer == null ? "پس از اجرا" : "عدد " + data.answer,
      canvas: traceCards(steps, data.mode === "oracle" ? "reference" : "host"),
      explanation:
        "نام مرحله «تولید» است، اما منشأ این رویدادها شبکهٔ زبانی نیست؛ controller یا evaluator میزبان آن‌ها را ساخته است.",
      claim: "نبود احتمال توکن طبیعی است؛ سامانه چیزی sample نکرده است.",
      tableTitle: "ترتیب رویدادها",
      headers: ["ردیف", "رویداد", "تفسیر"],
      rows: steps.map((step, index) => ({ cells: [index + 1, step, traceMeaning(step)] })),
    });
  }
  const steps = data.token_steps || [];
  const last = steps.at(-1);
  const scratch = run.objective === "scratch";
  return stageView({
    source: "model",
    sourceLabel: "مدل + قاب نحوی میزبان",
    title: scratch ? "مدل دقیقاً کدام خانه‌های scratchpad را ساخت؟" : "رقم پاسخ چگونه از توزیع انتخاب شد؟",
    summary: scratch
      ? "عملیات و جداکننده‌ها ثابت‌اند؛ مدل فقط رقم‌های جای خالی و پاسخ نهایی را پیش‌بینی می‌کند."
      : "مدل به رقم‌های ۰ تا ۹ امتیاز می‌دهد و decoder یک رقم را انتخاب می‌کند.",
    input: faNumber(tokenRecords(data).length) + " توکن زمینه",
    action: "Decoding مقید · effort " + (data.effort || state.effort),
    output: faNumber(steps.length) + " تصمیم توکنی در مسیر منتخب",
    canvas:
      '<div class="diagram-stack">' +
      (scratch ? traceCards(data.trace_steps || []) : "") +
      probabilityRace(last) +
      '<small style="direction:rtl;color:var(--muted)">نمودار، آخرین تصمیم توکنی مسیر منتخب را نشان می‌دهد.</small></div>',
    explanation:
      "نوارها احتمال پس از constraint، temperature و top-k هستند؛ احتمال خام کل واژگان نیستند. در sampling، انتخاب همیشه بلندترین نوار نیست.",
    claim:
      "scratchpad رشتهٔ عمومی قابل‌بررسی است، نه فکر پنهان. grammar-constrained decoding نیز جزء میزبان inference است.",
    tableTitle: "تصمیم‌های توکنی کاندیدای منتخب",
    headers: ["گام", "موقعیت", "توکن منتخب", "احتمال منتخب", "بالاترین گزینه", "logprob"],
    rows: steps.map((step, index) => {
      const probabilities = step.top_probabilities || [];
      const first = probabilities[0];
      const top = Array.isArray(first) ? first?.[0] : first?.token;
      const probability = chosenProbability(step);
      return {
        cells: [
          index + 1,
          step.position ?? "—",
          step.token_text || step.token,
          probability == null ? "خارج از top-5" : (probability * 100).toFixed(2) + "%",
          top ?? "—",
          Number(step.logprob || 0).toFixed(4),
        ],
      };
    }),
  });
}

function majorityAnswer(candidates) {
  const counts = new Map();
  candidates.forEach((candidate) => {
    if (candidate.final_answer == null) return;
    counts.set(candidate.final_answer, (counts.get(candidate.final_answer) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function selectStage(data) {
  const candidates = data.candidates || [];
  const run = execution(data);
  if (!run.model_invoked || !candidates.length) {
    return stageView({
      source: "host",
      sourceLabel: "بدون رقابت کاندیدا",
      title: "چرا مرحلهٔ انتخاب در این مسیر خالی است؟",
      summary: run.model_invoked
        ? "این baseline کاندیدای قابل‌مقایسه گزارش نکرده است."
        : "پاسخ قطعی controller یا Oracle مستقیماً عبور کرده است.",
      input: "یک مسیر",
      action: "بدون رأی‌گیری کاندیدا",
      output: data.answer == null ? "پس از اجرا" : "پاسخ " + data.answer,
      canvas:
        '<div class="diagram-flow">' +
        diagramNode(data.mode === "oracle" ? "reference" : "host", "یک مسیر", "بدون sampling چندگانه") +
        arrow +
        diagramNode("host", "عبور مستقیم", "", data.answer ?? "؟", true) +
        "</div>",
      explanation: "effort در Tools و Oracle مسیر مدل را زیاد نمی‌کند، چون مدل فراخوانی نشده است.",
      claim: "صفر verifier در اینجا کمبود نیست؛ verifier scratchpad برای این مسیر کاربرد ندارد.",
      tableTitle: "وضعیت انتخاب",
      headers: ["شاخص", "مقدار"],
      rows: [
        { cells: ["model_invoked", String(run.model_invoked)] },
        { cells: ["candidate_count", candidates.length] },
        { cells: ["answer_source", run.answer_source] },
      ],
    });
  }
  const selection = data.selection || data.educational?.selection || data.education?.selection || {};
  const majority = selection.majority_answer ?? majorityAnswer(candidates);
  const selectedIndex =
    data.selected_index ?? candidates.findIndex((candidate) => candidate.selected);
  const cards = candidates
    .map((candidate, index) => {
      const score = Math.max(0, Math.min(100, Number(candidate.verifier_score || 0) * 100));
      const selected = index === selectedIndex || candidate.selected;
      return (
        '<article class="candidate-card ' +
        (selected ? "selected" : "") +
        '"><div class="candidate-card__head"><span>مسیر ' +
        faNumber(index + 1) +
        (selected ? " · منتخب" : "") +
        "</span><strong>" +
        escapeHtml(candidate.final_answer ?? "؟") +
        '</strong></div><div class="candidate-meter"><i style="--score:' +
        score +
        '%"></i></div><dl><dt>پروتکل</dt><dd>' +
        (candidate.protocol_valid ? "معتبر" : "نامعتبر") +
        "</dd><dt>امتیاز verifier</dt><dd>" +
        score.toFixed(0) +
        "%</dd><dt>رأی اکثریت</dt><dd>" +
        (candidate.final_answer === majority ? "بله" : "خیر") +
        "</dd><dt>logprob</dt><dd>" +
        Number(candidate.normalized_logprob || 0).toFixed(3) +
        "</dd></dl></article>"
      );
    })
    .join("");
  return stageView({
    source: "host",
    sourceLabel: "سیاست انتخاب میزبان",
    title: "از میان چند پاسخ، کدام کاندیدا برنده می‌شود؟",
    summary:
      "effort " +
      (data.effort || state.effort) +
      " تعداد " +
      faNumber(candidates.length) +
      " مسیر ساخت؛ پاسخ اکثریت " +
      (majority ?? "نامشخص") +
      " بود.",
    input: faNumber(candidates.length) + " کاندیدا از checkpoint یکسان",
    action: "اعتبار ← verifier ← اکثریت ← logprob ← ترتیب",
    output: "مسیر " + faNumber(selectedIndex + 1) + "؛ پاسخ " + (data.answer ?? "؟"),
    canvas: '<div class="candidate-race">' + cards + "</div>",
    explanation:
      "انتخاب یک max صریح است: اعتبار کامل پروتکل، امتیاز گام‌ها، تطابق با اکثریت، logprob و در پایان اندیس زودتر.",
    claim:
      "این رتبه‌بندی داخل وزن‌های مدل نیست؛ الگوریتم میزبان است. effort بیشتر کیفیت را تضمین نمی‌کند.",
    tableTitle: "مقایسهٔ کاندیداها",
    headers: ["مسیر", "پاسخ", "پروتکل", "verifier", "اکثریت", "logprob", "توکن", "forward"],
    rows: candidates.map((candidate, index) => ({
      selected: index === selectedIndex || candidate.selected,
      cells: [
        index + 1,
        candidate.final_answer ?? "—",
        candidate.protocol_valid ? "معتبر" : "نامعتبر",
        Number(candidate.verifier_score || 0).toFixed(2),
        candidate.final_answer === majority ? "بله" : "خیر",
        Number(candidate.normalized_logprob || 0).toFixed(4),
        candidate.generated_tokens,
        candidate.forward_passes,
      ],
    })),
  });
}

function referenceTrace(data) {
  return (
    data.canonical_reference?.trace_steps ||
    data.reference_trace ||
    data.reference?.trace ||
    data.educational?.reference_trace ||
    data.education?.reference_trace ||
    []
  );
}

function resultStage(data) {
  const answer = data.answer ?? data.selected_answer;
  const gold = data.gold_answer_after_inference ?? data.reference?.answer;
  const correct = data.correct == null ? null : Boolean(data.correct);
  const verdict = correct == null ? "منتظر اجرا" : correct ? "همسان با مرجع" : "متفاوت از مرجع";
  const source = execution(data).answer_source || "unknown";
  return stageView({
    source: modeInfo(data.mode).source,
    sourceLabel:
      correct == null ? "هنوز ارزیابی نشده" : correct ? "پاسخ با مرجع یکسان است" : "مرجع اختلاف را آشکار کرد",
    title: "پاسخ نهایی را چگونه درست تفسیر کنیم؟",
    summary:
      correct == null
        ? "پس از اجرا، پاسخ مسیر منتخب با Oracle مستقل مقایسه می‌شود."
        : "پاسخ " + answer + " در برابر مرجع " + gold + ": " + verdict + ".",
    input: "پاسخ از " + source,
    action: "مقایسهٔ پس از inference با Oracle",
    output: verdict,
    canvas:
      '<div class="diagram-stack"><div class="result-balance"><div class="result-value"><span>پاسخ سامانه</span><strong>' +
      escapeHtml(answer ?? "؟") +
      "</strong><small>" +
      escapeHtml(source) +
      '</small></div><div class="result-verdict ' +
      (correct == null ? "" : correct ? "pass" : "fail") +
      '">' +
      escapeHtml(verdict) +
      '</div><div class="result-value reference"><span>پاسخ مرجع</span><strong>' +
      escapeHtml(gold ?? "؟") +
      "</strong><small>محاسبه‌شده بعد از inference</small></div></div>" +
      (referenceTrace(data).length ? traceCards(referenceTrace(data), "reference") : "") +
      "</div>",
    explanation:
      correct === true
        ? "این نمونه درست است؛ اما یک موفقیت، تعمیم یا استدلال واقعی را ثابت نمی‌کند. benchmark چندنمونه‌ای را نیز ببینید."
        : correct === false
          ? "اختلاف یعنی مسیر منتخب با قواعد قطعی سازگار نیست. مراحل قبل نشان می‌دهند خطا در زمینه، تولید یا انتخاب رخ داده است."
          : "Gold تنها پس از پایان مسیر اصلی محاسبه می‌شود تا به inference نشت نکند.",
    claim:
      "درستی رفتار با توضیح علّی یکی نیست. attention، router، scratchpad و verifier هرکدام شاهد محدود خود را دارند.",
    tableTitle: "صورت‌حساب این اجرا",
    headers: ["شاخص", "مقدار", "معنا"],
    rows: [
      { cells: ["answer_source", source, "جزئی که پاسخ را ساخته است"] },
      { cells: ["answer", answer ?? "—", "پاسخ مسیر منتخب"] },
      { cells: ["reference", gold ?? "—", "Oracle مستقل پس از inference"] },
      { cells: ["correct", correct == null ? "—" : String(correct), "برابری دقیق"] },
      { cells: ["generated tokens", data.total_generated_tokens || 0, "همهٔ کاندیداها"] },
      { cells: ["forward passes", data.total_forward_passes || 0, "عبورهای شبکه"] },
      { cells: ["latency", Number(data.elapsed_ms || 0).toFixed(2) + " ms", "زمان محلی"] },
      { cells: ["trace_id", data.trace_id || "—", "کلید رکورد SQLite"] },
    ],
  });
}

const BUILD_STAGE = {
  problem: problemStage,
  tokenize: tokenizeStage,
  context: contextStage,
  model: modelStage,
  generate: generateStage,
  select: selectStage,
  result: resultStage,
};

function renderJourneyStage(name, supplied) {
  const data = supplied || state.run || preview();
  const view = (BUILD_STAGE[name] || problemStage)(data);
  const index = STAGES.indexOf(name);
  state.stage = name;
  $$("#journey-rail button").forEach((button) => {
    const active = button.dataset.journey === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  $$("#pipeline .pipe-node").forEach((button) => {
    if (button.dataset.stage === name) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  $(".journey-status__beam").style.setProperty(
    "--journey-progress",
    ((index + 1) / STAGES.length) * 100 + "%",
  );
  const badge = $("#stage-source");
  badge.textContent = view.sourceLabel;
  badge.dataset.kind = view.source;
  $("#stage-code").textContent = "STAGE / " + String(index + 1).padStart(2, "0");
  $("#stage-title").textContent = view.title;
  $("#stage-summary").textContent = view.summary;
  $("#stage-input").textContent = view.input;
  $("#stage-action").textContent = view.action;
  $("#stage-output").textContent = view.output;
  $("#stage-canvas").innerHTML = view.canvas;
  $("#stage-explanation").textContent = view.explanation;
  $("#stage-claim").textContent = view.claim;
  $("#stage-table-title").textContent = view.tableTitle;
  $("#stage-table-count").textContent = faNumber(view.rows.length) + " ردیف";
  $("#stage-table").innerHTML = tableHtml(view.headers, view.rows);
  if (state.run && !state.stale) {
    $("#journey-status-text").textContent =
      "مرحلهٔ " +
      faNumber(index + 1) +
      " از " +
      faNumber(STAGES.length) +
      " · اجرای " +
      String(state.run.trace_id || "local").slice(-8);
  }
}

function animateJourney() {
  state.timers.forEach(clearTimeout);
  state.timers = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $$("#journey-rail button, #pipeline .pipe-node").forEach((item) =>
    item.classList.remove("complete", "live"),
  );
  STAGES.forEach((name, index) => {
    const reveal = () =>
      $$(
        '#journey-rail [data-journey="' +
          name +
          '"], #pipeline [data-stage="' +
          name +
          '"]',
      ).forEach((item) => item.classList.add("complete"));
    if (reduced) reveal();
    else state.timers.push(setTimeout(reveal, 90 * (index + 1)));
  });
}

function renderTrace(data) {
  const steps = data.trace_steps || [];
  $("#trace-steps").innerHTML = steps.length
    ? steps
        .map(
          (step) =>
            "<li><code>" +
            escapeHtml(typeof step === "string" ? step : step.text || JSON.stringify(step)) +
            "</code><span>" +
            escapeHtml(traceMeaning(typeof step === "string" ? step : step.text)) +
            "</span></li>",
        )
        .join("")
    : '<li class="placeholder">این مسیر scratchpad عمومی ندارد.</li>';
  const applicable = execution(data).objective === "scratch" && execution(data).model_invoked;
  const valid = data.protocol_valid !== false;
  const badge = $("#protocol-badge");
  badge.textContent = !applicable
    ? "نامرتبط با این مسیر"
    : valid
      ? "پروتکل معتبر"
      : "خروجی ناقص/نامعتبر";
  badge.classList.toggle("valid", applicable && valid);
}

function renderProbabilities(steps = []) {
  if (!steps.length) {
    $("#token-probs").innerHTML = '<p class="empty">توزیع توکن ثبت نشده است.</p>';
    return;
  }
  $("#token-probs").innerHTML = steps
    .map((step) => {
      const bars = (step.top_probabilities || [])
        .slice(0, 5)
        .map((item) => {
          const token = Array.isArray(item) ? item[0] : item.token;
          const probability = Number(Array.isArray(item) ? item[1] : item.probability);
          const chosen = String(token) === String(step.token_text || step.token);
          return (
            '<i class="' +
            (chosen ? "chosen" : "") +
            '" style="--p:' +
            Math.max(1, probability * 100) +
            '" title="' +
            escapeHtml(token) +
            ": " +
            (probability * 100).toFixed(1) +
            '%"></i>'
          );
        })
        .join("");
      return (
        '<div class="token-step"><div class="token-step__bars">' +
        bars +
        "</div><code>" +
        escapeHtml(step.token_text || step.token || "?") +
        "</code><small>#" +
        escapeHtml(step.position ?? "—") +
        "</small></div>"
      );
    })
    .join("");
}

function visualLabels(data, count) {
  const visual =
    data.visual_trace?.tokens ||
    data.educational?.visual_trace?.tokens ||
    data.education?.visual_trace?.tokens ||
    [];
  const labels = visual.map((item) =>
    typeof item === "object" ? item.token_text || item.text : item,
  );
  if (labels.length >= count) return labels.slice(-count);
  return Array.from({ length: count }, (_item, index) => "t" + (index + 1));
}

function renderAttention(matrix, data) {
  if (!Array.isArray(matrix) || !matrix.length) {
    $("#attention-map").innerHTML =
      '<p class="empty">این معماری attention ندارد یا snapshot ثبت نشده است.</p>';
    return;
  }
  const size = Math.min(18, matrix.length);
  const clipped = matrix.slice(-size).map((row) => row.slice(-size));
  const labels = visualLabels(data, matrix.length).slice(-size);
  $("#attention-map").innerHTML =
    '<div class="attention-caption">آخرین لایه · میانگین headها · snapshot نهایی کاندیدای منتخب</div><table class="attention-table"><thead><tr><th>خروجی ↓ / ورودی →</th>' +
    labels.map((label) => "<th>" + escapeHtml(label) + "</th>").join("") +
    "</tr></thead><tbody>" +
    clipped
      .map(
        (row, rowIndex) =>
          "<tr><th>" +
          escapeHtml(labels[rowIndex]) +
          "</th>" +
          row
            .map(
              (value, columnIndex) =>
                '<td><i class="attention-cell" style="--a:' +
                Math.min(1, Math.max(0.02, value)) +
                '" title="' +
                escapeHtml(labels[rowIndex]) +
                " ← " +
                escapeHtml(labels[columnIndex]) +
                ": " +
                Number(value).toFixed(3) +
                '"></i></td>',
            )
            .join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table>";
}

function renderRouting(routing = []) {
  const loads = [0, 0, 0, 0];
  routing.forEach((item) => {
    if (item.expert_index >= 0 && item.expert_index < 4) {
      loads[item.expert_index] += item.token_count || 0;
    }
  });
  const max = Math.max(1, ...loads);
  $$("#expert-grid .expert").forEach((item, index) => {
    $("i", item).style.setProperty("--load", (loads[index] / max) * 100 + "%");
    $("small", item).textContent = faNumber(loads[index]) + " تخصیص token×layer";
  });
}

function renderExternal(data) {
  const hits = data.retrieval?.hits || data.retrieval_hits || [];
  $("#retrieval-hits").innerHTML = hits.length
    ? hits
        .map(
          (hit, index) =>
            '<div class="event" title="' +
            escapeHtml(hit.source_uri || "") +
            '"><span class="event__rank">#' +
            (index + 1) +
            "</span><span>" +
            escapeHtml(hit.content || hit.variable + "=" + hit.value) +
            '</span><span class="event__score">' +
            Number(hit.score || 0).toFixed(3) +
            "</span></div>",
        )
        .join("")
    : '<p class="empty">سندی بازیابی نشد یا RAG خاموش است.</p>';
  const calls = data.tool_calls || [];
  $("#tool-calls").innerHTML = calls.length
    ? calls
        .map(
          (call, index) =>
            '<div class="event"><span class="event__rank">#' +
            (index + 1) +
            "</span><span>" +
            escapeHtml(call.name || call.tool_name) +
            "(" +
            escapeHtml(JSON.stringify(call.arguments || {})) +
            ')</span><span class="event__score">' +
            escapeHtml(call.result ?? call.status) +
            "</span></div>",
        )
        .join("")
    : '<p class="empty">فراخوانی ابزاری ثبت نشد یا Tools خاموش است.</p>';
}

function updatePipeline(data) {
  const run = execution(data);
  const candidates = data.candidates || [];
  const labels = {
    problem: faNumber(Object.keys(data.facts || {}).length) + " واقعیت",
    tokenize: run.model_invoked ? faNumber(tokenRecords(data).length) + " token" : "بدون مصرف مدل",
    context: modeInfo(data.mode).label,
    model: run.model_invoked ? modelInfo(data.model).label : "دور زده شد",
    generate: run.model_invoked ? faNumber(data.token_steps?.length || 0) + " تصمیم" : "قطعی",
    select: candidates.length ? faNumber(candidates.length) + " مسیر" : "بدون رقابت",
    result: data.correct == null ? "منتظر" : data.correct ? "درست" : "نادرست",
  };
  Object.entries(labels).forEach(([name, label]) => {
    const target = $('[data-stage="' + name + '"] small');
    if (target) target.textContent = label;
  });
}

function renderRun(data) {
  state.run = data;
  state.stale = false;
  $("#run-id").textContent = "RUN " + String(data.trace_id || data.run_id || "local").slice(-10);
  $("#final-answer").textContent = data.answer ?? data.selected_answer ?? "؟";
  $("#tokens-count").textContent = faNumber(data.total_generated_tokens ?? data.generated_tokens);
  $("#forward-count").textContent = faNumber(data.total_forward_passes ?? data.forward_passes);
  $("#latency").textContent = faNumber(data.elapsed_ms, 1);
  const verify = data.verification || data.educational?.verification || data.education?.verification;
  $("#verifier-count").textContent =
    verify?.applicable === false ? "—" : faNumber(verify?.passes ?? data.verifier_passes);
  renderTrace(data);
  renderProbabilities(data.token_steps || []);
  renderAttention(data.attention || data.telemetry?.attention, data);
  renderRouting(data.routing || data.telemetry?.routing || []);
  renderExternal(data);
  updatePipeline(data);
  renderJourneyStage("problem", data);
  animateJourney();
}

function setBusy(busy) {
  $("#run-button").disabled = busy;
  $("#workbench").setAttribute("aria-busy", String(busy));
  $(".journey").setAttribute("aria-busy", String(busy));
  $("#run-button span").textContent = busy ? "در حال اجرای مسیر…" : "حل و نمایش مسیر";
  $("#pipeline").classList.toggle("running", busy);
  if (busy) {
    $$(".pipe-node").forEach((item) => item.classList.add("live"));
    $("#journey-status-text").textContent =
      "محاسبه در حال انجام است؛ پس از پاسخ، هفت برش کالبدشناسی ساخته می‌شود.";
  }
}

function markStale() {
  if (!state.run) return;
  state.stale = true;
  $("#journey-status-text").textContent =
    "تنظیمات تغییر کرده‌اند؛ شکل‌ها هنوز اجرای قبلی را نشان می‌دهند. دوباره اجرا کنید.";
}

function syncControlApplicability() {
  const bypassesModel = ["tools", "oracle"].includes(state.mode);
  $$(".arch").forEach((button) => {
    button.disabled = bypassesModel;
    button.setAttribute("aria-disabled", String(bypassesModel));
  });
  $$("#effort-select button").forEach((button) => {
    button.disabled = bypassesModel;
    button.setAttribute("aria-disabled", String(bypassesModel));
  });
  $(".architecture-strip").classList.toggle("inapplicable", bypassesModel);
  $("#effort-fieldset").classList.toggle("inapplicable", bypassesModel);
  $("#effort-note").textContent = bypassesModel
    ? "در این mode شبکهٔ زبانی اجرا نمی‌شود؛ effort و معماری اثری بر پاسخ ندارند."
    : "checkpoint ثابت می‌ماند؛ مسیرهای بیشتر، بهبود کیفیت را تضمین نمی‌کند.";
}

async function runExperiment() {
  $("#run-error").textContent = "";
  setBusy(true);
  const expression = $("#expression").value.trim();
  $("#input-expression").textContent = expression;
  try {
    const data = await jsonFetch("/api/solve", {
      method: "POST",
      body: JSON.stringify({
        model: state.model,
        mode: state.mode,
        effort: state.effort,
        expression,
        facts: factsFromForm(),
        capture: true,
      }),
    });
    renderRun(data);
  } catch (error) {
    $("#run-error").textContent = error.message;
    $("#journey-status-text").textContent = "اجرا متوقف شد: " + error.message;
  } finally {
    setBusy(false);
    $$(".pipe-node").forEach((item) => item.classList.remove("live"));
  }
}

function renderComparison(rows) {
  if (!rows.length) return;
  $("#comparison-body").innerHTML = rows
    .map(
      (row) =>
        '<tr><td title="checkpoint ' +
        escapeHtml(row.checkpoint_sha256 || "ندارد") +
        '">' +
        escapeHtml(row.label || row.model_kind + " / " + row.mode) +
        '<small class="checkpoint-mini">#' +
        escapeHtml((row.checkpoint_sha256 || "external").slice(0, 8)) +
        "</small>" +
        "</td><td>" +
        metric(row.iid_accuracy) +
        "</td><td>" +
        metric(row.depth_ood_accuracy) +
        "</td><td>" +
        metric(row.rag_holdout_accuracy) +
        "</td><td>" +
        faNumber(row.active_parameters) +
        " / " +
        faNumber(row.total_parameters) +
        "</td>" +
        '<td class="' +
        (row.available ? "status-pass" : "status-unavailable") +
        '">' +
        (row.available ? "آماده" : "آموزش‌ندیده") +
        "</td></tr>",
    )
    .join("");
}

function renderEffort(rows) {
  if (!rows.length) return;
  $("#effort-cards").innerHTML = rows
    .map(
      (row) =>
        '<article class="effort-card"><strong>' +
        escapeHtml(row.effort) +
        "</strong><span>accuracy " +
        metric(row.accuracy) +
        "</span><span>protocol " +
        metric(row.protocol_valid_rate) +
        "</span><span>" +
        faNumber(row.average_generated_tokens, 1) +
        " generated token</span><span>" +
        faNumber(row.average_forward_passes, 1) +
        " forward</span><span>" +
        faNumber(row.average_latency_ms, 1) +
        " ms</span><span>n=" +
        faNumber(row.episodes) +
        " · #" +
        escapeHtml(String(row.checkpoint_sha256 || "").slice(0, 8)) +
        "</span></article>",
    )
    .join("");
}

function metric(value) {
  return value == null ? "—" : faNumber(value * 100, 1) + "٪";
}

function renderTrainingOrigin(status) {
  const corpus = status.corpus_summary || {};
  $("#training-total").textContent = faNumber(corpus.total_episodes) + " اپیزود";
  $("#training-vocab").textContent = faNumber(corpus.vocabulary_size) + " توکن ثابت";
  $("#training-examples").textContent = faNumber(corpus.training_examples) + " مثال";
  const purposes = {
    train: ["یادگیری وزن‌ها", "بله"],
    validation: ["کنترل حین آموزش", "خیر"],
    iid_test: ["آزمون هم‌توزیع", "خیر"],
    depth_ood: ["عمق خارج از آموزش", "خیر"],
    rag_holdout: ["واقعیت‌های نگه‌داشته‌شده برای RAG", "خیر"],
  };
  $("#split-ledger").innerHTML = Object.entries(corpus.split_counts || {})
    .map(([name, count]) => {
      const [purpose, gradient] = purposes[name] || ["ارزیابی", "خیر"];
      return (
        "<tr><td>" +
        escapeHtml(name) +
        "</td><td>" +
        faNumber(count) +
        "</td><td>" +
        escapeHtml(purpose) +
        '</td><td class="' +
        (gradient === "بله" ? "status-pass" : "status-unavailable") +
        '">' +
        gradient +
        "</td></tr>"
      );
    })
    .join("");
  const order = ["ngram", "window_mlp", "dense_direct", "dense_scratch", "moe_scratch"];
  $("#checkpoint-ledger").innerHTML = order
    .map((name) => status.profiles?.[name])
    .filter(Boolean)
    .map((profile) => {
      const counts = profile.parameter_counts || {};
      return (
        "<tr><td>" +
        escapeHtml(profile.profile) +
        "</td><td>" +
        escapeHtml(profile.objective) +
        "</td><td>" +
        faNumber(counts.active_estimate) +
        " / " +
        faNumber(counts.total) +
        "</td><td title=\"" +
        escapeHtml(profile.checkpoint_sha256) +
        '\">#' +
        escapeHtml(String(profile.checkpoint_sha256 || "").slice(0, 12)) +
        "</td></tr>"
      );
    })
    .join("");
}

function parameterById(id) {
  return PARAMETERS.find((parameter) => parameter.id === id);
}

function renderParameterAtlas() {
  const grid = $("#parameter-grid");
  if (!grid) return;
  grid.innerHTML = PARAMETERS.map((parameter, index) => {
    const kind = PARAMETER_KINDS[parameter.kind];
    return (
      '<article class="parameter-card" data-family="' +
      parameter.family +
      '" data-kind="' +
      parameter.kind +
      '"><header><span class="parameter-card__number">' +
      String(index + 1).padStart(2, "0") +
      '</span><span class="parameter-kind" data-kind="' +
      parameter.kind +
      '">' +
      escapeHtml(kind.label) +
      "</span>" +
      infoControl(
        "info-parameter-" + parameter.id,
        parameter.title,
        parameter.short + " " + parameter.boundary,
        parameter.id,
        parameter.sources,
        "/static/docs/parameters.html",
      ) +
      "</header><div><small>" +
      escapeHtml(PARAMETER_FAMILIES[parameter.family]) +
      "</small><h4>" +
      escapeHtml(parameter.title) +
      "</h4><p>" +
      escapeHtml(parameter.short) +
      "</p><code dir=\"ltr\">" +
      escapeHtml(parameter.mechanism) +
      "</code></div></article>"
    );
  }).join("");
}

function installSamplingControlInfo() {
  $$('[data-parameter-info]').forEach((slot) => {
    const controlId = slot.dataset.parameterInfo;
    const info = CONTROL_INFO[controlId];
    const parameter = parameterById(info?.ref);
    if (!info || !parameter) return;
    slot.innerHTML = infoControl(
      "info-control-" + controlId,
      info.title || parameter.title,
      info.short || parameter.short + " " + parameter.boundary,
      info.ref,
      parameter.sources,
      "/static/docs/parameters.html",
    );
  });
}

const INTERACTION_AXES = [
  { id: "context", label: "Prompt / context" },
  { id: "temperature", label: "Temperature" },
  { id: "top-k", label: "Top-k" },
  { id: "top-p", label: "Top-p" },
  { id: "penalties", label: "Penalties" },
  { id: "seed", label: "Seed" },
  { id: "effort", label: "Reasoning effort" },
  { id: "retrieval", label: "RAG top-k" },
];

const STRONG_INTERACTIONS = new Set([
  "temperature|top-k", "temperature|top-p", "top-k|top-p", "temperature|penalties",
  "seed|effort", "context|retrieval",
]);
const CONDITIONAL_INTERACTIONS = new Set([
  "context|temperature", "context|top-k", "context|top-p", "context|penalties",
  "context|seed", "context|effort", "effort|retrieval", "temperature|retrieval",
]);
const INDEPENDENT_INTERACTIONS = new Set([
  "seed|retrieval", "penalties|retrieval", "top-k|effort", "top-p|effort",
]);

function interactionKey(first, second) {
  return [first, second].sort((left, right) => {
    const ids = INTERACTION_AXES.map((item) => item.id);
    return ids.indexOf(left) - ids.indexOf(right);
  }).join("|");
}

function interactionLevel(first, second) {
  if (first === second) return "خودِ پارامتر";
  const key = interactionKey(first, second);
  if (STRONG_INTERACTIONS.has(key)) return "قوی";
  if (CONDITIONAL_INTERACTIONS.has(key)) return "شرطی";
  if (INDEPENDENT_INTERACTIONS.has(key)) return "مستقل";
  return "متوسط";
}

function interactionExplanation(first, second, level) {
  const labels = Object.fromEntries(INTERACTION_AXES.map((item) => [item.id, item.label]));
  const key = interactionKey(first, second);
  const special = {
    "temperature|top-k": "دما شکل توزیع را پیش از بریدن عوض می‌کند؛ در این قرارداد top-k بعد از دما می‌آید، هرچند رتبه با دما ثابت می‌ماند.",
    "temperature|top-p": "دما جرم احتمال‌ها را جابه‌جا می‌کند، پس تعداد اعضایی که برای رسیدن به p لازم‌اند می‌تواند تغییر کند.",
    "top-k|top-p": "top-k ابتدا گزینه‌ها را محدود و بازنرمال می‌کند؛ بنابراین nucleus روی مجموعه‌ای تازه ساخته می‌شود و ترتیب حیاتی است.",
    "context|retrieval": "بازیابی، قطعه‌های تازه را به context اضافه می‌کند؛ بودجه و truncation تعیین می‌کنند کدام قطعه واقعاً دیده شود.",
    "context|temperature": "context ابتدا logits خود مدل را عوض می‌کند و temperature فقط همان logits تازه را بازشکل می‌دهد؛ اثرها قابل‌جایگزینی نیستند.",
    "seed|effort": "اگر effort مسیرهای بیشتری بسازد، seed تعیین می‌کند کدام قرعه‌ها ساخته شوند؛ اما effort یک knob تصادفی ساده نیست.",
    "seed|retrieval": "seed انتخاب تصادفی توکن را کنترل می‌کند و retrieval top-k انتخاب سند را؛ در قرارداد قطعی retriever معمولاً مستقل‌اند.",
  };
  if (first === second) return labels[first] + " با خودش مقایسه شده است؛ خانه‌های قطر فقط محل همان knob را نشان می‌دهند.";
  return special[key] || labels[first] + " و " + labels[second] + " رابطهٔ «" + level + "» دارند؛ برای اندازه‌گیری اثر خالص، یکی را ثابت و دیگری را sweep کنید.";
}

function renderInteractionMatrix() {
  const table = $("#interaction-matrix");
  if (!table) return;
  table.innerHTML =
    "<thead><tr><th scope=\"col\">پارامتر</th>" +
    INTERACTION_AXES.map((item) => "<th scope=\"col\">" + escapeHtml(item.label) + "</th>").join("") +
    "</tr></thead><tbody>" +
    INTERACTION_AXES.map((row) =>
      "<tr><th scope=\"row\">" + escapeHtml(row.label) + "</th>" +
      INTERACTION_AXES.map((column) => {
        const level = interactionLevel(row.id, column.id);
        return (
          '<td><button type="button" class="interaction-cell" data-level="' +
          escapeHtml(level) +
          '" data-first="' + row.id + '" data-second="' + column.id +
          '" aria-label="رابطهٔ ' + escapeHtml(row.label) + " و " + escapeHtml(column.label) +
          ': ' + escapeHtml(level) + '">' + escapeHtml(level) + "</button></td>"
        );
      }).join("") + "</tr>",
    ).join("") + "</tbody>";
}

function samplingValue(id) {
  return Number($(id).value);
}

function samplingPayload() {
  const history = $("#sampling-history").value.trim();
  if (!/^[0-9]{0,64}$/.test(history)) throw new Error("تاریخچه باید فقط شامل ارقام لاتین 0 تا 9 باشد.");
  return {
    current_digit: samplingValue("#sampling-current-digit"),
    history,
    temperature: samplingValue("#sampling-temperature"),
    top_k: samplingValue("#sampling-top-k"),
    top_p: samplingValue("#sampling-top-p"),
    min_p: samplingValue("#sampling-min-p"),
    typical_p: samplingValue("#sampling-typical-p"),
    epsilon_cutoff: samplingValue("#sampling-epsilon"),
    eta_cutoff: samplingValue("#sampling-eta"),
    presence_penalty: samplingValue("#sampling-presence"),
    frequency_penalty: samplingValue("#sampling-frequency"),
    repetition_penalty: samplingValue("#sampling-repetition"),
    bias_digit: samplingValue("#sampling-bias-digit"),
    logit_bias: samplingValue("#sampling-bias"),
    seed: samplingValue("#sampling-seed"),
    sample_count: samplingValue("#sampling-count"),
  };
}

function setSamplingControl(id, value) {
  const input = $(id);
  if (input) input.value = String(value);
}

function updateSamplingOutputs() {
  const mappings = [
    ["#sampling-presence", "#sampling-presence-value", 2],
    ["#sampling-frequency", "#sampling-frequency-value", 2],
    ["#sampling-repetition", "#sampling-repetition-value", 2],
    ["#sampling-bias", "#sampling-bias-value", 2],
    ["#sampling-temperature", "#sampling-temperature-value", 2],
    ["#sampling-top-p", "#sampling-top-p-value", 2],
    ["#sampling-typical-p", "#sampling-typical-p-value", 2],
  ];
  mappings.forEach(([inputId, outputId, digits]) => {
    const value = samplingValue(inputId);
    $(outputId).textContent = faNumber(value, digits);
    $(inputId).setAttribute("aria-valuetext", faNumber(value, digits));
  });
  const disabledWhenZero = [
    ["#sampling-top-k", "#sampling-top-k-value", 0],
    ["#sampling-min-p", "#sampling-min-p-value", 2],
    ["#sampling-epsilon", "#sampling-epsilon-value", 3],
    ["#sampling-eta", "#sampling-eta-value", 3],
  ];
  disabledWhenZero.forEach(([inputId, outputId, digits]) => {
    const value = samplingValue(inputId);
    $(outputId).textContent = value === 0 ? "خاموش" : faNumber(value, digits);
    $(inputId).setAttribute("aria-valuetext", value === 0 ? "خاموش" : faNumber(value, digits));
  });
  $("#sampling-count-value").textContent = faNumber(samplingValue("#sampling-count"));
  $("#sampling-expected").textContent = faNumber((samplingValue("#sampling-current-digit") + 1) % 10);
}

function renderDigitChart(node, probabilities, selectedToken, expectedToken, counts = null) {
  const maximum = Math.max(...probabilities, 0.000001);
  node.innerHTML = probabilities.map((probability, index) => {
    const chosen = String(index) === String(selectedToken);
    const expected = Number(index) === Number(expectedToken);
    const percent = probability * 100;
    const height = probability > 0 ? Math.max(1.5, (probability / maximum) * 100) : 0;
    const valueLabel = counts ? faNumber(counts[index]) + " بار" : faNumber(percent, 2) + "٪";
    return (
      '<li class="digit-bar' + (chosen ? " chosen" : "") + (expected ? " expected" : "") +
      (probability === 0 ? " removed" : "") + '" style="--bar:' + height + '%"' +
      (chosen ? ' aria-current="true"' : "") + ' aria-label="رقم ' + faNumber(index) +
      "، " + valueLabel + '"><span class="digit-bar__track"><i></i></span><strong>' + index +
      "</strong><small>" + valueLabel + "</small></li>"
    );
  }).join("");
}

function renderSamplingStage(stageKey) {
  if (!state.samplingRun) return;
  const stage = state.samplingRun.stages.find((item) => item.key === stageKey) || state.samplingRun.stages[0];
  state.samplingStage = stage.key;
  $$("[data-sampling-stage]").forEach((button) => {
    const active = button.dataset.samplingStage === stage.key;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", String(active));
  });
  $("#sampling-stage-kind").textContent = stage.kind.toUpperCase().replaceAll("_", " ");
  $("#sampling-stage-title").textContent = stage.label;
  $("#sampling-stage-formula").textContent = stage.formula;
  $("#sampling-stage-explanation").textContent = stage.explanation;
  renderDigitChart(
    $("#sampling-stage-chart"),
    stage.values.map((value) => value.probability),
    state.samplingRun.result.selected_token,
    state.samplingRun.input.expected_successor,
  );
}

function renderSamplingRun(run) {
  state.samplingRun = run;
  const result = run.result;
  $("#sampling-expected-result").textContent = faNumber(run.input.expected_successor);
  $("#sampling-selected").textContent = result.selected_token;
  $("#sampling-draw").textContent = "u = " + Number(result.uniform_draw).toFixed(6) + " / " + result.rng_algorithm;
  $("#sampling-effective").textContent = faNumber(result.effective_choices, 2);
  $("#sampling-survivors").textContent = faNumber(result.survivors);
  renderDigitChart(
    $("#sampling-final-chart"),
    result.final_probabilities,
    result.selected_token,
    run.input.expected_successor,
  );
  renderDigitChart(
    $("#sampling-histogram"),
    result.empirical_probabilities,
    result.selected_token,
    run.input.expected_successor,
    result.histogram_counts,
  );
  $("#sampling-histogram-caption").textContent =
    "از " + faNumber(result.sample_count) + " draw روی یک snapshot؛ نه forward pass";
  const diversity = result.survivors === 1 ? "قطعی" : result.effective_choices < 3 ? "متمرکز" : result.effective_choices < 6 ? "متعادل" : "پراکنده";
  const match = String(result.selected_token) === String(run.input.expected_successor)
    ? "این قرعه با قلهٔ منبع یکی شد."
    : "این قرعه با وجود احتمال کمتر از قله فاصله گرفت؛ خطا نیست، معنای sampling است.";
  $("#sampling-insight").innerHTML =
    "توزیع <strong>" + diversity + "</strong> است؛ " + faNumber(result.survivors) +
    " رقم احتمال غیرصفر دارند. " + match;
  $("#sampling-flow").innerHTML = run.stages.map((stage, index) =>
    '<li><button type="button" data-sampling-stage="' + stage.key + '"><span>' +
    faNumber(index + 1) + "</span><strong>" + escapeHtml(stage.label) + "</strong><small>" +
    faNumber(stage.survivors) + " بازمانده · H=" + faNumber(stage.entropy_nats, 2) +
    "</small><i>" + (stage.changed ? "اثر کرد" : "خنثی") + "</i></button></li>",
  ).join("");
  const raw = run.stages.find((item) => item.key === "source");
  const adjusted = run.stages.find((item) => item.key === "repetition");
  $("#sampling-token-table tbody").innerHTML = run.vocabulary.map((token, index) => {
    const final = result.final_probabilities[index];
    return "<tr><th scope=\"row\">" + token + "</th><td>" + faNumber(raw.values[index].logit, 4) +
      "</td><td>" + faNumber(adjusted.values[index].logit, 4) + "</td><td>" +
      faNumber(final * 100, 4) + "%</td><td>" + (final > 0 ? "باقی" : "حذف") + "</td></tr>";
  }).join("");
  $("#sampling-warnings").innerHTML = run.warnings.map((warning) => "<p>⚑ " + escapeHtml(warning) + "</p>").join("");
  renderSamplingStage(state.samplingStage);
}

async function runSamplingLab(event) {
  event?.preventDefault();
  const viewport = $("#sampling-viewport");
  const status = $("#sampling-run-status");
  try {
    state.samplingAbort?.abort();
    state.samplingAbort = new AbortController();
    viewport.setAttribute("aria-busy", "true");
    status.textContent = "در حال عبور توزیع از ده مرحله…";
    status.className = "sampling-run-status running";
    const run = await jsonFetch("/api/sampling-lab", {
      method: "POST",
      body: JSON.stringify(samplingPayload()),
      signal: state.samplingAbort.signal,
    });
    renderSamplingRun(run);
    status.textContent = "محاسبه شد: " + faNumber(run.result.survivors) + " گزینهٔ نهایی، نمونهٔ «" + run.result.selected_token + "»";
    status.className = "sampling-run-status ready";
  } catch (error) {
    if (error.name === "AbortError") return;
    status.textContent = error.message || "محاسبه ناموفق بود.";
    status.className = "sampling-run-status error";
  } finally {
    viewport.setAttribute("aria-busy", "false");
  }
}

const SAMPLING_PRESETS = {
  deterministic: { temperature: 0, top_k: 0, top_p: 1, min_p: 0, typical_p: 1, epsilon: 0, eta: 0, presence: 0, frequency: 0, repetition: 1, bias: 0 },
  balanced: { temperature: 0.8, top_k: 5, top_p: 0.9, min_p: 0, typical_p: 1, epsilon: 0, eta: 0, presence: 0, frequency: 0, repetition: 1, bias: 0 },
  creative: { temperature: 1.5, top_k: 0, top_p: 0.98, min_p: 0, typical_p: 1, epsilon: 0, eta: 0, presence: 0, frequency: 0, repetition: 1, bias: 0 },
  "anti-repeat": { temperature: 0.9, top_k: 6, top_p: 0.92, min_p: 0, typical_p: 1, epsilon: 0, eta: 0, presence: 0.8, frequency: 0.4, repetition: 1.2, bias: 0 },
  edge: { temperature: 1.2, top_k: 6, top_p: 0.65, min_p: 0.25, typical_p: 0.75, epsilon: 0.02, eta: 0.03, presence: 0, frequency: 0, repetition: 1, bias: 0 },
};

function applySamplingPreset(name) {
  const preset = SAMPLING_PRESETS[name];
  if (!preset) return;
  Object.entries({
    temperature: "#sampling-temperature", top_k: "#sampling-top-k", top_p: "#sampling-top-p",
    min_p: "#sampling-min-p", typical_p: "#sampling-typical-p", epsilon: "#sampling-epsilon",
    eta: "#sampling-eta", presence: "#sampling-presence", frequency: "#sampling-frequency",
    repetition: "#sampling-repetition", bias: "#sampling-bias",
  }).forEach(([key, selector]) => setSamplingControl(selector, preset[key]));
  $$('[data-sampling-preset]').forEach((button) => button.classList.toggle("selected", button.dataset.samplingPreset === name));
  updateSamplingOutputs();
  runSamplingLab();
}

function activateSamplingTab(button, focus = false) {
  $$("#sampling-tabs [role=tab]").forEach((tab) => {
    const active = tab === button;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute("aria-controls"));
    if (panel) panel.hidden = !active;
  });
  if (focus) button.focus();
}

function initializeSamplingLab() {
  renderParameterAtlas();
  installSamplingControlInfo();
  renderInteractionMatrix();
  updateSamplingOutputs();
  $("#sampling-form").addEventListener("submit", runSamplingLab);
  $("#sampling-flow").addEventListener("click", (event) => {
    const button = event.target.closest("[data-sampling-stage]");
    if (button) renderSamplingStage(button.dataset.samplingStage);
  });
  $("#sampling-form").addEventListener("input", () => {
    updateSamplingOutputs();
    $("#sampling-run-status").textContent = "مقادیر تغییر کرده‌اند؛ برای trace تازه محاسبه کنید.";
  });
  $("#sampling-form").addEventListener("change", (event) => {
    if (event.target.matches("input, select")) runSamplingLab();
  });
  $$('[data-sampling-preset]').forEach((button) => button.addEventListener("click", () => applySamplingPreset(button.dataset.samplingPreset)));
  $$("#sampling-tabs [role=tab]").forEach((button) => {
    button.addEventListener("click", () => activateSamplingTab(button));
    button.addEventListener("keydown", (event) => {
      const tabs = $$("#sampling-tabs [role=tab]");
      const current = tabs.indexOf(button);
      let next = null;
      if (["ArrowLeft", "ArrowDown"].includes(event.key)) next = (current + 1) % tabs.length;
      if (["ArrowRight", "ArrowUp"].includes(event.key)) next = (current - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next != null) {
        event.preventDefault();
        activateSamplingTab(tabs[next], true);
      }
    });
  });
  $("#interaction-matrix").addEventListener("click", (event) => {
    const button = event.target.closest(".interaction-cell");
    if (!button) return;
    $$(".interaction-cell").forEach((cell) => cell.classList.toggle("selected", cell === button));
    $("#interaction-note").textContent = interactionExplanation(button.dataset.first, button.dataset.second, button.dataset.level);
  });
  runSamplingLab();
}

async function loadStatus() {
  const nodeValue = $("#system-state");
  try {
    const status = await jsonFetch("/api/status");
    state.status = status;
    nodeValue.className = "system-state ready";
    nodeValue.lastElementChild.textContent =
      faNumber(status.models_ready || 0) + " مدل آماده / SQLite متصل";
    if (status.default_sample) {
      $("#expression").value = status.default_sample.expression;
      $("#input-expression").textContent = status.default_sample.expression;
      Object.entries(status.default_sample.facts || {}).forEach(([name, value]) => {
        const input = $('[data-fact="' + name + '"]');
        if (input) input.value = value;
      });
    }
    renderComparison(status.comparison || []);
    renderEffort(status.effort_comparison || []);
    renderTrainingOrigin(status);
    renderJourneyStage("problem", preview());
  } catch (_error) {
    nodeValue.className = "system-state error";
    nodeValue.lastElementChild.textContent = "سرویس در دسترس نیست";
  }
}

$$(".arch").forEach((button) =>
  button.addEventListener("click", () => {
    state.model = button.dataset.model;
    $$(".arch").forEach((item) => {
      const selected = item.dataset.model === state.model;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    if (!state.run) renderJourneyStage(state.stage, preview());
    markStale();
  }),
);

$$("#mode-select button").forEach((button) =>
  button.addEventListener("click", () => {
    state.mode = button.dataset.value;
    choose($("#mode-select"), state.mode);
    syncControlApplicability();
    if (!state.run) renderJourneyStage(state.stage, preview());
    markStale();
  }),
);

$$("#effort-select button").forEach((button) =>
  button.addEventListener("click", () => {
    state.effort = button.dataset.value;
    choose($("#effort-select"), state.effort);
    if (!state.run) renderJourneyStage(state.stage, preview());
    markStale();
  }),
);

$$("#journey-rail button").forEach((button) =>
  button.addEventListener("click", () => renderJourneyStage(button.dataset.journey)),
);

$$("#pipeline .pipe-node").forEach((button) =>
  button.addEventListener("click", () => {
    renderJourneyStage(button.dataset.stage);
    $("#journey-detail").focus({ preventScroll: true });
    $("#journey-heading").scrollIntoView({ behavior: "smooth", block: "start" });
  }),
);

function activateTab(button, focus = false) {
  $$("#telemetry-tabs button").forEach((tab) => {
    const active = tab === button;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  $$(".tab-panel").forEach((panel) => {
    const active = panel.dataset.panel === button.dataset.tab;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  if (focus) button.focus();
}

$$("#telemetry-tabs button").forEach((button) => {
  button.addEventListener("click", () => activateTab(button));
  button.addEventListener("keydown", (event) => {
    const tabs = $$("#telemetry-tabs button");
    const current = tabs.indexOf(button);
    let next = null;
    if (["ArrowLeft", "ArrowDown"].includes(event.key)) next = (current + 1) % tabs.length;
    if (["ArrowRight", "ArrowUp"].includes(event.key)) next = (current - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next != null) {
      event.preventDefault();
      activateTab(tabs[next], true);
    }
  });
});

$$("#method-filters button").forEach((button) =>
  button.addEventListener("click", () => {
    $$("#method-filters button").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    renderMethods(button.dataset.methodFilter);
  }),
);

$("#method-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-method-id]");
  if (button) renderMethodDetail(button.dataset.methodId, true);
});

$$("[data-fact], #expression").forEach((input) =>
  input.addEventListener("input", () => {
    if (!state.run) renderJourneyStage("problem", preview());
    markStale();
  }),
);

$("#run-button").addEventListener("click", runExperiment);
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "Enter") runExperiment();
});

installSectionInfo();
renderMethods();
initializeSamplingLab();
renderJourneyStage("problem", preview());
syncControlApplicability();
loadStatus();
