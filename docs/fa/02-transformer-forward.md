# مسیر ریاضی و کدِ Transformer

پیکربندی canonical:

```text
vocab=10, context=8, d_model=32, heads=4, layers=2, d_ff=64, dropout=0
parameters=18,048
```

برای batch با اندازهٔ `B` و طول context برابر `T`، ورودی shape `[B,T]` و logits shape
`[B,T,10]` دارد.

## ۱. embedding

دو جدول trainable داریم:

```text
token_embedding:    [10, 32]
position_embedding: [ 8, 32]
```

در `DigitTransformer.forward`:

```text
x[b,t] = E_token[input_id[b,t]] + E_position[t]
```

رقم معنای عددی ذاتی ندارد. ID هفت فقط index ردیف هفتم embedding است؛ معماری به‌طور پیش‌فرض
نمی‌داند ۷ از ۶ بزرگ‌تر است. این نکته علت اصلی شکست محتمل روی mapping ندیده است.

## ۲. Q، K و V

در هر block، ابتدا pre-LayerNorm و یک projection مشترک انجام می‌شود:

```text
[Q | K | V] = Linear(LayerNorm(x))
```

خروجی `[B,T,96]` به سه tensor `[B,T,32]` شکسته و سپس به چهار head تبدیل می‌شود:

```text
Q,K,V: [B, 4, T, 8]
```

هر head فضای هشت‌بُعدی خود را دارد، ولی projectionهای آن بخشی از همان ماتریس trainable هستند.

## ۳. scaled dot-product و causal mask

کد معادل فرمول زیر است:

```text
S = QKᵀ / √8
A = softmax(mask(S))
H = AV
```

`causal_mask` یک مثلث پایین بولی `[8,8]` است. خانه‌های بالای قطر قبل از softmax با کمترین عدد
قابل نمایش dtype جایگزین می‌شوند؛ probability آن‌ها صفر می‌شود. تست `test_model.py` دو چیز را
اثبات می‌کند:

1. مجموع هر ردیف attention تقریباً یک است؛
2. تغییر token آینده، logit موقعیت قبل را حتی یک bit تغییر نمی‌دهد.

برای `T=1` تنها key قابل مشاهده همان token است، پس softmax یک عدد همیشه `[[1.0]]` می‌شود.
این وزن هیچ توضیحی دربارهٔ انتخاب successor نمی‌دهد. در مرحلهٔ دوم generation، `T=2` است و
ردیف query آخر می‌تواند بین prompt و token تولیدشدهٔ اول تقسیم شود.

## ۴. residual و MLP

هر block pre-norm است:

```text
x = x + Attention(LN₁(x))
x = x + Linear₂(GELU(Linear₁(LN₂(x))))
```

MLP از ۳۲ به ۶۴ بُعد گسترش و دوباره به ۳۲ برمی‌گردد. GELU gate نرم ایجاد می‌کند. `dropout=0`
است تا اجرای golden روی CPU deterministic باشد؛ ماژول dropout همچنان در کد وجود دارد تا نقش آن
دیده شود.

trace برای هر block این tensorها را ثبت می‌کند:

- input نرمال‌شدهٔ attention؛
- Q/K/V، score قبل از mask، mask و weight؛
- residual بعد از attention؛
- مقدار MLP قبل و بعد GELU؛
- خروجی MLP و residual بعد block.

## ۵. LayerNorm نهایی و unembedding

پس از دو block:

```text
h = LayerNorm(x)
logits = h W_vocabᵀ
```

`W_vocab` shape `[10,32]` دارد و bias ندارد. برای token انتخاب‌شده، ضرب element-wise
`h[j] * W[token,j]` سهم مستقیم هر بُعد را می‌دهد؛ جمع ۳۲ سهم دقیقاً logit را بازسازی می‌کند.
UI هشت سهم با قدر مطلق بزرگ‌تر را در JSON trace نگه می‌دارد.

وزن LM head با embedding مشترک نیست. untied بودن دو فایدهٔ آموزشی دارد: نقش «خواندن token» و
«نوشتن token» جداست، و contribution به logit مستقیم‌تر دیده می‌شود.

## ۶. loss

`CrossEntropyLoss` برای هر موقعیت، log-softmax و negative log-likelihood target را یکجا محاسبه
می‌کند:

```text
L = - mean(log softmax(logits)[target])
```

در pretraining همهٔ هشت position loss دارند. در SFT نیز دو position loss دارند، اما input آن‌ها
با teacher forcing ساخته می‌شود؛ جزئیات در سند آموزش است.

## ۷. trace با forward یکی است، ولی توضیح علّی نیست

اعداد trace از همان forward واقعی می‌آیند و مدل موازی یا surrogate وجود ندارد. با این حال:

- attention وزن ارتباط محاسباتی است، نه دلیل انسانی؛
- gradient محلی و حساس به نقطه است؛
- logit lens یک projection تشخیصی با final norm/head است؛
- activation بزرگ به‌تنهایی مفهوم قابل نام‌گذاری ثابت نمی‌سازد.

این ابزارها برای مشاهده و طرح فرضیه‌اند؛ کنترل causal نیازمند intervention جداگانه روی activation
و اندازه‌گیری خروجی است.
