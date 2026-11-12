// 应用编排器：连接场景、水印、导出器与 UI，驱动主循环。
import * as THREE from '../../vendor/three.module.js';
import { SceneManager } from './SceneManager.js';
import { configureLabelQuality } from './Helpers.js';
import { renderFallback } from './Fallback.js';
import { Watermark } from './Watermark.js';
import { Exporter } from './Exporter.js';
import { UI } from '../ui/UI.js';
import { SEGMENTS } from '../segments/index.js';

export class App {
  constructor(root) {
    this.stage = root.querySelector('#stage');
    const loading = root.querySelector('#loading');
    let failed = false;

    // WebGL 探测前置：不支持则走 2D 降级流程图，避免白屏/报错。
    // new App() 必然返回实例，故 window.__desalApp 会被赋值，index.html 的
    // 4 秒"加载超时"安全网不会在降级视图下误触发。
    if (!SceneManager.detectWebGL()) {
      if (loading) loading.remove();
      renderFallback(this.stage);
      return;
    }

    try {
      // 一 初始化 three.js 场景（内部已含 WebGL 探测，此处已提前确认通过）
      this.sm = new SceneManager(this.stage);
      configureLabelQuality(this.sm.renderer);   // 注入渲染器，提升标签纹理各向异性上限
      this.wmCanvas = root.querySelector('#wm-canvas');
      // 水印参数统一在 Watermark.js 内配置（角标尺寸/边距/对齐），此处不再传参覆盖，
      // 避免出现"改了默认参数却不生效"的双份配置问题。
      this.wm = new Watermark('./assets/watermark.png');
      this.exporter = new Exporter(this.sm, this.wm);

      // 二 构建 UI（工艺段按钮 + 导出按钮 + HUD）
      this.ui = new UI({
        segments: SEGMENTS,
        onSelect: id => this.select(id),
        onScreenshot: () => this.exporter.screenshot(),
        onRecord: () => this.exporter.record(6),
        onModel: () => { if (this.current) this.exporter.exportGLTF(this.current.group); },
        onTour: () => this.toggleTour(),
        onEast: () => this.focusEast()
      });

      this.current = null;
      this.clock = new THREE.Clock();
      this._loop = this._loop.bind(this);

      // 自动巡游状态机：循环 总览 → 七段 → 全景，每段停留 hold 毫秒
      this.tour = {
        active: false, idx: -1, nextMs: 0, hold: 4600,
        seq: ['overview', 'intake', 'pretreatment', 'uf', 'hp_erd', 'ro', 'post', 'brine', 'plant']
      };

      this._syncWm();
      window.addEventListener('resize', () => this._syncWm());

      // 三 加载首个工艺段（厂区全景，唯一主界面）
      this.select(SEGMENTS[0].id);
      this._bindPicking();

      // 四 初始化成功 → 移除"正在加载"遮罩，启动主循环
      if (loading) loading.remove();
      requestAnimationFrame(this._loop);
    } catch (err) {
      // 任何一处初始化失败都给出具体可见的错误，而不是静默卡在"正在加载"
      failed = true;
      console.error('[Desal3D] 初始化失败:', err);
      if (loading) {
        loading.textContent = '⚠ 初始化失败：' + (err && err.message ? err.message : err) +
          '\n\n请打开浏览器控制台（F12）查看完整堆栈。';
        loading.style.color = '#ff9a9a';
        loading.style.whiteSpace = 'pre-wrap';
        loading.style.padding = '24px';
        loading.style.textAlign = 'left';
        loading.style.fontSize = '14px';
      }
    }
    // 若失败则不移除 loading（作为错误提示面板保留），成功时已在上面移除
    void failed;
  }

  _syncWm() {
    const gl = this.sm.canvas;
    if (this.wmCanvas.width !== gl.width || this.wmCanvas.height !== gl.height) {
      this.wmCanvas.width = gl.width;
      this.wmCanvas.height = gl.height;
    }
  }

