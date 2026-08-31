const AS_OF = "2026-08-31";

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
};

const SOURCE_AUTHORITY = Object.freeze({
  "research-paper": "primary-research",
  "technical-report": "first-party-technical-report",
  "research-repository": "research-artifact",
  "community-repository": "community-artifact",
  "official-docs": "first-party-documentation",
  "official-repository": "upstream-repository",
  specification: "maintainer-specification",
  "project-site": "project-declared",
});

const source = (id, title, url, type) => ({
  id,
  title,
  url,
  type,
  authority: SOURCE_AUTHORITY[type] ?? "unclassified",
});

const SOURCE_INDEX = {
  "alefba-system": source("alefba-system", "alef.ba — Open Semantic Infrastructure", "https://alef.ba/", "project-site"),
  "openai-sol": source("openai-sol", "GPT-5.6 Sol model card", "https://developers.openai.com/api/docs/models/gpt-5.6-sol", "official-docs"),
  "openai-latest-model": source("openai-latest-model", "Using GPT-5.6", "https://developers.openai.com/api/docs/guides/latest-model", "official-docs"),
  "openai-data": source("openai-data", "Your data — OpenAI API", "https://developers.openai.com/api/docs/guides/your-data", "official-docs"),
  "openai-optimization": source("openai-optimization", "Model optimization", "https://developers.openai.com/api/docs/guides/model-optimization", "official-docs"),
  "openai-rft": source("openai-rft", "Reinforcement fine-tuning", "https://developers.openai.com/api/docs/guides/reinforcement-fine-tuning", "official-docs"),
  "chatgpt-memory": source("chatgpt-memory", "Memories in ChatGPT and Codex", "https://learn.chatgpt.com/docs/customization/memories", "official-docs"),
  "chatgpt-overview": source("chatgpt-overview", "ChatGPT capabilities overview", "https://help.openai.com/en/articles/9260256-chatgpt-capabilities-overview", "official-docs"),
  "sora-2024": source("sora-2024", "Video generation models as world simulators", "https://openai.com/index/video-generation-models-as-world-simulators/", "technical-report"),
  "sora-2": source("sora-2", "Sora 2", "https://openai.com/index/sora-2/", "official-docs"),
  "openart-models": source("openart-models", "OpenArt AI models", "https://openart.ai/ai-model/", "official-docs"),
  "openart-mcp": source("openart-mcp", "OpenArt MCP", "https://openart.ai/mcp/", "official-docs"),
  "openart-training": source("openart-training", "OpenArt model training", "https://openart.ai/model_training", "official-docs"),
  "qwen3-paper": source("qwen3-paper", "Qwen3 Technical Report", "https://arxiv.org/abs/2505.09388", "research-paper"),
  "qwen3-blog": source("qwen3-blog", "Qwen3: Think Deeper, Act Faster", "https://qwenlm.github.io/blog/qwen3/", "official-docs"),
  "qwen3-repo": source("qwen3-repo", "Qwen3 repository", "https://github.com/QwenLM/Qwen3", "official-repository"),
  "qwen-agent-repo": source("qwen-agent-repo", "Qwen-Agent repository", "https://github.com/QwenLM/Qwen-Agent", "official-repository"),
  "deepseek-r1-paper": source("deepseek-r1-paper", "DeepSeek-R1 Technical Report", "https://arxiv.org/abs/2501.12948", "research-paper"),
  "deepseek-r1-repo": source("deepseek-r1-repo", "DeepSeek-R1 repository", "https://github.com/deepseek-ai/DeepSeek-R1", "official-repository"),
  "hermes-repo": source("hermes-repo", "Hermes Agent repository", "https://github.com/NousResearch/hermes-agent", "official-repository"),
  "hermes-architecture": source("hermes-architecture", "Hermes Agent architecture", "https://hermes-agent.nousresearch.com/docs/developer-guide/architecture", "official-docs"),
  "hermes-memory": source("hermes-memory", "Hermes Agent memory", "https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/", "official-docs"),
  "hermes-security": source("hermes-security", "Hermes Agent security", "https://hermes-agent.nousresearch.com/docs/user-guide/security/", "official-docs"),
  "codex-repo": source("codex-repo", "OpenAI Codex repository", "https://github.com/openai/codex", "official-repository"),
  "codex-rust": source("codex-rust", "Codex CLI Rust implementation", "https://github.com/openai/codex/blob/main/codex-rs/README.md", "official-repository"),
  "codex-agents-md": source("codex-agents-md", "Codex AGENTS.md guide", "https://learn.chatgpt.com/docs/agent-configuration/agents-md", "official-docs"),
  "claude-code-repo": source("claude-code-repo", "Claude Code repository", "https://github.com/anthropics/claude-code", "official-repository"),
  "claude-agent-loop": source("claude-agent-loop", "Claude Agent SDK loop", "https://code.claude.com/docs/en/agent-sdk/agent-loop", "official-docs"),
  "claude-code-operation": source("claude-code-operation", "How Claude Code works", "https://code.claude.com/docs/en/how-claude-code-works", "official-docs"),
  "claude-permissions": source("claude-permissions", "Claude Code permissions", "https://code.claude.com/docs/en/permissions", "official-docs"),
  "devin-intro": source("devin-intro", "Devin introduction", "https://docs.devin.ai/get-started/devin-intro", "official-docs"),
  "devin-architecture": source("devin-architecture", "Devin deployment architecture", "https://docs.devin.ai/enterprise/deployment/overview", "official-docs"),
  "devin-tools": source("devin-tools", "Devin session tools", "https://docs.devin.ai/work-with-devin/devin-session-tools", "official-docs"),
  "mirofish-repo": source("mirofish-repo", "MiroFish repository", "https://github.com/666ghj/MiroFish", "official-repository"),
  "comfy-docs": source("comfy-docs", "ComfyUI documentation", "https://docs.comfy.org/", "official-docs"),
  "comfy-repo": source("comfy-repo", "ComfyUI repository", "https://github.com/Comfy-Org/ComfyUI", "official-repository"),
  "refusal-paper": source("refusal-paper", "Refusal in Language Models Is Mediated by a Single Direction", "https://arxiv.org/abs/2406.11717", "research-paper"),
  "refusal-repo": source("refusal-repo", "Refusal direction research repository", "https://github.com/andyrdt/refusal_direction", "research-repository"),
  "abliterator-repo": source("abliterator-repo", "Abliterator community implementation", "https://github.com/FailSpy/abliterator", "community-repository"),
  "instructgpt-paper": source("instructgpt-paper", "Training language models to follow instructions with human feedback", "https://arxiv.org/abs/2203.02155", "research-paper"),
  "dpo-paper": source("dpo-paper", "Direct Preference Optimization", "https://arxiv.org/abs/2305.18290", "research-paper"),
  "rag-paper": source("rag-paper", "Retrieval-Augmented Generation", "https://arxiv.org/abs/2005.11401", "research-paper"),
  "mcp-spec": source("mcp-spec", "Model Context Protocol specification", "https://modelcontextprotocol.io/specification/2026-07-28", "specification"),
  "a2a-spec": source("a2a-spec", "Agent2Agent Protocol specification", "https://a2a-protocol.org/latest/specification/", "specification"),
  "ag-ui-docs": source("ag-ui-docs", "AG-UI architecture", "https://docs.ag-ui.com/concepts/architecture", "specification"),
  "openapi-spec": source("openapi-spec", "OpenAPI Specification", "https://spec.openapis.org/oas/latest.html", "specification"),
  "jsonrpc-spec": source("jsonrpc-spec", "JSON-RPC 2.0 Specification", "https://www.jsonrpc.org/specification", "specification"),
  "otel-genai": source("otel-genai", "OpenTelemetry GenAI semantic conventions", "https://opentelemetry.io/docs/specs/semconv/gen-ai/", "specification"),
  "tensorflow-playground": source("tensorflow-playground", "TensorFlow Playground repository", "https://github.com/tensorflow/playground", "official-repository"),
  "transformer-explainer": source("transformer-explainer", "Transformer Explainer", "https://poloclub.github.io/transformer-explainer/", "project-site"),
  "transformer-explainer-paper": source("transformer-explainer-paper", "Transformer Explainer paper", "https://arxiv.org/abs/2408.04619", "research-paper"),
  "animated-llm-repo": source("animated-llm-repo", "AnimatedLLM repository", "https://github.com/kasnerz/animated-llm", "official-repository"),
  "animated-llm-paper": source("animated-llm-paper", "AnimatedLLM paper", "https://arxiv.org/abs/2601.04213", "research-paper"),
};

