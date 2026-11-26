// 七 浓盐水排放（Brine Discharge）：浓水(来自RO) → 放流管(入海下沉) → 多端口扩散器 → 海域掺混稀释。
// 模型结构：浓水集管 + 下沉放流管 + 水平多端口扩散器（带若干喷射口）+ 掺混羽流粒子 + 海域。
// 关键逻辑：浓水盐度约为进水 1.5–2 倍，须靠扩散器快速掺混稀释以降低环境影响（环评核心争议点）。
import * as THREE from '../../vendor/three.module.js';
import { SegmentBase } from './SegmentBase.js';
import {
  makeLabel, makePipeRun, makeWaterBox
} from '../core/Helpers.js';
import {
  COLORS, PIPE, INLET, OUTLET, makeStubs, makePlatform, steelMat
} from '../core/ProcessSpec.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class BrineDischargeSegment extends SegmentBase {
  constructor() {
    super({
      id: 'brine', name: '七 浓盐水排放', subtitle: 'Brine Discharge',
      description: '浓盐水盐度约为进水的 1.5–2 倍（35 g/L 进料、45% 回收→~65 g/L；实际 58–71 psu），直接排放影响局部生态。' +
        '工程上采用"放流管 + 多端口扩散器"（HDPE ~60 m，喷嘴 60° 上仰、喷口流速 3–4 m/s），使浓水快速掺混稀释；' +
        '也可与电厂冷却水混合，或走向"浓盐水资源化"（提盐/提镁/提锂）。这是环评与社会接受度的核心争议点。',
      params: [
        { k: '浓水盐度', v: '≈1.5–2× 海水（~65 g/L / 58–71 psu）' },
        { k: '排放方式', v: '多端口扩散器 + 掺混（喷口流速 3–4 m/s）' },
        { k: '初始稀释', v: '设计 1:30（70 m 内达成；加州建议 ≥1:20）' },
        { k: '规范要求', v: '混合区边界盐度增量 ≤5%（约 1.7 psu）' },
        { k: '温升/掺混', v: '约 +1.5℃；可与电厂冷却水掺混' },
        { k: '生态敏感', v: '底栖/海草最敏感（2–3 psu 增量即受影响）' },
        { k: '资源化方向', v: '提镁 / 提锂 / 提溴（研究热点）' }
      ],
      sources: ['EPA WA Alkimos 环评', '加州水板《浓水排放管理建议》', 'Tongaat 环评（扩散器设计）']
    });
  }

  build() {
    // —— 海域（右侧大半透明水体）——
    const sea = makeWaterBox(12, 1.8, 10, COLORS.raw, 0.32);
    sea.position.set(11, 0.9, 0); this.group.add(sea);
    this.addLabel('海域（掺混稀释）', V(11, 2.6, 0));

    // 岸基平台
    const plat = makePlatform(8, 4); plat.position.set(-2, 0, 0); this.group.add(plat);

    // —— 浓水集管（竖向，来自 RO）——
    this.group.add(makePipeRun([V(INLET.x, 0.4, 0), V(INLET.x, 1.3, 0), V(-5, 1.3, 0)], PIPE.main, steelMat(COLORS.brine)));

    // —— 放流管（自岸上向海下沉）——
    this.group.add(makePipeRun(
      [V(-5, 1.3, 0), V(2, 1.3, 0), V(6, 0.6, 0), V(9, 0.4, 0)], PIPE.main, steelMat()));

    // —— 多端口扩散器（水平管 + 若干喷射口）——
    const diffLen = 4.0;
    const diff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, diffLen, 24),
      new THREE.MeshStandardMaterial({ color: 0x7e8ba0, metalness: 0.5, roughness: 0.4 })
    );
    diff.rotation.z = Math.PI / 2; diff.position.set(11, 0.4, 0); this.group.add(diff);
    const ports = 5;
    for (let i = 0; i < ports; i++) {
      const t = (i + 1) / (ports + 1);
      const x = 11 - diffLen / 2 + t * diffLen;
      const port = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x55617a })
      );
      port.position.set(x, 0.15, 0); // 向下喷射（朝海底/海水）
      this.group.add(port);
    }
    this.addLabel('多端口扩散器', V(11, 1.6, 0));

    // —— 段间衔接短管 ——
    this.group.add(makeStubs(COLORS.brine, COLORS.brine, '上游：浓水(来自RO)', '下游：入海掺混'));

    // —— 流体：浓水主管 + 多向掺混羽流 ——
    this.addFlow([INLET.clone(), V(-5, 1.3, 0), V(2, 1.3, 0), V(6, 0.6, 0), V(9, 0.4, 0), V(11, 0.4, 0)],
      { color: COLORS.brine, count: 20, size: 0.15 });
    // 掺混羽流（自扩散器向海发散）
    const plumeDirs = [
      [V(13, 0.3, 0), V(16, 0.2, 0), V(19, 0.25, 0)],
      [V(13, 0.3, 1.5), V(16, 0.2, 3), V(19, 0.25, 5)],
      [V(13, 0.3, -1.5), V(16, 0.2, -3), V(19, 0.25, -5)],
      [V(11, 0.3, 0), V(11, 0.1, 2.5), V(11, 0.15, 5)],
      [V(11, 0.3, 0), V(11, 0.1, -2.5), V(11, 0.15, -5)]
    ];
    plumeDirs.forEach((pts, i) =>
      this.addFlow(pts, { color: COLORS.brine, count: 10, size: 0.12, speed: 0.13 + i * 0.01 }));
    this.addLabel('浓盐水掺混稀释羽流', V(16, 1.4, 0), { fontSize: 26, color: '#ffb38a' });
  }
}
