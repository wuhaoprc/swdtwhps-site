// 水印控制器：以"江河海 JHH" logo 为水印。
// 两种注入方式：
//   1) 实时叠加：每帧把 logo 画到覆盖层 canvas（renderLive），屏幕上始终可见；
//   2) 导出合成：截图/录制动画时 drawOn(...,{tiled:true}) 把 logo 烧录进输出像素；
//      模型导出时额外生成一个带 logo 纹理的平面 + 元信息，水印"内置"于模型。
// 说明：源 PNG 四周带大量透明留白，绘制时按 alpha 有效边界自动裁剪（_trimBox），
//       使可见内容紧贴角标定位框，从而能与界面左上/右下面板外框精确对齐。
import * as THREE from '../../vendor/three.module.js';

export class Watermark {
  constructor(logoSrc, opts = {}) {
    this.opts = Object.assign({
      opacity: 0.50,        // 单层 logo 不透明度
      corner: 'bl',         // 角标位置 tl/tr/bl/br（左下）
      scale: 0.11,          // 导出角标：可见内容高度占画面短边比例（已按裁剪后内容标定）
      liveScale: undefined, // 实时覆盖层角标比例；未指定则取 scale*0.79
      margin: 14,           // 角标边距，与 #panel(left:14px) / #hint(bottom:14px) 外框对齐
      tile: false,          // 是否平铺
      text: '江河海 JIANGHEHAI' // logo 加载失败时的文字兜底（加载中不再显示，避免"文字闪一下"）
    }, opts);
    // 等比例适度缩小：裁掉留白后实时水印可见内容高度≈短边 4.2%、宽度≈短边 13.2%
    // （较上一版线性缩小约 17%）；margin / opacity / scale(导出角标) 均不变，
    // 左/底边缘仍落在 14px 基准线上，清晰可辨且不遮挡全景内容。
    if (this.opts.liveScale == null) this.opts.liveScale = this.opts.scale * 0.38;

    this.img = new Image();
    this.img.crossOrigin = 'anonymous';
    this.loaded = false;
    this.failed = false;    // 图片是否加载失败（仅失败时显示文字兜底）
    this.img.onload = () => { this.loaded = true; };
    this.img.onerror = () => { this.failed = true; };
    this.img.src = logoSrc;

    this._trim = null;
    this._texture = null;
  }

  /** 懒计算 logo 的 alpha 有效边界（降采样扫描，仅算一次），返回源图上的裁剪框 */
  _trimBox() {
    if (this._trim) return this._trim;
    const w = this.img.naturalWidth || this.img.width;
    const h = this.img.naturalHeight || this.img.height;
    if (!w || !h) return (this._trim = { sx: 0, sy: 0, sw: 1, sh: 1, ar: 3.2 });

    const sw = Math.min(512, w), sh = Math.max(1, Math.round(h * sw / w));
    const c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(this.img, 0, 0, sw, sh);
    let d;
    try { d = cx.getImageData(0, 0, sw, sh).data; }
    catch (e) { return (this._trim = { sx: 0, sy: 0, sw: w, sh: h, ar: w / h }); }

    let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (d[(y * sw + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = sw - 1; y1 = sh - 1; }
    const box = {
      sx: x0 / sw * w, sy: y0 / sh * h,
      sw: (x1 - x0 + 1) / sw * w, sh: (y1 - y0 + 1) / sh * h
    };
    box.ar = box.sw / box.sh;
    return (this._trim = box);
  }

  _logoSize(w, h, scaleOverride) {
    const base = Math.min(w, h);
    const s = scaleOverride != null ? scaleOverride : this.opts.scale;
    const ar = this.loaded ? this._trimBox().ar : 3.2;
    return { w: base * s * ar, h: base * s };
  }

  /** 把水印绘制到任意 2D 上下文（用于合成导出或实时覆盖层）
   *  extra.cornerScale：覆盖角标尺寸（用于实时水印与导出角标区分） */
  drawOn(ctx, w, h, extra = {}) {
    const tiled = extra.tiled || this.opts.tile;
    ctx.save();
    if (this.loaded) {
      if (tiled) this._drawTiled(ctx, w, h);
      this._drawCorner(ctx, w, h, extra.cornerScale);
    } else if (this.failed) {
      // 仅在 logo 真正加载失败时才用文字兜底，避免加载过程中"文字闪一下"再被 logo 替换
      this._drawText(ctx, w, h, tiled);
    }
    ctx.restore();
  }

  _drawCorner(ctx, w, h, scaleOverride) {
    const { w: lw, h: lh } = this._logoSize(w, h, scaleOverride);
    const m = this.opts.margin;
    let x = w - lw - m, y = h - lh - m;
    if (this.opts.corner === 'tl') { x = m; y = m; }
    else if (this.opts.corner === 'tr') { x = w - lw - m; y = m; }
    else if (this.opts.corner === 'bl') { x = m; y = h - lh - m; }
    const t = this._trimBox();
    ctx.drawImage(this.img, t.sx, t.sy, t.sw, t.sh, x, y, lw, lh);
  }

  _drawTiled(ctx, w, h) {
    const s = Math.min(w, h) * 0.12;
    const t = this._trimBox();
    const aw = s * t.ar;
    ctx.globalAlpha = this.opts.opacity * 0.45;
    for (let y = 0; y < h; y += s * 1.5) {
      for (let x = 0; x < w; x += aw * 1.5) {
        ctx.drawImage(this.img, t.sx, t.sy, t.sw, t.sh, x, y, aw, s);
      }
    }
    ctx.globalAlpha = this.opts.opacity;
  }

  _drawText(ctx, w, h, tiled) {
    const fs = Math.max(12, Math.round(Math.min(w, h) * 0.03));
    ctx.fillStyle = 'rgba(190,215,245,0.9)';
    ctx.font = `bold ${fs}px "Microsoft YaHei", sans-serif`;
    if (tiled) {
      ctx.globalAlpha = this.opts.opacity * 0.5;
      const stepX = Math.min(w, h) * 0.22, stepY = Math.min(w, h) * 0.12;
      for (let y = fs; y < h; y += stepY)
        for (let x = 0; x < w; x += stepX) ctx.fillText(this.opts.text, x, y);
    } else {
      ctx.fillText(this.opts.text, this.opts.margin, h - this.opts.margin);
    }
  }

  /** 实时覆盖层：每帧调用，清屏后绘制角标（使用较小的 liveScale） */
  renderLive(canvas) {
    if (!canvas || canvas.width === 0) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawOn(ctx, canvas.width, canvas.height, { tiled: false, cornerScale: this.opts.liveScale });
  }

  /** 供 3D 模型导出：返回「已裁掉留白」的 logo 纹理 */
  getTexture() {
    if (!this._texture && this.loaded) {
      const t = this._trimBox();
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(t.sw));
      c.height = Math.max(1, Math.round(t.sh));
      c.getContext('2d').drawImage(this.img, t.sx, t.sy, t.sw, t.sh, 0, 0, c.width, c.height);
      const tex = new THREE.Texture(c);
      tex.needsUpdate = true;
      this._texture = tex;
    }
    return this._texture;
  }
}
