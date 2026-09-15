# 游离节点并入：后端工程方案

日期：2026-09-15。关联：[AI 脚本协议](20260915-orphan-merge-ai-contract.md)、[前端交互方案](20260915-orphan-merge-frontend-plan.md)。

本文是针对新要求的实施方案，不代表下面新增接口、状态和自动并入逻辑已经上线。
现状以本地 D:\codes\app-graph-backend 的源码为准；本次交付是方案与已完成的前端目录整理，不修改后端执行代码。

## 1. 先给结论

1. 当前 ZIP 上限是 20 MiB，不是 100 MiB；后者是整个 multipart 请求上限。
2. 文件上传与任务处理是两段过程：文件传完并持久化后返回 jobId，解析、识图、匹配在后台队列执行。上传到 100% 不等于分析完成。
3. Excel 有明确父节点时，满足同 APP、有效目标页、真实控件证据、AI 完成、无环和并发校验后可以直接并入，不要求逐条再拖一次。
4. 缺父节点时先保留证据和区域内部关系；可推荐父节点，但不能凭视觉相似或名称相近就挂 root。
5. 所有合法入包图片均进入多模态分析流程。AI 不是前端可随意跳过的开关；完全相同的图片允许复用可追溯的有效分析结果。
6. “图片分析完成”“页面入库”“URL 已覆盖”“接入主图谱”四个事实必须分开记录。

## 2. 已有实现与缺口

| 内容 | 当前源码 | 本方案目标 |
| --- | --- | --- |
| 上传接收 | CaptureImportController 返回 jobId/duplicate，默认 HTTP 200 | 新任务 202 + 查询地址；传输进度单独显示 |
| 包大小 | 服务层 20 MiB；Servlet 单文件 20MB、请求 100MB | 暂保留 20 MiB；流式处理完成后升到 100 MiB |
| 包处理 | CapturePackage 一次解压到 Map，逐行处理 | 流式解压到隔离目录，分资产、记录和 AI 任务 |
| 异步队列 | 每 2 秒轮询；全局 advisory lock 一次一个任务 | 持久化子任务、重试、租约、可配置并发 |
| 状态反馈 | QUEUED/ANALYZING/READY/FAILED + progress | 保留旧主状态，新增 stage、计数、记录级结果 |
| AI | useAi 默认 false；一次发送目标/父/控件图片，四字段结果 | 合法图片全量建任务、持久化缓存、结构化输出、失败阻断相关记录自动并入 |
| AI 失败 | 可以人工填写继续 | 原始文件可暂存；相关记录不得静默绕过必需分析 |
| 父节点 | ID/URL/同图召回候选；用户确认提交 | 明确 ID 的安全记录可按上传策略自动处理，其余集中复核 |
| 无父节点 | 支持仅存页面、同包前序引用、批量接入 | 以区域为单位处理未知入口，避免重复拖 100 次 |
| 提交 | 同事务写页面/实例/边/覆盖事实/审计；requestId 幂等 | 复用同一事务内核，增加服务端复核草稿、预校验、自动策略审计 |
| 并发 | graphVersion 与 APP 行锁，数据库禁止成环 | 自动/人工均用此约束，不另写一套绕过校验的 SQL |
| 重试 | 只支持整包 FAILED 重试 | 增加单图失败重试；缓存成功项，避免整包重复收费 |

代码锚点：importer/CaptureImportController.java、CaptureImportService.java、CaptureImportWorker.java、CapturePackage.java、CaptureVision.java；graph/GraphGovernanceService.java；数据库迁移 V6/V7/V8。

### 当前尤其要补的地方

- upload 在事务内锁 APP，然后读整个 ZIP 并写磁盘；不应把网络上传和大文件处理放进图谱写锁事务。
- 图片目前只在遍历有效 Excel 行时处理，没有对未引用图片统一建立分析记录。
- AI 结果缓存仅存在于单次任务内存，重启或重打包后可能重复调用。
- AI 失败结果不阻止当前 commit；必须在服务端增加前置检查，不能只禁用前端按钮。
- 当前 commit 主要保存用户提交的标题、摘要与 embeddingText；新页 action 没有从识图结果完整落库。需要显式适配四层动作。
- 当前批量并入 GraphGovernanceService.merge 写入的 action_type 固定为 tap；后续必须接收并验证真实 actionType，不能把长按/滑动全写成点击。
- 图谱读版本不覆盖所有图片/动作编辑情形，复核还需要 recordRevision、analysisRevision 与依赖指纹；不能只校验 graphVersion。

