const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  buildSignArgs,
  parseBoolean,
  parseFiles,
  runnerPlatform,
  selectRelease,
} = require("./index");
const cliManifest = require("./cli.json");

test("maps supported runner platforms", () => {
  assert.deepEqual(runnerPlatform("linux", "x64"), {
    platform: "linux",
    arch: "amd64",
    key: "linux/amd64",
  });
  assert.deepEqual(runnerPlatform("win32", "arm64"), {
    platform: "windows",
    arch: "arm64",
    key: "windows/arm64",
  });
  assert.throws(() => runnerPlatform("freebsd", "x64"), /unsupported runner platform/);
});

test("parses strict boolean inputs", () => {
  assert.equal(parseBoolean("nicsrs", "TRUE"), true);
  assert.equal(parseBoolean("nicsrs", "false"), false);
  assert.throws(() => parseBoolean("nicsrs", "yes"), /must be true or false/);
});

test("parses comma and newline separated files without extension filtering", () => {
  const workspace = path.resolve("workspace");
  assert.deepEqual(parseFiles("app.exe, package.appx\nscripts/build.ps1\napp.exe", workspace, false), [
    path.join(workspace, "app.exe"),
    path.join(workspace, "package.appx"),
    path.join(workspace, "scripts/build.ps1"),
  ]);
});

test("selects the pinned CLI release for the runner", () => {
  const release = selectRelease(cliManifest, "linux/amd64");
  const metadata = cliManifest.platforms["linux/amd64"];
  assert.equal(release.version, cliManifest.version);
  assert.equal(
    release.url,
    `https://github.com/ssltrus-official/code-sign-action/releases/download/${cliManifest.release}/${metadata.asset}`,
  );
  assert.throws(() => selectRelease(cliManifest, "windows/arm64"), /no CLI release/);
});

test("builds the signtool command with in-place signing", () => {
  assert.deepEqual(
    buildSignArgs(
      {
        certCode: "CERT_CODE",
        nicsrs: true,
        dryRun: true,
        timestampRfc3161: "",
        description: "Example",
        descriptionUrl: "https://example.com",
      },
      "/workspace/app.exe",
    ),
    [
      "sign",
      "--cert-code",
      "CERT_CODE",
      "--file",
      "/workspace/app.exe",
      "--override",
      "--address",
      "nicsrs",
      "--dry-run",
      "--timestamp-rfc3161=",
      "--desc",
      "Example",
      "--url",
      "https://example.com",
    ],
  );
});
