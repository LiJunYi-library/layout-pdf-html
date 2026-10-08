// 本地文件系统访问（File System Access API，仅 Chromium 系）
// 授权根目录后，所有读写都落在固定子路径 deep-assess/tenant/group_report_document 下

const SUB_PATH = ["deep-assess", "tenant", "group_report_document"] as const;

// lib.dom 里 showDirectoryPicker 是 0 参签名，实际浏览器支持传 options
const showPicker = window.showDirectoryPicker as unknown as
  | ((options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>)
  | undefined;

let rootHandle: FileSystemDirectoryHandle | null = null;

// ---- IndexedDB 持久化目录 handle（刷新页面后可恢复） ----

const DB_NAME = "grid-demo-fs";
const STORE = "handles";
const HANDLE_KEY = "rootDir";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(HANDLE_KEY);
    req.onsuccess = () =>
      resolve((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror = () => reject(req.error);
  });
}

// queryPermission/requestPermission 在 lib.dom 的 FileSystemHandle 上可能缺类型
type FsPermission = "granted" | "denied" | "prompt";
function queryPermission(h: FileSystemDirectoryHandle): Promise<FsPermission> {
  return (
    h as unknown as {
      queryPermission(o: { mode: string }): Promise<FsPermission>;
    }
  ).queryPermission({ mode: "readwrite" });
}
function requestPermission(h: FileSystemDirectoryHandle): Promise<FsPermission> {
  return (
    h as unknown as {
      requestPermission(o: { mode: string }): Promise<FsPermission>;
    }
  ).requestPermission({ mode: "readwrite" });
}

export function isFsSupported(): boolean {
  return typeof showPicker === "function";
}

export function hasDirectory(): boolean {
  return rootHandle != null;
}

// 必须由用户手势触发（点击按钮）；选完即持久化到 IndexedDB
export async function pickRootDirectory(): Promise<void> {
  if (!showPicker) throw new Error("当前浏览器不支持 File System Access API");
  rootHandle = await showPicker({ mode: "readwrite" });
  await idbPutHandle(rootHandle);
}

// 页面加载时尝试恢复：已授权则直接可用；prompt 状态需要用户点击触发 requestStoredPermission
export type RestoreResult = "granted" | "prompt" | "denied" | "none";
export async function restoreDirectory(): Promise<RestoreResult> {
  const handle = await idbGetHandle();
  if (!handle) return "none";
  const state = await queryPermission(handle);
  if (state === "granted") rootHandle = handle;
  return state;
}

// 对持久化的 handle 重新请求权限（必须用户手势触发）
export async function requestStoredPermission(): Promise<boolean> {
  const handle = await idbGetHandle();
  if (!handle) return false;
  const state = await requestPermission(handle);
  if (state === "granted") {
    rootHandle = handle;
    return true;
  }
  return false;
}

async function targetDir(): Promise<FileSystemDirectoryHandle | null> {
  if (!rootHandle) return null;
  let dir = rootHandle;
  for (const seg of SUB_PATH) {
    dir = await dir.getDirectoryHandle(seg, { create: true });
  }
  return dir;
}

// 解析 "assets/xx.png" 这类相对路径：逐级进入子目录，返回 (目录, 文件名)
async function resolvePath(
  path: string,
  create: boolean,
): Promise<{ dir: FileSystemDirectoryHandle; name: string } | null> {
  const segs = path.split("/").filter(Boolean);
  const name = segs.pop();
  if (!name) return null;
  let dir = await targetDir();
  if (!dir) return null;
  try {
    for (const seg of segs) {
      dir = await dir.getDirectoryHandle(seg, { create });
    }
    return { dir, name };
  } catch {
    return null;
  }
}

export async function writeJsonToLocal(
  name: string,
  value: unknown,
): Promise<boolean> {
  return writeTextToLocal(name, JSON.stringify(value, null, 2));
}

export async function writeTextToLocal(
  name: string,
  text: string,
): Promise<boolean> {
  return writeFileToLocal(name, text);
}

// 写入文本或二进制（图片等），path 支持 "assets/xx.png" 子路径
export async function writeFileToLocal(
  path: string,
  data: string | Blob,
): Promise<boolean> {
  const resolved = await resolvePath(path, true);
  if (!resolved) return false;
  const fh = await resolved.dir.getFileHandle(resolved.name, { create: true });
  const writable = await fh.createWritable();
  await writable.write(data);
  await writable.close();
  return true;
}

export async function readJsonFromLocal<T>(name: string): Promise<T | null> {
  const file = await readFileFromLocal(name);
  if (!file) return null;
  try {
    return JSON.parse(await file.text()) as T;
  } catch {
    return null; // JSON 非法
  }
}

// 读取文件，path 支持子路径；不存在返回 null
export async function readFileFromLocal(path: string): Promise<File | null> {
  const resolved = await resolvePath(path, false);
  if (!resolved) return null;
  try {
    const fh = await resolved.dir.getFileHandle(resolved.name);
    return await fh.getFile();
  } catch {
    return null;
  }
}

// 读取本地文件并转成 blob URL（编辑器里显示本地图片用），带缓存
const urlCache = new Map<string, string>();
export async function localFileUrl(path: string): Promise<string | null> {
  const cached = urlCache.get(path);
  if (cached) return cached;
  const file = await readFileFromLocal(path);
  if (!file) return null;
  const url = URL.createObjectURL(file);
  urlCache.set(path, url);
  return url;
}
