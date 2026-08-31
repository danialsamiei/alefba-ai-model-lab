# Third-Party Notices

این محصول از اجزای متن‌باز زیر استفاده می‌کند. این فایل یک فهرست مهندسی از
dependencyهای مستقیم و دارایی‌های بسته‌شده است و جای متن حقوقی کامل هر مجوز را
نمی‌گیرد. نام پروژه‌ها و مدل‌ها متعلق به صاحبان مربوطه است و ذکر آن‌ها به معنی
تأیید یا وابستگی رسمی نیست.

## Runtime and build stack

| Component | Version used | Role | License | Official source / license |
|---|---:|---|---|---|
| Electron | 44.0.0 | Windows desktop runtime | MIT | [repository](https://github.com/electron/electron) · [license](https://github.com/electron/electron/blob/main/LICENSE) |
| Three.js | 0.185.1 | WebGL 3D rendering | MIT | [repository](https://github.com/mrdoob/three.js) · [license](https://github.com/mrdoob/three.js/blob/dev/LICENSE) |
| Vite | 8.2.2 | renderer build tooling | MIT | [repository](https://github.com/vitejs/vite) · [license](https://github.com/vitejs/vite/blob/main/LICENSE) |
| electron-builder | 26.15.3 | Windows portable packaging | MIT | [repository](https://github.com/electron-userland/electron-builder) · [license](https://github.com/electron-userland/electron-builder/blob/master/LICENSE) |
| Fontsource packages | 5.3.0 | local CSS/font packaging | MIT for Fontsource tooling; font licenses below | [repository](https://github.com/fontsource/fontsource) · [license](https://github.com/fontsource/fontsource/blob/main/LICENSE) |

Electron distributes Chromium, Node.js and other third-party components. The
Electron binary distribution contains its own notices, including
`LICENSE.electron.txt` and `LICENSES.chromium.html`; those generated files are
the authoritative detailed notices for the exact bundled runtime.

## Bundled fonts

| Font package | Font | License | Copyright / official license |
|---|---|---|---|
| `@fontsource/ibm-plex-mono` 5.3.0 | IBM Plex Mono | SIL Open Font License 1.1; reserved font name “Plex” | Copyright © 2017 IBM Corp. · [OFL text](https://github.com/IBM/plex/blob/master/LICENSE.txt) |
| `@fontsource-variable/noto-kufi-arabic` 5.3.0 | Noto Kufi Arabic | SIL Open Font License 1.1 | Copyright 2022 The Noto Project Authors · [OFL text](https://github.com/google/fonts/blob/main/ofl/notokufiarabic/OFL.txt) |
| `@fontsource-variable/vazirmatn` 5.3.0 | Vazirmatn | SIL Open Font License 1.1 | The Vazirmatn project contributors · [OFL text](https://github.com/rastikerdar/vazirmatn/blob/master/OFL.txt) |

فونت‌ها به‌صورت محلی بسته می‌شوند و در زمان اجرا از CDN دریافت نمی‌شوند. مطابق
OFL، متن مجوز و اعلان copyright باید هنگام توزیع حفظ شوند و نام‌های رزروشده در
نسخه‌های تغییریافته بدون مجوز مربوطه استفاده نشوند.

متن کامل مجوزهای همین سه بسته و مجوز MIT خود برنامه در خروجی portable، بیرون
از ASAR و در پوشهٔ `resources/licenses/` قرار می‌گیرند تا همراه artifact قابل
بازرسی باشند.

## Model and research references are not bundled dependencies

نام‌هایی مانند DeepSeek، Llama، Qwen، Mistral، Stable Diffusion، FLUX،
HunyuanVideo، CogVideoX، Wan، Whisper، EnCodec، AudioCraft، StarCoder و دیگر
پروژه‌های موجود در catalog فقط موضوع آموزشی و لینک منبع‌اند. کد، checkpoint،
dataset یا وزن آن‌ها در EXE بسته نمی‌شود. مجوز هر یک از این چهار سطح باید جدا
بررسی شود:

1. کد repository؛
2. فایل وزن/checkpoint؛
3. دادهٔ آموزش یا دادهٔ ورودی؛
4. شرایط استفاده و توزیع خروجی.

برای فهرست منبع هر مفهوم به `src/catalog.js` و پنل «منبع» داخل برنامه مراجعه
کنید. متن `license` هر کارت یک یادآوری آموزشی است و نباید به‌عنوان مشاورهٔ حقوقی
یا جایگزین متن رسمی مجوز تلقی شود.

## Dependency closure

نسخه‌های بالا از `package.json` گرفته شده‌اند. dependencyهای transitively resolved
در `package-lock.json` ثبت می‌شوند؛ در بازبینی هر release باید lockfile، فهرست
مجوزهای تولیدشدهٔ Electron و محتوای artifact همان release ممیزی شود. اگر نسخه‌ای
تغییر کرد، این فایل و `src/catalog.js` باید هم‌زمان به‌روزرسانی شوند.
