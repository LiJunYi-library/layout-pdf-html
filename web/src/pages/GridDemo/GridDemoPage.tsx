// React-Grid-Layout 试验页（/grid-demo）：多页面 + 组件拖入 + 选中配置 + 导出静态 HTML
// 表格采用 A/B 双组件：编辑用 TableCardEdit（列宽可拖拽），导出用 TableCard（只读列宽数据）
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { v7 as uuidV7 } from "uuid";
import type { Content, PageData } from "./types";
import { paletteDefs, paletteTree, type PaletteDef } from "./palette";
import { saveHtml, PAGE_WIDTH_FALLBACK } from "./saveHtml";
import { PageEditor } from "./PageEditor";
import {
  isFsSupported,
  pickRootDirectory,
  readJsonFromLocal,
  restoreDirectory,
  requestStoredPermission,
  localFileUrl,
  writeFileToLocal,
  writeJsonToLocal,
  writeTextToLocal,
  type RestoreResult,
} from "./localFs";
import { cardCss } from "./cardCss";
import "./GridDemoPage.scss";
import { TableCardConfig } from "./components/TableCard/TableCard.config";
import { BaseCardConfig } from "./components/BaseCard/BaseCard.config";

// 初始配置：本地没有 pages.json 时的兜底，只有一个空白页面
function makeBlankPage(): PageData {
  return { id: uuidV7(), layout: [], contents: {} };
}

// 校验本地 pages.json 的结构是否合法
function isValidPages(data: unknown): data is PageData[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every(
      (p) =>
        p != null &&
        typeof p.id === "string" &&
        Array.isArray(p.layout) &&
        p.contents != null &&
        typeof p.contents === "object",
    )
  );
}