const docs = (...ids) => ids.map((id) => {
  const item = SOURCE_INDEX[id];
  if (!item) throw new Error(`Unknown research source: ${id}`);
  return item;
});

const profile = ({
  id,
  name,
  kind,
  evidenceStatus,
  sourceAvailability,
  summaryFa,
  publicBoundary,
  unknownBoundary,
  inferences = [],
  primaryDocs,
  facts = {},
  capabilities = [],
}) => ({
  id,
  name,
  kind,
  evidenceStatus,
  sourceAvailability,
  asOf: AS_OF,
  summaryFa,
  publicBoundary,
  unknownBoundary,
  inferences,
  primaryDocs,
  facts,
  capabilities,
});

export const PROGRAM_GOALS = deepFreeze({
  id: "alefba-international-research-program",
  kind: "program",
  evidenceStatus: "project-declared",
  asOf: AS_OF,
  titleFa: "برنامهٔ پژوهشی بین‌المللی alef.ba",
  goals: [
    {
      id: "teach-model-operation",
      titleFa: "آموزش شیوهٔ عملکرد مدل‌ها",
      outcomeFa: "نمایش مرحله‌به‌مرحلهٔ داده، آموزش، استنتاج، ابزار، حافظه و مرزهای دانسته/نادانسته.",
    },
    {
      id: "base-customization-framework",
      titleFa: "چارچوب پایه برای ساخت و سفارشی‌سازی",
      outcomeFa: "کمک به تصمیم فنی دربارهٔ مدل، داده، fine-tuning، RAG، harness، هزینه، ایمنی و بهره‌برداری.",
    },
    {
      id: "explain-alefba",
      titleFa: "تبیین فناوری alef.ba",
      outcomeFa: "نمایش زیرساخت معنایی باز، تعهدهای منبع‌پیوند و رسیدهای قابل‌ممیزی بدون نسبت‌دادن اختیار اجرایی به APIR.",
    },
  ],
  operatingLoop: [
    { id: "source", order: 1, titleFa: "SOURCE", actionFa: "اهداف، سیاست‌ها، تصمیم‌ها، شواهد و ابهام‌ها را با منشأ نگه می‌دارد.", outputFa: "source spans + fingerprint" },
    { id: "apir", order: 2, titleFa: "APIR", actionFa: "معنا را به تعهدهای canonical و source-linked تبدیل می‌کند.", outputFa: "typed commitments + required IDs" },
    { id: "pack", order: 3, titleFa: "PACK", actionFa: "برای مدل و harness اعلام‌شده، بسته‌ای بودجه‌بندی‌شده با حذف‌های صریح می‌سازد.", outputFa: "profile-bound candidate + omission ledger" },
    { id: "verify", order: 4, titleFa: "VERIFY", actionFa: "Integrity، Representation، Uptake و Outcome را جدا می‌سنجد و UNKNOWN را PASS نمی‌نامد.", outputFa: "semantic receipt + pass/fail/unknown" },
  ],
  boundaryFa: "APIR نمایش میانی معناست؛ پروتکل انتقال، مجوز اجرا، جایگزین MCP/API یا تضمین پذیرش مدل نیست.",
  primaryDocs: docs("alefba-system"),
});

