// 场景管理器：封装 three.js 渲染器、相机、轨道控制器、灯光与地面。
// 每个工艺段以独立 Group 形式加入/移出场景，互不干扰，便于单独完善。
import * as THREE from '../../vendor/three.module.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';

export class SceneManager {
  constructor(container) {
    this.container = container;

    // 【初始化加固】先探测 WebGL，避免在不支持的环境下白屏崩溃
    const glSupport = SceneManager.detectWebGL();
    if (!glSupport) {
      throw new Error('当前环境不支持 WebGL，无法初始化 three.js 3D 场景。请使用支持 WebGL 的现代浏览器，或开启硬件加速。');
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    // 色彩空间（three r152+ 推荐显式声明，保证贴图/材质颜色正确）
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // 电影级色调映射：高光更柔和、整体色彩更通透（场景美化关键）
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // 曝光略压（1.05→0.95）：配合新增 PMREM 环境补光与降低的半球光，
    // 避免建筑立面发白、保留暗部体积感。
    this.renderer.toneMappingExposure = 0.95;
    // 软阴影：增强设备体积感与落地感（场景美化关键）
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x0b1220, 1);
    // 渲染画布插入到水印层之下
    container.insertBefore(this.renderer.domElement, container.firstChild);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0b1220, 50, 140);
    // 渐变天空背景（贴合深色主题，避免纯色死板）
    this.scene.background = this._makeSky();
    // 免费 IBL：用渐变画布生成等距柱状环境贴图，经 PMREM 处理后作为
    // scene.environment，给玻璃管道 / 钢结构 / 设备提供可信的环境反射与
    // 柔和补光，不依赖任何 HDR 文件（约 10 行，零素材）。
    this.scene.environment = this._makeEnvironment();

