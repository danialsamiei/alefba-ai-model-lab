"""Inspectable next-token sampling over the closed vocabulary ``0..9``.

The source logits are deliberately synthetic.  They put the successor of the
input digit first, then rank the remaining digits clockwise.  This isolates
decoding controls from model quality and makes every transformation auditable.
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import asdict, dataclass
from typing import Any

VOCABULARY = tuple(str(value) for value in range(10))
_BASE_RANKED_LOGITS = (3.2, 2.35, 1.75, 1.25, 0.85, 0.5, 0.15, -0.2, -0.6, -1.05)


@dataclass(frozen=True, slots=True)
class SamplingParameters:
    """Controls applied by the laboratory in the documented order."""

    current_digit: int = 4
    history: str = "11234"
    temperature: float = 1.0
    top_k: int = 0
    top_p: float = 1.0
    min_p: float = 0.0
    typical_p: float = 1.0
    epsilon_cutoff: float = 0.0
    eta_cutoff: float = 0.0
    presence_penalty: float = 0.0
    frequency_penalty: float = 0.0
    repetition_penalty: float = 1.0
    bias_digit: int = 0
    logit_bias: float = 0.0
    seed: int = 20260831
    sample_count: int = 1000

    def validate(self) -> None:
        if not 0 <= self.current_digit <= 9:
            raise ValueError("current_digit must be from 0 through 9")
        if len(self.history) > 64 or any(token not in VOCABULARY for token in self.history):
            raise ValueError("history must contain at most 64 ASCII digits")
        if not 0.0 <= self.temperature <= 2.0:
            raise ValueError("temperature must be from 0 through 2")
        if not 0 <= self.top_k <= len(VOCABULARY):
            raise ValueError("top_k must be from 0 through 10")
        if not 0.01 <= self.top_p <= 1.0:
            raise ValueError("top_p must be from 0.01 through 1")
        if not 0.0 <= self.min_p <= 1.0:
            raise ValueError("min_p must be from 0 through 1")
        if not 0.01 <= self.typical_p <= 1.0:
            raise ValueError("typical_p must be from 0.01 through 1")
        if not 0.0 <= self.epsilon_cutoff <= 0.5:
            raise ValueError("epsilon_cutoff must be from 0 through 0.5")
        if not 0.0 <= self.eta_cutoff <= 0.5:
            raise ValueError("eta_cutoff must be from 0 through 0.5")
        if not -2.0 <= self.presence_penalty <= 2.0:
            raise ValueError("presence_penalty must be from -2 through 2")
        if not -2.0 <= self.frequency_penalty <= 2.0:
            raise ValueError("frequency_penalty must be from -2 through 2")
        if not 0.1 <= self.repetition_penalty <= 2.0:
            raise ValueError("repetition_penalty must be from 0.1 through 2")
        if not 0 <= self.bias_digit <= 9:
            raise ValueError("bias_digit must be from 0 through 9")
        if not -5.0 <= self.logit_bias <= 5.0:
            raise ValueError("logit_bias must be from -5 through 5")
        if not 0 <= self.seed <= 2**32 - 1:
            raise ValueError("seed must fit an unsigned 32-bit integer")
        if not 100 <= self.sample_count <= 2000:
            raise ValueError("sample_count must be from 100 through 2000")


def source_logits(current_digit: int) -> list[float]:
    """Rotate a transparent score template so the cyclic successor ranks first."""

    expected = (current_digit + 1) % len(VOCABULARY)
    logits = [0.0] * len(VOCABULARY)
    for offset, score in enumerate(_BASE_RANKED_LOGITS):
        logits[(expected + offset) % len(VOCABULARY)] = score
    return logits


def _softmax(logits: list[float]) -> list[float]:
    finite = [value for value in logits if math.isfinite(value)]
    if not finite:
        raise ValueError("sampling filters removed every token")
    maximum = max(finite)
    weights = [math.exp(value - maximum) if math.isfinite(value) else 0.0 for value in logits]
    total = sum(weights)
    return [weight / total for weight in weights]


def _renormalize(probabilities: list[float]) -> list[float]:
    total = sum(probabilities)
    if total <= 0:
        raise ValueError("sampling filters removed every token")
    return [probability / total for probability in probabilities]


def _entropy(probabilities: list[float]) -> float:
    return -sum(value * math.log(value) for value in probabilities if value > 0)


def _stage(
    key: str,
    label: str,
    kind: str,
    logits: list[float],
    probabilities: list[float],
    *,
    formula: str,
    explanation: str,
    changed: bool,
) -> dict[str, Any]:
    values = [
        {
            "token": token,
            "logit": None if not math.isfinite(logits[index]) else round(logits[index], 8),
            "probability": round(probabilities[index], 10),
            "kept": probabilities[index] > 0,
        }
        for index, token in enumerate(VOCABULARY)
    ]
    return {
        "key": key,
        "label": label,
        "kind": kind,
        "formula": formula,
        "explanation": explanation,
        "changed": changed,
        "entropy_nats": round(_entropy(probabilities), 10),
        "effective_choices": round(math.exp(_entropy(probabilities)), 6),
        "survivors": sum(value > 0 for value in probabilities),
        "values": values,
    }


def _mask_by_indices(probabilities: list[float], kept: set[int]) -> list[float]:
    masked = [value if index in kept else 0.0 for index, value in enumerate(probabilities)]
    return _renormalize(masked)


def _prefix_filter(probabilities: list[float], mass: float) -> list[float]:
    ranked = sorted(range(len(probabilities)), key=lambda index: (-probabilities[index], index))
    kept: set[int] = set()
    cumulative = 0.0
    for index in ranked:
        if probabilities[index] <= 0:
            continue
        kept.add(index)
        cumulative += probabilities[index]
        if cumulative >= mass:
            break
    return _mask_by_indices(probabilities, kept)


def _typical_filter(probabilities: list[float], mass: float) -> list[float]:
    entropy = _entropy(probabilities)
    ranked = sorted(
        (index for index, value in enumerate(probabilities) if value > 0),
        key=lambda index: (abs(-math.log(probabilities[index]) - entropy), index),
    )
    kept: set[int] = set()
    cumulative = 0.0
    for index in ranked:
        kept.add(index)
        cumulative += probabilities[index]
        if cumulative >= mass:
            break
    return _mask_by_indices(probabilities, kept)


def _threshold_filter(probabilities: list[float], threshold: float) -> list[float]:
    maximum_index = max(range(len(probabilities)), key=probabilities.__getitem__)
    kept = {
        index for index, value in enumerate(probabilities) if value >= threshold and value > 0
    }
    kept.add(maximum_index)
    return _mask_by_indices(probabilities, kept)


def _splitmix64(value: int) -> int:
    """Return one version-stable 64-bit pseudo-random word."""

    mask = 2**64 - 1
    value = (value + 0x9E3779B97F4A7C15) & mask
    value = ((value ^ (value >> 30)) * 0xBF58476D1CE4E5B9) & mask
    value = ((value ^ (value >> 27)) * 0x94D049BB133111EB) & mask
    return value ^ (value >> 31)


def _uniform(seed: int, stream: int, draw_index: int) -> float:
    mixed_input = (
        seed
        + 0xD1B54A32D192ED03 * stream
        + 0x94D049BB133111EB * (draw_index + 1)
    ) & (2**64 - 1)
    return (_splitmix64(mixed_input) >> 11) * 2**-53


def _categorical(probabilities: list[float], uniform: float) -> int:
    cumulative = 0.0
    last_survivor = 0
    for index, probability in enumerate(probabilities):
        if probability > 0:
            last_survivor = index
        cumulative += probability
        if uniform < cumulative:
            return index
    return last_survivor


def run_sampling_lab(parameters: SamplingParameters) -> dict[str, Any]:
    """Run the laboratory pipeline and return every intermediate distribution."""

    parameters.validate()
    counts = Counter(parameters.history)
    logits = source_logits(parameters.current_digit)
    probabilities = _softmax(logits)
    stages: list[dict[str, Any]] = [
        _stage(
            "source",
            "امتیاز خام کنترل‌شده",
            "source",
            logits,
            probabilities,
            formula="pᵢ = softmax(zᵢ)",
            explanation="این logits خروجی checkpoint نیست؛ توزیع آزمایشگاهی ثابتی است که جانشین رقم ورودی را بالاتر می‌گذارد.",
            changed=True,
        )
    ]

    additive = logits.copy()
    for index, token in enumerate(VOCABULARY):
        seen = int(counts[token] > 0)
        additive[index] += parameters.logit_bias if index == parameters.bias_digit else 0.0
        additive[index] -= parameters.presence_penalty * seen
        additive[index] -= parameters.frequency_penalty * counts[token]
    additive_probabilities = _softmax(additive)
    additive_changed = additive != logits
    stages.append(
        _stage(
            "additive",
            "bias + حضور + فراوانی",
            "logit_processor",
            additive,
            additive_probabilities,
            formula="z′ᵢ = zᵢ + biasᵢ − presence·𝟙[cᵢ>0] − frequency·cᵢ",
            explanation="presence فقط دیده‌شدن را می‌بیند؛ frequency تعداد تکرار را؛ bias مستقیماً امتیاز رقم منتخب را جابه‌جا می‌کند.",
            changed=additive_changed,
        )
    )

    repeated = additive.copy()
    if parameters.repetition_penalty != 1.0:
        for index, token in enumerate(VOCABULARY):
            if counts[token] == 0:
                continue
            repeated[index] = (
                repeated[index] * parameters.repetition_penalty
                if repeated[index] < 0
                else repeated[index] / parameters.repetition_penalty
            )
    repeated_probabilities = _softmax(repeated)
    stages.append(
        _stage(
            "repetition",
            "پنالتی تکرارِ علامت‌حساس",
            "logit_processor",
            repeated,
            repeated_probabilities,
            formula="seen: z<0 ? z·r : z/r",
            explanation="این تعریف دقیقاً یک قرارداد کتابخانه‌ای است و با presence/frequency یکی نیست.",
            changed=repeated != additive,
        )
    )

    warnings = [
        "ترتیب پردازش در این آزمایشگاه ثابت و آشکار است؛ APIها و کتابخانه‌های دیگر ممکن است ترتیب یا فرمول متفاوتی داشته باشند."
    ]
    if parameters.temperature == 0:
        winner = max(range(len(repeated)), key=repeated.__getitem__)
        probabilities = [1.0 if index == winner else 0.0 for index in range(len(repeated))]
        scaled = [value if index == winner else -math.inf for index, value in enumerate(repeated)]
        warnings.append("temperature=0 به‌صورت greedy اجرا شد؛ فیلترهای بعدی دیگر انتخاب را تغییر نمی‌دهند.")
    else:
        scaled = [value / parameters.temperature for value in repeated]
        probabilities = _softmax(scaled)
    stages.append(
        _stage(
            "temperature",
            "دما / بازپخش احتمال",
            "logit_warper",
            scaled,
            probabilities,
            formula="pᵢ = softmax(zᵢ / T)؛ T=0 ⇒ argmax",
            explanation="دما رتبه را عوض نمی‌کند، اما فاصلهٔ احتمال‌ها را تیزتر یا تخت‌تر می‌کند.",
            changed=parameters.temperature != 1.0,
        )
    )

    before = probabilities
    if parameters.top_k > 0:
        ranked = sorted(range(len(before)), key=lambda index: (-before[index], index))
        probabilities = _mask_by_indices(before, set(ranked[: parameters.top_k]))
    stages.append(
        _stage(
            "top_k",
            "Top-k تولید",
            "candidate_filter",
            scaled,
            probabilities,
            formula="keep K tokens with largest p",
            explanation="K ثابت از کاندیداهای توکن نگه می‌ماند؛ این top-k با تعداد اسناد RAG فرق دارد.",
            changed=probabilities != before,
        )
    )

    before = probabilities
    if parameters.top_p < 1.0:
        probabilities = _prefix_filter(before, parameters.top_p)
    stages.append(
        _stage(
            "top_p",
            "Top-p / nucleus",
            "candidate_filter",
            scaled,
            probabilities,
            formula="smallest ranked set S with Σᵢ∈S pᵢ ≥ p",
            explanation="اندازهٔ مجموعه ثابت نیست؛ به شکل همان توزیع در این گام وابسته است.",
            changed=probabilities != before,
        )
    )

    before = probabilities
    if parameters.min_p > 0:
        probabilities = _threshold_filter(before, parameters.min_p * max(before))
    stages.append(
        _stage(
            "min_p",
            "Min-p نسبی",
            "candidate_filter",
            scaled,
            probabilities,
            formula="keep pᵢ ≥ min_p · maxⱼ(pⱼ)",
            explanation="آستانه با احتمال بهترین توکن مقیاس می‌شود؛ نتیجه به اعتماد فعلی توزیع وابسته است.",
            changed=probabilities != before,
        )
    )

    before = probabilities
    if parameters.typical_p < 1.0:
        probabilities = _typical_filter(before, parameters.typical_p)
    stages.append(
        _stage(
            "typical_p",
            "Typical-p محلی",
            "candidate_filter",
            scaled,
            probabilities,
            formula="rank by |−log pᵢ − H(p)|, keep mass ≥ typical_p",
            explanation="توکن‌ها بر پایهٔ نزدیکی محتوای اطلاعاتی‌شان به آنتروپی توزیع مرتب می‌شوند.",
            changed=probabilities != before,
        )
    )

    before = probabilities
    if parameters.epsilon_cutoff > 0:
        probabilities = _threshold_filter(before, parameters.epsilon_cutoff)
    stages.append(
        _stage(
            "epsilon",
            "Epsilon cutoff",
            "candidate_filter",
            scaled,
            probabilities,
            formula="keep pᵢ ≥ ε",
            explanation="یک کف احتمال مطلق می‌گذارد و همیشه بهترین توکن را برای جلوگیری از مجموعهٔ خالی نگه می‌دارد.",
            changed=probabilities != before,
        )
    )

    before = probabilities
    eta_threshold = 0.0
    if parameters.eta_cutoff > 0:
        eta_threshold = min(
            parameters.eta_cutoff,
            math.sqrt(parameters.eta_cutoff) * math.exp(-_entropy(before)),
        )
        probabilities = _threshold_filter(before, eta_threshold)
    stages.append(
        _stage(
            "eta",
            "Eta cutoff پویا",
            "candidate_filter",
            scaled,
            probabilities,
            formula="keep pᵢ ≥ min(η, √η·e⁻ᴴ)",
            explanation="کف احتمال را با آنتروپی توزیع وفق می‌دهد و بهترین توکن را همیشه نگه می‌دارد.",
            changed=probabilities != before,
        )
    )

    uniform_draw = _uniform(parameters.seed, 0, 0)
    selected_index = _categorical(probabilities, uniform_draw)
    selected = VOCABULARY[selected_index]
    histogram_counts: Counter[str] = Counter()
    for draw_index in range(parameters.sample_count):
        sampled_index = _categorical(
            probabilities,
            _uniform(parameters.seed, 1, draw_index),
        )
        histogram_counts[VOCABULARY[sampled_index]] += 1
    empirical = [histogram_counts[token] / parameters.sample_count for token in VOCABULARY]

    return {
        "format": "sampling-lab-v1",
        "status": "algorithmic_simulation",
        "source": "synthetic_controlled_successor_logits",
        "vocabulary": list(VOCABULARY),
        "input": {
            "current_digit": parameters.current_digit,
            "expected_successor": (parameters.current_digit + 1) % len(VOCABULARY),
            "history": parameters.history,
            "history_counts": {token: counts[token] for token in VOCABULARY},
        },
        "parameters": asdict(parameters),
        "operation_order": [stage["key"] for stage in stages] + ["seeded_draw"],
        "stages": stages,
        "result": {
            "selected_token": selected,
            "uniform_draw": round(uniform_draw, 16),
            "rng_algorithm": "splitmix64-v1",
            "final_probabilities": [round(value, 10) for value in probabilities],
            "entropy_nats": round(_entropy(probabilities), 10),
            "effective_choices": round(math.exp(_entropy(probabilities)), 6),
            "survivors": sum(value > 0 for value in probabilities),
            "sample_count": parameters.sample_count,
            "histogram_counts": [histogram_counts[token] for token in VOCABULARY],
            "empirical_probabilities": [round(value, 10) for value in empirical],
        },
        "eta_threshold": round(eta_threshold, 10),
        "warnings": warnings,
    }


__all__ = ["VOCABULARY", "SamplingParameters", "run_sampling_lab", "source_logits"]
