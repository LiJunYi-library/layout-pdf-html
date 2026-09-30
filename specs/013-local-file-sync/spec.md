# 013 编辑器本地文件同步（File System Access API）

## 背景与目标

编辑器数据目前只存服务端（fake-oss editor.json）+ localStorage 缓存。用户担心：没保存、电脑断电时编辑内容丢失。目标工作流：

- **编辑即落本地文件**：关联一个本地文件后，编辑内容自动（防抖）写入该文件，断电/崩溃不丢
- **手动上传才同步服务端**：点「上传」才把内容推送到服务端 fake-oss（/api/render 渲染依赖服务端模板，主链路不变）
- **刷新/重启浏览器可恢复**：文件句柄存 IndexedDB，重新授权后继续编辑

技术基础：File System Access API（showSaveFilePicker / showOpenFilePicker / createWritable，全异步 Promise；仅 Chrome/Edge，Safari/Firefox 降级为上传下载；选择器需用户手势触发；权限可按会话记忆）。

## 现状

先做**可行性验证 spike**：`/file-test` 测试页，验证读写、自动保存防抖、句柄持久化恢复、重新授权流程。验证通过后再规划编辑器接入（编辑器「保存」按钮拆为 本地自动 + 上传服务端 两层）。

## 变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-09-21 | 初版（spike）：`/file-test` 测试页 + 导航「文件测试」——新建/打开本地 JSON 文件、textarea 编辑 1s 防抖自动写入、手动保存、断开关联、操作日志；句柄存 IndexedDB（`file-test/kv`），刷新后自动恢复并提示重新授权；不支持 API 的浏览器显示提示 | 用户要求先做个测试页验证 File System Access API |
| 2026-09-21 | 默认文件夹：「选择默认文件夹…」（showDirectoryPicker，句柄持久化到 IndexedDB）后，「保存到 文件夹名/」直接 `getFileHandle(name, {create:true})` 写入不再弹选择器；另存为/打开的 startIn 用该文件夹句柄。限制记录：startIn 只接受预置名（desktop/downloads…）或句柄，不能硬编码绝对路径；句柄只暴露文件夹名拿不到完整路径，页面显示文件夹名 | 用户需求：默认保存到 /deep-assess-tenant/ 并显示保存文件夹 |
| 2026-09-21 | 授权前置说明弹窗：系统授权弹窗不可自定义（浏览器安全设计，防钓鱼），采用业界标准做法——触发选择器前先弹自建说明层（用途、操作步骤、提醒选「每次访问都允许」），确认后再调 showDirectoryPicker | 用户需求：告诉用户授权用途 |
| 2026-09-21 | 子目录保存：默认文件夹下支持子目录输入（按 / 分层逐层 getDirectoryHandle(create)，不存在自动创建），按钮实时显示完整相对路径（文件夹名/子目录/），默认 root | 用户需求：保存到 /deep-assess-tenant/root/ 下 |
