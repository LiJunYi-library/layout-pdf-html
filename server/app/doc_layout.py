"""整文档渲染：documents.template_url 指向的 Jinja2 模板文件 + datas.fake_data_url 指向的数据文件 → A4 分页 HTML。

未绑定模板的文档显示"暂未设置 PDF 布局"占位页。
模板生成（agent）逻辑已移除，待按新设计重写；本模块只保留渲染与入库校验。
"""

from jinja2.sandbox import SandboxedEnvironment

import re

_env = SandboxedEnvironment(autoescape=True)

_SHELL_CSS = """
body { margin: 0 auto; width: 210mm; padding: 18px 0; background: #e9eaee;
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; color: #24292f; }
.page { position: relative; width: 210mm; height: 297mm; margin: 0 auto 18px;
  background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.18); overflow: hidden; }
.placeholder { margin: 120px auto; text-align: center; color: #6a737d; }
"""

PLACEHOLDER_TEXT = "暂未设置 PDF 布局"


# 模板可用 <!--head-->...<!--/head--> 标记声明应进入 <head> 的内容（样式/数据注入脚本）
_HEAD_RE = re.compile(r"<!--head-->(.*?)<!--/head-->", re.DOTALL)


def _shell(body: str, head: str = "") -> str:
    return (
        '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<script src="/static/echarts.min.js"></script>'
        f"<style>{_SHELL_CSS}</style>{head}</head><body>{body}</body></html>"
    )


def render_placeholder() -> str:
    return _shell(f'<div class="placeholder"><h2>{PLACEHOLDER_TEXT}</h2>'
                  "<p>在左侧与 AI 对话，描述你想要的版式即可生成。</p></div>")


def validate_template(source: str, sample_context: dict) -> None:
    """模板入库前校验：语法 parse + sandbox 冒烟渲染。失败抛异常。"""
    _env.parse(source)
    _env.from_string(source).render(**sample_context)


def render_document(template_html: str, data: object, title: str) -> str:
    """模板 + 数据 → 完整 HTML；渲染异常降级为错误提示页（入库时已校验，正常不会发生）。

    模板含 <!--head--> 标记段时，该段进入 iframe 文档 <head>（其余进 body）。
    """
    try:
        rendered = render_template_source(template_html, {"data": data, "title": title})
        match = _HEAD_RE.search(rendered)
        head = match.group(1) if match else ""
        body = _HEAD_RE.sub("", rendered)
    except Exception as exc:
        head = ""
        body = f'<div class="placeholder"><h2>模板渲染失败</h2><p>{exc}</p></div>'
    return _shell(body, head)


def render_template_source(source: str, context: dict) -> str:
    """sandbox 渲染单份模板，渲染异常向上抛（调用方决定降级策略）。"""
    return _env.from_string(source).render(**context)
