// 全景总览段：将 7 个细分工艺段以简化"工艺块"串联，展示完整 SWRO 全流程走向与流型配色。
// 配色与逐段设计一致：原海水(蓝)→预处理(青)→高压进料(亮蓝)→RO 分流产水(绿)/浓水(橙)→后处理(绿)→排放(橙)。
import * as THREE from '../../vendor/three.module.js';
import { SegmentBase } from './SegmentBase.js';
import { makePipeRun } from '../core/Helpers.js';
import { COLORS, PIPE, steelMat } from '../core/ProcessSpec.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const BLOCKS = [
  { id: 'intake',       name: '一 取水',          color: 0x2f7fd6, out: COLORS.raw },
  { id: 'pretreatment', name: '二 预处理',        color: 0x26c6dc, out: COLORS.pretreated },
  { id: 'uf',           name: '三 UF/MF 膜法',    color: 0x19b6c9, out: COLORS.pretreated },
  { id: 'hp_erd',       name: '四 高压泵+ERD',     color: 0x2e9bff, out: COLORS.hpFeed },
  { id: 'ro',           name: '五 反渗透',        color: 0xb9c6d8, out: COLORS.permeate },
  { id: 'post',         name: '六 后处理',        color: 0x39d98a, out: COLORS.permeate },
  { id: 'brine',        name: '七 浓盐水排放',     color: 0xff6a3d, out: COLORS.brine }
];

// 相邻块之间的"主流"颜色（i → i+1 流过的流体）
const LINK_COLOR = [COLORS.raw, COLORS.pretreated, COLORS.pretreated, COLORS.hpFeed, COLORS.permeate, null];

export class OverviewSegment extends SegmentBase {
  constructor() {
    super({
      id: 'overview',
      name: '全流程总览',
      subtitle: 'SWRO Process Overview',
      description: '海水经"取水→预处理→UF/MF膜法→高压泵+能量回收→反渗透→后处理矿化"产出淡水，' +
        '浓水在"浓盐水排放"段回归海洋或资源化。下方每个工艺块（共 7 块）均可单独点击进入精细 3D 模拟。' +
        '全球脱盐装机 2024 年约 9150 万 m³/日（IDRA；GWI 口径约 6845 万 m³/日），其中反渗透占 ~62.5%。',
      params: [
        { k: '全球产能 2024', v: '≈ 9150 万 m³/日（IDRA）' },
        { k: 'RO 占比', v: '全球 ~62.5%（GWI 2024）；SWRO>70%' },
        { k: '主流技术', v: 'RO / MSF / MED（膜法取代蒸馏成主流）' },
        { k: '比能耗', v: '先进厂 <2.5–3.0 kWh/m³；理论极限≈1.1' },
        { k: '最大 RO 厂', v: '阿联酋 91 万 m³/日（2023）' },
        { k: '中国', v: '167 座 · 307.7 万 t/日（2025 末）' },
        { k: '提示', v: '点击左侧各工艺段进入独立模拟' }
      ],
      sources: ['IDRA 2024 全球脱盐装机', 'GWI DesalData 2024', 'FAO《2024 膜法脱盐路线图》']
    });
  }

  build() {
    const n = BLOCKS.length;
    const span = 2.8;
    const x0 = -((n - 1) * span) / 2;
    const y = 1.4;
    const xs = BLOCKS.map((_, i) => x0 + i * span);
    const boxes = [];

    // —— 工艺块 ——
    for (let i = 0; i < n; i++) {
      const b = BLOCKS[i];
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 1.6, 1.4),
        new THREE.MeshStandardMaterial({ color: b.color, metalness: 0.3, roughness: 0.55, transparent: true, opacity: 0.92 })
      );
      box.position.set(xs[i], y, 0);
      this.addMesh(box);
      boxes.push(box);
      this.addLabel(b.name, V(xs[i], 0.55, 0), { fontSize: 24 });
    }

    // —— 主流串联管（按流经流体配色）——
    for (let i = 0; i < n - 1; i++) {
      const col = LINK_COLOR[i];
      if (col === null) continue; // post→brine 非主流，改由 RO→brine 支路表达
      this.group.add(makePipeRun(
        [V(xs[i] + 1.0, y, 0), V(xs[i + 1] - 1.0, y, 0)], PIPE.branch, steelMat(col)));
    }

    // —— RO → 浓盐水排放 支路（橙，下沉绕行避开后处理块）——
    this.group.add(makePipeRun(
      [V(xs[4], y - 0.8, 0), V(xs[4] + 0.6, 0.3, 0), V(xs[6] - 0.6, 0.3, 0), V(xs[6], y - 0.8, 0)],
      PIPE.branch, steelMat(COLORS.brine)));

    // —— 主流体粒子（按段配色）——
    for (let i = 0; i < n - 1; i++) {
      const col = LINK_COLOR[i];
      if (col === null) continue;
      this.addFlow([V(xs[i], y, 0), V(xs[i + 1], y, 0)], { color: col, count: 8, size: 0.14 });
    }
    // RO→brine 浓水支路粒子
    this.addFlow([V(xs[4], y - 0.8, 0), V(xs[4] + 0.6, 0.3, 0), V(xs[6] - 0.6, 0.3, 0), V(xs[6], y - 0.8, 0)],
      { color: COLORS.brine, count: 8, size: 0.14 });

    // —— 淡水产出（RO 上方绿箭头 + 后处理外输）——
    this.addPipe(V(xs[4], y + 0.8, 0), V(xs[4], y + 2.0, 0), 0.12, steelMat(COLORS.permeate));
    this.addLabel('淡水产出', V(xs[4], y + 2.4, 0), { fontSize: 26, color: '#9af5c8' });
    this.addLabel('浓水 (去 七)', V(xs[6], y + 1.0, 0), { fontSize: 24, color: '#ffb38a' });
    this.addLabel('产品水 → 管网', V(xs[5] + 1.8, y, 0), { fontSize: 24, color: '#bfe6ff' });

    // —— 进水标注 ——
    // 总工艺名称已由页面顶部居中标题栏「海水淡化全流程工艺（SWRO）」统一展示，
    // 3D 场景内不再重复添加同名大标题，避免画面中两处文字冗余。
    this.addLabel('原海水 →', V(xs[0] - 1.8, y, 0), { fontSize: 24, color: '#9fe8ff' });

    // —— 流型配色图例（总工艺细化：统一色彩语言）——
    const legend = [
      { c: COLORS.raw, t: '原海水' }, { c: COLORS.pretreated, t: '预处理产水' },
      { c: COLORS.hpFeed, t: '高压进料' }, { c: COLORS.permeate, t: '淡水/产水' },
      { c: COLORS.brine, t: '浓盐水' }, { c: COLORS.recovery, t: '能量回收' }
    ];
    const lx0 = -7.6, lstep = 2.7, ly = -1.8;
    legend.forEach((it, i) => {
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: it.c, emissive: it.c, emissiveIntensity: 0.45, roughness: 0.4 }));
      chip.position.set(lx0 + i * lstep, ly, 0);
      this.group.add(chip);
      this.addLabel(it.t, V(lx0 + i * lstep + 0.45, ly, 0), { fontSize: 22, bg: 'rgba(8,26,46,0.82)' });
    });
    this.addLabel('流型配色图例', V(lx0 - 0.2, ly + 1.1, 0), { fontSize: 26, color: '#cfe6ff' });
  }
}
