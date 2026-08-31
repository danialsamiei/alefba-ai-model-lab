from __future__ import annotations

import hashlib
from collections.abc import Iterable, Sequence
from types import MappingProxyType
from typing import Final

PAD_TOKEN: Final = "<PAD>"
BOS_TOKEN: Final = "<BOS>"
EOS_TOKEN: Final = "<EOS>"
PROMPT_TOKEN: Final = "<PROMPT>"
SCRATCH_TOKEN: Final = "<SCRATCH>"
CALL_TOKEN: Final = "<CALL>"
OBS_TOKEN: Final = "<OBS>"
FINAL_TOKEN: Final = "<FINAL>"
EOT_TOKEN: Final = "<EOT>"

SPECIAL_TOKENS: Final[tuple[str, ...]] = (
    PAD_TOKEN,
    BOS_TOKEN,
    EOS_TOKEN,
    PROMPT_TOKEN,
    SCRATCH_TOKEN,
    CALL_TOKEN,
    OBS_TOKEN,
    FINAL_TOKEN,
    EOT_TOKEN,
)

# The vocabulary deliberately has no unknown token.  The generated curriculum is
# a closed language, so accepting an out-of-language character would conceal a
# data-generation bug and make a supposedly reproducible run tokenizer-dependent.
TEXT_TOKENS: Final[tuple[str, ...]] = (
    "WORLD",
    "QUERY",
    "TRACE",
    "RESULT",
    "EVAL",
    "LOOKUP",
    "CALC",
    "GET",
    "ADD",
    "SUB",
    "MUL",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "(",
    ")",
    ",",
    "=",
    ";",
    " ",
)

VOCABULARY: Final[tuple[str, ...]] = SPECIAL_TOKENS + TEXT_TOKENS


class TokenizationError(ValueError):
    """Raised when text is outside the curriculum's closed vocabulary."""


class FixedTokenizer:
    """A deterministic longest-match tokenizer for the curriculum DSL.

    A regular ASCII space is an explicit token because host tool calls use a
    whitespace-delimited grammar.  Other whitespace is insignificant.  There
    is intentionally no ``UNK`` token: unknown input fails with a source
    position instead of being silently collapsed.
    """

    def __init__(self) -> None:
        if len(VOCABULARY) != len(set(VOCABULARY)):
            raise RuntimeError("TOKENIZER_VOCABULARY_CONTAINS_DUPLICATES")
        if any("UNK" in token.upper() for token in VOCABULARY):
            raise RuntimeError("TOKENIZER_MUST_NOT_DEFINE_AN_UNKNOWN_TOKEN")
        self._id_to_token = VOCABULARY
        self._token_to_id = MappingProxyType(
            {token: token_id for token_id, token in enumerate(self._id_to_token)}
        )
        # Longest match is required because, for example, ADD and A share a
        # prefix.  The vocabulary index is the deterministic tie-breaker.
        self._scan_tokens = tuple(
            sorted(
                self._id_to_token,
                key=lambda token: (-len(token), self._token_to_id[token]),
            )
        )

    @property
    def vocab_size(self) -> int:
        return len(self._id_to_token)

    def __len__(self) -> int:
        return self.vocab_size

    @property
    def vocabulary(self) -> tuple[str, ...]:
        return self._id_to_token

    @property
    def special_tokens(self) -> tuple[str, ...]:
        return SPECIAL_TOKENS

    @property
    def token_to_id(self) -> MappingProxyType[str, int]:
        return self._token_to_id

    @property
    def id_to_token(self) -> tuple[str, ...]:
        return self._id_to_token

    @property
    def pad_id(self) -> int:
        return self._token_to_id[PAD_TOKEN]

    @property
    def bos_id(self) -> int:
        return self._token_to_id[BOS_TOKEN]

    @property
    def eos_id(self) -> int:
        return self._token_to_id[EOS_TOKEN]

    @property
    def vocabulary_sha256(self) -> str:
        payload = "\n".join(self._id_to_token).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def token_id(self, token: str) -> int:
        try:
            return self._token_to_id[token]
        except KeyError as error:
            raise TokenizationError(f"TOKEN_NOT_IN_FIXED_VOCABULARY: {token!r}") from error

    def token_for_id(self, token_id: int) -> str:
        if isinstance(token_id, bool) or not isinstance(token_id, int):
            raise TypeError("TOKEN_ID_MUST_BE_AN_INTEGER")
        if not 0 <= token_id < self.vocab_size:
            raise TokenizationError(f"TOKEN_ID_OUT_OF_RANGE: {token_id}")
        return self._id_to_token[token_id]

    def tokenize(self, text: str) -> tuple[str, ...]:
        if not isinstance(text, str):
            raise TypeError("TOKENIZER_INPUT_MUST_BE_TEXT")
        tokens: list[str] = []
        position = 0
        while position < len(text):
            if text[position].isspace() and text[position] != " ":
                position += 1
                continue
            match = next(
                (token for token in self._scan_tokens if text.startswith(token, position)),
                None,
            )
            if match is None:
                excerpt = text[position : position + 16]
                raise TokenizationError(f"OUT_OF_VOCABULARY_TEXT_AT_{position}: {excerpt!r}")
            tokens.append(match)
            position += len(match)
        return tuple(tokens)

    def encode_tokens(self, tokens: Iterable[str]) -> tuple[int, ...]:
        return tuple(self.token_id(token) for token in tokens)

    def encode(
        self,
        text: str,
        *,
        add_bos: bool = False,
        add_eos: bool = False,
    ) -> tuple[int, ...]:
        token_ids = list(self.encode_tokens(self.tokenize(text)))
        if add_bos:
            token_ids.insert(0, self.bos_id)
        if add_eos:
            token_ids.append(self.eos_id)
        return tuple(token_ids)

    def decode(
        self,
        token_ids: Sequence[int],
        *,
        skip_special_tokens: bool = False,
    ) -> str:
        tokens = (self.token_for_id(token_id) for token_id in token_ids)
        if skip_special_tokens:
            return "".join(token for token in tokens if token not in SPECIAL_TOKENS)
        return "".join(tokens)

    def to_dict(self) -> dict[str, object]:
        return {
            "type": "fixed",
            "vocabulary": list(self._id_to_token),
            "special_tokens": list(SPECIAL_TOKENS),
            "vocabulary_sha256": self.vocabulary_sha256,
            "has_unknown_token": False,
        }


TOKENIZER: Final = FixedTokenizer()


def get_tokenizer() -> FixedTokenizer:
    """Return the stateless process-wide tokenizer instance."""

    return TOKENIZER


__all__ = [
    "BOS_TOKEN",
    "CALL_TOKEN",
    "EOS_TOKEN",
    "EOT_TOKEN",
    "FINAL_TOKEN",
    "OBS_TOKEN",
    "PAD_TOKEN",
    "PROMPT_TOKEN",
    "SCRATCH_TOKEN",
    "SPECIAL_TOKENS",
    "TEXT_TOKENS",
    "TOKENIZER",
    "VOCABULARY",
    "FixedTokenizer",
    "TokenizationError",
    "get_tokenizer",
]
