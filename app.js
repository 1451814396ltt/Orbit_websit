// ==========================================
// app.js（高亮反馈改为深灰描边 + 细橙边，避免大块橙色）
// ==========================================
// ------------------------------------------
// 工具：元素进入/离开视口时回调（性能优化用）
// ------------------------------------------
function watchVisibility(el, onChange, rootMargin = '0px') {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { onChange(true); return; }
  new IntersectionObserver(entries => {
    entries.forEach(entry => onChange(entry.isIntersecting));
  }, { rootMargin }).observe(el);
}

// ==========================================
// 1. 仪表盘柱状图随机跳动
//    性能：仅在仪表盘可见且标签页处于前台时运行，滚走或切后台即停止
// ==========================================
const bars = document.querySelectorAll('.chart-container:not(.warning) .bar');
if (bars.length) {
  let barTimer = null;
  let dashVisible = true;

  function animateBars() {
    bars.forEach(bar => {
      const newHeight = Math.floor(Math.random() * 80) + 20;
      bar.style.setProperty('--h', `${newHeight}%`);
    });
  }

  function syncBarTimer() {
    const shouldRun = dashVisible && !document.hidden;
    if (shouldRun && !barTimer) barTimer = setInterval(animateBars, 2000);
    if (!shouldRun && barTimer) { clearInterval(barTimer); barTimer = null; }
  }

  watchVisibility(document.querySelector('.dashboard-mockup'), visible => {
    dashVisible = visible;
    syncBarTimer();
  });
  document.addEventListener('visibilitychange', syncBarTimer);
  syncBarTimer();
}

const aiInput = document.getElementById('ai-user-input');
const aiSendBtn = document.getElementById('ai-send-btn');
const quickPrompts = document.querySelectorAll('.quick-prompt');
const chatLog = document.getElementById('chat-log');

const dataNodes = {
  revenue: document.querySelector('[data-bind="revenue"]'),
  orders: document.querySelector('[data-bind="orders"]'),
  production: document.querySelector('[data-bind="production"]'),
  finance: document.querySelector('[data-bind="finance"]'),
  stock: document.querySelector('[data-bind="stock"]'),
  agent: document.querySelector('[data-bind="agent"]')
};

// 高亮：深灰描边为主，橙仅作为一圈很细的外发光
function highlightCard(node) {
  if (!node) return;
  const card = node.closest('.dash-card');
  if (!card) return;
  card.style.transition = 'box-shadow 0.3s, border-color 0.3s';
  card.style.boxShadow = '0 0 0 1px rgba(17,17,17,0.18), 0 0 0 3px rgba(252,147,41,0.14), 0 8px 20px rgba(17,17,17,0.08)';
  card.style.borderColor = 'rgba(17,17,17,0.18)';
  setTimeout(() => {
    card.style.boxShadow = '';
    card.style.borderColor = '';
  }, 1200);
}

// 对话气泡
function appendChatBubble(text, type = 'ai') {
  if (!chatLog) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${type}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  while (chatLog.children.length > 6) {
    chatLog.removeChild(chatLog.firstChild);
  }
}

