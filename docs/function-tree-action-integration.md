# Function Tree、页面图谱与四层动作融合方案

## 1. 文档目标

第三方应用厂商在测试阶段提供 Function Tree，描述应用具备的功能层级和功能说明。
App Graph 通过手机脚本、AI 识图和人工复核获得实际页面、页面关系和四层动作。

本方案用于解决：

- 厂商 Function Tree 如何保存到后端。
- AI 识别页面和动作如何匹配厂商功能。
- 页面和动作如何支持多功能归属。
- 前端如何展示功能覆盖、页面位置和动作证据。
- 人工如何复核、纠正和补充映射。
- 图谱增量探索后如何只更新受影响的功能覆盖。

## 2. 核心原则

Function Tree、Page Graph 和 Page Action 是三个不同维度：

| 层级 | 主要职责 |
|---|---|
| Function Tree | 厂商定义“应用应该具备什么功能” |
| Page Graph | 实际发现“功能出现在哪些页面、页面如何到达” |
| Page Action | 实际验证“用户在页面中可以执行什么操作” |
| Function Binding | 记录页面、动作与厂商功能之间的映射关系 |

不要把 Function Tree 直接转换成页面树，也不要强制一个功能只对应一个页面。

正确关系是：

```text
Function Tree
      |
      v
Function Binding
  /             \
Page Graph    Page Action
```

典型关系：

- 一个 Function 可以对应多个页面。
- 一个页面可以承载多个 Function。
- 一个 Function 可以由多个动作共同完成。
- 一个动作可能同时服务多个 Function。
- 页面跳转动作关联图谱边。
- 非跳转动作保留在页面内部，不创建虚假子页面。

## 3. 四层动作与 Function 的关系

### 3.1 pageNaviAction

表示应用内页面跳转，是 Page Graph 边的主要来源。

示例：

```text
消息首页 --点击会话--> 单聊页面
```

Function 映射：

```text
消息 > 单聊
```

前端表现：

- 高亮来源页面和目标页面。
- 高亮对应 G6 边。
- 边标签显示触发控件。

### 3.2 stateAction

表示当前页面状态或业务数据变化，不生成页面子节点。

示例：

```text
动态详情页 --点赞--> liked=true
```

Function 映射：

```text
动态与空间 > 点赞互动
```

前端表现：

- 高亮动作所在页面。
- 节点显示状态动作标记。
- Inspector 展示动作前后状态和验证证据。

### 3.3 popupAction

表示弹窗、抽屉、半屏、菜单或局部覆盖层。

示例：

```text
商品详情页 --选择规格--> SKU 半屏面板
```

Function 映射：

```text
交易 > 商品规格选择
```

前端表现：

- 不进入主页面树。
- 在来源页面上显示弹层动作。
- 必要时将复杂弹层显示为虚拟状态节点。

### 3.4 externalAction

表示系统界面、SDK、小程序宿主或其他应用能力。

示例：

```text
支付页面 --刷脸验证--> 系统生物识别
```

Function 映射：

```text
钱包与支付 > 刷脸支付
```

前端表现：

- 标记为自动化边界。
- 展示外部目标、风险和脚本支持状态。
- 不强制加入应用内部页面树。

## 4. 后端数据模型

### 4.1 function_catalogs

保存厂商 Function Tree 的一次完整版本。

```text
catalog_id          uuid primary key
app_id              uuid
source              varchar
vendor_version      varchar
schema_version      varchar
status              active | archived
raw_payload         jsonb
imported_at         timestamptz
```

约束建议：

```text
unique(app_id, source, vendor_version)
```

厂商发布新版本时创建新 Catalog，不覆盖旧版本，便于回溯历史测试结果。

### 4.2 function_nodes

保存 Function Tree 的每个功能节点。

```text
function_id             uuid primary key
catalog_id              uuid
vendor_function_id      varchar
parent_function_id      uuid nullable
level                    integer
function_name            varchar
function_description     text
display_order            integer
automation_limited       boolean
expected_capabilities    jsonb
match_rules              jsonb
raw_payload              jsonb
```

约束建议：

```text
unique(catalog_id, vendor_function_id)
```

`expected_capabilities` 用于描述厂商明确要求覆盖的动作：

```json
[
  {
    "capability_code": "social.like",
    "name": "点赞",
    "required": true,
    "allowed_layers": ["stateAction"],
    "allowed_action_types": ["tap"]
  }
]
```

如果厂商没有提供必要动作清单，系统只能判断“已发现”或“已验证”，不能严谨地声明“完全覆盖”。

