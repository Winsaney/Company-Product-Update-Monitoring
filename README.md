# 万象企业版 - 开源伙伴产品监控

这是一款轻量级的 **GitHub 仓库版本监控与自动总结中心**，专为关注开源项目及上下游依赖的开发者/企业设计。它不仅能定时监测选定仓库的最新 Release，还可以通过集成 AI 大模型，对长篇幅的 Release Notes 自动生成中文精简总结。

## ✨ 核心特性

- 📦 **仓库版本监控**：定时轮询 GitHub，检测指定仓库是否有新版本发布。
- 🤖 **AI 智能总结**：支持配置任意 OpenAI 兼容大模型（如 DeepSeek、通义千问等），一键将繁杂的原始 Release Notes 转化为清晰易读的中文要点。
- 📧 **邮件自动通知**：当发现新版本时，可配置自动发送邮件通知给指定收件箱。
- 🔐 **安全加固（单用户鉴权）**：全站受 JWT 登录保护，支持通过环境变量自定义全局管理员访问密码。
- ☁️ **云原生友好**：支持零基础一键部署到 Railway，数据支持通过挂载 Persistent Volume 持久化存储，不怕更新丢失。

---

## 🚀 快速上手 (本地运行)

**1. 安装依赖**
```bash
npm install
```

**2. 启动服务**
```bash
npm start
```
服务默认运行在 `http://localhost:3000`。初始登录密码为 `admin123`（在没有设置环境变量的情况下）。

---

## ☁️ 云端部署 (推荐 Railway)

本项目针对类似 Railway 的 Serverless/Dockerless 云容器平台做了特别优化。

### 部署步骤
1. 将当前代码库 Fork/推送到受支持的 GitHub 仓库。
2. 登录 [Railway](https://railway.app/)，选择 **New Project** -> **Deploy from GitHub repo**，选取该仓库。
3. Railway 会自动使用内部生成的 `PORT` 启动容器引擎。

### 配置环境变量 (Variables)
为了保障应用的安全和数据的持久化存储，强烈建议添加以下环境变量：

- `ADMIN_PASSWORD`：[重要] 修改默认的管理员登录密码（尽量避免空格等特殊空字符）。
- `DATA_DIR`：[重要] 配合持久化存储使用，设定数据文件在容器内保存的位置。

*(环境变量 `JWT_SECRET` 和 `PORT` 框架会自动处理，通常无需手动分配)*

### 🔥 配置防止数据丢失挂载盘 (Persistent Volume)
由于 Railway 每次更新代码都会重启创建全新的容器，你需要为其挂载持久化硬盘以防止设置清除：
1. 去 Railway 项目的 **Settings** -> **Volumes**，点击 **Add Volume** 挂载卷。
2. 挂载路径（Mount Path）推荐填写：`/app/data`。
3. 接着去 **Variables** 环境变量里，新增一条 `DATA_DIR=/app/data`。
4. 发生下次部署后，你的所有记录和配置便会永久安全地保存在这个卷上！

---

## ⚙️ 在线配置

进入左侧导航栏的 **「设置」** 页面即可配置高级选项：
- **GitHub Token**：填写 Personal Access Token 以防止因为频繁调用触发 GitHub 官方抓取限流。
- **定时检查间隔**：后台自动检测更新的频率（默认 7 天检测一次）。
- **邮件服务 (SMTP)**：配置发件服务器及账号用于接收更新提醒。
- **AI 大模型 (LLM)**：支持任意遵循 OpenAI 规范的接口。只需填写正确的 API 地址和你的 Key（会自动修复常见的命名如 deepseek 大写报错问题），还带有一键测试连通性按钮。

## 📝 技术栈

- **后端**：`Node.js`, `Express`, `node-cron`, `jsonwebtoken`, `node-fetch`
- **存储**：轻量级本地文件存储结构（`data/*.json` 自动处理）
- **前端**：原生 HTML5 + 纯 CSS3 (无框架束缚，支持超高加载响应响应速度与暗色炫酷 UI)
