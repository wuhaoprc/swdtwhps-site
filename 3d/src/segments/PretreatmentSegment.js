// 二 预处理段（Pretreatment）：原海水 → 混凝/絮凝（带旋转搅拌）→ 多介质砂滤罐 → 预处理产水（去 三 UF/MF）。
// 模型结构：混凝絮凝罐（搅拌桨旋转）+ 2 座压力砂滤罐 + 加药装置。
// 说明：UF/MF 膜法预处理已独立为 三 工艺段；本段保留传统"混凝-絮凝-多介质过滤"路线。
import * as THREE from '../../vendor/three.module.js';
import { SegmentBase } from './SegmentBase.js';
import {
  makeLabel, makeTank, makePump, makePipeRun, makeValve, makeGauge
} from '../core/Helpers.js';
import {
  COLORS, PIPE, INLET, OUTLET, makeStubs, steelMat
} from '../core/ProcessSpec.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 搅拌桨（轴 + 4 叶片），用于絮凝罐旋转动画
function makeImpeller() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.7, 12),
    new THREE.MeshStandardMaterial({ color: 0x55657c, metalness: 0.6, roughness: 0.4 }));
  g.add(shaft);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcfd8e3, metalness: 0.5, roughness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.2), bladeMat);
    b.rotation.y = i * Math.PI / 4;
    b.position.y = -0.55;
    g.add(b);
  }
  return g;
}

export class PretreatmentSegment extends SegmentBase {
  constructor() {
    super({
      id: 'pretreatment', name: '二 预处理段', subtitle: 'Pretreatment',
      description: '去除悬浮物、胶体、微生物与结垢离子，使 SDI15<3（推荐<2.5）以满足后续膜法要求。' +
        '本段保留传统"混凝-絮凝-多介质过滤"路线；现代大型厂在此基础上进一步采用超滤/微滤（UF/MF）膜法预处理（已独立为 三 工艺段）。' +
        '海湾地区须重点防控生物污染与赤潮期 SDI 恶化。',
      params: [
        { k: '工艺目标', v: 'SDI15<3（推荐<2.5），浊度<0.1 NTU' },
        { k: '本段工艺', v: '混凝 → 絮凝 → 多介质过滤' },
        { k: '膜法预处理', v: '已独立为 三 UF/MF 膜法预处理段' },
        { k: '加药', v: 'FeCl₃ 混凝剂 ~6 mg/L（pH≈8）' },
        { k: '终保安过滤', v: '5 μm 保安过滤器（位于 UF/MF 后）' },
        { k: '下游', v: '三 UF/MF 膜法预处理' }
      ],
      sources: ['渤海湾海水混凝-超滤研究', 'moruiwater 预处理设计指南']
    });
  }

  build() {
    // —— 段间衔接短管 ——
    this.group.add(makeStubs(COLORS.raw, COLORS.pretreated, '上游：原海水', '下游：UF/MF 进料（预处理产水）'));

    // —— 混凝 / 絮凝罐（半透明 + 旋转搅拌桨）——
    const coag = makeTank(1.1, 2.8, COLORS.steel, 0.55);
    coag.position.set(-5.2, 0, 0);
    this.group.add(coag);
    const imp = makeImpeller();
    imp.position.set(-5.2, 2.4, 0);
    this.group.add(imp);
    this.addRotor(imp, 'y', 1.6);
    this.addLabel('混凝 / 絮凝罐', V(-5.2, 3.9, 0));

    // —— 多介质 / 砂滤罐 ×2（压力过滤，钢色不透明）——
    [-1.8, 0.2].forEach((x, i) => {
      const f = makeTank(1.15, 3.0, 0x8593a8, 1);
      f.position.set(x, 0, 0);
      this.group.add(f);
      const g = makeGauge(); g.position.set(x + 0.9, 2.4, 0.4); this.group.add(g);
      this.addLabel(i === 0 ? '多介质砂滤罐 #1' : '多介质砂滤罐 #2', V(x, 3.8, 0));
    });

    // —— 加药装置（混凝剂 / 阻垢剂）——
    const doze = makeTank(0.5, 1.2, 0x6f86a8, 1); doze.position.set(-3.4, 0, 2.4); this.group.add(doze);
    const dozePump = makePump(0xf2b134); dozePump.scale.setScalar(0.6); dozePump.position.set(-3.4, 0.3, 1.4); this.group.add(dozePump);
    this.addLabel('加药（混凝/阻垢）', V(-3.4, 2.0, 2.4));

    // —— 管道串联（砂滤 → 出水口）——
    this.group.add(makePipeRun([V(-6.3, 0.7, 0), V(-5.2, 0.7, 0)], PIPE.branch, steelMat()));
    this.group.add(makePipeRun([V(-5.2, 0.7, 0), V(-5.2, 0.7, 1.4), V(-1.8, 0.7, 1.4), V(-1.8, 0.7, 0)], PIPE.branch, steelMat()));
    this.group.add(makePipeRun(
      [V(0.2, 0.7, 0), V(0.2, 0.7, 1.6), V(6.4, 0.7, 1.6), V(6.4, 0.7, 0), V(6.4, 1.3, 0), OUTLET.clone()],
      PIPE.branch, steelMat()));
    const v1 = makeValve(); v1.position.set(6.0, 0.7, 0); this.group.add(v1);

    // —— 流体：原海水 → 絮凝 → 砂滤 → 预处理产水 ——
    this.addFlow(
      [INLET.clone(), V(-5.2, 0.7, 0), V(-5.2, 0.7, 1.4), V(-1.8, 0.7, 1.4), V(-1.8, 0.7, 0),
       V(0.2, 0.7, 0), V(0.2, 0.7, 1.6), V(6.4, 0.7, 1.6), V(6.4, 0.7, 0), V(6.4, 1.3, 0), OUTLET.clone()],
      { color: COLORS.pretreated, count: 26, size: 0.14 }
    );
  }
}
