# Application Map Demo

## 最新交接文档

- [2026-09-15 前端模块结构与迁移说明](docs/20260915-frontend-module-refactor.md)
- [2026-09-07 迭代总结](docs/20260907-daily-summary.md)
- [前端复刻与续开发提示词](docs/frontend-agent-reproduction-prompt.md)：可完整发送给其他 Agent，包含布局、风格、交互和接口约束。
- [项目 URL 基线](docs/20260907-project-url-baseline.md)
- [人工采集包导入](docs/20260907-manual-capture-import.md)

当前源码使用 Ant Design Vue 与 AntV G6；历史说明如有冲突，以以上交接文档和当前源码为准。

第三方移动应用页面关系图谱独立演示项目。该版本从 Vben Admin 的 `app-graph` 视图中抽离，可直接运行，不需要登录、数据库或后端服务。

## 快速运行

环境要求：Node.js 18 或更高版本。

```bash
npm install
npm run dev
```

领导演示建议使用强制纯前端模式：

```bash
npm run dev:mock
```

浏览器访问：

```text
http://127.0.0.1:5176
```

生产构建：

```bash
npm run build
npm run preview
```

离线 Mock 构建：

```bash
npm run build:mock
```

## 演示内容

- QQ、微信应用切换与节点数量统计
- 左右、上下、自由三种图谱布局
- 图谱缩放、平移、适配、展开与收起
- 简洁模式与完整模式
- 主树导航、层级展开和节点搜索
- 游离 URL 创建、AI 探索和拖拽并入
- 主树结构拖拽调整与后台结构回查逻辑
- 页面详情、AI 推理信息和上下游关系
- 页面复核编辑、图片维护与全屏预览
- 节点二次确认删除与后台数据同步
- 厂商 Function Tree 双 JSON 导入、自动匹配、覆盖统计与页面定位
- Function 页面/四层动作候选复核、批量处理与已确认动作标签
- 请求 Loading、防重复提交和成功/失败提示
- QQ 300 节点、292 条跳转边和 7 个 AI 游离节点
- 220 条根到叶路径用例和 80 条过程采集用例

## 数据模式

项目默认使用内置 Mock 数据，所有主要交互都可以直接演示：

```env
VITE_USE_MOCK=true
```

Mock 包含内嵌 SVG 手机截图，不请求后端图片接口。编辑产生的数据仅保存在当前浏览器运行会话中，刷新页面后恢复为初始演示数据。

如需连接真实 FastAPI 后端，创建 `.env.local`：

```env
VITE_USE_MOCK=false
VITE_APP_GRAPH_API_URL=/appGraph
```

开发服务器会将 `/appGraph` 转发到：

```text
http://127.0.0.1:8000
```

## 技术栈

- Vue 3
- Vite
- Ant Design Vue
- AntV G6
- Iconify
- TypeScript

## 目录说明

```text
src/views/app-graph/
  index.vue           跨模块状态与事件编排
  workspace.config.ts 工作模式配置
  baseline/           项目基线：组件、API、解析、Worker、Mock
  capture-import/     人工采集导入：组件、API、ZIP 解析、Worker、Mock
  graph/              G6 画布、树导航、详情编辑、图谱 API 与数据
  function-tree/      厂商功能树、匹配复核、API 与目录数据
  orphans/            游离节点、AI 探索、批量并入 API 与面板
  coverage-report/    建设日报、URL 覆盖趋势、API 与 Mock
  test-case/          用例编排、路径生成、场景配置与演示数据
  test-report/        性能测试报告、趋势图、API 与演示数据
  governance/         批量并入/日报抽屉容器，不存放业务 API
  promo/              项目旅程动画
  shared/             请求配置、图片 API、公共按钮和 UI
  style.css           既有公共样式，保持层叠顺序
```

业务接口直接从对应目录的 `*.api.ts` 引入。统一请求配置在
`src/views/app-graph/shared/api.config.ts`，不再使用根目录 `info.api.ts` 或 `governance.api.ts`。

验证命令：

```bash
npx vue-tsc --noEmit
node --test tests/*.test.js
npm run build
```

## Function Tree

- [Function Tree 前端端到端工作流](docs/function-tree-end-to-end.md)
- [游离子图归并与图谱建设日报方案](docs/orphan-subgraph-and-daily-report-solution.md)

## 人工采集与游离并入

- [后端 ZIP 上传、异步分析与并入方案](docs/20260915-orphan-merge-backend-plan.md)
- [多模态 AI 脚本输入输出契约](docs/20260915-orphan-merge-ai-contract.md)
- [前端任务进度、复核、合入与定位方案](docs/20260915-orphan-merge-frontend-plan.md)
- [前端业务模块重构说明](docs/20260915-frontend-module-refactor.md)

上述并入文档区分现状与待实施能力，不代表新增后端接口已经上线。
