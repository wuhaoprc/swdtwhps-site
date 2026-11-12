// 五 反渗透膜段（Reverse Osmosis）：高压进料 → 压力容器阵列（膜元件）→ 产水(淡水) + 浓水。
// 模型结构：双排压力容器（膜壳）阵列 + 钢支架 + 进料/产水/浓水三套集管 + 采样控制盘。
// 关键部件：聚酰胺复合膜元件、压力容器端盖、能量回收接口；产水绿色、浓水橙色。
import * as THREE from '../../vendor/three.module.js';
import { SegmentBase } from './SegmentBase.js';
import {
  makeLabel, makeVessel, makePipeRun, makeValve, makeSkid
} from '../core/Helpers.js';
import {
  COLORS, PIPE, INLET, OUTLET, makeStubs, makePlatform, steelMat
} from '../core/ProcessSpec.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class ROSegment extends SegmentBase {
  constructor() {
    super({
      id: 'ro', name: '五 反渗透膜段（一级 / 二级 RO）', subtitle: 'Reverse Osmosis (SWRO)',
      description: '聚酰胺复合膜（TFC）在 55–70 bar 高压下仅允许水分子透过，盐分被截留（盐截留率>99%）。' +
        '一级 RO 产水再经二级 RO 进一步脱盐（尤其除硼，满足 GB 5749 硼≤1.0 mg/L），提升产水水质与系统回收率。' +
        '典型回收率 40–50%（实际约 45%）；单支膜元件约 0.3–1.0 m³/d，需成百上千支装于压力容器中。' +
        '产水 TDS 约 200–500 mg/L、pH 5.5–6.5（CO₂ 透过偏酸）且具腐蚀性，须后处理；浓水盐度约为进水 1.5–2 倍。',
      params: [
        { k: '膜材料', v: '聚酰胺复合膜（TFC），卷式/中空纤维' },
        { k: '工作压力', v: '55–70 bar（一级）；二级约 10–25 bar' },
        { k: '一级 RO', v: '主体脱盐，盐截留率>99%' },
        { k: '二级 RO', v: '处理一级产水，进一步除硼/脱盐，提升水质与回收率' },
        { k: '回收率', v: '典型 40–50%（实际 ~45%）' },
        { k: '产水水质', v: '一级后 TDS≈200–500 mg/L；二级后硼<0.5 mg/L' },
        { k: '比能耗', v: '先进厂 <2.5–3.5 kWh/m³' },
        { k: '下游', v: '六 后处理（含紫外灭菌）→ 七 浓盐水排放' }
      ],
      sources: ['Filtox 海水淡化工艺综述', 'FAO《2024 膜法脱盐路线图》', 'Sorek 工程资料（16″立式膜）']
    });
  }

  build() {
    const feedMat = steelMat(COLORS.hpFeed);
    const permMat = steelMat(COLORS.permeate);
    const brineMat = steelMat(COLORS.brine);
    const rows = [-1.3, 1.3];
    const nPerRow = 4, gap = 1.35;
    const xBase = -1.0;
    // 右侧产水/浓水集管横坐标：必须在「一级→二级衔接短管」之前声明，
    // 否则 const 处于暂时性死区（TDZ），全景嵌入 build() 时会抛 ReferenceError。
    const xR = xBase + (nPerRow - 1) * gap + 0.9;

    // 整体钢平台
    const plat = makePlatform(11, 5.2); plat.position.set(1.5, 0, 0); this.group.add(plat);

    // —— 双排压力容器（膜壳）阵列 ——
    rows.forEach(z => {
      for (let i = 0; i < nPerRow; i++) {
        const v = makeVessel(5, 0.5, COLORS.steel);
        const x = xBase + i * gap;
        v.position.set(x, 1.6, z);
        this.group.add(v);
        // 端盖（球形封头）
        [-2.5, 2.5].forEach(dx => {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x7f8ea3, metalness: 0.5, roughness: 0.4 }));
          cap.rotation.z = dx > 0 ? -Math.PI / 2 : Math.PI / 2;
          cap.position.set(x + dx, 1.6, z);
          this.group.add(cap);
        });
        // 鞍式支架
        const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 1.1), steelMat());
        saddle.position.set(x, 1.05, z); this.group.add(saddle);
      }
    });

    // —— 二级反渗透（处理一级产水，体量更小，进一步除硼/脱盐）——
    const ro2x = [4.9, 5.8];
    ro2x.forEach(x => {
      const v = makeVessel(2.6, 0.4, COLORS.steel);
      v.position.set(x, 1.6, 0);
      this.group.add(v);
      [-1.3, 1.3].forEach(dx => {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0x7f8ea3, metalness: 0.5, roughness: 0.4 }));
        cap.rotation.z = dx > 0 ? -Math.PI / 2 : Math.PI / 2;
        cap.position.set(x + dx, 1.6, 0);
        this.group.add(cap);
      });
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 1.0), steelMat());
      saddle.position.set(x, 1.15, 0); this.group.add(saddle);
    });
    this.addLabel('一级反渗透', V(xBase + 1.5, 3.4, rows[1]));
    this.addLabel('二级反渗透', V(5.35, 3.0, 0));
    // 一级→二级 产水衔接短管 + 二级产水 → 出水
    this.group.add(makePipeRun([V(xR, 0.4, 0), V(4.9, 0.4, 0), V(4.9, 1.6, 0)], PIPE.small, permMat));
    this.group.add(makePipeRun([V(5.8, 1.1, 0), V(5.8, 0.4, 0), V(6.3, 0.4, 0)], PIPE.small, permMat));
    const vp2 = makeValve(); vp2.position.set(5.8, 0.4, 0); this.group.add(vp2);

    // —— 进料集管（左，竖向）+ 支管入各膜壳左端 ——
    const xL = xBase - 0.9;
    this.group.add(makePipeRun([V(xL, 0.4, 0), V(xL, 1.6, 0)], PIPE.main, feedMat));
    rows.forEach(z => {
      for (let i = 0; i < nPerRow; i++) {
        const x = xBase + i * gap;
        this.group.add(makePipeRun([V(xL, 1.6, z), V(x - 2.5, 1.6, z)], PIPE.branch, feedMat));
      }
    });

    // —— 产水集管（底部中心，绿）—— 各膜壳底部汇集 → 右出 ——（xR 已在 build 开头声明）
    rows.forEach(z => {
      for (let i = 0; i < nPerRow; i++) {
        const x = xBase + i * gap;
        this.group.add(makePipeRun([V(x, 1.1, z), V(x, 0.4, z)], PIPE.small, permMat));
      }
    });
    this.group.add(makePipeRun([V(xBase, 0.4, rows[0]), V(xBase, 0.4, rows[1])], PIPE.small, permMat));
    this.group.add(makePipeRun([V(xBase, 0.4, 0), V(xR, 0.4, 0), V(6.3, 0.4, 0), OUTLET.clone()], PIPE.branch, permMat));
    const vp = makeValve(); vp.position.set(6.3, 0.4, 0); this.group.add(vp);

    // —— 浓水集管（右，橙）—— 各膜壳右端 → 下行 → 去排放段 ——
    rows.forEach(z => {
      for (let i = 0; i < nPerRow; i++) {
        const x = xBase + i * gap;
        this.group.add(makePipeRun([V(x + 2.5, 1.6, z), V(xR, 1.6, z)], PIPE.branch, brineMat));
      }
    });
    this.group.add(makePipeRun([V(xR, 1.6, rows[0]), V(xR, 1.6, rows[1])], PIPE.branch, brineMat));
    this.group.add(makePipeRun([V(xR, 1.6, 0), V(xR, 0.4, 0), V(6.3, 0.4, 0), V(7.2, 0.4, -3)], PIPE.branch, brineMat));

    // —— 采样 / 控制盘 ——
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2a3a52, metalness: 0.3, roughness: 0.7 }));
    panel.position.set(xL - 1.4, 1.0, 2.6); this.group.add(panel);
    this.addLabel('采样 / 控制盘', V(xL - 1.4, 2.2, 2.6));

    // —— 段间衔接短管（主产品流 = 产水）——
    this.group.add(makeStubs(COLORS.hpFeed, COLORS.permeate, '上游：高压进料', '下游：产水（淡水）'));

    // —— 流体：进料 / 产水 / 浓水 ——
    this.addFlow([INLET.clone(), V(xL, 1.6, 0), V(xBase - 2.5, 1.6, rows[1]), V(xR - 2.5, 1.6, rows[1]), V(xR, 1.6, rows[1])],
      { color: COLORS.hpFeed, count: 18, size: 0.14 });
    this.addFlow([V(xBase, 1.1, 0), V(xBase, 0.4, 0), V(xR, 0.4, 0), V(6.3, 0.4, 0), OUTLET.clone()],
      { color: COLORS.permeate, count: 16, size: 0.13 });
    // 二级 RO 产水支路
    this.addFlow([V(4.9, 1.6, 0), V(4.9, 0.4, 0), V(5.8, 0.4, 0), V(5.8, 1.1, 0), V(6.3, 0.4, 0), OUTLET.clone()],
      { color: COLORS.permeate, count: 10, size: 0.12 });
    this.addFlow([V(xR, 1.6, 0), V(xR, 0.4, 0), V(7.2, 0.4, -3)],
      { color: COLORS.brine, count: 12, size: 0.13 });
    this.addLabel('浓水（去 七 排放段）', V(7.6, 1.0, -3), { fontSize: 26, color: '#ffb38a' });
  }
}
