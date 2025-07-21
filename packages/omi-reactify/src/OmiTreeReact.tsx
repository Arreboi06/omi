import React, {
  useReducer,
  useState,
  ReactNode,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";

export type TreeNode = {
  key: string;
  label: string;
  desc?: string;
  group?: boolean;
  children: TreeNode[];
};

export type TreeState = {
  past: TreeNode[][];
  present: TreeNode[];
  future: TreeNode[][];
};

export type OmiTreeReactProps = {
  data: TreeNode[];
  onChange?: (data: TreeNode[]) => void;
  onStateChange?: (state: TreeState) => void;
  renderNode?: (node: TreeNode, defaultNode: ReactNode) => ReactNode;
  renderPanel?: (
    selectedNodes: TreeNode[],
    defaultPanel: ReactNode
  ) => ReactNode;
  onNodeAdd?: (parentKey: string | null, newNode: TreeNode) => void;
  onNodeDelete?: (key: string) => void;
  onNodeMove?: (
    fromKeys: string[],
    toKey: string | null,
    position: DropPosition
  ) => void;
  onNodeChange?: (key: string, newNode: TreeNode) => void;
};

export type TreeAction =
  | { type: "SET"; data: TreeNode[] }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "ADD"; parentKey: string | null }
  | { type: "DELETE"; key: string }
  | { type: "DELETE_BATCH"; keys: string[] }
  | { type: "GROUP"; nodeKeys: string[] };

const MAX_HISTORY = 50;

function deleteNode(nodes: TreeNode[], key: string): TreeNode[] {
  return nodes
    .filter((node) => node.key !== key)
    .map((node) => ({ ...node, children: deleteNode(node.children, key) }));
}

function deleteNodesBatch(nodes: TreeNode[], keys: string[]): TreeNode[] {
  return nodes
    .filter((node) => !keys.includes(node.key))
    .map((node) => ({
      ...node,
      children: deleteNodesBatch(node.children, keys),
    }));
}

function treeReducer(state: TreeState, action: TreeAction): TreeState {
  let { past, present, future } = state;
  switch (action.type) {
    case "SET": {
      const newPast = [...past, present].slice(-MAX_HISTORY);
      return { past: newPast, present: action.data, future: [] };
    }
    case "UNDO": {
      if (past.length === 0) return state;
      const prev = past[past.length - 1];
      const newPast = past.slice(0, -1);
      return {
        past: newPast,
        present: prev,
        future: [present, ...future].slice(0, MAX_HISTORY),
      };
    }
    case "REDO": {
      if (future.length === 0) return state;
      const next = future[0];
      const newFuture = future.slice(1);
      return {
        past: [...past, present].slice(-MAX_HISTORY),
        present: next,
        future: newFuture,
      };
    }
    case "ADD": {
      const newNode: TreeNode = {
        key: Date.now().toString() + Math.random().toString(36).slice(2),
        label: "新节点",
        desc: "",
        children: [],
      };
      let newTree: TreeNode[];
      if (!action.parentKey) {
        newTree = [...present, newNode];
      } else {
        newTree = updateNode(present, action.parentKey, (node) => ({
          ...node,
          children: [...node.children, newNode],
        }));
      }
      return {
        past: [...past, present].slice(-MAX_HISTORY),
        present: newTree,
        future: [],
      };
    }
    case "DELETE": {
      const newTree = deleteNode(present, action.key);
      return {
        past: [...past, present].slice(-MAX_HISTORY),
        present: newTree,
        future: [],
      };
    }
    case "DELETE_BATCH": {
      const newTree = deleteNodesBatch(present, action.keys);
      return {
        past: [...past, present].slice(-MAX_HISTORY),
        present: newTree,
        future: [],
      };
    }
    case "GROUP": {
      const groupKey =
        Date.now().toString() + Math.random().toString(36).slice(2);
      const groupNode: TreeNode = {
        key: groupKey,
        label: "新分组",
        desc: "",
        group: true,
        children: [],
      };
      let newTree = present.filter((n) => !action.nodeKeys.includes(n.key));
      groupNode.children = present.filter((n) =>
        action.nodeKeys.includes(n.key)
      );
      newTree.push(groupNode);
      return {
        past: [...past, present].slice(-MAX_HISTORY),
        present: newTree,
        future: [],
      };
    }
    default:
      return state;
  }
}

