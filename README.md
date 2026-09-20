# SSLTrus Code Sign Action

[English](README.md) · [简体中文](README.zh_CN.md)

Sign files in place with the SSLTrus remote code-signing service and the
official `signtool` command-line client.

The action downloads the latest CLI release for the current runner from the
SSLTrus release feed, validates its declared size and SHA-256 checksum, and
then signs each input file sequentially. Linux, macOS, and Windows runners are
supported when a matching CLI release is available.

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
    timestamp-rfc3161: http://timestamp.acs.microsoft.com
    description: My Application
    description-url: https://example.com
```

`files` accepts comma-separated or newline-separated paths. Relative paths are
resolved from `GITHUB_WORKSPACE`; absolute paths are used as provided.
Duplicates are signed only once.

Every file is signed with `signtool sign --override`, so a successful signing
operation replaces the original file. All paths are validated before signing
starts. Files are processed sequentially and the action stops on the first
failure; files signed before that failure remain signed.

## Inputs

| Input               | Required | Default | Description                                                          |
|---------------------|----------|---------|----------------------------------------------------------------------|
| `access-key`        | Yes      |         | SSLTrus access key.                                                  |
| `access-secret`     | Yes      |         | SSLTrus access secret.                                               |
| `cert-code`         | Yes      |         | SSLTrus certificate code.                                            |
| `files`             | Yes      |         | Comma or newline separated paths to sign in place.                   |
| `nicsrs`            | No       | `false` | Set to `true` to use NICSRS.                                         |
| `timestamp-rfc3161` | No       | `auto`  | RFC 3161 timestamp URL. Pass an empty value to disable timestamping. |
| `description`       | No       |         | Description embedded in the signature.                               |
| `description-url`   | No       |         | URL embedded in the signature.                                       |

## Supported files

The action does not maintain an extension allowlist. Format detection and
validation are delegated to the `signtool` release used by the action.

The bundled `osslsigncode` currently supports PE files such as EXE, DLL, and
SYS; CAB, CAT, MSI, and APPX files; and the script formats `.ps1`, `.ps1xml`,
`.psc1`, `.psd1`, `.psm1`, `.cdxml`, `.mof`, and `.js`. The SSLTrus client also
applies specialized handling to `.efi`, `.msp`, and `.msm` files. Unsupported
or invalid files cause the action to fail.

## Security and release behavior

- Access credentials are passed to `signtool` through `ACCESS_KEY` and
  `ACCESS_SECRET`, not command-line arguments.
- The action masks both credentials in GitHub Actions logs.
- CLI downloads must use HTTPS on `pccs.ssltrus.cn` and must match the release
  feed's declared size and SHA-256 checksum.
- The action intentionally follows the latest published CLI release. Pin the
  action itself to a commit SHA when workflow reproducibility is required, but
  note that the downloaded CLI can still change when the release feed changes.
