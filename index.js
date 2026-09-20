const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const CLI_MANIFEST = require("./cli.json");

const ACTION_REPOSITORY = "ssltrus-official/code-sign-action";
const RELEASES_HOST = "github.com";
const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024;

function getInput(name, required = false) {
  const key = `INPUT_${name.toUpperCase().replaceAll(" ", "_")}`;
  const value = (process.env[key] || "").trim();
  if (required && !value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseBoolean(name, value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}

function parseFiles(value, workspace, windows = process.platform === "win32") {
  const files = value
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => path.resolve(workspace, item));

  if (files.length === 0) {
    throw new Error("files must contain at least one path");
  }

  const unique = new Map();
  for (const file of files) {
    const key = windows ? file.toLowerCase() : file;
    if (!unique.has(key)) {
      unique.set(key, file);
    }
  }
  return [...unique.values()];
}

function validateFiles(files) {
  for (const file of files) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch (error) {
      throw new Error(`file does not exist: ${file}`, { cause: error });
    }
    if (!stat.isFile()) {
      throw new Error(`path is not a regular file: ${file}`);
    }
  }
}

function runnerPlatform(platform = process.platform, arch = process.arch) {
  const platforms = { darwin: "darwin", linux: "linux", win32: "windows" };
  const arches = { arm64: "arm64", x64: "amd64" };
  if (!platforms[platform] || !arches[arch]) {
    throw new Error(`unsupported runner platform: ${platform}/${arch}`);
  }
  return {
    platform: platforms[platform],
    arch: arches[arch],
    key: `${platforms[platform]}/${arches[arch]}`,
  };
}

function selectRelease(manifest, platformKey) {
  const metadata = manifest.platforms?.[platformKey];
  if (!metadata) {
    throw new Error(`no CLI release for ${platformKey}`);
  }
  return validateRelease({
    ...metadata,
    platform: platformKey,
    version: manifest.version,
    url: `https://${RELEASES_HOST}/${ACTION_REPOSITORY}/releases/download/${manifest.release}/${metadata.asset}`,
  });
}

function validateRelease(release) {
  const url = new URL(release.url);
  if (url.protocol !== "https:" || url.hostname !== RELEASES_HOST || !url.pathname.endsWith(".zip")) {
    throw new Error(`unexpected release URL: ${release.url}`);
  }
  if (!Number.isInteger(release.size) || release.size <= 0 || release.size > MAX_DOWNLOAD_SIZE) {
    throw new Error(`invalid release size: ${release.size}`);
  }
  if (!/^[0-9a-f]{64}$/i.test(release.sha256 || "")) {
    throw new Error("invalid release SHA-256");
  }
  if (typeof release.version !== "string" || !release.version.trim()) {
    throw new Error("invalid release version");
  }
  return release;
}

async function downloadRelease(release, destination) {
  const response = await fetch(release.url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`CLI download failed: HTTP ${response.status}`);
  }
  const finalUrl = new URL(response.url);
  if (
    finalUrl.protocol !== "https:" ||
    (finalUrl.hostname !== RELEASES_HOST && !finalUrl.hostname.endsWith(".githubusercontent.com"))
  ) {
    throw new Error(`unexpected CLI download redirect: ${response.url}`);
  }
  if (!response.body) {
    throw new Error("CLI download returned an empty response body");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > release.size) {
      throw new Error(`CLI size exceeds declared size: ${release.size}`);
    }
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks, size);
  if (data.length !== release.size) {
    throw new Error(`CLI size mismatch: expected ${release.size}, got ${data.length}`);
  }
  const actual = crypto.createHash("sha256").update(data).digest("hex");
  if (actual.toLowerCase() !== release.sha256.toLowerCase()) {
    throw new Error(`CLI SHA-256 mismatch: expected ${release.sha256}, got ${actual}`);
  }
  fs.writeFileSync(destination, data, { mode: 0o600 });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status ?? "unknown"}`);
  }
}

function extractArchive(archive, destination, windows = process.platform === "win32") {
  if (windows) {
    run(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Expand-Archive -LiteralPath $env:SSLTRUS_ARCHIVE -DestinationPath $env:SSLTRUS_DESTINATION -Force",
      ],
      {
        env: {
          ...process.env,
          SSLTRUS_ARCHIVE: archive,
          SSLTRUS_DESTINATION: destination,
        },
      },
    );
    return;
  }
  run("unzip", ["-q", archive, "-d", destination]);
}

function findFile(directory, basename) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(candidate, basename);
      if (found) {
        return found;
      }
    } else if (entry.isFile() && entry.name === basename) {
      return candidate;
    }
  }
  return "";
}

function buildSignArgs(options, file) {
  const args = ["sign", "--cert-code", options.certCode, "--file", file, "--override"];
  if (options.nicsrs) {
    args.push("--address", "nicsrs");
  }
  args.push(`--timestamp-rfc3161=${options.timestampRfc3161}`);
  if (options.description) {
    args.push("--desc", options.description);
  }
  if (options.descriptionUrl) {
    args.push("--url", options.descriptionUrl);
  }
  return args;
}

function mask(value) {
  if (process.env.GITHUB_ACTIONS !== "true") {
    return;
  }
  const escaped = value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  process.stdout.write(`::add-mask::${escaped}\n`);
}

async function main() {
  const accessKey = getInput("access-key", true);
  const accessSecret = getInput("access-secret", true);
  const certCode = getInput("cert-code", true);
  const filesInput = getInput("files", true);
  const nicsrs = parseBoolean("nicsrs", getInput("nicsrs") || "false");
  const timestampRfc3161 = getInput("timestamp-rfc3161");
  const description = getInput("description");
  const descriptionUrl = getInput("description-url");
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const files = parseFiles(filesInput, workspace);

  mask(accessKey);
  mask(accessSecret);
  validateFiles(files);

  const runner = runnerPlatform();
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ssltrus-code-sign-"));
  const archive = path.join(tempDirectory, "signtool.zip");
  const extractDirectory = path.join(tempDirectory, "cli");

  let signed = 0;
  try {
    fs.mkdirSync(extractDirectory);
    const release = selectRelease(CLI_MANIFEST, runner.key);
    process.stdout.write(`Downloading SSLTrus signtool ${release.version} for ${runner.key}\n`);
    await downloadRelease(release, archive);
    extractArchive(archive, extractDirectory);

    const executableName = `signtool-${runner.platform}-${runner.arch}${runner.platform === "windows" ? ".exe" : ""}`;
    const executable = findFile(extractDirectory, executableName);
    if (!executable) {
      throw new Error(`CLI archive does not contain ${executableName}`);
    }
    if (runner.platform !== "windows") {
      fs.chmodSync(executable, 0o755);
    }

    const options = { certCode, nicsrs, timestampRfc3161, description, descriptionUrl };
    const env = { ...process.env, ACCESS_KEY: accessKey, ACCESS_SECRET: accessSecret };
    for (const file of files) {
      process.stdout.write(`Signing ${file}\n`);
      try {
        run(executable, buildSignArgs(options, file), { env });
      } catch (error) {
        throw new Error(`signing failed for ${file} after ${signed} successful file(s): ${error.message}`, {
          cause: error,
        });
      }
      signed += 1;
    }
    process.stdout.write(`Signed ${signed} file(s) successfully\n`);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`::error::${message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildSignArgs,
  parseBoolean,
  parseFiles,
  runnerPlatform,
  selectRelease,
  validateRelease,
};
