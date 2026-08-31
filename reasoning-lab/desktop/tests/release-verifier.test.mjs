import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  inspectAuthenticode,
  sha256File,
  verifyRelease,
} from "../scripts/verify-release.mjs";

test("release verifier computes standard SHA-256", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "model-lab-release-test-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const sample = join(directory, "sample.bin");
  await writeFile(sample, "abc", "utf8");
  assert.equal(
    await sha256File(sample),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("signature status does not pretend to be verified off Windows", () => {
  assert.deepEqual(inspectAuthenticode("irrelevant.exe", "linux"), {
    status: "NotChecked",
    valid: null,
    checkedBy: "platform-not-windows",
  });
});

test("release verifier rejects non-EXE paths before writing evidence", async () => {
  await assert.rejects(() => verifyRelease("artifact.zip"), /\.exe/);
});
