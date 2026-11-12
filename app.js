// =========================================================
// app.js · Orbit 星轨官网交互
// ---------------------------------------------------------
// 目录
// 0. 工具函数（视口监听 / 按需加载脚本）
// 1. 仪表盘柱状图跳动
// 2. AI 指令交互
// 3. 服务区域 ECharts 地图
// 4. 留资弹窗：打开 / 校验 / 提交（存入本地）
// 5. 留资弹窗：滚动播报
// 6. 宣传视频彩蛋
// 7. 管理员导出客户线索
// 8. 登录（服务器码）
// 9. 部署模式切换
// ---------------------------------------------------------
// 性能要点
// - 区块滚出视口即暂停其中的 CSS 动画（配合 style.css 的 .is-offscreen）
// - 柱状图定时器、地图涟漪只在可见且标签页在前台时运行
// - ECharts（约 1MB）在滚动到地图附近时才加载；
//   SheetJS（约 900KB）只在管理员确认导出时才加载
// =========================================================

const ECHARTS_SRC = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
const XLSX_SRC = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';


// =========================================================
// 0. 工具函数
// =========================================================

// 元素进入 / 离开视口时回调
function watchVisibility(el, onChange, rootMargin = '0px') {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { onChange(true); return; }
  new IntersectionObserver(entries => {
    entries.forEach(entry => onChange(entry.isIntersecting));
  }, { rootMargin }).observe(el);
}

// 按需加载外部脚本（同一地址只加载一次）
const scriptCache = {};
function loadScript(src) {
  if (!scriptCache[src]) {
    scriptCache[src] = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = resolve;
      el.onerror = () => { delete scriptCache[src]; reject(new Error('脚本加载失败：' + src)); };
      document.head.appendChild(el);
    });
  }
  return scriptCache[src];
}


// 区块滚出视口时加 .is-offscreen，CSS 会暂停其中所有动画
// （SVG 描边、光圈等动画即使不在屏幕上也会让整页每帧重绘，是滚动卡顿的主要来源）
document.querySelectorAll('main > section').forEach(section => {
  watchVisibility(section, visible => section.classList.toggle('is-offscreen', !visible), '100px 0px');
});


// =========================================================
// 1. 仪表盘柱状图随机跳动
//    仅在仪表盘可见且标签页处于前台时运行
// =========================================================
const bars = document.querySelectorAll('.chart-container:not(.warning) .bar');
if (bars.length) {
  let barTimer = null;
  let dashVisible = true;

  const animateBars = () => {
    bars.forEach(bar => {
      bar.style.setProperty('--h', `${Math.floor(Math.random() * 80) + 20}%`);
    });
  };

  const syncBarTimer = () => {
    const shouldRun = dashVisible && !document.hidden;
    if (shouldRun && !barTimer) barTimer = setInterval(animateBars, 2000);
    if (!shouldRun && barTimer) { clearInterval(barTimer); barTimer = null; }
  };

  watchVisibility(document.querySelector('.dashboard-mockup'), visible => {
    dashVisible = visible;
    syncBarTimer();
  });
  document.addEventListener('visibilitychange', syncBarTimer);
  syncBarTimer();
}


// =========================================================
// 2. AI 指令交互
// =========================================================
const aiInput = document.getElementById('ai-user-input');
const aiSendBtn = document.getElementById('ai-send-btn');
const chatLog = document.getElementById('chat-log');

const dataNodes = {
  revenue: document.querySelector('[data-bind="revenue"]'),
  orders: document.querySelector('[data-bind="orders"]'),
  production: document.querySelector('[data-bind="production"]'),
  finance: document.querySelector('[data-bind="finance"]'),
  stock: document.querySelector('[data-bind="stock"]'),
  agent: document.querySelector('[data-bind="agent"]')
};

// 卡片高亮：深灰描边为主，橙色只做一圈很细的外发光
function highlightCard(node) {
  const card = node && node.closest('.dash-card');
  if (!card) return;
  card.style.transition = 'box-shadow 0.3s, border-color 0.3s';
  card.style.boxShadow = '0 0 0 1px rgba(17,17,17,0.18), 0 0 0 3px rgba(252,147,41,0.14), 0 8px 20px rgba(17,17,17,0.08)';
  card.style.borderColor = 'rgba(17,17,17,0.18)';
  setTimeout(() => {
    card.style.boxShadow = '';
    card.style.borderColor = '';
  }, 1200);
}

