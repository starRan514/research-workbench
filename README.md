# 科研工作台 · My AI Research Team

一个自托管的 AI 科研助手工作台：**Cloudflare Worker + D1 + 用户系统**，部署在您自己的 Cloudflare 账号上，数据完全属于您。

**无需写代码** —— 按下面的傻瓜式 Prompt 一步步复制给 AI 编程助手（Trae / Claude Code 等），10 分钟内即可拥有自己的实例。

线上示例：https://workbench.wangxr2024.workers.dev

## 它是什么

- **多用户系统**：注册 / 登录 / 改密码（PBKDF2 哈希 + HttpOnly Session Cookie），数据按用户隔离
- **AI 配置管理**：在界面里配置多个 AI 服务商（base_url / model / api_key），密钥只存您自己的 D1 数据库
- **纯边缘部署**：一个 Worker 搞定前后端，无服务器运维，全球 CDN 加速

技术栈：Cloudflare Workers（后端 API）+ Assets（前端）+ D1（SQLite 数据库），无任何框架依赖。

## 傻瓜式部署：逐步复制 Prompt 给 AI

### 第 0 步：准备（只需做一次）

1. 注册 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费，无需绑卡）
2. 安装 [Node.js](https://nodejs.org/)
3. 把本仓库下载/克隆到本地，例如 `D:\research-workbench`
4. 打开你的 AI 编程助手，**工作区打开这个目录**，新建会话，开始逐条粘贴下面的 Prompt

### Prompt ①（登录 Cloudflare）

```text
请帮我检查 wrangler 登录状态：运行 npx wrangler whoami。如果未登录，引导我完成 npx wrangler login（会弹出浏览器授权页）。全程在 PowerShell 中执行。
```

### Prompt ②（创建数据库）

```text
请在我的 Cloudflare 账号上创建一个名为 workbench-db 的 D1 数据库，然后把返回的 database_id 写进本项目的 wrangler.toml（替换掉占位符 YOUR_DATABASE_ID）。
```

### Prompt ③（初始化数据表）

```text
请用本项目根目录的 schema.sql 初始化远程 D1 数据库 workbench-db（注意 --file 参数必须用绝对路径）。初始化后运行查询确认 users 和 sessions 表已创建。
```

### Prompt ④（部署上线）

```text
请把本项目部署为 Cloudflare Worker（在项目目录内执行 npx wrangler deploy）。部署成功后，按以下规范验证：
1. 直连抓取线上地址（workers.dev 域名走代理、看你的网络环境），加随机缓存参数
2. 确认首页 Content-Type 为 text/html 且包含「科研工作台」标题
3. 确认 /api/me 接口有响应（未登录时返回 401 属正常）
最后把线上地址告诉我。
```

### Prompt ⑤（注册使用）

```text
部署已完成。请告诉我：1）线上地址；2）指导我在页面上注册第一个账号并登录；3）提醒我首次配置 AI 服务商时 api_key 只会保存在我自己的 D1 数据库里。
```

完成！访问 `https://workbench.<你的子域>.workers.dev` 即可使用。

## 日常更新

改了代码或页面后，新会话里一句：

```text
请重新部署本项目到 Cloudflare Worker，并验证线上版本已更新（比对首页新内容标志 + 大小）。
```

## 常见问题

**Q: 数据存在哪里？** 全部在您自己账号的 D1 数据库里，Cloudflare 不读取，我们也没有任何服务端。

**Q: 忘记密码怎么办？** 让 AI 执行：`npx wrangler d1 execute workbench-db --remote --command "DELETE FROM users WHERE username='你的用户名'"`，然后重新注册。

**Q: 想要更省心的部署体验？** 配合 [cloudflare-publish-skill](https://github.com/starRan514/cloudflare-publish-skill) 技能使用，AI 会自动完成部署后的真伪验证（假 200 / 代理污染 / 假 DIFF 识别）。

**Q: 自定义域名？** 在 Cloudflare 控制台 Workers & Pages → 你的 Worker → Settings → Domains & Routes 添加即可。

## 目录结构

```
research-workbench/
├── wrangler.toml      # Worker 配置（D1 绑定）
├── schema.sql         # 数据库建表脚本
├── src/worker.js      # 后端 API（用户系统 + AI 配置管理）
└── public/index.html  # 前端单页
```

## License

MIT
