# AI 用例生成、区域行为检索与可执行路径规划方案

## 1. 目标

本方案用于在已有应用页面图谱、四层动作和厂商 Function Tree 的基础上，生成可查询、可解释、可验证、可下发的测试用例。

需要解决：

- 如何定义一个待测试“区域”。
- 如何检索区域内全部已知操作行为。
- 如何从大量动作中生成具有覆盖价值的组合。
- 如何生成从稳定起点到目标动作的可执行路径。
- AI 应负责什么，确定性算法应负责什么。
- 如何降低幻觉、重复用例、危险操作和无法复现路径。
- 前端如何选择区域、查看动作、预览路径并人工复核。
- 后端和脚本分别需要保存哪些数据。

核心结论：

> 不存在单靠一个提示词生成“完美路径”的方案。可靠路径必须由确定性图算法提供骨架，AI负责语义编排，校验器检查约束，真机试跑确认可执行性。

## 2. 系统分层

```text
厂商 Function Tree
        |
        v
页面图谱 + 四层动作 + Function Binding
        |
        v
区域解析与动作检索
        |
        v
覆盖目标生成
        |
        v
确定性路径规划
        |
        v
AI 场景编排
        |
        v
静态校验与风险检查
        |
        v
真机试跑、路径修复与版本冻结
        |
        v
正式执行与性能数据采集
```

职责边界：

| 模块 | 职责 |
|---|---|
| 图谱 | 提供真实页面、边、动作和可达关系 |
| Function Tree | 提供厂商功能语义和覆盖目标 |
| 检索器 | 找出指定区域内符合条件的页面和动作 |
| 规划器 | 计算可达路径、替代路径和恢复路径 |
| AI 生成器 | 组合动作、补充业务语义和断言建议 |
| 校验器 | 检查 ID、可达性、前置条件、风险和预算 |
| 执行器 | 按冻结步骤执行，不随意改变测试目标 |
| 修复器 | 仅在路径失效时，从允许动作中选择修复方案 |

## 3. 什么是“区域”

区域不是只能由画布上的矩形坐标定义。推荐支持五种区域选择方式。

### 3.1 Function 区域

选择 Function Tree 的一个节点及其子树：

```text
消息
├── 单聊
├── 群聊
└── 消息搜索
```

解析结果包括所有已确认绑定到这些 Function 的页面、动作和边。

### 3.2 图谱半径区域

以一个页面为中心，按图距离选择 N 跳范围：

```text
anchor_page_id = message_list
direction = both
radius = 2
```

适合探索“某页面附近可以做什么”。

### 3.3 路径走廊区域

选择起点和终点，把所有候选路径及其邻接动作作为区域：

```text
start_page = app_home
target_page = chat_detail
k_shortest_paths = 3
neighbor_radius = 1
```

适合性能路径对比和替代路径生成。

### 3.4 页面集合区域

用户在树或 G6 中多选、框选页面：

```text
page_ids = [page_a, page_b, page_c]
include_internal_edges = true
```

### 3.5 条件查询区域

通过 URL、页面类型、动作层、风险或验证状态查询：

```text
page_type in ["feed", "detail"]
action_layer in ["stateAction", "popupAction"]
effect_status = "verified"
risk = "safe"
```

五种区域可以组合，但后端必须返回解析后的不可变 `region_snapshot`，用例生成不能在过程中重新解释区域。

## 4. 区域解析结果

```json
{
  "region_id": "region-message-20260728",
  "app_id": "qq",
  "graph_version": "graph-20260728-01",
  "catalog_version": "qq-function-2026.07",
  "selector": {
    "type": "function_subtree",
    "function_id": "message",
    "include_descendants": true
  },
  "page_ids": ["page_message", "page_single_chat", "page_group_chat"],
  "edge_ids": ["edge_message_single", "edge_message_group"],
  "action_ids": [
    "action_open_chat",
    "action_long_press_message",
    "action_open_more"
  ],
  "boundary_page_ids": ["page_app_home"],
  "excluded_action_ids": ["action_send_real_message"],
  "generated_at": "2026-07-28T10:00:00+08:00"
}
```

`boundary_page_ids` 是进入区域所需的外部页面。它们可出现在路径前置步骤中，但不计入区域行为覆盖率。

## 5. 区域动作检索

### 5.1 检索维度

后端对 `page_actions` 建立统一动作索引，支持：

```text
function_id
canonical_page_id
page_type
action_layer
action_type
semantic_name
effect_status
review_status
risk
automation_support
source
confidence
target_page_id
state_key
popup_type
external_target
```

### 5.2 四层动作检索结果

