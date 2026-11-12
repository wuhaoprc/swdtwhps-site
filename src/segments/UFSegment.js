// 三 UF/MF 膜法预处理段（Ultrafiltration / Microfiltration）：作为 RO 进水的"终极保安"。
// 模型结构：UF 进料泵（旋转）+ PVDF 中空纤维膜组件架（竖直膜柱 ×6，双列三排）+ 顶部产水集管（绿）
//           + 底部进料/浓水集管 + 反洗 / CIP 泵 + CIP 清洗罐。低压错流过滤，分离胶体/悬浮物/微生物。
// 关键逻辑：UF/MF 在 TMP≈0.5–2 bar 下运行，出水 SDI15 极低，回收率 90%+，并定期产水反洗 + 空气擦洗（EEAB）。
import * as THREE from '../../vendor/three.module.js';
import { SegmentBase } from './SegmentBase.js';
import {
  makeLabel, makeTank, makePump, makePipeRun, makePipe, makeValve, makeSkid, makeGauge
} from '../core/Helpers.js';
import {
  COLORS, PIPE, INLET, OUTLET, makeStubs, steelMat
} from '../core/ProcessSpec.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class UFSegment extends SegmentBase {
  constructor() {
    super({
      id: 'uf', name: '三 UF/MF 膜法预处理', subtitle: 'Ultrafiltration / Microfiltration',
      description: 'UF/MF 以 PVDF 中空纤维膜（截留孔径 MF 0.1–10 µm、UF 0.01–0.1 µm，约 1–100 kDa）' +
        '在低压（TMP≈0.5–2 bar）下去除胶体、悬浮物、细菌与大部分病毒，是 RO 进水的"终极保安"。' +
        'UF 通量约 50–75 L/(m²·h)，回收率可达 90%+；每 20–60 min 用产水反洗并配合空气擦洗（EEAB）控制污染。' +
        '投加混凝剂后 UF 出水 SDI15 可低至 0.75–1.88（不加则 2.7–3.17），为大型 SWRO 主流预处理路线。',
      params: [
        { k: '膜类型', v: 'PVDF 中空纤维（外压 / 内压）' },
        { k: '截留孔径', v: 'MF 0.1–10 µm / UF 0.01–0.1 µm' },
        { k: '运行压力', v: 'TMP ≈ 0.5–2 bar（远低于 RO）' },
        { k: '膜通量', v: '50–75 L/(m²·h)' },
        { k: '回收率', v: '90%+（浓水主要为反洗排水）' },
        { k: '反洗周期', v: '20–60 min（产水反洗 + 空气擦洗）' },
        { k: '出水 SDI15', v: '投加混凝剂 0.75–1.88' },
        { k: '下游', v: '四 高压泵 + 能量回收' }
      ],
      sources: ['Yang 等 2009（混凝-UF 预处理）', 'Sorek 等大型 SWRO UF 预处理', 'moruiwater 预处理设计指南']
    });
  }

  build() {
    // —— 段间衔接短管（进 / 出水口）——
    this.group.add(makeStubs(COLORS.pretreated, COLORS.pretreated, '上游：预处理产水', '下游：UF/MF 产水（进高压泵）'));

    // —— UF 进料泵（旋转）——
    const feedPump = makePump(0x39d98a); feedPump.position.set(-4.6, 0.5, 1.7); this.group.add(feedPump);
    this.addRotor(feedPump.children[0], 'x', 3.0);
    this.addLabel('UF 进料泵', V(-4.6, 1.5, 1.7));

    // —— 膜组件架（钢框架 + 6 根竖直膜柱，双列三排）——
    const skid = makeSkid(6.6, 3.0, 2.8); skid.position.set(0.6, 0, 0); this.group.add(skid);
    const cols = [-1.6, 0.6, 2.8];
    const rows = [-0.9, 0.9];
    const modMat = new THREE.MeshStandardMaterial({ color: 0x8fb6d8, metalness: 0.4, roughness: 0.5, transparent: true, opacity: 0.92 });
    const modTop = [];
    cols.forEach(cx => rows.forEach(cz => {
      const mod = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 2.4, 24), modMat);
      mod.position.set(0.6 + cx, 1.7, cz);
      this.group.add(mod);
      modTop.push(new THREE.Vector3(0.6 + cx, 2.9, cz));
      const g = makeGauge(); g.position.set(0.6 + cx, 1.7, cz + 0.36); this.group.add(g);
    }));
    this.addLabel('PVDF 中空纤维膜组件 ×6', V(0.6, 3.7, 0));

    // —— 顶部产水集管（绿）+ 底部进料集管（青）——
    const topY = 3.05, botY = 0.55;
    const xL = cols[0], xR = 0.6 + cols[2] + 0.6;
    this.group.add(makePipeRun([V(xL, topY, 0), V(xR, topY, 0)], PIPE.main, steelMat(COLORS.permeate)));
    this.group.add(makePipeRun([V(xL, botY, 0), V(xR, botY, 0)], PIPE.branch, steelMat(COLORS.pretreated)));
    modTop.forEach(p => {
      this.group.add(makePipe(p, V(p.x, topY, 0), PIPE.small, steelMat(COLORS.permeate)));
      this.group.add(makePipe(new THREE.Vector3(p.x, botY, 0), V(p.x, 0.5, 0), PIPE.small, steelMat(COLORS.pretreated)));
    });

    // —— 反洗 / CIP 泵（橙）——
    const bwPump = makePump(0xf2b134); bwPump.scale.setScalar(0.85); bwPump.position.set(4.6, 0.5, 1.7); this.group.add(bwPump);
    this.addRotor(bwPump.children[0], 'x', 4.2);
    this.addLabel('反洗 / CIP 泵', V(4.6, 1.5, 1.7));

    // —— CIP 清洗罐 ——
    const cip = makeTank(0.55, 1.6, 0x6f86a8, 1); cip.position.set(-2.6, 0, -2.0); this.group.add(cip);
    this.addLabel('CIP 清洗罐', V(-2.6, 2.2, -2.0));

    // —— 管道串联 ——
    // 进料：进水口 → 进料泵 → 底部进料集管（青）
    this.group.add(makePipeRun(
      [V(-6.4, 0.7, 0), V(-4.6, 0.7, 0), V(-4.6, 0.7, 1.7), V(-4.6, 0.55, 1.7), V(-2.2, 0.55, 0), V(xL, botY, 0)],
      PIPE.branch, steelMat(COLORS.pretreated)));
    // 产水：顶部集管 → 右侧 → 出水口（绿）
    this.group.add(makePipeRun(
      [V(xR, topY, 0), V(5.4, topY, 0), V(6.2, 1.3, 0), OUTLET.clone()],
      PIPE.main, steelMat(COLORS.permeate)));
    // 浓水 / 反洗排水（橙，回上游）
    this.group.add(makePipeRun(
      [V(xL, botY, 0), V(-5.5, botY, 0), V(-5.5, 0.2, 2.0)],
      PIPE.small, steelMat(COLORS.brine)));
    const v1 = makeValve(); v1.position.set(6.0, 1.3, 0); this.group.add(v1);

    // —— 流体：进料(青) → 膜架分离 → 产水(绿) 出 / 浓水(橙) 回 ——
    this.addFlow(
      [INLET.clone(), V(-4.6, 0.7, 0), V(-4.6, 0.7, 1.7), V(-4.6, 0.55, 1.7), V(-2.2, 0.55, 0), V(xL, botY, 0)],
      { color: COLORS.pretreated, count: 16, size: 0.12 }
    );
    this.addFlow(
      [V(xR, topY, 0), V(5.4, topY, 0), V(6.2, 1.3, 0), OUTLET.clone()],
      { color: COLORS.permeate, count: 16, size: 0.12 }
    );
    this.addFlow(
      [V(xL, botY, 0), V(-5.5, botY, 0), V(-5.5, 0.2, 2.0)],
      { color: COLORS.brine, count: 8, size: 0.1 }
    );

    this.addLabel('UF / MF 膜法预处理', V(0.6, 4.6, 0), { fontSize: 40, color: '#bfeefc' });
  }
}
