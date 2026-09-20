#!/usr/bin/env python3

import argparse
import json
import re
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from release_cli import MAX_DOWNLOAD_SIZE, REQUIRED_PLATFORMS, validate_manifest


SOURCE_URL = "https://pccs.ssltrus.cn/oss-code-sign-client/latest.json"
MAX_METADATA_SIZE = 1024 * 1024


def load_releases():
    request = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": "ssltrus-code-sign-action-update"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        final_url = urlparse(response.geturl())
        if final_url.scheme != "https" or final_url.hostname != "pccs.ssltrus.cn":
            raise SystemExit(f"Unexpected release metadata redirect: {response.geturl()}")
        data = response.read(MAX_METADATA_SIZE + 1)

    if len(data) > MAX_METADATA_SIZE:
        raise SystemExit("Release metadata is too large")
    releases = json.loads(data)
    if not isinstance(releases, list):
        raise SystemExit("Release metadata must be an array")
    return releases


def build_manifest(releases, version):
    if not re.fullmatch(r"v\d+\.\d+\.\d+", version):
        raise SystemExit(f"Invalid CLI version: {version}")

    selected = {}
    for release in releases:
        if not isinstance(release, dict) or release.get("type") != 1:
            continue
        platform = release.get("platform")
        if platform not in REQUIRED_PLATFORMS or release.get("version") != version:
            continue
        if platform in selected:
            raise SystemExit(f"Duplicate CLI release for {platform} {version}")
        selected[platform] = release

    missing = REQUIRED_PLATFORMS - set(selected)
    if missing:
        raise SystemExit(f"Missing CLI releases for {version}: {sorted(missing)}")

    platforms = {}
    for platform in sorted(REQUIRED_PLATFORMS):
        release = selected[platform]
        source = release.get("url", "")
        asset = Path(urlparse(source).path).name
        size = release.get("size")
        sha256 = release.get("sha256", "")
        if not isinstance(size, int) or size <= 0 or size > MAX_DOWNLOAD_SIZE:
            raise SystemExit(f"Invalid CLI size for {platform}: {size}")
        platforms[platform] = {
            "asset": asset,
            "source": source,
            "size": size,
            "sha256": sha256,
        }

    return validate_manifest(
        {
            "version": version,
            "release": f"cli-{version}",
            "platforms": platforms,
        }
    )


def write_manifest(manifest, destination):
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    try:
        temporary.write_text(json.dumps(manifest, indent=2) + "\n")
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Update the pinned CLI release manifest")
    parser.add_argument("version", help="CLI version, for example v1.5.5")
    parser.add_argument("--output", default="cli.json", type=Path)
    args = parser.parse_args()

    manifest = build_manifest(load_releases(), args.version)
    write_manifest(manifest, args.output)
    print(f"Updated {args.output} to {args.version}")


if __name__ == "__main__":
    main()
