# App Graph 前端复刻与续开发提示词

用途：将本文件完整发送给另一个编程 Agent，让它复刻或继续开发当前前端，保持页面风格、布局和核心交互一致。

使用方式：
- 有现有工程：同时提供 src/、package.json、接口文档和当前页面截图，要求增量修改。
- 空白工程：直接使用下方“可复制提示词”，先生成纯前端 Mock 版本，再按已知接口联调。
- 视觉严格复刻：提供 1280×720 或 1440×900 截图作为比对依据。文字规格不能保证像素级相同。
- 本提示词以 2026-09-07 的确认结果为基准。不是早期 Vue Flow/shadcn 版本，不要求复刻历史 CSS 冲突或重复规则。

---

## 可复制提示词开始

你是一名资深 Vue 前端工程师。请实现一个可实际操作的 App Graph 应用页面图谱平台。直接编写、运行并验证代码，不只给设计描述或静态页面。

我的目标不是重新设计一套网站，而是保持下面规定的风格、布局、交互和业务含义。不要自行替换框架、加入登录营销页、把主界面改成仪表盘卡片墙，或把真实后台没有实现的能力包装成已完成。

### 一、项目定位

这是面向移动应用测试团队的页面关系图谱工作台：
- 节点表示功能页面，不等同于一张图片。
- 一个功能页可以有多张不同内容的截图。
- 边表示通过具体控件和动作进入页面的关系。
- 主图允许共享子节点、多父节点，但业务规则禁止所有新增边形成环。
- 游离页面/区域保存已采集但缺少可靠入口的证据。
- 人工复核 AI 结果，结合 URL 基线、Function Tree、用例和测试报告推进覆盖建设。
- 同 APP 的 URL 覆盖与页面路径是否接通是两个不同指标。

交付默认是一个无需后端即可运行的 Mock Demo，但真实接口层必须独立，不能在组件里直接硬编码请求。

### 二、技术栈和工程约束

使用：
- Vue 3.4+、Composition API、script setup。
- TypeScript 5.7+、Vite 5。
- Ant Design Vue 4.2：Select、Segmented、Table、Drawer、Modal、Form、Tag、Upload、Image、Checkbox、Switch。
- AntV G6 5.1.x：主画布；不要改回 Vue Flow，也不要使用 React。
- Iconify：通过统一 Icon 组件使用 ant-design 系列图标。
- ECharts 5：测试报告、覆盖趋势。
- GSAP：仅用于“项目旅程”介绍，不用于日常表格/画布的大幅动画。
- Axios：集中请求封装。
- ExcelJS 4.4、JSZip 3.10：Excel、采集包解析；按需加载或放入 Worker。

有已有仓库时沿用锁文件版本，不为了复刻界面升级全套依赖。保留已有组件、功能和用户修改；不要混用 shadcn、Element Plus 或另一套视觉语言。

目录建议：

```text
src/
  App.vue
  global.css
  components/Icon/Icon.vue
  utils/http/axios/index.ts
  mock/
    appGraph.ts
    projectBaseline.ts
    captureImports.ts
    coverageReports.ts
  views/app-graph/
    index.vue
    style.css
    info.api.ts
    info.data.ts
    governance.api.ts
    capture.api.ts
    data/
      graph.js
      projectBaseline.js
      baselineExcel.worker.js
      capturePackage.js
      capturePackage.worker.js
      captureDemo.ts
      functionTree.ts
      testCases.js
      testReports.js
    components/
      TreeNav.vue
      TreeItem.vue
      GraphCanvas.vue
      InspectorPanel.vue
      ProjectBaselinePanel.vue
      CaptureImportPanel.vue
      GovernanceWorkspace.vue
      CoverageTrend.vue
      TestCasePanel.vue
      TestReportDashboard.vue
      PromoJourney.vue
      graph/AppPageNode.js
      shared/GraphButton.vue
      shared/SmartImage.vue
```