// AI 响应
function handleAICommand(commandText) {
  if (!commandText.trim()) return;

  const agentNode = dataNodes.agent;
  const esiCard = agentNode ? agentNode.closest('.dash-card.esi-core') : null;
  if (agentNode) {
    agentNode.classList.add("updating");
    agentNode.textContent = "正在分析指令...";
    agentNode.classList.remove("text-accent");
  }
  if (esiCard) esiCard.classList.add("answering");

  appendChatBubble(commandText, 'user');

  if (aiInput) aiInput.value = '';

  setTimeout(() => {
    let reply = "已完成指令。";

    if (commandText.includes('库存') || commandText.includes('预警')) {
      if (dataNodes.stock) dataNodes.stock.textContent = "0 项紧缺";
      reply = "已通知采购部门，目前库存充足。";
      highlightCard(dataNodes.stock);
    }
    else if (commandText.includes('日报') || commandText.includes('经营') || commandText.includes('报表')) {
      if (dataNodes.revenue) dataNodes.revenue.textContent = "已生成今日经营简报";
      reply = "今日经营日报已生成，已发送至您的邮箱。";
      highlightCard(dataNodes.revenue);
    }
    else if (commandText.includes('财务') || commandText.includes('流水') || commandText.includes('核对')) {
      if (dataNodes.finance) dataNodes.finance.textContent = "已核验 420 笔无异常";
      reply = "财务核对完成，无异常。";
      highlightCard(dataNodes.finance);
    }
    else if (commandText.includes('订单') || commandText.includes('生产')) {
      if (dataNodes.orders) dataNodes.orders.textContent = "1,300 笔已协同";
      if (dataNodes.production) dataNodes.production.textContent = "进度 100%";
      reply = "已加速处理订单，生产部门已同步更新排期。";
      highlightCard(dataNodes.orders);
      highlightCard(dataNodes.production);
    }
    else {
      reply = "指令已收到，AI 正在为您自动执行相关操作...";
    }

    if (agentNode) {
      setTimeout(() => {
        agentNode.textContent = reply;
        agentNode.classList.remove("updating");
        agentNode.classList.add("text-accent");
        if (esiCard) esiCard.classList.remove("answering");
        appendChatBubble(reply, 'ai');
      }, 300);
    }

  }, 800);
}

// 事件绑定
if (aiSendBtn) {
  aiSendBtn.addEventListener('click', () => {
    handleAICommand(aiInput ? aiInput.value : '');
  });
}
if (aiInput) {
  aiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAICommand(aiInput.value);
    }
  });
}
quickPrompts.forEach(btn => {
  btn.addEventListener('click', () => {
    const prompt = btn.dataset.prompt || btn.textContent;
    handleAICommand(prompt);
  });
});

