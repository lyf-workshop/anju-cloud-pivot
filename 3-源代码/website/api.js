// Browser adapter: same-origin HTTP-only session. No mock-success fallback.
window.AnjuAPI = (() => {
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = { "X-Anju-Request": "1", ...options.headers };
      if (options.body && !(options.body instanceof FormData))
        headers["Content-Type"] = "application/json";
      const response = await fetch("/api" + path, {
        credentials: "same-origin",
        ...options,
        headers,
        signal: controller.signal,
      });
      const result = await response.json();
      if (
        !response.ok ||
        !Object.prototype.hasOwnProperty.call(result, "data")
      ) {
        const error = new Error(result.error?.message || "请求失败");
        error.status = response.status;
        error.code = result.error?.code;
        throw error;
      }
      return result.data;
    } catch (error) {
      if (error.name === "AbortError" || error instanceof TypeError)
        throw new Error(
          "连接失败或超时，请检查服务后重试。填写内容已保留。",
        );
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    get: (path) => request(path),
    post: (path, body) =>
      request(path, { method: "POST", body: JSON.stringify(body) }),
    patch: (path, body) =>
      request(path, { method: "PATCH", body: JSON.stringify(body) }),
    upload: (file) => {
      const form = new FormData();
      form.append("file", file);
      return request("/attachments", { method: "POST", body: form });
    },
    key: () => crypto.randomUUID(),
  };
})();