```json
{
  "region_id": "region-message-20260728",
  "summary": {
    "total": 18,
    "verified": 13,
    "predicted": 3,
    "unresolved": 2,
    "safe": 12,
    "caution": 4,
    "high": 2
  },
  "groups": {
    "pageNaviAction": [],
    "stateAction": [],
    "popupAction": [],
    "externalAction": []
  }
}
```

每个动作必须携带：

- 唯一 `action_id` 和稳定 `action_fingerprint`。
- 来源页面和 Function Binding。
- 定位器降级链。
- 前置条件和预期结果。
- 风险、是否可自动执行。
- 验证状态和前后证据。
- 支持的参数域。
- 已被哪些测试用例覆盖。

### 5.3 语义检索

用户可以输入：

```text
检索消息区域内所有会产生弹层或状态变化的操作
```

系统将自然语言转换为结构化过滤条件，再使用 pgvector 对剩余动作进行排序。

自然语言只负责生成查询条件，不能直接决定动作是否存在。最终结果必须来自数据库中的真实 `action_id`。

## 6. 覆盖目标模型

### 6.1 基础覆盖

| 覆盖类型 | 说明 |
|---|---|
| page_coverage | 每个页面至少到达一次 |
| edge_coverage | 每条已确认页面边至少执行一次 |
| action_coverage | 每个可自动执行动作至少执行一次 |
| function_coverage | 每个 Function 的必要能力至少验证一次 |
| layer_coverage | 四层动作分别达到覆盖要求 |
| outcome_coverage | 重要动作的多个真实结果分别覆盖 |

### 6.2 状态与组合覆盖

过程采集不能简单做全排列。动作数为 N 时，全排列会迅速失控。

推荐使用：

- 等价类：不同输入归并为有效、无效、边界。
- 边界值：次数、时长、距离、文本长度的最小值和最大值。
- Pairwise：覆盖任意两个参数或动作的组合。
- 3-wise：只用于高风险或高价值模块。
- 状态转换覆盖：覆盖 `before -> action -> after`。
- 关键序列模板：业务认可的连续操作。
- 历史故障加权：提高曾经失败路径和动作的优先级。

示例：

```text
信息流滑动参数：
direction = up/down
repeat = 1/2/5
duration = 200/420/800ms
stay = 0/1000/3000ms
```

不生成 `2 * 3 * 3 * 3 = 54` 条全组合，而是使用 Pairwise 选出约 9 到 12 条高价值组合。

### 6.3 覆盖 Requirement

```json
{
  "requirement_id": "req-action-like",
  "type": "action_coverage",
  "target_id": "action_like",
  "priority": "P1",
  "required": true,
  "constraints": {
    "risk_max": "caution",
    "effect_status": "verified"
  }
}
```

用例生成的本质是：用尽可能少且稳定的用例覆盖尽可能多的 Requirement。

## 7. 路径生成算法

### 7.1 稳定起点

每个用例必须从可恢复起点开始：

```text
冷启动首页
已知 Deep Link
已有验证通过的 Checkpoint
指定页面的可重放最短路径
```

不要把“上一次执行结束时设备正好在哪”作为用例前置条件。

### 7.2 到达路径

使用确定性图算法：

- BFS：边权相同的最短页面路径。
- Dijkstra：考虑失败率、耗时和风险的最低成本路径。
- Yen K-shortest paths：生成若干替代路径。
- 简单路径 DFS：生成 root-to-leaf 全量路径。
- 强连通分量检测：识别环路和无法安全退出区域。

推荐边成本：

```text
cost =
  1.0
  + historical_failure_rate * 5
  + average_duration_seconds * 0.2
  + ai_only_penalty
  + external_action_penalty
  + risk_penalty
```

最短不一定最稳定，应优先选择总成本最低的路径。

### 7.3 场景动作

路径到达目标页面后，再执行区域动作组合：

```text
setup path
-> page assertion
-> behavior actions
-> performance collection
-> outcome assertion
-> cleanup or restore
```

### 7.4 恢复路径

每个可能改变上下文的动作都要定义恢复策略：

| 动作层 | 恢复策略 |
|---|---|
| pageNaviAction | back、已知返回边或重新启动并重放 |
| popupAction | 关闭按钮、返回键、点击遮罩 |
| stateAction | 反向动作、恢复数据夹具或重新登录测试账号 |
| externalAction | back、回调、Deep Link 或重新启动源应用 |

恢复失败时停止当前用例，不能让后续步骤在未知状态下继续。

### 7.5 路径指纹

```text
path_fingerprint =
hash(
  graph_version
  + start_checkpoint
  + ordered edge_ids
  + ordered action_ids
  + parameter_classes
)
```

