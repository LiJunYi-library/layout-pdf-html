"""LLM 客户端（任意 OpenAI 兼容端点，stdlib 实现，超时按调用方传入，默认 30s）。

环境变量（LLM_* 优先级高于 MOONSHOT_*）：
- `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`：通用覆盖，可切到任何 OpenAI 兼容端点
  （如 Kimi Code 会员端点 `https://api.kimi.com/coding/v1` 模型 `k3`，或本地模型）。
- `MOONSHOT_BASE_URL`（默认 https://api.moonshot.cn/v1）/ `MOONSHOT_API_KEY` / `MOONSHOT_MODEL`（默认 kimi-k3）。
无 key 或任何失败一律返回 None，由调用方回退。
"""

import json
import os
import urllib.request
from typing import Optional

TIMEOUT_SECONDS = 30


def _config() -> Optional[tuple[str, str, str]]:
    key = os.getenv("LLM_API_KEY") or os.getenv("MOONSHOT_API_KEY")
    if not key:
        return None
    base = (
        os.getenv("LLM_BASE_URL")
        or os.getenv("MOONSHOT_BASE_URL")
        or "https://api.moonshot.cn/v1"
    ).rstrip("/")
    model = os.getenv("LLM_MODEL") or os.getenv("MOONSHOT_MODEL") or "kimi-k3"
    return base, key, model


def chat(messages: list[dict], max_tokens: int = 2000, timeout: int = TIMEOUT_SECONDS) -> Optional[str]:
    """调用 chat completions，返回文本内容；不可用/失败打印原因并返回 None。"""
    cfg = _config()
    if cfg is None:
        print("[llm] 未配置 API key")
        return None
    base, key, model = cfg
    body: dict = {"model": model, "messages": messages, "max_tokens": max_tokens}
    if model.startswith("kimi-k3") or model.startswith("k3"):
        # k3 思考强度调低，缩短整次调用耗时
        body["reasoning_effort"] = "low"
    request = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        print(f"[llm] HTTP {exc.code}: {detail}")
        return None
    except Exception as exc:
        print(f"[llm] {type(exc).__name__}: {exc}")
        return None


def build_prompt(
    shape: dict,
    sample: object,
    feedback: Optional[str] = None,
    instruction: Optional[str] = None,
) -> str:
    """模板生成 prompt；feedback 为上一轮校验错误，instruction 为用户的布局指令。"""
    prompt = (
        "为以下 JSON 数据形状写一个 Jinja2 模板片段，用于 A4 报表中的一个布局块。\n"
        "要求：\n"
        "1. 只输出模板本身（HTML + 内联样式），不要解释，不要 Markdown 代码围栏。\n"
        "2. 可用变量：data（该块的 JSON 子数据）、placement（含 blockId/x/y/w/h）。\n"
        "3. 禁止任何外部资源；如需图表可使用全局 echarts（已加载），容器 id 用 "
        '"chart-{{ placement.blockId }}"。\n'
        "4. 内容必须适配固定宽度块，不得溢出。\n"
        f"数据形状：{json.dumps(shape, ensure_ascii=False)}\n"
        f"样例数据：{json.dumps(sample, ensure_ascii=False, default=str)[:2000]}"
    )
    if instruction:
        prompt += f"\n\n用户的布局要求（务必遵循）：{instruction}"
    if feedback:
        prompt += (
            "\n\n你上一轮输出的模板未通过校验，错误信息如下，请修复后重新输出完整模板：\n"
            f"{feedback}"
        )
    return prompt


def extract_template(content: Optional[str]) -> Optional[str]:
    """从模型输出中提取模板（容忍 Markdown 围栏）。"""
    if not content:
        return None
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
    return text.strip() or None