export const RESEARCH_PROFILES = deepFreeze([
  profile({
    id: "gpt-5-6-sol",
    name: "GPT-5.6 Sol",
    kind: "model",
    evidenceStatus: "official-public",
    sourceAvailability: "public-docs-only",
    summaryFa: "مدل پرچم‌دار OpenAI با نام API برابر gpt-5.6؛ کنترل effort مربوط به استنتاج است و آموزش کاربر محسوب نمی‌شود.",
    publicBoundary: [
      "پنجرهٔ زمینهٔ ۱٬۰۵۰٬۰۰۰ توکن و سقف خروجی ۱۲۸٬۰۰۰ توکن در model card اعلام شده است.",
      "ورودی متن و تصویر، خروجی متن و مجموعه‌ای از ابزارهای میزبانی‌شده و MCP پشتیبانی می‌شوند.",
      "effortهای none، low، medium، high، xhigh و max در زمان استنتاج قابل انتخاب‌اند.",
      "fine-tuning برای این مدل در model card پشتیبانی‌نشده اعلام شده است.",
    ],
    unknownBoundary: [
      "تعداد پارامترها و چگال یا MoE بودن معماری عمومی نشده است.",
      "ترکیب دقیق داده، optimizer، برنامهٔ آموزش، reward model و جزئیات reasoning training عمومی نشده‌اند.",
      "زنجیرهٔ خصوصی فکر، planner داخلی و منطق دقیق تخصیص محاسبه از API قابل استنتاج نیست.",
    ],
    primaryDocs: docs("openai-sol", "openai-latest-model", "openai-data"),
    facts: {
      apiModelId: "gpt-5.6",
      contextWindowTokens: 1050000,
      maxOutputTokens: 128000,
      fineTuning: "unsupported",
      reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"],
    },
    capabilities: ["text", "vision-input", "reasoning-effort", "hosted-tools", "MCP"],
  }),
  profile({
    id: "chatgpt",
    name: "ChatGPT",
    kind: "product",
    evidenceStatus: "official-public",
    sourceAvailability: "public-docs-only",
    summaryFa: "محصول گفت‌وگویی OpenAI است که مدل، رابط، ابزار، فایل، پروژه و حافظه را ترکیب می‌کند؛ با یک checkpoint ثابت یکسان نیست.",
    publicBoundary: [
      "قابلیت‌های محصول می‌توانند شامل مرور وب، تحلیل فایل، تصویر، صدا و memory باشند.",
      "Memory یک لایهٔ ذخیره و بازیابی زمینه است و از قواعد سخت یا آموزش وزن‌ها جداست.",
    ],
    unknownBoundary: [
      "منطق دقیق routing میان مدل‌ها و ابزارها و همهٔ جزئیات runtime محصول عمومی نیست.",
      "وجود memory یا history به‌خودی‌خود نشان نمی‌دهد وزن مدل برای آن کاربر تغییر کرده است.",
    ],
    primaryDocs: docs("chatgpt-overview", "chatgpt-memory", "openai-data"),
    capabilities: ["conversation", "tools", "files", "memory", "multimodal-product"],
  }),
  profile({
    id: "sora-2024",
    name: "Sora (2024 technical report)",
    kind: "model",
    evidenceStatus: "official-public",
    sourceAvailability: "public-report-only",
    summaryFa: "گزارش پژوهشی ۲۰۲۴، Sora را diffusion transformer روی patchهای فضازمانیِ latent فشرده شرح می‌دهد.",
    publicBoundary: [
      "تصویر و ویدئوی با مدت، اندازه و نسبت‌های متفاوت به patchهای فضازمانی تبدیل می‌شوند.",
      "مدل در فضای latent فشرده نویززدایی می‌کند و با متن شرطی می‌شود.",
    ],
    unknownBoundary: [
      "گزارش صریحاً جزئیات کامل مدل و پیاده‌سازی را منتشر نمی‌کند.",
      "این گزارش مدرک معماری دقیق Sora 2 یا نسخه‌های بعدی نیست.",
    ],
    primaryDocs: docs("sora-2024"),
    capabilities: ["text-to-video", "image-to-video", "spacetime-patches", "diffusion-transformer"],
  }),
  profile({
    id: "sora-2",
    name: "Sora 2",
    kind: "model",
    evidenceStatus: "official-public",
    sourceAvailability: "public-docs-only",
    summaryFa: "نسل ویدئو و صوت OpenAI است که در سطح محصول به pretraining و post-training ویدئویی و کنترل‌پذیری بهتر اشاره شده است.",
    publicBoundary: [
      "تولید هماهنگ ویدئو و صدا و بهبود کنترل‌پذیری و تداوم نسبت به نسل قبلی اعلام شده است.",
      "OpenAI همچنان محدودیت‌های شبیه‌سازی فیزیک و خطاهای تولید را تصریح می‌کند.",
    ],
    unknownBoundary: [
      "معماری دقیق، اندازه، داده و برنامهٔ آموزش Sora 2 عمومی نشده است.",
      "نسبت‌دادن بدون مدرکِ تمام جزئیات معماری گزارش Sora 2024 به Sora 2 مجاز نیست.",
    ],
    primaryDocs: docs("sora-2", "sora-2024"),
    capabilities: ["video-generation", "audio-generation", "multimodal-conditioning"],
  }),
  profile({
    id: "openart",
    name: "OpenArt",
    kind: "platform",
    evidenceStatus: "vendor-documented",
    sourceAvailability: "public-docs-only",
    summaryFa: "پلتفرم و orchestrator چندمدلیِ تولید خلاق است، نه یک foundation model واحد.",
    publicBoundary: [
      "کاتالوگ مدل برای تصویر، ویدئو و رسانه‌های دیگر و یک MCP برای کشف مدل، ایجاد job و دریافت نتیجه مستند شده است.",
      "بخش training سفارشی از تصاویر کاربر برای ساخت مدل یا adapter شخصی استفاده می‌کند.",
    ],
    unknownBoundary: [
      "منطق دقیق routing، قرارداد تمام providerها و معماری همهٔ مدل‌های کاتالوگ عمومی نیست.",
      "ویژگی training یک محصول، معماری واحدی را برای کل OpenArt اثبات نمی‌کند.",
    ],
    primaryDocs: docs("openart-models", "openart-mcp", "openart-training"),
    capabilities: ["model-catalog", "generation-jobs", "creative-workspaces", "MCP", "custom-training"],
  }),
  profile({
    id: "qwen3",
    name: "Qwen3",
    kind: "model",
    evidenceStatus: "paper-and-source-backed",
    sourceAvailability: "open-weights",
    summaryFa: "خانوادهٔ open-weight شامل مدل‌های dense و MoE و حالت‌های thinking و non-thinking است.",
    publicBoundary: [
      "Qwen3-235B-A22B دارای ۲۳۵ میلیارد پارامتر کل و حدود ۲۲ میلیارد فعال در هر توکن است؛ Qwen3-30B-A3B نیز ۳۰/۳ میلیارد است.",
      "گزارش سه مرحلهٔ pretraining و چهار مرحلهٔ post-training شامل cold start، reasoning RL، fusion و general RL را شرح می‌دهد.",
      "Qwen-Agent پروژهٔ جداگانه‌ای برای tool calling، MCP، RAG و code interpreter است.",
    ],
    unknownBoundary: [
      "open-weight بودن به معنی انتشار کامل داده، فیلترها، pipeline و امکان بازتولید دقیق آموزش نیست.",
      "نتایج Qwen3 را نباید بدون منبع به Qwen3.5 یا نسل‌های دیگر تعمیم داد.",
    ],
    primaryDocs: docs("qwen3-paper", "qwen3-blog", "qwen3-repo", "qwen-agent-repo"),
    facts: { architectures: ["dense", "MoE"], thinkingModes: ["thinking", "non-thinking"] },
    capabilities: ["text", "reasoning", "tool-use", "multilingual", "open-weight"],
  }),
  profile({
    id: "deepseek-r1",
    name: "DeepSeek-R1",
    kind: "model",
    evidenceStatus: "paper-and-source-backed",
    sourceAvailability: "open-weights",
    summaryFa: "مدل reasoning مبتنی بر معماری DeepSeek-V3 با مسیر RL و نسخه‌های distill جداگانه است.",
    publicBoundary: [
      "R1-Zero با RL گسترده و بدون SFT مقدماتی، رفتارهای استدلالی نشان داد؛ R1 برای خوانایی و کیفیت از cold-start و آموزش چندمرحله‌ای استفاده کرد.",
      "مدل کامل ۶۷۱ میلیارد پارامتر کل و ۳۷ میلیارد پارامتر فعال در هر توکن دارد.",
      "مدل‌های distill روی خانواده‌های Qwen و Llama checkpointهای جدا از مدل کامل هستند.",
    ],
    unknownBoundary: [
      "نمایش trace متنی، دسترسی کامل به فرایند علّی یا ذهن مدل را تضمین نمی‌کند.",
      "فعال‌بودن ۳۷ میلیارد پارامتر به معنی نیاز ذخیره‌سازی فقط ۳۷ میلیارد وزن نیست.",
    ],
    inferences: ["برای اجرای CPU مصرف‌کننده، distill کوچک و quantized معمولاً عملی‌تر از checkpoint کامل است؛ این یک نتیجهٔ مهندسی است نه ادعای مقاله دربارهٔ سرعت هر دستگاه."],
    primaryDocs: docs("deepseek-r1-paper", "deepseek-r1-repo"),
    facts: { totalParametersBillions: 671, activeParametersBillions: 37, architecture: "MoE" },
    capabilities: ["reasoning", "MoE", "distillation", "open-weight"],
  }),
  profile({
    id: "hermes-agent",
    name: "Hermes Agent",
    kind: "harness",
    evidenceStatus: "official-source",
    sourceAvailability: "open-source",
    summaryFa: "نام دقیق پروژهٔ Nous Research، Hermes Agent است؛ فرمان `hermes` رابط CLI همان harness است.",
    publicBoundary: [
      "CLI، Gateway، ACP، batch/API به AIAgent مشترک متصل می‌شوند.",
      "prompt builder، provider resolver، tool registry، loop ابزار و session store مبتنی بر SQLite/FTS5 مستندند.",
      "MEMORY.md و USER.md به زمینه تزریق می‌شوند؛ این سازوکار training آنلاین وزن مدل نیست.",
    ],
    unknownBoundary: [
      "مدل provider و جزئیات آموزش وزن‌های آن خارج از معماری Hermes Agent است.",
      "ادعای self-improvement نباید بدون شاهد به خودتغییری وزن foundation model تعبیر شود.",
    ],
    primaryDocs: docs("hermes-repo", "hermes-architecture", "hermes-memory", "hermes-security"),
    facts: { cliCommand: "hermes", sessionStore: "SQLite + FTS5" },
    capabilities: ["agent-loop", "tools", "MCP", "memory", "gateway", "profiles"],
  }),
  profile({
    id: "codex-cli",
    name: "Codex CLI",
    kind: "harness",
    evidenceStatus: "official-source",
    sourceAvailability: "open-source",
    summaryFa: "عامل کدنویسی محلی OpenAI با پیاده‌سازی اصلی Rust؛ مدل سرویس از harness محلی جداست.",
    publicBoundary: [
      "executable مستقل، core، اجرای headless، TUI، CLI، MCP و AGENTS.md قابل مشاهده‌اند.",
      "sandboxهای read-only، workspace-write و danger-full-access و جریان approval در harness اعمال می‌شوند.",
    ],
    unknownBoundary: [
      "کد CLI معماری، وزن، داده یا برنامهٔ آموزش مدل اختصاصی را آشکار نمی‌کند.",
      "trace ابزار یا event stream معادل chain-of-thought خصوصی نیست.",
    ],
    primaryDocs: docs("codex-repo", "codex-rust", "codex-agents-md"),
    facts: { implementationLanguage: "Rust", license: "Apache-2.0" },
    capabilities: ["coding-agent", "sandbox", "approvals", "MCP", "project-instructions"],
  }),
  profile({
    id: "claude-code",
    name: "Claude Code",
    kind: "harness",
    evidenceStatus: "official-public",
    sourceAvailability: "mixed",
    summaryFa: "محصول و harness عامل کدنویسی Anthropic با حلقهٔ مستند مدل–ابزار، permission، hooks، MCP و subagent است.",
    publicBoundary: [
      "مدل context را ارزیابی می‌کند، tool call می‌سازد، SDK ابزار را اجرا می‌کند و نتیجه تا پایان حلقه بازمی‌گردد.",
      "CLAUDE.md، skills، MCP، subagents، compaction و permission modes مستندند.",
      "permission در harness اعمال می‌شود و با sandbox سیستم‌عامل یکسان نیست.",
    ],
    unknownBoundary: [
      "مخزن عمومی به‌تنهایی اثبات نمی‌کند تمام runtime محصول متن‌باز است.",
      "وزن، داده، planner و جزئیات آموزش Claude عمومی نیست.",
    ],
    primaryDocs: docs("claude-code-repo", "claude-agent-loop", "claude-code-operation", "claude-permissions"),
    capabilities: ["coding-agent", "tools", "hooks", "permissions", "MCP", "subagents"],
  }),
  profile({
    id: "devin",
    name: "Devin",
    kind: "product",
    evidenceStatus: "vendor-documented",
    sourceAvailability: "public-docs-only",
    summaryFa: "محصول عامل مهندسی نرم‌افزار Cognition با Brain ابری و Devbox ایزوله برای اجرای کد است.",
    publicBoundary: [
      "Brain به‌عنوان سرویس stateless در Cognition Cloud و Devbox به‌عنوان محیط مجازی اجرای کد مستند شده‌اند.",
      "Shell، IDE، Browser، دسکتاپ لینوکس، takeover و snapshot محیط در سطح محصول مستندند.",
    ],
    unknownBoundary: [
      "مدل پایه، prompt، planner، reward و منطق داخلی Brain اختصاصی و منتشرنشده‌اند.",
      "خودمختاری محصول نباید به معنای نبود sandbox، محدودیت یا نیاز به بازبینی فرض شود.",
    ],
    primaryDocs: docs("devin-intro", "devin-architecture", "devin-tools"),
    facts: { cloudComponent: "Brain", executionEnvironment: "Devbox" },
    capabilities: ["coding-agent", "shell", "IDE", "browser", "computer-use", "environment-snapshot"],
  }),
  profile({
    id: "mirofish",
    name: "MiroFish",
    kind: "program",
    evidenceStatus: "official-source",
    sourceAvailability: "open-source",
    summaryFa: "موتور شبیه‌سازی چندعاملی و GraphRAG برای rehearsal سناریو و تولید گزارش پیش‌بینی است.",
    publicBoundary: [
      "workflow رسمی شامل graph building، environment setup، multi-agent simulation، report generation و deep interaction است.",
      "پروژه از seed material، persona، حافظهٔ زمانی و OASIS برای شبیه‌سازی تعامل اجتماعی استفاده می‌کند.",
    ],
    unknownBoundary: [
      "خروجی شبیه‌سازی تضمین پیش‌بینی جهان واقعی یا جایگزین دادهٔ میدانی نیست.",
      "تعداد زیاد عامل، عدم‌قطعیت مدل، فرض‌های persona و وابستگی متقابل خطاها را حذف نمی‌کند.",
    ],
    primaryDocs: docs("mirofish-repo"),
    capabilities: ["multi-agent-simulation", "GraphRAG", "scenario-rehearsal", "prediction-report"],
  }),
  profile({
    id: "comfyui",
    name: "ComfyUI",
    kind: "harness",
    evidenceStatus: "official-source",
    sourceAvailability: "open-source",
    summaryFa: "رابط node-based و inference engine برای ساخت workflowهای مولد تصویر، ویدئو، صدا، 3D و متن است؛ خودِ یک مدل واحد نیست.",
    publicBoundary: [
      "node، link، workflow، custom node و API execution در مستندات رسمی تعریف شده‌اند.",
      "مدل‌ها و عملیات مختلف را می‌توان در گراف قابل ذخیره و تکرار ترکیب کرد.",
    ],
    unknownBoundary: [
      "رفتار و امنیت custom nodeهای ثالث از هستهٔ ComfyUI قابل تضمین نیست.",
      "وجود workflow به معنی انتشار، مجوز یا سازگاری همهٔ checkpointهای مورد استفاده نیست.",
    ],
    primaryDocs: docs("comfy-docs", "comfy-repo"),
    capabilities: ["node-graph", "inference-engine", "custom-nodes", "local-API", "multimodal-workflows"],
  }),
]);

