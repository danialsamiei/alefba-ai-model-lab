"use strict";

const state = { model: null, prediction: null, selectedDigit: "4" };

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    const detail = payload.detail?.code || payload.detail || response.statusText;
    throw new Error(detail);
  }
  return payload;
}

function setMachineStatus(text, ready = false) {
  byId("machine-status").textContent = text;
  byId("status-light").classList.toggle("ready", ready);
}

function buildKeypad() {
  const keypad = byId("digit-keypad");
  keypad.replaceChildren();
  for (let digit = 0; digit < 10; digit += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "digit-key";
    button.textContent = String(digit);
    button.dataset.digit = String(digit);
    button.setAttribute("aria-label", `انتخاب رقم ${digit}`);
    button.addEventListener("click", () => selectDigit(String(digit)));
    keypad.append(button);
  }
}

function renderModel(model) {
  const config = model.model_config;
  const values = [
    ["پارامترها", Number(model.parameter_count).toLocaleString("en-US")],
    ["لایه", config.n_layers],
    ["head", config.n_heads],
    ["d_model", config.d_model],
    ["context", config.context_length],
    ["واژگان", model.vocabulary.join("")],
  ];
  byId("model-anatomy").innerHTML = values.map(([label, value]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
  ).join("");
  byId("provenance-line").textContent =
    `CHECKPOINT / ${model.checkpoint_sha256} / RUN ${model.run_id}`;
}

function spectrumMarkup(step, index) {
  const winner = step.predicted_token;
  return `<section class="spectrum-step">
    <h3>GENERATION STEP ${index + 1} / CONTEXT ${escapeHtml(step.context)}</h3>
    ${Object.entries(step.probabilities).map(([token, probability]) => {
      const percent = Number(probability) * 100;
      return `<div class="probability-row ${token === winner ? "winner" : ""}">
        <span>${token}</span>
        <div class="probability-track"><div class="probability-fill" style="width:${Math.max(percent, 0.1)}%"></div></div>
        <span>${percent.toFixed(3)}%</span>
      </div>`;
    }).join("")}
  </section>`;
}

function renderProbabilities(prediction) {
  const container = byId("probability-spectrum");
  container.classList.remove("loading-block");
  container.innerHTML = prediction.steps.map(spectrumMarkup).join("");
}

function renderSteps(prediction) {
  const container = byId("generation-steps");
  container.classList.remove("loading-block");
  container.innerHTML = prediction.steps.map((step, index) => `
    <section class="trace-step">
      <h3>STEP ${index + 1} / POSITION ${step.context_ids.length - 1}</h3>
      <div class="trace-equation"><span>${escapeHtml(step.context)}</span><span class="arrow">→</span><strong>${step.predicted_token}</strong></div>
      <div class="trace-stats">
        <span>entropy<b>${Number(step.entropy).toFixed(5)}</b></span>
        <span>top-2 margin<b>${(Number(step.top2_probability_margin) * 100).toFixed(2)}%</b></span>
        <span>context length<b>${step.context_ids.length}</b></span>
        <span>argmax id<b>${step.predicted_id}</b></span>
      </div>
    </section>`).join("");
}

function matrixMarkup(matrix) {
  const size = matrix.length;
  return `<div class="matrix" style="grid-template-columns:repeat(${size},1fr)">
    ${matrix.flatMap((row) => row.map((value) => {
      const numeric = Number(value);
      const alpha = 0.08 + numeric * 0.82;
      return `<span class="matrix-cell" style="background:rgba(var(--signal-rgb),${alpha})" title="${numeric.toFixed(7)}">${numeric.toFixed(2)}</span>`;
    })).join("")}
  </div>`;
}

function renderAttention(prediction) {
  const container = byId("attention-matrices");
  container.classList.remove("loading-block");
  container.innerHTML = prediction.steps.map((step, stepIndex) => {
    const layers = step.trace.layers.map((layer) => `
      <section class="attention-layer">
        <h3>STEP ${stepIndex + 1} / LAYER ${layer.layer}</h3>
        <div class="head-grid">
          ${layer.attention_weights.map((head, headIndex) => `
            <div class="head-card"><strong>HEAD ${headIndex}</strong>${matrixMarkup(head)}</div>
          `).join("")}
        </div>
      </section>`).join("");
    return `<div class="attention-step">${layers}</div>`;
  }).join("");
}

function vectorColor(value, maxAbs) {
  const normalized = Math.min(Math.abs(Number(value)) / Math.max(maxAbs, 1e-8), 1);
  return Number(value) >= 0
    ? `rgba(var(--phosphor-rgb),${0.12 + normalized * 0.88})`
    : `rgba(var(--signal-rgb),${0.12 + normalized * 0.88})`;
}

function vectorGroup(label, vector) {
  const values = Array.isArray(vector[0]) ? vector.at(-1) : vector;
  const maxAbs = Math.max(...values.map((value) => Math.abs(Number(value))));
  return `<section class="vector-group"><h3>${escapeHtml(label)}</h3>
    <div class="vector-strip">${values.map((value, index) =>
      `<span class="vector-cell" style="background:${vectorColor(value, maxAbs)}" title="dim ${index}: ${Number(value).toFixed(7)}"></span>`
    ).join("")}</div>
    <div class="vector-caption">32 DIMENSIONS / − ORANGE / + GREEN</div>
  </section>`;
}

function renderVectors(prediction) {
  const container = byId("vector-microscope");
  container.classList.remove("loading-block");
  const trace = prediction.steps[1].trace;
  const headLast = (tensor) => tensor.flatMap((head) => head.at(-1));
  container.innerHTML = [
    vectorGroup("TOKEN EMBEDDING / LAST", trace.token_embeddings),
    vectorGroup("POSITION EMBEDDING / LAST", trace.position_embeddings),
    vectorGroup("FINAL HIDDEN / LAST", trace.final_hidden),
    vectorGroup("INPUT GRADIENT / LAST", trace.input_embedding_gradient),
    ...trace.layers.map((layer) => vectorGroup(`RESIDUAL / BLOCK ${layer.layer}`, layer.residual_after_block)),
    ...trace.layers.flatMap((layer) => [
      vectorGroup(`QUERY / BLOCK ${layer.layer} / LAST POSITION`, headLast(layer.query)),
      vectorGroup(`KEY / BLOCK ${layer.layer} / LAST POSITION`, headLast(layer.key)),
      vectorGroup(`VALUE / BLOCK ${layer.layer} / LAST POSITION`, headLast(layer.value)),
      vectorGroup(`MLP PRE-GELU / BLOCK ${layer.layer}`, layer.mlp_pre_activation),
      vectorGroup(`MLP POST-GELU / BLOCK ${layer.layer}`, layer.mlp_activation),
      vectorGroup(`MLP OUTPUT / BLOCK ${layer.layer}`, layer.mlp_output),
    ]),
    `<section class="vector-group"><h3>LOGIT LENS</h3><div class="trace-stats">
      ${trace.logit_lens.map((lens) => `<span>${escapeHtml(lens.stage)}<b>argmax ${lens.argmax} / H=${Number(lens.entropy).toFixed(5)}</b></span>`).join("")}
    </div></section>`,
    `<section class="vector-group"><h3>CHOSEN LOGIT CONTRIBUTIONS</h3><div class="trace-stats">
      ${trace.chosen_logit_contributions.top_dimensions.map((item) => `<span>dimension ${item.dimension}<b>${Number(item.contribution).toFixed(7)}</b></span>`).join("")}
    </div></section>`,
  ].join("");
}

function renderLogits(prediction) {
  const container = byId("logit-tables");
  container.classList.remove("loading-block");
  container.innerHTML = prediction.steps.map((step, index) => `
    <section class="logit-step"><h3>STEP ${index + 1}</h3><div class="logit-grid">
      ${Object.entries(step.logits).map(([token, value]) => `
        <span class="${token === step.predicted_token ? "winner" : ""}">${token}</span>
        <span class="${token === step.predicted_token ? "winner" : ""}">${Number(value).toFixed(6)}</span>
      `).join("")}
    </div></section>`).join("");
}

function renderPrediction(prediction) {
  state.prediction = prediction;
  byId("input-readout").textContent = prediction.input;
  byId("output-readout").textContent = prediction.display_output;
  byId("raw-readout").textContent = prediction.raw_output;
  const stamp = byId("correctness-stamp");
  stamp.textContent = prediction.correct
    ? `SINGLE CASE CHECK / PASS / ${prediction.input} → ${prediction.raw_output}`
    : `SINGLE CASE CHECK / FAIL / EXPECTED ${prediction.expected_raw}`;
  stamp.className = `correctness-stamp ${prediction.correct ? "pass" : "fail"}`;
  renderProbabilities(prediction);
  renderSteps(prediction);
  renderAttention(prediction);
  renderVectors(prediction);
  renderLogits(prediction);
}

async function selectDigit(digit) {
  state.selectedDigit = digit;
  document.querySelectorAll(".digit-key").forEach((button) => {
    button.classList.toggle("active", button.dataset.digit === digit);
    button.setAttribute("aria-pressed", button.dataset.digit === digit ? "true" : "false");
  });
  byId("input-readout").textContent = digit;
  setMachineStatus("در حال محاسبه…", true);
  try {
    const prediction = await requestJson("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digit, include_trace: true }),
    });
    renderPrediction(prediction);
    setMachineStatus(`READY / ${Number(prediction.duration_ms).toFixed(1)} ms`, true);
  } catch (error) {
    setMachineStatus(`ERROR / ${error.message}`, false);
    byId("correctness-stamp").className = "correctness-stamp fail";
    byId("correctness-stamp").textContent = error.message;
  }
}

