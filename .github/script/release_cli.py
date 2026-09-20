#!/usr/bin/env python3

import hashlib
import json
import os
import re
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlparse


MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024
REQUIRED_PLATFORMS = {
    "darwin/amd64",
    "darwin/arm64",
    "linux/amd64",
    "linux/arm64",
    "windows/amd64",
}


def validate_manifest(manifest):
    version = manifest.get("version", "")
    release = manifest.get("release", "")
    platforms = manifest.get("platforms", {})

    if not re.fullmatch(r"v\d+\.\d+\.\d+", version):
        raise SystemExit(f"Invalid CLI version: {version}")
    if release != f"cli-{version}":
        raise SystemExit(f"Invalid CLI release: {release}")
    if set(platforms) != REQUIRED_PLATFORMS:
        raise SystemExit(f"Invalid CLI platforms: {sorted(platforms)}")

    for platform, item in platforms.items():
        asset = item.get("asset", "")
        source = item.get("source", "")
        size = item.get("size")
        sha256 = item.get("sha256", "")
        url = urlparse(source)

        if Path(asset).name != asset or not asset.endswith(".zip"):
            raise SystemExit(f"Invalid CLI asset for {platform}: {asset}")
        if url.scheme != "https" or url.hostname != "pccs.ssltrus.cn":
            raise SystemExit(f"Invalid CLI source for {platform}: {source}")
        if Path(url.path).name != asset:
            raise SystemExit(f"CLI source does not match asset for {platform}: {source}")
        if not isinstance(size, int) or size <= 0 or size > MAX_DOWNLOAD_SIZE:
            raise SystemExit(f"Invalid CLI size for {platform}: {size}")
        if not re.fullmatch(r"[0-9a-fA-F]{64}", sha256):
            raise SystemExit(f"Invalid CLI SHA-256 for {platform}: {sha256}")

    return manifest


def load_manifest(path):
    return validate_manifest(json.loads(Path(path).read_text()))


def download(item, destination):
    request = urllib.request.Request(
        item["source"],
        headers={"User-Agent": "ssltrus-code-sign-action-release"},
    )
    digest = hashlib.sha256()
    size = 0
    temporary = destination.with_suffix(destination.suffix + ".part")

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            final_url = urlparse(response.geturl())
            if final_url.scheme != "https" or final_url.hostname != "pccs.ssltrus.cn":
                raise SystemExit(f"Unexpected CLI redirect: {response.geturl()}")
            with temporary.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > item["size"]:
                        raise SystemExit(f"CLI exceeds declared size: {item['asset']}")
                    digest.update(chunk)
                    output.write(chunk)

        if size != item["size"]:
            raise SystemExit(
                f"CLI size mismatch for {item['asset']}: expected {item['size']}, got {size}"
            )
        actual = digest.hexdigest()
        if actual.lower() != item["sha256"].lower():
            raise SystemExit(
                f"CLI SHA-256 mismatch for {item['asset']}: expected {item['sha256']}, got {actual}"
            )
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    if len(sys.argv) != 2:
        raise SystemExit(f"Usage: {sys.argv[0]} OUTPUT_DIRECTORY")

    manifest = load_manifest("cli.json")
    output_directory = Path(sys.argv[1])
    output_directory.mkdir(parents=True, exist_ok=False)

    for platform in sorted(manifest["platforms"]):
        item = manifest["platforms"][platform]
        print(f"Downloading {platform} CLI {manifest['version']}")
        download(item, output_directory / item["asset"])

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with Path(github_output).open("a") as output:
            output.write(f"release={manifest['release']}\n")
            output.write(f"version={manifest['version']}\n")


if __name__ == "__main__":
    main()
