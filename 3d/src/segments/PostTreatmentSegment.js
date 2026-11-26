// 六 后处理 / 矿化（Post-treatment & Remineralization）：产水(淡) → 再矿化接触罐 → 加药(pH/消毒)
//   → 清水池 → 供水泵 → 入网。RO 产水低矿化、偏酸、具腐蚀性，须再矿化调质后方可用。
import * as THREE from '../../vendor/three.module.js';
import { SegmentBase } from './SegmentBase.js';
import {
  makeLabel, makeTank, makePump, makePipeRun, makeValve, makeSkid
} from '../core/Helpers.js';
import {
  COLORS, PIPE, INLET, OUTLET, makeStubs, makePlatform, steelMat
} from '../core/ProcessSpec.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class PostTreatmentSegment extends SegmentBase {
  constructor() {
    super({
      id: 'post', name: '六 后处理 / 矿化', subtitle: 'Post-treatment',
      description: 'RO 产水 TDS 低、pH 5.5–6.5（CO₂ 透过偏酸）且具腐蚀性，直接入网会腐蚀管网。' +
        '产水在进入矿化前先经紫外灭菌（UV）杀菌（无化学残留），再经再矿化（石灰石滤床或 CO₂+石灰）、pH 调节与消毒，' +
        '使水质满足 GB 5749-2022 后并入市政管网或做工业用水。' +
        '再矿化反应：CaCO₃ + CO₂ + H₂O → Ca²⁺ + 2HCO₃⁻，目标 Ca≥20 mg/L、碱度≥50 mg/L（以 CaCO₃ 计）、pH 7–8。',
      params: [
        { k: '工艺目标', v: '紫外灭菌 → 再矿化、调 pH、消毒（防管网腐蚀）' },
        { k: '紫外灭菌', v: 'UV 杀菌器，无化学残留，接在产水进矿化前' },
        { k: '常用方式', v: '石灰石滤床 / CO₂ + 石灰(Na₂CO₃)' },
        { k: '反应式', v: 'CaCO₃ + CO₂ + H₂O → Ca²⁺ + 2HCO₃⁻' },
        { k: '矿化目标', v: 'Ca≥20、碱度≥50 mg/L、pH 7–8' },
        { k: '优化参数', v: 'HRT≈5 min，CO₂比0.12，石灰石1–2 mm' },
        { k: '消毒', v: '低剂量氯/氯胺；UV 物理杀菌为前置保障' },
        { k: '案例', v: '曹妃甸 5 万 m³/d RO+后矿化' },
        { k: '入网标准', v: 'GB 5749-2022 生活饮用水' }
      ],
      sources: ['一带一路平台《海水淡化水后矿化技术》', '中国海洋大学《碳酸钙矿化反应器》2023', 'Filtox 后处理综述']
    });
  }

  build() {
    const plat = makePlatform(13, 4.4); plat.position.set(0.5, 0, 0); this.group.add(plat);

    // —— 紫外灭菌（UV 杀菌器，接在产水进入矿化之前）——
    const uv = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 24),
      new THREE.MeshStandardMaterial({ color: 0xb9c6d8, metalness: 0.4, roughness: 0.5 }));
    uv.rotation.z = Math.PI / 2; uv.position.set(-6.8, 0.9, 0); this.group.add(uv);
    [-0.6, 0.6].forEach(dx => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 24), steelMat(0x7f8ea3));
      c.rotation.z = Math.PI / 2; c.position.set(-6.8 + dx, 0.9, 0); this.group.add(c);
    });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 16),
      new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x49c5ff, emissiveIntensity: 0.9 }));
    lamp.rotation.z = Math.PI / 2; lamp.position.set(-6.8, 0.9, 0); this.group.add(lamp);
    this.addLabel('紫外灭菌 (UV)', V(-6.8, 2.2, 0));

    // —— 再矿化接触罐（两段式：上部进水 + 下部石灰石滤床）——
    const remin = makeTank(1.35, 3.0, COLORS.steel, 0.6); remin.position.set(-5.0, 0, 0); this.group.add(remin);
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.0, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xb9a06a, metalness: 0.1, roughness: 1.0, side: THREE.DoubleSide }));
    bed.position.set(-5.0, 0.5, 0); this.group.add(bed);
    this.addLabel('再矿化接触罐', V(-5.0, 3.8, 0));

    // —— 加药装置（pH / 消毒）——
    const dose = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xf2b134, metalness: 0.4, roughness: 0.5 }));
    dose.position.set(-5.0, 0.7, 2.2); this.group.add(dose);
    const dosePump = makePump(0xf2b134); dosePump.scale.set(0.6, 0.6, 0.6); dosePump.position.set(-5.0, 0.3, 1.3); this.group.add(dosePump);
    this.addRotor(dosePump.children[0], 'x', 5);
    this.addLabel('加药 (pH / 消毒)', V(-5.0, 1.9, 2.2));

    // —— 清水池 / 产品水池 ——
    const clear = makeTank(1.7, 2.6, 0x4f7fa8, 0.55); clear.position.set(1.8, 0, 0); this.group.add(clear);
    this.addLabel('清水池（产品水）', V(1.8, 3.3, 0));

    // —— 供水泵 ——
    const pump = makePump(0x39d98a); pump.scale.set(1.2, 1.2, 1.2); pump.position.set(5.2, 0.45, 0); this.group.add(pump);
    this.addRotor(pump.children[0], 'x', 4.5);
    this.addLabel('供水泵 → 管网', V(5.2, 2.7, 0));

    // —— 管道 ——
    const p1 = makePipeRun([INLET.clone(), V(-6.8, 0.9, 0), V(-6.8, 0.7, 0), V(-5.0, 0.7, 0)], PIPE.branch, steelMat()); this.group.add(p1);
    const p2 = makePipeRun([V(-5.0, 0.7, 0), V(-5.0, 0.7, 1.3), V(-3.0, 0.7, 1.3), V(-3.0, 0.7, 0), V(-1.5, 0.7, 0), V(1.8, 0.7, 0)], PIPE.branch, steelMat()); this.group.add(p2);
    const p3 = makePipeRun([V(1.8, 0.7, 0), V(3.5, 0.7, 0), V(5.2, 1.0, 0), V(6.3, 1.0, 0), OUTLET.clone()], PIPE.main, steelMat()); this.group.add(p3);
    const v1 = makeValve(); v1.position.set(4.5, 0.7, 0); this.group.add(v1);

    // —— 段间衔接短管 ——
    this.group.add(makeStubs(COLORS.permeate, COLORS.permeate, '上游：产水(淡水)', '下游：饮用水 / 工业水'));

    // —— 流体：产水 → 矿化 → 清水 → 供水 ——
    this.addFlow([INLET.clone(), V(-6.8, 0.9, 0), V(-6.8, 0.7, 0), V(-5.0, 0.7, 0), V(-5.0, 0.7, 1.3), V(-3.0, 0.7, 1.3), V(-3.0, 0.7, 0),
      V(-1.5, 0.7, 0), V(1.8, 0.7, 0), V(3.5, 0.7, 0), V(5.2, 1.0, 0), V(6.3, 1.0, 0), OUTLET.clone()],
      { color: COLORS.permeate, count: 30, size: 0.14 });
  }
}
