// Default: original local mock pages. API workbench is an explicit opt-in.
(() => {
  const apiMode = new URLSearchParams(location.search).get("mode") === "api";
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error("页面脚本加载失败，请刷新重试。"));
    document.body.append(script);
  });
  const start = async () => {
    if (!apiMode) {
      const cameraViewport = document.getElementById("camera-viewport");
      if (cameraViewport) {
        cameraViewport.dataset.source = "checking";
        cameraViewport.dataset.mode = "normal";
      }
      await load("script.js");
      if (cameraViewport) await load("camera-live.js");
      return;
    }
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "connected.css";
    document.head.append(style);
    await load("api.js");
    await load("connected.js");
  };
  start().catch((error) => {
    document.body.dataset.ready = "true";
    const message = document.createElement("p");
    message.className = "container field-hint";
    message.setAttribute("role", "alert");
    message.textContent = error.message;
    document.querySelector("main").prepend(message);
  });
})();
