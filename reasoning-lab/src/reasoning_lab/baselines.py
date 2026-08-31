from __future__ import annotations

import hashlib
import json
import os
import uuid
from collections import Counter
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any

NGRAM_FORMAT = "reasoning-lab-ngram-v1"


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha256(value: object) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def _token(token: object, vocab_size: int) -> int:
    if isinstance(token, bool) or not isinstance(token, int):
        raise TypeError("NGRAM_TOKEN_MUST_BE_AN_INTEGER")
    if not 0 <= token < vocab_size:
        raise ValueError(f"NGRAM_TOKEN_OUT_OF_VOCABULARY: {token}")
    return token


class NGramLanguageModel:
    """A count-based, greedily decoded n-gram language-model baseline.

    ``order`` follows the conventional definition: an order-n model uses at
    most n-1 preceding tokens.  Counts are retained for every shorter context,
    which provides deterministic backoff.  Equal counts are resolved in favor
    of the numerically smaller token; this baseline never samples.
    """

    def __init__(self, order: int, vocab_size: int) -> None:
        if isinstance(order, bool) or not isinstance(order, int):
            raise TypeError("NGRAM_ORDER_MUST_BE_AN_INTEGER")
        if order <= 0:
            raise ValueError("NGRAM_ORDER_MUST_BE_POSITIVE")
        if isinstance(vocab_size, bool) or not isinstance(vocab_size, int):
            raise TypeError("NGRAM_VOCAB_SIZE_MUST_BE_AN_INTEGER")
        if vocab_size <= 1:
            raise ValueError("NGRAM_VOCAB_SIZE_MUST_EXCEED_ONE")
        self.order = order
        self.vocab_size = vocab_size
        self._counts: dict[tuple[int, ...], Counter[int]] = {}

    @property
    def observations(self) -> int:
        return sum(self._counts.get((), {}).values())

    @property
    def context_count(self) -> int:
        return len(self._counts)

    @property
    def model_sha256(self) -> str:
        return _sha256(self._protected_payload())

    def clear(self) -> None:
        self._counts.clear()

    def partial_fit(self, sequences: Iterable[Sequence[int]]) -> NGramLanguageModel:
        """Add token-transition counts without discarding existing counts."""

        observed_sequence = False
        for raw_sequence in sequences:
            sequence = tuple(_token(value, self.vocab_size) for value in raw_sequence)
            if not sequence:
                raise ValueError("NGRAM_SEQUENCE_MUST_NOT_BE_EMPTY")
            observed_sequence = True
            for target_index, target in enumerate(sequence):
                maximum_context = min(self.order - 1, target_index)
                for context_size in range(maximum_context + 1):
                    start = target_index - context_size
                    context = sequence[start:target_index]
                    self._counts.setdefault(context, Counter())[target] += 1
        if not observed_sequence:
            raise ValueError("NGRAM_TRAINING_SET_MUST_NOT_BE_EMPTY")
        return self

    def fit(self, sequences: Iterable[Sequence[int]]) -> NGramLanguageModel:
        """Replace counts with observations from ``sequences`` and return self."""

        self.clear()
        return self.partial_fit(sequences)

    def next_token_counts(self, context: Sequence[int]) -> dict[int, int]:
        """Return counts from the longest observed suffix, with deterministic backoff."""

        normalized = tuple(_token(value, self.vocab_size) for value in context)
        maximum_context = min(self.order - 1, len(normalized))
        for context_size in range(maximum_context, -1, -1):
            suffix = normalized[-context_size:] if context_size else ()
            counts = self._counts.get(suffix)
            if counts:
                return dict(sorted(counts.items()))
        raise RuntimeError("NGRAM_MODEL_HAS_NO_OBSERVATIONS")

    def predict_next(self, context: Sequence[int]) -> int:
        counts = self.next_token_counts(context)
        return min(counts, key=lambda token_id: (-counts[token_id], token_id))

    def generate(
        self,
        prompt: Sequence[int],
        max_new_tokens: int,
        *,
        stop_token_id: int | None = None,
        include_prompt: bool = True,
    ) -> tuple[int, ...]:
        """Greedily generate a deterministic continuation.

        By default the returned tuple contains both prompt and continuation,
        matching the common autoregressive generation API.  A generated stop
        token is included in the result.
        """

        if isinstance(max_new_tokens, bool) or not isinstance(max_new_tokens, int):
            raise TypeError("MAX_NEW_TOKENS_MUST_BE_AN_INTEGER")
        if max_new_tokens < 0:
            raise ValueError("MAX_NEW_TOKENS_MUST_BE_NON_NEGATIVE")
        normalized_prompt = tuple(_token(value, self.vocab_size) for value in prompt)
        if stop_token_id is not None:
            stop_token_id = _token(stop_token_id, self.vocab_size)
        generated = list(normalized_prompt)
        continuation: list[int] = []
        for _ in range(max_new_tokens):
            token_id = self.predict_next(generated)
            generated.append(token_id)
            continuation.append(token_id)
            if token_id == stop_token_id:
                break
        return tuple(generated if include_prompt else continuation)

    def _count_records(self) -> list[dict[str, object]]:
        return [
            {
                "context": list(context),
                "next": [[token_id, count] for token_id, count in sorted(counts.items())],
            }
            for context, counts in sorted(
                self._counts.items(), key=lambda item: (len(item[0]), item[0])
            )
        ]

    def _protected_payload(self) -> dict[str, object]:
        return {
            "format": NGRAM_FORMAT,
            "order": self.order,
            "vocab_size": self.vocab_size,
            "counts": self._count_records(),
        }

    def to_dict(self) -> dict[str, object]:
        protected = self._protected_payload()
        return {**protected, "model_sha256": _sha256(protected)}

    def save(self, path: Path | str) -> dict[str, object]:
        """Atomically write a deterministic JSON count checkpoint."""

        if not self.observations:
            raise RuntimeError("NGRAM_MODEL_HAS_NO_OBSERVATIONS")
        destination = Path(path).expanduser().resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        payload = self.to_dict()
        temporary = destination.with_name(f".{destination.name}.{uuid.uuid4().hex}.tmp")
        try:
            temporary.write_text(
                json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
                encoding="utf-8",
            )
            os.replace(temporary, destination)
        finally:
            if temporary.exists():
                temporary.unlink()
        return payload

    @classmethod
    def load(cls, path: Path | str) -> NGramLanguageModel:
        source = Path(path).expanduser().resolve()
        decoded: Any = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(decoded, dict):
            raise TypeError("NGRAM_CHECKPOINT_MUST_BE_AN_OBJECT")
        payload: dict[str, Any] = decoded
        protected = {key: value for key, value in payload.items() if key != "model_sha256"}
        if payload.get("model_sha256") != _sha256(protected):
            raise ValueError("NGRAM_CHECKPOINT_SHA256_MISMATCH")
        if protected.get("format") != NGRAM_FORMAT:
            raise ValueError("UNSUPPORTED_NGRAM_CHECKPOINT_FORMAT")
        order = protected.get("order")
        vocab_size = protected.get("vocab_size")
        if isinstance(order, bool) or not isinstance(order, int):
            raise TypeError("NGRAM_CHECKPOINT_ORDER_MUST_BE_AN_INTEGER")
        if isinstance(vocab_size, bool) or not isinstance(vocab_size, int):
            raise TypeError("NGRAM_CHECKPOINT_VOCAB_SIZE_MUST_BE_AN_INTEGER")
        model = cls(order=order, vocab_size=vocab_size)
        raw_records = protected.get("counts")
        if not isinstance(raw_records, list):
            raise TypeError("NGRAM_COUNTS_MUST_BE_A_LIST")
        reconstructed: dict[tuple[int, ...], Counter[int]] = {}
        for raw_record in raw_records:
            if not isinstance(raw_record, dict):
                raise TypeError("NGRAM_COUNT_RECORD_MUST_BE_AN_OBJECT")
            raw_context = raw_record.get("context")
            raw_next = raw_record.get("next")
            if not isinstance(raw_context, list) or not isinstance(raw_next, list):
                raise TypeError("NGRAM_COUNT_RECORD_FIELDS_MUST_BE_LISTS")
            context = tuple(_token(value, model.vocab_size) for value in raw_context)
            if len(context) >= model.order:
                raise ValueError("NGRAM_CONTEXT_EXCEEDS_MODEL_ORDER")
            if context in reconstructed:
                raise ValueError("NGRAM_CHECKPOINT_HAS_DUPLICATE_CONTEXT")
            counts: Counter[int] = Counter()
            for pair in raw_next:
                if not isinstance(pair, list) or len(pair) != 2:
                    raise TypeError("NGRAM_NEXT_COUNT_MUST_BE_A_TOKEN_COUNT_PAIR")
                token_id = _token(pair[0], model.vocab_size)
                count = pair[1]
                if isinstance(count, bool) or not isinstance(count, int):
                    raise TypeError("NGRAM_COUNT_MUST_BE_AN_INTEGER")
                if count <= 0:
                    raise ValueError("NGRAM_COUNT_MUST_BE_POSITIVE")
                if token_id in counts:
                    raise ValueError("NGRAM_CHECKPOINT_HAS_DUPLICATE_NEXT_TOKEN")
                counts[token_id] = count
            if not counts:
                raise ValueError("NGRAM_CONTEXT_COUNTS_MUST_NOT_BE_EMPTY")
            reconstructed[context] = counts
        if () not in reconstructed:
            raise ValueError("NGRAM_CHECKPOINT_HAS_NO_UNIGRAM_COUNTS")
        model._counts = reconstructed
        if model.model_sha256 != payload["model_sha256"]:
            raise ValueError("NGRAM_RECONSTRUCTED_MODEL_SHA256_MISMATCH")
        return model


__all__ = ["NGRAM_FORMAT", "NGramLanguageModel"]
