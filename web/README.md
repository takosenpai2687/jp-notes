# tako-jp

天蓝色的日语学习空岛。Next.js App Router、TypeScript、Tailwind CSS、Motion，配合 Netlify Database（Postgres）。

应用代码、依赖、构建缓存和本地开发数据库均隔离在本目录。上层的 `quiz`、`notes/raw` 只读，不修改原文件；生产构建会把需要的 JSON、Markdown 和图片复制到本目录的 `.netlify-content`，随服务端函数部署，不包含原来的单文件 HTML。

## 开始使用

需要 **Node.js 24+**。在 PowerShell 中：

本地会自动启动官方 `@netlify/database-dev` 的持久化 Postgres 开发引擎并应用迁移，不需要 Docker、另装数据库或登录 Netlify。数据保存在 `data/postgres`。本地开发优先使用 IPv4 回环，避免部分 Windows/VPN 环境无法连接 IPv6 localhost。

```powershell
Set-Location C:\data\learn\jp-notes\web
npm install
npm run dev
```

访问 <http://localhost:3107>。开发和生产服务的默认端口均为 **3107，不使用 3000**。

```powershell
npm run build
npm run start
```

请在本目录运行。开发模式直接读取上一级资料，修改后可刷新；生产模式使用构建时打包的快照，资料变化后需重新构建。若刻意要在本地连接外部 Postgres，可参考 [.env.example](./.env.example) 设置 `.env.local`；不要让日常本地开发误连生产数据库。

终端不能使用系统代理时，可仅为当前 PowerShell 进程设置代理（按自己的客户端端口替换）：

```powershell
$env:HTTP_PROXY = 'http://127.0.0.1:3213'
$env:HTTPS_PROXY = $env:HTTP_PROXY
$env:npm_config_proxy = $env:HTTP_PROXY
$env:npm_config_https_proxy = $env:HTTP_PROXY
npm install
```

字体随 npm 依赖本地打包，运行与构建都不依赖 Google Fonts。浏览器不直接连接数据库；默认只请求本站，启用下方可选 Google Analytics 后会额外请求 Google 统计服务。

## 功能

- **语法试炼**：从上级 `quiz/<n5…n1>/*.json` 动态读取，不解析 HTML。支持即时解析、译文与提示，前后导航、空选跳过、点阵选题、键盘 1–4 与左右键、草稿续答、提交确认、成绩单和完整回看。
- **笔记森林**：从上级 `notes/raw/<n5…n1>/*.md` 读取。宽屏（1200px 起）采用紧凑的 220–260px 左侧列表、窄留白和更宽的右侧阅读区，两栏独立滚动；默认打开该等级第一篇，切换笔记使用 `?level=N5&note=…`，可分享、刷新和前进/后退。小屏保持列表 → 独立详情页；直接打开详情链接在宽屏也会展示双栏。GFM 表格、可展开目录、相邻课程、已读标记、关联测验与图片链接；保留原笔记的 `<br>`，其他 HTML 经过清理，不执行脚本。
- **N5–N1 航线**：每项功能都能切换难度。没有资料的等级显示真实空状态，不生成虚构课程。
- **真题远征、单词花园**：仅开放入口和 Coming soon，不提供虚构试卷或词库。
- **学习足迹**：全部挑战、日期、用时、正确率、留白题数、已读笔记、最近七天活动，以及 JSON 备份导出。测验列表同时显示上次作答时间和最佳成绩。
- **动效与无障碍**：Motion 弹簧交互、岛屿漂浮、答题反馈、完成庆祝；响应系统“减少动态效果”，提供键盘焦点、弹窗焦点管理与移动导航。
- 顶部面包屑中的主页链接在各页面均可返回首页；小屏可点击左上方 Logo 返回。

### 答题规则

与原测验模板一致，**第一次选择立即计分并显示解析，不能回头改答案**。上一题与点阵目录用于回看；跳过的题可以返回再答。提交时留白题按未答对计分，分母始终是全部题目，不会因跳过而提高正确率。

