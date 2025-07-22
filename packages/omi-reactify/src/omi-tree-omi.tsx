import './demo/omi-tree'
import reactify from './index'

const OmiTreeOmi = reactify<{ data: any[]; onNodeMove?: (e: any) => void }>('omi-tree')

export default OmiTreeOmi
