// 工艺段基类：所有细分工艺段（取水/预处理/高压泵+ERD/RO/后处理/浓盐水…）的统一接口。
// 设计目标：每段独立成类、独立 build()/update()/getInfo()，可单独补充与完善，互不耦合。
import * as THREE from '../../vendor/three.module.js';
import { makeLabel, Flow, makePipe, makeTank, makeVessel, makePump } from '../core/Helpers.js';

export class SegmentBase {
  constructor(meta) {
    this.meta = meta || { id: 'unknown', name: '未命名工艺段', subtitle: '', description: '', params: [] };
    this.group = new THREE.Group();
    this.flows = [];
    this.rotors = []; // 需旋转动画的部件：{ mesh, axis, speed }
  }

  /** 子类必须实现：构建本段 3D 内容与流体 */
  build() { throw new Error('SegmentBase.build() 需由子类实现'); }

  /** 注册一个旋转部件（如搅拌桨、泵轴、PX 转子）。speed 可为常数或 (t)=>number */
  addRotor(mesh, axis = 'y', speed = 1) {
    this.rotors.push({ mesh, axis, speed });
    return mesh;
  }

  /** 默认动画：推进流体粒子 + 旋转部件。子类可重写并调用 super.update() */
  update(dt, t) {
    for (const f of this.flows) f.update(dt);
    for (const r of this.rotors) {
      const sp = typeof r.speed === 'function' ? r.speed(t) : r.speed;
      r.mesh.rotation[r.axis] += dt * sp;
    }
  }

  /** 返回 HUD 展示信息（名称/副标题/描述/参数表） */
  getInfo() { return this.meta; }

  // —— 通用构造辅助（降低每段重复代码）——
  addFlow(points, opts) {
    const f = new Flow(points, opts);
    this.flows.push(f);
    this.group.add(f.group);
    return f;
  }
  addLabel(text, pos, opts) {
    const s = makeLabel(text, opts);
    s.position.copy(pos);
    this.group.add(s);
    return s;
  }
  addPipe(p1, p2, r, mat) {
    const m = makePipe(p1, p2, r, mat);
    this.group.add(m);
    return m;
  }
  addMesh(mesh) { this.group.add(mesh); return mesh; }

  /** 统一释放几何与材质，避免切换工艺段时内存泄漏 */
  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