## 3. ZIP 大小和资源预算

统一使用字节配置与校验，UI 标成 MiB，避免 MB/MiB 含义不一致。

| 限制 | 当前实现 | 目标配置建议（需先改代码） |
| --- | --- | --- |
| ZIP 压缩后 | 20 × 1024² 字节 | 100 × 1024² 字节 |
| multipart 请求 | 当前配置 100MB | 110 MiB，给表单边界留余量 |
| 单个解压文件 | 10 MiB | 保持 10 MiB |
| 总解压字节 | 200 MiB | 1 GiB，按实际读取字节累计 |
| ZIP 项数 | 1600 | 2000，目录也计数 |
| Excel 数据区 | 最多 500 行 | 保持 500；包大小限制通常更早触发 |
| 图片像素 | 3000 万 | 保持；追加单边尺寸限制和资源隔离 |
| 图片格式 | PNG/JPEG | 保持；按内容签名和解码结果验证 |
| 并发 | 全局单任务 | 初始同时上传 2 包、解压 1 包、AI 2 个请求，再按压测调整 |

这是一组建议初始预算，不是已验证的吞吐量。500 行不是承诺可在 100 MiB 内放下 1500 张大截图。
PNG/JPEG 已压缩，ZIP 不一定明显变小。超过限额按实际文件大小拆包；跨包前序先入库后使用 pageId，不用另一包的局部 recordId。

不能只把 20 改为 100：当前 getBytes 和 Map<String, byte[]> 会将包和解压内容放入堆内存，还会叠加图片解码和 Base64 内存。
目标实现应流式收件、流式计算 SHA-256、流式解压到 D 盘隔离目录、受限解码。一次只加载正在分析的图片。

建议临时/持久化目录：D:/storage/app-graph/upload-tmp、capture-packages、capture-staging；使用配置和存储抽象，不硬编码路径到业务类。
Servlet multipart 临时目录也要显式指向 D 盘，否则可能先占用系统盘。

### 完整接收边界

- 网关、Servlet、应用层同时限制；应用层对实际字节再验证，不信任 Content-Length。
- 对 ZIP 拒绝穿越路径、绝对路径、盘符、重复规范化路径、加密包、符号链接、嵌套压缩包和可执行文件。
- records.xlsx 本身也是压缩格式；保留 POI 压缩比保护，并设置内部 XML、单元格和工作表资源限制。不能只限制外层 ZIP。
- 完整性校验、文件类型验证、病毒扫描/隔离通过前不把图片发送模型。
- 解压和上传使用独立磁盘配额；达到上限拒绝新任务，不靠磁盘写满后报错。
- 限制超大字段和请求体；记录级错误与整包致命错误区分。
- 无引用的合法图片也进入资产清单和 AI 分析，但不自动生成图谱页面；返回“未关联图片”提示供用户关联或弃用。

