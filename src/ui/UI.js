// UI 层：工艺段选择按钮 + 导出按钮 + HUD 信息面板。
export class UI {
  constructor({ segments, onSelect, onScreenshot, onRecord, onModel, onTour, onEast }) {
    this.segList = document.getElementById('seg-list');
    this.exList = document.getElementById('ex-list');
    this.hudName = document.getElementById('hud-name');
    this.hudSub = document.getElementById('hud-sub');
    this.hudDesc = document.getElementById('hud-desc');
    this.hudParams = document.querySelector('#hud-params tbody');
    this.buttons = {};

    segments.forEach(seg => {
      const b = document.createElement('button');
      b.className = 'seg-btn';
      b.dataset.id = seg.id;
      b.innerHTML = `${seg.name}<small>${seg.subtitle || ''}</small>`;
      b.addEventListener('click', () => onSelect(seg.id));
      this.segList.appendChild(b);
      this.buttons[seg.id] = b;
    });

    const mk = (label, extra, fn) => {
      const e = document.createElement('div');
      e.className = 'ex-btn' + (extra ? ' ' + extra : '');
      e.textContent = label;
      e.addEventListener('click', fn);
      this.exList.appendChild(e);
      return e;
    };
    mk('截图 PNG', '', onScreenshot);
    mk('录制动画', '', onRecord);
    mk('导出 3D 模型（glTF·含水印）', 'wide', onModel);
    // 自动巡游：循环切换七段 / 总览 / 全景，用于展厅与汇报演示
    this.tourBtn = mk('▶ 自动巡游', 'wide', onTour);
    // 东侧园区专用视角：两厂前后两排布局扩地后，一键把市政/外部/罐装三园纳入取景，避开右上 HUD
    mk('东侧园区视角', 'wide', onEast);
  }

  /** 巡游开关状态同步（切换按钮文案与高亮） */
  setTour(on) {
    if (!this.tourBtn) return;
    this.tourBtn.textContent = on ? '⏸ 暂停巡游' : '▶ 自动巡游';
    this.tourBtn.style.background = on ? 'rgba(46,168,255,.28)' : '';
    this.tourBtn.style.borderColor = on ? 'rgba(46,168,255,.7)' : '';
    this.tourBtn.style.color = on ? '#bfe4ff' : '';
  }

  setActive(id) {
    Object.entries(this.buttons).forEach(([k, b]) => b.classList.toggle('active', k === id));
  }

  showInfo(info) {
    this.hudName.textContent = info.name || '—';
    this.hudSub.textContent = info.subtitle || '—';
    this.hudDesc.textContent = info.description || '';
    this.hudParams.innerHTML = '';
    (info.params || []).forEach(p => {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.className = 'k'; td1.textContent = p.k;
      const td2 = document.createElement('td'); td2.className = 'v'; td2.textContent = p.v;
      tr.appendChild(td1); tr.appendChild(td2);
      this.hudParams.appendChild(tr);
    });
    if (info.sources && info.sources.length) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.className = 'k'; td1.textContent = '数据源';
      const td2 = document.createElement('td'); td2.className = 'v'; td2.style.color = '#8af0c0'; td2.textContent = info.sources.join('；');
      tr.appendChild(td1); tr.appendChild(td2);
      this.hudParams.appendChild(tr);
    }
  }
}
