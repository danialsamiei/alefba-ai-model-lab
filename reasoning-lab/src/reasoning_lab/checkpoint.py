from __future__ import annotations

import hashlib
import json
import os
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch
from safetensors import safe_open
from safetensors.torch import load_file, save_file
from torch import Tensor

from reasoning_lab.config import ModelConfig
from reasoning_lab.models import (
    LanguageModel,
    build_model,
    canonical_model_kind,
)

CHECKPOINT_FORMAT = "reasoning-lab-checkpoint-v1"
STATE_DICT_FORMAT = "reasoning-lab-state-dict-v1"
_DERIVED_METADATA_KEYS = {
    "metadata_sha256",
    "tensor_sha256",
    "checkpoint_sha256",
    "weights_file",
}
_RESERVED_METADATA_KEYS = {
    "format",
    "model_kind",
    "model_config",
    "vocab_size",
    "parameter_counts",
    *_DERIVED_METADATA_KEYS,
}


@dataclass(frozen=True, slots=True)
class LoadedCheckpoint:
    model: LanguageModel
    metadata: dict[str, Any]
    directory: Path


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tensor_state_sha256(state: Mapping[str, Tensor]) -> str:
    """Hash names, shapes, dtypes, and raw tensor bytes independent of file layout."""

    digest = hashlib.sha256()
    for name in sorted(state):
        tensor = state[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(tuple(tensor.shape)).encode("ascii"))
        digest.update(b"\0")
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(b"\0")
        digest.update(tensor.view(torch.uint8).numpy().tobytes())
    return digest.hexdigest()


def _clean_state(model: LanguageModel) -> dict[str, Tensor]:
    return {name: tensor.detach().cpu().contiguous() for name, tensor in model.state_dict().items()}


def _atomic_write_json(path: Path, value: dict[str, Any]) -> None:
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)


def save_checkpoint(
    directory: Path,
    *,
    model: LanguageModel,
    metadata: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Save inference-safe tensors plus a sidecar bound to embedded metadata."""

    directory = directory.resolve()
    directory.mkdir(parents=True, exist_ok=False)
    supplied = dict(metadata or {})
    collisions = sorted(_RESERVED_METADATA_KEYS.intersection(supplied))
    if collisions:
        raise ValueError(f"RESERVED_CHECKPOINT_METADATA_KEYS: {','.join(collisions)}")

    protected_metadata: dict[str, Any] = {
        **supplied,
        "format": CHECKPOINT_FORMAT,
        "model_kind": canonical_model_kind(model.model_kind),
        "model_config": model.config.to_dict(),
        "vocab_size": model.vocab_size,
        "parameter_counts": model.parameter_counts(),
    }
    # Fail before writing tensors if caller metadata is not JSON-serializable.
    metadata_sha256 = _sha256_text(_canonical_json(protected_metadata))
    state = _clean_state(model)
    tensor_sha256 = tensor_state_sha256(state)
    weights_path = directory / "model.safetensors"
    embedded_metadata = {
        "format": STATE_DICT_FORMAT,
        "model_kind": model.model_kind,
        "vocab_size": str(model.vocab_size),
        "tensor_sha256": tensor_sha256,
        "metadata_sha256": metadata_sha256,
    }
    save_file(state, weights_path, metadata=embedded_metadata)
    checkpoint_sha256 = _sha256_file(weights_path)
    complete_metadata = {
        **protected_metadata,
        "metadata_sha256": metadata_sha256,
        "tensor_sha256": tensor_sha256,
        "checkpoint_sha256": checkpoint_sha256,
        "weights_file": weights_path.name,
    }
    _atomic_write_json(directory / "checkpoint.json", complete_metadata)
    return complete_metadata


def _safe_child(directory: Path, filename: object) -> Path:
    if not isinstance(filename, str) or not filename or Path(filename).name != filename:
        raise ValueError("CHECKPOINT_WEIGHTS_FILE_MUST_BE_A_BASENAME")
    path = (directory / filename).resolve()
    if path.parent != directory.resolve():
        raise ValueError("CHECKPOINT_WEIGHTS_PATH_ESCAPES_DIRECTORY")
    return path


def load_checkpoint(
    directory_or_file: Path,
    *,
    verify_hash: bool = True,
) -> LoadedCheckpoint:
    directory_or_file = directory_or_file.resolve()
    directory = directory_or_file if directory_or_file.is_dir() else directory_or_file.parent
    metadata_path = directory / "checkpoint.json"
    decoded = json.loads(metadata_path.read_text(encoding="utf-8"))
    if not isinstance(decoded, dict):
        raise TypeError("CHECKPOINT_METADATA_MUST_BE_AN_OBJECT")
    metadata: dict[str, Any] = decoded
    protected_metadata = {
        key: value for key, value in metadata.items() if key not in _DERIVED_METADATA_KEYS
    }
    actual_metadata_sha256 = _sha256_text(_canonical_json(protected_metadata))
    if actual_metadata_sha256 != metadata.get("metadata_sha256"):
        raise ValueError("CHECKPOINT_METADATA_SHA256_MISMATCH")
    if metadata.get("format") != CHECKPOINT_FORMAT:
        raise ValueError("UNSUPPORTED_CHECKPOINT_FORMAT")

    weights_path = _safe_child(directory, metadata.get("weights_file"))
    if verify_hash and _sha256_file(weights_path) != metadata.get("checkpoint_sha256"):
        raise ValueError("CHECKPOINT_FILE_SHA256_MISMATCH")
    expected_embedded = {
        "format": STATE_DICT_FORMAT,
        "model_kind": str(metadata["model_kind"]),
        "vocab_size": str(metadata["vocab_size"]),
        "tensor_sha256": str(metadata["tensor_sha256"]),
        "metadata_sha256": str(metadata["metadata_sha256"]),
    }
    with safe_open(weights_path, framework="pt", device="cpu") as handle:
        embedded = handle.metadata()
    if embedded != expected_embedded:
        raise ValueError("SAFETENSORS_EMBEDDED_METADATA_MISMATCH")

    state = load_file(weights_path, device="cpu")
    if verify_hash and tensor_state_sha256(state) != metadata.get("tensor_sha256"):
        raise ValueError("CHECKPOINT_TENSOR_SHA256_MISMATCH")
    raw_model_config = metadata.get("model_config")
    if not isinstance(raw_model_config, dict):
        raise TypeError("CHECKPOINT_MODEL_CONFIG_MUST_BE_AN_OBJECT")
    config = ModelConfig.from_dict(raw_model_config)
    model = build_model(
        str(metadata["model_kind"]),
        config,
        int(metadata["vocab_size"]),
    )
    model.load_state_dict(state, strict=True)
    if model.parameter_counts() != metadata.get("parameter_counts"):
        raise ValueError("CHECKPOINT_PARAMETER_COUNTS_MISMATCH")
    model.eval()
    return LoadedCheckpoint(model=model, metadata=metadata, directory=directory)