### 4.3 page_actions

将当前 `PageInstance.action` JSONB 中的动作归一化为可查询记录。原始 JSONB 继续保留作为识别证据。

```text
action_id              uuid primary key
app_id                 uuid
canonical_page_id      uuid
page_instance_id       uuid nullable
widget_id              uuid nullable
edge_id                uuid nullable
action_fingerprint     varchar
action_layer           varchar
action_type            varchar
semantic_name          varchar
description            text
target                 jsonb
parameters             jsonb
expected_effect        jsonb
risk                   varchar
effect_status          predicted | verified | unresolved
confidence             numeric
raw_payload            jsonb
created_at             timestamptz
updated_at             timestamptz
```

建议唯一键：

```text
unique(canonical_page_id, action_fingerprint)
```

`pageNaviAction` 可以通过 `edge_id` 关联 PageEdge，其余三层动作允许 `edge_id` 为空。

### 4.4 function_page_bindings

保存功能与页面的多对多关系。

```text
binding_id             uuid primary key
function_id            uuid
canonical_page_id      uuid
binding_source         vendor | rule | ai | human
match_score            numeric
match_evidence         jsonb
review_status          suggested | confirmed | rejected
is_primary             boolean
graph_version          varchar
created_at             timestamptz
updated_at             timestamptz
```

### 4.5 function_action_bindings

保存功能与动作的多对多关系。

```text
binding_id             uuid primary key
function_id            uuid
action_id              uuid
capability_role        entry | behavior | exit | precondition
binding_source         vendor | rule | ai | human
match_score            numeric
match_evidence         jsonb
review_status          suggested | confirmed | rejected
graph_version          varchar
created_at             timestamptz
updated_at             timestamptz
```

不要用单个 `function_id` 直接写在 Page 或 Action 上，否则无法表达多功能归属和映射历史。

## 5. Function Tree 导入协议

建议厂商数据归一化为：

```json
{
  "app": {
    "package_name": "com.tencent.mobileqq",
    "app_name": "QQ"
  },
  "source": "QQ 官方能力目录",
  "vendor_version": "2026.07",
  "functions": [
    {
      "function_id": "message",
      "parent_id": null,
      "level": 1,
      "function_name": "消息",
      "function_description": "会话、消息检索和聊天记录能力",
      "expected_capabilities": []
    },
    {
      "function_id": "message.single-chat",
      "parent_id": "message",
      "level": 2,
      "function_name": "单聊",
      "function_description": "与单个联系人即时通信",
      "expected_capabilities": [
        {
          "capability_code": "message.open-chat",
          "name": "打开会话",
          "required": true,
          "allowed_layers": ["pageNaviAction"]
        },
        {
          "capability_code": "message.long-press",
          "name": "长按消息",
          "required": false,
          "allowed_layers": ["popupAction"]
        }
      ]
    }
  ]
}
```

导入时需要校验：

- `vendor_function_id` 在 Catalog 内唯一。
- `parent_id` 必须存在或为空。
- `level` 与父子关系一致。
- Function Tree 不允许形成环。
- `allowed_layers` 必须属于四层动作。
- 新版本不得修改旧 Catalog 的节点。

## 6. 页面与动作匹配流程

### 6.1 候选召回

为每个 Function 生成语义文本：

```text
祖先路径 + 功能名称 + 功能说明 + expected_capabilities
```

为页面和动作生成语义文本：

```text
页面标题 + 页面描述 + OCR + URL + Activity
+ 动作名称 + 控件语义 + 动作层 + 预期效果
```

使用以下信号召回候选：

- 文本关键词和厂商规则。
- Function 与 Page 的向量相似度。
- Function 与 Action 的向量相似度。
- URL、Activity 和控件 resource ID。
- 页面在图谱中的父级路径。
- 动作层与 Function expected capability 的兼容性。

### 6.2 匹配评分

第一版推荐：

```text
动作与功能描述语义相似度     35%
页面与功能描述语义相似度     25%
动作层和动作类型兼容性       15%
URL、Activity、控件文本      10%
Function Tree 上下文         10%
AI 原始识别置信度             5%
```

阈值：

```text
score >= 0.85         自动确认
0.65 <= score < 0.85  待人工复核
score < 0.65          保持未匹配
```

支付、账号、安全和生物识别等高风险 Function，即使分数较高，也建议进入人工复核。

### 6.3 匹配证据

每条 Binding 必须保存可解释证据：

