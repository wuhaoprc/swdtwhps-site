// 四 高压泵 + 能量回收（HP Pump + ERD）：UF/MF 产水 → 高压泵升压(55–70 bar) → PX 能量回收双缸
//   → 增压泵 → 高压进料去 RO。能量回收装置利用高压浓盐水的压力能直接增压低压海水，
//   效率约 95–98%，是过去 20 年 SWRO 能耗大降的第一因素（本段以双缸转子旋转动画呈现）。
import * as THREE from '../../vendor/three.module.js';
import { SegmentBase } from './SegmentBase.js';
import {
  makeLabel, makePump, makePipeRun, makeValve, makeGauge, makeSkid
} from '../core/Helpers.js';
import {
  COLORS, PIPE, INLET, OUTLET, makeStubs, makePlatform, steelMat
} from '../core/ProcessSpec.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// PX 压力交换器转子（轮毂 + 8 叶片），用于旋转动画
function makePX() {
  const g = new THREE.Group();
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 2.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xdfe8f5, metalness: 0.7, roughness: 0.3 })
  );
  hub.rotation.z = Math.PI / 2; g.add(hub);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x9fb6cc, metalness: 0.5, roughness: 0.4 });
  for (let i = 0; i < 8; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.12, 0.5), bladeMat);
    blade.rotation.x = (i / 8) * Math.PI * 2;
    g.add(blade);
  }
  return g;
}

export class HighPressureERDSegment extends SegmentBase {
  constructor() {
    super({
      id: 'hp_erd', name: '四 高压泵 + 能量回收', subtitle: 'HP Pump + ERD',
      description: '高压泵将预处理出水加压至 55–70 bar 以克服海水渗透压（约 27 bar）；' +
        '等压式能量回收装置（PX 压力交换器，陶瓷转子、单转动部件）利用高压浓盐水的压力能直接增压低压海水，' +
        '能量转移效率 96–98%（ERI 标称峰值 99%，质保 96.3%），使高压泵负荷最多降 60%、全厂比能耗大幅下降——这是 SWRO 成本骤降的关键。',
      params: [
        { k: '工作压力', v: '55–70 bar（设计余量 ≥80 bar）' },
        { k: 'ERD 类型', v: '等压式 PX 压力交换器（陶瓷转子）' },
        { k: '能量回收效率', v: '96–98%（峰值 99%，质保 96.3%）' },
        { k: '节能幅度', v: '高压泵负荷最多降 60%' },
        { k: '比能耗', v: '配 PX 后 2.5–3.0 kWh/m³（无 ERD 6–8）' },
        { k: '实例', v: '国产 IPX-66 实际 SEC 1.67 kWh/m³（2024）' },
        { k: '增压泵', v: '轴向柱塞泵（容积效率 ~92%）' },
        { k: '下游', v: '五 反渗透膜段' }
      ],
      sources: ['ERI 官网 PX 技术资料', '百度百科 压力交换器', '《二种转子式ERD…运行和效率评价》2024']
    });
  }

  build() {
    const hpMat = steelMat(0x3f6f8f);

    // 泵房平台
    const plat = makePlatform(13, 4.2); plat.position.set(0.5, 0, 0); this.group.add(plat);

    // —— 高压泵（大，带电机旋转）——
    const hp = makePump(0xf2b134); hp.scale.set(1.5, 1.5, 1.5); hp.position.set(-5.0, 0.45, 0);
    this.group.add(hp);
    this.addRotor(hp.children[0], 'x', 4.0);
    this.addLabel('高压泵 (55–70 bar)', V(-5.0, 3.4, 0));

    // —— 能量回收装置 PX ×2（双缸转子，反向旋转）——
    [-1.0, 1.6].forEach((z, i) => {
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.15, 2.5, 32),
        new THREE.MeshStandardMaterial({ color: 0x3f6f8f, metalness: 0.6, roughness: 0.35 })
      );
      shell.rotation.z = Math.PI / 2; shell.position.set(1.6, 1.4, z); this.group.add(shell);
      const rotor = makePX(); rotor.position.set(1.6, 1.4, z); this.group.add(rotor);
      this.addRotor(rotor, 'x', i % 2 === 0 ? 5.0 : -5.0); // 双缸反向
      this.addLabel(i === 0 ? 'PX 能量回收 #1' : 'PX 能量回收 #2', V(1.6, 3.5, z));
    });

    // —— 增压泵 ——
    const boost = makePump(0x39d98a); boost.scale.set(1.1, 1.1, 1.1); boost.position.set(5.0, 0.45, 0);
    this.group.add(boost);
    this.addRotor(boost.children[0], 'x', 4.5);
    this.addLabel('增压泵', V(5.0, 2.6, 0));

    // —— 压力表细节 ——
    const g1 = makeGauge(); g1.position.set(-5.0, 2.4, 0.8); this.group.add(g1);
    const g2 = makeGauge(); g2.position.set(5.0, 2.0, 0.8); this.group.add(g2);

    // —— 管道 ——
    const feed = makePipeRun([V(-7.5, 0.9, 0), V(-5.0, 0.9, 0)], PIPE.main, steelMat()); this.group.add(feed);
    const pumpToPX = makePipeRun([V(-5.0, 1.0, 0), V(-2.2, 1.4, 0), V(1.6, 1.4, -1.0)], PIPE.main, hpMat); this.group.add(pumpToPX);
    const pxToBoost = makePipeRun([V(1.6, 1.4, 1.6), V(3.4, 1.4, 0), V(5.0, 1.0, 0)], PIPE.main, hpMat); this.group.add(pxToBoost);
    const boostOut = makePipeRun([V(5.0, 1.0, 0), V(6.3, 1.0, 0), OUTLET.clone()], PIPE.main, hpMat); this.group.add(boostOut);
    // 能量回收循环：高压浓水（来自 RO）自右上进入 PX，低压浓水自 PX 排出（去排放）
    const recIn = makePipeRun([V(6.5, 2.6, 0), V(2.8, 2.6, 0), V(1.6, 1.4, 1.6)], PIPE.branch, steelMat(COLORS.recovery)); this.group.add(recIn);
    const v1 = makeValve(); v1.position.set(3.4, 1.4, 0); this.group.add(v1);

    // —— 段间衔接短管 ——
    this.group.add(makeStubs(COLORS.pretreated, COLORS.hpFeed, '上游：UF/MF 产水（预处理）', '下游：高压进料 (55–70 bar)'));

    // —— 流体 ——
    this.addFlow([INLET.clone(), V(-5.0, 0.9, 0), V(-2.2, 1.4, 0), V(1.6, 1.4, -1.0),
      V(1.6, 1.4, 1.6), V(3.4, 1.4, 0), V(5.0, 1.0, 0), V(6.3, 1.0, 0), OUTLET.clone()],
      { color: COLORS.hpFeed, count: 24, size: 0.15 }); // 高压进料主路
    this.addFlow([V(6.5, 2.6, 0), V(2.8, 2.6, 0), V(1.6, 1.4, 1.6)],
      { color: COLORS.recovery, count: 10, size: 0.12 }); // 能量回收循环
  }
}
