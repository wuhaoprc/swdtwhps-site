// 一 取水段（Intake）：海水源 → 取水头/进水井 → 格栅滤网 → 取水泵房 → 原海水外输。
// 模型结构：左侧海水源 + 半透明进水井（带滤网环）+ 旋转格栅 + 泵房平台（取水泵×3）+ 控制间。
// 空间布局：沿 +X 轴布置，水自左上进、泵房加压后自右出；流向与原大纲"取水"一致。
import * as THREE from '../../vendor/three.module.js';
import { SegmentBase } from './SegmentBase.js';
import {
  makeLabel, makeTank, makePump, makePipeRun, makeWaterBox, makeValve, makeSkid
} from '../core/Helpers.js';
import {
  COLORS, PIPE, INLET, OUTLET, makeStubs, makePlatform, steelMat
} from '../core/ProcessSpec.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class IntakeSegment extends SegmentBase {
  constructor() {
    super({
      id: 'intake', name: '一 取水段', subtitle: 'Intake',
      description: '从海洋抽取原海水并做初步物理拦截（格栅/滤网），为后续预处理提供连续、稳定的进水。' +
        '取水头与泵房是淡化的"水源门户"；进水盐度≈35 g/L（渗透压~27 bar），高浊度、海洋生物附着与赤潮期 SDI 恶化是主要风险。' +
        '工程上取水口须与排放口拉开数十米距离，避免浓水短路回流污染取水。',
      params: [
        { k: '取水方式', v: '岸边/海底取水头 + 取水泵房' },
        { k: '进水盐度', v: '≈ 35 g/L（平均海水，渗透压~27 bar）' },
        { k: '主要设施', v: '进水井 / 旋转滤网 / 取水泵 ×3' },
        { k: '核心约束', v: '取水口与排放口间距 > 数十米（防短路回流）' },
        { k: '关键风险', v: '高浊度、生物附着、赤潮期 SDI 恶化' }
      ],
      sources: ['加州水板《浓水排放管理建议》', 'Tongaat 环评（取水/排放间距）']
    });
  }

  build() {
    // —— 海水源 ——
    const sea = makeWaterBox(5, 1.6, 5.2, COLORS.raw, 0.36);
    sea.position.set(-6.9, 0.8, 0);
    this.group.add(sea);
    this.addLabel('海水源 · 原海水', V(-6.9, 2.6, 0));

    // —— 取水头 / 进水井（半透明 + 滤网环）——
    const well = makeTank(0.85, 2.8, COLORS.steel, 0.4);
    well.position.set(-4.6, 0, 0);
    this.group.add(well);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 8, 28), steelMat(0x7f8ea3));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-4.6, 0.7 + i * 0.8, 0);
      this.group.add(ring);
    }
    this.addLabel('取水头 / 进水井', V(-4.6, 3.75, 0));

    // —— 格栅 / 旋转滤网（竖条 + 上下横梁）——
    const rack = new THREE.Group();
    const barMat = new THREE.MeshStandardMaterial({ color: 0x7f8ea3, metalness: 0.5, roughness: 0.5 });
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.05), barMat);
      b.position.set(-0.6 + i * 0.2, 0, 0);
      rack.add(b);
    }
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), steelMat()); fr.position.y = 0.86; rack.add(fr);
    const fb = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), steelMat()); fb.position.y = -0.86; rack.add(fb);
    rack.position.set(-3.1, 1.4, 0);
    this.group.add(rack);
    this.addLabel('格栅 / 旋转滤网', V(-3.1, 2.75, 0));

    // —— 取水泵房平台 + 3 台取水泵 ——
    const plat = makePlatform(4.4, 3.8); plat.position.set(1.4, 0, 0); this.group.add(plat);
    const pumpPos = [V(0.0, 0.3, -1.1), V(1.4, 0.3, -1.1), V(2.8, 0.3, -1.1)];
    pumpPos.forEach((p, i) => {
      const pump = makePump(0xf2b134);
      pump.position.copy(p);
      this.group.add(pump);
      this.addRotor(pump.children[0], 'x', 2.4 + i * 0.15); // 电机轴旋转
    });
    this.addLabel('取水泵房（取水泵 ×3）', V(1.4, 3.3, 0));

    // —— 电气 / 控制间 ——
    const bld = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.0, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x6b7480, metalness: 0.1, roughness: 0.85 })
    );
    bld.position.set(5.4, 1.0, 1.7);
    this.group.add(bld);
    this.addLabel('电气 / 控制间', V(5.4, 2.6, 1.7));

    // —— 集水池 / 集水罐（取水侧调节池：稳定进水流量与水质波动）——
    const cistern = makeTank(0.95, 2.6, 0x4f7fa8, 0.6);
    cistern.position.set(4.4, 0, 0);
    this.group.add(cistern);
    this.addLabel('集水池 / 集水罐', V(4.4, 3.4, 0));

    // —— 管道：进水井 → 泵吸入 → 泵排出 → 集水池 → 出水口 ——
    const suction = makePipeRun(
      [V(-4.6, 0.6, 0), V(-3.2, 0.6, 0), V(-3.2, 0.6, 1.7), V(1.4, 0.6, 1.7), V(1.4, 0.6, -1.1)],
      PIPE.main, steelMat()
    );
    this.group.add(suction);
    const discharge = makePipeRun(
      [V(1.4, 0.95, -1.1), V(3.6, 0.95, -1.1), V(3.6, 0.95, 0), V(4.4, 0.95, 0), V(6.3, 0.95, 0), OUTLET.clone()],
      PIPE.main, steelMat()
    );
    this.group.add(discharge);
    const v1 = makeValve(); v1.position.set(4.6, 0.95, 0); this.group.add(v1);

    // —— 段间衔接短管（左进右出，均为原海水）——
    this.group.add(makeStubs(COLORS.raw, COLORS.raw, '上游：原海水', '下游：原海水（待处理）'));

    // —— 流体：原海水 进→出 ——
    this.addFlow(
      [INLET.clone(), V(-4.6, 0.6, 0), V(-3.2, 0.6, 1.7), V(1.4, 0.6, 1.7),
       V(1.4, 0.6, -1.1), V(3.6, 0.95, -1.1), V(3.6, 0.95, 0), V(4.4, 0.95, 0), V(6.3, 0.95, 0), OUTLET.clone()],
      { color: COLORS.raw, count: 28, size: 0.15 }
    );
  }
}
