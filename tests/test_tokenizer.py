from __future__ import annotations

import pytest

from digit_lm.tokenizer import DigitTokenizer, TokenizerError


def test_vocabulary_is_exactly_the_ten_ascii_digits() -> None:
    tokenizer = DigitTokenizer()
    assert tokenizer.vocab_size == 10
    assert tokenizer.tokens == tuple("0123456789")
    assert tokenizer.vocabulary() == {str(index): index for index in range(10)}


def test_every_token_round_trips() -> None:
    tokenizer = DigitTokenizer()
    assert tokenizer.decode(tokenizer.encode("0123456789")) == "0123456789"


@pytest.mark.parametrize("text", ["", "10", " 4", "4 ", "A", "۹", "٤", "+4", "4.0"])
def test_single_digit_contract_rejects_everything_else(text: str) -> None:
    with pytest.raises(TokenizerError):
        DigitTokenizer().encode_one(text)


def test_decoder_rejects_ids_outside_vocabulary() -> None:
    with pytest.raises(TokenizerError, match="TOKEN_ID_OUT_OF_VOCAB"):
        DigitTokenizer().decode([10])
