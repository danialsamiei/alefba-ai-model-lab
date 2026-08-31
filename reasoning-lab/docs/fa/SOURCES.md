# منابع اولیه و رسمی

تاریخ بازبینی وب: `2026-08-31`

## سیاست انتخاب منبع

این فهرست فقط شامل یکی از این دو نوع منبع است:

- مقالهٔ اصلی نویسندگان روش در بایگانی یا مجموعه‌مقالات رسمی؛
- مستند رسمی ارائه‌دهنده برای رفتار API همان ارائه‌دهنده.

مستند یک API برای تعریف علمی عمومی استفاده نمی‌شود و نتیجهٔ یک مقاله نیز بدون آزمایش محلی به
پروژه نسبت داده نمی‌شود. خلاصه‌های زیر بازنویسی‌اند و نقل‌قول طولانی از منابع نیستند.

## فهرست منابع

### SRC-TTC-01 — مقیاس‌دهی محاسبهٔ زمان آزمون

- عنوان: *Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters*
- نویسندگان: Charlie Snell, Jaehoon Lee, Kelvin Xu, Aviral Kumar
- محل: مقالهٔ اصلی؛ نسخهٔ arXiv و انتشار کنفرانسی
- URL: <https://arxiv.org/abs/2408.03314>
- کاربرد در این پروژه: تعریف test-time compute، جست‌وجو/ارزیابی چند مسیر، تخصیص تطبیقی بودجه و
  ضرورت مقایسهٔ کیفیت با هزینه.
- مرز استناد: نتایج مقاله برای مسئله‌ها و مدل‌های مطالعه‌شده است و موفقیت خودکار روی micro lab
  را تضمین نمی‌کند.

### SRC-OAI-REASONING-01 — رفتار reasoning در API OpenAI

- عنوان: *Reasoning models — OpenAI API documentation*
- ناشر: OpenAI
- URL: <https://developers.openai.com/api/docs/guides/reasoning>
- کاربرد در این پروژه: model-dependent بودن `reasoning.effort`، وجود reasoning token در usage،
  اشغال context، امکان response ناقص و تفاوت summary با raw reasoning token.
- مرز استناد: این منبع قرارداد API OpenAI را توصیف می‌کند؛ یک تعریف استاندارد برای همهٔ مدل‌ها
  یا الگوریتم قابل‌کپی برای پروژه نیست.

### SRC-OAI-REASONING-RELEASE-01 — نمونهٔ رسمی reasoning-time scaling

- عنوان: *Learning to reason with LLMs*
- ناشر: OpenAI
- URL: <https://openai.com/index/learning-to-reason-with-llms/>
- کاربرد در این پروژه: تفکیک train-time compute و test-time compute و سیاست رسمی عدم نمایش raw
  chain در خانوادهٔ موردبحث.
- مرز استناد: release رسمی محصول و پژوهش سازمان است؛ جایگزین مشخصات معماری یا بازتولید علمی
  کامل نیست.

### SRC-COT-01 — Chain-of-Thought prompting

- عنوان: *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models*
- نویسندگان: Jason Wei و همکاران
- URL: <https://arxiv.org/abs/2201.11903>
- صفحهٔ رسمی Google Research: <https://research.google/blog/language-models-perform-reasoning-via-chain-of-thought/>
- کاربرد در این پروژه: تعریف few-shot CoT به‌عنوان demonstration دارای مراحل میانی و مقایسه با
  direct prompting.
- مرز استناد: مقاله مزیت را در مدل‌های بزرگ و taskهای مشخص گزارش می‌کند؛ نباید همان اثر برای
  مدل کوچک فرض شود.

### SRC-SCRATCHPAD-01 — Scratchpad برای محاسبهٔ میانی

- عنوان: *Show Your Work: Scratchpads for Intermediate Computation with Language Models*
- نویسندگان: Maxwell Nye و همکاران
- URL رسمی Google Research:
  <https://research.google/pubs/show-your-work-scratchpads-for-intermediate-computation-with-language-models/>
- نسخهٔ مقاله: <https://arxiv.org/abs/2112.00114>
- کاربرد در این پروژه: تعریف scratchpad تولیدشده، آموزش traceهای میانی، حافظهٔ متنی و آزمون
  generalization طولی.
- مرز استناد: scratchpad خروجی مدل است و به‌تنهایی گزارش تضمین‌شده از سازوکار علّی داخلی نیست.

### SRC-COT-EMPIRICAL-01 — محدودیت تفسیر rationale

