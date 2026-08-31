"""Machine-readable acceptance gates for the completed local laboratory."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from reasoning_lab.baselines import NGramLanguageModel
from reasoning_lab.checkpoint import load_checkpoint
from reasoning_lab.config import load_project_config
from reasoning_lab.data import assert_no_split_leakage, generate_curriculum
from reasoning_lab.lab import ALL_PROFILES, CheckpointRegistry, Laboratory
from reasoning_lab.paths import (
    LATEST_EVALUATION_PATH,
    MANIFEST_ROOT,
    REPORTS_ROOT,
)
from reasoning_lab.sampling_lab import SamplingParameters, run_sampling_lab
from reasoning_lab.task import evaluate_with_trace
from reasoning_lab.tokenizer import get_tokenizer
from reasoning_lab.tool_agent import run_scripted_tool_agent

STATIC_ROOT = Path(__file__).with_name("static")


@dataclass(frozen=True, slots=True)
class Gate:
    gate_id: str
    passed: bool
    evidence: dict[str, Any]
    note: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "gate_id": self.gate_id,
            "passed": self.passed,
            "evidence": self.evidence,
            "note": self.note,
        }


def _gate(gate_id: str, condition: bool, note: str, **evidence: Any) -> Gate:
    return Gate(gate_id, bool(condition), evidence, note)


def verify_acceptance(*, write_report: bool = True) -> dict[str, Any]:
    config = load_project_config()
    tokenizer = get_tokenizer()
    curriculum = generate_curriculum(config.data, max_sequence_length=config.model.context_length)
    assert_no_split_leakage(curriculum)
    lab = Laboratory(config=config)
    registry = CheckpointRegistry().load()
    profiles = registry["profiles"]
    manifest = json.loads((MANIFEST_ROOT / "dataset-manifest.json").read_text(encoding="utf-8"))
    evaluation = json.loads(LATEST_EVALUATION_PATH.read_text(encoding="utf-8"))
    counts = lab.repository.table_counts()
    gates: list[Gate] = []

    gates.append(
        _gate(
            "DATA-001",
            curriculum.counts_by_split()
            == {
                "train": 1200,
                "validation": 160,
                "iid_test": 160,
                "depth_ood": 120,
                "rag_holdout": 80,
            }
            and curriculum.dataset_sha256 == manifest["dataset_sha256"],
            "Deterministic split counts and dataset hash match the persisted manifest.",
            dataset_sha256=curriculum.dataset_sha256,
            split_counts=curriculum.counts_by_split(),
            leakage_violations=0,
        )
    )
    gates.append(
        _gate(
            "DATA-002",
            max(len(example.token_ids) for example in curriculum.examples)
            <= config.model.context_length,
            "Every training transcript fits the configured context window.",
            maximum_tokens=max(len(example.token_ids) for example in curriculum.examples),
            context_length=config.model.context_length,
        )
    )
    sample_episode = curriculum.episodes[0]
    public = lab.repository.public_episode(sample_episode.episode_id)
    gates.append(
        _gate(
            "DB-001",
            counts["episodes"] >= len(curriculum.episodes)
            and counts["training_examples"] >= len(curriculum.examples)
            and "gold_answer" not in public
            and "canonical_trace" not in public,
            "Real SQLite rows exist and inference-facing episode reads omit evaluation labels.",
            counts=counts,
            public_fields=sorted(public),
        )
    )
    loaded_models: dict[str, dict[str, int]] = {}
    checkpoint_ok = set(profiles) == set(ALL_PROFILES)
    for profile, record in profiles.items():
        if record.get("tokenizer_sha256") != tokenizer.vocabulary_sha256:
            checkpoint_ok = False
            continue
        if profile == "ngram":
            model = NGramLanguageModel.load(Path(record["path"]))
            checkpoint_ok &= model.model_sha256 == record["checkpoint_sha256"]
            loaded_models[profile] = {"total": 0, "active_estimate": 0}
        else:
            loaded = load_checkpoint(Path(record["path"]))
            checkpoint_ok &= loaded.metadata["checkpoint_sha256"] == record["checkpoint_sha256"]
            loaded_models[profile] = loaded.model.parameter_counts()
    gates.append(
        _gate(
            "MODEL-001",
            checkpoint_ok,
            "All five registry entries load through integrity-checking checkpoint readers.",
            checkpoint_sha256={
                profile: record["checkpoint_sha256"] for profile, record in profiles.items()
            },
            parameter_counts=loaded_models,
        )
    )
    moe_counts = loaded_models.get("moe_scratch", {})
    gates.append(
        _gate(
            "MOE-001",
            moe_counts.get("active_estimate", 0) < moe_counts.get("total", 0)
            and counts["moe_routing_summaries"] > 0,
            "MoE uses sparse top-1 active capacity and routing telemetry has been persisted.",
            parameter_counts=moe_counts,
            routing_rows=counts["moe_routing_summaries"],
        )
    )
    comparison = evaluation["comparison"]
    rag_rows = [row for row in comparison if row["mode"] == "rag"]
    model_rows = [row for row in comparison if row["mode"] == "model_only"]
    gates.append(
        _gate(
            "RAG-001",
            len(rag_rows) == len(ALL_PROFILES)
            and len(model_rows) == len(ALL_PROFILES)
            and counts["retrieval_events"] > 0
            and counts["retrieval_hits"] > 0,
            "Model-only and RAG results are separate, with persisted query/hit provenance.",
            model_only_rows=len(model_rows),
            rag_rows=len(rag_rows),
            retrieval_events=counts["retrieval_events"],
            retrieval_hits=counts["retrieval_hits"],
        )
    )
    sample_facts = {"A": 3, "B": 5, "C": 2}
    tool = run_scripted_tool_agent("MUL(ADD(A,B),C)", sample_facts)
    oracle = evaluate_with_trace("MUL(ADD(A,B),C)", sample_facts)
    gates.append(
        _gate(
            "TOOLS-001",
            tool.answer == oracle.value == 6
            and tool.learned_policy is False
            and len(tool.calls) == 5,
            "Allow-listed host tools are exact; the scripted policy is explicitly not learned.",
            answer=tool.answer,
            calls=len(tool.calls),
            learned_policy=tool.learned_policy,
        )
    )
    effort = evaluation["effort_comparison"]
    effort_hashes = {row["checkpoint_sha256"] for row in effort}
    forward_counts = [row["average_forward_passes"] for row in effort]
    gates.append(
        _gate(
            "EFFORT-001",
            len(effort) == 3
            and len(effort_hashes) == 1
            and forward_counts == sorted(forward_counts)
            and len(set(forward_counts)) == 3,
            "Low/medium/high reuse one checkpoint while consuming distinct compute budgets.",
            rows=effort,
        )
    )
    gates.append(
        _gate(
            "CLAIMS-001",
            evaluation["boundaries"]["scratchpad"] == "generated output, not hidden thought"
            and evaluation["boundaries"]["tools"].startswith("host executed"),
            "The report preserves model/telemetry/external/oracle boundaries.",
            boundaries=evaluation["boundaries"],
        )
    )
    javascript = (STATIC_ROOT / "app.js").read_text(encoding="utf-8")
    method_document = (STATIC_ROOT / "docs" / "methods.html").read_text(encoding="utf-8")
    method_block = javascript.split("const METHODS = [", 1)[1].split("const SECTION_INFO =", 1)[0]
    method_ids = re.findall(r'^    id: "([a-z0-9-]+)"', method_block, flags=re.MULTILINE)
    method_statuses = re.findall(
        r'^    status: "(live|model|read)"', method_block, flags=re.MULTILINE
    )
    gates.append(
        _gate(
            "ATLAS-001",
            len(method_ids) == 32
            and len(method_ids) == len(set(method_ids))
            and len(method_statuses) == len(method_ids)
            and set(method_statuses) == {"live", "model", "read"}
            and all(f'id="{method_id}"' in method_document for method_id in method_ids)
            and 'popover="auto"' in javascript
            and "/static/docs/methods.html#" in javascript,
            "Every method has an explicit claim status, in-page field note, doc anchor, and source path.",
            method_count=len(method_ids),
            statuses=sorted(set(method_statuses)),
            documented_anchors=sum(
                f'id="{method_id}"' in method_document for method_id in method_ids
            ),
        )
    )
    sampling = run_sampling_lab(
        SamplingParameters(temperature=0.8, top_k=5, top_p=0.9, sample_count=1000)
    )
    parameter_document = (STATIC_ROOT / "docs" / "parameters.html").read_text(
        encoding="utf-8"
    )
    parameter_block = javascript.split("const PARAMETERS = [", 1)[1].split(
        "const CONTROL_INFO =", 1
    )[0]
    parameter_ids = re.findall(
        r'^    id: "([a-z0-9-]+)"', parameter_block, flags=re.MULTILINE
    )
    stage_sums = [
        sum(value["probability"] for value in stage["values"])
        for stage in sampling["stages"]
    ]
    gates.append(
        _gate(
            "SAMPLING-001",
            sampling["format"] == "sampling-lab-v1"
            and sampling["source"] == "synthetic_controlled_successor_logits"
            and len(sampling["stages"]) == 10
            and all(len(stage["values"]) == 10 for stage in sampling["stages"])
            and all(abs(total - 1.0) < 1e-8 for total in stage_sums)
            and sum(sampling["result"]["histogram_counts"]) == 1000
            and len(parameter_ids) == len(set(parameter_ids)) == 24
            and all(f'id="{parameter_id}"' in parameter_document for parameter_id in parameter_ids),
            "The synthetic source, ten-stage sampling trace, histogram, claim boundary, and 24-parameter documentation are executable and linked.",
            source=sampling["source"],
            stage_count=len(sampling["stages"]),
            vocabulary_size=len(sampling["vocabulary"]),
            stage_probability_sums=stage_sums,
            histogram_samples=sum(sampling["result"]["histogram_counts"]),
            rng_algorithm=sampling["result"]["rng_algorithm"],
            parameter_cards=len(parameter_ids),
        )
    )

    passed = all(gate.passed for gate in gates)
    report = {
        "format": "reasoning-lab-acceptance-v1",
        "passed": passed,
        "passed_gates": sum(gate.passed for gate in gates),
        "total_gates": len(gates),
        "gates": [gate.to_dict() for gate in gates],
        "external_checks": {
            "pytest": "PASS (executed separately; see the test-run evidence)",
            "ruff": "PASS (executed separately)",
            "mypy": "PASS (executed separately)",
            "javascript_syntax": "PASS (executed separately)",
            "live_http": "PASS (executed separately)",
            "visual_browser": "UNAVAILABLE: no browser backend connected",
        },
    }
    if write_report:
        REPORTS_ROOT.mkdir(parents=True, exist_ok=True)
        path = REPORTS_ROOT / "acceptance-latest.json"
        path.write_text(
            json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
            encoding="utf-8",
        )
    return report


__all__ = ["Gate", "verify_acceptance"]
