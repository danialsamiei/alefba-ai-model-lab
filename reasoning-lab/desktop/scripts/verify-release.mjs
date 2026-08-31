#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDirectory, "..");

function parseArguments(argv) {
  const options = { file: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--file") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--file به مسیر فایل EXE نیاز دارد.");
      options.file = value;
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`آرگومان ناشناخته: ${argument}`);
    }
  }
  return options;
}

export async function sha256File(filePath) {
  const digest = createHash("sha256");
  await new Promise((fulfill, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", fulfill);
  });
  return digest.digest("hex");
}

async function hasPortableExecutableHeader(filePath) {
  const handle = await import("node:fs/promises").then(({ open }) => open(filePath, "r"));
  try {
    const header = Buffer.alloc(2);
    const { bytesRead } = await handle.read(header, 0, 2, 0);
    return bytesRead === 2 && header[0] === 0x4d && header[1] === 0x5a;
  } finally {
    await handle.close();
  }
}

export function inspectAuthenticode(filePath, platform = process.platform) {
  if (platform !== "win32") {
    return Object.freeze({ status: "NotChecked", valid: null, checkedBy: "platform-not-windows" });
  }

  const encodedPath = Buffer.from(filePath, "utf16le").toString("base64");
  const powerShell = [
    `$target = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedPath}'))`,
    "$signature = Get-AuthenticodeSignature -LiteralPath $target",
    "[Console]::Out.Write($signature.Status.ToString())",
  ].join("; ");
  // Codex/PowerShell Core can prepend incompatible modules to PSModulePath.
  // Windows PowerShell's signature cmdlet must load only its own module roots.
  const windowsPowerShellEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name.toLowerCase() !== "psmodulepath"),
  );
  windowsPowerShellEnvironment.PSModulePath = [
    join(process.env.USERPROFILE || "", "Documents", "WindowsPowerShell", "Modules"),
    join(process.env.ProgramFiles || "C:\\Program Files", "WindowsPowerShell", "Modules"),
    join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "Modules"),
  ].join(";");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", powerShell],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 30_000,
      env: windowsPowerShellEnvironment,
    },
  );

  if (result.error || result.status !== 0) {
    return Object.freeze({
      status: "CheckFailed",
      valid: null,
      checkedBy: "Get-AuthenticodeSignature",
      detail: result.error?.message || String(result.stderr || "PowerShell signature check failed").trim(),
    });
  }

  const status = String(result.stdout).trim() || "UnknownError";
  return Object.freeze({ status, valid: status === "Valid", checkedBy: "Get-AuthenticodeSignature" });
}

export async function verifyRelease(filePath, { minimumBytes = 10 * 1024 * 1024 } = {}) {
  const absoluteFile = resolve(filePath);
  if (extname(absoluteFile).toLowerCase() !== ".exe") throw new Error("فایل انتشار باید پسوند .exe داشته باشد.");
  await access(absoluteFile);
  const metadata = await stat(absoluteFile);
  if (!metadata.isFile()) throw new Error("مسیر انتشار یک فایل عادی نیست.");
  if (metadata.size < minimumBytes) {
    throw new Error(`اندازهٔ EXE غیرمنتظره است: ${metadata.size} bytes (حداقل ${minimumBytes}).`);
  }
  if (!(await hasPortableExecutableHeader(absoluteFile))) throw new Error("هدر PE/MZ ویندوز در فایل دیده نشد.");

  const packageJson = JSON.parse(await readFile(join(desktopRoot, "package.json"), "utf8"));
  const sha256 = await sha256File(absoluteFile);
  const signature = inspectAuthenticode(absoluteFile);
  const checksumPath = `${absoluteFile}.sha256`;
  const manifestPath = join(dirname(absoluteFile), "release-manifest.json");
  const relativeArtifact = relative(desktopRoot, absoluteFile).replaceAll("\\", "/");

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    product: packageJson.build?.productName || packageJson.name,
    version: packageJson.version,
    artifact: {
      file: relativeArtifact,
      name: absoluteFile.split(/[\\/]/).at(-1),
      bytes: metadata.size,
      format: "Windows PE portable executable",
      platform: "win32",
      architecture: "x64",
      packageType: "portable",
      sha256,
    },
    integrity: {
      algorithm: "SHA-256",
      checksumFile: `${absoluteFile.split(/[\\/]/).at(-1)}.sha256`,
    },
    codeSigning: signature,
    productBoundary: {
      purpose: "offline Persian educational visualization and analytic simulation",
      modelWeightsBundled: false,
      realModelInferenceClaimed: false,
      cpuResultsAreBenchmarks: false,
    },
    buildStack: {
      electron: packageJson.devDependencies?.electron,
      three: packageJson.dependencies?.three,
      vite: packageJson.devDependencies?.vite,
      electronBuilder: packageJson.devDependencies?.["electron-builder"],
    },
  };

  await writeFile(checksumPath, `${sha256}  ${manifest.artifact.name}\n`, "utf8");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return Object.freeze({ manifest, checksumPath, manifestPath });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("کاربرد: npm run verify:release -- [--file مسیر-EXE]\n");
    return;
  }

  const packageJson = JSON.parse(await readFile(join(desktopRoot, "package.json"), "utf8"));
  const defaultName = `Alefba-AI-Model-Lab-${packageJson.version}-Windows-x64.exe`;
  const selected = options.file
    ? (isAbsolute(options.file) ? options.file : resolve(process.cwd(), options.file))
    : join(desktopRoot, "release", defaultName);
  const result = await verifyRelease(selected);
  const { artifact, codeSigning } = result.manifest;

  process.stdout.write([
    "وارسی انتشار کامل شد.",
    `فایل: ${artifact.file}`,
    `اندازه: ${artifact.bytes} bytes`,
    `SHA-256: ${artifact.sha256}`,
    `امضای کد: ${codeSigning.status}`,
    `manifest: ${relative(desktopRoot, result.manifestPath).replaceAll("\\", "/")}`,
    `checksum: ${relative(desktopRoot, result.checksumPath).replaceAll("\\", "/")}`,
    "",
  ].join("\n"));
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`وارسی انتشار ناموفق بود: ${error.message}\n`);
    process.exitCode = 1;
  });
}
