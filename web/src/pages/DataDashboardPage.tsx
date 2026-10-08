// 数据看板（/data-dashboard）：读取授权文件夹里的 data.local.json，报告内容以 2 级表格呈现
// 每个一级章节一张表：分类列（二级 key，rowSpan 合并）| 项目 | 内容
// 二级项是对象数组的，在内容格里嵌套多列子表格
import { useEffect, useState } from "react";
import {
  isFsSupported,
  restoreDirectory,
  requestStoredPermission,
  readJsonFromLocal,
  type RestoreResult,
} from "./GridDemo/localFs";
import "./DataDashboardPage.scss";

type Primitive = string | number | boolean | null;

function isPrimitive(v: unknown): v is Primitive {
  return v == null || typeof v !== "object";
}

function fmt(v: unknown): string {
  return v == null ? "" : String(v);
}

function isObjectArray(v: unknown[]): v is Record<string, unknown>[] {
  return v.every((x) => x != null && typeof x === "object" && !Array.isArray(x));
}

// 单元格内容：原始值直接显示；嵌套对象/数组递归成子表格，不再兜底成 JSON 字符串
function CellContent({ value }: { value: unknown }) {
  if (isPrimitive(value)) return <>{fmt(value)}</>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="muted">（空）</span>;
    if (value.every(isPrimitive)) {
      return <>{value.map((v) => fmt(v)).join("、")}</>;
    }
    if (isObjectArray(value)) return <ObjectArrayTable rows={value} />;
    return (
      <ul className="data-list">
        {value.map((v, i) => (
          <li key={i}>
            <CellContent value={v} />
          </li>
        ))}
      </ul>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span className="muted">（空）</span>;
  // 嵌套对象：每个 key 一行，值继续递归
  return (
    <table className="data-table nested-table">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>
              <CellContent value={v} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// 对象数组 → 多列子表格（列取所有行 key 的并集，保持出现顺序）
function ObjectArrayTable({ rows }: { rows: Record<string, unknown>[] }) {
  const cols: string[] = [];
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!cols.includes(k)) cols.push(k);
    }
  }
  return (
    <table className="data-table nested-table">
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {cols.map((c) => (
              <td key={c}>
                <CellContent value={row[c]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// 平铺键值对象 → 两列表格（一级章节本身只有一层时用）
function KeyValueTable({ obj }: { obj: Record<string, unknown> }) {
  return (
    <table className="data-table kv">
      <tbody>
        {Object.entries(obj).map(([k, v]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>{fmt(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// 二级行模型：一个二级 key 在表格里的呈现方式
type SectionRow =
  | { kind: "simple"; key: string; value: unknown } // 原始值：th + 内容 colspan2
  | { kind: "group"; key: string; pairs: [string, unknown][] } // 平铺对象/原始值数组：分类列 rowSpan
  | { kind: "table"; key: string; rows: Record<string, unknown>[] } // 对象数组：嵌套子表格
  | { kind: "raw"; key: string; value: unknown }; // 更深层嵌套兜底

function buildSectionRows(obj: Record<string, unknown>): SectionRow[] {
  const rows: SectionRow[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (isPrimitive(v)) {
      rows.push({ kind: "simple", key: k, value: v });
    } else if (Array.isArray(v)) {
      if (v.length > 0 && isObjectArray(v)) {
        rows.push({ kind: "table", key: k, rows: v });
      } else if (v.every(isPrimitive)) {
        // 原始值数组：序号作为项目列
        rows.push({
          kind: "group",
          key: k,
          pairs: v.map((item, i) => [String(i + 1), item as unknown]),
        });
      } else {
        rows.push({ kind: "raw", key: k, value: v });
      }
    } else {
      const entries = Object.entries(v as Record<string, unknown>);
      if (entries.every(([, iv]) => isPrimitive(iv))) {
        rows.push({ kind: "group", key: k, pairs: entries });
      } else {
        rows.push({ kind: "raw", key: k, value: v });
      }
    }
  }
  return rows;
}

// 一级章节 → 一张 2 级表格
function SectionTable({ value }: { value: unknown }) {
  if (isPrimitive(value)) return <span>{fmt(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length > 0 && isObjectArray(value)) return <ObjectArrayTable rows={value} />;
    if (value.every(isPrimitive)) {
      return (
        <ul className="data-list">
          {value.map((v, i) => (
            <li key={i}>{fmt(v)}</li>
          ))}
        </ul>
      );
    }
    return <pre className="data-raw">{JSON.stringify(value, null, 2)}</pre>;
  }
  const obj = value as Record<string, unknown>;
  const entries = Object.entries(obj);
  if (entries.length === 0) return <span className="muted">（空）</span>;
  // 章节本身只有一层：直接两列表格
  if (entries.every(([, v]) => isPrimitive(v))) return <KeyValueTable obj={obj} />;

  return (
    <table className="data-table two-level">
      <thead>
        <tr>
          <th className="col-category">分类</th>
          <th className="col-item">项目</th>
          <th>内容</th>
        </tr>
      </thead>
      <tbody>
        {buildSectionRows(obj).map((row) => {
          switch (row.kind) {
            case "simple":
              return (
                <tr key={row.key}>
                  <th>{row.key}</th>
                  <td colSpan={2}>{fmt(row.value)}</td>
                </tr>
              );
            case "group":
              if (row.pairs.length === 0) {
                return (
                  <tr key={row.key}>
                    <th>{row.key}</th>
                    <td colSpan={2} className="muted">
                      （空）
                    </td>
                  </tr>
                );
              }
              return row.pairs.map(([ik, iv], i) => (
                <tr key={`${row.key}-${i}`}>
                  {i === 0 && <th rowSpan={row.pairs.length}>{row.key}</th>}
                  <td className="sub-key">{ik}</td>
                  <td>{fmt(iv)}</td>
                </tr>
              ));
            case "table":
              return (
                <tr key={row.key}>
                  <th>{row.key}</th>
                  <td colSpan={2} className="nested-cell">
                    <ObjectArrayTable rows={row.rows} />
                  </td>
                </tr>
              );
            case "raw":
              return (
                <tr key={row.key}>
                  <th>{row.key}</th>
                  <td colSpan={2} className="nested-cell">
                    <CellContent value={row.value} />
                  </td>
                </tr>
              );
          }
        })}
      </tbody>
    </table>
  );
}

export function DataDashboardPage() {
  const [dirState, setDirState] = useState<RestoreResult | "loading">("loading");
  const [data, setData] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setData(await readJsonFromLocal("data.local.json"));
    setLoaded(true);
  };

  useEffect(() => {
    if (!isFsSupported()) {
      setDirState("none");
      return;
    }
    void (async () => {
      const state = await restoreDirectory();
      setDirState(state);
      if (state === "granted") await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGrant = async () => {
    if (await requestStoredPermission()) {
      setDirState("granted");
      await load();
    }
  };

  return (
    <div className="data-dashboard-page">
      <h2>数据看板</h2>
      {dirState === "loading" && <p className="muted">加载中…</p>}
      {dirState === "none" && (
        <p className="muted">
          {isFsSupported()
            ? "尚未授权本地文件夹，请先到 Grid Demo 页面授权。"
            : "当前浏览器不支持 File System Access API（需 Chromium 系浏览器）。"}
        </p>
      )}
      {dirState === "prompt" && (
        <button onClick={handleGrant}>授权读取本地文件夹</button>
      )}
      {dirState === "denied" && (
        <p className="muted">本地文件夹权限被拒绝，请在浏览器设置中恢复权限。</p>
      )}
      {dirState === "granted" && loaded && (
        <>
          <div className="data-source">
            数据源：deep-assess/tenant/group_report_document/data.local.json
            <button onClick={() => void load()}>刷新</button>
          </div>
          {data == null ? (
            <p className="muted">data.local.json 不存在或内容为空 / 非法 JSON。</p>
          ) : typeof data === "object" && !Array.isArray(data) ? (
            Object.entries(data as Record<string, unknown>).map(([k, v]) => (
              <section key={k} className="data-section">
                <h2 className="section-title">{k}</h2>
                <SectionTable value={v} />
              </section>
            ))
          ) : (
            <SectionTable value={data} />
          )}
        </>
      )}
    </div>
  );
}