function updateNode(
  nodes: TreeNode[],
  key: string,
  updater: (node: TreeNode) => TreeNode
): TreeNode[] {
  return nodes.map((node) => {
    if (node.key === key) {
      return updater(node);
    }
    if (node.children && node.children.length > 0) {
      return { ...node, children: updateNode(node.children, key, updater) };
    }
    return node;
  });
}

// 新增：插入类型
type DropPosition = "before" | "after" | "child";

function moveNodesNested(
  nodes: TreeNode[],
  fromKeys: string[],
  toKey: string | null,
  position: DropPosition = "child"
): TreeNode[] {
  let moving: TreeNode[] = [];
  function collect(nodes: TreeNode[]): TreeNode[] {
    return nodes.reduce<TreeNode[]>((acc, n) => {
      if (fromKeys.includes(n.key)) {
        moving.push(n);
        return acc;
      }
      return [...acc, { ...n, children: collect(n.children) }];
    }, []);
  }
  let rest = collect(nodes);
  if (!toKey) {
    // 根节点插入
    if (position === "before") {
      return [...moving, ...rest];
    } else if (position === "after") {
      return [...rest, ...moving];
    } else {
      return [...rest, ...moving];
    }
  }
  function insert(nodes: TreeNode[]): TreeNode[] {
    let res: TreeNode[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.key === toKey) {
        if (position === "before") {
          res = [...res, ...moving, n];
        } else if (position === "after") {
          res = [...res, n, ...moving];
        } else if (position === "child") {
          res = [
            ...res,
            {
              ...n,
              children: [...n.children, ...moving],
            },
          ];
        }
      } else {
        res.push({ ...n, children: insert(n.children) });
      }
    }
    return res;
  }
  return insert(rest);
}