// 对话气泡（最多保留 6 条）
function appendChatBubble(text, type = 'ai') {
  if (!chatLog) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${type}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  while (chatLog.children.length > 6) chatLog.removeChild(chatLog.firstChild);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function handleAICommand(commandText) {
  if (!commandText.trim()) return;

  const agentNode = dataNodes.agent;
  const esiCard = agentNode ? agentNode.closest('.dash-card.esi-core') : null;
  if (agentNode) {
    agentNode.classList.add('updating');
    agentNode.classList.remove('text-accent');
    agentNode.textContent = '正在分析指令...';
  }
  if (esiCard) esiCard.classList.add('answering');

  appendChatBubble(commandText, 'user');
  if (aiInput) aiInput.value = '';

  setTimeout(() => {
    let reply;
    const has = (...words) => words.some(w => commandText.includes(w));

    if (has('库存', '预警')) {
      if (dataNodes.stock) dataNodes.stock.textContent = '0 项紧缺';
      reply = '已通知采购部门，目前库存充足。';
      highlightCard(dataNodes.stock);
    } else if (has('日报', '经营', '报表')) {
      if (dataNodes.revenue) dataNodes.revenue.textContent = '已生成今日经营简报';
      reply = '今日经营日报已生成，已发送至您的邮箱。';
      highlightCard(dataNodes.revenue);
    } else if (has('财务', '流水', '核对')) {
      if (dataNodes.finance) dataNodes.finance.textContent = '已核验 420 笔无异常';
      reply = '财务核对完成，无异常。';
      highlightCard(dataNodes.finance);
    } else if (has('订单', '生产')) {
      if (dataNodes.orders) dataNodes.orders.textContent = '1,300 笔已协同';
      if (dataNodes.production) dataNodes.production.textContent = '进度 100%';
      reply = '已加速处理订单，生产部门已同步更新排期。';
      highlightCard(dataNodes.orders);
      highlightCard(dataNodes.production);
    } else {
      reply = '指令已收到，AI 正在为您自动执行相关操作...';
    }

    setTimeout(() => {
      if (agentNode) {
        agentNode.textContent = reply;
        agentNode.classList.remove('updating');
        agentNode.classList.add('text-accent');
      }
      if (esiCard) esiCard.classList.remove('answering');
      appendChatBubble(reply, 'ai');
    }, 300);
  }, 800);
}

if (aiSendBtn) {
  aiSendBtn.addEventListener('click', () => handleAICommand(aiInput ? aiInput.value : ''));
}
if (aiInput) {
  aiInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAICommand(aiInput.value);
    }
  });
}
document.querySelectorAll('.quick-prompt').forEach(btn => {
  btn.addEventListener('click', () => handleAICommand(btn.dataset.prompt || btn.textContent));
});