export const LEARNING_STAGES = deepFreeze([
  { id: "pretraining", titleFa: "پیش‌آموزش", weightsChange: true, persistenceScope: "foundation-checkpoint", mechanismFa: "پیش‌بینی token یا objective پایه روی corpus بزرگ و به‌روزرسانی گستردهٔ وزن‌ها.", userDataFa: "مرحلهٔ سراسری و آفلاین است؛ گفتگو به‌صورت لحظه‌ای وارد وزن‌ها نمی‌شود.", primaryDocs: docs("qwen3-paper") },
  { id: "continued-pretraining", titleFa: "پیش‌آموزش ادامه‌دار", weightsChange: true, persistenceScope: "domain-checkpoint", mechanismFa: "ادامهٔ objective پایه روی زبان، دامنه یا context جدید.", userDataFa: "فقط dataset آماده‌شده و مجاز وارد training run می‌شود.", primaryDocs: docs("qwen3-paper") },
  { id: "supervised-fine-tuning", titleFa: "SFT", weightsChange: true, persistenceScope: "trained-checkpoint", mechanismFa: "به‌روزرسانی وزن با نمونه‌های ورودی و پاسخ مطلوب.", userDataFa: "دادهٔ نمونه باید انتخاب، پاک‌سازی، رضایت‌سنجی و ارزیابی شود.", primaryDocs: docs("instructgpt-paper", "openai-optimization") },
  { id: "preference-training", titleFa: "Preference training / RLHF / DPO", weightsChange: true, persistenceScope: "aligned-checkpoint", mechanismFa: "ترجیحات میان پاسخ‌ها با reward+RL یا loss مستقیم DPO رفتار checkpoint را تغییر می‌دهند.", userDataFa: "رأی یا feedback خام ابتدا باید به dataset کنترل‌شده تبدیل شود.", primaryDocs: docs("instructgpt-paper", "dpo-paper") },
  { id: "reasoning-training", titleFa: "Reasoning RL / RFT", weightsChange: true, persistenceScope: "reasoning-checkpoint", mechanismFa: "نمونه‌گیری پاسخ، امتیازدهی grader و update سیاست در training loop.", userDataFa: "این مرحلهٔ provider/developer است و با effort هنگام پاسخ‌گویی فرق دارد.", primaryDocs: docs("deepseek-r1-paper", "openai-rft") },
  { id: "distillation", titleFa: "Distillation", weightsChange: true, persistenceScope: "student-checkpoint", mechanismFa: "مدل دانش‌آموز از خروجی یا توزیع مدل آموزگار الگو می‌گیرد.", userDataFa: "خروجی آموزگار dataset آموزشی می‌شود؛ دانش‌آموز همان معماری یا ظرفیت آموزگار نیست.", primaryDocs: docs("deepseek-r1-paper") },
  { id: "peft-lora", titleFa: "PEFT / LoRA", weightsChange: true, persistenceScope: "adapter", mechanismFa: "پارامترهای adapter کم‌رتبه آموزش می‌بینند و وزن پایه معمولاً ثابت می‌ماند.", userDataFa: "اطلاعات سفارشی در adapter و dataset مرتبط ماندگار می‌شود، نه لزوماً در checkpoint پایه.", primaryDocs: docs("openart-training", "openai-optimization") },
  { id: "rag", titleFa: "RAG", weightsChange: false, persistenceScope: "request-or-index", mechanismFa: "سند مرتبط از index بازیابی و به context همان درخواست افزوده می‌شود.", userDataFa: "داده در corpus/index و prompt باقی می‌ماند؛ خودکار به وزن تبدیل نمی‌شود.", primaryDocs: docs("rag-paper") },
  { id: "in-context-learning", titleFa: "In-context learning", weightsChange: false, persistenceScope: "request", mechanismFa: "قاعده یا مثال در prompt رفتار همین inference را هدایت می‌کند.", userDataFa: "پس از خروج context اثری بر وزن ندارد، مگر جداگانه ذخیره یا برای training انتخاب شود.", primaryDocs: docs("openai-latest-model") },
  { id: "inference-reasoning", titleFa: "Inference-time reasoning / effort", weightsChange: false, persistenceScope: "response", mechanismFa: "مدل هنگام پاسخ محاسبه یا token استدلال بیشتری مصرف می‌کند.", userDataFa: "deep think یا effort شخصی‌سازی وزن نیست.", primaryDocs: docs("openai-sol", "openai-latest-model") },
  { id: "memory-personalization", titleFa: "Memory / personalization", weightsChange: false, persistenceScope: "user-or-project-store", mechanismFa: "واقعیت یا ترجیح بیرون مدل ذخیره و در جلسهٔ بعد به context تزریق می‌شود.", userDataFa: "قابل اصلاح/حذف و از training وزن‌ها جداست.", primaryDocs: docs("chatgpt-memory", "hermes-memory") },
  { id: "feedback-pipeline", titleFa: "Feedback / telemetry pipeline", weightsChange: false, persistenceScope: "future-training-candidate", mechanismFa: "رویداد یا بازخورد ممکن است با سیاست و رضایت به dataset آفلاین آینده تبدیل شود.", userDataFa: "ثبت feedback به معنی یادگیری فوری یا تضمین استفاده در آموزش نیست.", primaryDocs: docs("openai-data") },
]);

