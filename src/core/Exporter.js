// 导出器：所有导出（截图 / 动画 / 3D 模型）均经过 Watermark 注入水印。
import * as THREE from '../../vendor/three.module.js';
import { GLTFExporter } from '../../vendor/GLTFExporter.js';
import { download, pickRecordMime } from './util.js';

export class Exporter {
  constructor(sceneManager, watermark) {
    this.sm = sceneManager;
    this.wm = watermark;
  }

  /** 截图：合成 3D 画面 + 角标 + 平铺水印 → PNG */
  screenshot() {
    const gl = this.sm.canvas;
    const c = document.createElement('canvas');
    c.width = gl.width; c.height = gl.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(gl, 0, 0);
    this.wm.drawOn(ctx, c.width, c.height, { tiled: true });
    c.toBlob(b => download(b, `江河海_海水淡化_${Date.now()}.png`), 'image/png');
  }

  /** 录制动画：对合成画布（含水印）captureStream → WebM(Chromium/Firefox) 或 MP4(Safari 回退) */
  async record(seconds = 6, fps = 30) {
    if (typeof MediaRecorder === 'undefined') {
      alert('当前浏览器不支持 MediaRecorder，无法录制动画。');
      return;
    }
    const pick = pickRecordMime();
    if (!pick) {
      alert('当前浏览器未提供可用的视频编码（既不支持 WebM 也不支持 MP4），无法录制动画。');
      return;
    }
    const gl = this.sm.canvas;
    const out = document.createElement('canvas');
    out.width = gl.width; out.height = gl.height;
    const ctx = out.getContext('2d');
    const stream = out.captureStream(fps);
    const rec = new MediaRecorder(stream, { mimeType: pick.mime });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(res => { rec.onstop = res; });

    rec.start();
    const start = performance.now();
    const tick = () => {
      ctx.drawImage(gl, 0, 0);
      this.wm.drawOn(ctx, out.width, out.height, { tiled: true });
      if (performance.now() - start < seconds * 1000) requestAnimationFrame(tick);
      else rec.stop();
    };
    requestAnimationFrame(tick);
    await done;
    download(
      new Blob(chunks, { type: pick.mime }),
      `江河海_海水淡化_动画_${Date.now()}.${pick.ext}`
    );
  }

  /** 导出 3D 模型（glTF/glb）：克隆场景 + 内置 logo 平面 + 元信息水印 */
  exportGLTF(group, filename) {
    const exporter = new GLTFExporter();
    const exportRoot = new THREE.Group();
    exportRoot.add(group.clone(true));

    const tex = this.wm.getTexture();
    if (tex) {
      const box = new THREE.Box3().setFromObject(exportRoot);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const pw = Math.max(size.x * 0.4, 2);
      const ph = pw * (tex.image.height / tex.image.width);
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
      plane.position.set(
        center.x + size.x / 2 + 0.6,
        center.y + size.y / 2 - ph / 2,
        center.z + size.z / 2 + 0.6
      );
      exportRoot.add(plane);
    }

    // 元信息水印（写入 glTF 的 extras，可追溯来源与版权）
    exportRoot.userData.watermark = {
      author: '江河海 JIANGHEHAI',
      logo: 'JHH.jpg',
      exportedBy: '江河海·海水淡化全流程3D模拟系统',
      note: '本模型含 JHH 水印，未经授权不得用于商业用途。'
    };

    exporter.parse(
      exportRoot,
      (result) => {
        if (result instanceof ArrayBuffer) {
          download(new Blob([result], { type: 'model/gltf-binary' }),
            `${filename || '江河海_海水淡化_模型_' + Date.now()}.glb`);
        } else {
          download(new Blob([JSON.stringify(result, null, 2)], { type: 'model/gltf+json' }),
            `${filename || '江河海_海水淡化_模型_' + Date.now()}.gltf`);
        }
      },
      (err) => { console.error('glTF 导出失败：', err); alert('模型导出失败，详见控制台。'); },
      { binary: true }
    );
  }
}
