# 微信云函数 API 中转

小程序当前通过 `api-proxy` 云函数访问公网演示 API。客户端不再直接对
`xn--9kqy92aeqav77a.com` 调用 `wx.request`、`wx.uploadFile` 或
`wx.downloadFile`，因此不依赖该未备案域名进入小程序服务器域名白名单。

## 首次部署

1. 使用 AppID `wxe4d4ba748f352ae8` 打开项目。
2. 在微信开发者工具中打开“云开发”，按控制台当前可用套餐创建一个云环境。
3. 如果项目有多个云环境，把环境 ID 填入 `config/index.js` 的 `cloudEnv`；只有一个默认环境时可以保持空字符串。
4. 重启开发者工具。确认 `cloudfunctions` 目录显示为云函数目录。
5. 右键 `cloudfunctions/api-proxy`，选择“上传并部署：云端安装依赖”。
6. 在云函数控制台确认 `api-proxy` 部署成功，然后重新编译小程序。

如需重新生成云中转配置，可运行：

```powershell
npm run client:cloud-demo -- https://xn--9kqy92aeqav77a.com/api <云环境ID>
```

## 验证

登录页加载时应在云函数日志看到 `api-proxy` 调用，不应再出现
“不在 request 合法域名列表中”。首次匿名体验会进入人口登记页，保存后进入登记完成页和首页。

图片上报先进入临时云存储，再由云函数发送给演示 API；后端受保护图片也通过临时云文件返回。中转临时文件会在操作结束后清理。

## 回退为直连

如果后续完成域名备案，可执行：

```powershell
npm run client:remote-demo
```

该命令会把 `transport` 改回 `direct`，恢复 HTTPS 直连。