export const USER_DATA_LAYERS = deepFreeze([
  { id: "request", titleFa: "درخواست جاری", persistenceScope: "request", weightsChange: false, contentsFa: "prompt، تصویر یا فایل ارسال‌شده برای یک اجرا", injectionPoint: "model-context", boundaryFa: "retention و provider policy باید جدا گزارش شود." },
  { id: "session-history", titleFa: "تاریخچهٔ جلسه", persistenceScope: "session", weightsChange: false, contentsFa: "پیام‌ها، tool resultها و state اجرای جاری", injectionPoint: "context-assembly", boundaryFa: "compaction می‌تواند جزئیات را حذف یا خلاصه کند." },
  { id: "project-instructions", titleFa: "دستورهای پروژه و سازمان", persistenceScope: "project-or-organization", weightsChange: false, contentsFa: "سیاست، AGENTS.md، CLAUDE.md، profile و قرارداد خروجی", injectionPoint: "high-priority-context", boundaryFa: "دستور از مجوز اجرایی و کنترل سرور جداست." },
  { id: "retrieval-corpus", titleFa: "Corpus و RAG index", persistenceScope: "knowledge-store", weightsChange: false, contentsFa: "سند، embedding، metadata و provenance", injectionPoint: "retrieval-context", boundaryFa: "دادهٔ بازیابی‌شده untrusted است و نباید خودکار به system instruction ارتقا یابد." },
  { id: "saved-memory", titleFa: "حافظهٔ ذخیره‌شده", persistenceScope: "user-profile", weightsChange: false, contentsFa: "ترجیحات یا واقعیت‌های منتخب برای جلسات بعد", injectionPoint: "personalization-context", boundaryFa: "namespace، رضایت، اصلاح، حذف و جلوگیری از نشت بین کاربران لازم است." },
  { id: "workspace-and-tools", titleFa: "Workspace و ابزارها", persistenceScope: "external-system", weightsChange: false, contentsFa: "فایل، پایگاه داده، API و observation ابزار", injectionPoint: "tool-loop", boundaryFa: "مدل فقط دادهٔ ارائه‌شده را می‌بیند؛ harness مجوز و اثر جانبی را کنترل می‌کند." },
  { id: "fine-tuning-dataset", titleFa: "دادهٔ fine-tuning", persistenceScope: "training-dataset-and-checkpoint", weightsChange: true, contentsFa: "نمونه‌های پاک‌سازی‌شده برای training run مجاز", injectionPoint: "offline-training", boundaryFa: "پشتیبانی مدل، رضایت، provenance و جداسازی tenant باید اثبات شود؛ GPT-5.6 Sol پشتیبانی نمی‌شود." },
  { id: "telemetry-feedback", titleFa: "Telemetry و feedback", persistenceScope: "logs-or-future-dataset", weightsChange: false, contentsFa: "trace، امتیاز، خطا و بازخورد", injectionPoint: "evaluation-pipeline", boundaryFa: "ممکن است بعداً و فقط تحت سیاست مناسب به training data تبدیل شود؛ update فوری نیست." },
]);

