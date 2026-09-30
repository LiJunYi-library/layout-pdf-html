"""fake-oss：本地磁盘假对象存储（仅开发用，无鉴权）。

文件落项目根 fake-oss/（支持 report/id_1/config.json 这类嵌套 key），接口形状
对齐常见 OSS：上传得 key/url、按 key 取/删/列，以后可平滑替换为真实 OSS。
见 specs/008-fake-oss。
"""

import mimetypes
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

OSS_DIR = Path(__file__).resolve().parents[2] / "fake-oss"
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10MB

_KEY_RE = re.compile(r"^[A-Za-z0-9._/-]+$")

router = APIRouter(prefix="/oss", tags=["fake-oss"])


def _key_path(key: str) -> Path | None:
    """key → 磁盘路径；非法（绝对路径/目录穿越）或不存在返回 None。"""
    if not _KEY_RE.match(key) or key.startswith("/") or ".." in key.split("/"):
        return None
    path = OSS_DIR / key
    return path if path.is_file() else None


def _safe_key(key: str) -> Path:
    path = _key_path(key)
    if path is None:
        raise HTTPException(status_code=404, detail="文件不存在")
    return path


def template_url_for(data_id: int, document_id: int) -> str:
    """文档模板文件的约定地址：report/data_id_<N>/document_id_<N>/pdf.html。

    同一份数据（data_id）下可有多份模板（每个 document 一份，样式/颜色不同）。
    """
    return f"/oss/files/report/data_id_{data_id}/document_id_{document_id}/pdf.html"


def editor_url_for(data_id: int, document_id: int) -> str:
    """文档编辑器数据（Puck JSON）的约定地址。"""
    return f"/oss/files/report/data_id_{data_id}/document_id_{document_id}/editor.json"


def read_text(url: object) -> str | None:
    """按 /oss/files/<key> 形式的 url 读文本文件；url 非法或文件不存在返回 None。"""
    prefix = "/oss/files/"
    if not isinstance(url, str) or not url.startswith(prefix):
        return None
    path = _key_path(url[len(prefix):])
    if path is None:
        return None
    return path.read_text(encoding="utf-8")


def read_json(url: object):
    """按 /oss/files/<key> 形式的 url 读 JSON 文件；url 非法或文件不存在返回 None。"""
    text = read_text(url)
    return json.loads(text) if text is not None else None


def write_text(key: str, content: str) -> str:
    """按 key 写文本文件（自动建目录），返回 /oss/files/<key> url；key 非法抛 ValueError。"""
    if not _KEY_RE.match(key) or key.startswith("/") or ".." in key.split("/"):
        raise ValueError(f"非法 OSS key: {key!r}")
    path = OSS_DIR / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return f"/oss/files/{key}"


@router.post("/upload", status_code=201)
async def upload(file: UploadFile) -> dict:
    OSS_DIR.mkdir(exist_ok=True)
    ext = Path(file.filename or "").suffix.lower()[:16]
    key = f"{uuid.uuid4().hex}{ext}"
    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="文件超过 10MB 上限")
    (OSS_DIR / key).write_bytes(data)
    return {"key": key, "url": f"/oss/files/{key}"}


@router.get("/files/{key:path}")
def download(key: str) -> FileResponse:
    path = _safe_key(key)
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)


@router.delete("/files/{key:path}")
def delete(key: str) -> dict:
    _safe_key(key).unlink()
    return {"key": key}


@router.get("/files")
def list_files() -> dict:
    OSS_DIR.mkdir(exist_ok=True)
    files = [
        {
            "key": (key := p.relative_to(OSS_DIR).as_posix()),
            "url": f"/oss/files/{key}",
            "size": p.stat().st_size,
            "created_at": datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat(),
        }
        for p in OSS_DIR.rglob("*")
        if p.is_file()
    ]
    files.sort(key=lambda f: f["created_at"], reverse=True)
    return {"files": files}
