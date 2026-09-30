"""数据绑定 agent（specs/012-agent-bind）：按组件标注生成组件级数据脚本 bindScript。

与原 agent（agent.py 生成整份 Jinja 模板）相互独立。流程：查库取 config/fake_data →
组件标注（id/type/dataSource/dataMap）+ 用户指令组装 prompt → LLM 输出
{scripts: {组件id: 函数体}} → 浏览器冒烟执行（失败带 feedback 重试，由前端驱动）。
脚本契约：形参 data = fake_data 全文，return 该组件展示字段的覆盖对象。
"""

import json
from typing import Callable, Optional

from app import db
from app.llm import chat
from app.oss import read_json

DATA_SAMPLE_ROWS = 3

SYSTEM_PROMPT = (
    "你是数据绑定工程师。给你报表组件的数据标注，你为每个组件写一段 JavaScript 函数体。\n"
    "输出契约：\n"
    "1. 只输出 JSON：{\"scripts\": {\"组件id\": \"函数体字符串\"}}，不要 Markdown 围栏，不要解释。\n"
    "2. 函数体形参为 data（测评数据 JSON，结构见数据样例），return 一个对象：该组件展示字段的覆盖值。\n"
    "3. 字段名必须与组件字段一致（字段家族规范：label/note/icon 由人控制，脚本禁止返回；\n"
    "   value/value_xxx 由你控制。组件配置里 value 家族的当前内容是占位显示 + 写给你的语义说明，\n"
    "   描述该值应该算什么；你要返回按真实数据计算出的展示值）：\n"
    "   - stat-card → {value}\n"
    "   - info-line → {value}\n"
    "   - stat-group → {value_map: {\"卡片label\": \"值\"}}（label 与配置中的完全一致，\n"
    "     顺序不限；label/note/icon 人控，不要返回 items 数组）\n"
    "   - row-table → {value_map: {\"行label\": \"值\"}}（每个标签行一个值）\n"
    "   - column-table → {value_map: {\"列label\": [\"行1值\", \"行2值\", …]}}（列方向数组，\n"
    "     各列等长，label 与表头完全一致；行数由分组结果决定）\n"
    "   - matrix-table → {value_map: {\"行label\": {\"列label\": \"值\"}}}（行与列 label 都与配置\n"
    "     完全一致，逐单元格给出；行配置的 cells 里按列 label 给了每个单元格的取数说明；\n"
    "     缺单元格可省略该键）\n"
    "   - donut-chart / bar-chart → {dataJson}（JSON 字符串：[{\"name\":\"已完成\",\"value\":35}]）\n"
    "   - text / heading → {content}\n"
    "   - page / columns-2 / columns-3 / spacer / data-script 是布局容器，不需要脚本\n"
    "4. 纯同步 JS：禁止 async/fetch/require/DOM/浏览器 API，只用基本运算与数组方法。\n"
    "5. 每个组件给你它的全部字段配置和当前渲染 HTML。计算逻辑始终根据 HTML 里的展示文案/数值\n"
    "   和数据样例自行推断；字段配置里的 dataMap（计算说明）如有内容，作为补充说明一并参考\n"
    "   （尤其是数值格式约定，如保留 1 位小数用 toFixed）。\n"
    "6. 无法推断计算的组件不要出现在 scripts 里。\n"
    "7. 函数体里不要包函数声明外壳，直接是函数体语句（会以 new Function('data', 函数体) 执行）。"
)


def _sample(data: object) -> str:
    if isinstance(data, list):
        rows = data[:DATA_SAMPLE_ROWS]
        return f"共 {len(data)} 条记录，前 {len(rows)} 条：\n{json.dumps(rows, ensure_ascii=False, indent=2, default=str)}"
    return json.dumps(data, ensure_ascii=False, default=str)[:3000]


def build_prompt(
    doc: dict,
    config: object,
    data: object,
    components: list[dict],
    instruction: str,
    feedback: Optional[str] = None,
) -> str:
    component_blocks = []
    for c in components:
        block = f"组件 {c['id']}（{c.get('type', '')}）：\n字段配置：{json.dumps(c.get('props', {}), ensure_ascii=False, default=str)}"
        if c.get('html'):
            block += f"\n当前渲染 HTML：\n{c['html']}"
        component_blocks.append(block)
    parts = [
        f"【指标规范】（{doc['config_url']}）：\n{json.dumps(config, ensure_ascii=False, default=str)}",
        f"【数据样例】（{doc['fake_data_url']}）：\n{_sample(data)}",
        "【组件配置与渲染】\n" + "\n\n".join(component_blocks),
        f"【用户要求】{instruction}",
    ]
    if feedback:
        parts.append(
            "【修复要求】你上一轮输出的脚本在浏览器执行失败，错误如下，请修复后重新输出完整 JSON：\n"
            f"{feedback}"
        )
    return "\n\n".join(parts)