export const AGENT_TOOL_PROFILES = deepFreeze([
  {
    id: "hermes-agent-tools", profileId: "hermes-agent", modelBoundaryFa: "provider قابل تعویض؛ harness از وزن جدا", agentLoopFa: "AIAgent مشترک با tool loop", toolInterfaceFa: "registry داخلی، MCP، terminal، browser و file", sandboxApprovalFa: "سطوح approval، محدودسازی فایل و container طبق تنظیم", contextMemoryFa: "prompt tiers، session store، MEMORY.md و USER.md", orchestrationFa: "Gateway، ACP، cron، plugins و trajectories", observabilityFa: "session persistence و trajectory؛ نه chain-of-thought", executionFa: "local core با provider محلی یا remote", opennessFa: "هارنس متن‌باز با مخزن عمومی", primaryDocs: docs("hermes-architecture", "hermes-security", "hermes-memory"),
  },
  {
    id: "codex-cli-tools", profileId: "codex-cli", modelBoundaryFa: "سرویس مدل از runtime Rust جدا", agentLoopFa: "core agent loop و exec/TUI frontends", toolInterfaceFa: "shell، file editing، MCP و ابزارهای میزبان", sandboxApprovalFa: "read-only/workspace-write/danger-full-access و approval", contextMemoryFa: "AGENTS.md، history و context مدیریت‌شده", orchestrationFa: "run محلی، exec غیرتعاملی و MCP client/server آزمایشی", observabilityFa: "event/session و command results؛ نه معماری محرمانهٔ مدل", executionFa: "local executable + remote model service", opennessFa: "open-source Apache-2.0", primaryDocs: docs("codex-rust", "codex-agents-md"),
  },
  {
    id: "claude-code-tools", profileId: "claude-code", modelBoundaryFa: "Claude model اختصاصی؛ harness و SDK قابل مشاهده", agentLoopFa: "model → tool call → execution/hook → observation → repeat", toolInterfaceFa: "Read/Edit/Write، Bash، web، MCP، skill و agent", sandboxApprovalFa: "allow/ask/deny در harness؛ sandbox مکمل", contextMemoryFa: "CLAUDE.md، history، skills، compaction و session", orchestrationFa: "subagents، teams، handoff و worktree طبق قابلیت محصول", observabilityFa: "session/usage/tool events؛ نه private reasoning", executionFa: "terminal/IDE با سرویس مدل", opennessFa: "mixed؛ اسناد و repo عمومی تمام runtime را اثبات نمی‌کنند", primaryDocs: docs("claude-agent-loop", "claude-code-operation", "claude-permissions"),
  },
  {
    id: "devin-tools", profileId: "devin", modelBoundaryFa: "Brain اختصاصی و مستندات سطح محصول", agentLoopFa: "جزئیات داخلی منتشر نشده؛ progress و takeover قابل مشاهده", toolInterfaceFa: "Shell، IDE، Browser و Linux desktop", sandboxApprovalFa: "Devbox مرز اجرای مجازی؛ policy داخلی کامل عمومی نیست", contextMemoryFa: "session state و blueprint/snapshot محیط", orchestrationFa: "جلسه‌های parallel و API در سطح محصول", observabilityFa: "progress logs، shell/IDE/browser evidence", executionFa: "Brain در Cognition Cloud + Devbox", opennessFa: "public docs only", primaryDocs: docs("devin-architecture", "devin-tools"),
  },
  {
    id: "qwen-agent-tools", profileId: "qwen3", modelBoundaryFa: "Qwen-Agent از model service جدا و با API سازگار قابل تعویض", agentLoopFa: "Agent base classes و function-call loop", toolInterfaceFa: "MCP، RAG، code interpreter و custom tool", sandboxApprovalFa: "code interpreter می‌تواند Docker داشته باشد؛ ابزارهای دیگر policy مستقل می‌خواهند", contextMemoryFa: "messages، files، RAG و تنظیم model", orchestrationFa: "agent classes و multi-agent patterns", observabilityFa: "streamed messages/tool results؛ نه علت کامل درونی وزن‌ها", executionFa: "DashScope یا مدل self-hosted", opennessFa: "open-source harness + open-weight options", primaryDocs: docs("qwen-agent-repo", "qwen3-repo"),
  },
]);

