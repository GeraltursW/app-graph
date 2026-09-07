# 20260907 项目迭代总结与交接

## 本次范围

本文记录本轮工作截至 2026-09-07 的实际改动，用于复盘、交接和后续 Agent 续做。早期历史对话中的技术栈和方案不能代替当前源码。

- 前端：D:\codes\app-graph，Vue 3 + Ant Design Vue + AntV G6。
- 后端：D:\codes\app-graph-backend，Java 21 + Spring Boot + PostgreSQL。
- 前端验收地址：http://127.0.0.1:5177/，当前为 Mock。
- Git：本轮前后端代码、测试及文档统一提交；具体提交号和远程同步状态以仓库 Git 历史及本次交付记录为准。
- 本次只使用独立测试库 127.0.0.1:55438/appgraph_verification 验证数据库逻辑；没有迁移用户正式 5432 数据库。临时后端与测试 PostgreSQL 已停止，前端演示服务保留。

## 1. 首屏与图谱交互

| 改动 | 当前行为 | 目的 |
| --- | --- | --- |
| 首屏工具栏分组 | 左侧：工作模式、APP 查询、布局与图谱操作；右侧：项目基线、人工采集导入、批量并入、建设日报 | 减少拥堵，分清图谱操作和项目管理 |
| 工具栏换行 | 左侧控件组可分行，右侧成组右对齐；小宽度设置独立布局规则 | 不让关键入口藏在工具栏横向滚动尾部 |
| 日报去重入口 | 删除建设日报内的项目基线按钮，保留首屏唯一入口 | 避免同一功能多处重复 |
| 节点编辑 | 右侧开启编辑后打开独立 Modal，编辑字段、动作、图片 | 避免右栏查看状态与编辑表单混杂 |
| 删除确认 | 右侧删除与画布菜单删除统一二次确认 | 防止误删 |
| 画布右键菜单 | 预览、编辑、添加截图、创建游离页、删除；菜单限制在可视区 | 缩短常用操作路径 |
| 游离页画布投影 | 中间画布只展示主图谱，游离区域留在左侧和治理工作台 | 避免游离截图打断主图结构 |

右键不会再触发截图左键预览。主图投影不删除源数据；区域接入之后重新进入画布。共享节点仍只渲染一份，独立入口边保留。

注意：当前独立 Demo 的全局最小宽度为 1180px，桌面验收通过，不宣称已经完成手机端三栏体验。历史 CSS 有重复覆盖，新开发应以当前有效规则为准，不把旧规则原样堆叠复制。

## 2. 项目级 URL 基线

基线从日报附属配置提升为项目级功能，维护当前清单，没有版本选择和发布流程。

- Excel 只需 APP名称、URL 两列，允许一个文件包含多个 APP。
- 首次导入建立清单，后续 Excel 或手动输入只追加。
- 按去除首尾空白后的 APP名称 + 完整 URL 精确去重，不擅自移除参数、忽略大小写或合并 APP 别名。
- 允许尚未建图的 APP 加入基线，显示待覆盖，不创建虚假图谱。
- 预览有效条数、文件内重复和错误行，确认后再入库。
- 前端 Web Worker 解析 XLSX；后端再次校验 JSON、事务写入并提供幂等重试。
- APP 分组、说明、高频标记在项目基线维护。
- APP 列表与分页 URL 清单可搜索和刷新。

覆盖率改为：基线中当前已覆盖的 URL 数量 / 基线 URL 总量。不能用图谱全部 URL 数量除以基线总量后封顶替代交集统计。

新日报读取当前基线并保存快照；追加 URL 不反写历史报告。旧数字基线无法恢复具体 URL，部署后需重新导入真实两列表格。

## 3. 高频 URL 批量维护

项目基线增加“批量设置高频 URL”：

1. 选择一个已有基线 APP。
2. 粘贴 URL，每行一条，空行忽略。
3. 合并重复 URL，批量标记当前 APP 中已存在的匹配项。
4. 显示新增高频、原已高频、重复、未匹配数量及未匹配 URL 清单。

每批最多 5000 条非空输入。没有命中的 URL 不自动创建，不清空用户未输入的既有高频标记，不跨 APP 更新。APP 清单增加高频 URL 数量。

接口：POST /appGraph/baseline/priorityBatch，请求 appName、pageUrls[]。后台锁定匹配行后更新，重复执行不会重复产生标记。

## 4. 人工采集包导入

新增独立工作台，承接人工点击 APP、HDC 读取 URL、保存页面和控件截图的流程。

### 输入与分析

- 每包一个已存在的 APP；ZIP 根目录 records.xlsx，图片用 PNG/JPEG 相对路径引用。
- 必填 APP名称、目标URL、页面截图；父节点可空。
- 可记录父页面URL、父截图、控件截图、控件说明、操作类型、采集时间、备注。
- 记录ID + 前一步记录ID保留同包连续路径，不依赖 Excel 排列顺序。
- 上传后异步任务 QUEUED → ANALYZING → READY，记录进度；整包错误 FAILED，行错误单独显示。
- 分析阶段只暂存证据，不修改图谱或覆盖事实。
- 同 URL 只召回目标页面候选，不据此自动合并功能页。

### 人工确认

核对 Modal 展示目标、父页面和控件截图，可查看已有候选页截图、补齐标题/描述/embeddingText、选择已有页或新建页、选择父节点或同包前序记录、修改控件与操作。

确认支持：
- 有已接入父节点：保存接入关系。
- 只有区域内部关系：先保留 B → C → D，等待后续入口证据。
- 没有前序：仅保存为游离页面。
- 部分异常：只选择有效记录提交。