index.vue 只编排状态和事件；归一化、接口、文件解析、静态配置分别放在独立文件。不要把整个系统塞进一个超过数千行的组件。

独立 Demo 可以直接在根页面显示 AppGraph；嵌入 Vben Admin 时作为 /app-graph 路由视图，使用宿主布局，不再重复输出大标题。不要把它做成 iframe。

### 三、必须保持的视觉风格

这是 Vben Admin 风格的桌面工作台：浅灰背景、白色工具面、蓝色强调、紧凑信息密度、克制边框，便于长时间使用。

基准 token：
- 页面外层：#f5f7fa。
- 工作区底色：#f4f7f9。
- 面板：#ffffff。
- 分隔边框：#e5e7eb；普通按钮边框：#d9d9d9。
- 标题文字：#1f1f1f；正文：#434343；次要文字：#8c8c8c。
- Ant Design 主色：#1677ff；图谱主强调：#1769e0。
- Hover 主色：#4096ff。
- 危险：#cf1322 / #ffccc7。
- 黄色只用于警告、待确认或 AI 推断标识，不作为普通按钮配色。
- 绿色只用于成功状态，不用于“取消”“开启编辑”“保存复核”等通用操作。
- 功能区颜色可以少量使用青、紫、绿、玫红，不把整页变成单一颜色的渐变。

字体：Inter、PingFang SC、Microsoft YaHei、sans-serif。
- Demo H1 20px，常规面板标题 15px/600。
- 正文 12–14px，辅助标签 10–12px。
- 不用随屏幕宽度放大的字体，不用负字距。
- 普通按钮高度约24–28px；表单默认控件约32px。
- 图标13–16px；图标按钮需 tooltip 或 aria-label。
- 按钮圆角4px，主要面板6px，非特殊组件不超过8px。
- 不给每个模块堆重阴影，不在卡片里继续嵌套装饰卡片。
- 默认优先 a-button size=small；已有 GraphButton 用27px高、4px圆角的紧凑样式，不再新造第三套按钮。
- Hover 只改变边框、文字和轻微底色，不能出现覆盖内容的蓝色遮罩。
- 控件使用标准语义：模式用 a-segmented，命令用按钮，布尔设置用 checkbox/switch。

主页面不是宣传页：不使用巨大 Hero、玻璃拟态、大面积深色背景、装饰光球或功能介绍文案。只显示真实业务标题、字段、状态和必要校验信息。

### 四、首屏布局：必须照此实现

独立 Demo 顶部为紧凑标题栏：
- 左侧小字 Mobile Intelligence，下方 Application Map。
- 右上角“项目旅程”入口。
- 标题栏高度约54px，不占据大片首屏。
- AppGraph 视图本身 padding=20px。

首屏结构：

```text
Application Map                                               [项目旅程]

+ 工具栏 ---------------------------------------------------------------+
| [图谱探索|用例编排|测试报告] [APP查询] [刷新]      [项目基线] [人工采集导入] |
| [左右排列|上下排列|自由排列] [适配|展开|收起|重置|导出] [批量并入] [建设日报] |
+-----------------------------------------------------------------------+
| 左侧导航          | 拖拽条 | G6 主图谱        | 拖拽条 | 右侧详情         |
| 搜索              |        | 左上角统计      |        | 节点信息         |
| 页面树/官方功能    |        |                 |        | 截图列表         |
| 主树、AI高亮、编辑 |        |                 |        | Page Model       |
| 游离URL区域       |        |                 |        | 数据结构         |
+-----------------------------------------------------------------------+
```

上图只是区域示意，不要求按钮固定断在示意中的某一列。真正要求：
1. 工具栏分左右两个语义组。
2. 左侧顺序：工作模式、APP查询/刷新、布局、图谱操作。
3. 右侧顺序固定：项目基线、人工采集导入、批量并入、建设日报。
4. 右侧四个入口是一组，靠右对齐，不能插到 APP查询和布局切换之间。
5. 宽度不足时左侧整组控件换行，不把重要入口藏进整条工具栏的横向滚动末尾。
6. 建设日报内部不能再出现“项目基线”按钮。可以保留“项目 URL 基线”的统计来源文字。
7. 不再出现“第三方应用页面关系图谱”“页面层级”等重复大标题。
8. 不恢复“完整/简洁模式”按钮；大图自动降级与手动模式按钮是不同概念。