function renderLabSummary(summary) {
  const cards = byId("experiment-cards");
  const table = byId("dataset-table");
  cards.classList.remove("loading-block");
  if (!summary.available) {
    cards.innerHTML = `<p class="error-text">SQLite متصل نیست: ${escapeHtml(summary.reason)}</p>`;
    return;
  }
  const labels = {
    canonical_pretrain_before_sft: ["فقط پیش‌آموزش", "task جانشین را SFT ندیده است"],
    canonical_true_successor: ["مدل نهایی", "تمام ده نگاشت را دیده؛ آزمون exhaustive"],
    random_init_full_sft: ["SFT از تصادف", "baseline کنترل‌شده بدون pretraining"],
    heldout_8_9: ["کنترل دادهٔ ندیده", "۸ و ۹ خارج از دامنهٔ پشتیبانی‌اند"],
    known_token_mapping_heldout_7: ["نگاشت حذف‌شده", "توکن ۷ دیده شده، row نظارت‌شده حذف شده"],
    corrupt_training_labels: ["برچسب خراب", "آیا مدل 4→99 را از داده یاد گرفت؟"],
    corrupt_model_vs_true_rule: ["خراب در برابر حقیقت", "همان مدل نسبت به قانون واقعی"],
  };
  const newestByExperiment = new Map();
  summary.evaluations.forEach((evaluation) => newestByExperiment.set(evaluation.experiment, evaluation));
  cards.innerHTML = [...newestByExperiment.values()].map((evaluation) => {
    const [title, note] = labels[evaluation.experiment] || [evaluation.experiment, ""];
    return `<article class="experiment-card">
      <h3>${escapeHtml(title)}</h3>
      <strong>${evaluation.correct}/${evaluation.total}</strong>
      <p>${escapeHtml(note)} · supported ${evaluation.supported}</p>
    </article>`;
  }).join("");
  table.innerHTML = summary.datasets.map((dataset) => `
    <tr><td>${escapeHtml(dataset.name)}</td><td>${escapeHtml(dataset.purpose)}</td><td>${dataset.row_count}</td><td title="${dataset.manifest_sha256}">${dataset.manifest_sha256.slice(0, 16)}…</td></tr>
  `).join("");
}

