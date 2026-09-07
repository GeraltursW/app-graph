# 项目 URL 基线：无版本维护方案

日期：2026-09-07

## 业务约定

整个部署维护一份当前项目基线，不存在 APP 版本、基线版本选择或发布流程。基线属于项目，不属于某次早报或晚报。当前未引入多项目隔离。

Excel 首行包含两列：

| APP名称 | URL |
| --- | --- |
| QQ | mqq://example/home |
| QQ | mqq://example/message |
| 抖音 | snssdk1128://example/home |

示例 URL 仅说明格式，不代表真实可执行入口。

- APP名称和 URL 都必填。支持同一 Excel 包含多个 APP。
- 首次导入建立清单，之后导入和手动补充都只追加，不覆盖原清单。
- 按去除首尾空白后的 APP名称 + URL 精确去重；同一 URL 在不同 APP 下分别计数。
- 不忽略大小写，不移除查询参数，不猜测 APP 别名。Excel 的 APP名称应与图谱中的名称一致。
- 尚未建图的 APP 可以进入基线，显示为待覆盖，不自动创建图谱节点。
- 分组 TOP/TGI、特殊说明、高频标记在页面维护，不要求增加 Excel 列。

## 前端交互

顶部“项目基线”入口打开项目 URL 基线面板；日报中的同名按钮打开同一入口。

1. 导入 Excel，浏览器在 Web Worker 中解析。
2. 预览 APP名称、URL、文件内重复数量和无效行。
3. 有无效行时禁止提交，修正文件后重新导入。
4. 点击确认入库，后台再次校验并返回新增/重复数量。
5. 可随时通过“补充 URL”输入 APP名称和多行 URL，或再次导入 Excel。
6. 按 APP 查看分页 URL 清单，搜索 URL、标记高频、维护分组说明。

导入当前支持 .xlsx，最大 5 MiB、50000 条非空数据行；旧版 .xls 需另存为 .xlsx。所有非空工作表第一行都必须有表头。兼容“应用名称”/appName 和 pageUrl 表头。支持文字、富文本、超链接地址，不执行公式，拒绝公式和数字等非文本单元格。缺失 APP名称不会自动沿用上一行。

解析超时 45 秒终止 Worker。文件大小限制不能完全防御高压缩比恶意文件，仍应只导入可信 Excel；多用户开放部署时可进一步加入隔离解析与解压配额。

当前前端发送解析后的 JSON，不向后台上传原始 Excel 文件。原始 Excel 不是运行时数据源，不需要持续同步本地文件。

## 后台接口

全部使用 /appGraph 前缀；请求、响应均为驼峰字段，无版本参数。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | /appGraph/baseline/overview | APP 清单、基线总数及当前覆盖统计 |
| GET | /appGraph/baseline/urls | 按 appName、keyword、page、pageSize 查询 URL |
| POST | /appGraph/baseline/append | 原子追加 URL，幂等重试 |
| POST | /appGraph/baseline/settings | 维护 appName、appGroups、specialNote |
| POST | /appGraph/baseline/priority | 维护 appName、pageUrl、priority |
| GET | /appGraph/reports/baselines/current | 兼容日报调用，返回当前基线，无版本 |

追加请求：

```json
{
  "requestId": "5a4ef9e4-8418-4289-8f1a-bd7e5302ebec",
  "source": "应用URL清单.xlsx",
  "rows": [
    { "appName": "QQ", "pageUrl": "mqq://example/home" }
  ]
}
```

返回 requestId、receivedCount、addedCount、duplicateCount。前端预览已去除文件内重复，因此提示中的重复总量是本地去重数加后台 duplicateCount。

后台校验每批 1 至 50000 行，APP名称不超过 255 字符，URL 不超过 16000 字符，来源不超过 512 字符。无效数据整批拒绝。相同 requestId 与相同内容重试返回首次结果；同一 requestId 携带不同内容返回 409。唯一约束与事务保证重复追加不增加记录。前端失败重试保留 requestId。

## 存储与覆盖口径

