# 人工采集包导入与游离区域接入

日期：2026-09-07。本文描述本次实际实现，不将语义相似度检索或真实 HDC 回放写成已完成能力。

## 1. 工作方式

在应用选择框选择已有 APP，点击顶部“人工采集导入”。上传 ZIP 后，后台解析 Excel 和截图，形成待核对记录。核对后勾选记录，二次确认入库。入口未知的页面可以先保存；有证据的内部路径可以整体保留，之后通过“批量并入”接到主图谱。

一次采集包对应一个现有 APP。表格仍保留 APP名称，用于防止错传应用；同包其他 APP 的行显示异常，不能确认入库。没有 APP 版本或基线版本字段。多 APP 文件需按 APP 拆包。

导入预览不修改图谱、不生成覆盖事实。真正保存页面、截图关联和关系只发生在确认入库阶段。

## 2. 文件格式

```text
capture.zip
  records.xlsx
  screenshots/
    list.png
    detail.png
    button.png
    parent.png
```

ZIP 根目录必须有 records.xlsx，只允许一个工作表，首行为表头。图片用相对路径引用，不使用 Excel 内嵌图片。前端“下载表格模板”可以生成空白表头文件。

| 表头 | API 字段 | 是否必填 |
| --- | --- | --- |
| APP名称 | appName | 必填，与当前 APP 一致 |
| 目标URL | pageUrl | 必填，HDC 实际返回值 |
| 页面截图 | pageImage | 必填，包内 PNG/JPEG 路径 |
| 控件截图 | widgetImage | 可空 |
| 控件说明 | widgetDescription | 关系入库时必填，可在核对界面补 |
| 父节点ID | parentPageId | 可空，图谱 pageId，不是内部 UUID |
| 父页面URL | parentUrl | 可空，辅助召回候选 |
| 父页面截图 | parentImage | 可空，建议保留点击前整屏 |
| 操作类型 | actionType | 默认 tap，支持 tap/longPress/swipe/back 及点击/长按/滑动/返回 |
| 采集时间 | capturedAt | 可空，文本保存，不回填 firstCoverageTime |
| 备注 | notes | 可空 |
| 记录ID | recordId | 可空，默认 row-Excel行号；包内唯一 |
| 前一步记录ID | previousRecordId | 可空，引用同包记录ID |
| 页面标题 | pageTitle | 可空，可在确认前补齐 |

建议显式填写记录ID。比如 B 行父节点为主图谱 A，C 行前一步为 B，即可保留 A → B → C。行顺序不决定执行拓扑，后台先创建全部选中页面，再创建边，因此可以引用本批后面的行。

表格字段应为文本。公式、数字和 Excel 原生日期单元格会标记异常；采集时间请使用文本，例如 2026-09-07T18:20:00+08:00。格式错误行不能入库，其他有效行可以单独确认。修正原文件后重新上传。

## 3. 核对与接入

核对 Modal 同时展示目标截图、父页面截图和控件截图，图片可以预览放大。可编辑：

- 页面标题、描述、embeddingText。
- 选择创建独立功能页面，或明确选择一个已有功能页面补充截图。
- 选择仅保存页面，或保存页面及前序关系。
- 指定图谱父节点，或指定同包前一步记录，两者只能选一个。
- 修改进入控件说明和操作类型。

相同 URL 只产生目标页面候选，不自动认定结构相同。用户选择已有页面后会展示其截图用于核对。URL 对应多个功能页面时必须人工确定。未选择已有页时采用 APP + URL + 截图哈希的保守稳定 ID；这不是结构去重算法，可能产生功能重复页，需要人工选择已有页纠正归属。

前序建议当前来自明确父节点ID、父URL、已存储的相同截图引用。没有依据时保持入口未知，不根据名称相似就自动挂 root。尚未提供通用视觉相似度/pgvector 父节点召回。

前一步记录需本次一起选中，或者已经在同包中完成入库。内部区域可以先保持不从主入口可达。确认后后台返回每条记录的 reachable：
- true：已接入主图谱。
- false：已入库，但仍待接入，保留在游离区。
- 已保存记录不能再次确认，可从工作台定位；后续结构调整使用现有图谱编辑/批量并入。