    this.camera = new THREE.PerspectiveCamera(
      55, container.clientWidth / container.clientHeight, 0.1, 1000
    );
    this.camera.position.set(14, 11, 18);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    // 触摸操作按移动端习惯改写：单指平移（拖动画面看局部），双指拖动改为旋转；
    // TWO 用 DOLLY_ROTATE 而非默认 DOLLY_PAN —— 双指捏合/分开仍为缩放，双指平移变为旋转。
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };

    // 灯光：三层布光（天光 + 主光 + 边缘光），并把环境光压低以保留体积感
    // 半球光由 0.9 降至 0.55（新增 PMREM IBL 已承担大部分环境补光，避免发白）
    this.scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x202838, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 1.25);
    dir.position.set(14, 22, 12);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    Object.assign(dir.shadow.camera, { near: 1, far: 220, left: -55, right: 55, top: 55, bottom: -55 });
    dir.shadow.bias = -0.0004; dir.shadow.normalBias = 0.02;
    this.scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0x9fc0ff, 0.5);
    dir2.position.set(-14, 9, -12);
    this.scene.add(dir2);
    // 边缘光（rim）：自背侧低位补一束冷光，勾勒建筑 / 设备轮廓，增强立体感
    const rim = new THREE.DirectionalLight(0xbfd8ff, 0.6);
    rim.position.set(-6, 11, -22);
    this.scene.add(rim);

    // 地面 + 网格（接收阴影，增强落地感）
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ color: 0x101b2e, roughness: 0.95, metalness: 0.0 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.01;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    const grid = new THREE.GridHelper(300, 120, 0x2a3a55, 0x16243a);
    grid.position.y = 0.002;
    this.grid = grid; // 保存引用：厂区等自带完整地形的大场景可隐藏通用地面/网格
    this.scene.add(grid);

    window.addEventListener('resize', () => this.resize());
  }

  add(group) { this.scene.add(group); }
  remove(group) { if (group) this.scene.remove(group); }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // 竖屏/窄视口：旋转屏幕后按新的宽高比重新反算取景距离，避免左右被裁
    if (this._frame) this._applyFitDistance();
  }

  /**
   * 窄视口（aspect < 1.2）下按水平视野反算取景距离。
   * 透视相机的垂直 FOV 固定，窗口变窄时水平 FOV 会同步收窄，画面左右被裁；
   * 这里把相机按比例拉远，使「width 个世界单位」刚好装满画面宽度。
   * 只有声明了 fit 的全景视角参与计算：近景工艺段（dist 20 左右）按其原距离，
   * 否则会被错误的拉远（场景里含远山/海面，包围盒不可用于反算）。
   * 宽视口（aspect ≥ 1.2）原样返回 base，桌面取景完全不变。
   * @param {number} base 原有取景距离
   * @param {{fit?:boolean, width?:number}} opts 取景参数
   */
  fitDistance(base, opts) {
    const o = opts || {};
    const aspect = this.camera.aspect || 1;
    if (!o.fit || aspect >= 1.2) return base;
    const tanV = Math.tan(((this.camera.fov * Math.PI) / 180) / 2);
    const want = (o.width || 100) * 0.53 / (tanV * aspect);
    // 上限 2.5 倍，防止极窄横比把镜头甩到远处
    return Math.max(base, Math.min(want, base * 2.5));
  }

  /** 记住本次取景的基准距离与参数，供 resize（旋转屏幕）后重算 */
  rememberFrame(base, opts) {
    this._frame = { base, opts: opts || {} };
  }

  /** 保留当前观察方向与目标点，只把相机推到新的取景距离 */
  _applyFitDistance() {
    const { base, opts } = this._frame;
    const dist = this.fitDistance(base, opts);
    const dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-6) return;
    dir.setLength(dist);
    this.camera.position.copy(this.controls.target).add(dir);
    this.camera.near = Math.max(0.1, dist / 100);
    this.camera.far = Math.max(this.camera.far, dist * 10 + 300);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /** 生成竖直渐变天空纹理（深蓝→近黑），作为场景背景 */
  _makeSky() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, '#10233d');
    g.addColorStop(0.55, '#0a1322');
    g.addColorStop(1.0, '#05080f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * 免费 IBL：用一张 512×256 竖向渐变画布当作等距柱状（equirectangular）环境，
   * 经 PMREMGenerator 预过滤为 mip 链环境贴图，赋给 scene.environment。
   * 这样所有 MeshStandardMaterial（玻璃管道 / 钢结构 / 设备）都能获得可信的
   * 天光反射与柔和漫反射补光，无需任何 HDR 文件。天顶偏亮、地平线压暗，
   * 既提供高光又不至于整体过曝。
   */
  _makeEnvironment() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, '#a9cdee');   // 天顶：偏亮冷色，提供玻璃/金属高光
    g.addColorStop(0.5, '#557498');   // 中部：地平线过渡
    g.addColorStop(1.0, '#16222f');   // 地面：压暗，避免地面反射过曝
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    pmrem.dispose();
    return env;
  }

  /** 为场景内实体网格开启阴影投射（半透明水体/水面除外）；地面接收阴影 */
  applyShadows() {
    this.scene.traverse(obj => {
      if (!obj.isMesh) return;
      // 大尺度地形/水面/植被可声明 noShadow，避免超出阴影相机范围造成的黑色伪影
      if (obj.userData && obj.userData.noShadow) { obj.castShadow = false; obj.receiveShadow = false; return; }
      if (obj === this.ground) { obj.castShadow = false; obj.receiveShadow = true; return; }
      const m = obj.material;
      const transparent = m && (m.transparent === true) && (m.opacity == null || m.opacity < 0.92);
      if (transparent) { obj.castShadow = false; obj.receiveShadow = false; }
      else { obj.castShadow = true; obj.receiveShadow = false; }
    });
    if (this.ground) this.ground.receiveShadow = true;
  }

  /** 依据 group 包围盒自动取景，使切换工艺段时视角合理 */
  frameGroup(group) {
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const base = Math.max(size.x, size.y, size.z) * 1.5 + 6;
    // 段内对象自成一个局部包围盒（不含远山/海面），可安全按水平视野反算
    const opts = { fit: true, width: Math.max(size.x, size.z) };
    const dist = this.fitDistance(base, opts);
    this.rememberFrame(base, opts);
    this.controls.target.copy(center);
    const dir = new THREE.Vector3(1, 0.75, 1.25).normalize();
    this.camera.position.copy(center).add(dir.multiplyScalar(dist));
    this.camera.near = Math.max(0.1, dist / 100);
    this.camera.far = dist * 10 + 300;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  get canvas() { return this.renderer.domElement; }

  /** 静态方法：探测运行环境是否支持 WebGL。
   *  注意：不要依赖 window.WebGLRenderingContext——该全局在部分浏览器/WebView 中
   *  已被移除或返回 undefined，会导致"明明支持 WebGL 却误判为不支持"的假阴性。
   *  直接尝试 getContext 才是可靠的探测方式。 */
  static detectWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }
}