```json
{
  "matched_terms": ["点赞", "互动"],
  "page_similarity": 0.88,
  "action_similarity": 0.94,
  "layer_compatible": true,
  "page_path": ["动态中心", "动态详情"],
  "url_signal": null,
  "reason": "状态动作改变 liked 状态，与厂商点赞互动能力一致"
}
```

不能只保存最终分数，否则人工无法判断 AI 为什么建立映射。

## 7. 覆盖状态计算

### 7.1 状态定义

| 状态 | 含义 |
|---|---|
| uncovered | 没有匹配页面和动作 |
| discovered | 找到候选页面，但动作尚未验证 |
| pending | 存在 AI 建议映射，等待人工确认 |
| partial | 只覆盖部分必要能力 |
| covered | 所有必要能力都有已确认、已验证动作 |
| limited | 功能存在，但自动化受支付、人脸、权限等限制 |
| conflict | 映射冲突或人工拒绝后尚未重新归类 |

### 7.2 覆盖指标

每个 Function 返回：

```text
matched_page_count
matched_action_count
verified_action_count
required_capability_count
covered_required_capability_count
coverage_rate
automation_rate
```

父 Function 的覆盖率由叶子 Function 聚合，不直接重复统计同一页面和动作。

## 8. 后端接口

### 8.1 导入 Function Tree

```http
POST /api/function-catalogs/import
```

### 8.2 查询当前 Function Tree

```http
GET /api/apps/{app_id}/function-tree?version=current&include=coverage,bindings
```

响应示例：

```json
{
  "catalog": {
    "catalog_id": "catalog-001",
    "source": "QQ 官方能力目录",
    "vendor_version": "2026.07"
  },
  "summary": {
    "total": 28,
    "covered": 16,
    "partial": 5,
    "pending": 3,
    "uncovered": 2,
    "limited": 2
  },
  "functions": [
    {
      "function_id": "message.single-chat",
      "parent_id": "message",
      "level": 2,
      "function_name": "单聊",
      "function_description": "与单个联系人即时通信",
      "coverage_status": "partial",
      "metrics": {
        "page_count": 2,
        "action_count": 4,
        "verified_action_count": 3,
        "coverage_rate": 0.75
      },
      "mapped_page_ids": ["page-101", "page-102"],
      "mapped_edge_ids": ["edge-201"],
      "mapped_actions": [
        {
          "action_id": "action-301",
          "page_id": "page-101",
          "layer": "pageNaviAction",
          "label": "打开会话",
          "review_status": "confirmed"
        }
      ]
    }
  ]
}
```

### 8.3 执行增量匹配

```http
POST /api/function-matches/run
```

```json
{
  "app_id": "app-001",
  "catalog_id": "catalog-001",
  "graph_version": "graph-20260727-01",
  "scope": {
    "page_ids": [],
    "action_ids": ["action-new-001"]
  }
}
```

空 `page_ids/action_ids` 表示全量匹配；增量探索后只传新增或变化的记录。

### 8.4 查询未匹配动作

```http
GET /api/apps/{app_id}/unmatched-actions
```

### 8.5 人工复核

```http
PUT /api/function-bindings/{binding_id}/review
```

```json
{
  "review_status": "confirmed",
  "operator_note": "人工确认该动作属于单聊消息操作"
}
```

### 8.6 人工建立映射

```http
POST /api/function-bindings/manual
```

```json
{
  "function_id": "message.single-chat",
  "target_type": "action",
  "target_id": "action-301",
  "capability_role": "behavior",
  "operator_note": "从待归类动作拖拽到官方功能"
}
```

## 9. 前端展示方案

### 9.1 左侧 Function Tree

保留当前“页面树 / 官方功能”切换形式，但数据改为后端接口返回。

每个功能行展示：

- Function 名称和说明。
- 已匹配页面数量。
- 已验证动作数量。
- 覆盖状态。
- 自动化受限标记。
- 待人工复核数量。

点击 Function：

- 高亮所有关联页面。
- 高亮 `pageNaviAction` 对应边。
- 在来源节点上标记非跳转动作。
- 自动选中第一个主要页面。

### 9.2 中间 G6 图谱

Function 作为语义覆盖层，不改变原始页面和边结构。

展示规则：

- 一级 Function 可以形成 G6 分区或 Hull。
- 页面节点显示一个 Primary Function。
- 次级 Function 以标签或详情形式展示。
- 页面跳转动作高亮对应边。
- 状态、弹层、外部动作高亮来源节点。
- 未匹配页面和动作使用中性样式。
- 待复核映射使用虚线或警告图标。

### 9.3 右侧 Inspector

新增“厂商功能映射”模块：

