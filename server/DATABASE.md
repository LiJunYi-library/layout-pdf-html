# 本地数据库连接信息（PostgreSQL）

| 项 | 值 |
|----|----|
| 主机 | `localhost` |
| 端口 | `5433` |
| 数据库 | `layout_pdf_agent` |
| 用户名 | `lijunyi`（超级用户） |
| 密码 | **无密码**（pg_hba 为 trust 认证，仅本机可连） |

连接串（即后端 `DATABASE_URL` 默认值）：

```
postgresql://localhost:5433/layout_pdf_agent
```

## 说明

- 本机 5432 被另一项目（`deep_assess_dev_platform`）的 PostgreSQL 16 占用且有密码，
  本项目实例固定用 5433，不要改回。
- 超级用户 `postgres`（bootstrap 角色，同样无密码）也可用于管理操作。
- trust 认证意味着任何本机进程用以上用户名都能直连；请勿把端口暴露到局域网/公网。

## 常用命令

```bash
# 启停数据库
brew services start postgresql@17
brew services stop postgresql@17

# 进入 psql
/opt/homebrew/opt/postgresql@17/bin/psql -p 5433 -d layout_pdf_agent

# 查看已保存的文档
/opt/homebrew/opt/postgresql@17/bin/psql -p 5433 -d layout_pdf_agent \
  -c 'SELECT id, title, created_at FROM documents ORDER BY id DESC;'
```