二次确认后后台同一事务保存页面实例、图片关联、边、覆盖事实与审计。禁止自环、任何新回路和跨 APP 关系。返回逐条可达状态，前端回查并显示“已接入主图谱”或“已入库·待接入”。

### 与批量并入的边界

人工采集导入负责新增证据、页面和已知关系；批量并入负责为已有游离区域补入口边。知道父节点时导入即可接入，不需要再执行一次批量并入。后续找到入口才使用批量并入。

### 识图能力边界

已提供可配置的 CAPTURE_AI_URL / CAPTURE_AI_KEY 适配器及前端开关，发送图片证据，读取 pageTitle、pageText、embeddingText、widgetDescription 建议。模型输出不直接作为父边证据。

没有配置真实模型服务时走人工归类，明确不假装 AI 已完成。当前未接入真实视觉模型、通用截图结构相似度/pgvector 召回或 HDC 在线验证。接口协议已用本地 HTTP stub 验证。

## 5. 持续保持的业务规则

- 主图允许多父节点，但任何新增边都不能形成环。
- URL 覆盖与结构接入是不同维度：有归类截图的游离 URL 可以已覆盖，但没有可执行接入路径。
- embedding_text 是实际归类字段；前端统一使用 embeddingText，在数据边界兼容旧字段。
- 不将 pageText 自动复制成 embeddingText 以增加覆盖。
- 同 APP 同 URL 换图、重复采集、补边，不重置 firstCoverageTime。
- 表格采集时间只保留证据，不当作数据库首次覆盖时间。
- 项目基线无业务版本；graphVersion 只用于结构操作的并发校验。

## 6. 代码导航

### 前端新增

- src/views/app-graph/components/ProjectBaselinePanel.vue
- src/views/app-graph/components/CaptureImportPanel.vue
- src/views/app-graph/capture.api.ts
- src/views/app-graph/data/projectBaseline.js、baselineExcel.worker.js
- src/views/app-graph/data/capturePackage.js、capturePackage.worker.js、captureDemo.ts
- src/mock/projectBaseline.ts、captureImports.ts
- tests/project-baseline.test.js、capture-package.test.js

主要修改：index.vue、style.css、GovernanceWorkspace.vue、CoverageTrend.vue、GraphCanvas.vue、InspectorPanel.vue、TreeNav.vue、graph/AppPageNode.js、data/graph.js，以及相应 Mock。

ExcelJS 和 JSZip 为导入提供解析能力，重型解析放到 Worker 或按需加载。

### 后端新增

- report/ProjectBaselineController.java、ProjectBaselineService.java
- importer/CaptureImportController.java、CaptureImportService.java
- importer/CaptureImportWorker.java、CapturePackage.java、CaptureVision.java
- V7__project_url_baseline.sql
- V8__manual_capture_import.sql
- CapturePackageTests、CaptureImportIntegrationTests、CaptureVisionTests

主要修改：日报服务/控制器、数据库集成测试、pom.xml、.gitignore。实际文件位于 src/main/java/com/geraltursw/appgraph 及 src/main/resources/db/migration。

V7：项目级 APP / URL / 导入审计表。V8：采集任务 / 记录 / 确认批次表。Java Excel 解析使用 Apache POI 5.5.1。

## 7. 验证结果

- 前端 vue-tsc --noEmit 通过。
- 前端生产构建通过，12 项 Node 测试通过。
- 后端 Maven package 通过，22 项测试通过、无失败，包括 PostgreSQL 集成与识图协议测试。
- 浏览器验证基线补充、高频批量标记、示例 ZIP 解析、证据图片、核对、确认入库和可达状态。
- 真实 HTTP 验证 ZIP 上传、后台队列处理、任务查询、确认入库、重复确认、截图返回200。
- 最新首屏右侧按钮组和日报去重入口已浏览器检查。
- 基线 XLSX 有真实二进制解析测试；尚未通过浏览器文件选择器完整验收一份真实用户 Excel。
- 构建仍提示主 bundle 较大，不能将“构建通过”描述为“所有性能问题已解决”。

## 8. 尚需落地

1. 使用用户实际采集 Excel / ZIP，在真实后端做一轮业务验收，确认名称、URL 和证据习惯。
2. 配置真实识图适配服务，测量模型质量和调用成本，不用模拟置信度代替模型验证。
3. 增加视觉结构/向量候选召回和 HDC 前序路径验证。
4. 正式库备份、迁移、接入和恢复演练。
5. 补充鉴权、上传配额、恶意文件扫描、存储生命周期与审计身份。
6. 多实例后台共享 storageRoot；增加任务取消、重分析、完整历史分页与告警。
7. 继续处理主包体积、桌面窄屏体验；移动端需另行定义交互布局。

Mock 数据在内存，刷新会重置，不模拟数据库并发与持久化。Mock 对已接入页面新增第二父入口会提示使用真实后端。核对草稿刷新会重置，只有确认后的记录及原始采集证据在真实后端持久化。

## 9. 交接文档

- [前端复刻与续开发提示词](frontend-agent-reproduction-prompt.md)
- [项目 URL 基线与批量高频方案](20260907-project-url-baseline.md)
- [人工采集包导入与接口说明](20260907-manual-capture-import.md)
- [图谱治理与日报原实施记录](20260907-governance-implementation.md)：其中旧基线版本描述以当前项目基线方案为准。

给其他 Agent 时：先发送前端提示词；若允许读取仓库，附上当前源码和上述接口文档。仅靠文字可约束布局和风格，但不能保证像素级复刻，严格视觉验收还应提供同尺寸的当前页面截图。