export const APPLICATION_PROFILES = deepFreeze([
  { id: "micro-next-token-lab", titleFa: "آزمایشگاه مدل عدد بعدی", inputFa: "tokenهای ۰ تا ۹ و dataset صریح", outputFa: "توزیع احتمال و token بعدی", workflow: ["داده", "tokenization", "forward", "loss", "backprop", "sampling", "آزمون خارج‌توزیع"], evidenceFa: "وزن، activation، gradient و خطا قابل مشاهده باشند.", guardrailFa: "مدل اسباب‌بازی با LLM پیشرفته یکسان معرفی نشود.", primaryDocs: docs("transformer-explainer-paper") },
  { id: "customization-decision", titleFa: "تصمیم ساخت یا سفارشی‌سازی", inputFa: "کاربرد، داده، بودجه، latency، privacy و risk", outputFa: "انتخاب prompt/RAG/adapter/fine-tune/model", workflow: ["تعریف eval", "baseline prompt", "RAG", "fine-tune در صورت پشتیبانی", "eval و rollback"], evidenceFa: "هر انتخاب به baseline و هزینهٔ کل متصل شود.", guardrailFa: "fine-tuning پشتیبانی‌نشده یا دادهٔ بدون مجوز رد شود.", primaryDocs: docs("openai-optimization") },
  { id: "rag-knowledge", titleFa: "دستیار دانش RAG", inputFa: "query و corpus منبع‌دار", outputFa: "پاسخ همراه شاهد", workflow: ["index", "retrieve", "rerank", "context pack", "generate", "citation check"], evidenceFa: "coverage، freshness و citation correctness سنجیده شود.", guardrailFa: "متن بازیابی‌شده دادهٔ untrusted است.", primaryDocs: docs("rag-paper") },
  { id: "prediction-simulation", titleFa: "پیش‌بینی و شبیه‌سازی سناریو", inputFa: "seed material، actorها و فرض‌ها", outputFa: "سناریوها، نشانه‌ها و گزارش قابل پرسش", workflow: ["graph building", "persona/environment", "simulation rounds", "report", "sensitivity rerun"], evidenceFa: "forecast با baseline، دادهٔ واقعی و خطای زمانی مقایسه شود.", guardrailFa: "شبیه‌سازی rehearsal است، نه پیشگویی یا تضمین تصمیم.", primaryDocs: docs("mirofish-repo") },
  { id: "monitoring", titleFa: "نظارت و مشاهده‌پذیری", inputFa: "event، trace، metric، policy و incident", outputFa: "هشدار و evidence trail", workflow: ["instrument", "redact", "aggregate", "detect", "triage", "verify"], evidenceFa: "trace IDs، replay و false-positive rate نگه‌داری شود.", guardrailFa: "monitoring مدل جای مجوز، کنترل دسترسی یا پاسخ‌گویی انسانی نیست.", primaryDocs: docs("otel-genai") },
  { id: "trend-analysis", titleFa: "تحلیل روند", inputFa: "سری زمانی، اسناد و provenance", outputFa: "روند، نقطهٔ تغییر و عدم‌قطعیت", workflow: ["normalize", "time-align", "retrieve evidence", "model hypotheses", "backtest", "report uncertainty"], evidenceFa: "data cutoff، leakage و revision history گزارش شود.", guardrailFa: "هم‌بستگی به‌عنوان علیت معرفی نشود.", primaryDocs: docs("mirofish-repo") },
  { id: "foresight", titleFa: "آینده‌پژوهی", inputFa: "drivers، uncertainties و alternative assumptions", outputFa: "چند سناریو و indicatorهای رصد", workflow: ["frame", "map drivers", "branch scenarios", "stress test", "derive indicators", "review"], evidenceFa: "فرض‌ها و تفاوت scenario با forecast صریح بماند.", guardrailFa: "یک روایت به‌عنوان آیندهٔ قطعی انتخاب نشود.", primaryDocs: docs("mirofish-repo") },
  { id: "coding-agent", titleFa: "عامل کدنویسی", inputFa: "هدف، repository، policy و test", outputFa: "patch، command evidence و review", workflow: ["inspect", "plan", "edit", "test", "review", "handoff"], evidenceFa: "diff، test result، sandbox و approval ثبت شود.", guardrailFa: "اثر جانبی بیرونی بدون مجوز مستقل انجام نشود.", primaryDocs: docs("codex-repo", "claude-agent-loop") },
  { id: "creative-pipeline", titleFa: "خط تولید تصویر/ویدئو/صدا/3D", inputFa: "prompt، reference، model و node graph", outputFa: "artifact و workflow قابل بازاجرا", workflow: ["select model", "condition", "sample/generate", "decode", "post-process", "record provenance"], evidenceFa: "seed، مدل، مجوز، node versions و synthetic label ثبت شود.", guardrailFa: "پلتفرم با مدل و custom node ثالث یکی گرفته نشود.", primaryDocs: docs("comfy-docs", "openart-models", "sora-2024") },
  { id: "alefba-semantic-compiler", titleFa: "کامپایل معنایی alef.ba", inputFa: "source context و profile اعلام‌شده", outputFa: "APIR، pack و semantic receipt", workflow: ["source", "APIR", "pack", "verify"], evidenceFa: "Integrity، Representation، Uptake و Outcome جدا گزارش شوند.", guardrailFa: "UNKNOWN هرگز PASS نشود و APIR اختیار اجرا تلقی نشود.", primaryDocs: docs("alefba-system") },
]);

export const PROTOCOL_PROFILES = deepFreeze([
  { id: "mcp", name: "Model Context Protocol", kind: "protocol", roleFa: "اتصال Host/Client به serverهای tool، resource و prompt", transportFa: "JSON-RPC روی transportهای مشخص", authorityBoundaryFa: "Host مسئول consent، authorization، isolation و policy است؛ schema ابزار خودِ مجوز نیست.", notEquivalentToFa: ["مدل", "عامل", "A2A", "APIR"], asOf: AS_OF, primaryDocs: docs("mcp-spec") },
  { id: "a2a", name: "Agent2Agent Protocol", kind: "protocol", roleFa: "کشف قابلیت و تبادل task/message/artifact میان عامل‌های مستقل", transportFa: "HTTP و قرارداد task lifecycle طبق specification", authorityBoundaryFa: "جزئیات داخلی عامل می‌تواند opaque بماند؛ identity و authorization همچنان لازم است.", notEquivalentToFa: ["MCP tool protocol", "agent harness"], asOf: AS_OF, primaryDocs: docs("a2a-spec") },
  { id: "ag-ui", name: "AG-UI", kind: "protocol", roleFa: "event protocol میان frontend و backend عامل برای state و interaction", transportFa: "جریان eventهای استاندارد", authorityBoundaryFa: "نمایش UI مجوز ابزار یا صحت تصمیم مدل را تضمین نمی‌کند.", notEquivalentToFa: ["مدل", "MCP", "A2A"], asOf: AS_OF, primaryDocs: docs("ag-ui-docs") },
  { id: "openapi", name: "OpenAPI Specification", kind: "protocol", roleFa: "توصیف machine-readable عملیات و schemaهای HTTP API", transportFa: "description format برای HTTP APIs", authorityBoundaryFa: "توصیف endpoint جای authentication، authorization یا transaction policy نیست.", notEquivalentToFa: ["runtime", "MCP", "agent loop"], asOf: AS_OF, primaryDocs: docs("openapi-spec") },
  { id: "json-rpc", name: "JSON-RPC 2.0", kind: "protocol", roleFa: "قالب request/response/notification برای فراخوانی procedure", transportFa: "transport-agnostic message format", authorityBoundaryFa: "خود specification مدل امنیت یا هویت کامل ارائه نمی‌دهد.", notEquivalentToFa: ["HTTP", "MCP capability model", "authorization"], asOf: AS_OF, primaryDocs: docs("jsonrpc-spec") },
]);

export const ABLITERATION_STEPS = deepFreeze({
  id: "abliteration",
  titleFa: "Abliteration / refusal-direction ablation",
  evidenceStatus: "paper-and-source-backed",
  safeMode: "visual-simulation-only",
  definitionFa: "Abliteration نام جامعه‌محور روشی است که از پژوهش جهت refusal الهام می‌گیرد؛ با ablation study عمومی یکسان نیست.",
  steps: [
    { id: "paired-prompts", order: 1, titleFa: "جفت ورودی", explanationFa: "پرامپت‌های مضر و بی‌ضررِ کنترل‌شده برای مقایسه آماده می‌شوند.", artifactFa: "paired evaluation set" },
    { id: "collect-activations", order: 2, titleFa: "ثبت activation", explanationFa: "فعال‌سازی residual در چند لایه برای دو گروه جمع می‌شود.", artifactFa: "layer × token activations" },
    { id: "candidate-direction", order: 3, titleFa: "بردار نامزد", explanationFa: "اختلاف میانگین‌ها جهت‌های مرتبط با refusal را پیشنهاد می‌کند.", artifactFa: "candidate directions" },
    { id: "select-direction", order: 4, titleFa: "انتخاب و اعتبارسنجی", explanationFa: "جهت و لایه با آزمون harmless/harmful و افت توانایی انتخاب می‌شود.", artifactFa: "selected direction + evaluation receipt" },
    { id: "project-away", order: 5, titleFa: "فرافکنی هندسی", explanationFa: "در شبیه‌ساز، مؤلفهٔ هم‌جهت حذف می‌شود؛ محصول آموزشی checkpoint ایمنی‌زدایی‌شده صادر نمی‌کند.", artifactFa: "simulated projection" },
    { id: "safety-evaluation", order: 6, titleFa: "ارزیابی چندمحوری", explanationFa: "نرخ refusal، harmful compliance، harmless helpfulness، capability، زبان و robustness جدا سنجیده می‌شوند.", artifactFa: "multi-axis safety report" },
  ],
  risks: [
    { id: "white-box-jailbreak", severity: "critical", textFa: "مقاله این دستکاری را white-box jailbreak می‌داند و کاهش refusal می‌تواند harmful compliance را افزایش دهد." },
    { id: "not-universal", severity: "high", textFa: "یک جهت برای همهٔ مدل‌ها، زبان‌ها، لایه‌ها و توزیع‌ها تضمین نشده است." },
    { id: "capability-drift", severity: "high", textFa: "projection می‌تواند توانایی، لحن، calibration یا پاسخ بی‌ضرر را تخریب کند." },
    { id: "false-equivalence", severity: "high", textFa: "refusal کمتر معادل حقیقت‌گویی، بی‌طرفی یا هوشمندی بیشتر نیست." },
    { id: "evaluation-blind-spots", severity: "high", textFa: "dataset انتخاب جهت می‌تواند leakage، bias و پوشش ناکافی چندزبانه داشته باشد." },
    { id: "checkpoint-supply-chain", severity: "critical", textFa: "انتشار checkpoint دستکاری‌شده ریسک زنجیرهٔ تأمین و سوءاستفاده ایجاد می‌کند." },
  ],
  productBoundaryFa: "فقط نمودار activation و projection ساختگی/آموزشی؛ بدون اجرای weight mutation، حذف safety یا export checkpoint.",
  primaryDocs: docs("refusal-paper", "refusal-repo", "abliterator-repo"),
});

