# جهت طراحی رابط

## موضع زیبایی‌شناختی

**میز ابزار آنالوگِ آزمایشگاه محاسباتی**؛ غالباً industrial/utilitarian با یک لایهٔ editorial.
هدف رابط exploratory است: کاربر باید یک رقم را وارد کند و بلافاصله مسیر محاسبه را از readout تا
probability، attention و SQLite دنبال کند.

## DFII

| بُعد | امتیاز |
|---|---:|
| اثر بصری | ۴ |
| تناسب با موضوع | ۵ |
| امکان اجرای پاک | ۴ |
| ایمنی عملکرد | ۵ |
| ریسک ثبات | ۳- |
| **مجموع** | **۱۵** |

## سیستم طراحی

- تایپ فارسی: Vazirmatn؛ داده و machine labels: IBM Plex Mono؛
- رنگ غالب: کاغذ مهندسی و جوهر graphite؛
- accent: نارنجی سیگنال؛ phosphor سبز فقط برای readout و مقدار مثبت؛
- spacing بر پایهٔ ۰٫۴، ۰٫۷۵، ۱٫۲۵، ۲ و ۳٫۵ rem؛
- motion: یک entrance و یک pulse مسیر سیگنال؛ با reduced-motion خاموش می‌شود؛
- no framework و no build step؛ HTML semantic، CSS variables و JavaScript مستقیم.

## لنگر متمایز

ریل ده‌رقمی و دو readout متصل با signal path. بدون لوگو نیز screenshot باید شبیه دستگاه اندازه‌گیری
یک جهان ده‌نشانه‌ای شناخته شود، نه dashboard یک SaaS.

این طراحی از UI عمومی AI دور می‌ماند: chat bubble، gradient بنفش، cardهای گرد متقارن و layout
template ندارد؛ در عوض رابطهٔ causal و ابزار اندازه‌گیری را شکل اصلی صفحه می‌کند.

## دسترس‌پذیری و performance

- کنترل با صفحه‌کلید ارقام و focus-visible؛
- live region برای state و نتیجه؛
- contrast بالا و متن توضیحی کنار رنگ؛
- responsive در ۹۸۰ و ۶۸۰ پیکسل؛
- `prefers-reduced-motion`؛
- بدون canvas/WebGL و dependency frontend؛
- font remote در صورت دسترسی و fallback محلی در حالت offline.