```text
功能路径
匹配状态
匹配分数
匹配来源
动作层
匹配证据
确认 / 拒绝 / 重新指派
```

编辑动作时同步展示它已经关联的 Function，避免人工修改动作语义后造成无提示的错误映射。

### 9.4 待归类动作

增加“待归类动作”列表：

- 显示动作所属页面、动作层、截图和 AI 描述。
- 展示系统推荐的前三个 Function。
- 支持拖拽到 Function Tree。
- 拖拽后弹出确认框。
- 后端建立 `binding_source=human` 的绑定。

## 10. 当前前端改造点

当前 Demo 代码：

```text
src/views/app-graph/info.data.ts
  - officialFunctionCatalogs 是静态 QQ 数据

src/views/app-graph/components/OfficialFunctionTree.vue
  - matchFunctionPages() 在浏览器内通过关键词匹配页面

src/views/app-graph/components/TreeNav.vue
  - 提供“页面树 / 官方功能”切换入口

src/views/app-graph/index.vue
  - 管理 Function 高亮状态并传给 GraphCanvas
```

正式改造：

1. 静态 `officialFunctionCatalogs` 只保留 Mock 环境使用。
2. 在 `info.api.ts` 增加 Function Tree 和 Binding 接口。
3. 删除正式环境中的前端关键词匹配。
4. `OfficialFunctionTree.vue` 直接使用后端覆盖统计。
5. `GraphCanvas.vue` 接收 `mapped_page_ids/mapped_edge_ids/mapped_actions`。
6. `InspectorPanel.vue` 增加 Function Binding 复核。
7. 增加待归类动作列表和拖拽绑定。

## 11. 增量更新策略

每次脚本探索结束后：

```text
新 PageInstance
-> CanonicalPage 去重
-> PageAction 按 action_fingerprint upsert
-> 找出新增或语义变化的 Page/Action
-> 只对变化记录运行 Function Matching
-> 更新受影响 Function 的覆盖统计
-> 前端重新拉取 Function Tree
```

已经由人工确认的 Binding 不得被后续 AI 自动覆盖。

Function Catalog、Graph 和 Binding 都需要版本：

```text
catalog_version
graph_version
binding_revision
```

测试用例引用生成时的版本，版本变化后标记为 `stale`，等待重新校验。

## 12. 与测试用例的关系

Function Binding 建立后，用例可以从“页面覆盖”升级为“功能能力覆盖”：

```text
Function
-> confirmed Page Binding
-> confirmed Action Binding
-> graph path
-> executable test steps
-> test run
-> Function coverage result
```

终点采集用例负责覆盖 Function 对应页面路径。

过程采集用例负责覆盖 Function 对应的：

- `stateAction`
- `popupAction`
- `externalAction`
- 滑动、长按和组合动作

测试报告最终可以同时回答：

- 厂商声明了多少功能。
- 图谱发现了多少功能。
- 多少功能具有已验证动作。
- 多少功能已生成可执行用例。
- 多少功能已在真机通过。
- 哪些功能因支付、人脸或权限而受限。

## 13. 推荐实施顺序

### 第一阶段：数据落库

- 增加 Function Catalog 和 Function Node 表。
- 增加标准化 Page Action 表。
- 增加 Page/Action Binding 表。
- 实现 Function Tree 导入和查询接口。

### 第二阶段：规则匹配

- 将当前前端关键词规则迁移到后端。
- 支持页面、URL、动作层和控件语义匹配。
- 前端改为展示后端匹配结果。

### 第三阶段：AI 与向量匹配

- 为 Function、Page 和 Action 生成 embedding。
- 保存匹配分数和解释证据。
- 增加待复核工作流。

### 第四阶段：人工复核

- Inspector 确认、拒绝和重新指派。
- 待归类动作拖拽到 Function Tree。
- 人工确认记录审计日志。

### 第五阶段：用例与覆盖闭环

- 从 Function Binding 生成测试用例。
- 执行结果回写 Function Coverage。
- 按 Catalog 和 Graph 版本生成覆盖报告。

## 14. 验收标准

- Function Tree 来自后端，不依赖前端静态数据。
- 页面和动作均支持多 Function 绑定。
- 四层动作都可以映射到 Function。
- 点击 Function 能正确高亮页面、边和非跳转动作。
- 前端覆盖状态与后端计算结果一致。
- AI 建议和人工确认状态明确区分。
- 人工确认结果不会被增量匹配覆盖。
- 新增页面或动作后只更新受影响 Function。
- Function Binding 可以直接用于测试用例生成。
