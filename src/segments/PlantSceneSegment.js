// ============================================================================
// 厂区全景段（Plant Scene）· 唯一主界面
// ----------------------------------------------------------------------------
// 组成：海水 / 海岸 / 周围山地 / 七段集装箱工艺舱 / 厂区设施 / 外部用水工厂 /
//       产品水外输主管线 / 浓盐水排放管道 / 涉海取排水工程。
// 融入：全流程总览 + 七个工艺段的精细 3D 模型直接嵌在各自集装箱（总览进展馆）内，
//       不再需要切换到独立界面；鼠标点击集装箱或左侧按钮即可在同一场景内聚焦交互。
// 交互：默认集装箱不透明（实心）；点击工艺段后目标集装箱变透明、边框高亮、
//       该段流体加速、相机平滑飞近；点击「厂区全景」恢复全局视图与不透明集装箱。
//       左侧导航「全流程总览」与点击「全流程总览展馆」共用 App 的
//       focusOverview 指令：球面弧线连续旋转至展馆背面并聚焦，展馆居中且完整可见。
//
// 公开资料依据（models/sources.js 中 S56–S65，详见 getInfo().sources）：
//  · IDA 白皮书：Perth / Gold Coast 厂区航拍实景（储罐群、主厂房、过滤池）
//  · 新华社 Sorek 实地报道：3 根 Ø1.8 m × 1.25 km 取水管、数十座 10 m 过滤池
//  · JICA 研究报告：按工艺流程顺序布置、约 20 ha、50 m 服务道路、取排水坑内置
//  · 舟山环评：四个功能分区、20% 绿化率；虾峙岛环评：设备序列、4–6 m 道路
//  · 哈斯彦纪实：海岸渗滤取水、下风向分区；Perth：10 ha、12 列 SWRO、后靠丘陵
//  · 沧东电厂 / 天津南港 / 鲁北：淡化水 70 km 主管线供 30–77 家工业企业、
//    园区配套输水管网直接铺到厂区 → 支撑「外部用水工厂 + 产品水外输」
// ============================================================================
import * as THREE from '../../vendor/three.module.js';
import { SegmentBase } from './SegmentBase.js';
import { makePipeRun, makeTank, makeVessel, makeValve } from '../core/Helpers.js';
import { COLORS, steelMat } from '../core/ProcessSpec.js';
import { PipeBalls } from '../core/PipeBalls.js';
import { OverviewSegment } from './OverviewSegment.js';
import { IntakeSegment } from './IntakeSegment.js';
import { PretreatmentSegment } from './PretreatmentSegment.js';
import { UFSegment } from './UFSegment.js';
import { HighPressureERDSegment } from './HighPressureERDSegment.js';
import { ROSegment } from './ROSegment.js';
import { PostTreatmentSegment } from './PostTreatmentSegment.js';
import { BrineDischargeSegment } from './BrineDischargeSegment.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({
  color, metalness: 0.18, roughness: 0.78, ...o
});
// 半透明管壁：前后壁叠加 + 轻微自发光，使圆柱轮廓（边界）在深色背景上仍清晰可辨
const glass = (color, opacity, ei = 0.22) => new THREE.MeshStandardMaterial({
  color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  emissive: color, emissiveIntensity: ei, roughness: 0.28, metalness: 0.08
});
const markNoShadow = (obj) => {
  obj.traverse(o => { if (o.isMesh) o.userData.noShadow = true; });
  return obj;
};

// 确定性伪随机，保证每次构建布局一致
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// 山地高度场：主峰群 + 次峰 + 山脊 + 细噪声；地形网格与树木布点共用同一函数，
// 避免树浮空或陷入地形。整体高度设软上限，防止扩展后的山体遮挡厂区。
function terrainHeight(x, z) {
  // 主厂区（x<35）：地形平整至 z<-12 才起坡（保持原样）；
  // 东侧园区（x≥55）：平整至 z<-48 才起坡，使 EXT 后排（世界 z≈-46~-22）落于平地、紧靠山体；
  // x∈[35,55] 平滑过渡，避免边界陡壁；东侧园区的山体隆起（高斯 + 正弦项）同步压低，避免山体侵入后排台地。
  const eastK = THREE.MathUtils.smoothstep(x, 35, 55);  // 0 主厂区 → 1 东侧园区
  const slopeZ = 12 + (48 - 12) * eastK;
  const dist = Math.max(0, -z - slopeZ);
  if (dist <= 0) return 0;
  const rise = Math.min(1, dist / 9);
  let h = dist * 0.16 * rise;
  const bumpK = 1 - eastK;
  h += bumpK * 7.5 * Math.exp(-(((x + 26) ** 2) + ((z + 36) ** 2)) / 240);
  h += bumpK * 9.5 * Math.exp(-(((x - 2) ** 2) + ((z + 44) ** 2)) / 330);
  h += bumpK * 5.5 * Math.exp(-(((x + 36) ** 2) + ((z + 46) ** 2)) / 190);
  h += bumpK * 6.0 * Math.exp(-(((x - 34) ** 2) + ((z + 40) ** 2)) / 220);
  h += bumpK * 4.5 * Math.exp(-(((x + 52) ** 2) + ((z + 52) ** 2)) / 280);
  h += bumpK * 5.0 * Math.exp(-(((x - 12) ** 2) + ((z + 62) ** 2)) / 380);
  h += 2.2 * Math.sin(x * 0.075 + z * 0.05) * rise;
  h += 1.1 * Math.sin(x * 0.23) * Math.cos(z * 0.31) * rise;
  h += 0.55 * Math.sin(x * 0.61 + z * 0.43) * rise;
  return Math.max(0, Math.min(h * rise, 17));
}

// 七段集装箱工艺舱：沿 +X 顺序 = 工艺流程顺序（每个工艺段装于一只标准集装箱模块内）
const PLANT_SEGMENTS = [
  { no: '一', name: '取水段',            id: 'intake',       x: -33, w: 8,  d: 7,   h: 3.1, color: 0x3f6fa5, feature: 'intake',    cls: null },
  { no: '二', name: '预处理段',          id: 'pretreatment', x: -22, w: 9,  d: 7.5, h: 3.4, color: 0x2e8f9d, feature: 'clarifier', cls: null },
  { no: '三', name: 'UF/MF 膜法预处理',  id: 'uf',           x: -11, w: 10, d: 7,   h: 3.6, color: 0x2f9d8c, feature: 'ufskid',    cls: null },
  { no: '四', name: '高压泵 + 能量回收', id: 'hp_erd',       x: 0,   w: 10, d: 7.5, h: 3.9, color: 0x5175b8, feature: 'pxbank',    cls: null },
  { no: '五', name: '反渗透膜段',        id: 'ro',           x: 11,  w: 13, d: 8.5, h: 4.6, color: 0x72849f, feature: 'rovessel',  cls: null },
  { no: '六', name: '后处理 / 矿化',     id: 'post',         x: 22,  w: 10, d: 7.5, h: 3.4, color: 0x3f9d6d, feature: 'clearwell', cls: null },
  { no: '七', name: '浓盐水排放',        id: 'brine',        x: 33,  w: 8,  d: 6,   h: 2.9, color: 0xb0704a, feature: 'outfall',   cls: null },
];

// 各段模型嵌入配置（缩放后置于半透明厂房内部）
const EMBED = [
  { id: 'overview',     cls: OverviewSegment,          x: -38,  z: -9.5, s: 0.26 },
  { id: 'intake',       cls: IntakeSegment,            x: -33,  z: -1,   s: 0.42 },
  { id: 'pretreatment', cls: PretreatmentSegment,      x: -22,  z: -1,   s: 0.42 },
  { id: 'uf',           cls: UFSegment,                x: -11,  z: -1,   s: 0.42 },
  { id: 'hp_erd',       cls: HighPressureERDSegment,   x: 0,    z: -1,   s: 0.42 },
  { id: 'ro',           cls: ROSegment,                x: 11,   z: -1,   s: 0.46 },
  { id: 'post',         cls: PostTreatmentSegment,     x: 22,   z: -1,   s: 0.42 },
  { id: 'brine',        cls: BrineDischargeSegment,    x: 33,   z: -1,   s: 0.42 },
];

// 点击聚焦锚点（相机目标与距离）
const ANCHORS = {
  overview:     { x: -38, z: -9.5, dist: 24 },
  intake:       { x: -33, z: -1,   dist: 20 },
  pretreatment: { x: -22, z: -1,   dist: 20 },
  uf:           { x: -11, z: -1,   dist: 20 },
  hp_erd:       { x: 0,   z: -1,   dist: 20 },
  ro:           { x: 11,  z: -1,   dist: 23 },
  post:         { x: 22,  z: -1,   dist: 20 },
  brine:        { x: 33,  z: -1,   dist: 20 },
};

const SITE = {
  groundY: 0.35, seaY: 0.10, coastZ: 11.5, seaFrontZ: 140,
  siteFrontZ: 11, siteBackZ: -13, halfX: 45
};
// —— 东侧园区总平面（S1 会签版）：前排市政水厂 + 后排外部工业用水工厂（山侧前后两排）——
// 两厂在 X 上同界（x0=52 对齐），靠 Z 向前后两排区分：前排 MUNI（世界 z≈-4.2~3.0，靠北侧公共走廊）、
// 后排 EXT（世界 z≈-46~-22，紧靠山体）；中间 z∈[-22,-4.2] 为横向绿化隔离带。各自独立围墙与出入口。
const MUNI = { x0: 52, x1: 74 };       // 前排市政水厂：宽 22，cx=63（西侧，临主厂区）
// 注：ISOLATE 中央绿化隔离带（原 x74–80）已取消——前后两排改为 Z 向分离，不再需要 X 向隔离带。
const EXT = { x0: 52, x1: 150 };       // 后排外部工业用水园区：宽 98，cx=101，世界 z=-46~-22（向山体扩展），紧靠山体
const BOTTLE_X = 86;                   // 罐装饮用水厂房中心：x=82–90，位于前排、紧邻市政水厂东侧
// 局部台地基准（局部 z∈[-13,3]，depth=16、cz=-5）：主厂区 SITE.siteFrontZ=11 不受影响。
const PARK = { frontZ: 3.0, backZ: SITE.siteBackZ, depth: 3.0 - SITE.siteBackZ, cz: (3.0 + SITE.siteBackZ) / 2 };
// 前排 / 后排 park 的 Z 变换：worldZ = position.z + localZ * scale.z（局部 [-13,3] 映射到世界区间）
const FRONT_S = 0.45, FRONT_Z0 = 1.65;   // 前排：1.65-13×0.45=-4.2，1.65+3×0.45=3.0
const BACK_S = 0.75, BACK_Z0 = -24.25;   // 后排：-24.25-13×0.75=-34，-24.25+3×0.75=-22；进深由 world 坐标新增带扩展至 -46
const LABEL_SCALE = 4.5;             // 东侧标注变密 + 取景拉远，略收字号避免叠字
const RADIAL_N = 12;                 // 浓水排放点向四周辐射的分支数（每 30°）

// 园区北向主门（示意级表达，S1 会签版）：门柱 + 灯帽、门卫室、伸缩门、人行闸机、
// 斑马线、门前引道（北墙 → 公共车行道）与纵向引道（北墙 → 园区内部路）。
// 两园与罐装厂共用，保证「出入口顺畅、人车分流、道路连通」。
function buildGate(put, m, o) {
  const { gateX = 0, wallZ, half, innerZ, tone,
          roadZ = 4.7, zebraZ0 = 3.6, zebraStep = 0.2 } = o;
  const y = SITE.groundY;
  [-half, half].forEach(dx => {
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 2.6, 12), m.wall), gateX + dx, y + 1.3, wallZ);
    put(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m.light), gateX + dx, y + 2.7, wallZ);
  });
  put(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 2.0), tone), gateX + half + 1.6, y + 1.0, wallZ - 1.6);
  put(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 2.3), m.roof), gateX + half + 1.6, y + 2.1, wallZ - 1.6);
  const carW = half * 1.15;
  put(new THREE.Mesh(new THREE.BoxGeometry(carW, 0.06, 0.16), m.steel), gateX - half + carW / 2, y + 0.03, wallZ);
  for (let k = 0; k < 7; k++)
    put(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 0.10), m.steel),
      gateX - half + 0.3 + k * (carW - 0.6) / 6, y + 0.55, wallZ);
  [half - 1.4, half - 0.3].forEach(dx =>
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 1.0, 10), m.steel), gateX + dx, y + 0.5, wallZ));
  const approach = roadZ - wallZ;    // 门前引道：北墙 → 公共车行道南缘（局部 z，随 park Z 变换落到世界车道）
  put(new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.07, approach), m.road),
    gateX, y + 0.04, wallZ + approach / 2);
  for (let k = 0; k < 5; k++)        // 斑马线跨人行道（局部 z）
    put(new THREE.Mesh(new THREE.BoxGeometry(half * 1.6, 0.014, 0.16), m.line),
      gateX, y + 0.085, zebraZ0 + k * zebraStep);
  if (innerZ != null) {              // 纵向引道：北门 → 园区内部东西向主干路
    const len = wallZ - innerZ;
    put(new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.06, len), m.road),
      gateX, y + 0.035, innerZ + len / 2);
  }
}

// 排放点（浓水放流管末端 / 多端口扩散器中心）：本版向海更远（离海岸更远）以拉开辐射分支
const OUTFALL = { x: 33, y: 0.25, z: 33 };

