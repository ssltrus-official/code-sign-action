# SSLTrus Code Sign Action

[English](README.md) · [简体中文](README.zh_CN.md)

Sign files in place with the SSLTrus remote code-signing service. The action
supports Linux, macOS, and Windows runners.

## Usage

### Minimal configuration

```yaml
- name: Sign files
  uses: ssltrus-official/code-sign-action@v1
  with:
    access-key: ${{ secrets.SSLTRUS_ACCESS_KEY }}
    access-secret: ${{ secrets.SSLTRUS_ACCESS_SECRET }}
    cert-code: ${{ secrets.SSLTRUS_CERT_CODE }}
    files: build/app.exe
```

### Full configuration

```yaml
- name: Sign files
  uses: ssltrus-official/code-sign-action@v1
  with:
    access-key: ${{ secrets.SSLTRUS_ACCESS_KEY }}
    access-secret: ${{ secrets.SSLTRUS_ACCESS_SECRET }}
    cert-code: ${{ secrets.SSLTRUS_CERT_CODE }}
    files: |
      build/app.exe
      build/library.dll
      build/installer.msi
    nicsrs: true
    dry-run: false
    timestamp-rfc3161: http://timestamp.acs.microsoft.com
    description: My Application
    description-url: https://example.com
```

`files` accepts comma-separated or newline-separated paths. Relative paths are
resolved from `GITHUB_WORKSPACE`; absolute paths are used as provided.
Duplicates are signed only once.

Signed files replace the originals. If signing fails, the action stops and
files already signed remain signed.

With `dry-run: true`, the CLI uses a local test certificate without calling
the remote signing service. Files are still modified, and `access-key`,
`access-secret`, and `cert-code` remain required.

## Inputs

| Input               | Required | Default | Description                                                          |
|---------------------|----------|---------|----------------------------------------------------------------------|
| `access-key`        | Yes      |         | SSLTrus access key.                                                  |
| `access-secret`     | Yes      |         | SSLTrus access secret.                                               |
| `cert-code`         | Yes      |         | SSLTrus certificate code.                                            |
| `files`             | Yes      |         | Comma or newline separated paths to sign in place.                   |
| `nicsrs`            | No       | `false` | Set to `true` to use NICSRS.                                         |
| `dry-run`           | No       | `false` | Use a local test certificate without remote signing.                 |
| `timestamp-rfc3161` | No       | `auto`  | RFC 3161 timestamp URL. Pass an empty value to disable timestamping. |
| `description`       | No       |         | Description embedded in the signature.                               |
| `description-url`   | No       |         | URL embedded in the signature.                                       |