// ==========================================
// 2. 服务区域 ECharts 地图
//    性能：
//    - 滚动到地图附近才初始化并请求地图数据（首屏不再被拖慢）
//    - 地图离开视口时把涟漪散点切换为静态散点，停止逐帧重绘；回到视口再恢复
//    - 窗口缩放用 requestAnimationFrame 合并，每帧最多 resize 一次
// ==========================================
const mapDom = document.getElementById('service-map-echarts');
if (mapDom && typeof echarts !== 'undefined') {
  // 网点坐标
  // const servicePoints = [
  //   { name: '北京', value: [116.405, 39.904] },
  //   { name: '天津', value: [117.190, 39.125] },
  //   { name: '石家庄', value: [114.502, 38.045] },
  //   { name: '上海', value: [121.472, 31.231] },
  //   { name: '南京', value: [118.796, 32.060] },
  //   { name: '杭州', value: [120.153, 30.287] },
  //   { name: '广州', value: [113.280, 23.125] },
  //   { name: '深圳', value: [114.085, 22.547] },
  //   { name: '珠海', value: [113.552, 22.225] },
  //   { name: '成都', value: [104.065, 30.659] }
  // ];
  const servicePoints = [
    // 👇 江浙沪：核心区域（亮橙色） status: 'core'
    { name: '上海', value: [121.472, 31.231], status: 'core' },
    { name: '南京', value: [118.796, 32.060], status: 'core' },
    { name: '杭州', value: [120.153, 30.287], status: 'core' },

    // 👇 其他区域：待开发（灰橙色） status: 'pending'
    { name: '北京', value: [116.405, 39.904], status: 'pending' },
    { name: '天津', value: [117.190, 39.125], status: 'pending' },
    { name: '石家庄', value: [114.502, 38.045], status: 'pending' },
    { name: '广州', value: [113.280, 23.125], status: 'pending' },
    { name: '深圳', value: [114.085, 22.547], status: 'pending' },
    { name: '珠海', value: [113.552, 22.225], status: 'pending' },
    { name: '成都', value: [104.065, 30.659], status: 'pending' }
  ];

  const pointStyle = {
    color: 'rgb(252, 147, 41)',
    shadowBlur: 15,
    shadowColor: 'rgba(252, 147, 41, 0.8)'  // 发光
  };

  // 网点系列：animated = true 时为带涟漪的动态散点，false 时为静态散点
  function buildPointSeries(animated) {
    const base = {
      id: 'service-points',
      name: '分公司网点',
      coordinateSystem: 'geo',
      symbolSize: 7,
      label: { show: false },

      // 👇 核心修改：通过函数动态返回颜色 👇
      itemStyle: {
        color: function(params) {
          // 如果是江浙沪（core），亮橙色 + 强发光
          if (params.data.status === 'core') {
            return 'rgb(252, 147, 41)';
          }
          // 如果是其他待开发区域（pending），灰橙色 + 弱发光
          return 'rgba(252, 147, 41, 0.35)';
        },
        shadowBlur: function(params) {
          return params.data.status === 'core' ? 15 : 5;
        },
        shadowColor: function(params) {
          return params.data.status === 'core'
            ? 'rgba(252, 147, 41, 0.8)'
            : 'rgba(252, 147, 41, 0.2)';
        }
      }
    };

    return animated
      ? { ...base, type: 'effectScatter', data: servicePoints, showEffectOn: 'render', rippleEffect: { brushType: 'stroke', scale: 25, period: 3 } }
      : { ...base, type: 'scatter', data: servicePoints };
  }

  let mapChart = null;
  let mapReady = false;
  let mapVisible = false;
  let effectOn = true;

  // 根据可见性切换涟漪动画
  function syncMapEffect() {
    if (!mapReady) return;
    const shouldAnimate = mapVisible && !document.hidden;
    if (shouldAnimate === effectOn) return;
    effectOn = shouldAnimate;
    mapChart.setOption({ series: [buildPointSeries(shouldAnimate)] }, { replaceMerge: ['series'] });
  }

  function initMap() {
    mapChart = echarts.init(mapDom);

    mapChart.showLoading({
      text: '加载地图中...',
      color: 'rgb(252, 147, 41)',
      textColor: '#6b6b6b',
      maskColor: 'transparent'
    });

    // fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
    fetch('./china.json')
      .then(res => res.json())
      .then(geoJson => {
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
              areaColor: '#e2e8f0',               // 全国默认底色（浅灰蓝）
              borderColor: '#b3c0d1',             // 省份轮廓
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
            label: { show: false },
          },
          series: [buildPointSeries(true)]
        });

        mapReady = true;
        effectOn = true;
        syncMapEffect();

        // 强制重新计算尺寸，解决有时不显示的问题
        setTimeout(() => mapChart.resize(), 100);
      })
      .catch(err => {
        console.error('地图加载失败:', err);
        mapChart.hideLoading();
        mapDom.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px;">地图加载失败，请刷新重试</div>';
      });

    // 窗口缩放：合并到下一帧执行
    let resizeQueued = false;
    window.addEventListener('resize', () => {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(() => {
        resizeQueued = false;
        mapChart.resize();
      });
    });
  }

  // 提前 300px 初始化，用户滚到时地图已准备好
  watchVisibility(mapDom, visible => {
    if (visible && !mapChart) initMap();
  }, '300px 0px');

  // 是否真正在视口内，决定是否播放涟漪
  watchVisibility(mapDom, visible => {
    mapVisible = visible;
    syncMapEffect();
  });
  document.addEventListener('visibilitychange', syncMapEffect);
}