// =========================================================
// 3. 服务区域 ECharts 地图
//    - 滚动到地图附近（提前 300px）才加载 ECharts 和地图数据
//    - 离开视口时涟漪散点切换为静态散点，停止逐帧重绘
//    - 窗口缩放合并到下一帧，每帧最多 resize 一次
// =========================================================
const mapDom = document.getElementById('service-map-echarts');
if (mapDom) {
  // core：江浙沪已覆盖（亮橙 + 强发光）；pending：其他区域拓展中（淡橙 + 弱发光）
  const servicePoints = [
    { name: '上海', value: [121.472, 31.231], status: 'core' },
    { name: '南京', value: [118.796, 32.060], status: 'core' },
    { name: '杭州', value: [120.153, 30.287], status: 'core' },
    { name: '北京', value: [116.405, 39.904], status: 'pending' },
    { name: '天津', value: [117.190, 39.125], status: 'pending' },
    { name: '石家庄', value: [114.502, 38.045], status: 'pending' },
    { name: '广州', value: [113.280, 23.125], status: 'pending' },
    { name: '深圳', value: [114.085, 22.547], status: 'pending' },
    { name: '珠海', value: [113.552, 22.225], status: 'pending' },
    { name: '成都', value: [104.065, 30.659], status: 'pending' }
  ];

  const pointStyles = {
    core:    { color: 'rgb(252, 147, 41)',        shadowBlur: 15, shadowColor: 'rgba(252, 147, 41, 0.8)' },
    pending: { color: 'rgba(252, 147, 41, 0.35)', shadowBlur: 5,  shadowColor: 'rgba(252, 147, 41, 0.2)' }
  };

  // 发光强度写在每个点自己的 itemStyle 里
  // （ECharts 的 shadowBlur / shadowColor 不支持回调函数，原写法发光差异不会生效）
  const pointData = servicePoints.map(p => ({ ...p, itemStyle: pointStyles[p.status] }));

  // animated = true：带涟漪的动态散点；false：静态散点
  const buildPointSeries = animated => {
    const base = {
      id: 'service-points',
      name: '分公司网点',
      coordinateSystem: 'geo',
      symbolSize: 7,
      label: { show: false },
      data: pointData
    };
    return animated
      ? { ...base, type: 'effectScatter', showEffectOn: 'render', rippleEffect: { brushType: 'stroke', scale: 25, period: 3 } }
      : { ...base, type: 'scatter' };
  };

  let mapChart = null;
  let mapReady = false;
  let mapVisible = false;
  let effectOn = true;

  const syncMapEffect = () => {
    if (!mapReady) return;
    const shouldAnimate = mapVisible && !document.hidden;
    if (shouldAnimate === effectOn) return;
    effectOn = shouldAnimate;
    mapChart.setOption({ series: [buildPointSeries(shouldAnimate)] }, { replaceMerge: ['series'] });
  };

  const showMapError = () => {
    mapDom.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px;">地图加载失败，请刷新重试</div>';
  };

  const initMap = async () => {
    try {
      if (typeof echarts === 'undefined') await loadScript(ECHARTS_SRC);
    } catch (err) {
      console.error(err);
      showMapError();
      return;
    }

    mapChart = echarts.init(mapDom);
    mapChart.showLoading({
      text: '加载地图中...',
      color: 'rgb(252, 147, 41)',
      textColor: '#6b6b6b',
      maskColor: 'transparent'
    });

    try {
      const geoJson = await fetch('./china.json').then(res => res.json());
      echarts.registerMap('china', geoJson);
      mapChart.hideLoading();

      mapChart.setOption({
        backgroundColor: 'transparent',
        geo: {
          map: 'china',
          roam: false,
          zoom: 1.15,
          center: [104, 36],
          itemStyle: {
            areaColor: '#e2e8f0',           // 全国默认底色（浅灰蓝）
            borderColor: '#b3c0d1',         // 省份轮廓
            borderWidth: 1.2,
            shadowColor: 'rgba(17, 17, 17, 0.1)',
            shadowBlur: 15,
            shadowOffsetX: 0,
            shadowOffsetY: 5
          },
          emphasis: {
            itemStyle: {
              areaColor: 'rgba(252, 147, 41, 0.25)', // 悬浮橙色
              borderColor: 'rgb(252, 147, 41)',
              borderWidth: 1.5
            },
            label: { show: false }
          },
          label: { show: false }
        },
        series: [buildPointSeries(true)]
      });

      mapReady = true;
      effectOn = true;
      syncMapEffect();
      setTimeout(() => mapChart.resize(), 100); // 解决偶发不显示
    } catch (err) {
      console.error('地图加载失败:', err);
      mapChart.hideLoading();
      mapChart.dispose();
      showMapError();
      return;
    }

    let resizeQueued = false;
    window.addEventListener('resize', () => {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(() => {
        resizeQueued = false;
        mapChart.resize();
      });
    });
  };

  let mapStarted = false;
  watchVisibility(mapDom, visible => {
    if (visible && !mapStarted) { mapStarted = true; initMap(); }
  }, '300px 0px');

  watchVisibility(mapDom, visible => {
    mapVisible = visible;
    syncMapEffect();
  });
  document.addEventListener('visibilitychange', syncMapEffect);
}


// =========================================================
// 4. 留资弹窗：打开 / 校验 / 提交
// =========================================================
const trialDialog = document.getElementById('trial-dialog');
const successDialog = document.getElementById('success-dialog');
const trialForm = document.getElementById('trial-form');

// 点任意 [data-trial] / [data-contact] 打开留资弹窗
if (trialDialog) {
  document.body.addEventListener('click', e => {
    if (e.target.closest('[data-trial], [data-contact]')) {
      e.preventDefault();
      trialDialog.showModal();
    }
  });

  const btnClose = trialDialog.querySelector('[data-close]');
  if (btnClose) btnClose.addEventListener('click', () => trialDialog.close());
  trialDialog.addEventListener('click', e => {
    if (e.target === trialDialog) trialDialog.close();
  });
}

