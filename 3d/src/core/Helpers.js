// 通用 3D 辅助：标签、流体粒子、管道、罐体/容器/泵等程序化构件。
// 所有构件均为程序化生成，无需外部模型文件，保证系统自包含可运行。
import * as THREE from '../../vendor/three.module.js';

/** 圆角矩形路径（用于标签底框） */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 生成中文文字标签（Sprite，始终面向相机、不被遮挡）。
 * @returns {THREE.Sprite}
 */
export function makeLabel(text, opts = {}) {
  const {
    fontSize = 46, color = '#eaf4ff',
    bg = 'rgba(8, 26, 46, 0.78)', border = 'rgba(120,180,230,0.5)',
    padding = 16, maxWidth = 620
  } = opts;

  const font = `bold ${fontSize}px "Microsoft YaHei","PingFang SC",sans-serif`;
  // 先用临时画布测量宽度
  const tmp = document.createElement('canvas').getContext('2d');
  tmp.font = font;
  const raw = tmp.measureText(text).width;
  const w = Math.min(raw + padding * 2, maxWidth);
  const h = fontSize + padding * 2;

  // 超采样：以 3× 分辨率绘制画布，但世界尺寸仍按逻辑尺寸计算 →
  // 相同屏占比下纹理像素提升至 9 倍，文字边缘与笔画更锐利、缩小/放大都不糊。
  const SS = 3;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.ceil(w * SS));
  canvas.height = Math.max(2, Math.ceil(h * SS));
  const ctx = canvas.getContext('2d');
  ctx.scale(SS, SS);                 // 之后全部用逻辑坐标 (w,h) 绘制
  ctx.font = font;
  roundRect(ctx, 1, 1, w - 2, h - 2, 14);
  ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = border; ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // 若超宽则按比例缩小字号重绘
  if (raw + padding * 2 > maxWidth) {
    const f2 = Math.floor(fontSize * (maxWidth - padding * 2) / (raw + padding * 2));
    ctx.font = `bold ${f2}px "Microsoft YaHei","PingFang SC",sans-serif`;
  }
  ctx.fillText(text, w / 2, h / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  // 三线性 (mipmap) 过滤：全景下标签被大幅缩小时也能平滑过渡、消除锯齿；
  // 各向异性取渲染器上限，避免斜向采样模糊；画布已 2× 超采样，清晰度显著提升。
  tex.anisotropy = MAX_ANISO;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  const s = 0.012; // 像素→世界单位（基于逻辑尺寸，与超采样无关）
  sprite.scale.set(w * s, h * s, 1);
  sprite.renderOrder = 999;
  return sprite;
}

// 标签纹理各向异性上限（由 configureLabelQuality 注入渲染器真实值；默认 8 兜底）
let MAX_ANISO = 8;

/** 在 App 初始化后调用，注入渲染器以读取最大各向异性，提升标签清晰度 */
export function configureLabelQuality(renderer) {
  if (renderer && renderer.capabilities && typeof renderer.capabilities.getMaxAnisotropy === 'function') {
    MAX_ANISO = renderer.capabilities.getMaxAnisotropy() || 8;
  }
}

/**
 * 两点之间的管道（圆柱体）。
 */
export function makePipe(p1, p2, radius = 0.18, material) {
  const a = new THREE.Vector3().copy(p1);
  const b = new THREE.Vector3().copy(p2);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 20, 1, false);
  const mat = material || new THREE.MeshStandardMaterial({ color: 0x9fb6cc, metalness: 0.4, roughness: 0.5 });
  const mesh = new THREE.Mesh(geo, mat);
  // 默认圆柱沿 Y 轴，旋转对齐到 dir
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  mesh.quaternion.copy(quat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  return mesh;
}

/** 立式罐体（圆柱 + 顶盖） */
export function makeTank(radius = 1, height = 2.4, color = 0x6f86a8, opacity = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color, metalness: 0.3, roughness: 0.55,
    transparent: opacity < 1, opacity, side: THREE.DoubleSide
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32, 1, true), mat);
  body.position.y = height / 2;
  const top = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  top.position.y = height;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), mat);
  bottom.rotation.x = -Math.PI / 2;
  g.add(body, top, bottom);
  g.userData.material = mat;
  return g;
}

