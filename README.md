# layout-pdf-agent

结构化数据 → 自适应 PDF 版式的 agent 系统。前端可视化编辑 JSON，后端 agent 根据数据结构自动推导 PDF 版式并生成 PDF。

本项目采用 **Harness Engineering（驾驭工程）**：SDD（规格驱动开发）为主干 + Harness 治理底座。无论人还是 AI 来开发，都按同一套规则把事做对。

## 目录结构

```
├── AGENTS.md          # AI agent 唯一入口（先读它）
├── harness/           # 治理底座
│   ├── constitution.md      # 宪法：不可协商的核心原则
│   ├── workflows/sdd.md     # SDD 主工作流（规格 → 计划 → 任务 → 实现 → 交付）
│   ├── quality-gates/gates.md  # 质量门禁（每阶段必过的检查）
│   └── context/domain.md    # 领域上下文（架构、映射规则、环境约定）
├── specs/             # 规格库（SDD 主干，每个功能一个目录）
├── web/               # 前端：Vite + React + TS，JSON 数据编辑器
└── server/            # 后端：Python + FastAPI + ReportLab，PDF 布局 agent
```

## 快速开始

```bash
# 数据库（本地 PostgreSQL 17，端口 5433，首次需 createdb layout_pdf_agent）
brew services start postgresql@17

# 后端（端口 3688，DATABASE_URL 默认 postgresql://localhost:5433/layout_pdf_agent）
cd server && uv sync && uv run server

# 启用 AI 自动布局（LLM）：在 server/.env 配置任意 OpenAI 兼容端点
#   LLM_BASE_URL / LLM_API_KEY / LLM_MODEL（优先级高）或 MOONSHOT_BASE_URL / MOONSHOT_API_KEY / MOONSHOT_MODEL
#   可切到 Kimi Code 会员端点 https://api.kimi.com/coding/v1（模型 k3）或本地模型
cd server && uv run --env-file .env server

# 前端（端口 3699，代理 /api → 3688）
pnpm -C web install && pnpm -C web dev
```

打开 http://localhost:3699 ，编辑数据后点击「生成 PDF」即可下载排版好的 PDF。

## 开发规则

新功能一律走 SDD 流程：先在 `specs/` 写规格并确认，再实现，逐阶段过质量门禁。详见 [AGENTS.md](AGENTS.md)。