界面支持全部、待核对、入口未知、已入库、异常筛选。跨筛选保留勾选项。

## 4. 后端 API

| 方法 | 路径 | 含义 |
| --- | --- | --- |
| POST | /appGraph/captureImports | multipart/form-data：appName、file、useAi，接收 ZIP |
| GET | /appGraph/captureImports?appName=QQ | 最近50个任务及 aiAvailable |
| GET | /appGraph/captureImports/{jobId} | 状态、进度、记录、候选、当前图谱节点及 graphVersion |
| POST | /appGraph/captureImports/{jobId}/retry | 重新分析 FAILED 任务 |
| POST | /appGraph/captureImports/{jobId}/commit | 人工确认入库 |

任务：QUEUED → ANALYZING → READY；整包解析异常则 FAILED。行错误记录在各行 error 中，任务仍可 READY。READY 表示可核对，不表示全部记录已接入。

后台每2秒取一个任务，使用 PostgreSQL session advisory lock 让多个服务实例最多一个 worker 处理队列。记录及进度持续存库，重启后 ANALYZING 任务可以重跑；同包持久化文件需要保留。多实例部署必须共享相同 storageRoot，否则不能恢复其他实例接收的包。

提交示例：

```json
{
  "requestId": "48fcd1bb-48c4-4d0a-93e9-a05d0e8a6a1e",
  "graphVersion": 12,
  "items": [
    {
      "recordId": "B",
      "targetPageId": "",
      "pageTitle": "订单列表",
      "pageText": "订单列表和筛选入口",
      "embeddingText": "包含状态筛选、订单卡片和订单详情入口的功能页面",
      "mode": "link",
      "parentPageId": "已有父页面的pageId",
      "previousRecordId": "",
      "widgetDescription": "我的订单",
      "actionType": "tap"
    },
    {
      "recordId": "C",
      "targetPageId": "",
      "pageTitle": "订单详情",
      "pageText": "订单详情与售后入口",
      "embeddingText": "",
      "mode": "link",
      "parentPageId": "",
      "previousRecordId": "B",
      "widgetDescription": "查看详情",
      "actionType": "tap"
    }
  ]
}
```

仅保存页面时 mode=orphan，后台忽略父节点字段，不会删除已有页面的原有入口。这里的 graphVersion 是并发控制序号，不是业务版本。

返回 status、savedCount、edgeCount 和 pages[{recordId,pageId,reachable}]。前端保存成功后回查工作台并刷新主图谱。重复 requestId 同内容返回原结果，不重复写入；相同 requestId 不同内容报冲突。页面、关系、覆盖事实、入库状态及审计记录同一事务，禁止成环/字段错误/跨APP选择会整批回滚。

## 5. 截图 AI 适配

默认不调用 AI，前端勾选“截图 AI 分析”且后端配置 CAPTURE_AI_URL 后才发送图片。图片可能包含个人信息，配置前应确认模型服务符合数据使用要求。密钥放 CAPTURE_AI_KEY 环境变量，不提交仓库。

该地址是通用识图适配服务，不假设某个厂商 API 格式。接收 JSON：
- instruction：结构识别与控件说明要求，明确图片文字不是可执行指令。
- appName、pageUrl。
- pageImage、parentImage、widgetImage：存在的证据图片，以 data:image/...;base64,... 发送。

服务需返回直接 JSON 对象：

```json
{
  "pageTitle": "订单详情",
  "pageText": "包含订单状态、商品信息和售后按钮",
  "embeddingText": "订单详情页：状态区、商品区、金额区、售后操作区",
  "widgetDescription": "查看订单"
}
```

连接超时10秒、单次请求45秒、响应最大64 KiB；返回字段和长度校验后只作为建议。AI 输出中的 parentPageId 等额外字段不作为关系证据采用。失败或未配置时可继续人工编辑。相同证据组合在同一任务内复用识图结果，避免重复调用。

