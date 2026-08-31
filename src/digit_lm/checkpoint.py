from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch
from safetensors import safe_open
from safetensors.torch import load_file, save_file
from torch import Tensor

from digit_lm.config import ModelConfig
from digit_lm.hashing import canonical_json, sha256_file, sha256_text
from digit_lm.model import DigitTransformer


@dataclass(frozen=True, slots=True)
class LoadedCheckpoint:
    model: DigitTransformer
    metadata: dict[str, Any]
    directory: Path


def tensor_state_sha256(state: dict[str, Tensor]) -> str:
    """Hash tensor names, shapes, dtypes and bytes independently of file metadata."""

    digest = hashlib.sha256()
    for name in sorted(state):
        tensor = state[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tuple(tensor.shape)).encode("ascii"))
        digest.update(str(tensor.dtype).encode("ascii"))
        # Viewing as uint8 exposes the tensor's raw bytes without a NumPy dependency.
        digest.update(bytes(tensor.view(torch.uint8).reshape(-1).tolist()))
    return digest.hexdigest()


def _clean_state(model: DigitTransformer) -> dict[str, Tensor]:
    return {name: tensor.detach().cpu().contiguous() for name, tensor in model.state_dict().items()}


def save_checkpoint(
    directory: Path,
    *,
    model: DigitTransformer,
    metadata: dict[str, Any],
    optimizer: torch.optim.Optimizer,
    step: int,
    metrics: list[dict[str, Any]],
    sampler_state: dict[str, Any],
) -> dict[str, Any]:
    directory.mkdir(parents=True, exist_ok=False)
    state = _clean_state(model)
    weights_path = directory / "model.safetensors"
    tensor_sha256 = tensor_state_sha256(state)
    embedded_metadata = {
        "format": "digit-lm-state-dict-v2",
        "run_id": str(metadata["run_id"]),
        "vocabulary": "0123456789",
        "tensor_sha256": tensor_sha256,
        "dataset_manifest_sha256": str(metadata["dataset_manifest_sha256"]),
        "parent_tensor_sha256": str(metadata.get("parent_tensor_sha256") or "none"),
        "parent_run_id": str(metadata.get("parent_run_id") or "none"),
        "stage": str(metadata["stage"]),
        "seed": str(metadata["seed"]),
        "device": str(metadata["device"]),
        "model_config_sha256": sha256_text(canonical_json(model.config.to_dict())),
        "train_config_sha256": sha256_text(canonical_json(metadata["train_config"])),
        "source_fingerprint_sha256": str(metadata["environment"]["source_fingerprint_sha256"]),
    }
    save_file(
        state,
        weights_path,
        metadata=embedded_metadata,
    )
    checkpoint_sha256 = sha256_file(weights_path)

    training_state_path = directory / "training_state.pt"
    torch.save(
        {
            "optimizer_state_dict": optimizer.state_dict(),
            "step": step,
            "torch_rng_state": torch.get_rng_state(),
            "sampler_state": sampler_state,
        },
        training_state_path,
    )
    training_state_sha256 = sha256_file(training_state_path)

    complete_metadata = {
        **metadata,
        "format": "digit-lm-checkpoint-v2",
        "model_config": model.config.to_dict(),
        "parameter_count": model.parameter_count(),
        "checkpoint_sha256": checkpoint_sha256,
        "tensor_sha256": tensor_sha256,
        "training_state_sha256": training_state_sha256,
        "weights_file": weights_path.name,
        "training_state_file": training_state_path.name,
    }
    (directory / "checkpoint.json").write_text(
        json.dumps(complete_metadata, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    (directory / "metrics.json").write_text(
        json.dumps(metrics, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    (directory / "tokenizer.json").write_text(
        json.dumps(
            {
                "tokens": list("0123456789"),
                "token_to_id": {str(index): index for index in range(10)},
                "special_tokens": [],
            },
            ensure_ascii=False,
            sort_keys=True,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return complete_metadata


def load_checkpoint(directory_or_file: Path, *, verify_hash: bool = True) -> LoadedCheckpoint:
    directory = directory_or_file if directory_or_file.is_dir() else directory_or_file.parent
    metadata_path = directory / "checkpoint.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    weights_path = directory / str(metadata["weights_file"])
    if verify_hash and sha256_file(weights_path) != metadata["checkpoint_sha256"]:
        raise ValueError("CHECKPOINT_SHA256_MISMATCH")
    with safe_open(weights_path, framework="pt", device="cpu") as handle:
        embedded = handle.metadata()
    legacy_expected = {
        "format": "digit-lm-state-dict-v1",
        "run_id": str(metadata["run_id"]),
        "vocabulary": "0123456789",
        "tensor_sha256": str(metadata["tensor_sha256"]),
        "dataset_manifest_sha256": str(metadata["dataset_manifest_sha256"]),
        "parent_tensor_sha256": str(metadata.get("parent_tensor_sha256") or "none"),
    }
    hardened_expected = {
        **legacy_expected,
        "format": "digit-lm-state-dict-v2",
        "parent_run_id": str(metadata.get("parent_run_id") or "none"),
        "stage": str(metadata["stage"]),
        "seed": str(metadata["seed"]),
        "device": str(metadata["device"]),
        "model_config_sha256": sha256_text(canonical_json(metadata["model_config"])),
        "train_config_sha256": sha256_text(canonical_json(metadata["train_config"])),
        "source_fingerprint_sha256": str(metadata["environment"]["source_fingerprint_sha256"]),
    }
    expected_embedded = (
        legacy_expected
        if embedded is not None and embedded.get("format") == "digit-lm-state-dict-v1"
        else hardened_expected
    )
    if embedded != expected_embedded:
        raise ValueError("SAFETENSORS_EMBEDDED_METADATA_MISMATCH")
    state = load_file(weights_path, device="cpu")
    if verify_hash and tensor_state_sha256(state) != metadata["tensor_sha256"]:
        raise ValueError("CHECKPOINT_TENSOR_SHA256_MISMATCH")
    model = DigitTransformer(ModelConfig.from_dict(metadata["model_config"]))
    model.load_state_dict(state, strict=True)
    model.eval()
    return LoadedCheckpoint(model=model, metadata=metadata, directory=directory)


def load_trusted_training_state(directory: Path) -> dict[str, Any]:
    """Resume-only local state; never call this for an uploaded or untrusted artifact."""

    metadata = json.loads((directory / "checkpoint.json").read_text(encoding="utf-8"))
    state_path = directory / str(metadata["training_state_file"])
    if sha256_file(state_path) != metadata["training_state_sha256"]:
        raise ValueError("TRAINING_STATE_SHA256_MISMATCH")
    loaded = torch.load(state_path, map_location="cpu", weights_only=True)
    if not isinstance(loaded, dict):
        raise TypeError("TRAINING_STATE_MUST_BE_A_DICTIONARY")
    return loaded
