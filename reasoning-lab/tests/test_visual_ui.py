from __future__ import annotations

import re
from html.parser import HTMLParser

from reasoning_lab.api import STATIC_ROOT


class _StructureParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.journey_stages: list[str] = []
        self.pipeline_stages: list[str] = []
        self.tab_controls: list[str] = []

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        attributes = dict(attrs)
        if element_id := attributes.get("id"):
            self.ids.append(element_id)
        if stage := attributes.get("data-journey"):
            self.journey_stages.append(stage)
        if stage := attributes.get("data-stage"):
            self.pipeline_stages.append(stage)
        if (
            tag == "button"
            and attributes.get("role") == "tab"
            and (control := attributes.get("aria-controls"))
        ):
            self.tab_controls.append(control)


class _MethodDocParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.method_ids: list[str] = []
        self.external_links: dict[str, list[dict[str, str]]] = {}
        self._current_method: str | None = None

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        attributes = {key: value or "" for key, value in attrs}
        classes = set(attributes.get("class", "").split())
        if tag == "article" and "method" in classes:
            self._current_method = attributes.get("id")
            if self._current_method:
                self.method_ids.append(self._current_method)
                self.external_links[self._current_method] = []
        if tag == "a" and self._current_method and attributes.get("href", "").startswith("https"):
            self.external_links[self._current_method].append(attributes)

    def handle_endtag(self, tag: str) -> None:
        if tag == "article":
            self._current_method = None


class _ParameterDocParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parameter_ids: list[str] = []
        self.external_links: dict[str, list[dict[str, str]]] = {}
        self._current_parameter: str | None = None

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        attributes = {key: value or "" for key, value in attrs}
        if tag == "article" and (parameter_id := attributes.get("id")):
            self._current_parameter = parameter_id
            self.parameter_ids.append(parameter_id)
            self.external_links[parameter_id] = []
        if (
            tag == "a"
            and self._current_parameter
            and attributes.get("href", "").startswith("https")
        ):
            self.external_links[self._current_parameter].append(attributes)

    def handle_endtag(self, tag: str) -> None:
        if tag == "article":
            self._current_parameter = None


def test_visual_atlas_has_complete_unique_accessible_structure() -> None:
    html = (STATIC_ROOT / "index.html").read_text(encoding="utf-8")
    parser = _StructureParser()
    parser.feed(html)
    stages = [
        "problem",
        "tokenize",
        "context",
        "model",
        "generate",
        "select",
        "result",
    ]

    assert '<html lang="fa" dir="rtl">' in html
    assert parser.journey_stages == stages
    assert parser.pipeline_stages == stages
    assert len(parser.ids) == len(set(parser.ids))
    assert set(parser.tab_controls).issubset(parser.ids)
    assert "اطلس زندهٔ یک تصمیم" in html
    assert "نتیجه و برداشت" in html
    assert "مسیر داده → آموزش از صفر → checkpoint" in html
    assert "split-ledger" in parser.ids
    assert "checkpoint-ledger" in parser.ids


def test_visual_copy_keeps_model_host_and_reference_boundaries_explicit() -> None:
    html = (STATIC_ROOT / "index.html").read_text(encoding="utf-8")
    javascript = (STATIC_ROOT / "app.js").read_text(encoding="utf-8")
    stylesheet = (STATIC_ROOT / "style.css").read_text(encoding="utf-8")

    assert "دادهٔ ورودی" in html
    assert "محاسبهٔ مدل" in html
    assert "کمک بیرونی" in html
    assert "تصمیم میزبان" in html
    assert "مرجع ارزیابی" in html
    assert "scripted_ast_controller" in javascript
    assert "scratchpad رشتهٔ عمومی" in javascript
    assert "post_constraint_temperature_top_k" not in html
    assert "prefers-reduced-motion" in stylesheet
    assert "attention-table" in stylesheet


def test_visual_javascript_uses_mode_specific_paths_and_true_chosen_token() -> None:
    javascript = (STATIC_ROOT / "app.js").read_text(encoding="utf-8")

    assert 'const STAGES = ["problem", "tokenize", "context", "model"' in javascript
    assert '["tools", "oracle"].includes(state.mode)' in javascript
    assert "String(token) === String(step.token_text || step.token)" in javascript
    assert "model_invoked" in javascript
    assert "canonical_reference" in javascript


def test_method_atlas_has_32_unique_methods_and_explicit_claim_statuses() -> None:
    javascript = (STATIC_ROOT / "app.js").read_text(encoding="utf-8")
    method_block = javascript.split("const METHODS = [", 1)[1].split("const SECTION_INFO =", 1)[0]
    method_ids = re.findall(r'^    id: "([a-z0-9-]+)"', method_block, flags=re.MULTILINE)
    statuses = re.findall(r'^    status: "(live|model|read)"', method_block, flags=re.MULTILINE)

    assert len(method_ids) == 32
    assert len(method_ids) == len(set(method_ids))
    assert len(statuses) == len(method_ids)
    assert set(statuses) == {"live", "model", "read"}
    assert method_block.count("short:") == len(method_ids)
    assert method_block.count("sources:") == len(method_ids)
    assert "اثر علّیِ صرفاً compute نیست" in method_block
    assert "کشف دانش ناشناخته از corpus مستقل نیست" in method_block