function TreeNodePropPanel({
  node,
  onChange,
  selected,
  onSelect,
  multiEdit,
  multiEditValues,
  onMultiEdit,
}: {
  node: TreeNode;
  onChange: (key: string, newNode: TreeNode) => void;
  selected: boolean;
  onSelect: (e: React.MouseEvent, key: string) => void;
  multiEdit?: boolean;
  multiEditValues?: Partial<TreeNode>;
  onMultiEdit?: (values: Partial<TreeNode>) => void;
}): JSX.Element {
  const [editLabel, setEditLabel] = useState(
    multiEdit ? multiEditValues?.label || "" : node.label
  );
  const [editDesc, setEditDesc] = useState(
    multiEdit ? multiEditValues?.desc || "" : node.desc || ""
  );
  const [editing, setEditing] = useState<"label" | "desc" | null>(null);
  useEffect(() => {
    setEditLabel(multiEdit ? multiEditValues?.label || "" : node.label);
    setEditDesc(multiEdit ? multiEditValues?.desc || "" : node.desc || "");
  }, [node.label, node.desc, multiEdit, multiEditValues]);
  // 实时同步：输入时立即同步到树节点
  const handleLabelChange = (val: string) => {
    setEditLabel(val);
    if (multiEdit && onMultiEdit) {
      onMultiEdit({ label: val, desc: editDesc });
    } else {
      onChange(node.key, { ...node, label: val, desc: editDesc });
    }
  };
  const handleDescChange = (val: string) => {
    setEditDesc(val);
    if (multiEdit && onMultiEdit) {
      onMultiEdit({ label: editLabel, desc: val });
    } else {
      onChange(node.key, { ...node, label: editLabel, desc: val });
    }
  };
  const save = () => {
    setEditing(null);
  };
  return (
    <div
      style={{
        marginBottom: 8,
        display: "flex",
        gap: 8,
        alignItems: "center",
        background: selected ? "#e6f7ff" : undefined,
        padding: 4,
        borderRadius: 4,
        cursor: "pointer",
      }}
      onClick={(e) => onSelect(e, node.key)}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* 节点名称：双击可编辑 */}
      {editing === "label" ? (
        <input
          value={editLabel}
          autoFocus
          onChange={(e) => handleLabelChange(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder={multiEdit ? "批量修改名称" : "节点名称"}
          style={{
            width: 100,
            padding: 4,
            border: "1px solid #d9d9d9",
            borderRadius: 4,
          }}
          onClick={(e) => e.stopPropagation()}
          onDragOver={(e) => e.preventDefault()}
        />
      ) : (
        <span
          style={{ minWidth: 100, padding: 4, borderRadius: 4, cursor: "text" }}
          title="双击编辑名称"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing("label");
          }}
        >
          {editLabel || <span style={{ color: "#ccc" }}>节点名称</span>}
        </span>
      )}
      {/* 节点描述：双击可编辑 */}
      {editing === "desc" ? (
        <input
          value={editDesc}
          autoFocus
          onChange={(e) => handleDescChange(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder={multiEdit ? "批量修改描述" : "描述（可选）"}
          style={{
            width: 120,
            padding: 4,
            border: "1px solid #d9d9d9",
            borderRadius: 4,
          }}
          onClick={(e) => e.stopPropagation()}
          onDragOver={(e) => e.preventDefault()}
        />
      ) : (
        <span
          style={{
            minWidth: 120,
            padding: 4,
            borderRadius: 4,
            cursor: "text",
            color: "#888",
          }}
          title="双击编辑描述"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing("desc");
          }}
        >
          {editDesc || <span style={{ color: "#ccc" }}>描述（可选）</span>}
        </span>
      )}
      {node.group && (
        <span style={{ color: "#1890ff", marginLeft: 8 }}>分组</span>
      )}
    </div>
  );
}

