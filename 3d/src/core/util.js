// 通用工具：文件下载、WebM 编码格式探测。
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 探测可用的录制动画编码：优先 WebM（Chromium/Firefox），回退 MP4（Safari/iOS 不支持 WebM）。
 *  返回 { mime, ext } 或 null（浏览器无任何可用编码）。 */
export function pickRecordMime() {
  const cands = [
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
    { mime: 'video/mp4;codecs=h264', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' }
  ];
  if (typeof window === 'undefined' || !window.MediaRecorder) return null;
  for (const c of cands) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return null;
}
