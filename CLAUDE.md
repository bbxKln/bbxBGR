# 开桌 bbxBGR — 项目说明

桌游场次纪录应用：创建群组、记录每一局的参与与胜负、评论与胜率分析。带 REST API（`/api/v1`），支持移动端，已上线。

- 线上站点：https://bbxbgr-web.boxerwang715.workers.dev
- 历史文档（需求演进 / 问卷 / 里程碑）：`claude_memory/`、`里程碑.md`

## 功能总览

### 用户与认证
- 注册：用户名 + 密码（邮箱选填）；登录签发 session token（httpOnly Cookie，30 天），token 哈希存 D1
- 右上角用户菜单：查看用户 ID（可复制）、修改密码（独立页面 `/change-password`）、退出登录
- 深浅色可切换（默认跟随系统，选择持久化）

### 大厅与群组
- 大厅展示已加入的群组卡片 + 创建（「+」卡片）+ 按 8 位群组 ID 加入
- 群组 ID：随机 8 位数字（首位非 0，唯一约束）；仅 admin 可见（玩家页「群组信息」+ 一键复制）
- 加入群组自动创建玩家档案（昵称默认 = 用户名）

### 群组内（场次 / 桌游 / 玩家 / 分析 四个页签）
- **场次**：桌游、游玩时间（默认今天）、参与玩家（多选）、获胜玩家（多选）、MVP（选填单选）；创建者或管理员可编辑/删除
- **评论**：每位参与者每场次一条（需玩家档案关联账号）；自己的可编辑/删除；admin/协管可删任意
- **桌游**：名称、标签（手动输入回车添加，或点选「已有标签」）、描述（选填）；软删除（历史场次保留桌游名）
- **玩家**：姓名（群组内昵称，**不影响**账号用户名）、关联用户账号（关联后对方自动入群）；admin 分配/取消协管、移除成员、解散群组
- **分析**：筛选（时间范围预置+自定义 / 桌游 / 标签 / 玩家多选）+ 汇总表（胜率降序）+ 按月胜率趋势折线图；桌游页可展开「各玩家胜率」、玩家页可展开「各桌游胜率」（横条，胜率降序）

### 运营后台（`/admin`，隐藏）
- 独立运营账号（`users.role='operator'`，由 seed 脚本创建）
- 指标：总用户数 / 总群组数 / 总场次数 + 最近 50 条场次纪录（场次维度）
- 普通用户访问显示 404

## 核心业务规则
- 胜率 = 胜场 ÷ 参与场次；**每位获胜者各计 1 胜**（支持多人获胜）
- 权限：admin 全部（含查看群组 ID、分配协管、移除成员、解散）；admin_user 除这四项外同 admin；普通成员可记场次、写自己的评论。越权返回 403 / 未登录 401 / 非成员 403
- 场次校验：获胜玩家、MVP 必须属于参与玩家
- 删除：桌游/玩家软删除；删除已关联账号的玩家 = 移除成员（仅 admin）
- 用户名规则 2–20 位（中文/字母/数字/下划线）；密码 ≥6 位；标签 ≤15 字/个、≤8 个

## 技术架构
- **前端 `frontend/`**：React 19 + Vite + TypeScript + Tailwind v4，SPA，移动优先
  - 数据层：`src/lib/api/http.ts` 实现 `client.ts` 定义的 `Api` 接口（业务边界），相对路径 `/api/v1`
  - 部署为 Workers 静态资产项目 `bbxbgr-web`：`worker.ts` 先处理 `/api/*`（**service binding** 转发到后端），其余走 `ASSETS`（SPA 回退）
- **后端 `backend/`**：Cloudflare Workers + Hono + D1
  - 表：users / auth_sessions / groups / memberships / players / games / sessions / comments（`migrations/0001_init.sql`）
  - 认证：PBKDF2-SHA256 密码哈希；session token 只存哈希
  - 权限中间件：`src/lib/access.ts`（requireUser / requireMembership / requireManager / requireAdmin）
  - 错误统一 `{ error: { code, message } }`，错误码稳定（UNAUTHORIZED / NOT_MEMBER / FORBIDDEN / …）
- **数据库**：D1 `bbxbgr-db`（线上 database_id `bbec47dd-da76-4e53-a632-37ba9082e63d`）
- ⚠️ Worker 内**不能** fetch `*.workers.dev` 子请求（会得到占位 404），必须用 service binding

## 本地开发
- 后端：`cd backend && npm run db:apply`（首次或迁移变更）`&& npm run dev`（**端口 8788**；8787 被其他项目占用）
- 前端：`cd frontend && npm run dev`（5173，`/api` 代理到 8788）
- 单测：前端 `npm test`；后端 `npm test`（cloudflare vitest 插件，隔离存储自动应用迁移）
- E2E：前端 `npm run test:e2e`（自动拉起两个 dev server；本地 D1 需已应用迁移并存在运营账号 `运营/operator123456`）
- 运营账号：`cd backend && npm run seed:operator -- <用户名> <密码> [--remote]`

## 部署（规则：先本地搭好测好，最后一步才上 Cloudflare）
- 后端：`cd backend && npx wrangler deploy`
- 前端：`cd frontend && npm run build && npx wrangler deploy`
- 迁移：`cd backend && npx wrangler d1 migrations apply bbxbgr-db --remote`
- CI：`.github/workflows/ci.yml`（前端 tsc+单测+构建；后端 tsc+集成测试）
- ⚠️ npm 在存在 node_modules 时可能漏记 beta 版 optional peer（@emnapi 系列）导致 CI `npm ci` 失败——lock 需在**无 node_modules** 时重新生成

## 测试体系
- 前端：Vitest 单测（组件 / 校验 / 聚合逻辑）+ Playwright E2E（`e2e/`，8 条全流程：注册登录 / 群组权限 / 分析 / 用户菜单 / 后台）
- 后端：Vitest 集成测试（真实 SELF.fetch，18 条，含逐角色×逐接口权限矩阵）
- E2E 注意：SPA 异步导航要先等目标页标题再交互；同名按钮用 `.first()` 或限定容器；弹窗提交后等 `dialog` 隐藏再断言

## 视觉规范
- 现代简约冷色系：浅色 bg `#F6F7F9` / surface `#FFF` / 主色 `#2E5FCC` / 胜利 `#15965A`；深色 bg `#10151C` / surface `#171E28` / 主色 `#5B8DEF`
- 图表色板经 CVD 验证（`index.css` 的 `--viz-series-1..8`，浅/深两套）；折线 ≤4 条末端直标，>4 条图例；表格视图兜底
- 字体：Inter（拉丁/数字，tabular-nums）+ 系统中文；弹窗统一由 `components/ui.tsx` 的 Modal 处理（标题固定、内容滚动）