def test_every_method_has_a_doc_anchor_and_primary_source_link() -> None:
    javascript = (STATIC_ROOT / "app.js").read_text(encoding="utf-8")
    method_block = javascript.split("const METHODS = [", 1)[1].split("const SECTION_INFO =", 1)[0]
    method_ids = set(re.findall(r'^    id: "([a-z0-9-]+)"', method_block, re.MULTILINE))
    document = (STATIC_ROOT / "docs" / "methods.html").read_text(encoding="utf-8")
    parser = _MethodDocParser()
    parser.feed(document)

    assert set(parser.method_ids) == method_ids
    assert len(parser.method_ids) == len(set(parser.method_ids))
    for method_id in method_ids:
        links = parser.external_links[method_id]
        assert links, f"{method_id} is missing a scientific source"
        assert all(link.get("target") == "_blank" for link in links)
        assert all(link.get("rel") == "noopener noreferrer" for link in links)


def test_native_info_popovers_cover_each_numbered_section_and_method_card() -> None:
    javascript = (STATIC_ROOT / "app.js").read_text(encoding="utf-8")
    stylesheet = (STATIC_ROOT / "style.css").read_text(encoding="utf-8")
    headings = [
        "architecture-heading",
        "controls-heading",
        "stage-heading",
        "journey-heading",
        "microscope-heading",
        "comparison-heading",
        "method-map-heading",
        "sampling-heading",
    ]

    for heading in headings:
        assert f'"{heading}"' in javascript
    assert 'popover="auto"' in javascript
    assert 'popovertarget="' in javascript
    assert 'popovertargetaction="hide"' in javascript
    assert 'aria-label="توضیح کوتاه دربارهٔ ' in javascript
    assert "/static/docs/methods.html#" in javascript
    assert ":popover-open" in stylesheet
    assert ".info-popover::backdrop" in stylesheet
    assert "max-block-size" in stylesheet


def test_sampling_lab_has_three_accessible_levels_and_complete_controls() -> None:
    html = (STATIC_ROOT / "index.html").read_text(encoding="utf-8")
    parser = _StructureParser()
    parser.feed(html)
    expected_ids = {
        "sampling-lab",
        "sampling-heading",
        "sampling-form",
        "sampling-run-status",
        "sampling-viewport",
        "sampling-final-chart",
        "sampling-histogram",
        "sampling-flow",
        "sampling-token-table",
        "parameter-grid",
        "interaction-matrix",
        "interaction-note",
    }
    assert expected_ids.issubset(parser.ids)
    assert {
        "sampling-panel-intuitive",
        "sampling-panel-process",
        "sampling-panel-formula",
    }.issubset(parser.tab_controls)
    assert "ALGORITHM LIVE" in html
    assert "logits این بخش از checkpoint بالا نیامده‌اند" in html
    assert "نه forward pass تازه" in html
    assert "source → additive penalties" in html
    assert html.count('data-parameter-info="') == 15


def test_parameter_atlas_has_24_documented_controls_with_scientific_sources() -> None:
    javascript = (STATIC_ROOT / "app.js").read_text(encoding="utf-8")
    parameter_block = javascript.split("const PARAMETERS = [", 1)[1].split(
        "const CONTROL_INFO =", 1
    )[0]
    parameter_ids = re.findall(r'^    id: "([a-z0-9-]+)"', parameter_block, re.MULTILINE)
    kinds = re.findall(
        r'kind: "(live|orchestrator|vendor|observe)"', parameter_block, re.MULTILINE
    )
    document = (STATIC_ROOT / "docs" / "parameters.html").read_text(encoding="utf-8")
    parser = _ParameterDocParser()
    parser.feed(document)

    assert len(parameter_ids) == 24
    assert len(parameter_ids) == len(set(parameter_ids))
    assert len(kinds) == len(parameter_ids)
    assert set(kinds) == {"live", "orchestrator", "vendor", "observe"}
    assert set(parser.parameter_ids) == set(parameter_ids)
    for parameter_id in parameter_ids:
        links = parser.external_links[parameter_id]
        assert links, f"{parameter_id} is missing a primary or official source"
        assert all(link.get("target") == "_blank" for link in links)
        assert all(link.get("rel") == "noopener noreferrer" for link in links)


def test_sampling_javascript_preserves_parameter_boundaries_and_keyboard_access() -> None:
    javascript = (STATIC_ROOT / "app.js").read_text(encoding="utf-8")
    stylesheet = (STATIC_ROOT / "style.css").read_text(encoding="utf-8")

    assert 'jsonFetch("/api/sampling-lab"' in javascript
    assert "AbortController" in javascript
    assert "top-k بازیابی سند یکی نیست" in javascript
    assert "احتمال توکن نمرهٔ حقیقت" in javascript
    assert "histogram" in javascript and "forward pass" in javascript
    assert 'event.key === "Home"' in javascript
    assert 'event.key === "End"' in javascript
    assert 'aria-current="true"' in javascript
    assert ".sampling-workbench" in stylesheet
    assert ".digit-chart" in stylesheet
    assert ".interaction-map tbody th { position: sticky" in stylesheet
