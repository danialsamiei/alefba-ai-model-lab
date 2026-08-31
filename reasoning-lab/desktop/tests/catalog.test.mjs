import test from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORIES,
  MODEL_CATALOG,
  CATALOG_BY_ID,
  RELATIONS,
  TOUR_STOPS,
  CPU_MODELS,
  OPEN_SOURCE_STACK,
} from "../src/catalog.js";

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

test("catalog has a useful breadth and stable, unique identifiers", () => {
  assert.ok(MODEL_CATALOG.length >= 40, "the desktop atlas should cover at least 40 concepts/models");
  const ids = MODEL_CATALOG.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, "catalog ids must be unique");
  assert.equal(CATALOG_BY_ID.size, MODEL_CATALOG.length);

  for (const item of MODEL_CATALOG) {
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `invalid id: ${item.id}`);
    assert.ok(CATEGORIES[item.category], `${item.id} references unknown category ${item.category}`);
    for (const field of ["title", "subtitle", "summary", "architecture", "input", "output", "license"]) {
      assert.equal(typeof item[field], "string", `${item.id}.${field} must be text`);
      assert.ok(item[field].trim().length > 0, `${item.id}.${field} must not be empty`);
    }
    assert.equal(item.status, "source-backed", `${item.id} must retain its evidence-status label`);
    assert.ok(Array.isArray(item.process) && item.process.length >= 3, `${item.id} needs a stepwise process`);
    assert.ok(Array.isArray(item.parents), `${item.id}.parents must be an array`);
    assert.ok(Array.isArray(item.tags), `${item.id}.tags must be an array`);
    assert.ok(isHttpsUrl(item.repo), `${item.id}.repo must be an HTTPS source`);
    if (item.paper !== null) assert.ok(isHttpsUrl(item.paper), `${item.id}.paper must be an HTTPS source`);
  }
});

test("category styling is complete and unambiguous", () => {
  const categoryEntries = Object.entries(CATEGORIES);
  assert.ok(categoryEntries.length >= 8);
  assert.equal(new Set(categoryEntries.map(([, value]) => value.orbit)).size, categoryEntries.length);

  for (const [id, category] of categoryEntries) {
    assert.ok(category.label.trim(), `${id} needs a Persian label`);
    assert.ok(Number.isInteger(category.color) && category.color >= 0 && category.color <= 0xffffff);
    assert.ok(Number.isFinite(category.orbit) && category.orbit > 0);
  }
});

test("all graph parents and derived relations resolve to real nodes", () => {
  const expectedRelations = [];
  for (const item of MODEL_CATALOG) {
    for (const parent of item.parents) {
      assert.ok(CATALOG_BY_ID.has(parent), `${item.id} has missing parent ${parent}`);
      assert.notEqual(parent, item.id, `${item.id} cannot parent itself`);
      expectedRelations.push(`${parent}--${item.id}`);
    }
  }

  assert.equal(RELATIONS.length, expectedRelations.length);
  assert.deepEqual(RELATIONS.map(({ id }) => id), expectedRelations);
  assert.equal(new Set(RELATIONS.map(({ id }) => id)).size, RELATIONS.length, "relations must be unique");
  for (const relation of RELATIONS) {
    assert.ok(CATALOG_BY_ID.has(relation.from));
    assert.ok(CATALOG_BY_ID.has(relation.to));
    assert.equal(relation.relation, "influences_or_composes");
  }
});

test("guided tour points to catalog entries and has explanatory copy", () => {
  assert.ok(TOUR_STOPS.length >= 10);
  assert.equal(new Set(TOUR_STOPS.map(({ id }) => id)).size, TOUR_STOPS.length);
  for (const stop of TOUR_STOPS) {
    assert.ok(CATALOG_BY_ID.has(stop.id), `tour stop ${stop.id} is missing from catalog`);
    assert.ok(stop.title.trim().length >= 4);
    assert.ok(stop.body.trim().length >= 30, `${stop.id} tour explanation is too short`);
  }
});

test("CPU model table separates total and active parameters", () => {
  assert.ok(CPU_MODELS.length >= 6);
  assert.equal(new Set(CPU_MODELS.map(({ id }) => id)).size, CPU_MODELS.length);
  for (const model of CPU_MODELS) {
    assert.ok(model.totalB > 0);
    assert.ok(model.activeB > 0 && model.activeB <= model.totalB);
    assert.ok(model.kvBytesPerToken > 0);
    assert.ok(model.caveat.trim().length >= 10);
  }

  const fullR1 = CPU_MODELS.find(({ id }) => id === "r1-671b");
  assert.ok(fullR1, "full DeepSeek-R1 scenario must be present");
  assert.ok(fullR1.totalB > fullR1.activeB, "MoE must expose total vs active parameter distinction");
});

test("open-source runtime stack records version, repository and license", () => {
  const required = ["Electron", "Three.js", "Vite", "electron-builder", "Fontsource"];
  for (const name of required) {
    const dependency = OPEN_SOURCE_STACK.find((entry) => entry.name === name);
    assert.ok(dependency, `${name} is missing from the open-source stack registry`);
    assert.ok(dependency.version.trim());
    assert.ok(isHttpsUrl(dependency.repo));
    assert.ok(dependency.repo.startsWith("https://github.com/"), `${name} should link to its GitHub repository`);
    assert.ok(dependency.license.trim());
  }
});