// ==========================================
  // 4. 留资弹窗控制 + 自定义红字校验
  // ==========================================
  const trialDialog = document.getElementById('trial-dialog');
  const successDialog = document.getElementById('success-dialog');
  const btnClose = document.querySelector('[data-close]');
  const btnSuccessClose = document.querySelectorAll('[data-success-close]');

  // 全局事件委托 (作为保险机制，即使不加 onclick 也能触发)
  if (trialDialog) {
    document.body.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-trial], [data-contact]');
      if (trigger) {
        e.preventDefault();
        trialDialog.showModal();
      }
    });

    if (btnClose) btnClose.addEventListener('click', () => trialDialog.close());
    trialDialog.addEventListener('click', (e) => {
      if (e.target === trialDialog) trialDialog.close();
    });
  }

  // 关闭成功弹窗
  if (successDialog) {
    btnSuccessClose.forEach(btn => {
      btn.addEventListener('click', () => successDialog.close());
    });
    successDialog.addEventListener('click', (e) => {
      if (e.target === successDialog) successDialog.close();
    });
  }

  // 校验函数
  const trialForm = document.getElementById('trial-form');

  function validateInput(input) {
    const formRow = input.closest('.form-row');
    if (!formRow) return true;

    let isValid = true;
    let errorMsg = '';

    // 检查是否为空
    if (input.hasAttribute('required') && !input.value.trim()) {
      isValid = false;
      errorMsg = '请填写此字段';
    }
    // 检查手机号格式
    else if (input.type === 'tel' && input.value.trim()) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(input.value.trim())) {
        isValid = false;
        errorMsg = '请输入有效的 11 位手机号';
      }
    }

    // 获取或创建红字提示元素
    let errorEl = formRow.querySelector('.error-msg');
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'error-msg';
      formRow.appendChild(errorEl);
    }

    // 更新 DOM
    if (!isValid) {
      formRow.classList.add('has-error');
      errorEl.textContent = errorMsg;
    } else {
      formRow.classList.remove('has-error');
      errorEl.textContent = '';
    }

    return isValid;
  }

  // 绑定表单事件
  if (trialForm && successDialog) {
    const inputs = trialForm.querySelectorAll('input, textarea');

    // 实时校验：失焦和重新输入
    inputs.forEach(input => {
      input.addEventListener('blur', () => validateInput(input));
      input.addEventListener('input', () => {
        const formRow = input.closest('.form-row');
        if (formRow && formRow.classList.contains('has-error')) {
          validateInput(input);
        }
      });
    });

    // 提交拦截
    trialForm.addEventListener('submit', (e) => {
      e.preventDefault();

      let isFormValid = true;
      inputs.forEach(input => {
        if (!validateInput(input)) {
          isFormValid = false;
        }
      });

      if (!isFormValid) {
        // 滚动到第一个报错的地方
        const firstError = trialForm.querySelector('.has-error');
        if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // 校验通过，切换弹窗
      trialDialog.close();
      successDialog.showModal();

      // 重置表单
      setTimeout(() => {
        trialForm.reset();
        trialForm.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
        trialForm.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
      }, 300);
    });
  }

  // ==========================================
  // 5. 留资弹窗-滚动播报
  // ==========================================
  const tickerList = document.getElementById('tickerList');
  if (tickerList) {
    const messages = [
      "刚刚：张总 预约了产品演示",
      "刚刚：李经理 提交了体验申请",
      "刚刚：王总 获取了行业解决方案",
      "本周已有 40+ 位企业管理者预约体验",
      "刚刚：刘主管 预约了系统体验"
    ];
    let htmlStr = '';
    messages.forEach(msg => {
      htmlStr += `<div>${msg}</div>`;
    });
    tickerList.innerHTML = htmlStr + htmlStr;
  }

/* =========================================================
   产品能力时间轴 · 滚动驱动节点状态（触发线版）
   ========================================================= */
(function initProductTimelineProgress() {
  const wrap = document.querySelector('.product-progress-wrap');
  if (!wrap) return; // 当前页面没有该模块时直接跳过

  const rows = Array.from(wrap.querySelectorAll('.progress-row'));
  const nodes = rows.map(r => r.querySelector('.timeline-node'));

  let ticking = false;

  function update() {
    ticking = false;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const triggerLine = vh * 0.55;   // 触发线：视口 55% 高度处

    // 找到最后一个"节点中心越过触发线"的索引
    let activeIndex = -1;
    nodes.forEach((node, i) => {
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const nodeY = rect.top + rect.height / 2;
      if (nodeY < triggerLine) activeIndex = i;
    });

    // 整段区域完全在触发线以下时，保持第一个节点不亮
    rows.forEach((row, i) => {
      row.classList.toggle('is-done', i < activeIndex);
      row.classList.toggle('is-active', i === activeIndex);
      row.classList.toggle('is-idle', i > activeIndex);
    });
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  update();
})();

document.addEventListener('DOMContentLoaded', () => {
  const orbitItems = document.querySelectorAll('.orbit-item');
  let currentIndex = 0;

  if (orbitItems.length > 0) {
    // 默认高亮第一个（对应 0deg 的位置）
    orbitItems[currentIndex].classList.add('active');

    setInterval(() => {
      // 移除上一个高亮
      orbitItems[currentIndex].classList.remove('active');

      // 切到下一个
      currentIndex = (currentIndex + 1) % orbitItems.length;

      // 加上新高亮
      orbitItems[currentIndex].classList.add('active');
    }, 2500); // 2500 毫秒 = 2.5 秒轮换一次
  }
});

// ================= 宣传视频隐藏彩蛋 =================
const videoModal = document.getElementById('secretVideoModal');
const videoPlayer = document.getElementById('promoVideo');
const closeVideoBtn = document.getElementById('closeSecretVideo');

// 我们让中间的“核心优势”橙色球作为触发器
const secretTrigger = document.querySelector('.orbit-core');

let clickCount = 0;
let clickTimer = null;

if (secretTrigger) {
  // 给个提示：鼠标放上去变成小手，用户可能会好奇点一下
  secretTrigger.style.cursor = 'pointer';

  secretTrigger.addEventListener('click', () => {
    clickCount++;

    // 如果 1 秒内连续点击了 3 次
    if (clickCount === 3) {
      videoModal.classList.add('show');
      // 确保视频从头开始播放
      videoPlayer.currentTime = 0;
      videoPlayer.play();

      clickCount = 0; // 重置
    } else {
      // 如果点击间隔超过 1 秒，就重置计数器
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 1000);
    }
  });
}

// 关闭弹窗和视频
if (closeVideoBtn) {
  closeVideoBtn.addEventListener('click', () => {
    videoModal.classList.remove('show');
    videoPlayer.pause(); // 关闭时暂停播放
  });
}

// 点击背景遮罩也能关闭
videoModal.addEventListener('click', (e) => {
  if (e.target === videoModal) {
    videoModal.classList.remove('show');
    videoPlayer.pause();
  }
});


// ==========================================
// 1. 表单提交：存入浏览器本地
// ==========================================
document.getElementById('trial-form').addEventListener('submit', function(e) {
  e.preventDefault();

  // 获取输入
  const newData = {
    "姓名": document.getElementById('trial-name').value,
    "手机号": document.getElementById('trial-phone').value,
    "公司名称": document.getElementById('trial-company').value,
    "需求": document.getElementById('trial-need').value,
    "提交时间": new Date().toLocaleString()
  };

  // 存入浏览器本地
  let savedLeads = JSON.parse(localStorage.getItem('my_leads')) || [];
  savedLeads.push(newData);
  localStorage.setItem('my_leads', JSON.stringify(savedLeads));

  // 关闭弹窗，打开成功提示
  document.getElementById('trial-dialog').close();
  document.getElementById('success-dialog').showModal();
  this.reset();
});


// ==========================================
// 2. 管理员功能：密码验证与导出 (全部平级)
// ==========================================
const ADMIN_PASSWORD = "admin000"; // 你设置的专属密码

// 触发弹窗
window.triggerExport = function() {
  let savedLeads = JSON.parse(localStorage.getItem('my_leads')) || [];
  if (savedLeads.length === 0) {
    alert("当前没有收集到任何客户数据哦！");
    return;
  }
  document.getElementById('adminPasswordDialog').showModal();
  document.getElementById('adminPasswordInput').value = "";
};

// 监听密码表单的提交 (用 window.onload 确保 DOM 加载完毕)
window.addEventListener('load', function() {
  const authForm = document.getElementById('adminAuthForm');
  if (authForm) {
    authForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const inputPwd = document.getElementById('adminPasswordInput').value;

      if (inputPwd === ADMIN_PASSWORD) {
        document.getElementById('adminPasswordDialog').close();
        generateExcel(); // 调用下方的导出函数
      } else {
        alert("密码错误，无权访问！");
        document.getElementById('adminPasswordInput').value = "";
      }
    });
  }
});