草稿按账号或游客、测验及内容版本隔离。完成后的回看不会重新生成草稿。题库更新后会提示重新开始，不会把旧答案套进新题。登录与退出会切换草稿空间，未完成的游客草稿不导入账号，但仍在原浏览器保留。

## 账号与存储

- 游客的已完成记录和已读标记保存在 `localStorage` 的 `tako-jp:guest:v1`；草稿使用独立键。清除浏览器数据会移除这些内容，请先导出备份。
- 本地用户名密码注册；用户名不区分大小写，密码最少 8 位，通过带随机盐的 scrypt 存储。没有外部 OAuth、邮箱验证或找回密码服务。
- 登录后自动分批合并游客已完成记录与已读标记，使用记录 UUID 去重，**保留游客本机副本**。题库版本已变或源资料已移除的历史游客记录会明确提示未能导入，仍留在本机。
- 线上账号数据保存在 Netlify Database，由官方 `@netlify/database` SDK 在服务端读取当前环境的连接配置；不在 Serverless 本地写数据库文件。会话令牌只保存哈希，Cookie 使用 HttpOnly、SameSite=Lax，有效期 30 天。生产环境启用 Secure，应通过 HTTPS 部署。
- 服务端重新计算提交分数，不接受客户端声称的成绩。写入接口检查同源；同一用户名同一账号操作 15 分钟最多尝试 10 次。
- SQL 查询全部参数化；用户重名、成绩去重、阅读时间取最新、限流计数均由数据库约束或原子语句保证。批量导入使用同一连接的事务，失败回滚。
- 表结构由 [netlify/database/migrations](./netlify/database/migrations/) 管理。Netlify 自动在发布前应用迁移，失败则阻止发布；不要修改或删除已应用的迁移，应新增迁移文件。
- 本地数据默认在 `data/postgres`，可通过 `TAKO_DEV_DB_DIR` 改位置。旧的 `JP_NOTES_DB_PATH` 不再使用。线上由 Netlify 注入 `NETLIFY_DB_URL`（以及所需的驱动配置），不要设为 `NEXT_PUBLIC_*`，也不要把生产连接串复制给 Deploy Previews。
- 本地备份应先停止服务再复制整个开发数据目录；线上请配置平台提供的备份/快照，并检查额度、恢复能力与监控。本目录的 `.gitignore` 已排除数据库、连接配置、依赖、缓存和测试输出。

R2 仍适合附件和加密备份，不用作在线账户事务数据库。应用暂不包含邮箱验证和找回密码，上线前请理解这个限制，并根据实际用户量补充防滥用与账号恢复机制。

## Netlify 网页端部署：怎么点

代码已配置 [netlify.toml](./netlify.toml)、生产资料打包、Next.js 文件追踪和数据库迁移；网页上的项目创建、GitHub 授权、数据库启用及计费确认仍由你操作。本次没有代建云资源、推送代码或发布站点。

### 1. 导入仓库

1. 先将当前改动提交并推送到 GitHub；`web`、`quiz` 和 `notes/raw` 必须都在仓库中。不要只上传 `web` 或拖放 `.next`。
2. 打开 <https://app.netlify.com/>，进入你的 Team。
3. 点击 **Add new project → Import an existing project → GitHub**。
4. 按提示授权，选择 **takosenpai2687/jp-notes**，选择要部署的分支。
5. 如果自动检测出多个项目，选 `web`；接着手动核对下面设置，特别是 **Base directory**，不能只设置 Package directory：

| 网页设置 | 填写值 |
| --- | --- |
| Project name | `tako-jp`，被占用时换一个 |
| Base directory | `web` |
| Package directory | 留空，和 Base directory 相同时无需另填 |
| Build command | `npm run build` |
| Publish directory | `.next`，相对于 `web` |
| Functions directory | 保持默认，不要覆盖 Next.js 自动生成的函数目录 |