- project_baseline_apps：APP名称、分组、特殊说明。
- project_baseline_urls：APP名称、URL、URL SHA-256、高频标记、来源、首次加入时间。
- project_baseline_imports：请求 ID、内容摘要、来源、处理结果，用于幂等和审计，不是版本表。

当前已覆盖依据延续项目实际规则：相同 APP 下存在相同 URL，且 embedding_text 非空。基线导入本身不创建页面、边、首次覆盖事实，也不更新 firstCoverageTime。

覆盖率 = 基线 URL 与当前已覆盖 URL 的交集数量 / 基线 URL 数量。

图谱存在但不在基线中的 URL 不增加此分子，不能用图谱总数除以基线总数后截断到 100%。同 URL 从截图 A 换到 B，不重置首次覆盖时间。

“项目基线”展示查询时的当前状态，操作后自动刷新，也可手动刷新；没有实现 WebSocket 实时推送。日报保存生成时的快照，后续补充 URL 不反写历史报告。新报告增加 baselineCoveredCount，保留 coveredUrlCount 表示全部图谱覆盖数量。

## 部署与兼容

Java 后台通过 Flyway V7__project_url_baseline.sql 新建项目级表，并允许新日报不关联旧 baseline_revision。旧版本表与历史报告保留用于历史数据，不再提供发布接口；旧 POST /reports/baselines/publish 已移除。

旧基线中的汇总数字不能还原完整 URL 清单，因此不自动迁移为新基线。上线后请导入真实两列 Excel，再生成新日报；没有基线时不生成新报告。已存在历史报告保持不变，旧统计字段仅用于兼容展示。

本次在独立 PostgreSQL 测试库验证迁移，没有修改用户正式 5432 数据库。前端 Mock 仅用于演示，数据保存在内存，刷新浏览器后重置；真实持久化依赖 Java 后台和 PostgreSQL。

## 验证与边界

已验证：前端类型检查、生产构建、9 项前端测试；Java 打包及 13 项测试（含 8 项数据库集成测试）；真实 HTTP 追加、幂等重试、查询；浏览器手动补充、预览、去重、未知 APP 待覆盖展示。

Excel 解析已通过真实 XLSX 二进制往返测试，尚未通过浏览器文件选择器完整验收上传 Worker 链路，应在交付环境使用真实 Excel 再做一次验收。

后续可补充 APP 别名映射、异常清单导出、追加审计查询、WebSocket 刷新和多项目隔离。当前不提供基线 URL 删除或整批替换，避免隐式缩小覆盖目标。

## 批量设置高频 URL

项目基线工具栏新增“批量设置高频 URL”。选定一个已有基线 APP，粘贴多行 URL，每行一条，确认后批量标为高频。空行忽略、首尾空白去除、重复 URL 合并，每次最多 5000 条非空输入。

仅标记所选 APP 内已经存在的基线 URL，不影响其他 APP，也不取消未输入 URL 的原有高频状态。未匹配 URL 不自动创建，结果弹窗逐条列出，方便纠正或先通过“补充 URL”入库。APP 清单增加高频 URL 数量，保存后刷新清单。

接口：POST /appGraph/baseline/priorityBatch

```json
{
  "appName": "QQ",
  "pageUrls": ["mqq://example/home", "mqq://example/message"]
}
```

返回 appName、receivedCount（输入条数）、duplicateCount（重复条数）、matchedCount（匹配去重条数）、updatedCount（新增高频）、alreadyPriorityCount（原已高频）、missingUrls（未匹配列表）。有效但未匹配的 URL 不阻止其他匹配项更新；格式无效则整批拒绝。

真实后台在事务中按稳定顺序锁定匹配行，再更新该集合，避免并发状态更新导致统计不一致。重复提交自然幂等：已标记项计入 alreadyPriorityCount，不重复产生记录。操作不修改覆盖事实、firstCoverageTime 或历史日报，新日报读取最新高频标记。

验证：多行输入、空行和首尾空白、重复 URL、已标记 URL 重试、未匹配清单、APP 隔离及无效输入不产生部分写入均有测试覆盖。浏览器 Mock 操作验收通过，Java PostgreSQL 集成测试通过。