桌面布局基准：
```css
.app-shell {
  display: grid;
  grid-template-columns:
    var(--left-pane-width, 280px) 12px minmax(520px, 1fr)
    12px var(--right-pane-width, 380px);
  grid-template-rows: auto minmax(0, 1fr);
  row-gap: 12px;
  padding: 20px;
  min-height: 0;
  background: #f4f7f9;
}
.topbar {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 16px;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}
.topbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
}
.topbar-project-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 5px;
}
.sidebar, .workspace, .inspector {
  min-width: 0;
  min-height: 0;
}
```

以现有工程可用高度为准，不机械叠加两个 viewport 高度。左右分隔条可拖拽调整宽度，遵守最小宽度并通知 G6 resize。树区、游离区、右栏分别滚动，不让表单或截图挤出容器。

当前独立工程采用最小宽度1180px的桌面工作台策略。复刻时先保证1280/1440/1920宽度，不能声称已有完整移动端体验。需要新增手机端时使用抽屉或页签，不强行把三栏压成三条窄缝；作为单独改进说明。

### 五、主图谱和三视图联动

APP 查询：
- a-select 可搜索。
- 下拉项左侧 APP名称、右侧节点数量 Tag。
- 选择框的选中标签只显示名称；下拉仍保留数量。
- 查询有 loading、失败提示和刷新，不能重复提交。
- 树统计显示总节点数，不是父节点或根节点数。

左侧：
- 递归树不限三级，使用稳定 ID，不能用 pageTitle 当 key。
- 主树支持搜索、展开/收起、AI 节点高亮、结构编辑。
- 搜索或 AI 高亮时非命中项置灰，不删除源数据。
- 游离 URL 独立区域，支持创建、探索状态和拖拽归类。
- 不把游离页面渲染到中间画布。接入后再出现。
- 官方功能页签展示 Function Tree、关联结果、确认状态及定位。

画布：
- G6 Canvas 自定义截图节点；当前基准节点196×258，标题条约36px。
- 不用每个节点一个重型 Vue DOM 组件承载300/800张图。
- 节点包含 pageTitle、截图、pageText 摘要、URL；截断内容可 hover 查看。
- 图片等比展示，不横向拉伸。缩略图先加载，原图用于预览。
- 标题区右上角是独立放大入口，点击热区不能覆盖整张节点。
- 三种模式：左右为 Dagre LR，上下为 Dagre TB，自由为按业务域分簇。
- 当前自由模式实现为 G6 combo-combined，不把历史 radial 字段名误当作强制径向树，也不宣称已经持续运行 force 动画。
- 左右/上下布局的边出口方向应符合布局方向。
- 边标签显示进入控件，不只画一条匿名线。
- 功能区边界克制但可辨认，主画布浅白/浅蓝底、极淡点阵，避免装饰色掩盖截图。
- 左上角统计主图节点、跳转等；不要把统计再次塞到左树标题。
- 右键菜单支持预览、编辑、添加截图、创建游离页、删除；菜单限定在可视区，Escape/外部点击关闭。
- 删除统一走二次确认，编辑统一打开同一节点 Modal。
- 保留适配视图、展开、收起、重置、整图导出、Minimap 和全屏入口。

性能：
- 300节点的输入、缩放、拖动和选择不能触发全图反复重建。
- 大图使用语义缩放、减少文字/阴影、按需缩略图；当前参考阈值为120节点。
- 图实例生命周期、ResizeObserver、定时器和事件监听都正确清理。
- 用变化范围更新图谱；布局重算不能由每个 hover 或输入事件触发。
- 不把降低画质后截图不可读称为性能优化完成。
- 导出整个图谱而不是当前视口；跨域图片导致导出失败时给出真实错误提示。

