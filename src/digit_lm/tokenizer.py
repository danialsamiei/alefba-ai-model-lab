from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar


@dataclass(frozen=True, slots=True)
class TokenizerError(ValueError):
    code: str
    text: str

    def __str__(self) -> str:
        return f"{self.code}: {self.text!r}"


class DigitTokenizer:
    """A deliberately tiny tokenizer with no hidden or special tokens."""

    tokens: ClassVar[tuple[str, ...]] = tuple("0123456789")
    token_to_id: ClassVar[dict[str, int]] = {token: index for index, token in enumerate(tokens)}
    id_to_token: ClassVar[dict[int, str]] = {index: token for index, token in enumerate(tokens)}
    vocab_size: ClassVar[int] = 10

    def encode(self, text: str) -> list[int]:
        if not text:
            raise TokenizerError("EMPTY_INPUT", text)
        invalid = [character for character in text if character not in self.token_to_id]
        if invalid:
            raise TokenizerError("TOKEN_OUT_OF_VOCAB", text)
        return [self.token_to_id[character] for character in text]

    def encode_one(self, text: str) -> int:
        if len(text) != 1:
            raise TokenizerError("EXPECTED_ONE_ASCII_DIGIT", text)
        return self.encode(text)[0]

    def decode(self, token_ids: list[int]) -> str:
        if not token_ids:
            raise TokenizerError("EMPTY_TOKEN_SEQUENCE", "")
        try:
            return "".join(self.id_to_token[token_id] for token_id in token_ids)
        except KeyError as error:
            raise TokenizerError("TOKEN_ID_OUT_OF_VOCAB", str(error.args[0])) from error

    def vocabulary(self) -> dict[str, int]:
        return dict(self.token_to_id)
