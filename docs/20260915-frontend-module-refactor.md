# 2026-09-15 前端业务模块整理

## 1. 目标与范围

将前端从按文件类型堆放的 components/data 和聚合 API，整理成按业务划分的模块。
本次工作目录为 D:\codes\app-graph，后端仓库与数据库未修改。

保持现有路由、三栏布局、按钮入口、节点数据结构和后端接口契约。
不增加新框架、不升级依赖、不重新设计页面。

## 2. 当前目录

```text
src/
  App.vue
  global.css
  components/Icon/Icon.vue
  utils/http/axios/index.ts
  views/app-graph/
    index.vue
    workspace.config.ts
    style.css
    baseline/
      ProjectBaselinePanel.vue
      baseline.api.ts
      baseline.data.js
      baseline.mock.ts
      baselineExcel.worker.js
    capture-import/
      CaptureImportPanel.vue
      capture.api.ts
      capture.mock.ts
      capturePackage.js
      capturePackage.worker.js
      captureDemo.ts
    graph/
      GraphCanvas.vue
      TreeNav.vue
      TreeItem.vue
      InspectorPanel.vue
      graph.api.ts
      graph.data.js
      graph.config.ts
      graph.mock.ts
      nodes/AppPageNode.js
    function-tree/
      OfficialFunctionTree.vue
      FunctionReviewPanel.vue
      FunctionTreeImportDialog.vue
      functionTree.api.ts
      functionTree.data.ts
      functionTree.mock.ts
    orphans/
      OrphanMergePanel.vue
      orphan.api.ts
    coverage-report/
      CoverageReportPanel.vue
      CoverageTrend.vue
      coverageReport.api.ts
      coverageReport.mock.ts
    test-case/
      TestCaseNav.vue
      TestCasePanel.vue
      ScenarioCaseBuilder.vue
      testCase.data.js
      testCase.mock.ts
    test-report/
      TestReportDashboard.vue
      TestReportNav.vue
      TestReportEvidence.vue
      PerformanceTrendChart.vue
      testReport.api.ts
      testReport.mock.js
    governance/GovernanceWorkspace.vue
    promo/PromoJourney.vue
    shared/
      api.config.ts
      image.api.ts
      images.js
      GraphButton.vue
      SmartImage.vue
      ui.ts
```

## 3. 模块职责

| 模块 | 修改相关需求时从这里开始 |
| --- | --- |
| baseline | APP/URL 基线查询、Excel 导入、追加 URL、高频设置、应用设置 |
| capture-import | 人工采集 ZIP 上传、任务轮询、核对、入库、示例包、解析 Worker |
| graph | 主树、G6 画布、节点详情与编辑、图谱标准化、节点查询/移动/删除/保存 |
| function-tree | 厂商功能树展示、JSON 导入、匹配、绑定查询与复核、离线目录 |
| orphans | 游离节点创建与 AI 探索、单节点归并、区域批量归并、撤销、入口归类 |
| coverage-report | 建设日报生成、历史报告、覆盖率趋势、URL 明细、HTML 导出 |
| test-case | 全量路径与过程用例、终点动作配置、前端模拟执行数据 |
| test-report | 风险测试报告、执行证据、周期趋势、已有报告查询 API |
| governance | 两个管理按钮、抽屉、日报/游离区域切换和定位事件转发 |
| promo | 项目旅程 GSAP 动画 |
| shared | 请求配置、图片地址、占位图、通用按钮和 UI 封装 |

test-case 当前没有独立真实请求，不创建空的 API 文件，也不虚构后端用例接口。
新增真实用例请求时，应在 test-case/testCase.api.ts 中实现。

## 4. 基线示例

基线需求只需要首先查看 baseline 文件夹：

- ProjectBaselinePanel.vue：界面、用户输入与加载状态。
- baseline.api.ts：查询/写入接口、Mock 与真实请求选择。
- baseline.data.js：URL 校验、去重、Excel 工作表解析。
- baselineExcel.worker.js：后台线程解析入口。
- baseline.mock.ts：演示基线存储与查询行为。

组件调用 queryBaselineOverview、queryBaselineUrls、requestAppendBaseline、
requestSaveBaselineSettings、requestSetBaselinePriority、requestSetBaselinePriorityBatch。
组件中不再包含 /baseline 路径拼接或通用请求分发。

## 5. API 拆分与兼容性

旧文件与新位置：

| 旧入口 | 新位置 |
| --- | --- |
| info.api.ts 的图谱/节点请求 | graph/graph.api.ts |
| info.api.ts 的 Function Tree 请求 | function-tree/functionTree.api.ts |
| info.api.ts 的测试报告请求 | test-report/testReport.api.ts |
| info.api.ts 的游离节点/AI 请求 | orphans/orphan.api.ts |
| info.api.ts 的图片地址生成 | shared/image.api.ts |
| governance.api.ts 的 baseline 分支 | baseline/baseline.api.ts |
| governance.api.ts 的 orphans 分支 | orphans/orphan.api.ts |
| governance.api.ts 的日报分支 | coverage-report/coverageReport.api.ts |
| capture.api.ts | capture-import/capture.api.ts |
| info.data.ts 的工作模式 | workspace.config.ts |
| info.data.ts 的图谱布局 | graph/graph.config.ts |
| info.data.ts 的示例目录 | function-tree/functionTree.mock.ts、test-case/testCase.mock.ts |

