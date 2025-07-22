import { Component, tag, h } from 'omi'

function genId() {
  return Date.now().toString() + Math.random().toString(36).slice(2)
}

@tag('omi-tree')
export default class OmiTree extends Component {
  static css = `
    .omi-tree-demo-root { display: flex; flex-direction: column; height: 100vh; font-family: Arial, sans-serif; background: #f7f8fa; }
    .header { display: flex; align-items: center; margin-bottom: 24px; margin-top: 8px; padding-left: 24px; }
    .icon { font-size: 32px; margin-right: 12px; }
    .title { font-size: 28px; font-weight: 700; color: #1890ff; letter-spacing: 1px; }
    .main { display: flex; gap: 20px; flex: 1; min-height: 0; align-items: flex-start; padding: 0 24px; }
    .tree-panel { flex: 1; display: flex; flex-direction: column; }
    .toolbar { margin-bottom: 16px; display: flex; gap: 8px; }
    .toolbar button { padding: 8px 16px; border: 1px solid #d9d9d9; border-radius: 4px; background: #fff; cursor: pointer; color: #000; font-size: 15px; }
    .tree-list { border: 1px solid #d9d9d9; border-radius: 6px; padding: 16px; background: #fff; min-height: 400px; }
    .tree-node-row { display: flex; align-items: center; min-height: 44px; margin: 4px 0; border-radius: 6px; padding: 14px 8px; }
    .tree-node-row.selected { border: 2px solid #1890ff; background: #e6f7ff; box-shadow: 0 0 0 2px #91d5ff; }
    .tree-node-row:not(.selected) { border: 1px solid #eee; background: #fff; }
    .tree-node-title, .tree-node-desc { min-width: 100px; padding: 4px; border-radius: 4px; background: inherit; cursor: text; }
    .tree-node-desc { min-width: 120px; color: #888; margin-left: 8px; }
    .tree-node-title.editing, .tree-node-desc.editing { border: 1.5px solid #222; background: inherit; }
    .tree-node-btn { margin-left: 8px; padding: 4px 8px; border: 1px solid #d9d9d9; border-radius: 4px; background: #fff; cursor: pointer; }
    .tree-node-btn.delete { margin-left: 4px; }
    .tree-children { margin-left: 16px; margin-top: 8px; width: 100%; display: flex; flex-direction: column; }
    .property-panel { width: 340px; height: 400px; min-width: 220px; border: 1px solid #d9d9d9; border-radius: 6px; background: #fff; padding: 16px; display: flex; flex-direction: column; align-items: flex-start; margin-top: 88px; margin-bottom: 0; margin-left: 0; }
    .property-title { font-weight: 600; font-size: 18px; margin-bottom: 12px; margin-left: 2px; color: #1890ff; }
    .footer { width: 100%; margin-top: 20px; background: #fff; border-radius: 6px; box-shadow: 0 1px 4px #eee; padding: 20px 24px; }
    .feature-desc { font-size: 15px; line-height: 2; padding-left: 20px; }
    .tree-title { font-weight: 600; font-size: 18px; margin-bottom: 12px; margin-left: 2px; }
    .tree-node-input { width: 100px; border: 1px solid #d9d9d9; border-radius: 4px; padding: 2px 4px; }
    .tree-node-input-desc { width: 120px; border: 1px solid #d9d9d9; border-radius: 4px; padding: 2px 4px; margin-left: 8px; }
  `

  state = {
    data: [{ key: '1', label: '新节点', desc: 'zhende', children: [] }],
    editingKey: null,
    editingField: null,
    editingValue: '',
    editingDesc: '',
    selectedKey: '1',
  }

  // 递归渲染树节点
  renderNode(node, parentKey = null) {
    if (!Array.isArray(node.children)) node.children = []
    const selected = this.state.selectedKey === node.key
    const editing = this.state.editingKey === node.key
    return h('div', {}, [
      h(
        'div',
        {
          class: 'tree-node-row' + (selected ? ' selected' : ''),
          onClick: (e) => {
            e.stopPropagation()
            this.state.selectedKey = node.key
            this.update()
          },
        },
        [
          node.children && node.children.length > 0
            ? h('span', { style: 'cursor:pointer; margin-right:4px; font-size:18px;' }, '▶')
            : h('span', { style: 'width:18px; display:inline-block; margin-right:4px;' }, ''),
          h(
            'span',
            {
              class:
                'tree-node-title' +
                (editing && this.state.editingField === 'label' ? ' editing' : ''),
              ondblclick: (e) => {
                e.stopPropagation()
                this.state.editingKey = node.key
                this.state.editingField = 'label'
                this.state.editingValue = node.label
                this.state.editingDesc = node.desc || ''
                this.update()
              },
            },
            editing && this.state.editingField === 'label'
              ? h('input', {
                  class: 'tree-node-input',
                  value: this.state.editingValue,
                  autofocus: true,
                  oninput: (e) => {
                    this.state.editingValue = e.target.value
                    this.update()
                  },
                  onblur: () => this.saveEdit(node, 'label'),
                  onkeydown: (e) => {
                    if (e.key === 'Enter') this.saveEdit(node, 'label')
                  },
                })
              : node.label
          ),
          h(
            'span',
            {
              class:
                'tree-node-desc' +
                (editing && this.state.editingField === 'desc' ? ' editing' : ''),
              ondblclick: (e) => {
                e.stopPropagation()
                this.state.editingKey = node.key
                this.state.editingField = 'desc'
                this.state.editingValue = node.label
                this.state.editingDesc = node.desc || ''
                this.update()
              },
            },
            editing && this.state.editingField === 'desc'
              ? h('input', {
                  class: 'tree-node-input-desc',
                  value: this.state.editingDesc,
                  autofocus: true,
                  oninput: (e) => {
                    this.state.editingDesc = e.target.value
                    this.update()
                  },
                  onblur: () => this.saveEdit(node, 'desc'),
                  onkeydown: (e) => {
                    if (e.key === 'Enter') this.saveEdit(node, 'desc')
                  },
                })
              : node.desc
              ? node.desc
              : h('span', { style: 'color:#ccc;' }, '描述')
          ),
          h(
            'button',
            {
              class: 'tree-node-btn',
              onclick: (e) => {
                e.stopPropagation()
                this.addChild(node.key)
              },
            },
            '添加子节点'
          ),
          h(
            'button',
            {
              class: 'tree-node-btn delete',
              onclick: (e) => {
                e.stopPropagation()
                this.deleteNode(node.key)
              },
            },
            '删除'
          ),
        ]
      ),
      node.children && node.children.length > 0
        ? h(
            'div',
            { class: 'tree-children' },
            node.children.map((child) => this.renderNode(child, node.key))
          )
        : null,
    ])
  }