6. 点击 **Deploy site / Deploy project**。Node 24 和打包规则由本目录的 `netlify.toml` 配置；项目已显式安装并启用现代 OpenNext adapter `@netlify/plugin-nextjs`（v5），不依赖平台自动识别。不要换成旧版 v4 runtime，也不要配置静态 SPA 的 `/* → /index.html` 重写。

若已建站，在 **Project configuration → Developer settings → Continuous deployment → Build settings** 修改上述设置。

#### 构建成功但首页出现 Netlify 默认 404

如果日志里 `next build` 成功后直接进入 `Deploy site`，没有 Next.js adapter 的构建阶段，不能说明 SSR 应用部署成功。本应用首页及学习页面都需要服务端函数，直接上传 `.next` 目录里的静态文件不能提供这些路由。

1. 确认部署提交包含 `netlify.toml` 中的 `[[plugins]] package = "@netlify/plugin-nextjs"`，以及 `package.json` / lockfile 中的对应开发依赖。本项目已显式配置。
2. 在 **Project configuration → Environment variables** 检查是否有 `NETLIFY_NEXT_PLUGIN_SKIP`；若有，移除这个跳过开关。不要设置 `NODE_ENV=production` 或 `NPM_FLAGS=--omit=dev` 等阻止安装构建用开发依赖的配置。
3. 保留上表的构建目录与 `.next` 发布目录，不要改成 `out`、仓库根目录，也不要手动拖放构建文件。
4. 推送修复后，打开 **Deploys → Trigger deploy → Clear cache and deploy site**（部分界面为 **Retry without cache**），确保旧部署缓存不会掩盖配置变化。
5. 新日志应出现 `@netlify/plugin-nextjs` / Next.js Runtime 的 adapter 阶段及 Functions 打包；部署摘要或 Functions 页面应包含 Next.js 服务端处理函数（通常名为 `___netlify-server-handler`）。仅看 `0 new function(s) to upload` 不能判定错误，因为未变化的函数可复用；应检查实际已发布函数和 adapter 阶段。
6. 部署标记 **Published** 后，先打开该次部署的唯一预览地址，再验证正式域名的首页、笔记和测验，以及刷新页面是否正常。若变成应用的 500 而不是平台 404，再根据 Functions 日志排查运行时错误，不要继续添加静态重写。

### 2. 启用数据库

1. 项目已安装官方 `@netlify/database`，Netlify 会检测并自动准备数据库。
2. 打开项目的 **Data & Storage → Database**，确认已启用；如果显示 **Enable / Create database**，点击并确认套餐/额度。该服务要求适用的 credit-based plan，费用以当前控制台为准，不承诺免费。
3. 若首次构建因数据库尚未启用失败，启用后去 **Deploys → Trigger deploy → Deploy project**（或重试失败部署）。
4. 检查部署日志中的 Database / migrations 阶段：本项目的 SQL 迁移应成功应用后才发布。**无需手动复制 SQL、无需把连接串写进代码、无需给浏览器配置数据库 URL。**
5. 让平台自动管理生产数据库和 Deploy Preview 分支。不要手动给所有部署环境设置同一条生产 `NETLIFY_DB_URL`；SDK 会使用各自环境注入的配置。

### 3. 验收与域名

1. 在 **Deploys** 中打开 Published 部署的预览地址，确认四座岛、测验题目、笔记正文/图片都能显示。
2. 注册测试账号，做一份测验并标记笔记已读；退出后重新登录，确认学习足迹仍在。
3. 再触发一次部署，重新登录确认记录还在，证明账户数据不依赖临时文件系统。
4. 若要绑定自己的域名，打开 **Domain management → Add domain / Add custom domain**，按提示配置 DNS，等待 HTTPS 证书生效。
5. 关闭 VPN，在电信/联通/移动网络分别测试。数据库由服务端连接，但这不能保证 Netlify 站点在国内一直稳定。若套餐允许调整 Functions Region，应尽量与数据库靠近，而不是只按浏览器所在地选择。