旧聚合文件已删除，所有源码引用、测试引用和 Worker 路径均迁移到新位置。
不保留隐式转发文件，避免后续又向旧 API 文件添加业务。

共享配置统一在 shared/api.config.ts：

- API_BASE_URL 保持环境变量优先，默认 /appGraph。
- USE_MOCK 保持原有环境变量语义。
- rawRequestOptions 与 requestOptions 保留既有请求选项。
- toMockPayload 保留 JSON 序列化边界，避免响应式对象污染 Mock 存储。
- requestError 提供通用错误信息提取。

接口路径、字段名称、请求方法保持不变。
updateNode 继续以 FormData 提交完整 action、keepImages、新图片及编辑信息。
图片仍通过 /appGraph/s3file/image?fileName=... 获取，data/blob 地址不重复包装。
Function Tree 匹配阈值与人工确认规则保持不变。

## 6. 状态与依赖边界

index.vue 仍然承担当前 APP、选中节点、主图谱、三栏宽度、跨模块高亮和定位的编排。
本次不强行引入全局状态库，也不声称已经把入口文件的所有流程迁移成 composable。

原 GovernanceWorkspace 中的日报和游离区域已拆成两个面板：

- CoverageReportPanel 自己维护日报、筛选、明细、生成和错误状态。
- OrphanMergePanel 自己维护父节点选择、批次、入口归类和错误状态。
- GovernanceWorkspace 不再发出业务请求。
- 打开或切换区域时，只刷新当前业务面板；不会因为日报加载失败而阻止游离列表加载。
- 两个面板保留各自状态，定位通过事件转发回 index.vue。
- 面板显隐由外层真实 DOM 容器控制，避免 Vue 多根组件上的 v-show 失效。

Mock 数据也与模块放在一起，但不是互不相干的数据副本：

- graph/graph.mock.ts 是演示图谱唯一内存数据源。
- 游离归并与采集入库复用它的图谱写入逻辑。
- baseline.mock.ts 从同一图谱读取覆盖数据。
- coverageReport.mock.ts 读取同一份基线与图谱。
- 不为每个面板复制一套图谱，否则归并后各视图会互相不一致。

shared 只能依赖通用基础设施，不反向依赖业务模块。
模块之间的必要依赖显式 import，禁止重新引入以 URL 前缀判断业务的万能请求函数。

## 7. 样式策略

保留 style.css 的内容与加载顺序，不拆分混合选择器，避免覆盖优先级变化。
原有组件内的 scoped 样式随组件迁移；新拆出的日报/游离面板保留原样式。

后续若单独整理样式，应先建立视觉基准，再按模块逐段迁移。
本次目录重构不代表已完成 CSS 清理或首屏包体优化。

## 8. 验证

已执行：

- npx vue-tsc --noEmit。
- node --test tests/*.test.js，17 条测试通过。
- npm run build。
- API 契约测试：基础前缀、方法、参数、action/图片 FormData、S3 编码。
- Mock 联动测试：游离创建后图谱和工作台同步；基线追加与高频设置进入日报。
- 结构测试：静态导入、动态导入与 Worker 入口可解析；本地源码依赖无环；shared 不反向依赖业务模块。
- 浏览器：QQ 300 节点数据、主树/G6、基线抽屉、日报生成、区域切换、入口归类弹窗。
- 浏览器：人工采集示例 ZIP 解析为 3 条记录并显示目标截图与控件证据。
- 浏览器：用例编排与测试报告/ECharts 趋势切换。

边界：

- 真实 Java 后端未在本次启动，API 测试拦截 HTTP 请求以检查契约，不等于真实后端集成测试。
- Function Tree 保留现有“请求失败后离线目录回退”；当前无后端时仍显示请求失败提示。本次未将其改写成完整 Mock 服务。
- 基线 Excel 解析有测试和 Worker 构建验证，本次未在浏览器重新手动上传 Excel。
- 生产构建仍有既有大包警告；本次不通过修改警告阈值掩盖问题。
- 本次模块重构与同日游离节点并入方案一起交付；新增并入能力仍属于待实施设计，不混作已完成功能。

## 9. 后续维护规则

1. 新业务先建业务文件夹，组件/API/解析/配置/Mock 同目录维护。
2. 有真实接口才创建 API 文件；不要为满足目录形式添加无用封装。
3. 基础 URL 只在 shared 配置，不在每个模块重复定义。
4. 共享 UI 进入 shared；模块专用 UI 留在模块内。
5. 跨模块联动通过 props、事件与入口编排完成。
6. 不混淆建设日报与性能测试报告，分别维护在 coverage-report 与 test-report。
7. 移动文件时同步更新 Worker、动态 import、测试和交接文档。
8. 提交前运行类型检查、全部测试与构建；涉及交互时再做浏览器验证。
