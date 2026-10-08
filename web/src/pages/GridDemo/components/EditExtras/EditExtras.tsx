// 编辑态的 content.script / content.style 注入：渲染在 card-body 内部末尾
// style 直接 <style> 生效；script 以 root=card-body（[data-id] 节点）、data=data.json 内容执行
// LLM 生成的代码不允许拖垮编辑器，异常只记 console
import { useEffect, useRef } from "react";
import type { Content } from "../../types";

export function EditExtras({
  content,
  data,
}: {
  content: Content;
  data: unknown;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const script = content.script;
  useEffect(() => {
    if (!script) return;
    const root = anchorRef.current?.closest("[data-id]");
    if (!root) return;
    try {
      new Function("root", "data", script)(root, data);
    } catch (err) {
      console.error(`[content.script] ${content.name} 执行失败`, err);
    }
  }, [script, data, content.name]);
  return (
    <>
      {content.style && <style>{content.style}</style>}
      {script && <span ref={anchorRef} hidden />}
    </>
  );
}