`netlify.toml` 特意让每次提交都构建，防止只改上级 `quiz` 或 `notes/raw` 时被 monorepo 的自动跳过规则漏掉。更新资料后推送仓库即可生成新快照；原始 HTML 不会部署到题库中。

官方参考：[导入项目](https://docs.netlify.com/manage/projects/add-new-project/#import-from-an-existing-repository)、[子目录设置](https://docs.netlify.com/build/configure-builds/monorepos/)、[Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/)。

## Google Analytics 4：网页端配置

已用 Next.js `next/script` 接入全站 GA4，页面开始交互后异步加载，不阻塞页面；同一页面会话内切换路由不会重复安装脚本。**不配置 `NEXT_PUBLIC_GA_ID` 就不会加载统计脚本，也不会向 Google 发送统计请求**。填写非 `G-` 格式的 ID 会明确报错，避免错误配置被静默忽略。

### 1. 在 Google Analytics 创建网站数据流

1. 打开 <https://analytics.google.com/> 并登录。首次使用点 **开始衡量 / Start measuring**；已有账号则进入左下角 **管理 / Admin → 创建 / Create → 媒体资源 / Property**。
2. 账号名称、媒体资源名称可填 `tako-jp`，报告时区按你的需求选择（例如中国时间），继续完成业务信息并接受相关条款。
3. 选择 **网站 / Web** 数据流，填写正式站点的 HTTPS 地址，数据流名称填 `tako-jp web`，点 **创建数据流 / Create stream**。已有媒体资源可从 **管理 → 数据收集和修改 → 数据流 → 添加数据流 → 网站** 进入。
4. 复制 **衡量 ID / Measurement ID**，格式是 `G-XXXXXXXXXX`。不是 `GTM-…`、纯数字媒体资源 ID，也不需要 API Secret。
5. 在该数据流的 **增强型衡量 / Enhanced measurement → 齿轮 → 网页浏览 / Page views → 显示高级设置**，保留 **根据浏览器历史记录事件更改网页 / Page changes based on browser history events**。这样 Next.js 的站内跳转、笔记查询参数切换和浏览器前进/后退也能统计；本应用不再手动重复发送 `page_view`。
6. 如果只需访问量，可关闭其他增强型衡量事件（尤其表单互动和站内搜索）。**不要再粘贴 Google 提供的整段脚本或同时通过 GTM 安装同一个 GA4**，否则可能重复统计。

### 2. 在 Netlify 填入 ID 并重新部署

1. 打开项目 **Project configuration → Environment variables → Add a variable / Add a single variable**。
2. Key 填 `NEXT_PUBLIC_GA_ID`，Value 填刚复制的 `G-…`。这是浏览器可见的公开标识，不是数据库凭据。
3. 如可选择作用域，至少包含 **Builds**；部署上下文只为 **Production** 填值，Deploy Previews 和 Branch deploys 留空，避免测试流量进入正式报表。
4. 保存后去 **Deploys → Trigger deploy → Deploy project**。`NEXT_PUBLIC_*` 在构建时写入客户端产物，后续修改 ID 或移除统计都需要重新构建部署，不能只修改变量而不发布。

本地默认不开启。若需要调试，在 `.env.local` 填同名变量并重启开发服务；建议使用独立的测试媒体资源，不要污染正式数据。

### 3. 验收与隐私

1. 打开正式网站（关闭广告拦截，必要时使用能访问 Google 的网络），依次访问首页、笔记和测验。
2. 回到 GA **报告 / Reports → 实时 / Realtime**，通常几分钟内可看到活动；常规报表处理可能需要 24–48 小时。
3. 若没有数据，在浏览器开发者工具 **Network** 中查看 `gtag/js?id=G-…` 是否成功加载，以及 `g/collect` 请求是否发出；检查是否用错 ID、忘记重新构建，或被浏览器/网络拦截。GA 不可用不影响测验、笔记和账号功能。国内网络可能拦截 Google，因此数据可能明显少于实际访问量。

应用不向 GA 主动发送用户名、密码、答题内容、成绩或账号 ID，且关闭 Google signals 与广告个性化信号。但 GA 本身仍会处理访问、设备信息及页面 URL，并可能设置 Cookie；不要把个人信息放进 URL。启用前应提供适用的隐私告知；本集成不含 Cookie 同意管理，如面向需要事先同意的地区，应先接入同意管理并控制标签加载，再开启统计。

官方参考：[GA4 初始设置](https://support.google.com/analytics/answer/9304153)、[Next.js 脚本加载](https://nextjs.org/docs/app/guides/scripts)、[单页应用网页浏览统计](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications)。

## 旧 SQLite 账号数据迁移（可选）

若旧版的 `data/tako.sqlite` 中已有注册账号，先备份该文件，再在云端数据库及表结构就绪后：

1. 在本机 `.env.local` 中临时设置目标数据库的 `NETLIFY_DB_URL`，连接串只从你自己的 Netlify 控制台取得，不要提交或发给别人。
2. 运行：

```powershell
npm run db:import:sqlite -- .\data\tako.sqlite
```

3. 脚本只读旧文件，事务性导入用户密码哈希、测验记录和已读标记；允许重复运行，不覆盖冲突账号。旧会话不导入，用户需重新登录。若账号内容冲突，整次导入回滚并明确报错。
4. 导入后移除本机的生产连接配置，避免之后的本地测试误写线上数据。迁移命令可能输出 Node 的 SQLite 实验性提示，不影响正常导入。

如果没有旧版注册账号，跳过本节。本地游客记录仍属于原浏览器和原域名；localhost、127.0.0.1 和线上域名不共享 localStorage。登录只会合并**当前域名**已有的游客记录，请先在原地址导出重要备份。

## 验证

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

数据库测试使用真实 Postgres SQL 引擎，覆盖并发注册/限流、事务回滚、成绩去重、阅读时间合并和旧 SQLite 数据导入；部署测试在没有上级资料目录的独立目录验证生产资料完整性。

要对已经构建好的生产版本运行同一套浏览器测试，在新的 PowerShell 中执行：

```powershell
$env:TAKO_E2E_PRODUCTION = '1'
npm run test:e2e
```

Netlify CLI 的离线构建当前无法完成自动建库阶段（没有平台 API），不能替代网页端的首次部署验收；不要为绕过离线检查而移除数据库 SDK 或迁移。

端到端测试使用已安装的 **Microsoft Edge**，单独启动 **3108** 端口和 `test-results/e2e-postgres` 开发数据库，不使用你的实际学习数据库或云端连接。覆盖跳题/返回/点阵/续答/留白计分、笔记已读、注册登录与游客合并、账号隔离、错误输入和 390/768/1199/1200/1440/1920 像素布局。

若没有 Edge，可先安装它，或在 [playwright.config.ts](./playwright.config.ts) 中将 `channel` 改为已安装的 Chrome。

## 设计

基于 `design-taste-frontend` 的 editorial-greeting 方向（seed `854249844`），采用真实内容和诚实统计。为满足本项目明确的游戏空岛风格，主动覆盖该技能默认的低饱和办公界面约束：使用天蓝渐变、大圆角岛屿、原创小章鱼字标，以及统一 Nunito 字体、较小蓝色大写 `JP` 的字标和表达性动效。所有装饰均为本地 CSS/SVG，不使用来源不明的外部图片。

视觉检查中保留 `gradient`、`heavy-shadow`、`icon-chips`、`app-title-size`：分别用于用户指定的渐变天空、浮空岛屿厚度、游戏式导航和首页大标题，不套用办公仪表盘的限制。界面文字最小为 11px，正文与日语题干使用更大的阅读字号。