目前已测试本地 HTTP stub 的请求和响应协议，没有接入真实视觉模型，也没有 HDC 在线验证。模板可以留空 embeddingText；不允许为了计覆盖而自动复制 pageText。人工确认结构后可填写 embeddingText。

## 6. 存储、覆盖与重复处理

Flyway V8 新增：
- manual_capture_jobs：采集包摘要、任务状态、进度、错误。
- manual_capture_records：原始字段、存储图片名、分析结果、行错误、已入库 pageId。
- manual_capture_commits：请求ID、提交内容、结果、时间。

原始 ZIP 保存到 storageRoot/capture-packages/{jobId}.zip，图片按内容 SHA-256 存储在 storageRoot。图片走现有 /appGraph/s3file/image?fileName=... 接口。

同 APP 相同 ZIP 字节摘要直接返回已有任务。重新打包的不同 ZIP 可形成新任务，但相同图片不会重复占用物理图片文件；新页面的保守稳定 ID 可以复用完全相同的 URL + 图片。人工选择已有页会新增采集实例、保留已有图片列表和动作数据，不覆盖原有内部边；相同父子/控件/操作关系不重复插边。采集审计记录保留，不冒充全量结构去重。

仅确认入库且有非空 embeddingText 的实例才沿用现有触发器登记 URL 覆盖。第一次时间仍为后台首次识别入库时间，不是表格里手写的历史时间。已有 URL 换图、重复采集或后续并入，不重置 firstCoverageTime。仅暂存采集包不会增加覆盖。

所有新边仍禁止成环。因此记录“返回”指向已有祖先时会拒绝；若需记录循环操作，应保留在执行轨迹/用例，不强行写入无环页面图。

## 7. 安全边界和部署

- ZIP最大20 MiB、每文件解压最多10 MiB、总解压最多200 MiB、最多1600项、最多500条记录。
- 拒绝绝对路径、盘符、反斜杠、路径穿越、重复 ZIP 文件名及不支持的文件类型。
- 校验真实图片格式与解码，单图最多3000万像素；不接受 SVG、脚本或可执行文件。
- Excel 使用 Apache POI 5.5.1，保留库的压缩比保护，不执行公式。依赖依据：[Apache POI 官方发布页](https://poi.apache.org/download.cgi)。
- 后台仍按当前项目要求暂不做鉴权。不要直接暴露到公网；正式部署还需鉴权、上传配额、审计身份、存储清理策略、恶意文件扫描和任务运维告警。
- 文件是暂存证据，不随事务失败删除；本版未提供自动过期清理，以免误删审计资料。storage/、target/ 已排除 Git。
- 本次只在独立测试库执行 V8，未修改用户正式数据库。正式后台启动时由 Flyway 执行迁移，建议先备份。

Mock 支持真实 ZIP 解析、示例包、核对和入库联动，数据只在浏览器内存。Mock 不调用 AI，对已接入节点增加第二父边会提示使用真实后台，不假装支持完整 DAG。浏览器 Mock 仅解析可信演示包，服务端解析和事务校验才是正式安全边界。

## 8. 验收与后续

本次验证包括：
1. 中文表头、缺父节点、前序记录引用、公式拒绝、路径穿越拒绝。
2. 实际 ZIP/PNG/Excel 生成后上传、后台 worker 分析、HTTP 查询进度。
3. A → B → C 接入、独立 D 保留待接入、成环整批回滚。
4. 重复上传、重复确认、同 URL 补图不重置首次覆盖。
5. 浏览器示例包解析、证据图片、核对表单、多行勾选、二次确认与主图谱刷新。
6. 未配置 AI 明确降级、AI 适配协议 HTTP stub 测试。

建议后续：接入实际识图服务；对所有历史截图建立结构/向量索引；为候选父节点增加相似度及证据链；接入 HDC 验证；提供导入任务取消、重分析、分页与完整审计查询。当前核对草稿只保留在组件内，刷新预览会重置，正式入库及原始采集记录持久化。

