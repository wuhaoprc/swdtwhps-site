// 程序入口：待 DOM 就绪后启动应用。
import { App } from './core/App.js';

function boot() {
  // eslint-disable-next-line no-new
  window.__desalApp = new App(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