  select(id) {
    const def = SEGMENTS.find(s => s.id === id);
    if (!def) return;
    this.stopTour();   // 用户手动切换工艺段 → 退出巡游，交还控制权
    const cur = this.current;

    // 厂区全景是唯一主界面：点击工艺段（按钮或厂房）只在场景内聚焦，不重建界面
    if (cur && cur.getInfo().id === 'plant' && typeof cur.focus === 'function') {
      // 统一交互指令：左侧导航「全流程总览」必须走与「点击展馆」完全相同的命令，
      // 保证两条触发路径的镜头行为、动画参数与状态更新逐项一致。
      if (id === 'overview') return this.runCommand('focusOverview');
      if (id === 'plant') {
        cur.resetView();
        this._flyTo(cur.getInfo().view);
      } else {
        cur.focus(id);
        const v = cur.viewFor(id);
        if (v) this._flyTo(v);
      }
      this.ui.setActive(id);
      this.ui.showInfo(id === 'plant' ? cur.getInfo() : cur.infoFor(id));
      return;
    }

    // 首次构建场景
    if (this.current) {
      this.current.dispose();
      this.sm.remove(this.current.group);
      this.current = null;
    }
    const seg = def.factory();
    seg.build();
    this.current = seg;
    const info = seg.getInfo();
    this.sm.add(seg.group);
    this.sm.applyShadows();
    // 厂区等自带完整地形的大场景隐藏通用地面/网格，避免其穿过起伏海面形成黑色斑块
    const large = !!info.view;
    this.sm.ground.visible = !large;
    if (this.sm.grid) this.sm.grid.visible = !large;
    // 大尺度场景可声明雾距与自定义取景；其余段沿用默认雾 + 包围盒自动取景
    this.sm.scene.fog.near = info.fog ? info.fog.near : 50;
    this.sm.scene.fog.far = info.fog ? info.fog.far : 140;
    if (info.view) this._applyView(info.view);
    else this.sm.frameGroup(seg.group);
    this.ui.setActive(id);
    this.ui.showInfo(info);
  }

  /** 立即应用一个视角配置 */
  _applyView(view) {
    const c = new THREE.Vector3().fromArray(view.target);
    // 窄视口下把全景视角按水平视野反算拉远；宽视口原样返回（桌面取景不变）
    const opts = { fit: view.fit, width: view.fitWidth };
    const dist = this.sm.fitDistance(view.dist, opts);
    const d = new THREE.Vector3().fromArray(view.dir).normalize().multiplyScalar(dist);
    this.sm.controls.target.copy(c);
    this.sm.camera.position.copy(c).add(d);
    this.sm.camera.near = 0.1;
    this.sm.camera.far = view.far || 900;
    this.sm.camera.updateProjectionMatrix();
    this.sm.controls.update();
    this.sm.rememberFrame(view.dist, opts);
    this._camAnim = null;
  }

  /** 平滑飞向视角（点击工艺段时的聚焦动画） */
  _flyTo(view) {
    const c = new THREE.Vector3().fromArray(view.target);
    const opts = { fit: view.fit, width: view.fitWidth };
    const dist = this.sm.fitDistance(view.dist, opts);
    const d = new THREE.Vector3().fromArray(view.dir).normalize().multiplyScalar(dist);
    this._camAnim = {
      p0: this.sm.camera.position.clone(), p1: c.clone().add(d),
      t0: this.sm.controls.target.clone(), t1: c, k: 0
    };
    this.sm.camera.far = view.far || 900;
    this.sm.camera.updateProjectionMatrix();
    this.sm.rememberFrame(view.dist, opts);
  }

  /**
   * 东侧园区专用视角（S1 会签 v2）：两厂前后两排 + 扩地后，默认全景下东侧园区靠近
   * 右上 HUD 边缘，用本视角一键把市政水厂 / 外部用水工厂 / 罐装厂一并居中取景。
   * 复用 _flyTo，与既有工艺段聚焦动画同构；手动选择工艺段仍会自动停止巡游。
   */
  focusEast() {
    if (typeof this.stopTour === 'function') this.stopTour();
    if (!this.current || this.current.getInfo().id !== 'plant') this.select('plant');
    this._flyTo({ target: [80, 2, -21], dir: [0.18, 0.62, 1.0], dist: 155, far: 1400, fit: true, fitWidth: 135 });
  }

  // --------------------------------------------------------------------------
  // 统一交互指令：聚焦「全流程总览展馆」
  // --------------------------------------------------------------------------

  /**
   * 左侧导航「全流程总览」（经 select('overview') 转发）与场景内点击
   * 「全流程总览展馆」（经 _bindPicking 转发）共用这一条指令，因此两者的
   * 镜头行为、缓动曲线、聚焦取景与 HUD 状态完全一致。
   *
   * 幂等设计：同一指令的动画在途时直接返回、已到位时不再重启，
   * 动画对象始终只有一个（新的替换旧的且从当前帧相机状态起算），
   * 因此重复触发不会叠加、冲突或产生跳变。
   */
  runCommand(name) {
    if (name !== 'focusOverview') return;
    const cur = this.current;
    // 非融合主场景时退回原有构建逻辑（此分支不会再转发，故无递归）
    if (!cur || cur.getInfo().id !== 'plant' || typeof cur.focus !== 'function') {
      this.select('overview');
      return;
    }
    // 状态副作用与既有 select('overview') 完全相同，重复调用结果一致
    cur.focus('overview');
    this.ui.setActive('overview');
    this.ui.showInfo(cur.infoFor('overview'));

    const view = typeof cur.overviewView === 'function'
      ? cur.overviewView(this.sm.camera)
      : cur.viewFor('overview');
    if (!view) return;
    // 幂等守卫：同指令在途 → 不叠加；静止且已到位 → 不重启
    if (this._camAnim && this._camAnim.key === 'focusOverview') return;
    if (!this._camAnim && this._atView(view)) return;
    this._flyArc(view, 'focusOverview');
  }

