# SSLTrus 代码签名 Action

[English](README.md) · [简体中文](README.zh_CN.md)

使用 SSLTrus 远程代码签名服务和官方 `signtool` 命令行客户端原地签名文件。

Action 从 SSLTrus 发布源下载适用于当前 runner 的最新 CLI，校验声明的文件大小
和 SHA-256 后，依次签名输入文件。只要存在匹配的 CLI 发布版本，即可支持 Linux、
macOS 和 Windows runner。

## 使用方法

### 最小配置

```yaml
- name: Sign files
  uses: ssltrus-official/code-sign-action@v1
  with:
    access-key: ${{ secrets.SSLTRUS_ACCESS_KEY }}
    access-secret: ${{ secrets.SSLTRUS_ACCESS_SECRET }}
    cert-code: ${{ secrets.SSLTRUS_CERT_CODE }}
    files: build/app.exe
```

### 完整配置

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
    nicsrs: false
    timestamp-rfc3161: http://timestamp.acs.microsoft.com
    description: My Application
    description-url: https://example.com
```

`files` 接受逗号或换行分隔的路径。相对路径基于 `GITHUB_WORKSPACE` 解析，绝对
路径保持不变，重复文件只签名一次。

每个文件均通过 `signtool sign --override` 原地签名，成功后会替换原文件。Action
会在开始签名前校验全部路径，然后依次处理文件；遇到第一个失败即停止，此前已完成
签名的文件不会回滚。

## 输入参数

| 参数                | 必填 | 默认值  | 说明                                        |
|---------------------|------|---------|---------------------------------------------|
| `access-key`        | 是   |         | SSLTrus Access Key。                        |
| `access-secret`     | 是   |         | SSLTrus Access Secret。                     |
| `cert-code`         | 是   |         | SSLTrus 证书编号。                          |
| `files`             | 是   |         | 逗号或换行分隔的待原地签名文件路径。        |
| `nicsrs`            | 否   | `false` | 设置为 `true` 时使用 NICSRS。               |
| `timestamp-rfc3161` | 否   | `auto`  | RFC 3161 时间戳地址；传入空值可禁用时间戳。 |
| `description`       | 否   |         | 写入签名的描述。                            |
| `description-url`   | 否   |         | 写入签名的 URL。                            |

## 支持的文件

Action 不维护扩展名白名单，文件格式识别和校验由实际使用的 `signtool` 发布版本
负责。

当前内嵌的 `osslsigncode` 支持 EXE、DLL、SYS 等 PE 文件，CAB、CAT、MSI、APPX
文件，以及 `.ps1`、`.ps1xml`、`.psc1`、`.psd1`、`.psm1`、`.cdxml`、`.mof`
和 `.js` 脚本。SSLTrus 客户端还会对 `.efi`、`.msp` 和 `.msm` 文件执行专门
处理。不支持或无效的文件会导致 Action 失败。

## 安全与发布行为

- Access Key 和 Access Secret 通过 `ACCESS_KEY`、`ACCESS_SECRET` 环境变量传给
  `signtool`，不会作为命令行参数传递。
- Action 会在 GitHub Actions 日志中屏蔽这两个凭证。
- CLI 必须通过 HTTPS 从 `pccs.ssltrus.cn` 下载，并与发布源声明的文件大小和
  SHA-256 一致。
- Action 会跟随最新发布的 CLI。需要提高 workflow 可复现性时，应将 Action 固定到
  commit SHA；但发布源更新后，实际下载的 CLI 仍可能发生变化。
