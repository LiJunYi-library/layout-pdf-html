import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.agent import run_agent_render
from app.agent_bind import run_agent_bind
from app.db import (
    UNSET,
    add_dialogue,
    add_message,
    create_data,
    create_document,
    delete_data,
    get_data,
    get_document,
    get_spec,
    get_style,
    init_db,
    list_data,
    list_dialogue,
    list_documents,
    list_messages,
    list_specs,
    list_styles,
    update_data,
    update_document_data,
    update_document_editor_url,
    update_document_spec_style,
    update_document_template_url,
    update_spec,
    update_style,
)
from app.doc_layout import render_document, render_placeholder, validate_template
from app.oss import editor_url_for, read_json, read_text, template_url_for, write_text
from app.oss import router as oss_router

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="layout-pdf-agent server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(oss_router)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


# ---------- 数据表 CRUD ----------

@app.post("/api/data", status_code=201)
async def create_data_row(request: Request) -> dict:
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="请求体必须是 JSON 对象")
    return {"id": create_data(
        payload.get("name") or "未命名数据",
        payload.get("config_url"),
        payload.get("fake_data_url"),
    )}


@app.get("/api/data")
def list_data_rows() -> dict:
    return {"datas": list_data()}


@app.get("/api/data/{data_id}")
def get_data_row(data_id: int) -> dict:
    row = get_data(data_id)
    if row is None:
        raise HTTPException(status_code=404, detail="数据不存在")
    return row


@app.put("/api/data/{data_id}")
async def update_data_row(data_id: int, request: Request) -> dict:
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="请求体必须是 JSON 对象")
    if not update_data(
        data_id,
        payload.get("name"),
        payload.get("config_url"),
        payload.get("fake_data_url"),
    ):
        raise HTTPException(status_code=404, detail="数据不存在或无待更新字段")
    return {"id": data_id}


@app.delete("/api/data/{data_id}")
def delete_data_row(data_id: int) -> dict:
    if not delete_data(data_id):
        raise HTTPException(status_code=404, detail="数据不存在")
    return {"id": data_id}


# ---------- 文档 ----------

@app.post("/api/documents", status_code=201)
async def create_doc(request: Request) -> dict:
    payload = await request.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("data_id"), int):
        raise HTTPException(status_code=422, detail="请求体必须包含整数 data_id 字段")
    doc_id = create_document(payload.get("title") or "未命名文档", payload["data_id"])
    if doc_id is None:
        raise HTTPException(status_code=422, detail="data_id 对应的数据不存在")
    return {"id": doc_id}


@app.get("/api/documents")
def list_docs() -> dict:
    return {"documents": list_documents()}


@app.get("/api/documents/{document_id}")
def get_doc(document_id: int) -> dict:
    doc = get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    return doc


@app.put("/api/documents/{document_id}")
async def bind_doc_data(document_id: int, request: Request) -> dict:
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="请求体必须是 JSON 对象")
    if isinstance(payload.get("data_id"), int):
        result = update_document_data(document_id, payload["data_id"])
        if result is None:
            raise HTTPException(status_code=404, detail="文档不存在")
        if result is False:
            raise HTTPException(status_code=422, detail="data_id 对应的数据不存在")
    spec_id = payload["spec_id"] if "spec_id" in payload else UNSET
    style_id = payload["style_id"] if "style_id" in payload else UNSET
    for value in (spec_id, style_id):
        if value is not UNSET and value is not None and not isinstance(value, int):
            raise HTTPException(status_code=422, detail="spec_id/style_id 必须是整数或 null")
    if spec_id is not UNSET or style_id is not UNSET:
        result = update_document_spec_style(document_id, spec_id, style_id)
        if result is None:
            raise HTTPException(status_code=404, detail="文档不存在")
        if result is False:
            raise HTTPException(status_code=422, detail="spec_id/style_id 对应的记录不存在")
    return {"id": document_id}


# ---------- 规范 / 样式 ----------

@app.get("/api/specs")
def list_spec_rows() -> dict:
    return {"specs": list_specs()}


@app.get("/api/specs/{spec_id}")
def get_spec_row(spec_id: int) -> dict:
    row = get_spec(spec_id)
    if row is None:
        raise HTTPException(status_code=404, detail="规范不存在")
    return row


@app.put("/api/specs/{spec_id}")
async def update_spec_row(spec_id: int, request: Request) -> dict:
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="请求体必须是 JSON 对象")
    if not update_spec(spec_id, payload.get("name"), payload.get("content")):
        raise HTTPException(status_code=404, detail="规范不存在或无待更新字段")
    return {"id": spec_id}


@app.get("/api/styles")
def list_style_rows() -> dict:
    return {"styles": list_styles()}


@app.get("/api/styles/{style_id}")
def get_style_row(style_id: int) -> dict:
    row = get_style(style_id)
    if row is None:
        raise HTTPException(status_code=404, detail="样式不存在")
    return row


@app.put("/api/styles/{style_id}")
async def update_style_row(style_id: int, request: Request) -> dict:
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="请求体必须是 JSON 对象")
    if not update_style(style_id, payload.get("name"), payload.get("content")):
        raise HTTPException(status_code=404, detail="样式不存在或无待更新字段")
    return {"id": style_id}


