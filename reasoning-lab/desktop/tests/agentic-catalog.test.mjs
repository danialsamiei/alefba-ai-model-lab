import test from "node:test";
import assert from "node:assert/strict";

import {
  AGENTIC_BY_ID,
  AGENTIC_CATALOG,
  AGENTIC_KIND_LABELS,
  AGENTIC_LAYERS,
  AGENTIC_RELATIONS,
} from "../src/agenticCatalog.js";

const isHttps = (value) => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

test("agentic catalog separates protocols, frameworks, patterns, methods and controls", () => {
  assert.ok(AGENTIC_CATALOG.length >= 24);
  assert.equal(AGENTIC_BY_ID.size, AGENTIC_CATALOG.length);
  assert.equal(new Set(AGENTIC_CATALOG.map((item) => item.id)).size, AGENTIC_CATALOG.length);
  const kinds = new Set(AGENTIC_CATALOG.map((item) => item.kind));
  for (const required of ["protocol", "standard", "pattern", "method", "control"]) assert.ok(kinds.has(required));
  for (const item of AGENTIC_CATALOG) {
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(AGENTIC_LAYERS[item.layer], `${item.id} has unknown layer`);
    assert.ok(AGENTIC_KIND_LABELS[item.kind], `${item.id} has unknown kind`);
    assert.equal(item.status, "source-backed");
    assert.ok(item.summary.length >= 50);
    assert.ok(item.process.length >= 4);
    assert.ok(item.failureModes.length >= 2);
    assert.ok(item.controls.length >= 2);
    assert.ok(isHttps(item.source), `${item.id} source must be HTTPS`);
    assert.ok(isHttps(item.docs), `${item.id} docs must be HTTPS`);
  }
});

test("agentic knowledge relations resolve without self references", () => {
  for (const relation of AGENTIC_RELATIONS) {
    assert.ok(AGENTIC_BY_ID.has(relation.from), `${relation.id} missing source`);
    assert.ok(AGENTIC_BY_ID.has(relation.to), `${relation.id} missing target`);
    assert.notEqual(relation.from, relation.to);
  }
  assert.equal(new Set(AGENTIC_RELATIONS.map((relation) => relation.id)).size, AGENTIC_RELATIONS.length);
});

test("interoperability entries carry distinct protocol boundaries", () => {
  for (const id of ["mcp", "a2a", "ag-ui"]) assert.equal(AGENTIC_BY_ID.get(id)?.kind, "protocol");
  assert.match(AGENTIC_BY_ID.get("mcp").summary, /Host/i);
  assert.match(AGENTIC_BY_ID.get("a2a").summary, /مستقل/);
  assert.match(AGENTIC_BY_ID.get("ag-ui").summary, /UI/);
  assert.match(AGENTIC_BY_ID.get("trace-spans").summary, /پنهان/);
});