async function inspectContext(event) {
  event.preventDefault();
  const context = byId("context-input").value;
  const output = byId("context-result");
  output.textContent = "CALCULATING…";
  try {
    const result = await requestJson("/api/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, include_trace: false }),
    });
    const probability = Number(result.probabilities[result.predicted_token]) * 100;
    output.textContent = `CONTEXT ${result.context} → NEXT TOKEN ${result.predicted_token} / P=${probability.toFixed(3)}% / H=${Number(result.entropy).toFixed(5)}`;
  } catch (error) {
    output.textContent = `REJECTED / ${error.message}`;
    output.classList.add("error-text");
  }
}

async function initialize() {
  buildKeypad();
  byId("context-form").addEventListener("submit", inspectContext);
  document.addEventListener("keydown", (event) => {
    if (/^[0-9]$/.test(event.key) && document.activeElement?.tagName !== "INPUT") {
      selectDigit(event.key);
    }
  });
  try {
    const [model, summary] = await Promise.all([
      requestJson("/api/model"),
      requestJson("/api/lab/summary"),
    ]);
    state.model = model;
    renderModel(model);
    renderLabSummary(summary);
    await selectDigit(state.selectedDigit);
  } catch (error) {
    setMachineStatus(`ERROR / ${error.message}`, false);
  }
}

initialize();
