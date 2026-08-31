from __future__ import annotations

import math

import pytest

from reasoning_lab.sampling_lab import SamplingParameters, run_sampling_lab, source_logits


def stage(result: dict[str, object], key: str) -> dict[str, object]:
    stages = result["stages"]
    assert isinstance(stages, list)
    return next(item for item in stages if isinstance(item, dict) and item["key"] == key)


def probabilities(result: dict[str, object], key: str) -> list[float]:
    values = stage(result, key)["values"]
    assert isinstance(values, list)
    return [float(item["probability"]) for item in values if isinstance(item, dict)]


def test_source_logits_rotate_to_the_cyclic_successor() -> None:
    for digit in range(10):
        logits = source_logits(digit)
        assert len(logits) == 10
        assert logits.index(max(logits)) == (digit + 1) % 10


def test_every_stage_is_a_complete_normalized_digit_distribution() -> None:
    result = run_sampling_lab(SamplingParameters())
    assert result["format"] == "sampling-lab-v1"
    assert result["status"] == "algorithmic_simulation"
    assert result["vocabulary"] == list("0123456789")
    for item in result["stages"]:
        assert len(item["values"]) == 10
        assert sum(value["probability"] for value in item["values"]) == pytest.approx(1.0)
        assert item["survivors"] >= 1


def test_lower_temperature_reduces_entropy_and_zero_is_greedy() -> None:
    cold = run_sampling_lab(SamplingParameters(temperature=0.25))
    hot = run_sampling_lab(SamplingParameters(temperature=1.8))
    greedy = run_sampling_lab(SamplingParameters(temperature=0.0, seed=7))

    assert cold["result"]["entropy_nats"] < hot["result"]["entropy_nats"]
    assert greedy["result"]["selected_token"] == "5"
    assert greedy["result"]["final_probabilities"].count(1.0) == 1
    assert greedy["result"]["survivors"] == 1


def test_top_k_keeps_exactly_k_candidates() -> None:
    result = run_sampling_lab(SamplingParameters(top_k=3))
    assert stage(result, "top_k")["survivors"] == 3
    assert sum(value > 0 for value in probabilities(result, "top_k")) == 3


def test_top_p_keeps_the_minimal_ranked_prefix() -> None:
    result = run_sampling_lab(SamplingParameters(top_p=0.7))
    before = probabilities(result, "top_k")
    after = probabilities(result, "top_p")
    kept = [index for index, value in enumerate(after) if value > 0]
    ranked = sorted(range(10), key=lambda index: (-before[index], index))
    assert set(kept) == set(ranked[: len(kept)])
    assert sum(before[index] for index in kept) >= 0.7
    assert sum(before[index] for index in ranked[: len(kept) - 1]) < 0.7


def test_min_p_uses_a_threshold_relative_to_the_best_token() -> None:
    result = run_sampling_lab(SamplingParameters(min_p=0.4))
    before = probabilities(result, "top_p")
    after = probabilities(result, "min_p")
    threshold = 0.4 * max(before)
    assert [value > 0 for value in after] == [value >= threshold for value in before]


def test_presence_frequency_and_bias_are_exactly_additive() -> None:
    result = run_sampling_lab(
        SamplingParameters(
            history="1112",
            presence_penalty=0.5,
            frequency_penalty=0.25,
            bias_digit=2,
            logit_bias=1.0,
        )
    )
    raw_values = stage(result, "source")["values"]
    adjusted_values = stage(result, "additive")["values"]
    raw = [float(item["logit"]) for item in raw_values]
    adjusted = [float(item["logit"]) for item in adjusted_values]
    assert adjusted[1] == pytest.approx(raw[1] - 0.5 - 3 * 0.25)
    assert adjusted[2] == pytest.approx(raw[2] + 1.0 - 0.5 - 0.25)
    assert adjusted[3] == pytest.approx(raw[3])


def test_repetition_penalty_is_sign_sensitive() -> None:
    result = run_sampling_lab(
        SamplingParameters(history="45", repetition_penalty=2.0, bias_digit=4, logit_bias=-5)
    )
    additive_values = stage(result, "additive")["values"]
    repeated_values = stage(result, "repetition")["values"]
    additive = [float(item["logit"]) for item in additive_values]
    repeated = [float(item["logit"]) for item in repeated_values]
    assert additive[4] < 0 and repeated[4] == pytest.approx(additive[4] * 2)
    assert additive[5] > 0 and repeated[5] == pytest.approx(additive[5] / 2)


def test_typical_epsilon_and_eta_never_empty_the_candidate_set() -> None:
    result = run_sampling_lab(
        SamplingParameters(typical_p=0.01, epsilon_cutoff=0.5, eta_cutoff=0.5)
    )
    for key in ("typical_p", "epsilon", "eta"):
        assert stage(result, key)["survivors"] >= 1


def test_seed_and_histogram_are_reproducible_and_independent() -> None:
    short = run_sampling_lab(SamplingParameters(seed=19, sample_count=100))
    long = run_sampling_lab(SamplingParameters(seed=19, sample_count=2000))
    repeated = run_sampling_lab(SamplingParameters(seed=19, sample_count=100))
    assert short["result"]["selected_token"] == long["result"]["selected_token"]
    assert short["result"]["uniform_draw"] == long["result"]["uniform_draw"]
    assert short["result"]["histogram_counts"] == repeated["result"]["histogram_counts"]
    assert sum(short["result"]["histogram_counts"]) == 100
    assert math.isclose(sum(short["result"]["empirical_probabilities"]), 1.0)


@pytest.mark.parametrize(
    "parameters",
    [
        SamplingParameters(history="۱۲"),
        SamplingParameters(temperature=-0.1),
        SamplingParameters(top_k=11),
        SamplingParameters(top_p=0),
        SamplingParameters(repetition_penalty=0),
        SamplingParameters(sample_count=99),
    ],
)
def test_invalid_parameters_fail_closed(parameters: SamplingParameters) -> None:
    with pytest.raises(ValueError):
        run_sampling_lab(parameters)
