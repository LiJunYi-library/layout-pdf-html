# AGENTS.md — AI Agent 唯一入口

无论人还是 AI 来开发，都按同一套规则把事做对。本文件是 AI agent 进入本项目的**唯一入口**；开始任何工作前，必须按下列顺序阅读治理层文档：

1. [harness/constitution.md](harness/constitution.md) — 宪法：不可协商的核心原则
2. [harness/workflows/sdd.md](harness/workflows/sdd.md) — SDD 主工作流：规格驱动开发
3. [harness/quality-gates/gates.md](harness/quality-gates/gates.md) — 质量门禁：每个阶段必须通过的检查
4. [harness/context/domain.md](harness/context/domain.md) — 领域上下文：项目是什么、怎么跑

## 铁律（详见宪法）

- **规格先行**：任何功能先写 `specs/` 下的规格，再写代码。没有规格的代码不接受。
- **门禁必过**：每个开发阶段结束必须通过对应质量门禁，红灯即停，不得绕过。
- **最小改动**：只做规格要求的事，不顺手重构、不扩大范围。
- **验证才敢说完成**：跑过检查、看过结果，才算完成；不许把未验证的工作说成已完成。

## 项目速览

| 目录 | 说明 |
|------|------|
| `web/` | 前端：Vite + React + TS，JSON 数据编辑器 |
| `server/` | 后端：Python + FastAPI + LangGraph，AI 布局适配 agent 服务 |
| `specs/` | 功能规格库（SDD 主干） |
| `harness/` | 治理底座：宪法、工作流、质量门禁、领域上下文 |

## 常用命令

```bash
# 前端（web/）
pnpm -C web install && pnpm -C web dev      # 开发
pnpm -C web build && pnpm -C web lint       # 门禁

# 后端（server/）
cd server && uv sync
uv run --env-file .env server        # 开发（端口 3688；.env 走 Kimi Code 会员端点 k3-256k）
uv run --env-file .env.prod server   # 生产（.env.prod 走 Moonshot 开放平台 kimi-k3，按量付费）
```