  /** 相机是否已停在目标视角（用于重复触发时跳过无意义的重启） */
  _atView(view) {
    const c = new THREE.Vector3().fromArray(view.target);
    const p = c.clone().add(new THREE.Vector3().fromArray(view.dir).normalize().multiplyScalar(view.dist));
    // 容差 0.5：容纳 OrbitControls 阻尼带来的亚像素级残留，避免"已到位仍重启"
    // （相对取景距离 ~23 仅 2%，用户手动转动视角后仍会重新聚焦）
    return this.sm.camera.position.distanceTo(p) < 0.5 &&
           this.sm.controls.target.distanceTo(c) < 0.5;
  }

  /**
   * 球面弧线飞行：把相机相对焦点 target 的偏移分解为球坐标
   * (半径 r, 方位角 theta, 极角 phi)，对三者分别插值并同步插值 target。
   * 相机沿一条连续弧线「旋转」到展馆正前方，而不是直线穿过厂区。
   *   · 起点取当前帧真实相机状态 → 中途打断/替换均无跳变
   *   · 方位角走最短弧 → 不会绕远圈
   *   · 半径按指数插值 → 推进视觉匀速
   *   · 极角钳制在 maxPolarAngle 内 → 避免 OrbitControls 夹取造成跳变
   */
  _flyArc(view, key) {
    const cam = this.sm.camera, ctl = this.sm.controls;
    const t1 = new THREE.Vector3().fromArray(view.target);
    const d1 = new THREE.Vector3().fromArray(view.dir).normalize().multiplyScalar(view.dist);
    const t0 = ctl.target.clone();
    const s0 = new THREE.Spherical().setFromVector3(cam.position.clone().sub(t0));
    const s1 = new THREE.Spherical().setFromVector3(d1);
    let dTheta = s1.theta - s0.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;
    const phiMax = Math.min(ctl.maxPolarAngle - 0.02, Math.PI * 0.49);
    this._camAnim = {
      // 按墙钟时间推进：低帧率/软件渲染环境下仍严格在 dur 内到位，不会被 dt 钳制拉长
      mode: 'arc', key, dur: 1.15, k: 0, startMs: performance.now(),
      r0: Math.max(0.1, s0.radius), r1: Math.max(0.1, s1.radius),
      th0: s0.theta, dTheta,
      phi0: THREE.MathUtils.clamp(s0.phi, 0.05, phiMax),
      phi1: THREE.MathUtils.clamp(s1.phi, 0.05, phiMax),
      t0, t1
    };
    cam.far = Math.max(cam.far, view.far || 900);
    cam.updateProjectionMatrix();
  }

  // --------------------------------------------------------------------------
  // 自动巡游模式：循环切换 总览 → 七段 → 全景，复用既有 _flyArc / _flyTo 飞行
  // --------------------------------------------------------------------------

  toggleTour() {
    this.tour.active = !this.tour.active;
    this.ui.setTour(this.tour.active);
    if (this.tour.active) {
      // 从「总览」之前开始，1.2s 后落到第一个视角，给当前画面一个缓冲
      this.tour.idx = -1;
      this.tour.nextMs = performance.now() + 1200;
    }
  }

  stopTour() {
    if (!this.tour || !this.tour.active) return;
    this.tour.active = false;
    if (this.ui) this.ui.setTour(false);
  }

  /** 巡游内部跳转：不走 select()（避免递归与误停止巡游），直接调用既有指令 */
  _tourGoto(id) {
    const cur = this.current;
    if (!cur || cur.getInfo().id !== 'plant') return;
    if (id === 'overview') return this.runCommand('focusOverview');
    if (id === 'plant') {
      cur.resetView();
      this._flyTo(cur.getInfo().view);
      this.ui.setActive('plant');
      this.ui.showInfo(cur.getInfo());
      return;
    }
    cur.focus(id);
    const v = cur.viewFor(id);
    if (v) this._flyTo(v);
    this.ui.setActive(id);
    this.ui.showInfo(cur.infoFor(id));
  }