if (successDialog) {
  successDialog.querySelectorAll('[data-success-close]').forEach(btn => {
    btn.addEventListener('click', () => successDialog.close());
  });
  successDialog.addEventListener('click', e => {
    if (e.target === successDialog) successDialog.close();
  });
}

// 单个字段校验：返回是否通过，并显示 / 清除红字
function validateInput(input) {
  const formRow = input.closest('.form-row');
  if (!formRow) return true;

  const value = input.value.trim();
  let errorMsg = '';
  if (input.hasAttribute('required') && !value) {
    errorMsg = '请填写此字段';
  } else if (input.type === 'tel' && value && !/^1[3-9]\d{9}$/.test(value)) {
    errorMsg = '请输入有效的 11 位手机号';
  }

  let errorEl = formRow.querySelector('.error-msg');
  if (!errorEl) {
    errorEl = document.createElement('span');
    errorEl.className = 'error-msg';
    formRow.appendChild(errorEl);
  }
  formRow.classList.toggle('has-error', !!errorMsg);
  errorEl.textContent = errorMsg;
  return !errorMsg;
}

// 线索存入浏览器本地（供管理员导出）
function saveLead() {
  const val = id => (document.getElementById(id) || {}).value || '';
  const leads = JSON.parse(localStorage.getItem('my_leads') || '[]');
  leads.push({
    '姓名': val('trial-name'),
    '手机号': val('trial-phone'),
    '公司名称': val('trial-company'),
    '需求': val('trial-need'),
    '提交时间': new Date().toLocaleString()
  });
  localStorage.setItem('my_leads', JSON.stringify(leads));
}

