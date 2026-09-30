"""对话式模板生成 agent（specs/009-agent-render）。

流程：查库取 config_url / fake_data_url / template_url → 组装全局提示词 →
LLM 生成-校验-修复（≤3 轮，用真实数据全文冒烟渲染）→ 写 fake-oss 并回写
documents.template_url。模板文件不存在时不附内容，但路径始终告知 LLM。
"""

import json
from typing import Callable, Optional

from app import db
from app.doc_layout import validate_template
from app.llm import chat, extract_template
from app.oss import read_json, read_text, template_url_for, write_text

MAX_ITERATIONS = 3
DATA_SAMPLE_ROWS = 3
OSS_PREFIX = "/oss/files/"

SYSTEM_PROMPT = (
    "你是一名 PDF 报表布局设计师，为心理测评团体报告设计 A4 打印版式。\n"
    "输出契约：\n"
    "1. 只输出完整的 Jinja2 模板（HTML + 内联样式），不要解释，不要 Markdown 代码围栏。\n"
    "2. 可用变量：data（测评数据，JSON）、title（报告标题）。\n"
    '3. 每页是一个 <div class="page">（宽 210mm、高 297mm，A4 纸尺寸，样式已内置）；'
    "内容多就拆成多个 .page，页内边距用内联样式控制。\n"
    "4. 禁止引用外部资源；只允许使用 /oss/files/ 与 /static/ 下的资源；"
    "如需图表可使用全局 echarts（已加载），容器 id 必须唯一。\n"
    "5. 内容必须约束在页面内，不得溢出。\n"
    "优先级：用户要求 > 图表规范 > 视觉样式。规范与样式只规定默认值，用户明确要求时以用户为准。"
)


def _sample_data(data: object) -> str:
    if isinstance(data, list):
        rows = data[:DATA_SAMPLE_ROWS]
        sample = json.dumps(rows, ensure_ascii=False, indent=2, default=str)
        return f"共 {len(data)} 条记录，前 {len(rows)} 条：\n{sample}"
    return json.dumps(data, ensure_ascii=False, default=str)[:3000]


def build_prompt(
    doc: dict,
    config: object,
    data: object,
    template_url: str,
    template_html: Optional[str],
    instruction: str,
    spec: Optional[dict] = None,
    style: Optional[dict] = None,
    feedback: Optional[str] = None,
) -> str:
    """全局提示词组装：规范 → 样式 → 指标规范 → 数据样例 → 当前模板 → 用户指令 → 修复反馈。"""
    parts: list[str] = []
    if spec:
        parts.append(f"【图表规范】（{spec['name']}）：\n{spec['content']}")
    if style:
        parts.append(f"【视觉样式】（{style['name']}）：\n{style['content']}")
    parts += [
        f"【指标规范】（{doc['config_url']}）：\n"
        f"{json.dumps(config, ensure_ascii=False, default=str)}",
        f"【数据样例】（{doc['fake_data_url']}）：\n{_sample_data(data)}",
    ]
    if template_html is not None:
        parts.append(
            f"【当前模板】文件路径：{template_url}。以下是现有内容，请在其基础上按用户要求修改：\n"
            f"{template_html}"
        )
    else:
        parts.append(
            f"【当前模板】文件路径：{template_url}。该文件尚不存在，你将新建它；"
            "你的输出经校验后会被写入此路径。"
        )
    parts.append(f"【用户要求】{instruction}")
    if feedback:
        parts.append(
            "【修复要求】你上一轮输出未通过校验，错误如下，请修复后重新输出完整模板：\n"
            f"{feedback}"
        )
    return "\n\n".join(parts)


def run_agent_render(
    document_id: int,
    instruction: str,
    chat_fn: Optional[Callable] = None,
) -> dict:
    """生成-校验-修复循环，返回 {ok, reply, iterations, template_url}。"""
    doc = db.get_document(document_id)
    if doc is None:
        return {"ok": False, "reply": "文档不存在", "iterations": 0, "template_url": None}

    template_url = doc.get("template_url") or template_url_for(doc["data_id"], document_id)
    template_html = read_text(doc["template_url"]) if doc.get("template_url") else None
    config = read_json(doc.get("config_url"))
    data = read_json(doc.get("fake_data_url"))
    spec = db.get_spec_or_default(doc.get("spec_id"))
    style = db.get_style_or_default(doc.get("style_id"))
    call = chat_fn or (lambda messages: chat(messages, max_tokens=8000, timeout=120))

    feedback: Optional[str] = None
    for iteration in range(1, MAX_ITERATIONS + 1):
        prompt = build_prompt(doc, config, data, template_url, template_html, instruction, spec, style, feedback)
        out = call([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ])
        if out is None:
            return {
                "ok": False,
                "reply": "LLM 调用失败（详见服务端日志），模板未改动。",
                "iterations": iteration,
                "template_url": template_url,
            }
        template = extract_template(out)
        if not template:
            feedback = "输出为空"
            continue
        try:
            validate_template(template, {"data": data, "title": doc["title"]})
        except Exception as exc:
            feedback = str(exc)
            continue
        key = template_url[len(OSS_PREFIX):] if template_url.startswith(OSS_PREFIX) else template_url
        write_text(key, template)
        db.update_document_template_url(document_id, template_url)
        return {
            "ok": True,
            "reply": f"已更新布局模板（LLM 调用 {iteration} 轮），右侧预览已刷新。",
            "iterations": iteration,
            "template_url": template_url,
        }
    return {
        "ok": False,
        "reply": f"模板校验未通过（{MAX_ITERATIONS} 轮）：{feedback}。已有模板未受影响。",
        "iterations": MAX_ITERATIONS,
        "template_url": template_url,
    }
