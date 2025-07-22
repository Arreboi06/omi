import React from 'react'
import { createRoot } from 'react-dom/client'

import OmiTreeOmi from '../omi-tree-omi'

const initialData = [{ key: '1', label: '新节点', desc: 'zhende', children: [] }]

const App = () => <OmiTreeOmi data={initialData} />

createRoot(document.getElementById('app')!).render(<App />)
