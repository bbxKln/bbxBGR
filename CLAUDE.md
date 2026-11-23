一个带 REST API 的桌游场次纪录应用，支持登录，支持移动端查看。
（原始需求文档保存在 claude_memory/CLAUDE_v1.md 与 CLAUDE_v2.md）

# 功能需求（已确认）
## 用户与认证
- 注册：用户名 + 密码（邮箱选填，为将来找回密码留余地）；登录后签发 session token 存 D1，httpOnly Cookie 携带
- 每个用户有唯一用户 id

## 大厅与群组
- 登录后大厅显示已加入的群组卡片，空白时显示默认「+」号卡片
- 创建群组者为 admin；群组生成 8 位数字 id（随机、唯一，仅 admin 可见）
- 其他用户通过 8 位群组 id 加入群组（即「添加好友到群组」的邀请机制，无独立好友系统）
- 加入群组时自动创建玩家档案（姓名默认=用户名）
- admin 可移除成员、解散群组

## 群组内功能
### 桌游
- 名称（必填）、标签（多选，群组内共享标签池）、描述（选填）
### 玩家
- 姓名（必填）、用户id（选填）；仅 admin/admin_user 可修改用户id
- 添加用户id后，该用户登录默认看到此群组
- 群组内的玩家姓名是该用户在本群组内的昵称：修改昵称只影响本群组内的展示（场次、评论等），**不影响**用户账号的用户名
### 场次
- 桌游、游玩时间（默认今天）、参与玩家（多选）、获胜玩家（多选）、MVP（选填，单选参与玩家）、评论
- 每位参与者每场次最多 1 条评论，需玩家档案关联账号；自己的评论可编辑；admin 可删任意评论
### 分析
- 时间维度：时间范围（预置+自定义）+ 按月胜率趋势折线 + 总胜率汇总；玩家维度：玩家×桌游胜率表 + 单人柱状图
- 筛选：桌游多选、标签多选、玩家多选
- 胜率算法：每位获胜者计 1 胜；胜率 = 胜场 ÷ 参与场次

## 权限模型
- admin：全部权限（分配 admin_user、查看群组 id、移除成员、解散群组、删任意评论）
- admin_user：除「分配 admin_user、查看群组 id、移除成员、解散群组」外，同 admin
- 普通成员：新增场次、编辑/删除自己创建的场次、留自己的评论；不能管理桌游/玩家

## 运营后台（隐藏，仅运营者可见）
- 独立运营账号（用户表 role=operator），`/admin` 独立登录页；普通用户访问 `/admin` 显示 404
- 指标：总用户数、总群组数、总场次数、群组列表（场次数/成员数/最近活跃时间）

# 技术方案（已确认）
- 前端：React 19 + Vite + TypeScript + Tailwind CSS；UI 全中文；移动优先响应式（后期可选 PWA）
- 后端（M4 已实现）：Cloudflare Workers + Hono + D1，`backend/` 目录；API 统一 `/api/v1/*` 前缀；认证为 PBKDF2 密码哈希 + session token（httpOnly Cookie）
- 前端数据层：`src/lib/api/http.ts` 直连 `/api/v1`；本地开发经 Vite 代理转发到 wrangler dev（**端口 8788**，8787 被用户其他项目占用）
- 本地开发：后端 `cd backend && npm run db:apply && npm run dev`；测试 `npm test`（vitest 集成测试，miniflare 隔离存储）
- 运营后台：`/admin` 路由 + 独立运营账号（role=operator）；初始化账号 `cd backend && npm run seed:operator -- <用户名> <密码>`；普通用户访问显示 404
- 部署（M5 已上线）：前端 Workers 静态资产 bbxbgr-web（worker.ts 用 service binding 转发 /api 到 bbxbgr-api，run_worker_first）；后端 Worker bbxbgr-api + 远程 D1 bbxbgr-db（id: bbec47dd-da76-4e53-a632-37ba9082e63d）；站点 https://bbxbgr-web.boxerwang715.workers.dev
- 部署命令：`cd backend && npx wrangler deploy`；`cd frontend && npm run build && npx wrangler deploy`；迁移 `npx wrangler d1 migrations apply bbxbgr-db --remote`；运营账号 `npm run seed:operator -- <用户名> <密码> --remote`
- 注意：Worker 内部不能 fetch *.workers.dev 子请求（会得到占位 404），必须用 service binding
- CI：GitHub Actions（.github/workflows/ci.yml）— 前端 tsc+单测+构建、后端 tsc+集成测试；E2E 仅本地跑（需 wrangler dev + 浏览器）
- 视觉：现代简约风（冷色、克制、商务感）+ 深浅色可手动切换（默认跟随系统，选择持久化）
- 删除策略：软删除，历史场次保留引用并显示原名称
- 测试：前端 Vitest 单测 + Playwright E2E（双 webServer：5173 + 8788）；后端 Vitest 集成测试（cloudflare vitest 插件，含权限矩阵）；里程碑结束测试全绿才汇报
- GitHub：公开仓库

# 设计步骤
- 原始 CLAUDE.md 内容保存在 claude_memory/ 内
- 里程碑定义见「里程碑.md」：每个里程碑结束向用户汇报 + 提供测试链接，只有用户同意后才进入下一个
- 里程碑先前端（M1–M3，mock 数据），再后端（M4 联调），最后测试补全与部署（M5）
- 先在本地环境搭建并测试通过，Cloudflare 部署是最后一步，不在开发中期上线
- 开发过程中要有测试用例
- 使用 grill-me 时如需用户确认，问题罗列在 claude_memory/问卷-待确认问题.md
