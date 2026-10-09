// 通用数组编辑器：每项一行（拖拽手柄 + 输入框 + 删除），底部添加按钮
// 排序用原生 HTML5 拖拽，按住手柄才触发（避免和输入框划词冲突）
// onMove / onRemove / onAdd 可由调用方接管结构变更（用于联动其他数据）
import { useState } from "react";

export function ListEditor({
  items,
  onChange,
  inputType = "text",
  addLabel = "添加",
  onMove,
  onRemove,
  onAdd,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  /** text 编辑字符串数组；number 编辑数值数组（值用 string 承载，由调用方转换） */
  inputType?: "text" | "number";
  addLabel?: string;
  onMove?: (from: number, to: number) => void;
  onRemove?: (index: number) => void;
  onAdd?: () => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [armed, setArmed] = useState(false);

  const move = (from: number, to: number) => {
    if (from === to) return;
    if (onMove) {
      onMove(from, to);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const remove = (i: number) =>
    onRemove ? onRemove(i) : onChange(items.filter((_, j) => j !== i));

  const add = () =>
    onAdd
      ? onAdd()
      : onChange([...items, inputType === "number" ? "0" : ""]);

  return (
    <div>
      {items.map((item, i) => (
        <div
          key={i}
          draggable={armed}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            setDragIndex(i);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setArmed(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragIndex != null && dragIndex !== i) {
              move(dragIndex, i);
              setDragIndex(i);
            }
          }}
          style={{
            display: "flex",
            gap: 4,
            marginTop: 4,
            alignItems: "center",
            opacity: dragIndex === i ? 0.4 : 1,
          }}
        >
          <span
            style={{ cursor: "grab", color: "#aaa", userSelect: "none" }}
            title="按住拖拽排序"
            onMouseDown={() => setArmed(true)}
            onMouseUp={() => setArmed(false)}
          >
            ⠿
          </span>
          <input
            style={{ flex: 1, minWidth: 0 }}
            type={inputType}
            value={item}
            onChange={(e) =>
              onChange(items.map((v, j) => (j === i ? e.target.value : v)))
            }
          />
          <button onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button style={{ marginTop: 4 }} onClick={add}>
        {addLabel}
      </button>
    </div>
  );
}