同一个终点存在两条不同到达路径时，必须生成不同指纹。

## 8. AI 在用例生成中的职责

AI 可以：

- 理解 Function 和动作的业务含义。
- 从 Requirement 中组合高价值场景。
- 选择合适的模板和参数等价类。
- 给出业务可读的用例名称、目的和断言建议。
- 判断动作顺序是否符合常识。
- 对失败证据提出有限修复候选。

AI 不可以：

- 编造不存在的 `page_id/edge_id/action_id`。
- 自己创造页面可达关系。
- 绕过风险和账号策略。
- 把 predicted 动作当成 verified 动作。
- 在执行过程中随意扩大测试范围。
- 修改已冻结用例的覆盖目标。

## 9. 四阶段生成闭环

### 9.1 阶段一：候选生成

输入：

- Region Snapshot。
- Function、Page、Edge、Action 快照。
- Coverage Requirements。
- 用例预算和风险策略。
- 已有用例和历史执行结果。

输出：

- 用例候选。
- 每条用例覆盖的 Requirement。
- 使用的页面、边、动作 ID。
- 参数等价类。
- 未解决问题。

### 9.2 阶段二：确定性校验

校验：

```text
所有引用 ID 存在
每一步 source page 与当前状态一致
pageNaviAction 的 edge 可达
动作前置条件满足
风险未超过策略
步骤数和时长未超过预算
恢复路径存在
断言可由脚本观测
不存在未受控循环
```

失败用例不进入执行队列。

### 9.3 阶段三：真机试跑

使用测试账号和非生产环境执行：

- 每一步截图。
- 页面识别。
- 控件实际定位方式。
- 动作前后状态。
- 路径偏差。
- 重试次数。
- 恢复结果。

成功后保存 `validated_path_snapshot`。

### 9.4 阶段四：冻结

冻结内容：

```text
graph_version
catalog_version
binding_revision
page/edge/action IDs
locator snapshots
parameters
assertions
recovery strategy
validated device profile
```

图谱或动作版本变化后，用例标记 `stale`，重新校验，不直接覆盖历史版本。

## 10. 后端数据模型

### 10.1 behavior_regions

```text
region_id
app_id
name
selector
graph_version
catalog_version
page_ids
edge_ids
action_ids
snapshot
created_by
created_at
```

### 10.2 coverage_requirements

```text
requirement_id
region_id
requirement_type
target_type
target_id
priority
constraints
status
```

### 10.3 test_generation_jobs

```text
job_id
app_id
region_id
graph_version
generation_policy
model_name
prompt_version
status
input_snapshot
raw_model_output
validation_result
created_at
finished_at
```

### 10.4 test_cases

```text
case_id
app_id
region_id
name
case_type
source
graph_version
catalog_version
binding_revision
start_checkpoint
target_page_id
path_fingerprint
coverage_requirement_ids
risk_level
estimated_duration_ms
status
created_at
updated_at
```

### 10.5 test_case_steps

```text
step_id
case_id
step_no
step_type
source_page_id
target_page_id
edge_id
action_id
locator_snapshot
parameters
preconditions
assertion
recovery
collection
```

### 10.6 test_case_validations

```text
validation_id
case_id
device_profile
status
resolved_path
step_results
failure_reason
validated_at
```

## 11. 后端接口

```http
POST /api/behavior-regions/resolve
GET  /api/behavior-regions/{region_id}/actions

POST /api/test-case-generations
GET  /api/test-case-generations/{job_id}
POST /api/test-case-generations/{job_id}/validate
POST /api/test-case-generations/{job_id}/accept

GET  /api/test-cases
GET  /api/test-cases/{case_id}
PUT  /api/test-cases/{case_id}
POST /api/test-cases/{case_id}/dry-run
POST /api/test-cases/{case_id}/dispatch

GET  /api/test-coverage?region_id=...
GET  /api/uncovered-requirements?region_id=...
```

区域解析请求：

```json
{
  "app_id": "qq",
  "selector": {
    "type": "function_subtree",
    "function_id": "message",
    "include_descendants": true
  },
  "filters": {
    "layers": [
      "pageNaviAction",
      "stateAction",
      "popupAction",
      "externalAction"
    ],
    "effect_status": ["verified"],
    "risk_max": "caution"
  }
}
```

生成请求：

```json
{
  "region_id": "region-message-20260728",
  "coverage_profile": "balanced",
  "case_budget": 30,
  "max_steps_per_case": 15,
  "max_duration_ms": 120000,
  "combination_strength": 2,
  "include_alternative_paths": true,
  "risk_policy": {
    "allow": ["safe", "caution"],
    "require_human_approval": ["caution"],
    "deny": ["high"]
  },
  "collection": {
    "metrics": ["cpu", "memory", "fps", "jank", "power"],
    "trigger": "behavior_window"
  }
}
```

