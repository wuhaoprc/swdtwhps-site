// 统一工艺流程规范：所有工艺段共享的"语言"，保证段与段之间连贯一致。
// 包含：流向、流体配色、管径、进出水口位置、标签约定，以及段间衔接短管构件。
import * as THREE from '../../vendor/three.module.js';
import { makeLabel, makePipe } from './Helpers.js';

/** 全局流向：+X 轴，水从左侧（上游）流向右側（下游） */
export const FLOW_DIR = new THREE.Vector3(1, 0, 0);

/** 流体/物料配色（按"流的类型"而非"段"上色，段间才能连续） */
export const COLORS = {
  raw:        0x1f6fd6, // 原海水（高盐）
  pretreated: 0x26c6dc, // 预处理产水（澄清）
  hpFeed:     0x2e9bff, // 高压进料
  permeate:   0x39d98a, // 淡水 / 产水
  brine:      0xff6a3d, // 浓盐水（高盐排放）
  recovery:   0x9b8cff, // 能量回收循环水
  steel:      0x9fb6cc  // 设备/管道钢色
};
export const COLOR_NAME = {
  raw: '原海水 (高盐 ~35 g/L)',
  pretreated: '预处理产水',
  hpFeed: '高压进料 (55–70 bar)',
  permeate: '淡水 / 产水 (<0.5 g/L)',
  brine: '浓盐水 (≈1.5–2× 进水盐度)',
  recovery: '能量回收循环'
};

/** 管径分级（世界单位 = 米级示意） */
export const PIPE = { main: 0.22, branch: 0.14, small: 0.09 };

/** 统一的进出水口位置：每段左侧进、右侧出，高度一致 → 段间衔接自然 */
export const INLET  = new THREE.Vector3(-7.5, 1.3, 0);
export const OUTLET = new THREE.Vector3( 7.5, 1.3, 0);
export const LABEL_DY = 1.0; // 部件标签相对部件顶部的抬升高度

/** 标准钢结构平台 */
export function makePlatform(w, d, color = 0x33425a) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.3, d),
    new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.9 })
  );
  m.position.y = 0.15;
  return m;
}

/** 段间衔接短管：左侧进水口 + 右侧出水口 + 法兰盘 + 标签，呈现"与上下游相连" */
export function makeStubs(inColor, outColor, inLabel, outLabel) {
  const g = new THREE.Group();
  const inMat  = new THREE.MeshStandardMaterial({ color: COLORS.steel, metalness: 0.4, roughness: 0.5 });
  const flange = new THREE.MeshStandardMaterial({ color: 0xcfd8e3, metalness: 0.6, roughness: 0.35 });

  const pIn  = makePipe(INLET,              new THREE.Vector3(INLET.x + 1.3, INLET.y, INLET.z),  PIPE.main, inMat);
  const pOut = makePipe(new THREE.Vector3(OUTLET.x - 1.3, OUTLET.y, OUTLET.z), OUTLET,           PIPE.main, inMat);
  g.add(pIn, pOut);

  for (const x of [INLET.x + 1.3, OUTLET.x - 1.3]) {
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(PIPE.main * 1.5, PIPE.main * 1.5, 0.12, 20), flange);
    fl.rotation.z = Math.PI / 2;
    fl.position.set(x, INLET.y, 0);
    g.add(fl);
  }

  const lIn  = makeLabel(inLabel,  { fontSize: 34, bg: 'rgba(8,26,46,0.82)' });
  lIn.position.set(INLET.x + 0.6, INLET.y + 0.9, 0);
  const lOut = makeLabel(outLabel, { fontSize: 34, bg: 'rgba(8,26,46,0.82)' });
  lOut.position.set(OUTLET.x - 0.6, OUTLET.y + 0.9, 0);
  g.add(lIn, lOut);

  return g;
}

/** 把颜色数值转成 THREE 材质（便于复用） */
export function steelMat(color = COLORS.steel) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.5 });
}