// —— 标准集装箱外壳工厂 ——
// 每个工艺段装入一只标准集装箱模块：瓦楞侧板 + 波纹顶板 + 四角角件 + 端门 + 底架 + 箱号标牌。
// 沿用调用方的 w/h/d 与段中心 x（位置不变），因此完全不牵动取水流/浓水辐射/产品水分三路/
// 道路/厂门/嵌入模型等任何全局坐标。wallMat/roofMat 与 _buildings 的聚焦透视接口保持一致。
function makeContainer(s, groundY) {
  const g = new THREE.Group();
  g.position.set(s.x, 0, -1);
  const w = s.w, h = s.h, d = s.d;
  const steel = mat(0x9aa6b4, { metalness: 0.55, roughness: 0.4 });
  const wallMat = new THREE.MeshStandardMaterial({
    color: s.color, transparent: false, opacity: 1.0, depthWrite: true,
    metalness: 0.3, roughness: 0.55, side: THREE.DoubleSide
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x2b3646, transparent: false, opacity: 1.0, depthWrite: true, side: THREE.DoubleSide
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: s.color, transparent: true, opacity: 0.5 });
  const cy = groundY + h / 2;

  // 箱体主体（半透明可控）
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = cy; body.userData.segmentId = s.id; g.add(body);

  // 瓦楞侧板：集装箱长边两面（z=±d/2），沿 X 分布的竖向细条
  const NX = Math.max(18, Math.round(w / 0.5));
  const cw = w / NX;
  for (let i = 0; i < NX; i++) {
    const x = -w / 2 + cw / 2 + i * cw;
    for (const sz of [d / 2 + 0.02, -d / 2 - 0.02]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.55, h * 0.94, 0.06), wallMat);
      slat.position.set(x, cy, sz); slat.userData.segmentId = s.id; g.add(slat);
    }
  }
  // 波纹顶板：沿 X 分布的横向肋条
  const NR = Math.max(16, Math.round(w / 0.6));
  const rw = w / NR;
  for (let i = 0; i < NR; i++) {
    const x = -w / 2 + rw / 2 + i * rw;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.55, 0.07, d * 0.94), roofMat);
    rib.position.set(x, groundY + h + 0.05, 0); rib.userData.segmentId = s.id; g.add(rib);
  }
  // 四角角件（8 个）
  const corner = (sx, sz) => {
    for (const sy of [groundY + 0.2, groundY + h - 0.2]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.36), steel);
      c.position.set(sx, sy, sz); c.userData.segmentId = s.id; g.add(c);
    }
  };
  for (const sx of [-w / 2 + 0.18, w / 2 - 0.18])
    for (const sz of [-d / 2 + 0.18, d / 2 - 0.18]) corner(sx, sz);

  // 端门（正面 +Z）：门框 + 双开页 + 把手
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, h * 0.84, 0.1), steel);
  doorFrame.position.set(0, cy, d / 2 + 0.07); doorFrame.userData.segmentId = s.id; g.add(doorFrame);
  const leafMat = mat(0x6b7787, { metalness: 0.4, roughness: 0.5 });
  for (const dx of [-w * 0.15, w * 0.15]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, h * 0.8, 0.06), leafMat);
    leaf.position.set(dx, cy, d / 2 + 0.12); leaf.userData.segmentId = s.id; g.add(leaf);
  }
  for (const dx of [-w * 0.03, w * 0.03]) {
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), steel);
    hd.position.set(dx, cy, d / 2 + 0.16); hd.userData.segmentId = s.id; g.add(hd);
  }

  // 底架：两侧纵梁 + 横梁（工字感）
  for (const sz of [-d / 2 + 0.22, d / 2 - 0.22]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.2, 0.2), steel);
    beam.position.set(0, groundY + 0.11, sz); beam.userData.segmentId = s.id; g.add(beam);
  }
  for (let i = 1; i < 8; i++) {
    const x = -w / 2 + (w / 8) * i;
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, d * 0.88), steel);
    cross.position.set(x, groundY + 0.11, 0); cross.userData.segmentId = s.id; g.add(cross);
  }

  // 轮廓线框：透明状态下仍清晰标识集装箱边界
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), edgeMat);
  edges.position.copy(body.position); g.add(edges);

  // 段标牌（不透明，便于识别）
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 0.08), mat(0x14263c, { emissive: 0x0b2b47, emissiveIntensity: 0.5 }));
  plate.position.set(0, groundY + h - 0.5, d / 2 + 0.08); plate.userData.segmentId = s.id; g.add(plate);

  // 收集所有带 segmentId 的网格作为 raycaster 拾取目标（整只集装箱均可点击聚焦）
  const pick = [];
  g.traverse(o => { if (o.isMesh && o.userData.segmentId === s.id) pick.push(o); });

  return { group: g, wallMat, roofMat, edgeMat, pick };
}

export class PlantSceneSegment extends SegmentBase {
  constructor() {
    super({
      id: 'plant', name: '厂区全景', subtitle: 'Coastal SWRO Plant · Integrated Site View',
      description: '唯一主场景：海水、海岸防波堤、后方山地、七只集装箱工艺舱（默认不透明，内部嵌入对应工艺段的精细 3D 模型与流程）、全流程总览展馆、厂区道路管廊与公用设施、东侧外部用水工厂及产品水外输主管线。全景时集装箱为实心；点击集装箱或左侧工艺段按钮后才产生交互，集装箱变透明、露出内部设备与物料流程并平滑飞近，无需切换界面；点回「厂区全景」恢复不透明。',
      params: [
        { k: '厂区占地', v: '约 10–20 ha（Perth 10 ha / JICA 案例 20 ha）' },
        { k: '工艺流程排布', v: '取水 → 预处理 → UF/MF → 高压泵+ERD → RO → 后处理 → 排放（沿 +X）' },
        { k: '界面模式', v: '单一场景 · 点击集装箱/按钮聚焦；全流程总览与七段模型全部融入' },
        { k: '集装箱可视性', v: '默认不透明（实心）；点击总览或任一工艺段后进入透视模式，集装箱变透明展示内部模型' },
        { k: '集装箱化', v: '七段工艺段各装于一只标准集装箱模块（瓦楞侧板/波纹顶板/四角角件/端门/底架/箱号标牌），箱体高度收紧以体现「压缩进集装箱」的集成紧凑感' },
        { k: '功能分区', v: '预处理区 / 膜法淡化区 / 成品水储罐区 / 厂前区（舟山四分区口径）' },
        { k: '厂区道路', v: '主路 + 支路，实厂 4–6 m；服务道路预留约 50 m（JICA）' },
        { k: '绿化率', v: '≈20%（舟山环评），道路两侧与建筑周边绿化带' },
        { k: '取水管', v: 'Sorek：3 × Ø1.8 m × 1.25 km；Perth：离岸 200 m 开式取水' },
        { k: '产品水外输', v: '清水池 → 加压计量泵站 → 外输主管线 → 外部用水工厂（工业园区）' },
        { k: '两厂相对位置与边界', v: '前排/后排 Z 向两排：前排市政水厂 x=52–74（宽22，世界 z≈-4.2~3.0，靠北侧公共走廊）｜后排外部用水工厂 x=52–150（宽98，世界 z≈-46~-22，紧靠山体）；两厂 X 同界、Z 向分离，中间横向绿化隔离带 z∈[-22,-4.2]（宽约18m）；各自独立围墙与出入口' },
        { k: '外部工厂扩地', v: '由 x=76–118（宽42×深24=1008）扩为后排 x=52–150（宽98×深24≈2352，向山体扩展进深翻倍），面宽 +133%、净用地面积 +133%；东侧新增 4 栋厂房填充，新增用地不空置' },
        { k: '周边道路与出入口', v: '北侧公共走廊 z=6.4 车行 / z=4.0 人行，全部位于台地之外；前排市政水厂 x=63 洞宽6m、罐装厂 x=86 独立北门，后排外部用水工厂 x=101 洞宽8m（门朝北、引道随 Z 变换落地）；门柱/门卫/伸缩门/闸机/斑马线/门前引道齐全' },
        { k: '外部工业用户', v: '沧东电厂 70 余 km 主管线、沿途 30 余家企业（人民日报口径 77 家）' },
        { k: '浓水排放', v: '离岸约 500 m、40 喷口多端口扩散器、设计稀释 45:1（Perth/IDA）' },
        { k: '浓水辐射分支', v: '以排放点为中心 12 条半透明支管每 30° 向四周展开，中心 hub/分配环明确与主管连接' },
        { k: '市政供水', v: '产品水分水点 → 独立架空青色支线 → 市政水厂；与工业外输主管分色、分高程、分走向' },
        { k: '产品水分三路', v: '清水池→x45 三通分流：① 工业外输沿 z=-6 落地至 x=74 后折向南埋地（管顶低于台地顶）延伸至后排 EXT（z=-40）；② 市政支线 y=2.6 沿 z=1.0 进前排市政水厂；③ 罐装支线 y=2.8 沿 z=-1.0 东延至 x=86 前排罐装厂；三路分色、分高程、分走向' },
        { k: '厂门与路网', v: '主路+并行人行道人车分流、6 支路+后侧联络路+七段门前支路；东侧开放式厂门（门卫室/伸缩门/人行通道）' },
        { k: '全景层显隐', v: '仅显示水域/山地/排水/总览/各工艺段/外部工厂/产品水外输等大类要素；集装箱内部设备聚焦该段时才显示' }
      ],
      sources: ['S56', 'S57', 'S58', 'S59', 'S60', 'S61', 'S62', 'S63', 'S64', 'S65'],
      fog: { near: 180, far: 780 },
      // 取景右移并拉远：容纳并列后的市政水厂 + 扩地后的外部用水工厂 + 罐装厂（延伸至 x≈160）及更深远的海域/山地；
      // 方向 dir 不变，故各工艺段顺序、流程与聚焦动画的方位角逻辑均保持不变。
      view: { target: [52, 4, 4], dir: [0.72, 0.82, 1.42], dist: 158, far: 1200 }
    });
    this.wave = null;
    this._m = {};
    this.halls = {};      // id -> { wallMat, roofMat, edgeMat, group, pick[] }
    this.embedded = {};   // id -> SegmentBase 实例
    this.focused = null;
    this.labels = [];     // 标注 Sprite：随相机距离/方位联动缩放与旋转
    this.ballFlows = [];  // 取水 / 外排管道的小球流（按折线精确插值）
    this.outletFlows = [];// 扩散器 20 个出口各自的独立小球流
    this.radialFlows = [];// 排放点辐射状分支的球流
    this.features = {};       // 各工艺段厂房前设备细节（全景层隐藏，聚焦该段时显示）
    this.embeddedGroups = {}; // 八段精细模型 Group（全景层隐藏，聚焦该段时显示）
  }

  // --------------------------------------------------------------------------
  build() {
    this._materials();
    this._sea();
    this._coast();
    this._mountains();
    this._siteGround();
    this._roadsAndFence();
    this._pipeRack();
    this._buildings();       // 半透明厂房（可点击、可透视）
    this._utilities();
    this._overviewHall();    // 全流程总览透明展馆
    this._externalPlant();   // 外部用水工厂 + 产品水外输主管线
    this._municipalPlant();  // 新增：市政水厂 + 产品水市政支线
    this._bottledPlant();   // 新增：罐装饮用水厂房 + 产品水第三路
    this._marineWorks();
    this._brineOutfall();    // 浓盐水排放主管（集管 → 穿堤 → 海底放流管 → 扩散器）
    this._radialOutfall();   // 新增：以排放点为中心的辐射状分支管路
    this._embeddedSegments();// 八段精细模型嵌入厂房/展馆
    this._flows();
    this._pipeBallFlows();   // 取水 / 外排管道半透明水流示意（含 20 个出口）
    this._labels();
    this.resetView();        // 设定默认透明度与流速
  }