def _extract_dict(out: str, key: str) -> Optional[dict]:
    """从 LLM 输出提取 {key: {id: 字符串}} 结构（容错 Markdown 围栏）。"""
    text = out.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0]
    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, IndexError):
        return None
    items = payload.get(key)
    if not isinstance(items, dict):
        return None
    return {str(k): v for k, v in items.items() if isinstance(v, str) and v.strip()}


STYLE_SYSTEM_PROMPT = (
    "你是报表组件样式设计师。给你报表组件的字段配置和当前渲染 HTML，你为每个组件编写组件级 CSS。\n"
    "输出契约：\n"
    "1. 只输出 JSON：{\"styles\": {\"组件id\": \"CSS 文本\"}}，不要 Markdown 围栏，不要解释。\n"
    "2. 每条规则的选择器必须以 [data-bid=\"组件id\"] 开头（样式只作用于该组件块，禁止波及其他组件）。\n"
    "3. 只能使用组件 HTML 里已存在的标签与 class；禁止 position:fixed/absolute、@import、外部资源 url()。\n"
    "4. 遵循视觉样式规范的配色/字号约定；字段配置里的 styleMap（样式说明）如有内容，\n"
    "   作为补充说明一并参考（用户口述的样式意图）。\n"
    "5. 无需改样式的组件不要出现在 styles 里。"
)


def build_style_prompt(
    style: Optional[dict],
    components: list[dict],
    instruction: str,
    feedback: Optional[str] = None,
) -> str:
    component_blocks = []
    for c in components:
        block = f"组件 {c['id']}（{c.get('type', '')}）：\n字段配置：{json.dumps(c.get('props', {}), ensure_ascii=False, default=str)}"
        if c.get('html'):
            block += f"\n当前渲染 HTML：\n{c['html']}"
        component_blocks.append(block)
    parts = [
        f"【视觉样式规范】（{style['name']}）：\n{style['content']}" if style else "【视觉样式规范】（未设置）",
        "【组件配置与渲染】\n" + "\n\n".join(component_blocks),
        f"【用户要求】{instruction}",
    ]
    if feedback:
        parts.append(
            "【修复要求】你上一轮输出的 CSS 未通过校验，错误如下，请修复后重新输出完整 JSON：\n"
            f"{feedback}"
        )
    return "\n\n".join(parts)


def run_agent_bind(
    document_id: int,
    components: list[dict],
    instruction: str,
    feedback: Optional[str] = None,
    chat_fn: Optional[Callable] = None,
    mode: str = "data",
) -> dict:
    """mode='data' 生成数据脚本 bindScript；mode='style' 生成组件样式 bindStyle。

    返回 {ok, scripts|styles, reply}。可用性由浏览器/前端冒烟校验决定，失败带 feedback 重调。
    """
    doc = db.get_document(document_id)
    if doc is None:
        return {"ok": False, "reply": "文档不存在"}
    call = chat_fn or (lambda messages: chat(messages, max_tokens=4000, timeout=120))

    if mode == "style":
        style = db.get_style_or_default(doc.get("style_id"))
        prompt = build_style_prompt(style, components, instruction, feedback)
        out = call([
            {"role": "system", "content": STYLE_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ])
        if out is None:
            return {"ok": False, "reply": "LLM 调用失败（详见服务端日志）"}
        styles = _extract_dict(out, "styles")
        if styles is None:
            return {"ok": False, "reply": "LLM 输出格式异常（未解析出 styles JSON）"}
        if not styles:
            return {"ok": True, "styles": {}, "reply": "LLM 认为没有需要改样式的组件"}
        return {"ok": True, "styles": styles, "reply": f"已生成 {len(styles)} 个组件的样式"}

    config = read_json(doc.get("config_url"))
    data = read_json(doc.get("fake_data_url"))
    prompt = build_prompt(doc, config, data, components, instruction, feedback)
    out = call([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ])
    if out is None:
        return {"ok": False, "reply": "LLM 调用失败（详见服务端日志）"}
    scripts = _extract_dict(out, "scripts")
    if scripts is None:
        return {"ok": False, "reply": "LLM 输出格式异常（未解析出 scripts JSON）"}
    if not scripts:
        return {"ok": True, "scripts": {}, "reply": "LLM 认为没有可按标注绑定的组件"}
    return {"ok": True, "scripts": scripts, "reply": f"已生成 {len(scripts)} 个组件的数据脚本"}