// 真正生成并下载 Excel (不要再嵌套了！)
function generateExcel() {
  let savedLeads = JSON.parse(localStorage.getItem('my_leads')) || [];

  if (typeof XLSX === 'undefined') {
    alert("Excel 组件未加载！请检查 HTML 里有没有引入 SheetJS 脚本。");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(savedLeads);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "客户线索");
  XLSX.writeFile(workbook, `客户留资数据_${new Date().toLocaleDateString()}.xlsx`);
}

// ==========================================
// 登录验证逻辑 (服务器码)
// 服务器码的校验、联系客服、申请服务器码……
// ==========================================
const loginForm = document.getElementById('login-form');
const loginDialog = document.getElementById('login-dialog');
const serverCodeInput = document.getElementById('server-code');

if (loginForm) {
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault(); // 阻止表单刷新

    const code = serverCodeInput.value.trim();
    const formRow = serverCodeInput.closest('.form-row');

    // 清理旧报错
    formRow.classList.remove('has-error');
    let errorEl = formRow.querySelector('.error-msg');
    if (errorEl) errorEl.remove(); // 直接移除旧的，避免叠加

    // 1. 判断空值
    if (!code) {
      showLoginError(formRow, '请输入服务器码');
      return;
    }

    // 2. 核心逻辑：判断服务器码是否等于 admin000
    if (code === 'admin000') {
      // 密码正确
      loginDialog.close();
      serverCodeInput.value = '';

      // alert("验证成功！即将进入系统...");
      window.location.href = 'https://shanjianerp.com';

    } else {
      // 密码错误，触发带按钮的报错
      showLoginError(formRow, '服务器码错误，请重新输入', true);
    }
  });
}