## 12. 前端产品方案

### 12.1 区域选择器

在用例编排模式增加：

- Function Tree 选择。
- G6 框选页面。
- 起点和图半径选择。
- 起终点路径走廊。
- URL、页面类型和动作层过滤器。

选定后，图谱只高亮区域页面、内部边和边界入口。

### 12.2 区域动作矩阵

按四层动作展示：

```text
动作名称
来源页面
Function
验证状态
风险
已有用例数
最近成功率
```

支持筛选“未覆盖、低成功率、AI 待复核、高价值”。

### 12.3 生成配置

用户配置：

- 覆盖目标。
- 最大用例数。
- 单用例最大步骤。
- Pairwise 或 3-wise。
- 是否生成替代路径。
- 风险范围。
- 性能采集指标。
- 执行设备限制。

### 12.4 路径预览

生成后：

- 在 G6 中高亮 setup path、behavior window 和 recovery path。
- 点击步骤定位到页面、边或动作。
- 对替代路径显示成功率和成本。
- 明确展示 AI 建议与确定性校验结果。
- 校验失败的步骤不能下发。

### 12.5 覆盖看板

展示：

- Function 覆盖率。
- Page、Edge、Action 覆盖率。
- 四层动作覆盖率。
- Requirement 覆盖率。
- 可执行用例比例。
- 真机通过率和不稳定率。

## 13. 执行器协议

执行器接收冻结快照，而不是自然语言：

```json
{
  "run_id": "run-001",
  "case_id": "case-001",
  "versions": {
    "graph": "graph-20260728-01",
    "catalog": "qq-function-2026.07",
    "binding": "binding-17"
  },
  "start_checkpoint": {
    "type": "cold_start",
    "expected_page_id": "page_home"
  },
  "steps": [],
  "risk_policy": {},
  "collection": {},
  "callbacks": {}
}
```

脚本按步骤执行。只有定位失败、页面偏差或外部窗口出现时，才调用 AI 执行决策器。

AI 执行决策器只能从后端提供的 `allowed_recovery_actions` 中选择，不允许临时探索其他业务功能。

## 14. 质量指标

用以下指标评价方案，而不是评价提示词是否“看起来聪明”：

```text
reference_valid_rate       引用 ID 有效率，目标 100%
static_validation_rate     静态校验通过率
dry_run_success_rate       首次真机试跑成功率
replay_success_rate        多次重放成功率
requirement_coverage_rate  覆盖目标完成率
coverage_efficiency        单条用例覆盖 Requirement 数
duplicate_case_rate        重复用例比例
flaky_rate                 不稳定用例比例
risk_violation_count       风险违规次数，目标 0
mean_repair_steps          平均路径修复步骤
```

## 15. 推荐实施顺序

### 第一阶段：区域动作查询

- 标准化 `page_actions`。
- 实现五种 Region Selector。
- 实现四层动作筛选和未覆盖查询。
- 前端增加区域高亮和动作矩阵。

### 第二阶段：确定性规划

- 实现 BFS、Dijkstra 和 K-shortest paths。
- 增加路径成本、恢复路径和指纹。
- 生成 Requirement 与基础覆盖用例。

### 第三阶段：AI 场景生成

- 接入候选生成提示词。
- 加入严格 Schema 和 ID 白名单。
- 实现 Pairwise 参数组合。
- 保存模型、提示词和原始输出。

### 第四阶段：校验和试跑

- 实现静态校验器。
- 对接 HDC 探索脚本的动作执行器。
- 保存试跑结果和定位器快照。
- 路径验证成功后冻结版本。

### 第五阶段：覆盖闭环

- Function Coverage 与 Case Coverage 联动。
- 正式运行结果回写 Requirement。
- 根据失败历史调整路径成本和回归优先级。

## 16. 验收标准

- 可以通过 Function、图半径、页面集合或条件定义区域。
- 可以查询区域内全部四层动作及其覆盖状态。
- AI 输出不得包含数据库中不存在的 ID。
- 每条用例都有稳定起点、到达路径、行为窗口和恢复策略。
- 所有路径在下发前通过确定性可达性检查。
- 高风险动作不会自动执行。
- 同一目标的不同路径具有不同指纹。
- 图谱版本变化后旧用例会标记失效。
- 前端可以预览页面、边、动作和覆盖 Requirement。
- 真机结果可以回写用例和 Function 覆盖率。
