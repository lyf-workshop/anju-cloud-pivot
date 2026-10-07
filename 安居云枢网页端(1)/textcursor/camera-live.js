(() => {
  const CAMERA_ID = "CAM-RPI-01";
  const statusUrl = `/api/camera-access/v1/cameras/${encodeURIComponent(CAMERA_ID)}`;
  const viewport = document.getElementById("camera-viewport");
  const feed = document.getElementById("camera-feed");
  const access = document.getElementById("camera-access-state");
  const badge = document.getElementById("cam-badge");
  const title = document.getElementById("camera-title");
  const subtitle = document.getElementById("camera-sub");
  const name = document.getElementById("camera-name");
  const time = document.getElementById("camera-time");
  const ai = document.getElementById("ai-status");
  const smoke = document.getElementById("smoke-status");
  const fire = document.getElementById("fire-status-pill");
  const handle = document.getElementById("btn-handle-fire");
  const simulate = document.getElementById("btn-simulate-fire");
  const clear = document.getElementById("btn-clear-fire");
  const demoVideo = document.getElementById("camera-video");
  const loginLink = document.getElementById("camera-login-link");
  const brandSubtitle = document.querySelector(".brand-text small");
  let image;
  let streamUrl = "";
  let pollingEnabled = true;

  const pill = (element, value, className) => {
    if (!element) return;
    element.textContent = value;
    element.className = className;
  };
  const showAccess = (html) => {
    if (!access) return;
    access.hidden = false;
    access.innerHTML = html;
  };
  const stopStream = () => {
    if (image) image.remove();
    image = undefined;
    streamUrl = "";
  };
  const stopDemoVideo = () => {
    if (!demoVideo) return;
    demoVideo.pause();
  };
  const startStream = (url) => {
    if (streamUrl === url && image?.isConnected) return;
    stopStream();
    image = document.createElement("img");
    image.className = "camera-live-image";
    image.alt = "树莓派摄像头实时测试画面，检测结果需人工复核";
    image.addEventListener("load", () => { if (access) access.hidden = true; }, { once: true });
    image.addEventListener("error", () => showAccess("视频流暂时中断，正在重连…"));
    image.src = `${url}?t=${Date.now()}`;
    viewport.insertBefore(image, viewport.querySelector(".camera-overlay"));
    streamUrl = url;
  };
  const offline = (message) => {
    stopStream();
    stopDemoVideo();
    viewport.dataset.mode = "normal";
    viewport.dataset.source = "offline";
    badge.className = "cam-badge is-offline";
    badge.textContent = "OFFLINE";
    title.textContent = "树莓派摄像头";
    subtitle.textContent = message;
    pill(ai, "离线", "pill-warn");
    pill(smoke, "无最新画面", "pill-warn");
    pill(fire, "状态未知", "pill-warn");
    showAccess(message);
  };
  const render = (data) => {
    if (!data.online) return offline("最近画面已过期，请检查树莓派服务与网络");
    stopDemoVideo();
    viewport.dataset.source = "live";
    viewport.dataset.mode = "normal";
    startStream(data.streamUrl);
    badge.className = `cam-badge is-${data.alarmState}`;
    badge.textContent = data.alarmState === "confirmed" ? "REVIEW" : data.alarmState === "candidate" ? "CHECK" : "LIVE";
    title.textContent = "树莓派实时识别画面";
    subtitle.textContent = `${data.model.name} · 测试数据 · ${Math.round(data.inferenceMs)} ms`;
    name.textContent = `${data.cameraId} · ${data.source}`;
    time.textContent = new Date(data.capturedAt).toLocaleTimeString("zh-CN", { hour12: false });
    pill(ai, "在线", "pill-ok");
    if (loginLink) {
      loginLink.textContent = "实时画面已安全连接 · 打开物业工作台 →";
      loginLink.href = "index.html?mode=api";
    }
    if (brandSubtitle) {
      brandSubtitle.textContent = "物业消防值班台 · 树莓派测试";
      brandSubtitle.title = "摄像头与模型已连接；其余台账和统计仍为 Mock 演示数据";
    }
    if (data.alarmState === "confirmed") {
      pill(smoke, "连续帧命中", "pill-warn");
      pill(fire, "模型疑似 · 待人工复核", "pill-warn");
    } else if (data.alarmState === "candidate") {
      pill(smoke, "正在复核", "pill-warn");
      pill(fire, "候选结果", "pill-warn");
    } else {
      pill(smoke, "本帧未检出", "pill-ok");
      pill(fire, "模型未检出", "pill-ok");
    }
    if (handle) {
      handle.disabled = true;
      handle.textContent = data.alarmState === "confirmed" ? "需人工复核后处置" : "实时识别仅供测试";
    }
    if (simulate) { simulate.disabled = true; simulate.title = "实时画面连接时停用 Mock 火情按钮"; }
    if (clear) { clear.disabled = true; clear.title = "实时画面状态由树莓派上报"; }
  };

  const poll = async () => {
    try {
      const response = await fetch(statusUrl, { credentials: "same-origin", cache: "no-store" });
      const result = await response.json();
      if (response.ok && result.data?.authenticated === false) {
        pollingEnabled = false;
        stopStream();
        stopDemoVideo();
        viewport.dataset.mode = "normal";
        viewport.dataset.source = "locked";
        badge.className = "cam-badge is-offline";
        badge.textContent = "LOGIN";
        title.textContent = "树莓派实时画面";
        subtitle.textContent = "实时视频仅对物业账号开放";
        pill(ai, "需登录", "pill-warn");
        pill(smoke, "受控访问", "pill-warn");
        pill(fire, "状态不可见", "pill-warn");
        showAccess('<span>实时视频受物业账号保护<br><a href="login.html?next=/index.html">登录后查看</a></span>');
        return;
      }
      if (!response.ok) throw new Error(result.error?.message || "摄像头状态暂不可用");
      render(result.data);
    } catch (error) {
      offline(error.message || "摄像头连接失败");
    }
  };
  poll();
  window.setInterval(() => { if (pollingEnabled) poll(); }, 2000);
})();