// 封装显示红字及辅助按钮的工具函数
function showLoginError(formRow, msg, showHelp = false) {
  formRow.classList.add('has-error');

  let errorEl = formRow.querySelector('.error-msg');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'error-msg';
    formRow.appendChild(errorEl);
  }

  // 基础错误文字
  let htmlContent = `<span>${msg}</span>`;

  // 如果需要显示客服和申请按钮
  if (showHelp) {
    htmlContent = `
      <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
        <span>${msg}</span>
        <span style="color: #ddd;">|</span>
        <a href="mailto:yuzhiruanjian@163.com" style="color: #3f6bd8; text-decoration: none;">联系客服</a>
        <span style="color: #ddd;">|</span>
        <!-- 点击这个按钮会关闭登录框，并打开留资弹窗 -->
        <a href="javascript:void(0)" onclick="switchToApply()" style="color: #3f6bd8; text-decoration: none;">获取服务器码</a>
      </div>
    `;
  }

  errorEl.innerHTML = htmlContent;
}

// 切换到留资弹窗的桥梁函数
window.switchToApply = function() {
  // 1. 关闭登录弹窗
  document.getElementById('login-dialog').close();
  // 2. 打开留资弹窗 (你网页里原本的 dialog)
  document.getElementById('trial-dialog').showModal();
};

