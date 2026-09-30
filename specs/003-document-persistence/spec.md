# 规格：数据文档持久化（PostgreSQL）

- 状态：已实现
- 创建日期：2026-08-21

## 用户场景

用户在前端编辑好一份 JSON 数据后，希望能保存下来，下次打开还能取回继续用，而不是只能复制/下载。后端连接本地 PostgreSQL 数据库，提供数据与文档的存取能力。

## 功能需求

- FR-1：后端连接本地 PostgreSQL，连接串由环境变量 `DATABASE_URL` 注入，默认 `postgresql://localhost:5433/layout_pdf_agent`；服务启动时自动建表（含旧结构迁移），无需手动迁移。
- FR-2：数据库分两张表：
  - `datas`：JSON 数据表（`id` 主键、`name` 名称（缺省「未命名数据」）、`data` JSONB、`created_at`；旧表自动补列）。
  - `documents`：文档表（`id` 主键、`title`、`data_id` 外键引用 `datas.id`、`template_id` 外键引用 `templates.id`（可空，模板删除时置空）、`created_at`）。
- FR-3：数据表增删改查接口：
  - `POST /api/data` 接收 `{data, name?}`，返回 `id`。
  - `GET /api/data` 列表（`id`、`name`、`created_at`，不含正文）。
  - `GET /api/data/{id}` 返回完整数据（含 `name`）。
  - `PUT /api/data/{id}` 接收 `{data, name?}` 全量更新（`name` 缺省不改动），不存在返回 404。
  - `DELETE /api/data/{id}` 删除，不存在返回 404。
- FR-4：文档接口：
  - `POST /api/documents` 接收 `{title?, data_id}`，`title` 缺省「未命名文档」；`data_id` 不存在返回 422。
  - `GET /api/documents` 列表（`id`、`title`、`data_id`、`created_at`）。
  - `GET /api/documents/{id}` 返回文档及其关联的完整 `data`；不存在返回 404。
- FR-5：仓库不提交任何数据库凭据；连接配置只走环境变量。
- FR-6：`PUT /api/documents/{id}` 绑定数据：接收 `{data_id}` 更新文档的数据关联；文档不存在返回 404，`data_id` 无效返回 422。

## 验收标准

- AC-1：服务启动后 `datas`、`documents` 两表就绪（旧单表结构自动迁移），`GET /api/health` 正常。（对应 FR-1、FR-2）
- AC-2：数据 CRUD 全链路实测：POST 含中文数据 → GET 取回一致 → PUT 更新后取回为新值 → DELETE 后 GET 返回 404。（对应 FR-3）
- AC-3：POST 文档关联已存在的 `data_id` 返回 `id`；GET `/api/documents/{id}` 返回关联的完整 data；列表不含 data 正文。（对应 FR-4）
- AC-4：用不存在的 `data_id` 创建文档返回 422。（对应 FR-4）
- AC-5：仓库中不存在硬编码的密码/凭据。（对应 FR-5）
- AC-6：PUT 绑定存在的 `data_id` 返回 200 且列表中 `data_id` 更新；文档不存在返回 404；`data_id` 无效返回 422。（对应 FR-6）

## 非目标（Out of Scope）

- ORM 层、迁移工具、连接池调优。
- 文档删除接口、鉴权。

## 变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-08-21 | 初始规格（SQLite 方案） | 用户要求后端连接本地数据库 |
| 2026-08-21 | SQLite → PostgreSQL | 用户指定使用本地 PostgreSQL（实例端口 5433） |
| 2026-08-21 | 拆为 datas/documents 两表；documents 引用 datas 主键；新增数据 CRUD 接口；文档创建改为传 `data_id` | 用户要求分表并提供 JSON 数据增删改查 |
| 2026-08-21 | 新增 FR-6/AC-6：`PUT /api/documents/{id}` 绑定数据接口 | 用户要求文档列表提供「绑定数据ID」操作 |
| 2026-08-21 | FR-2/FR-3：datas 表增加 `name` 列，CRUD 接口读写 name | 用户要求 datas 表增加 name 列 |
| 2026-08-21 | FR-2：documents 增加 `template_id` 外键（可空）引用 templates 表 | 用户要求 documents 关联模板 |
| 2026-09-17 | datas 表增加 `url` 列（可空）：大数据改存 fake-oss 文件，datas 只存文件地址（`/oss/files/<key>`）；渲染时优先按 url 读文件、回退 data 列；既有行 data 清空、id=1 数据迁入 .oss | 用户要求 agent 假数据改用 OSS 文件，datas 存文件地址 |
| 2026-09-17 | datas 表再调整：删除 `data`（内嵌 JSON）与 `url` 列，改为 `config_url` + `fake_data_url` 双文件地址（指向 fake-oss 的 report/id_N/ 下文件）；CRUD 接口同步改为读写 name/config_url/fake_data_url；渲染数据改从 fake_data_url 读取（此前的 data/url 方案废止） | 用户要求datas表存 config 与 fake-data 两个文件地址 |
| 2026-09-17 | documents 增加 `template_url` 列：模板 HTML 存 fake-oss 文件（约定 `report/id_<data_id>/tid_<document_id>/pdf.html`，同一份数据可有多个样式模板），渲染优先读 template_url、回退 template_id；新增 `update_document_template_url` | 用户要求 AI 每次改完 HTML 存文件并记录路径 |
| 2026-09-17 | 旧 agent 存储方案彻底清除：DROP templates 表与 documents.template_id 列，删除 upsert_template/get_template/update_document_template 及 render 的 template_id 回退；模板唯一来源为 template_url | 用户确认旧 agent（含 JSON 解析管线）删除干净 |
| 2026-09-17 | template_url 路径约定改为 `/oss/files/report/data_id_<datas.id>/document_id_<documents.id>/pdf.html`（原 id_N/tid_N 废止），datas 两个 url 同步改名；`oss.template_url_for()` 统一生成该路径 | 用户调整 fake-oss 目录命名 |