  _materials() {
    this._m = {
      sea:    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.88, roughness: 0.42, metalness: 0.04, side: THREE.DoubleSide }),
      foam:   mat(0xdff1ff, { transparent: true, opacity: 0.7, emissive: 0x2b6a9c, emissiveIntensity: 0.25 }),
      sand:   mat(0xc9b98a, { roughness: 0.95 }), rock: mat(0x6e7682, { roughness: 0.92 }),
      site:   mat(0x39424e, { roughness: 0.95 }), lawn: mat(0x3f6b46, { roughness: 0.95 }),
      road:   mat(0x2a303a, { roughness: 0.9 }), line: mat(0xd9c98a, { roughness: 0.8 }),
      wall:   mat(0x8d99a8, { roughness: 0.7 }), roof: mat(0x2b3646, { metalness: 0.35, roughness: 0.65 }),
      glass:  mat(0x8fd0e8, { metalness: 0.5, roughness: 0.25, emissive: 0x123a52, emissiveIntensity: 0.35 }),
      steel:  steelMat(COLORS.steel), pipe1: steelMat(COLORS.raw), pipe2: steelMat(COLORS.pretreated),
      pipe3:  steelMat(COLORS.permeate), brine: steelMat(COLORS.brine), tank: mat(0xaebacb, { metalness: 0.45, roughness: 0.45 }),
      trunk:  mat(0x5b4632, { roughness: 0.95 }), leaf: mat(0x2f6b40, { roughness: 0.95 }),
      leaf2:  mat(0x3d7d4c, { roughness: 0.95 }), light: mat(0xffe6a8, { emissive: 0xffc65a, emissiveIntensity: 0.9 }),
      car:    mat(0x9fb4c9, { metalness: 0.4, roughness: 0.5 }),
      water:  new THREE.MeshStandardMaterial({ color: 0x39a7d8, transparent: true, opacity: 0.72, roughness: 0.12, metalness: 0.05 }),
      warm:   mat(0xb9a68c, { roughness: 0.82 }), warmRoof: mat(0x5a5148, { metalness: 0.3, roughness: 0.7 }),
      red:    mat(0xb4553f, { roughness: 0.75 }),
      steam:  new THREE.MeshStandardMaterial({ color: 0xdfeaf2, transparent: true, opacity: 0.30, roughness: 1 }),
      // 浓盐水排放管道：陆上 GRP（DN1600 示意）/ 海底 HDPE / 厂内高压侧超级双相钢
      brineGRP: mat(0xb9703f, { roughness: 0.72, metalness: 0.10 }),
      brineHDPE: mat(0x3c4550, { roughness: 0.88 }),
      plume: new THREE.MeshStandardMaterial({ color: 0xff8a4c, transparent: true, opacity: 0.16, roughness: 1, depthWrite: false }),
      // 取水 / 外排管道专用半透明材质（独立创建，不改 _m.pipe1 / _m.brine 等共享材质）
      // 取水侧海面同为蓝色，管壁提亮并加深不透明度以保住圆柱边界；
      // 管内水流小球另用亮青白，与浅蓝亮芯形成高对比
      intakeGlass:       glass(0x3f97ea, 0.50, 0.34),
      brineGlassDuplex:  glass(0xd08046, 0.38),
      brineGlassGRP:     glass(0xb9703f, 0.38),
      brineGlassHDPE:    glass(0x5b6674, 0.40),
      diffuserGlass:     glass(0xd08046, 0.36),
      // 本轮新增：取水端点标识 / 辐射分支 / 市政支线 / 门区铺装 / 岸线与水面层次
      endCap: new THREE.MeshStandardMaterial({
        color: 0xdff4ff, emissive: 0x9fe8ff, emissiveIntensity: 0.9, roughness: 0.30
      }),
      brineGlassBranch:  glass(0xc87540, 0.42, 0.28),
      branchHub: new THREE.MeshStandardMaterial({
        color: 0xffa96a, emissive: 0xff7a3c, emissiveIntensity: 0.55, roughness: 0.40
      }),
      muniPipe:  steelMat(0x4fd8e8),
      muniHall:  mat(0x8fb8c8, { roughness: 0.78 }),
      muniRoof:  mat(0x37627a, { metalness: 0.25, roughness: 0.7 }),
      walk:      mat(0x6b7885, { roughness: 0.92 }),
      wetSand:   mat(0xa89a72, { roughness: 0.98 }),
      reef:      mat(0x59636b, { roughness: 0.95 }),
      seaBand: new THREE.MeshStandardMaterial({
        color: 0x49b6cf, transparent: true, opacity: 0.32, roughness: 0.30, depthWrite: false
      }),
      foam2: new THREE.MeshStandardMaterial({
        color: 0xe6f6ff, transparent: true, opacity: 0.45, roughness: 0.6,
        emissive: 0x2b6a9c, emissiveIntensity: 0.18, depthWrite: false
      })
    };
  }

  /**
   * 半透明管道构造：管壁半透明（可透视内部水流）+ 沿轴心的高亮细芯（路径清晰）
   * + 端点/转折点实色接头球（转折与分支位置边界清晰）。几何走向与原管道完全一致。
   */
  _glassPipe(points, radius, glassMat, glowColor, parent) {
    const wall = makePipeRun(points, radius, glassMat);
    wall.traverse(o => { if (o.isMesh) o.userData.noShadow = true; });
    parent.add(wall);

    const coreMat = new THREE.MeshStandardMaterial({
      color: glowColor, emissive: glowColor, emissiveIntensity: 0.55,
      roughness: 0.30, metalness: 0.05
    });
    const core = makePipeRun(points, Math.max(0.030, radius * 0.11), coreMat);
    core.traverse(o => { if (o.isMesh) o.userData.noShadow = true; });
    parent.add(core);

    const jointGeo = new THREE.SphereGeometry(radius * 0.48, 10, 8);
    points.forEach(p => {
      const j = new THREE.Mesh(jointGeo, coreMat);
      j.position.copy(p);
      j.userData.noShadow = true;
      parent.add(j);
    });
    return wall;
  }

  // —— 1. 海水（更大覆盖 + 三段色标 + 多频波浪 + 近岸浅滩带）——
  _sea() {
    const w = 330, d = SITE.seaFrontZ - SITE.coastZ;   // 东延覆盖罐装厂以东，避免背景空洞
    const geo = new THREE.PlaneGeometry(w, d, 150, 72);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [], base = [];
    const cNear = new THREE.Color(0x49b9d8), cMid = new THREE.Color(0x1d6ea8), cFar = new THREE.Color(0x082c56);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      base.push(x, z);
      const u = THREE.MathUtils.clamp((z + d / 2) / d, 0, 1);
      const c = u < 0.42 ? cNear.clone().lerp(cMid, u / 0.42)
                         : cMid.clone().lerp(cFar, (u - 0.42) / 0.58);
      // 横向缓变明暗，形成水下浅滩 / 深浅带层次
      c.multiplyScalar(0.94 + 0.06 * Math.sin(x * 0.09 + z * 0.05));
      colors.push(c.r, c.g, c.b);
      pos.setY(i, 0);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sea = new THREE.Mesh(geo, this._m.sea);
    sea.position.set(0, SITE.seaY, SITE.coastZ + d / 2);
    sea.renderOrder = 1; sea.userData.noShadow = true;
    this.addMesh(sea);
    this.wave = { geo, base, pos };

    // 近岸浅滩色带：半透明青绿，强化「岸 → 浅滩 → 近海 → 远海」的第一层水深过渡
    const shoal = new THREE.Mesh(new THREE.PlaneGeometry(w, 7.5), this._m.seaBand);
    shoal.rotation.x = -Math.PI / 2;
    shoal.position.set(0, SITE.seaY + 0.018, SITE.coastZ + 3.6);
    shoal.renderOrder = 2; shoal.userData.noShadow = true;
    this.addMesh(shoal);
    // 远海次水深带：更外侧的青蓝色过渡，丰富「岸 → 浅滩 → 近海 → 远海」层次（模型细化）
    const shoal2 = new THREE.Mesh(new THREE.PlaneGeometry(w, 16), this._m.seaBand);
    shoal2.rotation.x = -Math.PI / 2;
    shoal2.position.set(0, SITE.seaY + 0.012, SITE.coastZ + 30);
    shoal2.renderOrder = 2; shoal2.userData.noShadow = true;
    this.addMesh(shoal2);

    const bed = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(0x0e3a63, { roughness: 1 }));
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(0, -0.42, SITE.coastZ + d / 2);
    bed.userData.noShadow = true;
    this.addMesh(bed);
  }

  // —— 2. 海岸：干/湿滩双层、多道浪花、近岸礁石、防波堤与消波块 ——
  _coast() {
    // 干滩（浅色）+ 潮间带湿滩（深色、略低），构成岸线高差与色带层次
    const dry = new THREE.Mesh(new THREE.BoxGeometry(330, 0.22, 5.2), this._m.sand);
    dry.position.set(0, 0.24, SITE.coastZ - 0.8); dry.rotation.x = -0.055;
    this.addMesh(dry);
    const wet = new THREE.Mesh(new THREE.BoxGeometry(330, 0.08, 2.6), this._m.wetSand);
    wet.position.set(0, 0.20, SITE.coastZ + 1.7); wet.rotation.x = -0.04;
    this.addMesh(wet);
    // 6 道浪花线：由近及远逐渐变短变淡，表达潮线推进
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(178 - i * 6, 0.032, 0.26 - i * 0.02),
        i % 2 ? this._m.foam2 : this._m.foam);
      f.position.set(0, SITE.seaY + 0.05 + i * 0.004, SITE.coastZ + 1.0 + i * 1.85);
      this.addMesh(f);
    }
    // 近岸礁石群：随机出露于浅水，丰富岸线细节
    const rr = rng(9182);
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 0), this._m.reef, 42);
    const rd = new THREE.Object3D();
    for (let i = 0; i < 42; i++) {
      const x = -84 + rr() * 168, z = SITE.coastZ + 1.2 + rr() * 9, s = 0.5 + rr() * 1.3;
      rd.position.set(x, 0.10 + 0.16 * s, z);
      rd.rotation.set(rr() * 3, rr() * 3, rr() * 3);
      rd.scale.set(s, s * 0.6, s);
      rd.updateMatrix(); rocks.setMatrixAt(i, rd.matrix);
    }
    rocks.instanceMatrix.needsUpdate = true; rocks.userData.noShadow = true;
    this.addMesh(rocks);
    const bw = new THREE.Mesh(new THREE.BoxGeometry(62, 0.9, 1.7), this._m.rock);
    bw.position.set(-14, 0.42, SITE.coastZ + 7); bw.userData.noShadow = true; this.addMesh(bw);
    const bw2 = new THREE.Mesh(new THREE.BoxGeometry(42, 0.9, 1.7), this._m.rock);
    bw2.position.set(32, 0.42, SITE.coastZ + 8.5); bw2.rotation.y = 0.18; bw2.userData.noShadow = true; this.addMesh(bw2);
    const r = rng(20261106);
    const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.55, 0), this._m.rock, 140);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 140; i++) {
      const left = i < 78;
      dummy.position.set(left ? -45 + r() * 62 : 12 + r() * 42, 0.75 + r() * 0.35,
        (left ? SITE.coastZ + 7 : SITE.coastZ + 8.5) + (r() - 0.5) * 2.4);
      dummy.rotation.set(r() * 3, r() * 3, r() * 3);
      dummy.scale.setScalar(0.7 + r() * 0.6);
      dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true; inst.userData.noShadow = true;
    this.addMesh(inst);
  }

  // —— 3. 周围山地（更大覆盖 + 多峰/山脊 + 高度分级着色 + 更密林带）——
  _mountains() {
    const w = 330, d = 90, zOff = -55;                 // 与海面同步东延
    const geo = new THREE.PlaneGeometry(w, d, 124, 60);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = [];
    const c0 = new THREE.Color(0x345a3d), c1 = new THREE.Color(0x5c6b46);
    const c2 = new THREE.Color(0x7d755c), c3 = new THREE.Color(0xa9a496);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), wz = pos.getZ(i) + zOff, h = terrainHeight(x, wz);
      pos.setY(i, h);
      let c = h < 4 ? c0.clone().lerp(c1, h / 4)
        : h < 11 ? c1.clone().lerp(c2, (h - 4) / 7)
        : c2.clone().lerp(c3, Math.min(1, (h - 11) / 9));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mountain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02, side: THREE.DoubleSide }));
    mountain.position.z = zOff; mountain.userData.noShadow = true;
    this.addMesh(mountain);

    const r = rng(77123), N = 280;
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.16, 0.9, 6), this._m.trunk, N);
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(0.72, 1.9, 7), this._m.leaf, N);
    const dummy = new THREE.Object3D();
    let placed = 0, guard = 0;
    while (placed < N && guard < 9000) {
      guard++;
      const x = (r() - 0.5) * 210, z = -16 - r() * 84;
      const h = terrainHeight(x, z);
      if (h < 0.6 || h > 13) continue;
      const s = 0.75 + r() * 0.8;
      dummy.position.set(x, h + 0.45 * s, z); dummy.rotation.set(0, r() * 6.28, 0);
      dummy.scale.setScalar(s); dummy.updateMatrix(); trunk.setMatrixAt(placed, dummy.matrix);
      dummy.position.y = h + 1.85 * s; dummy.updateMatrix(); crown.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    trunk.count = crown.count = placed;
    trunk.instanceMatrix.needsUpdate = crown.instanceMatrix.needsUpdate = true;
    trunk.userData.noShadow = crown.userData.noShadow = true;
    this.addMesh(trunk); this.addMesh(crown);

    // 山体裸岩点缀：低矮岩石散布于山坡中下段，增加地形细节与层次（模型细化）
    const rk = rng(55120), NR = 64;
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), mat(0x6b6356, { roughness: 1 }), NR);
    const rd2 = new THREE.Object3D();
    let rkPlaced = 0;
    for (let i = 0; i < NR; i++) {
      const x = (rk() - 0.5) * 210, z = -16 - rk() * 84, h = terrainHeight(x, z);
      if (h < 1.5 || h > 14) continue;
      const s = 0.6 + rk() * 1.0;
      rd2.position.set(x, h + 0.2 * s, z);
      rd2.rotation.set(rk() * 3, rk() * 3, rk() * 3);
      rd2.scale.setScalar(s); rd2.updateMatrix(); rocks.setMatrixAt(rkPlaced++, rd2.matrix);
    }
    rocks.count = rkPlaced;
    rocks.instanceMatrix.needsUpdate = true; rocks.userData.noShadow = true;
    this.addMesh(rocks);
  }

  _siteGround() {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2 * SITE.halfX, SITE.groundY, SITE.siteFrontZ - SITE.siteBackZ), this._m.site);
    base.position.set(0, SITE.groundY / 2, (SITE.siteFrontZ + SITE.siteBackZ) / 2);
    this.addMesh(base);
    // 东侧公共场地（前/后排两排）：前排台地 z∈[-4.2,3]（MUNI / 罐装）、后排台地 z∈[-46,-22]（EXT，紧靠山体）、
    // 中间横向绿化隔离带 z∈[-22,-4.2]（宽约 18 m）独立降标高成草坪，使前后两排在几何与视觉上都被清晰分隔。
    const eastSeg = (z0, z1, m, h) => {
      const g = new THREE.Mesh(new THREE.BoxGeometry(120, h, z1 - z0), m);
      g.position.set(105, h / 2, (z0 + z1) / 2);
      this.addMesh(g);
    };
    eastSeg(-4.2, 3.0, this._m.site, SITE.groundY);          // 前排（MUNI / 罐装）公共场地 x∈[45,165]
    eastSeg(-46, -22, this._m.site, SITE.groundY);           // 后排（EXT）公共场地（向山体扩展至 -46）
    eastSeg(-22, -4.2, this._m.lawn, SITE.groundY - 0.15);   // 横向绿化隔离带（降标高，宽约 18 m）
    // 北侧公共道路路堤：独立承载车行 z=6.4 与人行 z=4.0，不属于任何厂区台地红线。
    const bank = new THREE.Mesh(new THREE.BoxGeometry(117, SITE.groundY, 5.6), this._m.site);
    bank.position.set(103.5, SITE.groundY / 2, 5.9);   // z∈[3.1,8.7]
    this.addMesh(bank);
    [[-20, 2.2, 3.2, -9.5], [8, 2, 3, -9.5], [36, 6.5, 3, -9.5],
     [-38, 7.5, 2.4, 9.2], [4, 9, 2.2, 9.2], [30, 7, 2.2, 9.2]].forEach(([x, w, d, z]) => {
      const g = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), this._m.lawn);
      g.position.set(x, SITE.groundY + 0.035, z); this.addMesh(g);
    });
  }

  // 路网：主路（车行 z=6.4）+ 并行人行道（z=4.0）+ 6 条纵向支路 +
  //       后侧横向联络路（z=-9.6）+ 七段门前短支路；东侧设开放式厂门。
  _roadsAndFence() {
    const put = (w, h, d, x, y, z, m) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z); this.addMesh(o); return o;
    };
    // ① 主路（车行）+ 中心线
    put(2 * SITE.halfX - 4, 0.07, 3.4, 0, SITE.groundY + 0.04, 6.4, this._m.road);
    for (let x = -42; x < 42; x += 4) {
      put(1.8, 0.012, 0.09, x, SITE.groundY + 0.082, 6.4, this._m.line);
    }
    // ② 并行人行道（与车行道分离，人车分流）
    put(2 * SITE.halfX - 4, 0.06, 1.0, 0, SITE.groundY + 0.035, 4.0, this._m.walk);
    // ③ 纵向支路：位于厂房间隙，前后贯通
    for (const x of [-27.5, -16.5, -5.5, 5.5, 16.5, 27.5]) {
      put(2.2, 0.06, 17, x, SITE.groundY + 0.038, -1, this._m.road);
    }
    // ④ 后侧横向联络路：把 6 条支路末端连成环，各工艺段均可从前后双向到达
    put(2 * SITE.halfX - 6, 0.06, 1.8, 0, SITE.groundY + 0.032, -9.6, this._m.road);
    // ⑤ 七段门前短支路：正对每栋厂房，从人行道直达段入口
    PLANT_SEGMENTS.forEach(s => put(2.0, 0.055, 2.2, s.x, SITE.groundY + 0.03, 3.4, this._m.road));

    // ⑥ 围墙：前 / 后 / 西完整；东侧开 z∈[2.6, 9.0] 缺口作为开放式厂门
    const mk = (w, d, x, z, h) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._m.wall);
      f.position.set(x, SITE.groundY + h / 2, z); this.addMesh(f);
    };
    mk(2 * SITE.halfX, 0.22, 0, SITE.siteFrontZ - 0.4, 0.75);
    mk(2 * SITE.halfX, 0.28, 0, SITE.siteBackZ + 0.3, 1.1);
    mk(0.28, SITE.siteFrontZ - SITE.siteBackZ, -SITE.halfX + 0.3, -1, 1.1);
    mk(0.28, 15.6, SITE.halfX - 0.3, -5.2, 1.1);   // 东墙南段 z∈[-13, 2.6]
    mk(0.28, 2.0, SITE.halfX - 0.3, 10.0, 1.1);    // 东墙北段 z∈[9, 11]

    // ⑦ 开放式厂门：门柱 / 门卫室 / 伸缩门（车行）/ 人行通道（含斑马线与闸机）
    const gx = SITE.halfX - 0.3;
    [2.6, 9.0].forEach(z => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 2.6, 12), this._m.wall);
      p.position.set(gx, SITE.groundY + 1.3, z); this.addMesh(p);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this._m.light);
      cap.position.set(gx, SITE.groundY + 2.7, z); this.addMesh(cap);
    });
    // 门卫室（缺口北侧，俯瞰车行与人行两区）
    const guard = new THREE.Group(); guard.position.set(41.8, 0, 9.9);
    const gh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.2), mat(0x9aa9bb));
    gh.position.y = SITE.groundY + 1.1; guard.add(gh);
    const gr = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.2, 2.5), this._m.roof);
    gr.position.y = SITE.groundY + 2.3; guard.add(gr);
    const gw = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.06), this._m.glass);
    gw.position.set(0, SITE.groundY + 1.35, -1.14); guard.add(gw);
    this.addMesh(guard);
    // 伸缩门：车行区 z∈[4.7, 8.1]，栅栏竖条 + 底轨 + 端部机箱（半开，表达可伸缩）
    put(0.16, 0.06, 3.5, gx, SITE.groundY + 0.03, 6.4, this._m.steel);
    for (let k = 0; k < 9; k++) {
      put(0.12, 1.05, 0.10, gx, SITE.groundY + 0.55, 4.8 + k * 0.40, this._m.steel);
    }
    put(0.18, 0.08, 3.5, gx, SITE.groundY + 1.06, 6.4, this._m.steel);
    put(0.7, 0.9, 0.7, 43.6, SITE.groundY + 0.45, 8.35, mat(0x8d9aa9));
    // 人行通道：z=3.5 铺装，从围墙内外连通；斑马线 + 双侧闸机柱
    put(7.6, 0.07, 1.3, 46.5, SITE.groundY + 0.042, 3.5, this._m.walk);
    const zebra = mat(0xf0f4f8, { roughness: 0.9 });
    for (let k = 0; k < 5; k++) put(0.38, 0.014, 0.9, 44.7 + k * 0.62, SITE.groundY + 0.085, 3.5, zebra);
    [2.9, 4.1].forEach(z => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 1.0, 10), this._m.steel);
      b.position.set(45.2, SITE.groundY + 0.5, z); this.addMesh(b);
    });
    // 进场引道：车行 / 人行分别向东延伸，接东侧园区道路
    put(7.6, 0.07, 3.4, 46.5, SITE.groundY + 0.04, 6.4, this._m.road);

    // 东侧园区公共联络走廊（S1 会签版）：位于两园台地北侧之外，不压占任何厂区占地。
    // 车行 z=6.4（z∈[4.7,8.1]）、人行 z=4.0（z∈[3.5,4.5]）；两园台地前缘统一退到 z=3.0。
    // x∈[43,160] 贯通「主厂区东门 → 市政水厂 → 外部用水工厂 → 罐装厂」，各厂以独立北门 + 引道接入。
    put(117, 0.07, 3.4, 101.5, SITE.groundY + 0.04, 6.4, this._m.road);
    for (let x = 45; x < 158; x += 4) {
      put(1.8, 0.012, 0.09, x, SITE.groundY + 0.082, 6.4, this._m.line);
    }
    put(117, 0.06, 1.0, 101.5, SITE.groundY + 0.035, 4.0, this._m.walk);

    // ⑧ 路灯与停车（位置沿用原布局，不遮挡新增门区）
    for (let x = -40; x <= 156; x += 8) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 2.2, 8), this._m.steel);
      pole.position.set(x, SITE.groundY + 1.1, 8.4);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), this._m.light);
      head.position.set(x, SITE.groundY + 2.25, 8.4);
      this.addMesh(pole); this.addMesh(head);
    }
    const r = rng(4501);
    const cars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.34, 1.0), this._m.car, 16);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 16; i++) {
      dummy.position.set(-42 + (i % 8) * 1.15, SITE.groundY + 0.22, 8.6 + Math.floor(i / 8) * 1.5);
      dummy.rotation.set(0, r() > 0.5 ? 0 : Math.PI, 0);
      dummy.updateMatrix(); cars.setMatrixAt(i, dummy.matrix);
    }
    cars.instanceMatrix.needsUpdate = true; this.addMesh(cars);
  }

  _pipeRack() {
    const z = -6.2, y = 1.75;
    [{ c: this._m.pipe1, off: -0.55, r: 0.16 }, { c: this._m.pipe2, off: 0, r: 0.14 },
     { c: this._m.pipe3, off: 0.55, r: 0.12 }].forEach(p => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 84, 12), p.c);
      pipe.rotation.z = Math.PI / 2; pipe.position.set(0, y, z + p.off); this.addMesh(pipe);
    });
    for (let x = -40; x <= 40; x += 5) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.16, y - SITE.groundY, 1.8), this._m.steel);
      frame.position.set(x, (y + SITE.groundY) / 2, z);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.0), this._m.steel);
      cross.position.set(x, y - 0.2, z);
      this.addMesh(frame); this.addMesh(cross);
    }
  }

  // —— 4. 集装箱式工艺舱（可点击、可透视内部精细模型）——
  _buildings() {
    PLANT_SEGMENTS.forEach(s => {
      // 每个工艺段装入一只标准集装箱模块（瓦楞侧板/波纹顶板/四角角件/端门/底架/箱号标牌）
      const c = makeContainer(s, SITE.groundY);
      this.addMesh(c.group);
      this.halls[s.id] = {
        group: c.group, wallMat: c.wallMat, roofMat: c.roofMat, edgeMat: c.edgeMat,
        pick: c.pick
      };
      this._feature(s);
    });
  }

  _feature(s) {
    // 厂房前的设备细节统一装进一个 Group：全景总览层隐藏，聚焦该段时才显示，
    // 与既有「点击 → 透视 → 展示内部设备流程」的交互保持一致。
    const fg = new THREE.Group();
    fg.userData.inner = true;
    const zFront = 3.4, zBack = -9.2;
    const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); fg.add(mesh); return mesh; };
    const put = mesh => { fg.add(mesh); return mesh; };
    switch (s.feature) {
      case 'intake': {
        const pit = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 3.0), mat(0x5a6878));
        add(pit, s.x, SITE.groundY + 0.55, zFront);
        const pool = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 2.4), this._m.water);
        add(pool, s.x, SITE.groundY + 1.14, zFront);
        for (let k = 0; k < 5; k++) add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.2, 2.6), this._m.steel), s.x - 1.6 + k * 0.8, SITE.groundY + 1.05, zFront);
        break;
      }
      case 'clarifier':
        for (let k = 0; k < 3; k++) {
          const t = makeTank(1.5, 1.2, 0x8fa2b5); t.position.set(s.x - 3.4 + k * 3.4, SITE.groundY, zFront); put(t);
          const surf = new THREE.Mesh(new THREE.CircleGeometry(1.42, 28), this._m.water);
          surf.rotation.x = -Math.PI / 2; add(surf, s.x - 3.4 + k * 3.4, SITE.groundY + 1.24, zFront);
          const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.12), this._m.steel);
          arm.position.set(0, 1.4, 0);
          const gp = new THREE.Group(); gp.position.set(s.x - 3.4 + k * 3.4, SITE.groundY, zFront);
          gp.add(arm); put(gp); this.addRotor(arm, 'y', 0.8);
        }
        break;
      case 'ufskid':
        for (let k = 0; k < 6; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 2.5, 14), mat(0xd6e2ee, { metalness: 0.3 })),
          s.x - 3.6 + (k % 3) * 3.6, SITE.groundY + 1.25, zFront + Math.floor(k / 3) * 1.5);
        add(new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.18, 3.4), this._m.steel), s.x, SITE.groundY + 0.1, zFront + 0.75);
        break;
      case 'pxbank':
        for (let k = 0; k < 8; k++) {
          const px = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.0, 12), mat(0xc7d3df, { metalness: 0.45 }));
          px.rotation.z = Math.PI / 2;
          add(px, s.x - 3.5 + (k % 4) * 2.3, SITE.groundY + 0.8, zFront + Math.floor(k / 4) * 1.5);
        }
        for (let k = 0; k < 2; k++) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.5, 16), this._m.steel);
          p.rotation.z = Math.PI / 2; add(p, s.x - 2 + k * 4, SITE.groundY + 0.75, zBack + 1.2);
        }
        break;
      case 'rovessel':
        for (let row = 0; row < 2; row++) for (let k = 0; k < 6; k++) {
          const pv = makeVessel(2.0, 0.24, 0xc3cfdd);
          pv.position.set(s.x - 5 + k * 2, SITE.groundY + 1.1 + row * 0.75, zFront + row * 1.2);
          put(pv);
        }
        break;
      case 'clearwell':
        for (let k = 0; k < 2; k++) {
          const t = makeTank(2.0, 1.8, 0xa9bccd); t.position.set(s.x - 2.6 + k * 5.2, SITE.groundY, zFront); put(t);
          const surf = new THREE.Mesh(new THREE.CircleGeometry(1.92, 30), this._m.water);
          surf.rotation.x = -Math.PI / 2; add(surf, s.x - 2.6 + k * 5.2, SITE.groundY + 1.84, zFront);
        }
        add(makeTank(0.85, 2.2, 0x9fc9a8), s.x + 3.2, SITE.groundY, zBack + 1.0);
        break;
      case 'outfall':
        add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.0), mat(0x8a97a5)), s.x - 2.6, SITE.groundY + 0.9, zFront);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.6, 14), this._m.brine), s.x + 1.5, SITE.groundY + 1.3, zFront);
        break;
    }
    this.addMesh(fg);
    this.features[s.id] = fg;
  }

  // —— 5. 全流程总览透明展馆 ——
  _overviewHall() {
    const x = -38, z = -9.5, w = 14, d = 7, h = 3.2;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x6b8fc4, transparent: false, opacity: 1.0, depthWrite: true, side: THREE.DoubleSide
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x2b3646, transparent: false, opacity: 1.0, depthWrite: true, side: THREE.DoubleSide
    });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x8fb6ff, transparent: true, opacity: 0.5 });
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = SITE.groundY + h / 2; body.userData.segmentId = 'overview'; g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.2, d + 0.4), roofMat);
    roof.position.y = SITE.groundY + h + 0.1; roof.userData.segmentId = 'overview'; g.add(roof);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), edgeMat);
    edges.position.copy(body.position); g.add(edges);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.55, 0.08), mat(0x14263c, { emissive: 0x0b2b47, emissiveIntensity: 0.5 }));
    plate.position.set(0, SITE.groundY + h - 0.5, d / 2 + 0.06); plate.userData.segmentId = 'overview'; g.add(plate);
    this.addMesh(g);
    this.halls.overview = {
      group: g, wallMat, roofMat, edgeMat, pick: [body, roof, plate]
    };
  }

  // —— 6. 公用设施 ——
  _utilities() {
    const office = new THREE.Group(); office.position.set(-40, 0, -4.0);
    for (let k = 0; k < 3; k++) {
      const fl = new THREE.Mesh(new THREE.BoxGeometry(5 - k * 0.35, 1.5, 4 - k * 0.25), mat(0x9aa9bb));
      fl.position.y = SITE.groundY + 0.75 + k * 1.5; office.add(fl);
      const band = new THREE.Mesh(new THREE.BoxGeometry(4.6 - k * 0.35, 0.5, 0.06), this._m.glass);
      band.position.set(0, SITE.groundY + 0.9 + k * 1.5, (4 - k * 0.25) / 2 + 0.04); office.add(band);
    }
    this.addMesh(office);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 4.2, 8), this._m.steel);
    pole.position.set(-36.5, SITE.groundY + 2.1, -2.0); this.addMesh(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.03), mat(0x2e8fd6, { emissive: 0x114b78, emissiveIntensity: 0.4 }));
    flag.position.set(-36.0, SITE.groundY + 3.9, -2.0); this.addMesh(flag);

    const sub = new THREE.Group(); sub.position.set(40, 0, -8.5);
    const house = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.2, 3.2), mat(0x8d9aa9));
    house.position.y = SITE.groundY + 1.1; sub.add(house);
    for (let k = 0; k < 3; k++) {
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), this._m.steel);
      tr.position.set(-1.6 + k * 1.6, SITE.groundY + 0.6, 2.4); sub.add(tr);
    }
    this.addMesh(sub);
    for (let k = 0; k < 3; k++) {
      const t = makeTank(1.6, 2.8, 0xb7c4d3); t.position.set(27 + k * 4.2, SITE.groundY, -9.0); this.addMesh(t);
    }
    const r = rng(9137), N = 44;
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 0.8, 6), this._m.trunk, N);
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(0.58, 1.5, 7), this._m.leaf2, N);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      let x = -43 + r() * 86, z = r() > 0.5 ? 9.6 : -11.0, s = 0.7 + r() * 0.65;
      // 全流程总览展馆占地（x∈[-46,-30] 且 z<-6）内不种树，避免树木出现在厂房内部
      if (x > -46 && x < -30 && z < -6) s = 0;
      dummy.position.set(x, SITE.groundY + 0.4 * s, z);
      dummy.rotation.set(0, r() * 6.28, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
      dummy.position.y = SITE.groundY + 1.55 * s; dummy.updateMatrix(); crown.setMatrixAt(i, dummy.matrix);
    }
    trunk.instanceMatrix.needsUpdate = crown.instanceMatrix.needsUpdate = true;
    trunk.userData.noShadow = crown.userData.noShadow = true;
    this.addMesh(trunk); this.addMesh(crown);
  }

  // —— 7. 外部用水工厂（工业园区）+ 产品水外输主管线 ——
  // S1 会签版：与市政水厂并列于厂区东侧，中间 6 m 绿化隔离带；园区扩至 x=80–144（宽64），暖色厂房群。
  // 全部建筑/绿化以相对坐标写入 park 组，再由 park.position 整体定位，便于互换与复用。
  _externalPlant() {
    const cx = (EXT.x0 + EXT.x1) / 2, w = EXT.x1 - EXT.x0;
    const depth = PARK.depth, cz = PARK.cz;
    const park = new THREE.Group(); park.scale.z = BACK_S; park.position.set(cx, 0, BACK_Z0); this.group.add(park);
    const put = (mesh, x, y, z) => { mesh.position.set(x, y, z); markNoShadow(mesh); park.add(mesh); return mesh; };
    // 园区台地（与主厂区有绿化隔离带）
    put(new THREE.Mesh(new THREE.BoxGeometry(w, SITE.groundY, depth), mat(0x4a4740, { roughness: 0.95 })), 0, SITE.groundY / 2, cz);
    // 围墙：各自独立成区，不与市政水厂共墙；北墙中央留 8 m 主门洞，东墙留 4 m 消防次门洞。
    const fence = (bw, bd, x, z) => put(new THREE.Mesh(new THREE.BoxGeometry(bw, 0.9, bd), this._m.warm), x, SITE.groundY + 0.45, z);
    const gateHalf = 4, gateX = 0, wallZ = PARK.frontZ - 0.4;
    const seg = (w - 2 * gateHalf) / 2;
    fence(seg, 0.22, -(gateHalf + seg / 2), wallZ);
    fence(seg, 0.22,  (gateHalf + seg / 2), wallZ);
    // v2.4：旧南墙（world z≈-33.8）落在新旧台地接缝上，已删除；新南墙以 world 坐标在 z=-45.8 重建（见下方新增带）。
    fence(0.24, depth, -w / 2 + 0.3, cz);
    fence(0.24, 9, w / 2 - 0.3, -8.5);        // 东墙南段 z∈[-13,-4]
    fence(0.24, 3, w / 2 - 0.3, 1.5);         // 东墙北段 z∈[0,3]；z∈[-4,0] 为消防次门
    buildGate(put, this._m, { gateX, wallZ, half: gateHalf, innerZ: -6.0, tone: mat(0x9aa9bb),
      roadZ: 8.067, zebraZ0: 6.333, zebraStep: 0.2 / 0.75 });
    // 主生产厂房 A / B（暖色，与淡化厂冷色区分）
    const hall = (bw, bh, bd, x, z, tone) => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat(tone, { roughness: 0.8 }));
      b.position.y = SITE.groundY + bh / 2; g.add(b);
      const rf = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.4, 0.22, bd + 0.4), this._m.warmRoof);
      rf.position.y = SITE.groundY + bh + 0.11; g.add(rf);
      const win = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.8, 0.8, 0.07), this._m.glass);
      win.position.set(0, SITE.groundY + bh * 0.62, bd / 2 + 0.04); g.add(win);
      put(g, x, 0, z);
    };
    // 全部建筑避让北门纵向引道 |x|≤4，且 z 向落在台地 [-13,3] 内
    hall(10, 5.5, 7.5, -20, -0.8, 0xb9a68c);
    hall(7, 4.2, 6.0, 10, -1.0, 0xa89a86);
    hall(5, 3.0, 4.0, 10, -9.0, 0x9c8f7d);
    hall(6, 3.8, 5.5, 19, -1.0, 0xb0a088);
    hall(5, 3.2, 4.5, 19, -9.0, 0x9c8f7d);
    // 扩地后新增填充厂房：EXT 宽 42→64，东侧新增用地不空置
    hall(6, 4.0, 6.0, 27, -1.0, 0xb9a68c);
    hall(5, 3.4, 4.5, 27, -9.0, 0xa89a86);
    // 本轮再扩地（64→98，沿 X 向东）新增东侧填充厂房，新增用地不空置
    hall(6, 4.0, 6.0, 35, -1.0, 0xb9a68c);
    hall(5, 3.4, 4.5, 35, -9.0, 0xa89a86);
    hall(6, 3.6, 5.0, 43, -1.0, 0xb0a088);
    hall(5, 3.2, 4.0, 43, -9.0, 0x9c8f7d);
    // 两座冷却塔 + 蒸汽：退入台地内、避让北门纵向引道 |x|≤4
    for (let k = 0; k < 2; k++) {
      put(new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.9, 3.2, 16, 1, true), mat(0xc8bda9, { side: THREE.DoubleSide })),
        -13 + k * 3.2, SITE.groundY + 1.6, -1.0);
      put(new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.0, 12), this._m.steam),
        -13 + k * 3.2, SITE.groundY + 4.1, -1.0);
    }
    // 烟囱 + 红白环
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.55, 8, 12), mat(0xcdbda4)), -7, SITE.groundY + 4, -9);
    for (let k = 0; k < 3; k++) put(new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.45, 12), this._m.red), -7, SITE.groundY + 2 + k * 2.2, -9);
    // 原料/成品储罐（西侧装置区，z 向避开内部主干路）
    for (let k = 0; k < 3; k++) {
      const t = makeTank(1.3, 2.4, 0xc0b39c);
      t.position.set(-26 + k * 3.6, SITE.groundY, -9.5); markNoShadow(t); park.add(t);
    }
    // 园区内部东西向主干路（z=-6.0），由北门纵向引道接入
    put(new THREE.Mesh(new THREE.BoxGeometry(w - 3, 0.06, 2.6), this._m.road), 0, SITE.groundY + 0.04, -6.0);
    // 产品水接收 / 计量站
    const meter = new THREE.Group();
    const hut = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.9, 2.2), mat(0x8fa9a0));
    hut.position.y = SITE.groundY + 0.95; meter.add(hut);
    const wt = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.6), this._m.water);
    wt.position.set(2.2, SITE.groundY + 0.45, 0); meter.add(wt);
    put(meter, -27, 0, -3.0);
    // 加压 / 计量泵站（园区入口/传输起点侧）
    const pump = new THREE.Group();
    const ph = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.0, 2.2), mat(0x7d9aa5));
    ph.position.y = SITE.groundY + 1.0; pump.add(ph);
    const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.3, 14), this._m.steel);
    pm.rotation.z = Math.PI / 2; pm.position.set(2.0, SITE.groundY + 0.7, 0); pump.add(pm);
    put(pump, -27, 0, 0.5);
    // 园区绿化
    const r = rng(3311), N = 24;
    const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 0.8, 6), this._m.trunk, N);
    const cr = new THREE.InstancedMesh(new THREE.ConeGeometry(0.58, 1.5, 7), this._m.leaf2, N);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const x = -w / 2 + 1 + r() * (w - 2), z = r() > 0.5 ? 1.3 : -11.2, s = 0.7 + r() * 0.6;
      dummy.position.set(x, SITE.groundY + 0.4 * s, z); dummy.scale.setScalar(s); dummy.updateMatrix(); tr.setMatrixAt(i, dummy.matrix);
      dummy.position.y = SITE.groundY + 1.55 * s; dummy.updateMatrix(); cr.setMatrixAt(i, dummy.matrix);
    }
    tr.instanceMatrix.needsUpdate = cr.instanceMatrix.needsUpdate = true;
    tr.userData.noShadow = cr.userData.noShadow = true;
    park.add(tr); park.add(cr);

    // —— v2.4 向山体新增台地带：world 坐标 1:1，与既有 park 台地南缘 z=-34 共边齐平（顶 y=0.35）——
    const addW = (mesh, x, y, z) => { mesh.position.set(x, y, z); markNoShadow(mesh); this.addMesh(mesh); return mesh; };
    // 1) 新台地：Box(w, 0.35, 12) @ (cx, 0.175, -40) → z∈[-46,-34]，与旧台地同材质、同顶高
    addW(new THREE.Mesh(new THREE.BoxGeometry(w, SITE.groundY, 12), mat(0x4a4740, { roughness: 0.95 })), cx, SITE.groundY / 2, -40);
    // 2) 新南围墙（内退 0.2，与旧墙内退 0.225 一致）
    addW(new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 0.22), this._m.warm), cx, SITE.groundY + 0.45, -45.8);
    // 3) 西/东围墙向南延 12 m（对齐既有 world x=52.3 / 149.7、厚 0.24）
    addW(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 12), this._m.warm), 52.3, SITE.groundY + 0.45, -40);
    addW(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 12), this._m.warm), 149.7, SITE.groundY + 0.45, -40);
    // 4) 新带 E-W 次干路 + 穿过接缝的 N-S 连接路（x=cx 为建筑空档，不撞既有计量站/储罐/烟囱）
    addW(new THREE.Mesh(new THREE.BoxGeometry(95, 0.06, 2.0), this._m.road), cx, SITE.groundY + 0.04, -40);
    addW(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 12), this._m.road), cx, SITE.groundY + 0.045, -34.5);
    // 5) 新带绿化：两排树 world z=-35.5 / -44.5，x∈[53,149] 均匀 12 棵，复用 this._m.trunk / this._m.leaf2
    for (let i = 0; i < 12; i++) {
      const tx = 53 + (i % 6) * (96 / 5), tz = i < 6 ? -35.5 : -44.5;
      addW(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.8, 6), this._m.trunk), tx, SITE.groundY + 0.4, tz);
      addW(new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.5, 7), this._m.leaf2), tx, SITE.groundY + 1.55, tz);
    }
    // 6) 地下产品水干管的地面表达：标识带 + 绿化带段 + 检查井
    addW(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 18), mat(0x6f8aa0)), 74, SITE.groundY + 0.02, -31);   // z∈[-22,-40]
    addW(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 7), mat(0x6f8aa0)), 74, 0.20 + 0.02, -18.5);        // 绿化带段 z∈[-15,-22]
    addW(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 1.2), mat(0x2a3540)), 74, 0.20 + 0.04, -15);        // 入地处标记
    for (const z of [-36, -42]) {
      addW(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.2), mat(0x2a3540)), 74, SITE.groundY + 0.06, z); // 检查井
      addW(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.7), mat(0x9aa9bb)), 74, SITE.groundY + 0.11, z);  // 井盖
    }

    // 产品水外输主管线（世界坐标，独立于 park：从主厂区长距离输送到后排 EXT 园区）
    // 清水池 → 厂区出口 → 加压站 → 外部工业用水园区。
    // v2.4：南向折线段由地面明管改为地下敷设（管中心 y=-0.2、管顶 0.02 < 台地顶 0.35），
    // z=-10→-15 为 5 m 渐变下穿，之后全程埋地；穿过接缝 z=-34 延伸至新增带 z=-40，流向不变、与既有明管段连续衔接。
    const line = makePipeRun([
      V(28, 1.1, -6), V(45, 1.1, -6), V(74, 1.1, -6), V(74, 1.1, -10),
      V(74, -0.2, -15), V(74, -0.2, -26), V(74, -0.2, -40)
    ], 0.22, this._m.pipe3);
    markNoShadow(line); this.addMesh(line);
  }

  // —— 7b. 市政水厂 + 产品水市政支线（与工业外输主管明确区分）——
  // 本版与外部工业用水园区「位置互换」：市政水厂移至工业用户以西（x≈56–72），冷色厂房群。
  // 全部建筑/绿化以相对坐标写入 park 组，再由 park.position 整体定位，便于互换与复用。
  _municipalPlant() {
    const cx = (MUNI.x0 + MUNI.x1) / 2, w = MUNI.x1 - MUNI.x0;
    const depth = PARK.depth, cz = PARK.cz;
    const park = new THREE.Group(); park.scale.z = FRONT_S; park.position.set(cx, 0, FRONT_Z0); this.group.add(park);
    const put = (mesh, x, y, z) => { mesh.position.set(x, y, z); markNoShadow(mesh); park.add(mesh); return mesh; };
    // 台地 + 围墙（西侧留 z∈[-4,4] 入口，正对园区道路）
    put(new THREE.Mesh(new THREE.BoxGeometry(w, SITE.groundY, depth), mat(0x4b5a63, { roughness: 0.95 })),
      0, SITE.groundY / 2, cz);
    const fence = (bw, bd, x, z) => put(new THREE.Mesh(new THREE.BoxGeometry(bw, 0.9, bd), this._m.walk), x, SITE.groundY + 0.45, z);
    const gateHalf = 3, gateX = 0, wallZ = PARK.frontZ - 0.4;
    const seg = (w - 2 * gateHalf) / 2;
    fence(seg, 0.22, -(gateHalf + seg / 2), wallZ);
    fence(seg, 0.22,  (gateHalf + seg / 2), wallZ);
    fence(w, 0.22, 0, PARK.backZ + 0.3);
    fence(0.24, 9, -w / 2 + 0.3, -8.5);      // 西墙南段 z∈[-13,-4]（货运次门）
    fence(0.24, 3, -w / 2 + 0.3, 1.5);       // 西墙北段 z∈[0,3]
    fence(0.24, depth, w / 2 - 0.3, cz);
    buildGate(put, this._m, { gateX, wallZ, half: gateHalf, innerZ: -5.0, tone: mat(0x9aa9bb),
      roadZ: 6.778, zebraZ0: 4.333, zebraStep: 0.2 / 0.45 });

    // 冷色厂房群（与暖色工业用户园区明显区分）
    const hall = (bw, bh, bd, x, z, tone) => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat(tone, { roughness: 0.78 }));
      b.position.y = SITE.groundY + bh / 2; g.add(b);
      const rf = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.4, 0.2, bd + 0.4), this._m.muniRoof);
      rf.position.y = SITE.groundY + bh + 0.1; g.add(rf);
      const win = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.7, 0.7, 0.06), this._m.glass);
      win.position.set(0, SITE.groundY + bh * 0.62, bd / 2 + 0.04); g.add(win);
      put(g, x, 0, z);
    };
    // 冷色厂房群：全部避让北门纵向引道 |x|≤3，z 向落在台地 [-13,3] 内
    hall(6, 4.2, 5.5, -6.5, -1.0, 0x8fb8c8);
    hall(5, 3.0, 4.5, 5.5, -1.0, 0x7fa8bc);
    hall(4, 3.2, 4, 6.5, -9.0, 0xa8c4d0);
    // 圆形清水池（2 座）+ 水面：退到西南角，避让引道与内部主干路
    for (let k = 0; k < 2; k++) {
      const x = -7 + k * 4.2;
      put(new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 1.2, 24), mat(0x9fb6c4)), x, SITE.groundY + 0.6, -9.0);
      const surf = new THREE.Mesh(new THREE.CircleGeometry(1.92, 28), this._m.water);
      surf.rotation.x = -Math.PI / 2; put(surf, x, SITE.groundY + 1.22, -9.0);
    }
    // 水塔（东侧，避开厂房与主门引道）
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 4.0, 12), this._m.walk), 9.5, SITE.groundY + 2.0, -1.0);
    put(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.6, 18), mat(0xb8d2de)), 9.5, SITE.groundY + 4.6, -1.0);
    // 园区内部东西向主干路（z=-5.0），由北门纵向引道接入
    put(new THREE.Mesh(new THREE.BoxGeometry(w - 2, 0.06, 2.2), this._m.road), 0, SITE.groundY + 0.04, -5.0);
    const r = rng(6621), N = 16;
    const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 0.8, 6), this._m.trunk, N);
    const cr = new THREE.InstancedMesh(new THREE.ConeGeometry(0.58, 1.5, 7), this._m.leaf2, N);
    const d = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const x = -w / 2 + 1 + r() * (w - 2), z = r() > 0.5 ? 1.3 : -11.2, s = 0.7 + r() * 0.6;
      d.position.set(x, SITE.groundY + 0.4 * s, z); d.scale.setScalar(s); d.updateMatrix(); tr.setMatrixAt(i, d.matrix);
      d.position.y = SITE.groundY + 1.55 * s; d.updateMatrix(); cr.setMatrixAt(i, d.matrix);
    }
    tr.instanceMatrix.needsUpdate = cr.instanceMatrix.needsUpdate = true;
    tr.userData.noShadow = cr.userData.noShadow = true;
    park.add(tr); park.add(cr);

    // 产品水市政支线（世界坐标，独立于 park）：主管 x=45 处分水 → 抬升架空 → 沿 z=9 向东 → 市政水厂。
    // 与工业外输（y≈1.0、沿 z=-6 向东）在走向、高程、颜色上均明确区分。
    // 市政支线：移入台地内 z=1.0、抬到 y=2.6 做视觉分层，支架不再立于车行道
    const MUNI_LINE = [
      V(45, 1.1, -6), V(45, 2.6, -6), V(45, 2.6, 1.0),
      V(56, 2.6, 1.0), V(60, 2.6, 1.0), V(60, 1.4, -2.4)
    ];
    const line = makePipeRun(MUNI_LINE, 0.16, this._m.muniPipe);
    markNoShadow(line); this.addMesh(line);
    // 分水三通 + 架空支架（强调与地面工业管线的层级差）
    const tee = new THREE.Mesh(new THREE.SphereGeometry(0.30, 14, 10), this._m.endCap);
    tee.position.set(45, 1.1, -6); markNoShadow(tee); this.addMesh(tee);
    for (const x of [50, 56, 60]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.25, 0.14), this._m.steel);
      s.position.set(x, SITE.groundY + 1.12, 1.0); markNoShadow(s); this.addMesh(s);
    }
    this.muniLine = MUNI_LINE;   // 供 _pipeBallFlows() 生成同走向球流
  }

  // —— 7c. 罐装饮用水厂房 + 产品水第三路（与工业外输、市政支线明确区分）——
  // 产品水自厂区主管在 x=45 三通处分三路（复用市政支线同一管点）：
  //   ① 东向沿 z=-6 至外部工业新厂；② 北向架空至市政水厂（z=9）；③ 本路：北向至 z=6 再东延至罐装厂房。
  _bottledPlant() {
    const cx = BOTTLE_X, w = 7;
    // 与两园统一取 PARK 台地基准（g 落在 cz=-5），使罐装厂与两厂齐平、北门同在 z=2.6
    const BS = 0.45, BZ0 = -0.6;   // 罐装厂前排 Z 变换：局部 z∈[-8,8] → 世界 z∈[-4.2,3.0]
    const g = new THREE.Group(); g.scale.z = BS; g.position.set(cx, 0, BZ0); this.group.add(g);
    const put = (mesh, x, y, z) => { mesh.position.set(x, y, z); markNoShadow(mesh); g.add(mesh); return mesh; };
    // 台地（局部 z∈[-8,8] → 世界 [-13,3]）
    put(new THREE.Mesh(new THREE.BoxGeometry(w + 1, SITE.groundY, PARK.depth), mat(0x47535d, { roughness: 0.95 })), 0, SITE.groundY / 2, 0);
    // 独立围墙 + 北向主门（局部 z = 世界 z - PARK.cz）
    const fence = (bw, bd, x, z) => put(new THREE.Mesh(new THREE.BoxGeometry(bw, 0.9, bd), this._m.walk), x, SITE.groundY + 0.45, z);
    const gateHalf = 2, wallZ = PARK.frontZ - 0.4 - PARK.cz;
    const seg = (w + 1 - 2 * gateHalf) / 2;
    fence(seg, 0.22, -(gateHalf + seg / 2), wallZ);
    fence(seg, 0.22,  (gateHalf + seg / 2), wallZ);
    fence(w + 1, 0.22, 0, PARK.backZ + 0.3 - PARK.cz);
    fence(0.24, PARK.depth, -(w + 1) / 2 + 0.3, 0);
    fence(0.24, PARK.depth, (w + 1) / 2 - 0.3, 0);
    [-gateHalf, gateHalf].forEach(dx => {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.4, 12), this._m.wall), dx, SITE.groundY + 1.2, wallZ);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 8), this._m.light), dx, SITE.groundY + 2.5, wallZ);
    });
    // 门前引道：北墙(局部 wallZ) → 车行道南缘(世界 4.7 换算为局部 roadZ)，随 Group Z 变换落到世界车道
    const roadZL = (4.7 - BZ0) / BS;   // 局部 ≈11.778
    const appL = roadZL - wallZ;
    put(new THREE.Mesh(new THREE.BoxGeometry(gateHalf * 2, 0.07, appL), this._m.road),
      0, SITE.groundY + 0.04, wallZ + appL / 2);
    // 灌装主车间 + 仓储/化验（冷色，与市政水厂同族、与工业暖色区分）
    const hall = (bw, bh, bd, x, z, tone) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat(tone, { roughness: 0.78 }));
      b.position.set(x, SITE.groundY + bh / 2, z); g.add(b);
      const rf = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.4, 0.2, bd + 0.4), this._m.muniRoof);
      rf.position.set(x, SITE.groundY + bh + 0.1, z); g.add(rf);
      const win = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.6, 0.8, 0.06), this._m.glass);
      win.position.set(x, SITE.groundY + bh * 0.6, z + bd / 2 + 0.04); g.add(win);
    };
    hall(5, 3.6, 4, -1, -1, 0x9fc6d6);
    hall(3, 3.0, 3.5, 2.6, 2.6, 0x88b4c6);
    // 成品水箱
    const tank = makeTank(1.1, 2.0, 0xb8d2de); tank.position.set(-1.6, SITE.groundY, 2.6); markNoShadow(tank); g.add(tank);
    // 绿化
    const r = rng(7711), N = 8;
    const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 0.8, 6), this._m.trunk, N);
    const cr = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 1.3, 7), this._m.leaf2, N);
    const d = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const x = -w / 2 + r() * w, z = (r() > 0.5 ? 3.6 : -3.8), s = 0.7 + r() * 0.5;
      d.position.set(x, SITE.groundY + 0.4 * s, z); d.scale.setScalar(s); d.updateMatrix(); tr.setMatrixAt(i, d.matrix);
      d.position.y = SITE.groundY + 1.5 * s; d.updateMatrix(); cr.setMatrixAt(i, d.matrix);
    }
    tr.instanceMatrix.needsUpdate = cr.instanceMatrix.needsUpdate = true;
    tr.userData.noShadow = cr.userData.noShadow = true; g.add(tr); g.add(cr);

    // 产品水第三路：x=45 三通 → 北向至 z=6 → 东延至罐装厂房（世界坐标，独立于 g）
    // 罐装支线：移入台地内 z=-1.0、抬到 y=2.8，支架全部移出车行道 z∈[4.7,8.1]
    const BOTTLE_LINE = [V(45, 1.1, -6), V(45, 2.8, -6), V(45, 2.8, -1.0),
                         V(86, 2.8, -1.0), V(86, 0.7, -2.0)];
    const line = makePipeRun(BOTTLE_LINE, 0.15, this._m.muniPipe);
    markNoShadow(line); this.addMesh(line);
    // 架空支架（强调与地面工业管线的层级差）
    for (const x of [54, 66, 78]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.45, 0.14), this._m.steel);
      s.position.set(x, SITE.groundY + 1.22, -1.0); markNoShadow(s); this.addMesh(s);
    }
    this.bottleLine = BOTTLE_LINE;   // 供 _pipeBallFlows() 生成同走向球流
  }

  // —— 8. 涉海工程 ——
  _marineWorks() {
    const head = new THREE.Group(); head.position.set(-36, 0, 44);   // 取水头部离海岸更远（z 26→44）
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 0.9, 16), mat(0x6d8296, { metalness: 0.4 }));
    cap.position.y = 0.45; head.add(cap);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8fa3b6, { metalness: 0.4 }));
    dome.position.y = 0.9; head.add(dome);
    for (let k = 0; k < 8; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.12), this._m.steel);
      const a = k / 8 * Math.PI * 2;
      bar.position.set(Math.cos(a) * 1.7, 0.5, Math.sin(a) * 1.7); head.add(bar);
    }
    this.addMesh(head);
    // 双取水管（半透明管壁 + 亮芯/接头，边界与路径清晰；水流方向 取水头部 → 厂区）
    const rawGlow = 0x8fe0ff;
    this._glassPipe([V(-36, 0.25, 44), V(-36, 0.25, 16), V(-35, 0.55, 11.2), V(-33, 0.95, 4.0)],
      0.30, this._m.intakeGlass, rawGlow, this.group);
    this._glassPipe([V(-34.4, 0.22, 44), V(-34.4, 0.22, 16), V(-34, 0.55, 11.2), V(-32.4, 0.95, 4.0)],
      0.24, this._m.intakeGlass, rawGlow, this.group);
    // 端点标识：取水头部端与厂区接入端各一枚亮色端帽，半透明管线上仍可一眼辨识
    [[V(-36, 0.25, 44), V(-33, 0.95, 4.0), 0.30],
     [V(-34.4, 0.22, 44), V(-32.4, 0.95, 4.0), 0.24]].forEach(([a, b, r]) => {
      [a, b].forEach(p => {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 12, 10), this._m.endCap);
        cap.position.copy(p); cap.userData.noShadow = true; this.addMesh(cap);
      });
    });
    // 注：原「并排排放列管」（沿管轴线排布的 20 喷口线性扩散器）已取消，改由 _radialOutfall()
    // 的辐射状分支统一表达浓水向四周排放；本函数仅保留离岸取水头部与双取水管。
  }

  // —— 8b. 浓盐水排放管道（厂内集管 → 穿堤段 → 海底放流管 → 辐射状扩散器）——
  // 依据：S30/S32（Perth 单根 DN1600 GRP 放流管、末段 40 喷口、45:1 稀释）、
  //       S35（低压排放用 GRP/FRP/HDPE、高压浓水侧 S32750）、
  //       S36（双偏心蝶阀 / 法兰与试压标准）、S31（浓水为负浮力羽流，需上倾喷射）。
  // 走向与既有浓水流体路径（_flows 中 x=33 → z=26）严格对齐，不改任何既有状态。
  _brineOutfall() {
    const g = new THREE.Group();
    const pipe = (points, r, m) => {
      const run = makePipeRun(points, r, m);
      run.traverse(o => { if (o.isMesh) o.userData.noShadow = true; });
      g.add(run);
    };
    // 浓水输送主管改为半透明管壁（+ 亮芯/接头），取样小管与 T 接头保持实色
    const brineGlow = 0xffa96a;
    const glassPipe = (points, r, gm) => this._glassPipe(points, r, gm, brineGlow, g);
    const box = (w, h, d, x, y, z, m) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      b.userData.noShadow = true;
      g.add(b);
    };

    // ① 厂内浓水集管：RO / PX 浓水汇入后沿架空管廊上层 +X 输至排放段
    //    高压浓水侧按 S35 用 S32750 超级双相钢（复用 brine 配色）
    glassPipe([V(11, 2.15, -6.2), V(22, 2.15, -6.2), V(33, 2.15, -6.2)], 0.24, this._m.brineGlassDuplex);
    for (let x = 12; x <= 33; x += 3.5) box(0.12, 0.42, 0.12, x, 1.92, -6.2, this._m.steel);
    // 厂内隔离蝶阀（S36：双偏心蝶阀、法兰连接）
    const v1 = makeValve(0xd99055); v1.position.set(19, 2.15, -6.2); g.add(v1);

    // ② 陆上排放总管 / 穿海堤段：GRP DN1600 示意，随岸坡下潜
    glassPipe([V(33, 2.15, -6.2), V(33, 2.15, -2), V(33, 1.2, 2), V(33, 0.62, 11.5)],
      0.30, this._m.brineGlassGRP);
    for (const z of [-1, 3, 7, 10.5]) box(1.15, 0.5, 0.72, 33, 0.55, z, this._m.rock);
    // 岸边止回 / 隔离蝶阀 + 排放监测取样站
    const v2 = makeValve(0xd99055); v2.position.set(33, 1.2, 2); g.add(v2);
    box(1.7, 1.3, 1.4, 35.4, SITE.groundY + 0.65, 3.2, mat(0x8a97a5));
    // 取样支管同样半透明（「所有分支管路」口径），细管不加亮芯以免糊成实线
    pipe([V(34.6, 0.95, 3.2), V(33.3, 0.95, 3.2)], 0.065, this._m.brineGlassBranch);

    // ③ 海底放流管：HDPE / GRP 低压段，压载块固定于海床；末端向海延伸并与辐射状扩散器中心重合
    glassPipe([V(33, 0.62, 11.5), V(33, 0.30, 17), V(33, 0.25, 26), V(33, 0.25, 33)], 0.28, this._m.brineGlassHDPE);
    for (const z of [13, 16, 19, 22, 25, 28, 31]) box(1.05, 0.34, 0.62, 33, 0.02, z, this._m.rock);
    // ④ 接入辐射状扩散器中心的 T 型接头（与 _radialOutfall 的 hub 同心，连接关系清晰）
    const tee = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), this._m.brineHDPE);
    tee.position.set(33, 0.25, 33); tee.userData.noShadow = true; g.add(tee);
    this.addMesh(g);
  }

  // —— 8c. 以排放点为中心的辐射状分支管路 ——
  // 主管末端（T 接头 / 扩散器中心，已向海更远移至 OUTFALL.z=33）作为唯一排放点；
  // 12 条半透明分支每 30° 向四周展开；分支较上一版缩短、分配环相应缩小，中心 hub +
  // 分配环明确表达「主管 → 各分支」的连接关系，且不与取水管/其它要素重叠。
  _radialOutfall() {
    const g = new THREE.Group();
    // 中心排放点：与放流管末端 T 接头同心，实色 hub 让连接节点醒目
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.6, 18, 14), this._m.branchHub);
    hub.position.set(OUTFALL.x, OUTFALL.y, OUTFALL.z);
    hub.userData.noShadow = true; g.add(hub);
    // 中心分配环：串联各分支根部，半透明，与分支同材质
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 10, 48), this._m.brineGlassBranch);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(OUTFALL.x, OUTFALL.y, OUTFALL.z);
    ring.userData.noShadow = true; g.add(ring);

    this.radialLines = [];
    for (let k = 0; k < RADIAL_N; k++) {
      const a = k * Math.PI * 2 / RADIAL_N, dx = Math.cos(a), dz = Math.sin(a);
      const P = (r, dy = 0) => V(OUTFALL.x + dx * r, OUTFALL.y + dy, OUTFALL.z + dz * r);
      // 本版缩短：根部 → 中段 → 末端外伸仅 6.0（上一版 11.5），更紧凑、离海岸更远
      const pts = [P(0), P(3.0, -0.03), P(6.0, -0.06)];
      // 半透明分支管壁 + 亮芯 + 转折/端点接头（与主管同构，视觉层级一致）
      this._glassPipe(pts, 0.15, this._m.brineGlassBranch, 0xffb877, g);
      // 末端排放口：实色端球，明确每一个向周围排水的出口
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), this._m.branchHub);
      tip.position.copy(pts[2]); tip.userData.noShadow = true; g.add(tip);
      // 球流路径继续向外延伸，体现「由中心向四周排水」的流向
      this.radialLines.push([...pts, P(7.5, -0.08)]);
    }
    this.addMesh(g);
  }

  // —— 9. 八段精细模型嵌入（不再单独切换界面）——
  _embeddedSegments() {
    EMBED.forEach(d => {
      const seg = new d.cls();
      seg.build();
      const g = seg.group;
      g.scale.setScalar(d.s);
      g.position.set(d.x, SITE.groundY + 0.55, d.z);
      g.userData.inner = true;              // 全景层隐藏的内部精细模型（含其自带标注）
      this.group.add(g);
      this.embedded[d.id] = seg;
      this.embeddedGroups[d.id] = g;
    });
  }

  // —— 10. 物料主线流体 ——
  _flows() {
    const y = 1.75, z = -6.2;
    const xs = [-38, -33, -22, -11, 0, 11, 22, 33, 41];
    const cols = [COLORS.raw, COLORS.raw, COLORS.pretreated, COLORS.pretreated,
                  COLORS.hpFeed, COLORS.hpFeed, COLORS.permeate, COLORS.permeate];
    for (let k = 0; k < cols.length; k++) {
      this.addFlow([V(xs[k], y + 0.35, z), V((xs[k] + xs[k + 1]) / 2, y + 0.35, z), V(xs[k + 1], y + 0.35, z)],
        { color: cols[k], count: 9, size: 0.17, speed: 0.10 });
    }
    this.addFlow([V(-36, 0.35, 26), V(-36, 0.35, 16), V(-35, 0.65, 11), V(-33, 1.0, 4), V(-33, 1.75, z)],
      { color: COLORS.raw, count: 12, size: 0.20, speed: 0.075 });
    this.addFlow([V(11, 1.75, z), V(22, 1.75, z), V(33, 1.2, 2), V(33, 0.4, 12), V(33, 0.25, 26), V(38, 0.25, 26)],
      { color: COLORS.brine, count: 14, size: 0.19, speed: 0.065 });
    // 产品水外输：清水池 → 加压计量泵站 → 外部工业用水园区（并列于市政水厂东侧 x≈76–118）
    this.addFlow([V(22, 1.6, -6), V(30, 1.4, -6), V(40, 1.2, -6), V(47.5, 1.2, -6),
                  V(53, 1.1, -6), V(80, 1.1, -6), V(85, 1.1, -6), V(85, 1.0, -5.2)],
      { color: COLORS.permeate, count: 18, size: 0.20, speed: 0.085 });
  }

  // —— 10b. 取水 / 外排管道水流小球（半透明管道内可见，贴合折线走向）——
  _pipeBallFlows() {
    // 既有取水 / 浓水粒子流用 CatmullRom 平滑，会在转折点切角偏离折线管道；
    // 只关闭其可视性，保留对象与数组索引（resetView() 仍按索引复位流速，其它元素与状态不变），
    // 由下面按折线精确插值的小球流统一表达。
    [8, 9].forEach(i => { if (this.flows[i]) this.flows[i].group.visible = false; });

    const add = (points, opts, tag) => {
      const bf = new PipeBalls(points, opts);
      bf.group.userData.flowTag = tag;
      this.ballFlows.push(bf);
      this.group.add(bf.group);
      return bf;
    };
    const rawBallC = 0xdff4ff, brineC = COLORS.brine;

    // ① 取水：离岸取水头部 → 厂区（两根并行，数组顺序即水流方向）
    //    亮青白小球与浅蓝亮芯/淡蓝管壁形成对比，水流方向一眼可辨
    add([V(-36, 0.25, 44), V(-36, 0.25, 16), V(-35, 0.55, 11.2), V(-33, 0.95, 4.0)],
      { color: rawBallC, count: 18, size: 0.18, speed: 2.6, emissiveIntensity: 1.2 }, 'intake-1');
    add([V(-34.4, 0.22, 44), V(-34.4, 0.22, 16), V(-34, 0.55, 11.2), V(-32.4, 0.95, 4.0)],
      { color: rawBallC, count: 16, size: 0.16, speed: 2.6, phase: 0.35, emissiveIntensity: 1.2 }, 'intake-2');

    // ② 外排主管：厂内集管 → 穿堤 → 海底放流管 → 辐射状扩散器中心（T 接头，已向海更远移至 z=33）
    add([V(11, 2.15, -6.2), V(22, 2.15, -6.2), V(33, 2.15, -6.2), V(33, 2.15, -2),
         V(33, 1.2, 2), V(33, 0.62, 11.5), V(33, 0.30, 17), V(33, 0.25, 26), V(33, 0.25, 33)],
      { color: brineC, count: 44, size: 0.14, speed: 2.8 }, 'brine-main');

    // ③ 辐射状分支：小球由排放点沿各条分支向四周流出，明确「向周围排水」的流向
    //    （原 20 喷口并排列管已取消，改由 12 条辐射分支统一表达；每条 5 球，相位错开，
    //     任意时刻每个分支末端都有可见小球向外流出，不遗漏任一出口。）
    (this.radialLines || []).forEach((pts, k) => {
      const bf = add(pts, {
        color: brineC, count: 5, size: 0.105, speed: 1.8,
        phase: (k * 0.083) % 1
      }, 'radial-' + k);
      this.radialFlows.push(bf);
    });

    // ⑥ 产品水市政支线：浅青小球沿独立架空管线流向市政水厂，与工业外输绿色主路区分
    if (this.muniLine) {
      add(this.muniLine, {
        color: 0x8ff5ea, count: 18, size: 0.13, speed: 2.6, emissiveIntensity: 1.0
      }, 'municipal');
    }

    // ⑦ 产品水第三路：罐装饮用水厂房（北向至 z=6 再东延），与工业/市政两路分色、分走向
    if (this.bottleLine) {
      add(this.bottleLine, {
        color: 0xa6ecff, count: 16, size: 0.13, speed: 2.6, emissiveIntensity: 1.0
      }, 'bottled');
    }
  }

  // —— 11. 标签 ——
  _labels() {
    // 统一登记标注，供 syncLabels() 按相机距离 / 方位做联动
    const L = (text, pos, opts = {}) => {
      // 全景层所有需显示要素的标注统一放大（LABEL_SCALE），保证全景视图下清晰可读；
      // 拓宽画布上限（maxWidth 1400），避免长标注被压成极小字号而看不清；
      // syncLabels 仍按相机距离成比例缩放，近距离不会放大成横幅遮挡画面。
      const o = { ...opts, fontSize: Math.round((opts.fontSize || 28) * LABEL_SCALE), maxWidth: opts.maxWidth || 1400 };
      const sp = this.addLabel(text, pos, o);
      sp.userData.text = text;              // 便于拾取 / 校核
      sp.userData.fontPx = o.fontSize;      // 便于校核「统一放大」是否生效
      this.labels.push({ sprite: sp, base: sp.scale.clone(), pos: sp.position.clone() });
      return sp;
    };
    PLANT_SEGMENTS.forEach((s, i) => {
      // 相邻厂房间距仅 ~11，标注放大后需错开深度/高度避免互相叠字遮挡厂房
      const y = SITE.groundY + s.h + 2.6 + (i % 2 ? 3.5 : 0);
      const z = -1 - (i % 2 ? 6.0 : 0);
      // 最左侧两栋（x<-20）标注东移，避开左侧导航栏遮挡
      const xoff = s.x < -25 ? 18 : (s.x < -15 ? 6 : 0);
      L(`${s.no} ${s.name}`, V(s.x + xoff, y, z), { fontSize: 28, color: '#eaf4ff' });
    });
    const ovLabel = L('全流程总览', V(-38, SITE.groundY + 4.4, -9.5), { fontSize: 26, color: '#bcd6ff' });
    // 展馆标签也纳入拾取：点击文字与点击展馆本体、点击左侧导航都触发同一指令
    if (this.halls.overview) {
      ovLabel.userData.segmentId = 'overview';
      this.halls.overview.pick.push(ovLabel);
    }
    const env = [
      ['海域 · 海水取水区', V(-22, 2.0, 46), 34, '#9fe8ff'],
      ['海岸线 / 防波堤', V(-6, 1.8, 14.5), 30, '#ffe2b0'],
      ['周围山地丘陵', V(-4, 15, -62), 34, '#c8e6b0'],
      ['厂区主路 · 人车分流', V(-18, 2.4, 6.4), 26, '#dfe8f5'],
      ['海水取水头部', V(-36, 2.2, 44), 28, '#9fe8ff'],
      ['浓水辐射状扩散器', V(33, 2.0, 33), 28, '#ffb38a'],
      ['浓盐水排放管 · DN1600 GRP / HDPE', V(38.5, 3.8, 7), 24, '#ffb38a'],
      ['浓水排放 · 掺混稀释 45:1', V(47, 3.4, 30), 24, '#ffb38a'],
      ['产品水外输主管线', V(68, 3.4, -6), 26, '#9af5c8'],
      ['产品水分水点 · 工业 / 市政', V(42, 6.8, -12), 22, '#9af5c8'],
      ['加压 / 计量泵站', V(85, 3.0, -3.0), 24, '#9af5c8'],
      ['市政用水支线 · 城市供水', V(56, 6.8, 1.0), 26, '#a8f0ea'],
      ['市政水厂 · 城市供水', V(63, 9.0, -1), 30, '#a8f0ea'],
      ['中央绿化隔离带 · 6 m', V(77, 3.2, -5), 22, '#bfe3a0'],
      ['产品水第三路 · 罐装饮用水厂房', V(86, 7.6, -1.0), 26, '#a6ecff'],
      ['灌装线（集水罐 → 灌装）', V(BOTTLE_X, 5.4, -2.0), 22, '#a6ecff'],
      ['外部用水工厂 · 工业园区', V(112, 9.6, -1), 32, '#ffd9a8'],
      ['两厂北向主出入口 · 接公共走廊', V(88, 4.6, 2.6), 22, '#dfe8f5'],
      ['厂区主入口 · 开放式厂门', V(44, 9.5, 13), 24, '#dfe8f5'],
      ['厂前区 · 综合楼', V(-40, 3.4, -4.0), 24, '#dfe8f5']
    ];
    env.forEach(([t, p, fs, c]) => L(t, p, { fontSize: fs, color: c }));
  }

  /** 标注联动：滚轮缩放（相机距离）→ 放大/缩小；鼠标旋转（方位/俯角）→ 缩放变化 + 轻微旋转。
   *  由 App._loop 每帧传入相机调用。Sprite 恒面向相机，旋转通过 SpriteMaterial.rotation 表达。 */
  syncLabels(camera) {
    if (!this.labels || !this.labels.length) return;
    const p = camera.position;
    const dx = p.x - 52, dz = p.z - 4;   // 与默认取景 target 保持一致（S1 会签版 target=[52,4,4]）
    const az = Math.atan2(dx, dz);                        // 方位角（鼠标水平旋转）
    const elev = Math.atan2(p.y - 3, Math.hypot(dx, dz));// 俯角（鼠标垂直旋转）
    const orient = Math.cos(az);
    const tilt = Math.sin(az) * 0.14;
    const viewK = 0.92 + 0.12 * (1 - THREE.MathUtils.clamp(elev / 1.3, 0, 1)) + 0.08 * orient;
    for (const it of this.labels) {
      const d = p.distanceTo(it.pos);
      // 世界尺寸随相机距离成比例 → 屏幕尺寸基本稳定，近距离不会放大成横幅遮挡画面；
      // 滚轮缩放与旋转仍通过 viewK / 距离变化产生可感知的尺寸联动。
      // 全景层标注统一放大（LABEL_SCALE 已放大）；这里按相机距离做自适应缩放：
      // 基准距离取 115（与默认全景取景一致），使全景视图下标注清晰可读；
      // 滚轮拉近时 distK 下限放到 0.40，避免过近时缩得太小看不清（仍远小于 1，不会放大成横幅遮挡画面）；
      // 滚轮拉远时上限放到 1.5，保证远观仍可读。
      const distK = THREE.MathUtils.clamp(d / 115, 0.40, 1.5);
      const s = distK * viewK;
      it.sprite.scale.set(it.base.x * s, it.base.y * s, 1);
      if (it.sprite.material) it.sprite.material.rotation = tilt;
    }
  }

  // --------------------------------------------------------------------------
  // 交互接口（由 App 调用）
  // --------------------------------------------------------------------------

  /** 返回可点击的厂房网格（Raycaster 用） */
  pickTargets() {
    const arr = [];
    Object.values(this.halls).forEach(h => h.pick.forEach(m => arr.push(m)));
    return arr;
  }

  /** 该段的 HUD 信息（直接取嵌入段自身的 getInfo） */
  infoFor(id) {
    return this.embedded[id] ? this.embedded[id].getInfo() : this.getInfo();
  }

  /** 聚焦视角（同一场景内，不重建界面）—— 七段 / 其它交互保持原样 */
  viewFor(id) {
    const a = ANCHORS[id];
    if (!a) return null;
    return { target: [a.x, 2.3, a.z], dir: [0.62, 0.6, 1.1], dist: a.dist, far: 900 };
  }

  /**
   * 「全流程总览展馆」专用取景（仅供 focusOverview 指令调用）。
   * 由展馆真实包围球半径 + 相机 FOV/aspect 反算距离，使展馆落在画面正中
   * 且完整入画；target 取包围盒中心 → 居中；方向落在展馆**背面**（山侧 -Z），
   * 镜头需绕厂区约 130° 才能到达，形成明显的连续旋转聚焦动作。
   * 不修改 viewFor()，因此其余七个工艺段的取景参数完全不受影响。
   */
  overviewView(camera) {
    const h = this.halls.overview;
    if (!h) return this.viewFor('overview');
    h.group.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(h.group);
    if (box.isEmpty()) return this.viewFor('overview');
    const center = box.getCenter(new THREE.Vector3());
    const r = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, 6);
    const vFov = THREE.MathUtils.degToRad(camera.fov || 55);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (camera.aspect || 16 / 9));
    const dist = r / Math.sin(Math.min(vFov, hFov) / 2) * 1.18; // 留白，避开左右 UI 面板
    return {
      target: center.toArray(),
      // 展馆背面（山侧 -Z）：dir.z < 0 → 相机位于 z < 展馆背面(z=-13)，朝 +Z 观察。
      // 方位角约 159°，较默认全景约 27° 相差 132°，_flyArc 走最短弧连续旋转到位；
      // 较高俯角使视线越过厂区后方围墙与山地前景，展馆居中且完整可见、无遮挡。
      dir: [0.38, 0.82, -1.0],
      dist, far: 900
    };
  }

  /** 交互模式：所有集装箱切换为透明以露出内部模型，目标集装箱最透 + 边框高亮，该段流程加速 */
  focus(id) {
    // 幂等：重复触发同一段时状态已一致，跳过材质重建与流速重置，避免抖动
    if (this.focused === id) return;
    this.focused = id;
    Object.entries(this.halls).forEach(([k, h]) => {
      const on = k === id;
      [h.wallMat, h.roofMat].forEach(m => {
        m.transparent = true; m.depthWrite = false; m.needsUpdate = true;
      });
      h.wallMat.opacity = on ? 0.10 : 0.30;
      h.roofMat.opacity = on ? 0.13 : 0.38;
      h.edgeMat.opacity = on ? 1.0 : 0.55;
      h.group.traverse(o => { if (o.isMesh) o.castShadow = false; });
    });
    Object.entries(this.embedded).forEach(([k, seg]) => {
      seg.flows.forEach(f => { f.speed = k === id ? 0.30 : 0.05; });
    });
    // 仅显示被聚焦段的内部设备与其自带标注，其余段保持隐藏（全景层不出现厂房内部细节）
    Object.entries(this.embeddedGroups).forEach(([k, o]) => { o.visible = (k === id); });
    Object.entries(this.features).forEach(([k, o]) => { o.visible = (k === id); });
    this.flows.forEach(f => { f.speed = 0.05; });
  }

  /** 恢复全景：所有集装箱回到不透明（实心）、流速复位 */
  resetView() {
    this.focused = null;
    Object.values(this.halls).forEach(h => {
      [h.wallMat, h.roofMat].forEach(m => {
        m.transparent = false; m.depthWrite = true; m.opacity = 1.0; m.needsUpdate = true;
      });
      h.edgeMat.opacity = 0.5;
      h.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    });
    Object.values(this.embedded).forEach(seg => seg.flows.forEach(f => { f.speed = 0.10; }));
    this.flows.forEach((f, i) => { f.speed = [0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.075, 0.065, 0.085][i] || 0.10; });
    // 全景总览层：隐藏厂房内部精细设备及其相关标注，只保留水域/山地/排水/
    // 全流程总览/各工艺段/外部工厂/产品水外输（含市政支线）与道路门区等大类要素
    Object.values(this.embeddedGroups).forEach(o => { o.visible = false; });
    Object.values(this.features).forEach(o => { o.visible = false; });
  }

  /** 每帧：海浪 + 八段嵌入模型的流体/转子动画 */
  update(dt, t) {
    super.update(dt, t);
    Object.values(this.embedded).forEach(seg => seg.update(dt, t));
    // 取水 / 外排管道小球流：独立于 focus()/resetView() 的流速调整，始终持续匀速流动
    this.ballFlows.forEach(b => b.update(dt));
    if (!this.wave) return;
    const { geo, base, pos } = this.wave;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 2], z = base[i * 2 + 1];
      // 主涌浪 + 交叉浪 + 长周期波 + 两组细碎波纹，形成更丰富的水面层次
      pos.setY(i, Math.sin(x * 0.28 + t * 0.9) * 0.16 + Math.cos(z * 0.35 + t * 0.7) * 0.13
        + Math.sin((x + z) * 0.16 - t * 0.55) * 0.08
        + Math.sin(x * 0.72 - t * 1.35) * 0.035 + Math.cos(z * 0.61 + t * 1.10) * 0.030);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
}