上传限制应同时约束类型、大小、存储和解压后的资源消耗，而不是只检查扩展名。[OWASP 文件上传指南](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
Spring 的 max-file-size 与 max-request-size 是两个不同限制，location 决定上传临时文件位置。[Spring MultipartProperties](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/servlet/autoconfigure/MultipartProperties.html)

## 4. 上传异步、解析异步分别是什么

浏览器使用异步 HTTP 上传，不阻塞用户界面，但后端必须等到文件完整、安全落盘并登记任务之后，才确认“已接收”。
这不等于断点续传，也不等于用户关闭页面后浏览器一定继续上传。

建议过程：

1. 前端校验 APP、后缀和字节数，用户一次性确认自动并入策略。
2. POST multipart 流式写 .part 文件并计算包哈希；断连不产生可运行任务。
3. 接收完整后校验 ZIP 基础完整性，原子转存正式包；短事务创建 QUEUED 任务。
4. 文件已落盘但数据库失败时，留待清理器识别无引用文件；绝不能创建指向缺失包的可运行任务。
5. 返回 HTTP 202、jobId、statusUrl；重复提交返回已有 jobId 和 duplicate=true。
6. Worker 验证/解析 → 建图片资产 → AI 分析 → 归一化 → 匹配 → 预校验 → 自动处理安全组/等待人工。
7. 前端查询任务概要，按需分页查询记录，关闭再打开可恢复。

202 仅表示请求已被接受，不保证任务成功；最终结果必须通过状态资源查询。[MDN 202 Accepted](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/202)

新响应建议：

```json
{
  "jobId": "uuid",
  "status": "QUEUED",
  "duplicate": false,
  "statusUrl": "/appGraph/captureImports/uuid/status",
  "mergePolicy": "AUTO_VALIDATED",
  "policyVersion": "capture-merge-1"
}
```

当前前端 upload 使用共用 Axios 15 秒超时，没有单独上传进度回调。目标必须给上传配置独立超时（例如 180 秒，结合网速调整）和 onUploadProgress；解析不占用这个请求连接。
100 MiB 在慢网下仍可能超时。网络常不稳定时再增加 uploadSession/chunk/complete 协议，不把普通 multipart 宣称为断点续传。

### 状态与进度

保留兼容主状态 QUEUED、ANALYZING、READY、FAILED，新增 stage：VALIDATING、EXTRACTING、AI_ANALYZING、MATCHING、AUTO_COMMITTING、WAITING_REVIEW、DONE。
READY 表示后台分析阶段结束，可能有成功、失败、待人工的混合记录，不表示全部接入。

```json
{
  "jobId": "uuid",
  "status": "ANALYZING",
  "stage": "AI_ANALYZING",
  "revision": 18,
  "updatedAt": "2026-09-15T10:00:00Z",
  "recordTotal": 120,
  "imageTotal": 180,
  "imageSucceeded": 130,
  "imageCacheHit": 20,
  "imageFailed": 2,
  "imageRunning": 2,
  "imagePending": 26,
  "autoMergedCount": 0,
  "storedPendingCount": 0,
  "reviewRequiredCount": 0,
  "retryAfterMs": 3000
}
```

上述图片状态互斥、总数守恒；不能用“已处理行数”代替全部图片进度。
文件传输 100% 后显示“后台排队/分析 150/180”；AI 有失败也要显示，不画一个永远假走动的百分比。
GET status 每 2～3 秒轮询，终态停止，错误退避并提供恢复按钮。任务概要不能每次返回全 APP 节点和全部图片结果。
先用轮询；需要即时推送再加 SSE，事件只携带 jobId/revision，断线恢复仍以 GET 为准。

## 5. Excel、页面身份与父节点判定

保持 records.xlsx + 相对图片路径格式，每包仅一个已有 APP，无 APP 版本概念。
继续使用 APP名称、目标URL、页面截图、控件截图、控件说明、父节点ID、父页面URL、父页面截图、操作类型、记录ID、前一步记录ID等既有列。
pageId 是业务哈希 ID，不能使用前端 nodeId 或数据库 canonical_page_id 替代。

### 直接并入判定表

| 输入/证据 | 自动处理结果 |
| --- | --- |
| parentPageId 唯一有效、同 APP、已从确认入口可达；目标身份明确；控件/动作完整；所需图片 AI 完成；无冲突无环 | AUTO_ELIGIBLE，可按上传时确认的策略自动并入 |
| 仅 parentUrl，只有一个候选 | 候选推荐，不因“暂时唯一”自动认定真实父节点 |
| 仅父截图匹配或 AI 相似度高 | 候选推荐，需要真实跳转证据或人工确认 |
| parentPageId 与 parentUrl/前序记录相互矛盾 | CONFLICT，待人工，不静默选择一项 |
| previousRecordId 引用同包且链路锚点有效 | 按依赖组排序并入；不要求 Excel 行顺序一致 |
| B→C→D 有证据，但 B 没入口 | 保存区域内部关系，全部标为待接入；不伪造 root→B |
| 没有父节点、没有内部关系 | 仅保存已分析的页面证据，标 ENTRY_UNKNOWN |
| 目标 URL 对应多个功能页面、目标结构无法明确 | TARGET_AMBIGUOUS，先选择补图目标或创建新功能页 |
| 父节点是另一个尚未接入的区域 | 可以确认区域内部边，但结果仍不叫已接入主图谱 |
| 将形成任意环、自己指向自己或跨 APP 父子边 | 拒绝，保留任务和证据，不自动删原边 |

“明确父节点可直接并入”不是无条件相信一列字符串。Excel 表达采集人员提供的跳转事实，后台验证一致性；人工入口信息优先于 AI 猜测，但发现冲突时暂停而不是覆盖事实。
正式环境应记录上传者和策略确认者身份。目前系统无鉴权，自动策略只在受控内网试用，不开放公网。

### 目标页面去重与路径增量

- URL 相同不能证明是同一功能页；一张截图也不等于一个功能页。
- 完全相同图片+相同 APP/URL 可以复用确切目标；结构近似或仅向量相似默认产生候选。
- 用结构特征和已人工确认的映射辅助去重；不以 pageTitle 或 embedding_text 字符串相等作为主键。
- 无法确定时进入目标复核，而不是自动制造重复节点或合并不同功能页。
- 已有 A→B→C→D，又采集 A→H→D：保留 D，追加 H→D；不 move D、不删除 C→D。
- 真实回退动作形成环时，记录到四层动作/执行轨迹，不把它强行写入无环主图。

## 6. 缺父节点的确认流程

以“区域入口”而不是每张图片作为待办单位：

1. 依据显式 previousRecordId/采集轨迹重建有证据的内部 DAG。
2. 识别所有尚缺入口的入度零节点；一个区域可能有多个入口，不能只保存一个 root 字段。
3. 对入口先做显式 ID、URL、相同截图召回，再按功能区与结构 embedding 检索 Top-K 候选。
4. 候选只读展示其页面截图、控件、URL、已有路径和推荐理由；相似度不是“已验证跳转”的概率。
5. 用户一次确认入口父节点与控件；接通后重新计算全部后代可达性，内部关系不必逐条拖拽。
6. 无合理候选：继续标待探索，可单独派 HDC 回放/人工采集任务。HDC 前后页面及动作成功记录才可升级成跳转证据。
7. 确认是首页/Deep Link/通知等独立入口，调用 registerEntry 登记真实入口，不伪造普通父边。

HDC 验证属于后续执行任务，与“上传图片让模型看图”分开。模型从静态图片无法证明按钮实际到达哪个 URL。
共享子页会让区域重叠，分组和结果数量必须用 pageId 去重，不按树展开次数重复计数。

## 7. AI 必须执行，但不要让失败丢失证据

完整协议见 [AI 脚本方案](20260915-orphan-merge-ai-contract.md)。
接收的所有合法唯一图片建立资产，逐个形成 SUCCEEDED、CACHE_HIT 或 FAILED 结果；不能只处理第一张。
AI 未配置时任务进入 AI 服务不可用状态，保留上传证据，不允许悄悄当作成功自动合入。
AI 超时/限流仅影响依赖该图片的记录。其他完整、无依赖的成功区域可以继续处理。
默认生产规则：相关图片任务 SUCCEEDED/CACHE_HIT 且目标分析结构通过校验后，记录才能进入自动并入；空白、非页面或内容不明的图片待人工，不用 pageText 填充 embedding_text。

人工确认可以纠正分析结果，不等于免除识图任务。若业务将来允许应急人工豁免，应单独定义权限、原因和审计；当前要求下不提供默认跳过选项。

## 8. 数据表增量设计（待迁移）

保留 V8 的 manual_capture_jobs、manual_capture_records、manual_capture_commits，不改历史 Flyway 文件。后续用新的迁移版本新增：

| 表/对象 | 核心内容 |
| --- | --- |
| capture_assets | asset_id、app_id、sha256、storage_key、格式/尺寸/字节、校验状态 |
| capture_job_assets | job_id、包内原路径、asset_id、是否被引用；保留同图多路径来源 |
| capture_record_assets | job_id、record_id、asset_id、role(TARGET/PARENT/WIDGET)、序号 |
| capture_analysis_tasks | task_id、asset_id、role、input_fingerprint、模型/提示词版本、状态、attempt、next_retry_at、lease_token、lease_expires_at、错误 |
| capture_analysis_results | task_id、结构化结果 jsonb、原始结果受限存储、model/prompt/preprocess 版本、token/耗时、完成时间 |
| capture_record_reviews | record_id、revision、analysis_revision、人工字段、目标选择、父节点选择、理由、身份、时间 |
| capture_merge_plans | plan_id、job_id、依赖组、预检结果、graph_version、记录 revision 指纹、策略版本、过期时间 |
| capture_merge_items | request_id、record_id、page_id、edge_ids、来源 AUTO/MANUAL、可达性、失败原因 |

数据库字段遵循现有 SQL 下划线风格；HTTP/前端保持 camelCase。
真实业务字段仍是 page_instances.embedding_text；API 使用 embeddingText，并显式映射，不能改成别的含义。
URL 覆盖仍由既有 APP+精确 URL 事实表维护；图片 SHA-256 只管文件身份。

## 9. Worker、重试与容量

第一阶段可继续用 PostgreSQL 队列，不强制引入 Redis/RabbitMQ。
扩容时采用短事务 FOR UPDATE SKIP LOCKED 领取子任务，写租约后提交；AI 请求在事务之外进行。
完成写入时校验 lease_token/attempt，过期 Worker 不能覆盖新 Worker 结果。以唯一幂等键保证重复领取只产生一个有效结果。
SKIP LOCKED 适合队列消费者争抢任务，不适合把它当成一致性业务查询。[PostgreSQL SELECT 锁定说明](https://www.postgresql.org/docs/current/sql-select.html)

- AI 并发初始 2，请求超时建议 60 秒、租约 120 秒并心跳；参数以真实服务压测为准。
- 网络、429、5xx 指数退避，遵循 Retry-After，最多 3 次；校验失败和鉴权失败不能无界重试。
- 接近磁盘或队列容量上限返回 429/503，已接收任务保留。
- 进程崩溃释放租约；恢复只重跑未完成项，不覆盖已复核/已入库记录。
- 多实例共享对象存储或同一个存储卷；本机 D 盘目录不天然跨机器共享。
- 定期清理无引用临时文件；正式截图、审计引用资产不按任务过期直接删除。

## 10. 合入事务与幂等

自动并入与人工确认使用同一个 CaptureCommitService。禁止 Worker 在 AI 返回后直接 INSERT 边绕过提交校验。

事务步骤：

1. 根据 requestId 查已有提交，比较规范化内容；相同返回原结果，不同返回 409。
2. 按固定顺序锁 APP、任务、记录，检查最新 graphVersion、recordRevision、analysisRevision。
3. 验证选中记录依赖闭包、图片状态、目标身份、父节点、动作、所有拟新增边。
4. 先创建/关联目标功能页和实例，再创建全部边；共享节点复用，原图片/动作/边不丢失。
5. 数据库级禁止环与跨 APP 关系；用户选择的一组记录原子成功或回滚。
6. 落库审核后的 pageTitle、pageText、embedding_text、四层 action 及模型/人工来源，不把完整 AI 原始输出不加选择写成最终值。
7. 写图片关联、操作审计、提交结果；计算确认入口集合的可达性，更新全部受影响后代的待接入状态。
8. 页面/边/覆盖事实/审计同事务提交；事务外只允许已持久化图片的引用，不在事务里调用 AI。

自动处理按显式依赖形成的无冲突组逐组事务提交；独立组失败不回滚已完成组。
这是新方案，当前人工 commit 仍是本次选中记录整批原子事务，不能宣称已有“逐组部分成功”。
同组会形成环、存在目标合并冲突时整组转人工；自动流程发生版本冲突只重新预检，不盲目修改旧请求版本重放。

预检结果不是授权凭证，真正提交仍重复校验；模型或图谱更新后旧候选不可静默生效。
需要保存服务端最终响应的最新 graphVersion，不假设每次事务只递增 1，当前触发器可能逐行递增。

## 11. 入库、覆盖与主树的判据

| 事实 | 判定 |
| --- | --- |
| AI 完成 | 所需资产有有效结构化分析结果 |
| 页面入库 | 真实 pageId/实例存在，提交成功 |
| URL 已覆盖 | 同 APP 精确 URL 已有满足既有规则的覆盖事实 |
| 主树已接入 | 从 graph_entry_points 的确认入口集合可达，reachable=true |

有非空有效 embedding_text 的游离页面正式入库后可以按当前规则增加 URL 覆盖，虽然仍 unreachable；不要等并入主树才统计。
仅上传 ZIP 或暂存 AI 分析结果不增加覆盖。
同 URL 换图、补图、改父节点、重复采集，不更新 firstCoverageTime。
首次时间是后端首次满足覆盖规则入库的时间，不使用 Excel capturedAt 或模型生成时间回填。
历史事实已存在但首次时间未知时，不因补图伪造一个新的“首次”；保持既有历史标记。

前端收到“成功”后必须回查图谱与可达性；不能因文件上传完成、树上出现标题或节点有父边就认定完成使命。
撤销本次新增边不删除历史覆盖事实，也不删除原有共享路径；受后续修改影响时拒绝自动撤销，转人工处理。

## 12. API 增量清单（新增项尚未实现）

| 方法/路径，均带 /appGraph | 状态 | 用途 |
| --- | --- | --- |
| POST /captureImports | 扩展已有 | file、appName、mergePolicy、clientRequestId；AI 在服务端强制要求 |
| GET /captureImports | 已有，建议分页 | 恢复任务 |
| GET /captureImports/{jobId} | 已有保留 | 兼容现有详情 |
| GET /captureImports/{jobId}/status | 新增 | 轻量阶段与计数 |
| GET /captureImports/{jobId}/records | 新增 | 分页、按错误/复核/可达性筛选 |
| GET /captureImports/{jobId}/assets | 新增 | 所有图片、引用角色与 AI 状态 |
| POST /captureImports/{jobId}/retryAnalysis | 新增 | 指定失败 asset/task IDs；复用成功结果 |
| POST /captureImports/{jobId}/reviews | 新增 | 保存人工草稿和预期 revision |
| POST /captureImports/{jobId}/precheck | 新增 | 返回 planId、依赖组、可合入项、冲突 |
| POST /captureImports/{jobId}/commit | 扩展已有 | 接收 planId/recordRevision，沿用 requestId 幂等 |
| GET /captureImports/{jobId}/commits | 新增 | 查询自动/人工提交及单条结果，解决响应丢失 |
| POST /orphans/batchMerge | 已有需增强 | 区域补入口、真实 actionType、更新后代状态 |
| POST /orphans/registerEntry | 已有 | 真实独立入口登记，不伪造父边 |

AI 策略新后端可以继续接受 useAi 参数以兼容旧前端，但不得让 false 绕过项目强制分析规则；返回实际执行策略。
同包去重不应阻止重分析：包任务身份与分析版本分开；已有旧任务没有 AI 结果时需补任务，不因 duplicate=true 直接当作完成。

错误约定：413 大小超限，415 不支持格式，422 记录/分析结构错误，409 版本或依赖冲突，429 排队/限流，503 AI/存储暂不可用。
错误体包含 code、message、retryable、recordIds；不要把模型密钥、文件系统绝对路径和截图敏感内容写入错误响应。

## 13. 分阶段实施和验收

P0：保留 20 MiB，图片资产表/持久化 AI 任务/失败重试/状态 API；强制 AI 门禁；服务端草稿与前端分阶段进度。
P1：明确父节点自动并入、预检、按组事务、共享节点增量、后代可达性回查；形成可演示闭环。
P2：完成流式处理、代理限制、压测后提升到 100 MiB；扩容队列、SSE、向量候选与 HDC 证据验证。

必须覆盖的测试：

- 精确上限与超限、ZIP bomb、路径穿越、重复路径、伪装图片、XLSX 内部压缩攻击、磁盘不足。
- 慢网/断连/响应丢失、重复包、重启恢复、两个 Worker 同时领取、租约过期的旧结果。
- Excel 120 行引用 180 张图，每张都有任务结果；重复引用不重复收费，未引用图片不静默丢弃。
- AI 不可用/超时/输出非法 JSON/空 embedding_text，只阻断相关组，不伪造完成。
- A→B→C 合入；未知 B→C 区域保留；补一次 A→B 后 C 自动变为可达。
- A→B→D 与 A→H→D 共享目标不丢原边；返回边形成环必须拒绝。
- 仅父 URL、多个候选、显式父字段冲突、目标已删除、并发改图、同包前序漏选。
- 自动结果可审计；同 requestId 重放不重复写；撤销只影响该批新边。
- 同 URL 换图首次覆盖不变；游离入库增加覆盖与接通主树分别展示；历史日报不回写。

交付前需由后端、脚本、前端三方使用真实服务联调。Mock 演示不能替代多模态质量、慢网与生产资源测试。
