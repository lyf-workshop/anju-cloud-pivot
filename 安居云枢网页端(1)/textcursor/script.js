(() => {
  const form = document.querySelector("#report-form");
  const status = document.querySelector("#form-status");
  const buildingInfo = document.querySelector("#building-info");
  const buildings = document.querySelectorAll("[data-building]");

  const buildingData = {
    b1: {
      title: "1 号楼",
      desc: "18 层住宅 · 2 部消防电梯 · 消火栓逐层完好",
      href: "buildings.html#b1",
    },
    b2: {
      title: "2 号楼",
      desc: "24 层住宅 · 消防控制室联动 · 疏散楼梯双跑",
      href: "buildings.html#b2",
    },
    b3: {
      title: "3 号楼",
      desc: "16 层住宅 · 屋顶直升机停机坪标识已核验",
      href: "buildings.html#b3",
    },
    b4: {
      title: "会所 / 物管用房",
      desc: "微型消防站联动点 · 灭火器与破拆工具齐备",
      href: "buildings.html#b4",
    },
  };

  buildings.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-building");
      const data = buildingData[id];
      if (!data || !buildingInfo) return;

      buildings.forEach((el) => el.classList.remove("is-active"));
      btn.classList.add("is-active");

      buildingInfo.innerHTML = `
        <h3>${data.title}</h3>
        <p>${data.desc}</p>
        <a href="${data.href}">查看楼栋详情</a>
      `;
      buildingInfo.classList.add("is-open");
    });
  });

  document.addEventListener("click", (event) => {
    if (!buildingInfo || !buildingInfo.classList.contains("is-open")) return;
    const target = event.target;
    if (target.closest("[data-building]") || target.closest("#building-info")) return;
    buildingInfo.classList.remove("is-open");
    buildings.forEach((el) => el.classList.remove("is-active"));
  });

  const animateCounters = () => {
    document.querySelectorAll("[data-count]").forEach((el) => {
      const end = Number(el.getAttribute("data-count") || "0");
      const duration = 900;
      const start = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const value = Math.floor(end * (0.2 + 0.8 * progress));
        el.textContent = String(value);
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = String(end);
      };

      requestAnimationFrame(tick);
    });
  };

  animateCounters();

  /* —— 物业值班台：火情监测与处置 —— */
  const fireState = {
    active: false,
    level: null,
    detectedAt: null,
    timerId: null,
    urgeShown: {},
    unit: { building: "2", unit: "2-1801", owner: "韩*丽", elderly: 2, child: 0, adult: 0, special: "双人高龄，其中 1 人卧床", note: "第一优先救援户" },
  };

  const urgeRules = {
    small: [
      { after: 60, msg: "小火催促：请尽快联系工程/秩序到场确认，避免蔓延。" },
      { after: 180, msg: "小火超时：仍未办结，请升级为中火流程并复核现场。" },
    ],
    medium: [
      { after: 30, msg: "中火催促：立即取用灭火器/消火栓，通知微型消防站出动。" },
      { after: 120, msg: "中火超时：控制不佳请立即改判大火并拨打 119。" },
    ],
    large: [
      { after: 10, msg: "大火催促：确认已拨打 119，并启动楼栋疏散广播。" },
      { after: 60, msg: "大火催促：核对特殊人群户疏散进度（优先 2-1801）。" },
    ],
  };

  const levelGuides = {
    small: {
      title: "小火处置指引",
      actions: [
        "值班员保持监控复核，安排就近秩序员到场确认",
        "联系物业工程/秩序相关部门到场处理",
        "就地使用灭火毯或手提灭火器做初期控制（确保自身安全）",
        "同步在孪生图标注位置，准备升级预案",
      ],
      primaryText: "查看联络与人员台账",
      primaryHref: "people.html",
    },
    medium: {
      title: "中火处置指引",
      actions: [
        "立即拉动微型消防站，携带灭火器、水带水枪到场",
        "使用灭火器对准火焰根部灭火，打开就近消火栓支援",
        "清理消防车通道，禁止无关人员围观",
        "若 2 分钟内无法明显压制，升级为大火并拨打 119",
      ],
      primaryText: "打开中火预案",
      primaryHref: "knowledge.html#plan-medium",
    },
    large: {
      title: "大火处置指引",
      actions: [
        "立即拨打 119，说清小区名、楼栋单元与起火位置",
        "启动紧急疏散，优先协助行动不便等特殊人群",
        "控制室保持与到场消防力量联络",
        "禁止返回火场取物，电梯停用引导走疏散楼梯",
      ],
      primaryText: "打开紧急处置页",
      primaryHref: "emergency.html",
    },
  };

  const el = {
    simulate: document.querySelector("#btn-simulate-fire"),
    clear: document.querySelector("#btn-clear-fire"),
    handle: document.querySelector("#btn-handle-fire"),
    ownerBtn: document.querySelector("#btn-owner-info"),
    viewport: document.querySelector("#camera-viewport"),
    video: document.querySelector("#camera-video"),
    overlay: document.querySelector("#camera-overlay"),
    camBadge: document.querySelector("#cam-badge"),
    camTitle: document.querySelector("#camera-title"),
    camSub: document.querySelector("#camera-sub"),
    camName: document.querySelector("#camera-name"),
    camTime: document.querySelector("#camera-time"),
    fireStatus: document.querySelector("#fire-status-pill"),
    aiStatus: document.querySelector("#ai-status"),
    smokeStatus: document.querySelector("#smoke-status"),
    timerBar: document.querySelector("#fire-timer-bar"),
    timer: document.querySelector("#fire-timer"),
    urgeMsg: document.querySelector("#urge-msg"),
    fireMarker: document.querySelector("#fire-marker"),
    twinSub: document.querySelector("#twin-sub"),
    locatePanel: document.querySelector("#locate-panel"),
    locateBadge: document.querySelector("#locate-badge"),
    locateNote: document.querySelector("#locate-note"),
    ownerHint: document.querySelector("#owner-hint"),
    fireModal: document.querySelector("#fire-modal"),
    ownerModal: document.querySelector("#owner-modal"),
    ownerBody: document.querySelector("#owner-modal-body"),
    urgeToast: document.querySelector("#urge-toast"),
    levelLead: document.querySelector("#level-lead"),
    levelActions: document.querySelector("#level-actions"),
    levelPrimary: document.querySelector("#level-primary-action"),
  };

  /* 视频容器按原生像素等比适配：只缩小不放大、不拉伸；各页布局独立 reflow，不用整站 scale */
  const fitVideoViewport = () => {
    if (!el.viewport || !el.video) return;
    if (window.matchMedia("(max-width: 900px)").matches) {
      el.viewport.style.width = "";
      el.viewport.style.height = "";
      return;
    }

    const pane = el.viewport.closest(".ops-pane") || el.viewport.parentElement;
    if (!pane) return;

    const head = pane.querySelector(".ops-pane-head");
    const actions = pane.querySelector(".ops-pane-actions");
    const styles = window.getComputedStyle(el.viewport);
    const marginX =
      (parseFloat(styles.marginLeft) || 0) + (parseFloat(styles.marginRight) || 0);
    const marginY =
      (parseFloat(styles.marginTop) || 0) + (parseFloat(styles.marginBottom) || 0);

    const availW = Math.max(120, pane.clientWidth - marginX);
    const availH = Math.max(
      120,
      pane.clientHeight - (head ? head.offsetHeight : 0) - (actions ? actions.offsetHeight : 0) - marginY
    );

    const nw = el.video.videoWidth || 3840;
    const nh = el.video.videoHeight || 2160;
    if (!nw || !nh) return;

    const scale = Math.min(1, availW / nw, availH / nh);
    const w = Math.max(1, Math.floor(nw * scale));
    const h = Math.max(1, Math.floor(nh * scale));

    el.viewport.style.aspectRatio = "auto";
    el.viewport.style.width = `${w}px`;
    el.viewport.style.height = `${h}px`;
  };

  const playAlertVideo = (restart = false) => {
    if (!el.video) return;
    if (["checking", "locked", "live"].includes(el.viewport?.dataset.source)) return;
    el.video.muted = true;
    el.video.loop = true;
    if (restart) {
      try {
        el.video.currentTime = 0;
      } catch (_) {
        /* ignore seek before metadata */
      }
    }
    const playPromise = el.video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        /* autoplay may be blocked until user gesture; keep muted loop ready */
      });
    }
    fitVideoViewport();
  };

  const stopAlertVideo = () => {
    if (!el.video) return;
    el.video.pause();
    try {
      el.video.currentTime = 0;
    } catch (_) {
      /* ignore */
    }
  };

  const formatTimer = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const showToast = (msg) => {
    if (!el.urgeToast) return;
    el.urgeToast.textContent = msg;
    el.urgeToast.hidden = false;
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      el.urgeToast.hidden = true;
    }, 4500);
  };

  const setStep = (step) => {
    if (!el.fireModal) return;
    el.fireModal.querySelectorAll(".fire-step").forEach((node) => {
      node.hidden = Number(node.getAttribute("data-step")) !== step;
    });
  };

  const stopTimer = () => {
    if (fireState.timerId) {
      window.clearInterval(fireState.timerId);
      fireState.timerId = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    fireState.detectedAt = Date.now();
    fireState.urgeShown = {};
    if (el.timerBar) el.timerBar.hidden = false;
    if (el.timer) el.timer.textContent = "00:00";
    if (el.urgeMsg) el.urgeMsg.textContent = "已开始计时，请尽快完成误报研判与分级处置。";

    fireState.timerId = window.setInterval(() => {
      const sec = Math.floor((Date.now() - fireState.detectedAt) / 1000);
      if (el.timer) el.timer.textContent = formatTimer(sec);

      const level = fireState.level || "small";
      const rules = urgeRules[level] || [];
      rules.forEach((rule, idx) => {
        const key = `${level}-${idx}`;
        if (sec >= rule.after && !fireState.urgeShown[key]) {
          fireState.urgeShown[key] = true;
          if (el.urgeMsg) el.urgeMsg.textContent = rule.msg;
          showToast(rule.msg);
        }
      });
    }, 1000);
  };

  const setNormalMode = () => {
    fireState.active = false;
    fireState.level = null;
    stopTimer();
    stopAlertVideo();
    if (el.viewport) {
      el.viewport.dataset.mode = "normal";
      el.viewport.style.width = "";
      el.viewport.style.height = "";
      el.viewport.style.aspectRatio = "";
    }
    if (el.overlay) el.overlay.hidden = true;
    if (el.camBadge) {
      el.camBadge.textContent = "LIVE";
      el.camBadge.classList.remove("is-alert");
    }
    if (el.camTitle) el.camTitle.textContent = "全域概览摄像头";
    if (el.camSub) el.camSub.textContent = "正常模式 · 覆盖面最广镜头";
    if (el.camName) el.camName.textContent = "CAM-01 南高点全景";
    if (el.fireStatus) {
      el.fireStatus.textContent = "无告警";
      el.fireStatus.className = "pill-ok";
    }
    if (el.handle) el.handle.disabled = true;
    if (el.ownerBtn) el.ownerBtn.disabled = true;
    if (el.timerBar) el.timerBar.hidden = true;
    if (el.fireMarker) el.fireMarker.hidden = true;
    if (el.twinSub) el.twinSub.textContent = "园区态势正常 · 暂无火情定位";
    if (el.ownerHint) el.ownerHint.textContent = "有火情告警后，可查看涉事住户家庭情况（含特殊人群）。";
    if (el.urgeMsg) el.urgeMsg.textContent = "";
    if (el.locatePanel) el.locatePanel.dataset.mode = "normal";
    if (el.locateBadge) {
      el.locateBadge.textContent = "正常";
      el.locateBadge.classList.remove("is-alert");
    }
    if (el.locateNote) el.locateNote.textContent = "当前无告警。出现火情后将自动关联楼栋、户号与疏散要点。";
    if (el.fireModal) el.fireModal.hidden = true;
  };

  const setAlertMode = (options = {}) => {
    const { restartVideo = true, announce = true } = options;
    fireState.active = true;
    fireState.level = null;
    if (el.viewport) el.viewport.dataset.mode = "alert";
    if (el.overlay) el.overlay.hidden = false;
    if (el.camBadge) {
      el.camBadge.textContent = "ALERT";
      el.camBadge.classList.add("is-alert");
    }
    if (el.camTitle) el.camTitle.textContent = "火情关联摄像头";
    if (el.camSub) el.camSub.textContent = "YOLO26 + 烟雾识别命中 · 已切换具体画面";
    if (el.camName) el.camName.textContent = "CAM-12 2号楼东立面";
    if (el.fireStatus) {
      el.fireStatus.textContent = "告警中";
      el.fireStatus.className = "pill-warn";
    }
    if (el.handle) el.handle.disabled = false;
    if (el.ownerBtn) el.ownerBtn.disabled = false;
    if (el.fireMarker) el.fireMarker.hidden = false;
    if (el.twinSub) el.twinSub.textContent = "火情定位：2 号楼 · 户号 2-1801";
    if (el.ownerHint) el.ownerHint.textContent = "涉事户：2-1801 · 含行动不便特殊人群，请优先协助。";
    if (el.locatePanel) el.locatePanel.dataset.mode = "alert";
    if (el.locateBadge) {
      el.locateBadge.textContent = "告警点";
      el.locateBadge.classList.add("is-alert");
    }
    if (el.locateNote) el.locateNote.textContent = "结合左侧监控研判后，可查看业主信息并启动分级处置。";
    playAlertVideo(restartVideo);
    startTimer();
    if (announce) {
      showToast("演示告警：2 号楼 1801 附近出现疑似火情，请进入模拟处置流程。");
    }
  };

  const openFireModal = () => {
    if (!el.fireModal || !fireState.active) return;
    setStep(1);
    el.fireModal.hidden = false;
  };

  const openOwnerModal = () => {
    if (!el.ownerModal || !el.ownerBody || !fireState.active) return;
    const u = fireState.unit;
    el.ownerBody.innerHTML = `
      <p class="step-lead">火情关联户（演示数据，已脱敏）</p>
      <table class="data-table" style="min-width:0;border:1px solid var(--line);border-radius:12px;overflow:hidden">
        <tbody>
          <tr><th>楼栋 / 户号</th><td>${u.building} 号楼 · ${u.unit}</td></tr>
          <tr><th>户主</th><td>${u.owner}</td></tr>
          <tr><th>老人</th><td>${u.elderly}</td></tr>
          <tr><th>小孩</th><td>${u.child}</td></tr>
          <tr><th>成人</th><td>${u.adult}</td></tr>
          <tr><th>特殊人群</th><td><span class="tag-special">${u.special}</span></td></tr>
          <tr><th>疏散协助</th><td>${u.note}</td></tr>
        </tbody>
      </table>
      <p class="field-hint" style="margin-top:0.85rem">处置大火/中火时，请优先安排人力协助该户撤离。</p>
    `;
    el.ownerModal.hidden = false;
  };

  if (el.camTime) {
    const tickClock = () => {
      if (el.viewport?.dataset.source === "live") return;
      el.camTime.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    };
    tickClock();
    window.setInterval(tickClock, 1000);
  }

  if (el.simulate) {
    el.simulate.addEventListener("click", () => {
      setAlertMode({ restartVideo: true, announce: true });
    });
  }
  if (el.clear) el.clear.addEventListener("click", setNormalMode);
  if (el.handle) el.handle.addEventListener("click", openFireModal);
  if (el.ownerBtn) el.ownerBtn.addEventListener("click", openOwnerModal);

  /* 火灾预警演练：加载即从「已发现火情」开始 */
  if (el.viewport) {
    setAlertMode({ restartVideo: true, announce: true });
    if (el.video) {
      el.video.addEventListener("loadedmetadata", fitVideoViewport);
      el.video.addEventListener("loadeddata", () => {
        if (fireState.active) playAlertVideo(false);
        fitVideoViewport();
      });
    }
    window.addEventListener("resize", () => {
      window.clearTimeout(fitVideoViewport._t);
      fitVideoViewport._t = window.setTimeout(fitVideoViewport, 80);
    });
    if (typeof ResizeObserver !== "undefined") {
      const pane = el.viewport.closest(".ops-pane");
      if (pane) {
        const ro = new ResizeObserver(() => fitVideoViewport());
        ro.observe(pane);
      }
    }
  }

  document.querySelectorAll("[data-close-modal]").forEach((node) => {
    node.addEventListener("click", () => {
      if (el.fireModal) el.fireModal.hidden = true;
    });
  });

  document.querySelectorAll("[data-close-owner]").forEach((node) => {
    node.addEventListener("click", () => {
      if (el.ownerModal) el.ownerModal.hidden = true;
    });
  });

  document.querySelectorAll("[data-false-alarm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const isFalse = btn.getAttribute("data-false-alarm") === "yes";
      if (isFalse) {
        setNormalMode();
        showToast("已判定误报：告警关闭，已恢复全域监控。");
        return;
      }
      setStep(2);
    });
  });

  document.querySelectorAll("[data-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const level = btn.getAttribute("data-level");
      fireState.level = level;
      fireState.urgeShown = {};
      const guide = levelGuides[level];
      if (!guide) return;
      if (el.levelLead) el.levelLead.textContent = guide.title;
      if (el.levelActions) {
        el.levelActions.innerHTML = guide.actions.map((item) => `<li>${item}</li>`).join("");
      }
      if (el.levelPrimary) {
        el.levelPrimary.textContent = guide.primaryText;
        el.levelPrimary.setAttribute("href", guide.primaryHref);
      }
      if (el.urgeMsg) el.urgeMsg.textContent = `已选择「${btn.querySelector("strong").textContent}」，催促规则已切换。`;
      setStep(3);
    });
  });

  if (form && status) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      status.classList.remove("is-ok", "is-error");

      const location = form.location.value.trim();
      const type = form.type.value.trim();
      const desc = form.desc.value.trim();
      const phone = form.phone.value.trim().replace(/\s+/g, "");

      if (!location || !type || !desc || !phone) {
        status.textContent = "请完整填写带 * 的必填项。";
        status.classList.add("is-error");
        return;
      }

      if (!/^1\d{10}$|^0\d{2,3}-?\d{7,8}$|^400-?\d{3}-?\d{4}$/.test(phone)) {
        status.textContent = "请填写有效联系电话。";
        status.classList.add("is-error");
        return;
      }

      status.textContent = "提交成功（本地演示，未上传服务器）。物业将在 1 个工作日内回复处理进度。后续可对接后端或邮箱。";
      status.classList.add("is-ok");
      form.reset();
    });
  }

  /* —— 人员信息页 —— */
  const peopleTbody = document.querySelector("#people-tbody");
  if (peopleTbody) {
    /* 3 栋 × 3–32 层 × 每层 4 户 = 360 户，合计约一千人 */
    const buildPeopleRows = () => {
      const surnames = [
        "王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙", "胡", "朱", "高",
        "林", "何", "郭", "马", "罗", "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "程",
        "曹", "袁", "邓", "许", "傅", "沈", "曾", "彭", "吕", "苏", "卢", "蒋", "蔡", "贾", "丁",
        "魏", "薛", "叶", "余", "潘", "杜", "戴", "夏", "钟", "汪", "田", "任", "姜", "范", "方",
      ];
      const given = [
        "明", "华", "强", "伟", "芳", "娜", "敏", "静", "丽", "军", "杰", "勇", "艳", "超", "娟",
        "秀", "英", "霞", "平", "刚", "磊", "涛", "鹏", "飞", "浩", "宇", "晨", "阳", "梅", "兰",
      ];
      const specialPool = [
        { special: "独居老人，行走缓慢", note: "优先人工协助下楼" },
        { special: "行动不便（轮椅）", note: "需电梯或担架，联系微型站" },
        { special: "听力障碍", note: "敲门/手势提醒疏散" },
        { special: "视力障碍", note: "引导至集合点" },
        { special: "行动不便（拐杖）", note: "避开拥堵楼梯口" },
        { special: "老人慢性病，不宜剧烈运动", note: "缓步疏散，专人陪同" },
        { special: "幼儿需抱持撤离", note: "优先协助家长" },
        { special: "家有婴幼儿", note: "协助推婴儿车或抱持" },
        { special: "行动不便（助行器）", note: "专人陪同下楼" },
        { special: "独居老人，听力减退", note: "加强敲门与广播提醒" },
      ];

      let seed = 20260930;
      const rand = () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const pick = (arr) => arr[Math.floor(rand() * arr.length)];
      const ownerName = () => {
        const s = pick(surnames);
        return rand() < 0.55 ? `${s}*` : `${s}*${pick(given)}`;
      };

      const rows = [];
      for (let b = 1; b <= 3; b += 1) {
        for (let floor = 3; floor <= 32; floor += 1) {
          for (let room = 1; room <= 4; room += 1) {
            const unit = `${b}-${floor}${String(room).padStart(2, "0")}`;

            /* 火情演示固定户：2-1801 */
            if (b === 2 && floor === 18 && room === 1) {
              rows.push({
                building: "2",
                unit,
                owner: "韩*丽",
                elderly: 2,
                child: 0,
                adult: 0,
                special: "双人高龄，其中 1 人卧床",
                note: "第一优先救援户",
              });
              continue;
            }

            let elderly = 0;
            let child = 0;
            let adult = 0;
            const r = rand();
            if (r < 0.08) {
              elderly = 1 + Math.floor(rand() * 2);
              adult = rand() < 0.4 ? 1 : 0;
            } else if (r < 0.22) {
              adult = 2;
              child = 1 + Math.floor(rand() * 2);
              elderly = rand() < 0.25 ? 1 : 0;
            } else if (r < 0.35) {
              adult = 1 + Math.floor(rand() * 2);
              elderly = 1;
              child = rand() < 0.5 ? 1 : 0;
            } else if (r < 0.5) {
              adult = 2;
              child = rand() < 0.35 ? 1 : 0;
            } else if (r < 0.65) {
              adult = 1 + Math.floor(rand() * 2);
            } else if (r < 0.8) {
              adult = 2;
              child = 1;
              elderly = rand() < 0.2 ? 1 : 0;
            } else {
              adult = 2 + Math.floor(rand() * 2);
              child = Math.floor(rand() * 3);
              elderly = rand() < 0.3 ? 1 : 0;
            }
            if (elderly + child + adult === 0) adult = 1;

            let special = "";
            let note = "";
            if (rand() < 0.12) {
              const sp = pick(specialPool);
              special = sp.special;
              note = sp.note;
            }

            rows.push({
              building: String(b),
              unit,
              owner: ownerName(),
              elderly,
              child,
              adult,
              special,
              note,
            });
          }
        }
      }
      return rows;
    };

    const peopleRows = buildPeopleRows();

    const summary = peopleRows.reduce(
      (acc, row) => {
        acc.elderly += row.elderly;
        acc.child += row.child;
        acc.adult += row.adult;
        if (row.special) acc.special += 1;
        return acc;
      },
      { elderly: 0, child: 0, adult: 0, special: 0 }
    );
    summary.total = summary.elderly + summary.child + summary.adult;

    const summaryMap = {
      total: summary.total,
      elderly: summary.elderly,
      child: summary.child,
      adult: summary.adult,
      special: summary.special,
    };
    document.querySelectorAll(".people-summary [data-count]").forEach((el, idx) => {
      const keys = ["total", "elderly", "child", "adult", "special"];
      const key = keys[idx];
      if (!key) return;
      el.setAttribute("data-count", String(summaryMap[key]));
      el.textContent = "0";
    });
    animateCounters();

    /* 默认：1 号楼 + 低层，避免一上来铺满 360 户 */
    const PAGE_SIZE = 20;
    const bandRanges = {
      low: [3, 10],
      mid: [11, 20],
      high: [21, 32],
      all: [3, 32],
    };

    const state = {
      building: "1",
      floorBand: "low",
      floorExact: "all",
      search: "",
      types: { elderly: false, child: false, special: false },
      page: 1,
    };

    const floorExactSelect = document.querySelector("#floor-exact");
    const floorBandSelect = document.querySelector("#floor-band");
    const searchInput = document.querySelector("#people-search");
    const resultMeta = document.querySelector("#people-result-meta");
    const pageInfo = document.querySelector("#people-page-info");
    const prevBtn = document.querySelector("#people-prev");
    const nextBtn = document.querySelector("#people-next");

    const parseFloor = (unit) => {
      const raw = String(unit).split("-")[1] || "";
      return Number(raw.slice(0, -2)) || 0;
    };

    const fillFloorOptions = () => {
      if (!floorExactSelect) return;
      const [minF, maxF] = bandRanges[state.floorBand] || bandRanges.all;
      const current = state.floorExact;
      floorExactSelect.innerHTML = `<option value="all">不限</option>`;
      for (let f = minF; f <= maxF; f += 1) {
        const opt = document.createElement("option");
        opt.value = String(f);
        opt.textContent = `${f} 层`;
        floorExactSelect.appendChild(opt);
      }
      const stillValid = current === "all" || (Number(current) >= minF && Number(current) <= maxF);
      state.floorExact = stillValid ? current : "all";
      floorExactSelect.value = state.floorExact;
    };

    const getFilteredRows = () => {
      const q = state.search.trim().toLowerCase();
      const [minF, maxF] = bandRanges[state.floorBand] || bandRanges.all;

      return peopleRows.filter((row) => {
        const floor = parseFloor(row.unit);
        if (state.building !== "all" && row.building !== state.building) return false;
        if (floor < minF || floor > maxF) return false;
        if (state.floorExact !== "all" && floor !== Number(state.floorExact)) return false;
        if (state.types.elderly && row.elderly <= 0) return false;
        if (state.types.child && row.child <= 0) return false;
        if (state.types.special && !row.special) return false;
        if (q) {
          const hay = `${row.unit} ${row.owner} ${row.special || ""} ${row.note || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    };

    const renderPeople = () => {
      const filtered = getFilteredRows();
      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;

      const start = (state.page - 1) * PAGE_SIZE;
      const pageRows = filtered.slice(start, start + PAGE_SIZE);

      if (resultMeta) {
        const bandLabel =
          state.floorBand === "all"
            ? "全部楼层"
            : state.floorBand === "low"
              ? "低层 3–10"
              : state.floorBand === "mid"
                ? "中层 11–20"
                : "高层 21–32";
        const buildingLabel = state.building === "all" ? "全部楼栋" : `${state.building} 号楼`;
        resultMeta.textContent =
          filtered.length === 0
            ? `当前筛选无结果 · ${buildingLabel} · ${bandLabel}`
            : `共 ${filtered.length} 户 · ${buildingLabel} · ${bandLabel} · 每页 ${PAGE_SIZE} 户`;
      }

      if (pageInfo) pageInfo.textContent = `第 ${state.page} / ${totalPages} 页`;
      if (prevBtn) prevBtn.disabled = state.page <= 1;
      if (nextBtn) nextBtn.disabled = state.page >= totalPages || filtered.length === 0;

      if (!pageRows.length) {
        peopleTbody.innerHTML = `<tr><td colspan="9">当前筛选下暂无记录，请调整楼栋、楼层或类型条件。</td></tr>`;
        return;
      }

      peopleTbody.innerHTML = pageRows
        .map((row) => {
          const total = row.elderly + row.child + row.adult;
          const specialHtml = row.special
            ? `<span class="tag-special">${row.special}</span>`
            : `<span class="tag-none">—</span>`;
          return `
            <tr data-building="${row.building}" class="${row.special ? "has-special" : ""}">
              <td>${row.building} 号楼</td>
              <td>${row.unit}</td>
              <td>${row.owner}</td>
              <td>${row.elderly}</td>
              <td>${row.child}</td>
              <td>${row.adult}</td>
              <td><strong>${total}</strong></td>
              <td>${specialHtml}</td>
              <td>${row.note || "—"}</td>
            </tr>
          `;
        })
        .join("");
    };

    const resetPageAndRender = () => {
      state.page = 1;
      renderPeople();
    };

    document.querySelectorAll("[data-building-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-building-filter]").forEach((el) => {
          el.classList.remove("is-active");
          el.setAttribute("aria-selected", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
        state.building = btn.getAttribute("data-building-filter") || "1";
        resetPageAndRender();
      });
    });

    if (floorBandSelect) {
      floorBandSelect.addEventListener("change", () => {
        state.floorBand = floorBandSelect.value || "low";
        fillFloorOptions();
        resetPageAndRender();
      });
    }

    if (floorExactSelect) {
      floorExactSelect.addEventListener("change", () => {
        state.floorExact = floorExactSelect.value || "all";
        resetPageAndRender();
      });
    }

    if (searchInput) {
      let searchTimer = null;
      searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.search = searchInput.value || "";
          resetPageAndRender();
        }, 180);
      });
    }

    document.querySelectorAll("[data-type-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-type-filter");
        if (!key || !(key in state.types)) return;
        state.types[key] = !state.types[key];
        btn.setAttribute("aria-pressed", state.types[key] ? "true" : "false");
        resetPageAndRender();
      });
    });

    const resetBtn = document.querySelector("#people-filter-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.building = "1";
        state.floorBand = "low";
        state.floorExact = "all";
        state.search = "";
        state.types = { elderly: false, child: false, special: false };
        state.page = 1;

        document.querySelectorAll("[data-building-filter]").forEach((el) => {
          const active = el.getAttribute("data-building-filter") === "1";
          el.classList.toggle("is-active", active);
          el.setAttribute("aria-selected", active ? "true" : "false");
        });
        document.querySelectorAll("[data-type-filter]").forEach((el) => {
          el.setAttribute("aria-pressed", "false");
        });
        if (floorBandSelect) floorBandSelect.value = "low";
        if (searchInput) searchInput.value = "";
        fillFloorOptions();
        renderPeople();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (state.page <= 1) return;
        state.page -= 1;
        renderPeople();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        state.page += 1;
        renderPeople();
      });
    }

    fillFloorOptions();
    renderPeople();
  }

  /* —— 巡查台账：点击行查看详情 —— */
  const inspectionTbody = document.querySelector("#inspection-tbody");
  const inspectionModal = document.querySelector("#inspection-modal");
  const inspectionModalBody = document.querySelector("#inspection-modal-body");
  const inspectionModalTitle = document.querySelector("#inspection-modal-title");

  if (inspectionTbody && inspectionModal && inspectionModalBody) {
    const inspectionRecords = [
      {
        id: "insp-0922",
        date: "2026-09-22",
        area: "南门消防车通道",
        item: "占道停放",
        result: "正常",
        resultClass: "tag-ok",
        handle: "—",
        shift: "早班 · 08:30–09:10",
        inspector: "秩序员 刘*辉",
        route: "南门入口 → 通道两侧黄线 → 回车场",
        findings: ["通道两侧无违停车辆", "消防登高操作面标识清晰", "回车场净空满足要求"],
        photos: "现场照片 3 张（通道全景、黄线特写、回车场）",
        followUp: "当日无隐患，纳入周巡查归档。",
        timeline: [
          { time: "08:30", text: "开始巡查，核对通道净宽" },
          { time: "08:55", text: "拍照留档，确认无占道" },
          { time: "09:10", text: "巡查结束，结果录入台账" },
        ],
      },
      {
        id: "insp-0921",
        date: "2026-09-21",
        area: "2 号楼地库坡道",
        item: "临时占道",
        result: "待整改",
        resultClass: "tag-warn",
        handle: "已劝离并复核",
        shift: "中班 · 14:20–15:05",
        inspector: "秩序员 张*伟 / 工程 陈*",
        route: "2 号楼地库入口坡道 → 坡道中段 → 地库通道口",
        findings: [
          "发现临时停放厢式货车占用坡道外侧约 1.2 米",
          "影响消防车下地库通行宽度",
          "车主在场，已口头劝离并引导至访客车位",
        ],
        photos: "整改前照片 2 张、劝离后复核照片 1 张",
        followUp: "当日 14:48 复核已清空；次日早班再次抽查无复发。",
        timeline: [
          { time: "14:20", text: "巡查发现临时占道" },
          { time: "14:28", text: "联系车主劝离，同步通知工程复核净宽" },
          { time: "14:48", text: "车辆驶离，现场复核通过" },
          { time: "15:05", text: "台账记为「待整改→已复核清空」" },
        ],
      },
      {
        id: "insp-0920",
        date: "2026-09-20",
        area: "3 号楼 2 单元",
        item: "楼道堆物",
        result: "整改中",
        resultClass: "tag-warn",
        handle: "已通知业主限期清理",
        shift: "晚班 · 19:10–19:50",
        inspector: "客服 周*敏 / 秩序 马*",
        route: "3 号楼 2 单元 1–6 层公共走道与前室",
        findings: [
          "2 单元 4–5 层楼梯间堆放纸箱、旧家具碎片",
          "部分占用疏散宽度约 0.4 米",
          "未发现电动车入户充电迹象",
        ],
        photos: "堆物位置照片 4 张、张贴整改告知单照片 1 张",
        followUp: "已向 4 层、5 层相关业主下发限期清理通知（截止 2026-09-23）；客服跟进中，到期未清将升级隐患工单。",
        timeline: [
          { time: "19:10", text: "单元巡查发现楼道堆物" },
          { time: "19:25", text: "拍照取证并张贴整改告知" },
          { time: "19:40", text: "电话/微信通知相关业主" },
          { time: "19:50", text: "台账标记「整改中」，设定复查日" },
        ],
      },
      {
        id: "insp-0919",
        date: "2026-09-19",
        area: "微型消防站",
        item: "装备点验",
        result: "完好",
        resultClass: "tag-ok",
        handle: "—",
        shift: "早班 · 09:00–09:40",
        inspector: "微型站值班 何*军",
        route: "站内器材架 → 水带水枪柜 → 破拆工具箱 → 应急照明",
        findings: [
          "灭火器压力表均在绿区，铅封完好",
          "水带、水枪、接口齐全可展开",
          "破拆工具、应急照明电量正常",
        ],
        photos: "器材架全景 1 张、灭火器点验特写 2 张",
        followUp: "点验合格，下次计划点验日 2026-09-26。",
        timeline: [
          { time: "09:00", text: "开启站内点验清单" },
          { time: "09:25", text: "逐项核对数量与状态" },
          { time: "09:40", text: "签字归档，结果「完好」" },
        ],
      },
      {
        id: "insp-0918",
        date: "2026-09-18",
        area: "集中充电车棚",
        item: "充电秩序",
        result: "正常",
        resultClass: "tag-ok",
        handle: "—",
        shift: "晚班 · 20:00–20:35",
        inspector: "秩序员 孙*磊",
        route: "东侧车棚 → 西侧车棚 → 配电箱与烟感终端",
        findings: [
          "车辆均在指定车位充电，无飞线私拉",
          "烟感、急停按钮外观正常",
          "通道无堆放杂物，应急照明可用",
        ],
        photos: "车棚全景 2 张、配电箱外观 1 张",
        followUp: "秩序正常，继续按每日晚高峰抽查。",
        timeline: [
          { time: "20:00", text: "开始车棚秩序巡查" },
          { time: "20:18", text: "核对充电位与线路" },
          { time: "20:35", text: "巡查结束，结果「正常」" },
        ],
      },
    ];

    const resultBadge = (record) =>
      `<span class="${record.resultClass}">${record.result}</span>`;

    const renderInspectionRows = () => {
      inspectionTbody.innerHTML = inspectionRecords
        .map(
          (r) => `
          <tr tabindex="0" role="button" data-inspection-id="${r.id}" aria-label="查看 ${r.date} ${r.area} 巡查详情">
            <td>${r.date}</td>
            <td>${r.area}</td>
            <td>${r.item}</td>
            <td>${resultBadge(r)}</td>
            <td>${r.handle}</td>
            <td class="row-action">查看详情 →</td>
          </tr>
        `
        )
        .join("");
    };

    const openInspectionDetail = (id) => {
      const record = inspectionRecords.find((r) => r.id === id);
      if (!record) return;

      if (inspectionModalTitle) {
        inspectionModalTitle.textContent = `${record.area} · ${record.item}`;
      }

      inspectionModalBody.innerHTML = `
        <p class="step-lead">${record.date} 防火巡查记录（演示数据）</p>
        <dl class="inspection-detail-meta">
          <div>
            <dt>检查结果</dt>
            <dd>${resultBadge(record)}</dd>
          </div>
          <div>
            <dt>当前处理</dt>
            <dd>${record.handle}</dd>
          </div>
          <div>
            <dt>巡查班次</dt>
            <dd>${record.shift}</dd>
          </div>
          <div>
            <dt>巡查人员</dt>
            <dd>${record.inspector}</dd>
          </div>
          <div>
            <dt>检查区域</dt>
            <dd>${record.area}</dd>
          </div>
          <div>
            <dt>检查项目</dt>
            <dd>${record.item}</dd>
          </div>
        </dl>
        <div class="inspection-detail-block">
          <h3>巡查路线</h3>
          <p>${record.route}</p>
        </div>
        <div class="inspection-detail-block">
          <h3>现场发现</h3>
          <ul>${record.findings.map((f) => `<li>${f}</li>`).join("")}</ul>
        </div>
        <div class="inspection-detail-block">
          <h3>影像留档</h3>
          <p>${record.photos}</p>
        </div>
        <div class="inspection-detail-block">
          <h3>后续跟进</h3>
          <p>${record.followUp}</p>
        </div>
        <div class="inspection-detail-block">
          <h3>处置时间线</h3>
          <ol class="inspection-timeline">
            ${record.timeline
              .map((t) => `<li><time>${t.time}</time><span>${t.text}</span></li>`)
              .join("")}
          </ol>
        </div>
      `;

      inspectionModal.hidden = false;
    };

    const closeInspectionDetail = () => {
      inspectionModal.hidden = true;
    };

    inspectionTbody.addEventListener("click", (event) => {
      const row = event.target.closest("tr[data-inspection-id]");
      if (!row) return;
      openInspectionDetail(row.getAttribute("data-inspection-id"));
    });

    inspectionTbody.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest("tr[data-inspection-id]");
      if (!row) return;
      event.preventDefault();
      openInspectionDetail(row.getAttribute("data-inspection-id"));
    });

    document.querySelectorAll("[data-close-inspection]").forEach((node) => {
      node.addEventListener("click", closeInspectionDetail);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !inspectionModal.hidden) {
        closeInspectionDetail();
      }
    });

    renderInspectionRows();
  }
})();