右侧详情：
- 标题与左侧搜索/树顶对齐。
- 信息、截图列表、AI/页面模型、动作与原始 JSON 沿竖向排列，可滚动。
- 保留“截图列表”，卡片约150px宽，图片区约210px高，区域最小高度约286px；横向滚动而非无限平铺。
- 图片预览使用暗色遮罩，支持同页多图切换，底部可见缩略图列表。
- 编辑表单放独立 Modal；右栏不再内嵌第二份编辑表单。
- 编辑支持 title/text/url/widgetDescription/embeddingText、AI信息、四层动作、保留/新增/删除图片。
- “取消/关闭”不提交；保存失败不关闭表单；保存中禁用重复操作。
- Page Model 跟随主体紧凑样式，不成为大圆角彩色卡片。

### 六、项目基线面板

首屏右侧“项目基线”打开约96vw的 a-drawer。

顺序：
1. 工具条：导入 Excel、补充 URL、批量设置高频 URL、刷新、Mock 状态。
2. APP数、基线URL数、已覆盖URL数、覆盖率。
3. APP a-table：名称、基线数量、已覆盖、高频数、覆盖率、分组、设置。
4. 当前 APP 的 URL a-table：URL、覆盖状态、高频开关、来源、补充时间。

规则：
- 一份当前项目基线，无版本选择、版本发布。
- 基线 Excel 只有 APP名称、URL 两列，支持多 APP。
- .xlsx 最大5MiB，最多50000条非空数据行，Web Worker解析，预览后确认。
- 手动补充为 APP名称 + 多行URL，每行一条。
- APP + 完整URL精确去重，追加不覆盖，未知APP可加入基线但不凭空创建图谱。
- 高频批量设置选择一个已有基线APP，最多5000条非空URL。
- 高频结果显示新增、原已高频、重复、未匹配及未匹配清单。
- 未匹配不自动创建，不清除未输入项。
- 覆盖率采用基线与已覆盖URL交集，不拿全图数量充当分子。

### 七、人工采集导入

首屏右侧入口，96vw Drawer，AntDV表格，不用自制div模拟表格。

工具条：APP、Mock标识、上传采集包、下载表格模板、Mock载入示例包、截图AI分析开关、刷新。
之后是任务选择、进度/错误、筛选、确认按钮、记录表格。

- 每包一个已有APP，ZIP根目录records.xlsx，PNG/JPEG截图相对路径。
- 必填APP名称、目标URL、页面截图。
- 其他字段：控件截图、控件说明、父节点ID、父页面URL、父页面截图、操作类型、采集时间、备注、记录ID、前一步记录ID、页面标题。
- 20MiB ZIP，最多500行；无版本字段。
- 任务状态 QUEUED/ANALYZING/READY/FAILED，READY展示“分析完成”，不冒充已入库。
- 筛选：全部、待核对、入口未知、已入库、异常；跨筛选保留勾选。
- 表格列：采集记录、证据缩略图、归并状态、操作。
- 核对 Modal 宽 min(1000px,96vw)，body最大70vh滚动；左280px证据区，右表单，gap24px。
- 核对表单包括已有/新建功能页选择、标题、描述、embeddingText、仅保存/保存关系、父节点或同包前一步、控件与操作。
- 同URL候选不是自动归属，同包前序不是捏造父节点。
- 没有父节点时可先保存游离区域；有已接入父节点时直接接入，不必再操作批量并入。
- 二次确认后显示逐条“已接入主图谱”或“已入库·待接入”。
- 已入库记录不能再次确认，支持定位。
- 未配置AI服务时禁用AI开关并保留人工路径，不能写假的“AI分析成功”。
- 缺少embeddingText的页面不能仅为了指标被自动归类。
- 所有分析建议在确认前都不应该修改真实图谱。

### 八、批量并入与建设日报

“批量并入”“建设日报”可以复用同一治理 Drawer 的两个页签，但首屏保持两个明确入口。

