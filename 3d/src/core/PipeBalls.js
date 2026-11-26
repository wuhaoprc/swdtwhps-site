// ============================================================================
// 管道水流小球流（PipeBalls）
// ----------------------------------------------------------------------------
// 与 Helpers.Flow 的区别：Flow 用 CatmullRomCurve3 平滑折线，在转折点会"切角"
// 偏离真实管道；本类逐段线性插值、按累积弧长匀速推进，精确经过每一个转折点与
// 分支节点，适合表达沿真实管线（含转折、分流、多出口）走向的水流。
// 用 InstancedMesh 一次绘制整条流，避免大量小球产生过多 draw call。
// ============================================================================
import * as THREE from '../../vendor/three.module.js';

export class PipeBalls {
  constructor(points, opts = {}) {
    const {
      count = 12, color = 0x33b5ff, size = 0.13,
      speed = 2.4, phase = 0, emissiveIntensity = 0.95
    } = opts;

    this.pts = points.map(p => new THREE.Vector3().copy(p));
    this.segs = [];
    this.length = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const len = this.pts[i].distanceTo(this.pts[i + 1]);
      this.segs.push({ a: this.pts[i], b: this.pts[i + 1], len, s0: this.length });
      this.length += len;
    }
    if (this.length <= 0) this.length = 1;

    this.speed = speed;   // 线速度：世界单位 / 秒（不同长度路径保持同样顺滑感）
    this.phase = phase;   // 0..1，沿整条路径的相位
    this.count = count;

    const geo = new THREE.SphereGeometry(size, 10, 8);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity, roughness: 0.32, metalness: 0.05
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;      // 初始实例矩阵为零，禁用视锥剔除避免整组消失
    this.mesh.userData.noShadow = true;
    this.group = new THREE.Group();
    this.group.add(this.mesh);

    this._v = new THREE.Vector3();
    this._dummy = new THREE.Object3D();
    this._last = performance.now();
    this.update(0);
  }

  /** t∈[0,1] → 折线上按累积弧长的精确坐标；转折处精确经过节点，不产生切角 */
  pointAt(t, out) {
    const s = (((t % 1) + 1) % 1) * this.length;
    let seg = this.segs[this.segs.length - 1];
    for (const sg of this.segs) {
      if (s <= sg.s0 + sg.len) { seg = sg; break; }
    }
    if (!seg) return out.copy(this.pts[0]);
    const u = seg.len > 0 ? THREE.MathUtils.clamp((s - seg.s0) / seg.len, 0, 1) : 0;
    return out.lerpVectors(seg.a, seg.b, u);
  }

  /** 当前所有球心坐标（供校核 / 调试用） */
  positions() {
    const arr = [], m = new THREE.Matrix4();
    for (let i = 0; i < this.count; i++) {
      this.mesh.getMatrixAt(i, m);
      arr.push(new THREE.Vector3().setFromMatrixPosition(m).toArray());
    }
    return arr;
  }

  /** 按真实墙钟推进：低帧率环境下仍按设定线速度持续、顺畅流动，不被 dt 钳制拖慢 */
  update(_dt) {
    const now = performance.now();
    const real = Math.min((now - this._last) / 1000, 0.2);
    this._last = now;
    this.phase = (this.phase + real * this.speed / this.length) % 1;
    for (let i = 0; i < this.count; i++) {
      const t = (this.phase + i / this.count) % 1;
      this.pointAt(t, this._v);
      this._dummy.position.copy(this._v);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
