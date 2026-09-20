# SSLTrus 代码签名 Action

[English](README.md) · [简体中文](README.zh_CN.md)

使用 SSLTrus 远程代码签名服务原地签名文件。支持 Linux、macOS 和 Windows
runner。

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
    dry-run: false
    timestamp-rfc3161: http://timestamp.acs.microsoft.com
    description: My Application
    description-url: https://example.com
```

`files` 接受逗号或换行分隔的路径。相对路径基于 `GITHUB_WORKSPACE` 解析，绝对
路径保持不变，重复文件只签名一次。

签名结果会覆盖原文件。签名失败时 Action 会停止，此前已完成签名的文件仍保持
签名状态。

设置 `dry-run: true` 后，CLI 使用本地测试证书，不调用远程签名服务，但仍会修改
文件，并且仍须提供 `access-key`、`access-secret` 和 `cert-code`。

## 输入参数

| 参数                | 必填 | 默认值  | 说明                                        |
|---------------------|------|---------|---------------------------------------------|
| `access-key`        | 是   |         | SSLTrus Access Key。                        |
| `access-secret`     | 是   |         | SSLTrus Access Secret。                     |
| `cert-code`         | 是   |         | SSLTrus 证书编号。                          |
| `files`             | 是   |         | 逗号或换行分隔的待原地签名文件路径。        |
| `nicsrs`            | 否   | `false` | 设置为 `true` 时使用 NICSRS。               |
| `dry-run`           | 否   | `false` | 使用本地测试证书，不调用远程签名服务。      |
| `timestamp-rfc3161` | 否   | `auto`  | RFC 3161 时间戳地址；传入空值可禁用时间戳。 |
| `description`       | 否   |         | 写入签名的描述。                            |
| `description-url`   | 否   |         | 写入签名的 URL。                            |