export function GridDemoPage() {
  const [pages, setPages] = useState<PageData[]>(() => [makeBlankPage()]);
  const [selected, setSelected] = useState<{
    pageId: string;
    itemId: string;
  } | null>(null);
  // 当前页：组件栏点击添加、导出兜底等行为都落在它身上
  const [activePageId, setActivePageId] = useState(pages[0].id);
  // 组件栏正在拖出的组件类型（dragover 阶段读不到 dataTransfer，用它传递）
  const [draggingType, setDraggingType] = useState<string | null>(null);
  // 页面排序拖拽中的页面 id
  const [draggingPageId, setDraggingPageId] = useState<string | null>(null);
  // 各页面测得的实际像素宽度，导出 HTML 用
  const pageWidths = useRef<Record<string, number>>({});
  // 本地文件夹授权状态（none 未授权 / prompt 待确认 / granted 已授权）+ data.json（编辑器用数据）
  const [dirState, setDirState] = useState<RestoreResult>("none");
  const [dataJson, setDataJson] = useState<unknown>(null);
  const dirReady = dirState === "granted";
  // 本地图片路径 → blob URL（编辑器显示背景图用）
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // 授权后：把 pages 里引用的背景图解析成 blob URL
  useEffect(() => {
    if (!dirReady) return;
    for (const page of pages) {
      const path = page.config?.backgroundImage;
      if (path && !imageUrls[path]) {
        void localFileUrl(path).then((url) => {
          if (url) setImageUrls((prev) => ({ ...prev, [path]: url }));
        });
      }
    }
  }, [pages, dirReady, imageUrls]);

  // 授权成功后加载本地配置：优先 pages.json（没有则保持空白页），再读 data.json
  const loadLocalConfig = async () => {
    const saved = await readJsonFromLocal<unknown>("pages.json");
    if (isValidPages(saved)) {
      setPages(saved);
      setActivePageId(saved[0].id);
      setSelected(null);
    }
    setDataJson(await readJsonFromLocal("data.json"));
  };

  // 页面加载：从 IndexedDB 恢复目录 handle；已授权则加载本地配置
  // 注意顺序：先 loadLocalConfig 再置 granted，避免自动保存把空白页覆盖写回 pages.json
  useEffect(() => {
    if (!isFsSupported()) return;
    void (async () => {
      const state = await restoreDirectory();
      if (state === "granted") await loadLocalConfig();
      setDirState(state);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 授权后：pages 每次变更实时写入 pages.json + 自动保存导出 HTML（500ms 防抖）
  useEffect(() => {
    if (!dirReady) return;
    const timer = setTimeout(() => {
      void (async () => {
        await writeJsonToLocal("pages.json", pages);
        const dataLocal = await readJsonFromLocal("data.local.json");
        const html = saveHtml(
          pages,
          (pageId) => pageWidths.current[pageId] ?? PAGE_WIDTH_FALLBACK,
          dataLocal,
        );
        await writeTextToLocal("grid-layout.html", html);
      })();
    }, 500);
    return () => clearTimeout(timer);
  }, [pages, dirReady]);

  const handlePickDirectory = async () => {
    if (dirState === "prompt") {
      // handle 已在 IndexedDB，只需重新确认权限
      if (await requestStoredPermission()) {
        await loadLocalConfig();
        setDirState("granted");
      }
      return;
    }
    await pickRootDirectory();
    await loadLocalConfig();
    setDirState("granted");
  };

  const updatePage = (pageId: string, updater: (p: PageData) => PageData) =>
    setPages((prev) => prev.map((p) => (p.id === pageId ? updater(p) : p)));

  // 上传页面背景图：写入授权文件夹 assets/ 子目录，配置里只存相对路径
  const handleUploadBgImage = async (pageId: string, file: File) => {
    const path = `assets/${uuidV7()}-${file.name}`;
    await writeFileToLocal(path, file);
    updatePage(pageId, (p) => ({
      ...p,
      config: { ...p.config, backgroundImage: path },
    }));
    setImageUrls((prev) => ({ ...prev, [path]: URL.createObjectURL(file) }));
  };

  const addComponent = (
    def: PaletteDef,
    pageId: string,
    position?: { x: number; y: number },
  ) => {
    const id = uuidV7();
    updatePage(pageId, (p) => ({
      ...p,
      layout: [
        ...p.layout,
        {
          i: id,
          x: position?.x ?? 0,
          y: position?.y ?? Infinity,
          ...def.layout,
        },
      ],
      contents: { ...p.contents, [id]: structuredClone(def.content) },
    }));
    setSelected({ pageId, itemId: id });
    setActivePageId(pageId);
  };

  const removeItem = (pageId: string, itemId: string) => {
    updatePage(pageId, (p) => {
      const contents = { ...p.contents };
      delete contents[itemId];
      return {
        ...p,
        layout: p.layout.filter((item) => item.i !== itemId),
        contents,
      };
    });
    if (selected?.itemId === itemId) setSelected(null);
  };

  const addPage = () => {
    const page: PageData = { id: uuidV7(), layout: [], contents: {} };
    setPages((prev) => [...prev, page]);
    setActivePageId(page.id);
  };

  const removePage = (pageId: string) => {
    setPages((prev) => {
      if (prev.length <= 1) return prev; // 保底一页
      const next = prev.filter((p) => p.id !== pageId);
      if (activePageId === pageId) setActivePageId(next[0].id);
      if (selected?.pageId === pageId) setSelected(null);
      return next;
    });
  };

  // 把页面移动到目标下标（拖拽排序用）
  const movePage = (pageId: string, toIndex: number) => {
    setPages((prev) => {
      const from = prev.findIndex((p) => p.id === pageId);
      if (from < 0 || from === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const selectedPage = pages.find((p) => p.id === selected?.pageId);
  const selectedContent = selected
    ? selectedPage?.contents[selected.itemId]
    : undefined;

  return (
    <div>
      <div className="grid-demo-page">
        <style>{cardCss}</style>
        <header className="grid-demo-page-header">
          <Link to="/data-dashboard">
            <button>查看数据</button>
          </Link>
          {isFsSupported() && (
            <button onClick={handlePickDirectory} disabled={dirReady}>
              {dirReady
                ? "已授权本地文件夹"
                : dirState === "prompt"
                  ? "恢复本地文件夹授权"
                  : "选择本地文件夹"}
            </button>
          )}
          <span style={{ marginLeft: 8, color: "#888", fontSize: 12 }}>
            {dirReady
              ? `pages.json 与 grid-layout.html 实时保存中；data.json ${dataJson != null ? "已读取" : "不存在"}`
              : "授权文件夹后 pages.json / grid-layout.html 自动落盘"}
          </span>
        </header>
        <main className="grid-demo-page-main">
          <aside className="palette">
            <strong>组件</strong>
            {paletteTree.map(([category, defs]) => (
              <details key={category} open>
                <summary>{category}</summary>
                {defs.map((def) => (
                  <div
                    key={def.content.componentType}
                    className="palette-item"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "text/plain",
                        `component:${def.content.componentType}`,
                      );
                      e.dataTransfer.effectAllowed = "copy";
                      setDraggingType(def.content.componentType);
                    }}
                    onDragEnd={() => setDraggingType(null)}
                    onClick={() => addComponent(def, activePageId)}
                    title="拖入布局或点击添加到当前页"
                  >
                    {def.content.componentName}
                  </div>
                ))}
              </details>
            ))}
          </aside>
          <div className="main-content">
            <div className="edit-pages">
              {pages.map((page, idx) => (
                <div
                  key={page.id}
                  className={[
                    "page-thumb",
                    page.id === activePageId ? "active" : "",
                    page.id === draggingPageId ? "dragging" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", `page:${page.id}`);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingPageId(page.id);
                  }}
                  onDragEnd={() => setDraggingPageId(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggingPageId && draggingPageId !== page.id)
                      movePage(draggingPageId, idx);
                  }}
                  onClick={() => {
                    setActivePageId(page.id);
                    setSelected(null); // 显示页面配置
                  }}
                  title="拖拽排序，点击查看页面配置"
                >
                  {idx + 1}
                  {pages.length > 1 && (
                    <button
                      className="remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePage(page.id);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button className="add-page" onClick={addPage}>
                + 添加页面
              </button>
            </div>
            <div className="pages">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className={`page${page.id === activePageId ? " active" : ""}`}
                  style={{
                    backgroundColor: page.config?.backgroundColor,
                    backgroundImage:
                      page.config?.backgroundImage &&
                      imageUrls[page.config.backgroundImage]
                        ? `url('${imageUrls[page.config.backgroundImage]}')`
                        : undefined,
                    backgroundSize: "cover",
                  }}
                  onClick={() => {
                    setActivePageId(page.id);
                    setSelected(null); // 点页面空白处显示页面配置
                  }}
                >
                  <PageEditor
                    page={page}
                    selectedItemId={
                      selected?.pageId === page.id ? selected.itemId : null
                    }
                    draggingType={draggingType}
                    setDraggingType={setDraggingType}
                    onLayoutChange={(layout) =>
                      updatePage(page.id, (p) => ({
                        ...p,
                        layout: [...layout],
                      }))
                    }
                    onDropComponent={(type, position) => {
                      const def = paletteDefs.find(
                        (d) => d.content.componentType === type,
                      );
                      if (def) addComponent(def, page.id, position);
                    }}
                    onSelectItem={(itemId) =>
                      setSelected({ pageId: page.id, itemId })
                    }
                    onRemoveItem={(itemId) => removeItem(page.id, itemId)}
                    onContentChange={(itemId, next) =>
                      updatePage(page.id, (p) => ({
                        ...p,
                        contents: { ...p.contents, [itemId]: next },
                      }))
                    }
                    onWidthChange={(w) => {
                      pageWidths.current[page.id] = w;
                    }}
                    data={dataJson}
                  />
                </div>
              ))}
            </div>
          </div>

          <aside className="config">
            {selectedContent && selected ? (
              <>
                <button className="close" onClick={() => setSelected(null)}>
                  ×
                </button>
                {(() => {
                  const updateSelected = (updater: (c: Content) => Content) =>
                    updatePage(selected.pageId, (p) => ({
                      ...p,
                      contents: {
                        ...p.contents,
                        [selected.itemId]: updater(p.contents[selected.itemId]),
                      },
                    }));
                  return (
                    <BaseCardConfig
                      componentName={selectedContent.componentName}
                      id={selected.itemId}
                      name={selectedContent.name}
                      onNameChange={(name) =>
                        updateSelected((c) => ({ ...c, name }))
                      }
                    >
                      {selectedContent.componentType === "table" ? (
                        <TableCardConfig
                          content={selectedContent}
                          onChange={(next) => updateSelected(() => next)}
                        />
                      ) : (
                        <p style={{ color: "#888" }}>
                          该组件（{selectedContent.componentType}
                          ）暂无专属配置项。
                        </p>
                      )}
                    </BaseCardConfig>
                  );
                })()}
              </>
            ) : (
              // 未选中组件时：显示当前页的页面配置
              (() => {
                const page = pages.find((p) => p.id === activePageId);
                if (!page) return null;
                return (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 12 }}
                  >
                    <strong>页面配置 — 第 {pages.findIndex((p) => p.id === page.id) + 1} 页</strong>
                    <div
                      style={{ fontSize: 12, color: "#888", wordBreak: "break-all" }}
                    >
                      id: {page.id}
                    </div>
                    <label
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      背景颜色:
                      <input
                        type="color"
                        value={page.config?.backgroundColor ?? "#ffffff"}
                        onChange={(e) =>
                          updatePage(page.id, (p) => ({
                            ...p,
                            config: {
                              ...p.config,
                              backgroundColor: e.target.value,
                            },
                          }))
                        }
                      />
                      {page.config?.backgroundColor && (
                        <button
                          onClick={() =>
                            updatePage(page.id, (p) => ({
                              ...p,
                              config: {
                                ...p.config,
                                backgroundColor: undefined,
                              },
                            }))
                          }
                        >
                          清除
                        </button>
                      )}
                    </label>
                    <div>
                      <div style={{ marginBottom: 4 }}>背景图片:</div>
                      {page.config?.backgroundImage ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          {imageUrls[page.config.backgroundImage] && (
                            <img
                              src={imageUrls[page.config.backgroundImage]}
                              alt="背景图预览"
                              style={{ maxWidth: "100%", borderRadius: 4 }}
                            />
                          )}
                          <div
                            style={{
                              fontSize: 12,
                              color: "#888",
                              wordBreak: "break-all",
                            }}
                          >
                            {page.config.backgroundImage}
                          </div>
                          <button
                            onClick={() =>
                              updatePage(page.id, (p) => ({
                                ...p,
                                config: {
                                  ...p.config,
                                  backgroundImage: undefined,
                                },
                              }))
                            }
                          >
                            移除背景图
                          </button>
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept="image/*"
                          disabled={!dirReady}
                          title={dirReady ? "上传到本地文件夹 assets/" : "需先授权本地文件夹"}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleUploadBgImage(page.id, file);
                            e.target.value = "";
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </aside>
        </main>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>pages（页面数据）</h3>
          <pre
            style={{
              background: "#f0f0f0",
              padding: 12,
              borderRadius: 8,
              overflow: "auto",
            }}
          >
            {JSON.stringify(pages, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
