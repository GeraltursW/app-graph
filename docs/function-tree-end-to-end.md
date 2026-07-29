# Function Tree 前端端到端工作流

## 1. 功能目标

前端把厂商 Function Tree 作为页面图谱上的“语义覆盖层”，实现：

1. 导入 metadata JSON 和 Function Tree JSON。
2. 自动触发后端匹配。
3. 展示最新目录、覆盖数量和决策状态。
4. 点击功能高亮并定位关联页面。
5. 在右侧工作台处理页面和四层动作候选。
6. 在节点详情中展示已经确认的 Function 标签。

Function Tree 不改变页面图谱原有父子关系。一个功能可以映射多个页面和动作，一个页面或动作也可以属于多个功能。

## 2. 用户操作

### 2.1 导入

在左侧切换到“官方功能”，点击“导入”：

- 选择应用 metadata JSON。
- 选择包含递归 `children` 的 Function Tree JSON。
- 填写数据来源；版本可留空并由 metadata 提供。
- 提交后前端调用导入接口，再自动调用匹配接口。

系统只展示最新激活目录，不要求用户手动选择版本。

### 2.2 查看覆盖

左侧总览显示：

- Function 数量。
- 自动确认 Binding 数量。
- 人工复核数量。
- 历史继承数量。
- 待复核数量。
- 冲突数量。
- 未覆盖或自动化受限 Function 数量。

功能行显示匹配页面数、动作数和当前风险最高的状态。

### 2.3 定位与复核

点击 Function 后：

- 中间 G6 图谱高亮关联页面，其他页面置灰。
- 右侧从节点 Inspector 切换为 Function Review。
- “需处理”仅显示待复核和冲突候选。
- “已确认”显示自动确认、人工确认和历史继承候选。
- 点击候选自动选中并定位其来源页面。
- 支持单条确认/拒绝和当前待处理集合的整组确认/拒绝。

批量按钮只在“需处理”筛选下显示，避免误操作隐藏数据。

### 2.4 四层动作标签

节点详情的动作分层包括：

| 动作层 | 含义 |
|---|---|
| `pageNaviAction` | 应用内页面跳转 |
| `stateAction` | 点赞、收藏、开关等状态变化 |
| `popupAction` | 弹窗、抽屉、半屏和菜单 |
| `externalAction` | 系统相机、SDK、小程序和外部应用 |

当动作 Binding 状态为 `autoConfirmed/humanConfirmed/inherited/confirmed` 时，动作旁显示对应 Function 名称标签。待复核、冲突和拒绝结果不显示为已确认功能。

## 3. 前端模块

```text
src/views/app-graph/
  index.vue
  info.api.ts
  data/functionTree.ts
  components/
    OfficialFunctionTree.vue
    FunctionTreeImportDialog.vue
    FunctionReviewPanel.vue
    TreeNav.vue
    InspectorPanel.vue
```

- `info.api.ts`：封装 Catalog、Run、Binding、Coverage、导入和复核接口。
- `data/functionTree.ts`：把后端 Catalog、Binding 和 Coverage 合并为树形视图模型。
- `OfficialFunctionTree.vue`：最新目录、状态总览和功能树。
- `FunctionTreeImportDialog.vue`：双 JSON 导入。
- `FunctionReviewPanel.vue`：候选筛选、证据、定位和批量复核。
- `InspectorPanel.vue`：在四层动作旁展示已确认 Function 标签。
- `index.vue`：统一编排请求、选中状态、高亮和回查。

## 4. API

所有接口统一使用 `/appGraph` 前缀：

```text
POST /appGraph/api/functionTree/import
GET  /appGraph/api/functionTree/catalogs?appName={appName}
GET  /appGraph/api/functionTree/catalogs/{catalogId}
POST /appGraph/api/functionMatch/run
GET  /appGraph/api/functionMatch/runs?catalogId={catalogId}
GET  /appGraph/api/functionMatch/runs/{runId}/bindings
GET  /appGraph/api/functionMatch/runs/{runId}/coverage
POST /appGraph/api/functionBindings/{bindingId}/review
POST /appGraph/api/functionBindings/reviewBatch
```

前端选择最新 Catalog 和最新完成 Run，加载页面与动作 Binding 后再渲染。

## 5. 状态规则

| 状态 | 前端含义 | 进入可信用例 |
|---|---|---|
| `autoConfirmed` | 高置信自动确认 | 是 |
| `humanConfirmed` | 人工确认 | 是 |
| `inherited` | 历史可信结果继承 | 是 |
| `pendingReview` | 达到复核区间 | 否 |
| `conflicted` | 最佳与次佳候选过近 | 否 |
| `rejected` | 人工拒绝 | 否 |

前端不根据关键词自行生成正式 Binding；静态规则仅允许作为纯 Mock 降级展示。

## 6. 端到端数据流

```text
用户上传两个 JSON
-> import Function Tree
-> run local matching
-> query latest completed run
-> merge catalog + bindings + coverage
-> render Function Tree
-> highlight/locate candidate page
-> review binding
-> backend persists decision
-> reload bindings and coverage
-> confirmed action shows Function tag
```

## 7. 规模化策略

- 用户只处理待复核和冲突，不逐条确认高置信结果。
- 已确认结果由新 Run 继承，减少多应用、多版本重复劳动。
- 增量探索只匹配新增或语义变化的页面和动作。
- 后端先本地召回和评分，AI 只批量复核模糊候选。
- 高风险 Function 后续可配置为“始终人工复核”。

后端算法、阈值、数据库字段和请求示例见后端仓库：

```text
docs/function-tree-end-to-end.md
```