- عنوان: *Towards Understanding Chain-of-Thought Prompting: An Empirical Study of What Matters*
- نویسندگان: Boshi Wang و همکاران
- محل: ACL 2023؛ صفحهٔ رسمی Google Research
- URL:
  <https://research.google/pubs/towards-understanding-chain-of-thought-prompting-an-empirical-study-of-what-matters/>
- کاربرد در این پروژه: دلیل تجربی برای یکی‌ندانستن ظاهر یا درستی rationale با توضیح علّی کامل.
- مرز استناد: این مطالعه همهٔ روش‌های CoT و همهٔ مدل‌ها را پوشش نمی‌دهد.

### SRC-MOE-01 — Switch Transformer و sparse routing

- عنوان: *Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity*
- نویسندگان: William Fedus, Barret Zoph, Noam Shazeer
- محل: Journal of Machine Learning Research، جلد ۲۳، ۲۰۲۲
- URL: <https://www.jmlr.org/papers/v23/21-0998.html>
- PDF: <https://www.jmlr.org/papers/volume23/21-0998/21-0998.pdf>
- کاربرد در این پروژه: router softmax، top-k expert routing، top-1 Switch layer، load balancing،
  پارامتر کل در برابر پارامتر فعال و خطرهای پایداری.
- مرز استناد: مزایای scale و throughput مقاله به سخت‌افزار و مقیاس آن وابسته‌اند و برای مدل micro
  قابل‌ادعای مستقیم نیستند.

### SRC-RAG-01 — Retrieval-Augmented Generation

- عنوان: *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*
- نویسندگان: Patrick Lewis و همکاران
- محل: NeurIPS 2020
- URL رسمی:
  <https://proceedings.neurips.cc/paper_files/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html>
- کاربرد در این پروژه: ترکیب حافظهٔ parametric و non-parametric، retriever، index و conditioning
  مولد بر passage.
- مرز استناد: pipeline سادهٔ retrieve-then-prompt بازسازی دقیق آموزش differentiable مقاله نیست.

### SRC-TOOLFORMER-01 — یادگیری استفاده از API

- عنوان: *Toolformer: Language Models Can Teach Themselves to Use Tools*
- نویسندگان: Timo Schick و همکاران
- محل: NeurIPS 2023
- URL رسمی:
  <https://proceedings.neurips.cc/paper/2023/hash/d842425e4bf79ba039352da0f658a906-Abstract-Conference.html>
- کاربرد در این پروژه: تفکیک تصمیم دربارهٔ زمان call، انتخاب API، argument و واردکردن result در
  پیش‌بینی بعدی.
- مرز استناد: یک fallback نوشته‌شده در میزبان یا tool call اجباری، بازتولید قابلیت آموخته‌شدهٔ
  Toolformer نیست.

### SRC-REACT-01 — درهم‌تنیدن action و rationale

- عنوان: *ReAct: Synergizing Reasoning and Acting in Language Models*
- نویسندگان: Shunyu Yao و همکاران
- محل: ICLR 2023
- URL رسمی OpenReview: <https://openreview.net/forum?id=WE_vluYUL-X>
- کاربرد در این پروژه: طراحی trace جدا برای observation، action و rationale تولیدشده.
- مرز استناد: ReAct یک الگوی interaction است؛ وجود log action به‌تنهایی صحت reasoning یا ابزار را
  اثبات نمی‌کند.

### SRC-OAI-TOOLS-01 — قرارداد رسمی function calling

- عنوان: *Function calling — OpenAI API documentation*
- ناشر: OpenAI
- URL: <https://developers.openai.com/api/docs/guides/function-calling>
- کاربرد در این پروژه: حلقهٔ model/tool، `call_id`، اجرای application-side، بازگرداندن result،
  چند call و strict JSON schema.
- مرز استناد: این منبع رفتار API OpenAI است. پیاده‌سازی محلی باید executor، validation، timeout،
  مجوز و ثبت رویداد خود را داشته باشد.

## منابع Prompt و Decoding

این منابع پشتوانهٔ بخش تعاملی
[`05-prompt-decoding-parameters.md`](05-prompt-decoding-parameters.md) هستند. موتور محلی
تعریف‌های علمی را آموزش می‌دهد، اما قرارداد یک vendor را نسخهٔ جهانی معرفی نمی‌کند.

