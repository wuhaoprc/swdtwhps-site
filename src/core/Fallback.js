// WebGL 不可用时的 2D 工艺流程图降级视图（避免白屏）。
// 纯 HTML/CSS，无 three.js 依赖；仅在 SceneManager.detectWebGL() 失败时由 App 调用。
// 展示与 3D 场景完全一致的 SWRO 七段工艺 + 全流程总览，信息全可读。

// 与 PlantSceneSegment 的 PLANT_SEGMENTS 配色保持一致，使 2D 视图"长"在 UI 配色里。
const STAGES = [
  { no: '〇', name: '全流程总览', desc: '取水泵房 → 预处理 → 膜法预处理 → 高压泵/能量回收 → 反渗透 → 后处理矿化 → 浓水排放', color: '#2ea8ff' },
  { no: '一', name: '取水段', desc: '离岸取水头部 + 海底引水管，原海水输送入厂', color: '#3f6fa5' },
  { no: '二', name: '预处理段', desc: '混凝 / 沉淀 / 过滤，去除悬浮物与胶体', color: '#2e8f9d' },
  { no: '三', name: 'UF/MF 膜法预处理', desc: '超滤 / 微滤，进一步净化、降低 SDI', color: '#2f9d8c' },
  { no: '四', name: '高压泵 + 能量回收', desc: '增压至约 6.0 MPa，PX 回收浓水余压', color: '#5175b8' },
  { no: '五', name: '反渗透膜段', desc: 'SWRO 脱盐，产水 TDS < 200 mg/L', color: '#72849f' },
  { no: '六', name: '后处理 / 矿化', desc: 'pH 调节与矿化，达到饮用水标准', color: '#3f9d6d' },
  { no: '七', name: '浓盐水排放', desc: '浓水辐射状扩散、掺混稀释后排放', color: '#b0704a' },
];

let _styleInjected = false;
function injectStyle() {
  if (_styleInjected) return;
  _styleInjected = true;
  const s = document.createElement('style');
  s.textContent = `
.fb-root{position:absolute;inset:0;display:flex;flex-direction:column;
  padding:48px 32px 36px;gap:30px;overflow:auto;
  background:radial-gradient(120% 120% at 50% 0%,#13243d 0%,#0b1220 60%,#05080f 100%);
  color:#dfe8f5;font-family:"Microsoft YaHei","PingFang SC","Segoe UI",system-ui,sans-serif;z-index:5}
.fb-head{text-align:center}
.fb-title{font-size:24px;font-weight:700;letter-spacing:2px;color:#fff}
.fb-title small{font-size:15px;color:#2ea8ff;margin-left:10px;font-weight:700}
.fb-note{margin:14px auto 0;max-width:880px;font-size:13px;line-height:1.7;color:#8aa0bd;text-align:left;
  background:rgba(255,154,154,.08);border:1px solid rgba(255,154,154,.3);border-radius:10px;padding:12px 16px}
.fb-flow{display:flex;flex-wrap:nowrap;align-items:stretch;justify-content:flex-start;gap:0 0;
  max-width:100%;margin:0 auto;overflow-x:auto;padding:10px 4px 18px}
.fb-card{flex:0 0 222px;margin:8px;padding:16px 16px 18px;
  background:linear-gradient(180deg,rgba(20,36,58,.92),rgba(12,22,38,.92));
  border:1px solid var(--c);border-top:4px solid var(--c);border-radius:12px;
  box-shadow:0 8px 26px rgba(0,0,0,.35)}
.fb-no{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;
  background:var(--c);color:#04121f;font-weight:700;font-size:15px;margin-bottom:10px}
.fb-name{font-size:16px;font-weight:700;color:#fff;margin-bottom:8px}
.fb-desc{font-size:12.5px;line-height:1.6;color:#b8c8de}
.fb-arrow{display:flex;align-items:center;color:#3a567c;font-size:26px;font-weight:700;margin:0 2px;
  align-self:center;flex:0 0 auto}
.fb-tip{text-align:center;font-size:12px;color:#5f789b;margin:-18px 0 4px}
.fb-foot{text-align:center;font-size:12px;color:#5f789b;margin-top:6px}
`;
  document.head.appendChild(s);
}

export function renderFallback(stage) {
  injectStyle();
  const cards = STAGES.map((s, i) => {
    const arrow = i < STAGES.length - 1 ? '<div class="fb-arrow">→</div>' : '';
    return `<div class="fb-card" style="--c:${s.color}">
      <div class="fb-no">${s.no}</div>
      <div class="fb-name">${s.name}</div>
      <div class="fb-desc">${s.desc}</div>
    </div>${arrow}`;
  }).join('');

  const wrap = document.createElement('div');
  wrap.className = 'fb-root';
  wrap.innerHTML = `
    <div class="fb-head">
      <div class="fb-title">海水淡化全流程工艺<small>（SWRO）</small></div>
      <div class="fb-note">⚠ 当前环境未启用 WebGL，已自动切换至 <b>2D 工艺流程图</b>（3D 实时场景不可用）。
        请在支持 WebGL 的现代浏览器中开启硬件加速后重新打开本页面。</div>
    </div>
    <div class="fb-flow">${cards}</div>
    <div class="fb-tip">← 可横向滑动查看完整工艺流 →</div>
    <div class="fb-foot">江河海 · 海水淡化 3D 模拟系统（降级视图）</div>`;
  stage.appendChild(wrap);
}