  /** 鼠标点击厂房 → 聚焦对应工艺段（拖拽旋转不触发） */
  _bindPicking() {
    const canvas = this.sm.canvas;
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      // 触摸屏单指已是平移操作，手指抖动阈值放宽，避免轻微移动就丢掉点击选中
      if (moved > (e.pointerType === 'touch' ? 12 : 5)) return;
      const cur = this.current;
      if (!cur || cur.getInfo().id !== 'plant' || typeof cur.pickTargets !== 'function') return;
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, this.sm.camera);
      const hits = ray.intersectObjects(cur.pickTargets(), false);
      const sid = hits.length ? hits[0].object.userData.segmentId : null;
      if (!sid) return;
      // 展馆与左侧导航共用同一条指令；其余工艺段保持原有交互不变
      if (sid === 'overview') this.runCommand('focusOverview');
      else this.select(sid);
    });
  }

  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    // 滚轮放大后右键拖动更快跟手：OrbitControls 的 pan 位移与相机到焦点距离成正比，
    // 放大后距离变小、平移自然变慢，这里按距离动态补偿 panSpeed。
    // 全景距离(≈115)时保持默认值 1 → 未缩放时交互完全不变；
    // 距离越小补偿倍率越大，但上限压到 4.5、斜率由 8 降到 3.5，
    // 使放大浏览既快速又跟手可控，不会因速度过快而难以对准；
    // 仅影响右键平移，不改 mouseButtons / 旋转 / 缩放 / 阻尼。
    const ctl = this.sm.controls;
    const camDist = this.sm.camera.position.distanceTo(ctl.target);
    ctl.panSpeed = THREE.MathUtils.clamp(1 + (115 - camDist) / 115 * 3.5, 1, 4.5);

    if (this.current) this.current.update(dt, t);
    // 平滑聚焦动画（在同一场景内飞行，不切换界面）
    // 线性模式：七段 / 全景恢复沿用原有 0.6s ease-out 直线飞行，行为完全不变；
    // 弧线模式：仅 focusOverview 指令使用，1.15s ease-in-out 球面旋转（两端速度为 0，无跳变）。
    if (this._camAnim) {
      const a = this._camAnim;
      a.k = a.mode === 'arc'
        ? Math.min(1, (performance.now() - a.startMs) / (a.dur * 1000))
        : Math.min(1, a.k + dt / 0.6);
      const e = a.mode === 'arc'
        ? (a.k < 0.5 ? 4 * a.k * a.k * a.k : 1 - Math.pow(-2 * a.k + 2, 3) / 2)
        : 1 - Math.pow(1 - a.k, 3);
      if (a.mode === 'arc') {
        const r = a.r0 * Math.pow(a.r1 / a.r0, e);              // 指数缩放
        const th = a.th0 + a.dTheta * e;                          // 方位角最短弧
        const ph = THREE.MathUtils.lerp(a.phi0, a.phi1, e);       // 极角
        const tgt = new THREE.Vector3().lerpVectors(a.t0, a.t1, e);
        this.sm.controls.target.copy(tgt);
        this.sm.camera.position.copy(tgt)
          .add(new THREE.Vector3().setFromSphericalCoords(r, ph, th));
      } else {
        this.sm.camera.position.lerpVectors(a.p0, a.p1, e);
        this.sm.controls.target.lerpVectors(a.t0, a.t1, e);
      }
      if (a.k >= 1) {
        this._camAnim = null;
        // 飞行到位 → 设定本段停留截止时间，巡游在停留结束后自动切下一段
        if (this.tour && this.tour.active) this.tour.nextMs = performance.now() + this.tour.hold;
      }
    }

    // 自动巡游：仅在「厂区全景」主场景且当前无飞行动画、且已过停留截止时间时，
    // 推进到序列中的下一段（复用 _tourGoto → runCommand/focus + _flyArc/_flyTo）。
    if (this.tour && this.tour.active && !this._camAnim &&
        this.current && this.current.getInfo().id === 'plant' &&
        performance.now() > this.tour.nextMs) {
      this.tour.idx = (this.tour.idx + 1) % this.tour.seq.length;
      this._tourGoto(this.tour.seq[this.tour.idx]);
    }

    // 标注联动：随滚轮缩放 / 鼠标旋转调整标签大小与倾角
    if (this.current && typeof this.current.syncLabels === 'function') this.current.syncLabels(this.sm.camera);
    this.sm.render();
    this._syncWm();
    this.wm.renderLive(this.wmCanvas);
  }
}