  // 添加根节点
  addRoot = () => {
    const newNode = { key: genId(), label: '新节点', desc: '', children: [] }
    this.state.data = [...this.state.data, newNode]
    this.state.selectedKey = newNode.key
    this.update()
  }

  // 添加子节点
  addChild = (parentKey) => {
    const add = (nodes) =>
      nodes.map((n) => {
        if (n.key === parentKey) {
          const children = Array.isArray(n.children) ? n.children.slice() : []
          children.push({ key: genId(), label: '新节点', desc: '', children: [] })
          return { ...n, children }
        }
        return { ...n, children: add(Array.isArray(n.children) ? n.children : []) }
      })
    this.state.data = add(this.state.data)
    this.update()
  }

  // 删除节点
  deleteNode = (key) => {
    const del = (nodes) =>
      nodes
        .filter((n) => n.key !== key)
        .map((n) => ({ ...n, children: del(Array.isArray(n.children) ? n.children : []) }))
    this.state.data = del(this.state.data)
    if (this.state.selectedKey === key) this.state.selectedKey = null
    this.update()
  }

  // 保存编辑
  saveEdit = (node, field) => {
    const update = (nodes) =>
      nodes.map((n) => {
        if (n.key === node.key) {
          return {
            ...n,
            label: field === 'label' ? this.state.editingValue : n.label,
            desc: field === 'desc' ? this.state.editingDesc : n.desc,
          }
        }
        return { ...n, children: update(Array.isArray(n.children) ? n.children : []) }
      })
    this.state.data = update(this.state.data)
    this.state.editingKey = null
    this.state.editingField = null
    this.state.editingValue = ''
    this.state.editingDesc = ''
    this.update()
  }

  render() {
    return h('div', { class: 'omi-tree-demo-root' }, [
      h('div', { class: 'header' }, [
        h('span', { class: 'icon' }, '🌳'),
        h('span', { class: 'title' }, 'Omi Tree React 组件演示'),
      ]),
      h('div', { class: 'main' }, [
        h('div', { class: 'tree-panel' }, [
          h('div', { class: 'tree-title' }, '树形结构'),
          h('div', { class: 'toolbar' }, [h('button', { onclick: this.addRoot }, '添加根节点')]),
          h(
            'div',
            { class: 'tree-list' },
            this.state.data.map((node) => this.renderNode(node))
          ),
        ]),
        h('div', { class: 'property-panel' }, [
          h('div', { class: 'property-title' }, '属性面板'),
          this.state.selectedKey
            ? (() => {
                const node = this.findNode(this.state.data, this.state.selectedKey)
                if (!node) return h('div', null, '未选中节点')
                return h(
                  'div',
                  {
                    style:
                      'background:#e6f7ff; border-radius:4px; padding:8px 12px; min-width:180px; display:flex; gap:12px;',
                  },
                  [
                    h('span', { style: 'min-width:100px;' }, node.label),
                    h('span', { style: 'min-width:120px; color:#888;' }, node.desc),
                  ]
                )
              })()
            : h('div', null, '未选中节点'),
        ]),
      ]),
      h('div', { class: 'footer' }, [
        h('h3', { style: 'margin-top:0; color:#333;' }, '功能说明'),
        h('ul', { class: 'feature-desc' }, [
          h('li', null, [h('strong', null, '拖拽排序：'), '拖拽节点手柄可以移动节点位置']),
          h('li', null, [h('strong', null, '展开/折叠：'), '点击节点前的箭头可以展开或折叠子节点']),
          h('li', null, [h('strong', null, '节点编辑：'), '双击节点名称或描述可以编辑']),
          h('li', null, [h('strong', null, '添加节点：'), '点击 "添加子节点" 按钮可以添加子节点']),
          h('li', null, [h('strong', null, '删除节点：'), '点击 "批量删除" 按钮可以删除节点']),
          h('li', null, [h('strong', null, '多选操作：'), '按住 Ctrl 键可以多选节点']),
          h('li', null, [h('strong', null, '批量删除：'), '选中多个节点后可以批量删除']),
          h('li', null, [h('strong', null, '撤回/重做：'), '支持操作历史记录']),
          h('li', null, [h('strong', null, '属性面板：'), '选中节点后可以在右侧面板编辑属性']),
        ]),
      ]),
    ])
  }

  // 辅助：查找节点
  findNode(nodes, key) {
    for (const n of nodes) {
      if (n.key === key) return n
      if (n.children && n.children.length > 0) {
        const found = this.findNode(n.children, key)
        if (found) return found
      }
    }
    return null
  }
}
