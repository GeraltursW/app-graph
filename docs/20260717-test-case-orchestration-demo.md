# 图谱用例编排 Demo

## 1. 目标

本次 Demo 将测试用例直接绑定到应用页面图谱，覆盖两类执行方式：

1. 路径采集：从根节点沿页面跳转边执行到目标页面，在目标页面采集性能。
2. 场景性能：从任意页面开始，执行滑动、长按、等待等典型操作，记录全过程性能。

页面顶部新增“图谱探索 / 用例编排”工作模式。进入用例编排后：

- 左侧展示用例目录和执行状态。
- 中间 G6 画布高亮当前用例涉及的节点与边。
- 路径边显示步骤序号和控件名称。
- 当前执行节点、边使用绿色强调，其余图谱置灰。
- 右侧展示用例配置、步骤、采集指标和模拟结果。

## 2. 当前 Demo 用例

### 2.1 进入群聊并采集性能

绑定路径：

```text
QQ 首页
  -> 消息中心
  -> 会话列表 01
  -> 聊天记录 05
  -> 群聊窗口 21
```

每一条跳转边沿用图谱中的 `widget_description`，脚本据此寻找并点击控件。到达末尾页面后采集 CPU、内存、FPS、功耗和温度。

### 2.2 短视频连续滑动性能

起点为“视频推荐 01”，执行：

```text
等待页面稳定
  -> 连续向上滑动 5 次
  -> 内容停留
  -> 长按视频内容
  -> 滑动评论区域 3 次
```

采集范围覆盖完整用例生命周期，适合观察连续交互过程中的 FPS、Jank、CPU、内存和功耗变化。

## 3. 前端数据模型

```ts
interface GraphTestCase {
  case_id: string;
  app_name: string;
  case_name: string;
  case_type: 'path' | 'scenario';
  graph_version: string;
  start_page_id: string;
  target_page_id?: string;
  steps: TestCaseStep[];
  collection: CollectionConfig;
}

interface TestCaseStep {
  step_no: number;
  type: 'navigate' | 'tap' | 'swipe' | 'long_press' | 'wait' | 'collect';
  page_id: string;
  edge_id?: string;
  action_id?: string;
  locator?: Record<string, unknown>;
  expected_page_id?: string;
  duration_ms?: number;
  repeat?: number;
}
```

不要只保存页面标题。正式接口应保存稳定的 `page_id`、`edge_id`、`action_id` 和图谱版本，标题仅用于展示。

## 4. 推荐交互

- 选择路径型用例时，自动展开路径祖先节点并将路径置于视口中心。
- 非用例节点保留上下文但降低透明度，不彻底隐藏。
- 执行时按步骤逐个高亮节点和边。
- 点击步骤可以定位对应页面或跳转边。
- 失败步骤需要显示截图、当前页面识别结果、预期页面和重试记录。
- 结果区后续应增加性能时序图，并把峰值与具体步骤对齐。

## 5. 当前范围

当前版本使用前端模拟定时器和模拟性能结果，用于验证信息架构与交互。真实下发需要接入后端任务接口、设备执行脚本和性能数据流，具体契约见后端仓库：

```text
docs/test-case-orchestration-contract.md
```

## 6. 后续计划

1. 用后端测试用例接口替换 `info.data.ts` 中的 Demo 配置。
2. 通过 SSE 或 WebSocket 接收实时步骤状态。
3. 增加步骤编辑器，支持从图谱节点和边生成用例。
4. 增加性能曲线，并将时间点映射到步骤和截图。
5. 增加失败回放、重试、断点续跑和设备占用管理。
