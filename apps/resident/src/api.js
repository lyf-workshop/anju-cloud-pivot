const DEFAULT_API = "https://xn--9kqy92aeqav77a.com/api";

export class ApiError extends Error {
  constructor(message, status = 0, code = "NETWORK_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class ApiClient {
  constructor() {
    this.baseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API).replace(/\/$/, "");
    this.token = "";
  }

  setToken(token) {
    this.token = token || "";
  }

  async request(path, options = {}) {
    const method = options.method || "GET";
    const headers = {
      Accept: "application/json",
      "X-Data-Mode": "demo",
      "X-Anju-Client": "judge-app/1.4.0",
      ...(options.headers || {}),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    let body = options.body;
    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    const attempt = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeout || 15000);
      try {
        const response = await fetch(this.baseUrl + path, {
          method,
          headers,
          body,
          cache: "no-store",
          signal: controller.signal,
        });
        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
          ? await response.json()
          : null;
        if (!response.ok || !payload || !("data" in payload)) {
          throw new ApiError(
            payload?.error?.message || `服务器返回 ${response.status}`,
            response.status,
            payload?.error?.code || "HTTP_ERROR",
          );
        }
        return payload.data;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          navigator.onLine === false
            ? "当前网络不可用，内容已保留，请联网后重试"
            : "暂时无法连接演示服务器，请稍后重试",
        );
      } finally {
        clearTimeout(timer);
      }
    };
    try {
      return await attempt();
    } catch (error) {
      if (options.retry && (!error.status || error.status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return attempt();
      }
      throw error;
    }
  }

  get(path, retry = true) {
    return this.request(path, { retry });
  }

  post(path, body) {
    return this.request(path, { method: "POST", body });
  }

  put(path, body) {
    return this.request(path, { method: "PUT", body });
  }

  patch(path, body) {
    return this.request(path, { method: "PATCH", body });
  }

  async upload(file) {
    const form = new FormData();
    form.append("file", file, file.name || "photo.jpg");
    return this.request("/attachments", { method: "POST", body: form, timeout: 30000 });
  }
}

export const api = new ApiClient();