if (trialForm && trialDialog && successDialog) {
  const inputs = trialForm.querySelectorAll('input, textarea');

  // 失焦时校验；已报错的字段在输入时实时复查
  inputs.forEach(input => {
    input.addEventListener('blur', () => validateInput(input));
    input.addEventListener('input', () => {
      const formRow = input.closest('.form-row');
      if (formRow && formRow.classList.contains('has-error')) validateInput(input);
    });
  });

  // 提交：校验通过才保存并切换到成功弹窗
  // （原来另绑了一个不做校验的提交事件，导致填错也会被保存并提示成功，已合并）
  trialForm.addEventListener('submit', e => {
    e.preventDefault();

    let isFormValid = true;
    inputs.forEach(input => { if (!validateInput(input)) isFormValid = false; });

    if (!isFormValid) {
      const firstError = trialForm.querySelector('.has-error');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    saveLead();
    trialDialog.close();
    successDialog.showModal();

    setTimeout(() => {
      trialForm.reset();
      trialForm.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
      trialForm.querySelectorAll('.error-msg').forEach(el => { el.textContent = ''; });
    }, 300);
  });
}


// =========================================================
// 5. 留资弹窗：滚动播报
// =========================================================
const tickerList = document.getElementById('tickerList');
if (tickerList) {
  const messages = [
    '刚刚：张总 预约了产品演示',
    '刚刚：李经理 提交了体验申请',
    '刚刚：王总 获取了行业解决方案',
    '本周已有 40+ 位企业管理者预约体验',
    '刚刚：刘主管 预约了系统体验'
  ];
  const html = messages.map(msg => `<div>${msg}</div>`).join('');
  tickerList.innerHTML = html + html; // 重复一遍，实现无缝循环
}


// =========================================================
// 6. 宣传视频彩蛋：1 秒内连点"核心优势"球 3 次
// =========================================================
const videoModal = document.getElementById('secretVideoModal');
const videoPlayer = document.getElementById('promoVideo');
const secretTrigger = document.querySelector('.orbit-core');

if (videoModal && videoPlayer && secretTrigger) {
  let clickCount = 0;
  let clickTimer = null;

  const closeVideo = () => {
    videoModal.classList.remove('show');
    videoPlayer.pause();
  };

  secretTrigger.style.cursor = 'pointer';
  secretTrigger.addEventListener('click', () => {
    clickCount++;
    clearTimeout(clickTimer);
    if (clickCount === 3) {
      clickCount = 0;
      videoModal.classList.add('show');
      videoPlayer.currentTime = 0;
      videoPlayer.play().catch(() => {}); // 浏览器拦截自动播放时不报错
    } else {
      clickTimer = setTimeout(() => { clickCount = 0; }, 1000);
    }
  });

  const closeVideoBtn = document.getElementById('closeSecretVideo');
  if (closeVideoBtn) closeVideoBtn.addEventListener('click', closeVideo);
  videoModal.addEventListener('click', e => {
    if (e.target === videoModal) closeVideo();
  });
}


// =========================================================
// 7. 管理员导出客户线索（双击页脚版权文字触发）
//    注意：密码写在前端代码里，任何人查看源码都能看到，只能防误触，不能当作真正的权限控制
// =========================================================
const ADMIN_PASSWORD = 'admin000';
const getLeads = () => JSON.parse(localStorage.getItem('my_leads') || '[]');

window.triggerExport = function () {
  if (getLeads().length === 0) {
    alert('当前没有收集到任何客户数据哦！');
    return;
  }
  const dialog = document.getElementById('adminPasswordDialog');
  document.getElementById('adminPasswordInput').value = '';
  dialog.showModal();
  loadScript(XLSX_SRC).catch(() => {}); // 弹窗出现时就开始预加载导出组件
};

async function generateExcel() {
  try {
    if (typeof XLSX === 'undefined') await loadScript(XLSX_SRC);
  } catch (err) {
    alert('Excel 组件加载失败，请检查网络后重试。');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(getLeads());
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '客户线索');
  XLSX.writeFile(workbook, `客户留资数据_${new Date().toLocaleDateString()}.xlsx`);
}

const authForm = document.getElementById('adminAuthForm');
if (authForm) {
  authForm.addEventListener('submit', e => {
    e.preventDefault();
    const pwdInput = document.getElementById('adminPasswordInput');
    if (pwdInput.value === ADMIN_PASSWORD) {
      document.getElementById('adminPasswordDialog').close();
      generateExcel();
    } else {
      alert('密码错误，无权访问！');
      pwdInput.value = '';
    }
  });
}


// =========================================================
// 8. 登录（服务器码）
// =========================================================
const loginForm = document.getElementById('login-form');
const loginDialog = document.getElementById('login-dialog');
const serverCodeInput = document.getElementById('server-code');

function showLoginError(formRow, msg, showHelp = false) {
  formRow.classList.add('has-error');
  const errorEl = document.createElement('div');
  errorEl.className = 'error-msg';
  errorEl.innerHTML = showHelp
    ? `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
         <span>${msg}</span>
         <span style="color:#ddd;">|</span>
         <a href="mailto:yuzhiruanjian@163.com" style="color:#3f6bd8;text-decoration:none;">联系客服</a>
         <span style="color:#ddd;">|</span>
         <a href="javascript:void(0)" data-switch-apply style="color:#3f6bd8;text-decoration:none;">获取服务器码</a>
       </div>`
    : `<span>${msg}</span>`;
  formRow.appendChild(errorEl);
}

// 从登录弹窗切换到留资弹窗
window.switchToApply = function () {
  if (loginDialog) loginDialog.close();
  if (trialDialog) trialDialog.showModal();
};

if (loginForm && serverCodeInput) {
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const code = serverCodeInput.value.trim();
    const formRow = serverCodeInput.closest('.form-row');

    // 清理旧报错
    formRow.classList.remove('has-error');
    formRow.querySelectorAll('.error-msg').forEach(el => el.remove());

    if (!code) {
      showLoginError(formRow, '请输入服务器码');
      return;
    }
    if (code === 'admin000') {
      loginDialog.close();
      serverCodeInput.value = '';
      window.location.href = 'https://shanjianerp.com';
    } else {
      showLoginError(formRow, '服务器码错误，请重新输入', true);
    }
  });

  loginForm.addEventListener('click', e => {
    if (e.target.closest('[data-switch-apply]')) {
      e.preventDefault();
      window.switchToApply();
    }
  });
}


// =========================================================
// 9. 部署模式切换（私有化 / 云端）
// =========================================================
(function initDeployModeSwitch() {
  const buttons = document.querySelectorAll('.deploy-mode-btn');
  const panels = document.querySelectorAll('[data-deploy-panel]');
  if (!buttons.length || !panels.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.deployMode;
      buttons.forEach(b => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach(p => {
        const show = p.dataset.deployPanel === mode;
        p.classList.toggle('is-active', show);
        p.hidden = !show;
      });
    });
  });
})();