/** 卧式压力容器（水平圆柱） */
export function makeVessel(length = 4, radius = 0.5, color = 0xb9c6d8) {
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4 });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 28), mat);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

/** 泵/电机（箱体 + 圆柱） */
export function makePump(color = 0xf2b134) {
  const g = new THREE.Group();
  const motor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.9, 24),
    new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 })
  );
  motor.rotation.z = Math.PI / 2;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.3, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x44546a, metalness: 0.3, roughness: 0.7 })
  );
  base.position.y = -0.55;
  g.add(motor, base);
  return g;
}

/**
 * 流体粒子流：沿一条折线（CatmullRom 曲线）循环的发光小球，表达"流向"。
 */
export class Flow {
  constructor(points, opts = {}) {
    const { count = 22, color = 0x33b5ff, size = 0.16, speed = 0.12, emissive = color } = opts;
    this.curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3().copy(p)));
    this.speed = speed;
    this.phase = Math.random();
    this.group = new THREE.Group();
    const geo = new THREE.SphereGeometry(size, 10, 10);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1
    });
    this.items = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      this.group.add(m);
      this.items.push(m);
    }
  }
  update(dt) {
    this.phase = (this.phase + dt * this.speed) % 1;
    const n = this.items.length;
    for (let i = 0; i < n; i++) {
      const t = (this.phase + i / n) % 1;
      const p = this.curve.getPointAt(t);
      this.items[i].position.copy(p);
    }
  }
}

/**
 * 沿折线（数组 of Vector3）生成连续管道：每段用 makePipe，拐角处补球使连接平滑。
 * @returns {THREE.Group}
 */
export function makePipeRun(points, radius = 0.18, material) {
  const g = new THREE.Group();
  const mat = material || new THREE.MeshStandardMaterial({ color: 0x9fb6cc, metalness: 0.4, roughness: 0.5 });
  for (let i = 0; i < points.length - 1; i++) {
    g.add(makePipe(points[i], points[i + 1], radius, mat));
  }
  for (let i = 1; i < points.length - 1; i++) {
    const j = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.18, 16, 12), mat);
    j.position.copy(points[i]);
    g.add(j);
  }
  return g;
}

/** 阀门（阀体 + 手轮），用于管线上的可识别节点 */
export function makeValve(color = 0xcfd8e3) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 })
  );
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.3, 12),
    new THREE.MeshStandardMaterial({ color: 0x8a95a6, metalness: 0.5, roughness: 0.5 })
  );
  stem.position.y = 0.32;
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.05, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a95a6, metalness: 0.5, roughness: 0.5 })
  );
  wheel.position.y = 0.5; wheel.rotation.x = Math.PI / 2;
  g.add(body, stem, wheel);
  return g;
}

/** 压力表（盘面朝 +Z），挂在泵/容器上做细节 */
export function makeGauge(color = 0xe8eef6) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20),
    new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4 })
  );
  m.rotation.x = Math.PI / 2;
  return m;
}

/** 半透明水体块（海面/水池/浓水），表达"水"而非结构 */
export function makeWaterBox(w, h, d, color = 0x1f6fd6, opacity = 0.42) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color, transparent: true, opacity,
      roughness: 0.15, metalness: 0.0, side: THREE.DoubleSide
    })
  );
  return m;
}

/** 设备支架（钢框架，用细方管搭出镂空感） */
export function makeSkid(w, h, d, color = 0x55657c) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.5 });
  const t = 0.08;
  const posts = [
    [-w/2, -d/2], [w/2, -d/2], [-w/2, d/2], [w/2, d/2]
  ];
  for (const [x, z] of posts) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(t, h, t), mat);
    post.position.set(x, h/2, z);
    g.add(post);
  }
  // 顶框
  const topY = h;
  const bx = new THREE.Mesh(new THREE.BoxGeometry(w, t, t), mat); bx.position.y = topY; g.add(bx);
  const bz = new THREE.Mesh(new THREE.BoxGeometry(t, t, d), mat); bz.position.y = topY; g.add(bz);
  // 底框
  const bbx = new THREE.Mesh(new THREE.BoxGeometry(w, t, t), mat); bbx.position.y = 0.3; g.add(bbx);
  const bbz = new THREE.Mesh(new THREE.BoxGeometry(t, t, d), mat); bbz.position.y = 0.3; g.add(bbz);
  return g;
}

