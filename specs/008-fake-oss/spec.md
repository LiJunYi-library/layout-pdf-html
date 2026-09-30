# 008-fake-oss — 本地假 OSS 服务

## 背景

后续 agent 需要处理用户上传的素材（图片、装饰图等）。开发期不接真实对象存储，
在后端内置一个 fake-oss：文件落本地磁盘，返回可 HTTP 访问的 URL，接口形状与
常见 OSS（上传得 key/url、按 key 取、删、列）保持一致，以后可平滑替换为真实 OSS。

## 功能需求

- FR-1：`POST /oss/upload`（multipart 文件字段 `file`）保存文件，返回 `{"key", "url"}`；
  key 为 `<uuid><原扩展名>`，url 为 `/oss/files/<key>`（同源可直接用于 img/iframe）。
- FR-2：`GET /oss/files/{key}` 按 key 返回文件内容，带正确 Content-Type；key 非法
  （含路径分隔符）或不存在返回 404。
- FR-3：`DELETE /oss/files/{key}` 删除文件；不存在返回 404。
- FR-4：`GET /oss/files` 列出全部文件（key、url、大小、上传时间），新→旧排序。
- FR-5：存储目录为项目根 `fake-oss/`（无鉴权，仅开发用）；key 支持嵌套路径
  （如 `report/id_1/config.json`），拒绝绝对路径与 `..` 目录穿越；
  单文件上限 10MB，超限返回 413。

## 验收标准

- AC-1：curl 上传一张 PNG 返回 key/url；GET 该 url 返回 200 且 Content-Type 为 image/png。
- AC-2：列表接口能看到刚上传的文件；删除后 GET 返回 404。
- AC-3：`../x` 之类 key 返回 404；超过 10MB 返回 413。

## 非目标

- 不做鉴权、配额、分片上传、真实 OSS 兼容协议（S3/OSS SDK 不保证可用）。
- 生产环境部署形态后续单独定（可能换真实 OSS）。

## 变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-09-17 | 初版 | 用户要求搭 fake-oss 供后续素材功能使用 |
| 2026-09-17 | 存储目录 server/.oss → 项目根 fake-oss/；key 支持嵌套路径（路由改 `{key:path}`），列表改递归（修订 FR-5） | 用户要求 datas 改存 fake-oss 文件地址，目录按 report/id_N/ 组织 |