@app.get("/api/documents/{document_id}/messages")
def list_doc_messages(document_id: int) -> dict:
    if get_document(document_id) is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    return {"messages": list_messages(document_id)}


# ---------- 编辑器数据（Puck JSON，存 fake-oss） ----------

@app.put("/api/documents/{document_id}/template")
async def put_template(document_id: int, request: Request) -> dict:
    """编辑器"存为模板"：导出片段（window.__DATA__ = {{ data | tojson }} + 块内 bindScript）
    写入 pdf.html 并回写 template_url；入库前用 fake_data 冒烟渲染校验。"""
    doc = get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    payload = await request.json()
    html = payload.get("html") if isinstance(payload, dict) else None
    if not isinstance(html, str) or not html.strip():
        raise HTTPException(status_code=422, detail="请求体必须包含非空 html 字符串")
    try:
        validate_template(html, {"data": read_json(doc.get("fake_data_url")), "title": doc["title"]})
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"模板冒烟渲染失败：{exc}") from exc
    url = template_url_for(doc["data_id"], document_id)
    write_text(url[len("/oss/files/"):], html)
    update_document_template_url(document_id, url)
    return {"id": document_id, "template_url": url, "renderUrl": f"/api/render?documentId={document_id}"}


@app.get("/api/documents/{document_id}/editor")
def get_editor(document_id: int) -> dict:
    doc = get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    url = doc.get("editor_url") or editor_url_for(doc["data_id"], document_id)
    return {"data": read_json(url)}


@app.put("/api/documents/{document_id}/editor")
async def put_editor(document_id: int, request: Request) -> dict:
    doc = get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    payload = await request.json()
    if not isinstance(payload, dict) or "content" not in payload:
        raise HTTPException(status_code=422, detail="请求体必须是 Puck 数据（含 content 字段）")
    url = editor_url_for(doc["data_id"], document_id)
    key = url[len("/oss/files/"):]
    write_text(key, json.dumps(payload, ensure_ascii=False))
    update_document_editor_url(document_id, url)
    return {"id": document_id, "editor_url": url}


# ---------- 数据绑定 agent（agent-bind，对话存 dialogue） ----------

@app.get("/api/documents/{document_id}/dialogue")
def list_doc_dialogue(document_id: int) -> dict:
    if get_document(document_id) is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    return {"messages": list_dialogue(document_id)}


@app.post("/api/agent-bind")
async def agent_bind(request: Request) -> dict:
    payload = await request.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("documentId"), int):
        raise HTTPException(status_code=422, detail="请求体必须包含整数 documentId")
    components = payload.get("components")
    if not isinstance(components, list) or not components:
        raise HTTPException(status_code=422, detail="components 必须是非空数组")
    instruction = payload.get("instruction")
    if not isinstance(instruction, str) or not instruction.strip():
        raise HTTPException(status_code=422, detail="instruction 不能为空")
    feedback = payload.get("feedback")
    document_id = payload["documentId"]
    if get_document(document_id) is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    instruction = instruction.strip()
    mode = payload.get("mode")
    result = run_agent_bind(
        document_id,
        components,
        instruction,
        feedback if isinstance(feedback, str) and feedback.strip() else None,
        mode="style" if mode == "style" else "data",
    )
    add_dialogue(document_id, "user", instruction)
    add_dialogue(document_id, "assistant", result["reply"])
    return {
        "scripts": result.get("scripts", {}),
        "styles": result.get("styles", {}),
        "reply": result["reply"],
        "ok": result["ok"],
    }


# ---------- AI 模板生成 agent ----------

@app.post("/api/agent-render")
async def agent_render(request: Request) -> dict:
    payload = await request.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("documentId"), int):
        raise HTTPException(status_code=422, detail="请求体必须包含整数 documentId")
    instruction = payload.get("instruction")
    if not isinstance(instruction, str) or not instruction.strip():
        raise HTTPException(status_code=422, detail="instruction 不能为空")
    document_id = payload["documentId"]
    if get_document(document_id) is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    instruction = instruction.strip()
    result = run_agent_render(document_id, instruction)
    add_message(document_id, "user", instruction)
    add_message(document_id, "assistant", result["reply"])
    return {"reply": result["reply"], "renderUrl": f"/api/render?documentId={document_id}"}


# ---------- 渲染 ----------

@app.get("/api/render")
def render(documentId: int) -> HTMLResponse:
    """文档渲染 = datas.fake_data_url 的数据 + documents.template_url 的模板文件直接组合。"""
    doc = get_document(documentId)
    if doc is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    html = read_text(doc.get("template_url")) if doc.get("template_url") else None
    if html is None:
        return HTMLResponse(render_placeholder())
    data = read_json(doc.get("fake_data_url"))
    return HTMLResponse(render_document(html, data, doc["title"]))


def main() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "3688")),
        reload=bool(os.getenv("RELOAD")),
    )


if __name__ == "__main__":
    main()