export const COMPETITOR_MATRIX = deepFreeze({
  asOf: AS_OF,
  evidenceStatus: "primary-source-comparison",
  scale: {
    documented: "در منبع اولیه، جزء هستهٔ محصول یا پروژه مستند است.",
    partial: "بخشی از محور پوشش داده می‌شود؛ هم‌ارزی کامل ادعا نمی‌شود.",
    "not-core-scope": "در منبع بررسی‌شده هدف اصلی اعلام نشده است؛ به معنی اثبات نبود مطلق نیست.",
    "project-target": "هدف این پروژه است و به‌تنهایی ادعای پیاده‌سازی یا benchmark نیست.",
  },
  axes: [
    { id: "live-training", labelFa: "آموزش زندهٔ مدل کوچک" },
    { id: "transformer-inference", labelFa: "درون‌نگری inference ترنسفورمر" },
    { id: "multi-architecture", labelFa: "اطلس چندمعماری/چندرسانه‌ای" },
    { id: "agent-context", labelFa: "Agent، harness، context و orchestration" },
    { id: "evidence-boundaries", labelFa: "منبع، fact/inference/unknown" },
    { id: "desktop-3d", labelFa: "تجربهٔ desktop/3D" },
    { id: "semantic-receipt", labelFa: "APIR و semantic receipt" },
  ],
  entries: [
    {
      id: "model-ecosystem-lab-target", name: "Model Ecosystem Lab", position: "project-target", primaryDocs: docs("alefba-system"),
      coverage: { "live-training": "project-target", "transformer-inference": "project-target", "multi-architecture": "project-target", "agent-context": "project-target", "evidence-boundaries": "project-target", "desktop-3d": "project-target", "semantic-receipt": "project-target" },
      boundaryFa: "ردیف هدف است؛ تحقق هر خانه فقط با تست و release evidence قابل ادعاست.",
    },
    {
      id: "tensorflow-playground", name: "TensorFlow Playground", position: "reference", primaryDocs: docs("tensorflow-playground"),
      coverage: { "live-training": "documented", "transformer-inference": "not-core-scope", "multi-architecture": "not-core-scope", "agent-context": "not-core-scope", "evidence-boundaries": "partial", "desktop-3d": "not-core-scope", "semantic-receipt": "not-core-scope" },
      boundaryFa: "آموزش تعاملی شبکهٔ عصبی کوچک را بسیار روشن نشان می‌دهد؛ مرجع مستقیم برای کل زیست‌بوم LLM نیست.",
    },
    {
      id: "transformer-explainer", name: "Transformer Explainer", position: "reference", primaryDocs: docs("transformer-explainer", "transformer-explainer-paper"),
      coverage: { "live-training": "not-core-scope", "transformer-inference": "documented", "multi-architecture": "partial", "agent-context": "not-core-scope", "evidence-boundaries": "partial", "desktop-3d": "not-core-scope", "semantic-receipt": "not-core-scope" },
      boundaryFa: "برای inference مدل GPT-2 Small طراحی شده و نباید نمایندهٔ جزئیات مدل‌های بستهٔ جدید معرفی شود.",
    },
    {
      id: "animated-llm", name: "AnimatedLLM", position: "reference", primaryDocs: docs("animated-llm-repo", "animated-llm-paper"),
      coverage: { "live-training": "not-core-scope", "transformer-inference": "documented", "multi-architecture": "partial", "agent-context": "not-core-scope", "evidence-boundaries": "partial", "desktop-3d": "not-core-scope", "semantic-receipt": "not-core-scope" },
      boundaryFa: "توضیح مرحله‌ای transformer برای آموزش است؛ اطلس عامل، پروتکل و سامانهٔ چندرسانه‌ای هدف اصلی اعلام‌شده نیست.",
    },
    {
      id: "comfyui-reference", name: "ComfyUI", position: "adjacent-reference", primaryDocs: docs("comfy-docs", "comfy-repo"),
      coverage: { "live-training": "partial", "transformer-inference": "not-core-scope", "multi-architecture": "documented", "agent-context": "partial", "evidence-boundaries": "partial", "desktop-3d": "partial", "semantic-receipt": "not-core-scope" },
      boundaryFa: "workflow و inference engine عملی است؛ ابزار آموزشیِ جامع برای آشکارسازی تمام internals مدل نیست.",
    },
    {
      id: "mirofish-reference", name: "MiroFish", position: "adjacent-reference", primaryDocs: docs("mirofish-repo"),
      coverage: { "live-training": "not-core-scope", "transformer-inference": "not-core-scope", "multi-architecture": "not-core-scope", "agent-context": "documented", "evidence-boundaries": "partial", "desktop-3d": "partial", "semantic-receipt": "not-core-scope" },
      boundaryFa: "بر شبیه‌سازی چندعاملی و گزارش سناریو تمرکز دارد؛ forecast را باید با دادهٔ واقعی و baseline راستی‌آزمایی کرد.",
    },
  ],
});

export const RESEARCH_SOURCES = deepFreeze(Object.values(SOURCE_INDEX));

const lookupEntries = [
  ...RESEARCH_PROFILES,
  ...LEARNING_STAGES,
  ...USER_DATA_LAYERS,
  ...AGENT_TOOL_PROFILES,
  ...APPLICATION_PROFILES,
  ...PROTOCOL_PROFILES,
  PROGRAM_GOALS,
  ABLITERATION_STEPS,
];

const lookupRecord = Object.fromEntries(lookupEntries.map((entry) => [entry.id, entry]));
Object.defineProperties(lookupRecord, {
  get: { enumerable: false, value: (id) => lookupRecord[id] },
  has: { enumerable: false, value: (id) => Object.hasOwn(lookupRecord, id) },
  size: { enumerable: false, value: lookupEntries.length },
});

export const RESEARCH_BY_ID = deepFreeze(lookupRecord);