批量并入：
- 操作的是已有游离区域，不负责上传截图。
- 多选区域、统一指派父节点、逐项进入控件、二次确认。
- 仅增加入口边，保留区域内部结构。
- 未找到父节点时保持入口待确认，不能自动挂root。
- 真正的独立启动入口需要证据。
- 成功后回查可达性，提供受并发版本约束的最近批次撤销。
- 不宣称已有AI自动归并、向量召回或HDC验证，除非确有接口和证据。

建设日报：
- AntDV表格 + ECharts趋势，保持Vben工作台风格。
- 工具条：日期、早/晚报、生成、导出HTML、历史报告、分组。
- 不包含项目基线按钮。
- 展示报告生成时的基线与图谱快照，不随后续编辑重写历史。
- URL明细支持筛选和定位。
- 图谱结构接入数和URL覆盖数不能混为同一个指标。

### 九、其他已有能力的保留要求

工作模式：图谱探索、用例编排、测试报告。
- 用例保留页面路径与四层动作关系，支持终点采集和过程采集。
- 测试报告使用AntDV表格和ECharts周期趋势，突出测试预期、实际结果、平均值和多次结果波动。
- 不恢复已删除的“端到端执行链”展示。
- Function Tree与页面/动作关联、状态和定位保持可用。
- 项目旅程通过右上角按钮打开独立介绍，不侵占主工作区。

这些模块优先复用提供的源码和接口文档。没有真实接口时做明确标识的Mock，不猜测接口已存在或编造真实性能数据。

### 十、接口和数据约束

基础路径：
```ts
const API_BASE_URL = import.meta.env.VITE_APP_GRAPH_API_URL || '/appGraph';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
```

API模块统一拼接基础路径一次，不重复得到 /appGraph/appGraph。字段和接口用驼峰，旧 embedding_text 只在归一化入口兼容。

核心页面模型：
```ts
interface AppPage {
  id: string | number;
  pageId: string;
  pageTitle: string;
  pageText: string;
  pageUrl: string;
  widgetDescription?: string;
  images: string[];
  embeddingText?: string;
  aiRecursive?: boolean;
  aiInference?: Record<string, unknown>;
  pageInfo?: Record<string, unknown>;
  action: {
    popupAction: Record<string, unknown>[];
    stateAction: Record<string, unknown>[];
    externalAction: Record<string, unknown>[];
    pageNaviAction: Record<string, unknown>[];
  };
  children?: AppPage[];
}
```

- pageId 是后端稳定页面标识，与画布临时nodeId/internal UUID分开。
- 不能用标题去重；相同标题和相同URL都可能对应多个节点。
- images[] 首项是默认缩略图，其他图片供右侧图库与预览使用。
- 保留独立 edges，不只依赖 children，否则共享节点的第二条入口会丢失。
- 请求成功之后再同步状态；结构变更必须重新拉取或回查后台。
- 对异步切换APP、快速打开不同任务，使用请求序号或取消机制防止旧响应覆盖新界面。

已知路径：
- GET /appGraph/appList：{status:'success',apps:[{appName,count}]}。
- GET /appGraph/queryAppGraph/{encodeURIComponent(appName)}。
- POST /appGraph/createOrphanNode：appName、pageUrl。
- POST /appGraph/deleteNode：id；需要二次确认。
- POST /appGraph/moveNode：pageId、newParentId。
- POST /appGraph/updateNode：FormData，含pageId、pageTitle、pageText、pageUrl、widgetDescription、embeddingText、AI字段、action整体JSON、keepImages JSON数组和newImages文件。
- 图片：/appGraph/s3file/image?fileName=encodeURIComponent(imageUrl)。
- /appGraph/baseline/overview、urls、append、settings、priority、priorityBatch。
- /appGraph/captureImports、/{jobId}、/{jobId}/retry、/{jobId}/commit。
- /appGraph/orphans 下的workbench/batchMerge等沿用已有治理接口。