function renderTree(
  nodes: TreeNode[],
  path: number[],
  treeData: TreeNode[],
  expandedKeys: string[],
  setExpandedKeys: React.Dispatch<React.SetStateAction<string[]>>,
  isDescendant: (
    nodes: TreeNode[],
    parentKey: string,
    childKey: string
  ) => boolean,
  onNodeChange: (key: string, newNode: TreeNode) => void,
  onNodeMove: (
    fromKeys: string[],
    toKey: string | null,
    position: DropPosition
  ) => void,
  onNodeAdd: (parentKey: string | null) => void,
  onNodeDelete: (key: string) => void,
  selectedKeys: string[],
  onSelect: (e: React.MouseEvent, key: string) => void,
  renderNode?: (node: TreeNode, defaultNode: ReactNode) => ReactNode
): ReactNode[] {
  return nodes.map((node, idx) => {
    const selected = selectedKeys.includes(node.key);
    const isExpanded = expandedKeys.includes(node.key);
    // 三个 drop 区域：上方、内容区、下方
    const dropZone = (pos: DropPosition) => (
      <div
        style={{ height: 8, background: "transparent", cursor: "pointer" }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const fromKey = e.dataTransfer.getData("text/plain");
          if (fromKey && fromKey !== node.key) {
            onNodeMove([fromKey], node.key, pos);
          }
        }}
      />
    );
    const nodeRow = (
      <div
        key={node.key}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", node.key);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={(e) => onSelect(e, node.key)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const fromKey = e.dataTransfer.getData("text/plain");
          if (
            fromKey &&
            fromKey !== node.key &&
            !isDescendant(treeData, fromKey, node.key)
          ) {
            onNodeMove([fromKey], node.key, "child");
          }
        }}
        style={{
          border: selected ? "2px solid #1890ff" : "1px solid #eee",
          margin: 4,
          padding: "14px 8px",
          fontSize: 16,
          minHeight: 44,
          lineHeight: "24px",
          borderRadius: 6,
          background: selected ? "#e6f7ff" : "#fff",
          display: "flex",
          alignItems: "center",
          boxShadow: selected ? "0 0 0 2px #91d5ff" : undefined,
          cursor: "grab",
          transition: "background 0.2s, box-shadow 0.2s",
          userSelect: "none",
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLElement).style.cursor = "grabbing";
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLElement).style.cursor = "grab";
        }}
      >
        {/* 展开/折叠箭头 */}
        {node.children && node.children.length > 0 && (
          <span
            style={{ cursor: "pointer", marginRight: 4 }}
            onClick={(e) => {
              e.stopPropagation();
              if (isExpanded) {
                setExpandedKeys(expandedKeys.filter((k) => k !== node.key));
              } else {
                setExpandedKeys([...expandedKeys, node.key]);
              }
            }}
          >
            {isExpanded ? "▼" : "▶"}
          </span>
        )}
        <span
          style={{
            marginRight: 8,
            color: selected ? "#1890ff" : "#888",
            fontSize: "16px",
            userSelect: "none",
            pointerEvents: "none",
          }}
          title="拖拽手柄"
        >
          ⋮⋮
        </span>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <TreeNodePropPanel
            node={node}
            onChange={onNodeChange}
            selected={selected}
            onSelect={onSelect}
          />
          <button
            style={{
              marginLeft: 8,
              padding: "4px 8px",
              border: "1px solid #d9d9d9",
              borderRadius: 4,
              background: "#fff",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onNodeAdd(node.key);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            添加子节点
          </button>
          <button
            style={{
              marginLeft: 4,
              padding: "4px 8px",
              border: "1px solid #d9d9d9",
              borderRadius: 4,
              background: "#fff",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onNodeDelete(node.key);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            删除
          </button>
        </div>
      </div>
    );
    // 只有展开时才渲染子节点
    const children = node.children &&
      node.children.length > 0 &&
      isExpanded && (
        <div
          style={{
            marginLeft: 16,
            marginTop: 8,
            width: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {renderTree(
            node.children,
            [...path, idx],
            treeData,
            expandedKeys,
            setExpandedKeys,
            isDescendant,
            onNodeChange,
            onNodeMove,
            onNodeAdd,
            onNodeDelete,
            selectedKeys,
            onSelect,
            renderNode
          )}
        </div>
      );
    return renderNode ? (
      renderNode(
        node,
        <React.Fragment key={node.key}>
          {dropZone("before")}
          {nodeRow}
          {dropZone("after")}
          {children}
        </React.Fragment>
      )
    ) : (
      <React.Fragment key={node.key}>
        {dropZone("before")}
        {nodeRow}
        {dropZone("after")}
        {children}
      </React.Fragment>
    );
  });
}

export default forwardRef<
  { dispatch: (action: TreeAction) => void },
  OmiTreeReactProps
>(function OmiTreeReact(props, ref) {
  const {
    data,
    onChange,
    onStateChange,
    renderNode,
    renderPanel,
    onNodeAdd,
    onNodeDelete,
    onNodeMove,
    onNodeChange,
  } = props;

  const [state, dispatch] = useReducer(treeReducer, {
    past: [],
    present: data,
    future: [],
  });

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const isControlled = typeof onChange === "function";
  const treeData = isControlled ? data : state.present;

  // 暴露 dispatch 方法给外部
  useImperativeHandle(
    ref,
    () => ({
      dispatch,
    }),
    [dispatch]
  );

  // 监听状态变化，通知外部
  useEffect(() => {
    if (onStateChange) {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const handleNodeChange = (key: string, newNode: TreeNode) => {
    if (onNodeChange) onNodeChange(key, newNode);
    const newTree = updateNode(treeData, key, () => newNode);
    if (isControlled && !!onChange) {
      onChange(newTree);
    } else {
      dispatch({ type: "SET", data: newTree });
    }
  };

  const handleNodeMove = (
    fromKeys: string[],
    toKey: string | null,
    position: DropPosition
  ) => {
    if (toKey && fromKeys.includes(toKey)) return;
    if (onNodeMove) onNodeMove(fromKeys, toKey, position);
    const newTree = moveNodesNested(treeData, fromKeys, toKey, position);
    if (isControlled && !!onChange) {
      onChange(newTree);
    } else {
      dispatch({ type: "SET", data: newTree });
    }
    setSelectedKeys(fromKeys);
  };

  const handleNodeAdd = (parentKey: string | null) => {
    const newNode: TreeNode = {
      key: Date.now().toString() + Math.random().toString(36).slice(2),
      label: "新节点",
      desc: "",
      children: [],
    };
    if (onNodeAdd) onNodeAdd(parentKey, newNode);
    if (isControlled && !!onChange) {
      let newTree: TreeNode[];
      if (!parentKey) {
        newTree = [...treeData, newNode];
      } else {
        newTree = updateNode(treeData, parentKey, (node) => ({
          ...node,
          children: [...node.children, newNode],
        }));
      }
      onChange(newTree);
    } else {
      dispatch({ type: "ADD", parentKey });
    }
  };

  const handleBatchDelete = () => {
    if (selectedKeys.length === 0) return;
    if (onNodeDelete) selectedKeys.forEach((k) => onNodeDelete(k));
    if (isControlled && !!onChange) {
      const newTree = deleteNodesBatch(treeData, selectedKeys);
      onChange(newTree);
    } else {
      dispatch({ type: "DELETE_BATCH", keys: selectedKeys });
    }
    setSelectedKeys([]);
  };

  const handleNodeDelete = (key: string) => {
    if (onNodeDelete) onNodeDelete(key);
    if (isControlled && !!onChange) {
      const newTree = deleteNode(treeData, key);
      onChange(newTree);
    } else {
      dispatch({ type: "DELETE", key });
    }
    setSelectedKeys((keys) => keys.filter((k) => k !== key));
  };

  const handleSelect = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelectedKeys((keys) =>
        keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
      );
    } else if (e.shiftKey && selectedKeys.length > 0) {
      const allKeys = treeData.map((n) => n.key);
      const last = allKeys.indexOf(selectedKeys[selectedKeys.length - 1]);
      const cur = allKeys.indexOf(key);
      if (last !== -1 && cur !== -1) {
        const [start, end] = [last, cur].sort((a, b) => a - b);
        setSelectedKeys(allKeys.slice(start, end + 1));
      }
    } else {
      setSelectedKeys([key]);
    }
  };

  const multiEdit = selectedKeys.length > 1;
  const selectedNodes = selectedKeys
    .map((k) => findNodeByKey(treeData, k))
    .filter(Boolean) as TreeNode[];
  const allGroups = selectedNodes.every((n) => n.group);
  const multiEditValues = multiEdit
    ? selectedNodes.reduce<Partial<TreeNode>>((acc, node) => {
        if (acc.label === undefined) acc.label = node.label;
        if (acc.desc === undefined) acc.desc = node.desc;
        if (acc.label !== node.label) acc.label = "";
        if (acc.desc !== node.desc) acc.desc = "";
        return acc;
      }, {})
    : undefined;

  const handleMultiEdit = (values: Partial<TreeNode>) => {
    const newTree = updateNodesBatch(treeData, selectedKeys, values);
    if (isControlled && !!onChange) {
      onChange(newTree);
    } else {
      dispatch({ type: "SET", data: newTree });
    }
  };

  function findNodeByKey(nodes: TreeNode[], key: string): TreeNode | null {
    for (const n of nodes) {
      if (n.key === key) return n;
      if (n.children.length > 0) {
        const found = findNodeByKey(n.children, key);
        if (found) return found;
      }
    }
    return null;
  }

  function updateNodesBatch(
    nodes: TreeNode[],
    keys: string[],
    values: Partial<TreeNode>
  ): TreeNode[] {
    return nodes.map((n) =>
      keys.includes(n.key)
        ? { ...n, ...values }
        : { ...n, children: updateNodesBatch(n.children, keys, values) }
    );
  }

  // 判断 childKey 是否为 parentKey 的子孙节点
  function isDescendant(
    nodes: TreeNode[],
    parentKey: string,
    childKey: string
  ): boolean {
    for (const node of nodes) {
      if (node.key === parentKey) {
        if (node.children.some((child) => child.key === childKey)) {
          return true;
        }
        for (const child of node.children) {
          if (isDescendant(child.children, parentKey, childKey)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  const canUndo = !isControlled && state.past.length > 0;
  const canRedo = !isControlled && state.future.length > 0;

  const defaultPanel =
    multiEdit && allGroups ? (
      <TreeNodePropPanel
        node={{ key: "", label: "", desc: "", group: true, children: [] }}
        onChange={() => {}}
        selected={false}
        onSelect={() => {}}
        multiEdit
        multiEditValues={multiEditValues}
        onMultiEdit={handleMultiEdit}
      />
    ) : null;

  // 右侧属性面板内容
  let propertyPanelContent: ReactNode = null;
  if (selectedKeys.length === 0) {
    propertyPanelContent = (
      <div style={{ color: "#888", padding: 16 }}>请选择节点</div>
    );
  } else if (selectedKeys.length === 1 && selectedNodes[0]) {
    propertyPanelContent = (
      <TreeNodePropPanel
        node={selectedNodes[0]}
        onChange={handleNodeChange}
        selected={true}
        onSelect={() => {}}
      />
    );
  } else if (selectedKeys.length > 1) {
    // 批量编辑，取交集/空字符串
    const multiEditValues = selectedNodes.reduce<Partial<TreeNode>>(
      (acc, node) => {
        if (acc.label === undefined) acc.label = node.label;
        if (acc.desc === undefined) acc.desc = node.desc;
        if (acc.label !== node.label) acc.label = "";
        if (acc.desc !== node.desc) acc.desc = "";
        return acc;
      },
      {}
    );
    const handleMultiEdit = (values: Partial<TreeNode>) => {
      const newTree = updateNodesBatch(treeData, selectedKeys, values);
      if (isControlled && !!onChange) {
        onChange(newTree);
      } else {
        dispatch({ type: "SET", data: newTree });
      }
    };
    propertyPanelContent = (
      <TreeNodePropPanel
        node={{ key: "", label: "", desc: "", group: false, children: [] }}
        onChange={() => {}}
        selected={false}
        onSelect={() => {}}
        multiEdit
        multiEditValues={multiEditValues}
        onMultiEdit={handleMultiEdit}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* 顶部大标题和小树图标 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 24,
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 32, marginRight: 12 }}>🌳</span>
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#1890ff",
            letterSpacing: 1,
          }}
        >
          Omi Tree React 组件演示
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 20,
          flex: 1,
          minHeight: 0,
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* 树结构标题 */}
          <div
            style={{
              fontWeight: 600,
              fontSize: 18,
              marginBottom: 12,
              marginLeft: 2,
            }}
          >
            树形结构
          </div>
          {/* 操作按钮区 */}
          <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            <button
              onClick={() => dispatch({ type: "UNDO" })}
              disabled={isControlled || !canUndo}
              style={{
                padding: "8px 16px",
                border: "1px solid #d9d9d9",
                borderRadius: 4,
                background: !isControlled && canUndo ? "#fff" : "#f5f5f5",
                cursor: !isControlled && canUndo ? "pointer" : "not-allowed",
                color: !isControlled && canUndo ? "#000" : "#ccc",
              }}
            >
              撤销
            </button>
            <button
              onClick={() => dispatch({ type: "REDO" })}
              disabled={isControlled || !canRedo}
              style={{
                padding: "8px 16px",
                border: "1px solid #d9d9d9",
                borderRadius: 4,
                background: !isControlled && canRedo ? "#fff" : "#f5f5f5",
                cursor: !isControlled && canRedo ? "pointer" : "not-allowed",
                color: !isControlled && canRedo ? "#000" : "#ccc",
              }}
            >
              重做
            </button>
            <button
              onClick={() => handleNodeAdd(null)}
              disabled={false}
              style={{
                padding: "8px 16px",
                border: "1px solid #d9d9d9",
                borderRadius: 4,
                background: "#fff",
                cursor: "pointer",
                color: "#000",
              }}
            >
              添加根节点
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={selectedKeys.length === 0}
              style={{
                padding: "8px 16px",
                border: "1px solid #d9d9d9",
                borderRadius: 4,
                background: selectedKeys.length > 0 ? "#fff" : "#f5f5f5",
                cursor: selectedKeys.length > 0 ? "pointer" : "not-allowed",
                color: selectedKeys.length > 0 ? "#000" : "#ccc",
              }}
            >
              批量删除 ({selectedKeys.length})
            </button>
          </div>
          {/* 树结构区 */}
          <div
            style={{
              border: "1px solid #d9d9d9",
              borderRadius: 6,
              padding: 16,
              background: "#fff",
              minHeight: 400,
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const fromKey = e.dataTransfer.getData("text/plain");
              if (fromKey) {
                handleNodeMove([fromKey], null, "after");
              }
            }}
          >
            {renderTree(
              treeData,
              [],
              treeData,
              expandedKeys,
              setExpandedKeys,
              isDescendant,
              handleNodeChange,
              handleNodeMove,
              handleNodeAdd,
              handleNodeDelete,
              selectedKeys,
              handleSelect,
              renderNode
            )}
          </div>
        </div>
        <div
          style={{
            width: 340,
            height: "400px",
            minWidth: 220,
            border: "1px solid #d9d9d9",
            borderRadius: 6,
            background: "#fff",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            marginTop: "88px",
            marginBottom: 0,
            marginLeft: "0px",
          }}
        >
          {/* 属性面板标题，和树结构标题对齐 */}
          <div
            style={{
              fontWeight: 600,
              fontSize: 18,
              marginBottom: 12,
              marginLeft: 2,
              color: "#1890ff",
            }}
          >
            属性面板
          </div>
          {propertyPanelContent}
        </div>
      </div>
      {/* 功能说明单独一行，不重叠 */}
      <div
        style={{
          width: "100%",
          marginTop: 20,
          background: "#fff",
          borderRadius: 6,
          boxShadow: "0 1px 4px #eee",
          padding: 20,
        }}
      >
        <h3 style={{ marginTop: 0, color: "#333" }}>功能说明</h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: "20px",
            fontSize: 15,
            lineHeight: 2,
          }}
        >
          <li>
            <strong>拖拽排序：</strong>拖拽节点手柄可以移动节点位置
          </li>
          <li>
            <strong>展开/折叠：</strong>点击节点前的箭头可以展开或折叠子节点
          </li>
          <li>
            <strong>节点编辑：</strong>双击节点名称或描述可以编辑
          </li>
          <li>
            <strong>添加节点：</strong>点击 "添加子节点" 按钮可以添加子节点
          </li>
          <li>
            <strong>删除节点：</strong>点击 "批量删除" 按钮可以删除节点
          </li>
          <li>
            <strong>多选操作：</strong>按住 Ctrl 键可以多选节点
          </li>
          <li>
            <strong>批量删除：</strong>选中多个节点后可以批量删除
          </li>
          <li>
            <strong>撤回/重做：</strong>支持操作历史记录
          </li>
          <li>
            <strong>属性面板：</strong>选中节点后可以在右侧面板编辑属性
          </li>
        </ul>
      </div>
    </div>
  );
});
