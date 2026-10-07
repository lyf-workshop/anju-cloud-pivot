import { buildApp } from "./app.js";
import { settings } from "./config.js";
async function main() {
  const cfg = settings();
  const app = await buildApp(cfg);
  await app.listen({ port: cfg.port, host: cfg.host });
  console.log(`安居云枢 API: http://${cfg.host}:${cfg.port}/api (${cfg.mode})`);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      void app.close().then(() => process.exit(0));
    });
}
main().catch(() => {
  console.error("API 启动失败，请检查端口、数据库与服务端配置");
  process.exitCode = 1;
});