| شناسه | موضوع | منبع اولیه/رسمی | ادعای پشتیبانی‌شده | مرز |
|---|---|---|---|---|
| SRC-SOFTMAX-01 | Softmax | [PyTorch](https://docs.pytorch.org/docs/stable/generated/torch.nn.modules.activation.Softmax.html) | تبدیل score به مقادیر نامنفی با مجموع یک | softmax به‌تنهایی روش انتخاب نیست |
| SRC-HF-GEN-01 | Temperature، top-k، top-p، min-p، typical-p، repetition، length | [Hugging Face GenerationConfig](https://huggingface.co/docs/transformers/main/en/main_classes/text_generation) و [logits processors](https://huggingface.co/docs/transformers/main/en/internal/generation_utils) | semantics رسمی کتابخانه | رفتار همهٔ APIها نیست؛ در HF greedy با sampling خاموش جدا می‌شود |
| SRC-NUCLEUS-01 | Top-p | [Holtzman et al.، ICLR 2020](https://openreview.net/pdf?id=rygGQyrFvH) | کوچک‌ترین مجموعهٔ پویا با جرم تجمعی حداقل p | factuality یا کیفیت عمومی را تضمین نمی‌کند |
| SRC-MINP-01 | Min-p | [Nguyen et al.، ICLR 2025](https://arxiv.org/abs/2407.01082) | آستانهٔ نسبی به احتمال بهترین token | ادعای برتری عمومی محل بحث است |
| SRC-MINP-CRITIQUE-01 | بازتحلیل Min-p | [Peters & Martins 2025](https://arxiv.org/abs/2506.13681) | عدم تأیید برخی ادعاهای quality/diversity | نقد تجربی نیز تعریف الگوریتم را باطل نمی‌کند |
| SRC-TYPICAL-01 | Locally Typical | [Meister et al.، TACL 2023](https://aclanthology.org/2023.tacl-1.7/) | رتبه‌بندی بر پایهٔ فاصلهٔ information content و entropy | نتایج کیفیت محدود به ارزیابی مقاله‌اند |
| SRC-TRUNCATION-01 | Epsilon و Eta | [Hewitt et al.، Findings EMNLP 2022](https://aclanthology.org/2022.findings-emnlp.249/) | truncation و آستانهٔ سازگار با entropy | ترتیب محلی فیلترها قرارداد پروژه است |
| SRC-OAI-CHATPARAM-01 | Presence، frequency، logit bias، seed، stop | [OpenAI Chat API](https://developers.openai.com/api/reference/java/resources/chat/subresources/completions/methods/create) | رفتار پارامترهای همان API | نام، دامنه و پشتیبانی endpoint/model-specific است |
| SRC-OAI-RESPPARAM-01 | max output و logprobs | [OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create) | سقف خروجی و telemetry احتمالات در همان API | likelihood نمرهٔ حقیقت نیست |
| SRC-OAI-LATEST-01 | Reasoning effort و verbosity | [OpenAI latest model guide](https://developers.openai.com/api/docs/guides/latest-model) | کنترل‌های وابسته به مدل برای compute و سبک پاسخ | effort بیشتر تضمین صحت یا نمایش chain-of-thought نیست |
| SRC-REPRO-01 | Seed و بازتولیدپذیری | [PyTorch reproducibility](https://docs.pytorch.org/docs/stable/notes/randomness.html) | محدودیت تکرارپذیری میان نسخه/سخت‌افزار | PRNG محلی این پروژه فقط قرارداد خودش را تکرار می‌کند |
| SRC-GRAMMAR-01 | Grammar constrained decoding | [EMNLP 2023](https://aclanthology.org/2023.emnlp-main.674/) و [PICARD، EMNLP 2021](https://aclanthology.org/2021.emnlp-main.779/) | حذف tokenهای نامجاز در generation | اعتبار ساختار، درستی معنا را تضمین نمی‌کند |
| SRC-DPR-02 | Retrieval top-k | [Dense Passage Retrieval، EMNLP 2020](https://aclanthology.org/2020.emnlp-main.550/) | k passage بازیابی‌شده از corpus | با k token در sampling متفاوت است |

## منابع تکمیلی اطلس روش‌ها

این جدول منابع اولیه‌ای را ثبت می‌کند که برای بخش‌های تازهٔ
[`04-method-landscape.md`](04-method-landscape.md) به کار رفته‌اند. تعریف هر روش از مقاله
گرفته شده است؛ وضعیت اجرای محلی فقط از کد، آزمون و artifact خود پروژه تعیین می‌شود.

| شناسه | روش | مقالهٔ اصلی / proceedings | ادعای پشتیبانی‌شده |
|---|---|---|---|
| SRC-LSTM-01 | LSTM | [Long Short-Term Memory](https://doi.org/10.1162/neco.1997.9.8.1735) | state و gate برای جریان اطلاعات در دنباله |
| SRC-CONVSEQ-01 | ConvS2S | [ICML 2017](https://proceedings.mlr.press/v70/gehring17a.html) | مدل‌سازی دنباله با شبکهٔ کانولوشنی و موازی‌سازی آموزش |
| SRC-SEQ2SEQ-01 | Encoder–Decoder | [NeurIPS 2014](https://proceedings.neurips.cc/paper_files/paper/2014/hash/5a18e133cbf9f257297f410bb7eca942-Abstract.html) | encode ورودی و decode خروجی با دو شبکهٔ شرطی |
| SRC-TRANSFORMER-01 | Transformer | [NeurIPS 2017](https://proceedings.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html) | معماری مبتنی بر attention بدون recurrence/convolution |
| SRC-LONGFORMER-01 | Sparse attention | [Longformer](https://arxiv.org/abs/2004.05150) | پنجرهٔ محلی و اتصال global با رشد خطی |
| SRC-MAMBA-01 | Selective SSM | [Mamba](https://arxiv.org/abs/2312.00752) | انتقال state انتخابی و رشد خطی با طول دنباله |
| SRC-GQA-01 | GQA | [EMNLP 2023](https://aclanthology.org/2023.emnlp-main.298/) | اشتراک گروهی headهای key/value برای inference |
| SRC-FLASH-01 | FlashAttention | [NeurIPS 2022](https://proceedings.neurips.cc/paper_files/paper/2022/hash/67d57c32e20fd0a7a302cb81d36e40d5-Abstract.html) | attention دقیق IO-aware با tiling |
| SRC-SC-01 | Self-Consistency | [ICLR 2023](https://openreview.net/pdf?id=1PL1NIMMrw) | نمونه‌گیری چند مسیر و تجمیع پاسخ نهایی |
| SRC-TOT-01 | Tree of Thoughts | [NeurIPS 2023](https://proceedings.neurips.cc/paper/2023/hash/271db9922b8d1f4dd7aaef84ed5ac703-Abstract.html) | search شاخه‌ای، self-evaluation و backtracking |
| SRC-SPECULATIVE-01 | Speculative decoding | [ICML 2023](https://proceedings.mlr.press/v202/leviathan23a.html) | draft و تأیید موازی با حفظ توزیع target |
| SRC-DPR-01 | Dense retrieval | [EMNLP 2020](https://aclanthology.org/2020.emnlp-main.550/) | dual encoder و similarity برای بازیابی passage |
| SRC-RERANK-01 | Neural reranking | [Passage Re-ranking with BERT](https://arxiv.org/abs/1901.04085) | امتیازدهی مشترک query-passage پس از retrieval |
| SRC-RETRO-01 | Retrieval-enhanced LM | [ICML 2022](https://proceedings.mlr.press/v162/borgeaud22a.html) | conditioning مدل بر chunkهای بیرونی بازیابی‌شده |
| SRC-RLHF-01 | RLHF | [NeurIPS 2022](https://proceedings.neurips.cc/paper_files/paper/2022/hash/b1efde53be364a73914f58805a001731-Abstract.html) | SFT، reward model از رتبه‌بندی و policy optimization |
| SRC-DPO-01 | DPO | [NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/a85b405ed65c6477a4fe8302b5e06ce7-Abstract-Conference.html) | objective مستقیم preference بدون reward model جدا |
| SRC-LORA-01 | LoRA | [ICLR 2022](https://arxiv.org/abs/2106.09685) | backbone منجمد و به‌روزرسانی کم‌رتبه |
| SRC-QLORA-01 | QLoRA | [NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1feb87871436031bdc0f2beaa62a049b-Abstract.html) | adapter روی backbone منجمد 4-bit |
| SRC-DISTILL-01 | Distillation | [Hinton et al.](https://arxiv.org/abs/1503.02531) | انتقال توزیع نرم teacher به student |
| SRC-GPTQ-01 | Quantization | [GPTQ](https://arxiv.org/abs/2210.17323) | post-training weight quantization کم‌بیت |
| SRC-PICARD-01 | Constrained decoding | [EMNLP 2021](https://aclanthology.org/2021.emnlp-main.779/) | محدودسازی افزایشی خروجی autoregressive بر اساس parser |
| SRC-CLIP-01 | Multimodality | [ICML 2021](https://proceedings.mlr.press/v139/radford21a.html) | alignment contrastive تصویر و متن |

## قواعد ارجاع در اسناد و UI

1. شناسهٔ منبع باید کنار ادعای علمی یا قراردادی مهم قرار گیرد.
2. نتیجهٔ محلی فقط با run ID، dataset manifest، seed و artifact hash گزارش شود.
3. عبارت «مطابق مقاله» به معنی پیاده‌سازی کامل نیست؛ تفاوت‌های معماری و داده باید ذکر شوند.
4. مستند vendor فقط برای همان vendor معتبر است.
5. در صورت تغییر رفتار API، این سند باید با تاریخ دسترسی تازه بازبینی شود.