图片若是data:/blob:应直接使用，不再加图片API前缀；已有完整s3file/image URL不能重复封装。

采集确认请求：
```ts
{
  requestId: string, graphVersion: number,
  items: [{
    recordId: string, targetPageId: string,
    pageTitle: string, pageText: string, embeddingText: string,
    mode: 'orphan' | 'link',
    parentPageId: string, previousRecordId: string,
    widgetDescription: string,
    actionType: 'tap' | 'longPress' | 'swipe' | 'back'
  }]
}
```
响应包括savedCount、edgeCount和pages[{recordId,pageId,reachable}]。根据reachable展示真实结构状态，不能只拿HTTP200作为“已并入”。

业务不变量：
- firstCoverageTime 由后端维护，前端不生成/重置真实首次时间。
- 基线导入不产生页面覆盖事实。
- 同APP同URL补图或并入不重置首次覆盖。
- graphVersion是并发控制，不是APP版本。
- 任何新增环都拒绝，循环操作保留在执行轨迹，而不是强写DAG。

### 十一、Mock与可运行交付

生成Demo时：
- 默认无需登录、后端或数据库。
- 至少QQ、微信两个APP；保留300节点QQ压力演示的可选数据集，初始可先30–40节点便于阅读。
- 提供重复标题、同URL多截图、游离区域、已有内部路径、缺父节点、匹配歧义等样本。
- 提供真实ZIP结构的“载入示例包”，不是仅弹出“导入成功”。
- 模拟基线追加、去重、高频批量、编辑、删除、导入与并入，操作后界面真实变化。
- Mock明确显示演示标识；刷新会丢失内存数据必须在交付说明中写清。
- 不把Mock当作真实HDC执行、AI推理或数据库并发验证。

### 十二、验证和交付标准

完成前必须：
1. 运行类型检查、测试和生产构建，报告实际结果。
2. 启动本地服务，给出真实URL。
3. 1280×720、1440×900、1920×1080至少检查布局与文字溢出；未测尺寸明确说明。
4. 截图验证：四个项目入口靠右、日报内无基线按钮、图谱工具没有遮挡。
5. 验证左右面板拖拽、各区滚动、长URL/长描述、无数据/加载/失败状态。
6. 验证同URL多图预览和底部缩略图切换。
7. 验证编辑Modal取消/保存、删除确认和右键菜单。
8. 验证基线追加与高频多行输入，未匹配项必须可见。
9. 验证采集包同包B→C、独立D、缺图、重复导入、父节点未知、批量确认。
10. 验证游离页不在画布出现；接入后能够定位；禁止环的失败不能假装成功。
11. 清理观察器、监听器、Worker、定时器；避免后台轮询越开越多。
12. 最后交付目录、关键文件、运行方式、接口开关、实际验证结果和剩余限制。

不要仅提交一个设计方案。需要真实运行代码。不要未经要求推送远程仓库或部署公网。

## 可复制提示词结束

---

## 当前工程对照入口

已有仓库时优先检查：
- src/App.vue、src/global.css：独立Demo外层。
- src/views/app-graph/index.vue、style.css：实际首屏和三栏。
- components/shared/GraphButton.vue：紧凑按钮的既有样式。
- components/GraphCanvas.vue、graph/AppPageNode.js：G6实例、节点和大图呈现。
- components/InspectorPanel.vue：右侧与独立编辑Modal。
- components/ProjectBaselinePanel.vue、CaptureImportPanel.vue、GovernanceWorkspace.vue：右侧管理入口及工作台。
- [今日迭代记录](20260907-daily-summary.md)
- [基线接口说明](20260907-project-url-baseline.md)
- [人工采集接口说明](20260907-manual-capture-import.md)

复刻结果应该保留同一套产品语言：桌面工作台、左导航/中图谱/右详情、管理入口右对齐、紧凑AntDV组件、截图证据清晰、人工确认优先。允许修复溢出或旧样式冲突，不允许借复刻之名重设计整个产品。

