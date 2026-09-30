import os
from typing import Optional

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5433/layout_pdf_agent")

DEFAULT_SPEC_CONTENT = """图表与排版行为默认值（用户未明确说明时遵守）：
- 环形图（donut）：不显示 tooltip，不显示 legend；中心显示总数或核心指标；名称与百分比直接标注在扇区旁。
- 柱状图/条形图：单系列不显示 legend；数值标注在柱顶或条端。
- 折线图：显示数据点，不填充面积。
- 所有图表关闭动画（animation: false），不依赖任何鼠标交互（打印静态产物）。
- 每页内容不溢出 A4 页面；图表容器高度固定。
"""

DEFAULT_STYLE_CONTENT = """视觉主题默认值：
- 主色 #2563eb，辅色 #93c5fd，强调色 #f59e0b；一套图表配色不超过 6 色。
- 标题 18px 加粗，正文 12px，注释 10px 灰色 #6b7280。
- 卡片：白底 #ffffff，圆角 8px，边框 1px #e5e7eb。
- 页面背景 #f3f4f6。
"""


def init_db() -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS datas (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '未命名数据',
                config_url TEXT,
                fake_data_url TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        data_columns = {
            row[0]
            for row in conn.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'datas'"
            ).fetchall()
        }
        if "name" not in data_columns:
            conn.execute("ALTER TABLE datas ADD COLUMN name TEXT NOT NULL DEFAULT '未命名数据'")
        if "config_url" not in data_columns:
            conn.execute("ALTER TABLE datas ADD COLUMN config_url TEXT")
        if "fake_data_url" not in data_columns:
            conn.execute("ALTER TABLE datas ADD COLUMN fake_data_url TEXT")
        # 旧结构清理：data（内嵌 JSON）与 url（单文件地址）列已被 config_url/fake_data_url 取代
        if "data" in data_columns:
            conn.execute("ALTER TABLE datas DROP COLUMN data")
        if "url" in data_columns:
            conn.execute("ALTER TABLE datas DROP COLUMN url")
        columns = {
            row[0]
            for row in conn.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'documents'"
            ).fetchall()
        }
        if not columns:
            conn.execute("""
                CREATE TABLE documents (
                    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    title TEXT NOT NULL,
                    data_id INTEGER NOT NULL REFERENCES datas(id) ON DELETE CASCADE,
                    template_url TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            columns.add("template_url")
        if "template_url" not in columns:
            conn.execute("ALTER TABLE documents ADD COLUMN template_url TEXT")
        # 旧 agent 的模板存库方案废止：templates 表与 template_id 列由 template_url（fake-oss 文件）取代
        if "template_id" in columns:
            conn.execute("ALTER TABLE documents DROP COLUMN template_id")
        conn.execute("DROP TABLE IF EXISTS templates")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS specs (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                name TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS styles (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                name TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        if not conn.execute("SELECT 1 FROM specs LIMIT 1").fetchone():
            conn.execute(
                "INSERT INTO specs (name, content) VALUES (%s, %s)",
                ("默认图表规范", DEFAULT_SPEC_CONTENT),
            )
        if not conn.execute("SELECT 1 FROM styles LIMIT 1").fetchone():
            conn.execute(
                "INSERT INTO styles (name, content) VALUES (%s, %s)",
                ("默认样式", DEFAULT_STYLE_CONTENT),
            )
        if "spec_id" not in columns:
            conn.execute("ALTER TABLE documents ADD COLUMN spec_id INTEGER REFERENCES specs(id)")
        if "style_id" not in columns:
            conn.execute("ALTER TABLE documents ADD COLUMN style_id INTEGER REFERENCES styles(id)")
        if "editor_url" not in columns:
            conn.execute("ALTER TABLE documents ADD COLUMN editor_url TEXT")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS dialogue (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                text TEXT NOT NULL,
                images JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)


# ---------- datas 表 CRUD ----------

def create_data(
    name: str = "未命名数据",
    config_url: Optional[str] = None,
    fake_data_url: Optional[str] = None,
) -> int:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            "INSERT INTO datas (name, config_url, fake_data_url) VALUES (%s, %s, %s) RETURNING id",
            (name, config_url, fake_data_url),
        ).fetchone()
        return row[0]  # type: ignore[index]


def list_data() -> list[dict]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        return conn.execute(
            "SELECT id, name, config_url, fake_data_url, created_at FROM datas ORDER BY id DESC"
        ).fetchall()


def get_data(data_id: int) -> Optional[dict]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        return conn.execute(
            "SELECT id, name, config_url, fake_data_url, created_at FROM datas WHERE id = %s",
            (data_id,),
        ).fetchone()


def update_data(
    data_id: int,
    name: Optional[str] = None,
    config_url: Optional[str] = None,
    fake_data_url: Optional[str] = None,
) -> bool:
    sets: list[str] = []
    params: list = []
    for column, value in (("name", name), ("config_url", config_url), ("fake_data_url", fake_data_url)):
        if value is not None:
            sets.append(f"{column} = %s")
            params.append(value)
    if not sets:
        return False
    params.append(data_id)
    with psycopg.connect(DATABASE_URL) as conn:
        cursor = conn.execute(f"UPDATE datas SET {', '.join(sets)} WHERE id = %s", params)
        return cursor.rowcount > 0


def delete_data(data_id: int) -> bool:
    with psycopg.connect(DATABASE_URL) as conn:
        cursor = conn.execute("DELETE FROM datas WHERE id = %s", (data_id,))
        return cursor.rowcount > 0


# ---------- documents 表 ----------

def create_document(title: str, data_id: int) -> Optional[int]:
    with psycopg.connect(DATABASE_URL) as conn:
        if not conn.execute("SELECT 1 FROM datas WHERE id = %s", (data_id,)).fetchone():
            return None
        row = conn.execute(
            "INSERT INTO documents (title, data_id) VALUES (%s, %s) RETURNING id",
            (title, data_id),
        ).fetchone()
        return row[0]  # type: ignore[index]


def list_documents() -> list[dict]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        return conn.execute(
            "SELECT id, title, data_id, template_url, created_at "
            "FROM documents ORDER BY id DESC"
        ).fetchall()


def get_document(document_id: int) -> Optional[dict]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        return conn.execute(
            """
            SELECT doc.id, doc.title, doc.data_id, doc.template_url,
                   doc.spec_id, doc.style_id, doc.editor_url,
                   doc.created_at, d.config_url, d.fake_data_url
            FROM documents doc
            JOIN datas d ON d.id = doc.data_id
            WHERE doc.id = %s
            """,
            (document_id,),
        ).fetchone()


UNSET = object()


def update_document_spec_style(
    document_id: int,
    spec_id: object = UNSET,
    style_id: object = UNSET,
) -> Optional[bool]:
    """绑定/解绑规范与样式。返回 None=文档不存在或无字段，False=外键无效，True=成功。

    字段不传（UNSET）=不改动；传 None=解绑；传 int=绑定（校验存在性）。
    """
    sets: list[str] = []
    params: list = []
    for column, value, table in (
        ("spec_id", spec_id, "specs"),
        ("style_id", style_id, "styles"),
    ):
        if value is UNSET:
            continue
        if value is not None:
            with psycopg.connect(DATABASE_URL) as conn:
                if not conn.execute(f"SELECT 1 FROM {table} WHERE id = %s", (value,)).fetchone():
                    return False
        sets.append(f"{column} = %s")
        params.append(value)
    if not sets:
        return None
    params.append(document_id)
    with psycopg.connect(DATABASE_URL) as conn:
        if not conn.execute("SELECT 1 FROM documents WHERE id = %s", (document_id,)).fetchone():
            return None
        conn.execute(f"UPDATE documents SET {', '.join(sets)} WHERE id = %s", params)
        return True


def update_document_template_url(document_id: int, template_url: str) -> bool:
    """AI 布局回写：模板 HTML 存 fake-oss 后，把文件地址写回 documents.template_url。"""
    with psycopg.connect(DATABASE_URL) as conn:
        cursor = conn.execute(
            "UPDATE documents SET template_url = %s WHERE id = %s",
            (template_url, document_id),
        )
        return cursor.rowcount > 0


def update_document_editor_url(document_id: int, editor_url: str) -> bool:
    """编辑器数据（Puck JSON）存 fake-oss 后回写 documents.editor_url。"""
    with psycopg.connect(DATABASE_URL) as conn:
        cursor = conn.execute(
            "UPDATE documents SET editor_url = %s WHERE id = %s",
            (editor_url, document_id),
        )
        return cursor.rowcount > 0


# ---------- dialogue 表（agent-bind 数据绑定对话） ----------

def add_dialogue(document_id: int, role: str, text: str) -> int:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            "INSERT INTO dialogue (document_id, role, text) VALUES (%s, %s, %s) RETURNING id",
            (document_id, role, text),
        ).fetchone()
        return row[0]  # type: ignore[index]


def list_dialogue(document_id: int) -> list[dict]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        return conn.execute(
            "SELECT id, role, text, created_at FROM dialogue "
            "WHERE document_id = %s ORDER BY id",
            (document_id,),
        ).fetchall()


def update_document_data(document_id: int, data_id: int) -> Optional[bool]:
    """返回 None 表示文档不存在，False 表示 data_id 无效，True 表示更新成功。"""
    with psycopg.connect(DATABASE_URL) as conn:
        if not conn.execute("SELECT 1 FROM documents WHERE id = %s", (document_id,)).fetchone():
            return None
        if not conn.execute("SELECT 1 FROM datas WHERE id = %s", (data_id,)).fetchone():
            return False
        conn.execute(
            "UPDATE documents SET data_id = %s WHERE id = %s", (data_id, document_id)
        )
        return True


# ---------- messages 表（布局对话） ----------

def add_message(document_id: int, role: str, text: str, images: Optional[list] = None) -> int:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            "INSERT INTO messages (document_id, role, text, images) VALUES (%s, %s, %s, %s) RETURNING id",
            (document_id, role, text, Jsonb(images) if images else None),
        ).fetchone()
        return row[0]  # type: ignore[index]


def list_messages(document_id: int) -> list[dict]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        return conn.execute(
            "SELECT id, role, text, images, created_at FROM messages "
            "WHERE document_id = %s ORDER BY id",
            (document_id,),
        ).fetchall()


# ---------- specs / styles 表（图表规范 + 视觉样式） ----------

def _list_named(table: str) -> list[dict]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        return conn.execute(
            f"SELECT id, name, created_at FROM {table} ORDER BY id"
        ).fetchall()


def _get_named(table: str, row_id: int) -> Optional[dict]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        return conn.execute(
            f"SELECT id, name, content, created_at FROM {table} WHERE id = %s",
            (row_id,),
        ).fetchone()


def _get_default_named(table: str) -> Optional[dict]:
    """默认行 = id 最小者（文档未绑定时 agent 的回退）。"""
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        return conn.execute(
            f"SELECT id, name, content, created_at FROM {table} ORDER BY id LIMIT 1"
        ).fetchone()


def _update_named(table: str, row_id: int, name: Optional[str], content: Optional[str]) -> bool:
    sets: list[str] = []
    params: list = []
    for column, value in (("name", name), ("content", content)):
        if value is not None:
            sets.append(f"{column} = %s")
            params.append(value)
    if not sets:
        return False
    params.append(row_id)
    with psycopg.connect(DATABASE_URL) as conn:
        cursor = conn.execute(f"UPDATE {table} SET {', '.join(sets)} WHERE id = %s", params)
        return cursor.rowcount > 0


def list_specs() -> list[dict]:
    return _list_named("specs")


def get_spec(spec_id: int) -> Optional[dict]:
    return _get_named("specs", spec_id)


def get_spec_or_default(spec_id: Optional[int]) -> Optional[dict]:
    return _get_named("specs", spec_id) if spec_id else _get_default_named("specs")


def update_spec(spec_id: int, name: Optional[str] = None, content: Optional[str] = None) -> bool:
    return _update_named("specs", spec_id, name, content)


def list_styles() -> list[dict]:
    return _list_named("styles")


def get_style(style_id: int) -> Optional[dict]:
    return _get_named("styles", style_id)


def get_style_or_default(style_id: Optional[int]) -> Optional[dict]:
    return _get_named("styles", style_id) if style_id else _get_default_named("styles")


def update_style(style_id: int, name: Optional[str] = None, content: Optional[str] = None) -> bool:
    return _update_named("styles", style_id, name, content)
