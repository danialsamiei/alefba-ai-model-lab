import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, "..");
const read = (relativePath) => readFile(resolve(desktopRoot, relativePath), "utf8");

test("Electron renderer is isolated from Node and sandboxed", async () => {
  const main = await read("electron/main.cjs");
  assert.match(main, /contextIsolation\s*:\s*true/);
  assert.match(main, /nodeIntegration\s*:\s*false/);
  assert.match(main, /sandbox\s*:\s*true/);
  assert.match(main, /webSecurity\s*:\s*true/);
  assert.match(main, /allowRunningInsecureContent\s*:\s*false/);
  assert.doesNotMatch(main, /webviewTag\s*:\s*true/);
  assert.doesNotMatch(main, /enableRemoteModule\s*:\s*true/);
});

test("external navigation is denied and only validated HTTPS URLs reach the system browser", async () => {
  const main = await read("electron/main.cjs");
  assert.match(main, /const HTTPS_URL\s*=\s*\/\^https/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /return\s*\{\s*action:\s*["']deny["']\s*\}/);
  assert.match(main, /will-navigate/);
  assert.match(main, /event\.preventDefault\(\)/);
  assert.match(main, /Only validated HTTPS links may be opened externally/);
  const windowOpenHandler = main.match(/setWindowOpenHandler\([\s\S]*?return\s*\{\s*action:\s*["']deny["']\s*\};\s*\}\);/)?.[0];
  assert.ok(windowOpenHandler, "window-open handler must be extractable");
  assert.match(windowOpenHandler, /if\s*\(HTTPS_URL\.test\(url\)\)\s*void\s+shell\.openExternal\(url\)/);
  const externalIpc = main.match(/ipcMain\.handle\(["']external:open["'][\s\S]*?\n\}\);/)?.[0];
  assert.ok(externalIpc, "external-open IPC handler must be extractable");
  assert.match(externalIpc, /!HTTPS_URL\.test\(url\)/);
  assert.match(externalIpc, /shell\.openExternal\(url\)/);
});

test("preload exposes a narrow, immutable API instead of Electron primitives", async () => {
  const preload = await read("electron/preload.cjs");
  assert.match(preload, /contextBridge\.exposeInMainWorld\(["']desktopLab["']/);
  assert.match(preload, /Object\.freeze/);
  assert.match(preload, /ipcRenderer\.invoke\(["']system:info["']/);
  assert.match(preload, /ipcRenderer\.invoke\(["']external:open["']/);
  assert.doesNotMatch(preload, /exposeInMainWorld\([^,]+,\s*(?:ipcRenderer|require|process)/);
  assert.doesNotMatch(preload, /ipcRenderer\.(?:send|sendSync|on|once)\(/);
});

test("document CSP is offline-first and blocks remote execution surfaces", async () => {
  const html = await read("index.html");
  const content = html.match(/Content-Security-Policy["']\s+content="([^"]+)"/i)?.[1];
  assert.ok(content, "Content-Security-Policy meta tag is required");
  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "connect-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ]) assert.ok(content.includes(directive), `CSP is missing ${directive}`);
  assert.doesNotMatch(content, /https?:|wss?:|\*/);
  assert.doesNotMatch(content, /script-src[^;]*'unsafe-(?:inline|eval)'/);
  assert.match(html, /<html\s+lang=["']fa["']\s+dir=["']rtl["']/i);
});

test("Windows package is portable, x64, ASAR-packed and excludes source entrypoints", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.equal(packageJson.build.asar, true);
  assert.equal(packageJson.build.compression, "maximum");
  assert.equal(packageJson.build.win.target[0].target, "portable");
  assert.deepEqual(packageJson.build.win.target[0].arch, ["x64"]);
  assert.ok(packageJson.build.files.includes("dist/**/*"));
  assert.ok(packageJson.build.files.includes("electron/**/*"));
  assert.ok(!packageJson.build.files.includes("src/**/*"));
  assert.ok(!packageJson.build.files.includes("tests/**/*"));
});

test("agentic simulator is local, deterministic and cannot execute external capabilities", async () => {
  const simulator = await read("src/agenticSimulation.js");
  for (const forbidden of ["Math.random", "Date.now", "performance.now", "fetch(", "XMLHttpRequest", "WebSocket", "node:fs", "child_process", "eval(", "new Function"] ) {
    assert.ok(!simulator.includes(forbidden), `agentic simulator must not contain ${forbidden}`);
  }
  assert.match(simulator, /conceptualOnly:\s*true/);
  const ui = await read("src/agenticUi.js");
  assert.match(ui, /بدون اجرای ابزار خارجی/);
  assert.match(ui, /زنجیرهٔ فکر پنهان/);
});
