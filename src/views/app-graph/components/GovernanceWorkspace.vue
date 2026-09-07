<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Modal, message } from 'ant-design-vue';
import Icon from '@/components/Icon/Icon.vue';
import { governanceRequest as api, governanceMock, requestError } from '../governance.api';
import { buildImageApiUrl } from '../info.api';
import CoverageTrend from './CoverageTrend.vue';

const props = defineProps<{ appName: string }>();
const emit = defineEmits(['changed', 'locate']);
const open = ref(false), tab = ref('daily'), busy = ref(false), error = ref('');
const reports = ref<any[]>([]), report = ref<any>(null);
const workbench = ref<any>({ entries: [], nodes: [], graphVersion: 0 }), selected = ref<string[]>([]), lastBatch = ref('');
const parents = ref<Record<string, string>>({}), widgets = ref<Record<string, string>>({}), batchParent = ref<string>();
const group = ref('ALL'), details = ref<any>(null), detailType = ref('ALL'), urlSearch = ref('');
const entryOpen = ref(false), entryPage = ref<any>(null), entryKind = ref('PENDING'), entryEvidence = ref('');
const now = new Date(Date.now() + 8 * 3600000);
const defaultDate = new Date(now.getTime() - (now.getUTCHours() < 8 ? 86400000 : 0));
const date = ref(defaultDate.toISOString().slice(0, 10));
const reportType = ref(now.getUTCHours() >= 8 && now.getUTCHours() < 20 ? 'MORNING' : 'EVENING');
const appRows = computed(() => (report.value?.apps || []).filter((a: any) => group.value === 'ALL' || a.appGroups.includes(group.value)));
const parentOptions = computed(() => workbench.value.nodes.filter((n: any) => n.reachable).map((n: any) => ({ label: `${n.pageTitle} · ${n.pageUrl}`, value: n.pageId })));
const percent = (n: number, d: number) => d > 0 ? `${(n / d * 100).toFixed(2)}%` : '—';
const baselineCovered = (app: any) => app.baselineCoveredCount ?? app.coveredUrlCount;
const summary = computed(() => {
  const valid = appRows.value.filter((a: any) => a.totalUrlCount > 0), nonzero = valid.filter((a: any) => baselineCovered(a) > 0);
  const sum = (items: any[], field: string) => items.reduce((s, a) => s + Number(a[field] || 0), 0);
  const ratio = (items: any[]) => percent(items.reduce((s, a) => s + Math.min(baselineCovered(a), a.totalUrlCount), 0), sum(items, 'totalUrlCount'));
  return [ ['新增 URL', sum(appRows.value, 'newUrlCount')], ['涉及 APP', appRows.value.filter((a: any) => a.newUrlCount > 0).length], ['高频覆盖率', percent(sum(appRows.value, 'priorityCoveredCount'), sum(appRows.value, 'priorityUrlCount'))], ['全量覆盖率', ratio(valid)], ['全量覆盖率（去 0）', ratio(nonzero)] ];
});
const detailRows = computed(() => (details.value?.urls || []).filter((u: any) => (!urlSearch.value || u.pageUrl.includes(urlSearch.value)) && (detailType.value === 'ALL' || detailType.value === 'NEW' && u.isNew || detailType.value === 'PRIORITY' && u.priority || detailType.value === 'GAP' && u.priority && !u.covered)));
const columns = [
  { title: 'APP 名称', key: 'appName', dataIndex: 'appName', width: 130, fixed: 'left' },
  { title: '节点数', dataIndex: 'nodeCount', width: 85 }, { title: '基线 URL', dataIndex: 'totalUrlCount', key: 'total', width: 100 },
  { title: '游离 URL', dataIndex: 'orphanUrlCount', width: 95 }, { title: '基线已覆盖', key: 'covered', width: 110 },
  { title: '全量覆盖率', key: 'rate', width: 110 }, { title: '高频 URL', dataIndex: 'priorityUrlCount', width: 100 },
  { title: '已覆盖高频', dataIndex: 'priorityCoveredCount', width: 110 }, { title: '高频覆盖率', key: 'priorityRate', width: 110 },
  { title: '三方功能数', key: 'functions', width: 100 }, { title: '特殊说明', dataIndex: 'specialNote', width: 190, ellipsis: true },
];
const entryColumns = [{ title: '待接入区域', key: 'page', width: 270 }, { title: '可达成员', key: 'members', width: 85 }, { title: '父节点', key: 'parent', width: 300 }, { title: '进入控件', key: 'widget', width: 180 }, { title: '处理', key: 'action', width: 180 }];
async function run(task: () => Promise<void>) {
  if (busy.value) return; busy.value = true; error.value = '';
  try { await task(); } catch (e) { error.value = requestError(e); message.error(error.value); } finally { busy.value = false; }
}
async function reloadWorkbench() {
  if (!props.appName) return;
  workbench.value = await api('/orphans/workbench', { appName: props.appName });
  selected.value = [];
}
async function refresh() {
  await run(async () => { reports.value = await api('/reports/daily'); report.value ||= reports.value[0] || null; await reloadWorkbench(); });
}
function launch(mode: string) { tab.value = mode; open.value = true; refresh(); }
watch(() => props.appName, () => { parents.value = {}; widgets.value = {}; lastBatch.value = ''; if (open.value) run(reloadWorkbench); });
async function generate() {
  await run(async () => { report.value = await api('/reports/generate', { requestId: crypto.randomUUID(), date: date.value, reportType: reportType.value }, 'post'); reports.value = await api('/reports/daily'); message.success('日报已生成'); });
}
function assignParent() { if (batchParent.value) selected.value.forEach(id => parents.value[id] = batchParent.value!); }
function merge() {
  const items = selected.value.map(pageId => ({ pageId, newParentId: parents.value[pageId], widgetDescription: widgets.value[pageId] }));
  if (!items.length || items.some(i => !i.newParentId || !i.widgetDescription?.trim())) { message.warning('请为选中区域指定父节点和真实进入控件'); return; }
  Modal.confirm({ title: `确认并入 ${items.length} 个入口？`, content: '将保留区域内部关系。任一校验失败时整批不写入。', onOk: () => run(async () => {
    const result = await api('/orphans/batchMerge', { requestId: crypto.randomUUID(), appName: props.appName, graphVersion: workbench.value.graphVersion, items }, 'post');
    lastBatch.value = result.batchId; await reloadWorkbench();
    if (items.some(i => !workbench.value.nodes.find((n: any) => n.pageId === i.pageId)?.reachable)) throw new Error('后台写入完成，但可达性回查失败，请刷新核对');
    emit('changed'); message.success('已并入并通过结构回查');
  }) });
}
function rollback() { Modal.confirm({ title: '撤销最近一次批量并入？', onOk: () => run(async () => { await api('/orphans/rollbackBatch', { appName: props.appName, batchId: lastBatch.value, graphVersion: workbench.value.graphVersion }, 'post'); lastBatch.value = ''; await reloadWorkbench(); emit('changed'); message.success('已撤销'); }) }); }
function showEntry(row: any) { entryPage.value = row; entryKind.value = 'PENDING'; entryEvidence.value = row.pendingReason || ''; entryOpen.value = true; }
async function saveEntry() {
  await run(async () => {
    await api(`/orphans/${entryKind.value === 'PENDING' ? 'createProvisionalEntry' : 'registerEntry'}`, { appName: props.appName, pageId: entryPage.value.pageId, graphVersion: workbench.value.graphVersion, reason: entryEvidence.value, evidence: entryEvidence.value, entryKind: entryKind.value }, 'post');
    entryOpen.value = false; await reloadWorkbench(); emit('changed'); message.success('入口状态已保存');
  });
}
function locate(appName: string, pageId: string) { open.value = false; details.value = null; emit('locate', { appName, pageId }); }
function exportHtml() {
  if (!report.value) return;
  const escape = (value: any) => String(value ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const rows = appRows.value.map((a: any) => `<tr><td>${escape(a.appName)}</td><td>${a.newUrlCount}</td><td>${a.nodeCount}</td><td>${baselineCovered(a)}</td><td>${escape(a.totalUrlCount)}</td><td>${percent(Math.min(baselineCovered(a), a.totalUrlCount), a.totalUrlCount)}</td></tr>`).join('');
  const urls = appRows.value.map((a: any) => `<details><summary>${escape(a.appName)} URL 明细</summary><ul>${a.urls.map((u: any) => `<li>${escape(u.pageUrl)} · ${u.covered ? '已覆盖' : '未覆盖'} · ${escape(u.firstCoverageTime)}</li>`).join('')}</ul></details>`).join('');
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>知识图谱建设日报</title><style>body{font:14px system-ui;margin:24px;color:#172033;background:#f5f7fa}table{width:100%;border-collapse:collapse;background:white}td,th{text-align:left;padding:12px;border-bottom:1px solid #ddd}details{padding:16px;background:white;margin-top:12px}li{overflow-wrap:anywhere}</style><h1>知识图谱建设日报 ${escape(report.value.date)}</h1><p>生成时间 ${escape(report.value.generatedAt)} · ${escape(group.value)}</p><p>新增区间 ${escape(report.value.periodStart)} 至 ${escape(report.value.periodEnd)}</p><table><tr><th>APP</th><th>新增 URL</th><th>节点数</th><th>基线已覆盖</th><th>基线 URL</th><th>覆盖率</th></tr>${rows}</table>${urls}</html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), link = document.createElement('a'); link.href = url; link.download = `图谱日报-${report.value.date}.html`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>

<template>
  <a-space size="small">
    <a-button size="small" @click="launch('orphans')"><Icon icon="ant-design:branches-outlined" /> 批量并入</a-button>
    <a-button size="small" @click="launch('daily')"><Icon icon="ant-design:bar-chart-outlined" /> 建设日报</a-button>
  </a-space>
  <a-drawer v-model:open="open" title="图谱建设" width="96vw" :destroy-on-close="true">
    <div class="governance-workspace">
      <div class="gov-toolbar"><a-segmented v-model:value="tab" :options="[{value:'daily',label:'建设日报'},{value:'orphans',label:'游离区域'}]" /><a-tag v-if="governanceMock" color="gold">演示数据</a-tag><a-button :loading="busy" @click="refresh">刷新</a-button></div>
      <a-alert v-if="error" :message="error" type="error" show-icon />
      <template v-if="tab === 'daily'">
        <div class="gov-toolbar">
          <input v-model="date" type="date" aria-label="报告日期" />
          <a-segmented v-model:value="reportType" :options="[{value:'MORNING',label:'早报'},{value:'EVENING',label:'晚报'}]" />
          <a-button type="primary" :loading="busy" @click="generate">生成日报</a-button>
          <a-button :disabled="!report" @click="exportHtml">导出 HTML</a-button>
          <a-select :value="report?.reportId" placeholder="历史报告" style="min-width:240px" :options="reports.map(r=>({value:r.reportId,label:`${r.date} ${r.reportType==='MORNING'?'早报':'晚报'}`}))" @change="(id:string)=>report=reports.find(r=>r.reportId===id)" />
          <a-segmented v-model:value="group" :options="[{value:'ALL',label:'全部'},{value:'TOP',label:'TOP'},{value:'TGI',label:'TGI'}]" />
        </div>
        <p class="gov-meta">项目 URL 基线<template v-if="report"> · 生成于 {{ new Date(report.generatedAt).toLocaleString() }}</template></p>
        <template v-if="report">
          <div class="gov-stats"><a-statistic v-for="[label,value] in summary" :key="label" :title="label" :value="value" /></div>
          <CoverageTrend :reports="reports" :group="group" />
          <a-table :columns="columns as any" :data-source="appRows" row-key="appName" :scroll="{x:1230}" size="small" :pagination="{pageSize:15}">
            <template #bodyCell="{column,record}">
              <a-button v-if="column.key==='appName'" type="link" @click="details=record;detailType='ALL';urlSearch=''">{{ record.appName }}</a-button>
              <template v-else-if="column.key==='total'">{{ record.totalUrlCount ?? '未配置' }}</template>
              <template v-else-if="column.key==='covered'">{{ baselineCovered(record) }}</template>
              <template v-else-if="column.key==='rate'">{{ percent(Math.min(baselineCovered(record),record.totalUrlCount),record.totalUrlCount) }}</template>
              <template v-else-if="column.key==='priorityRate'">{{ percent(record.priorityCoveredCount,record.priorityUrlCount) }}</template>
              <template v-else-if="column.key==='functions'">{{ record.functionCount ?? '未查询' }}</template>
            </template>
          </a-table>
        </template><a-empty v-else description="尚未生成日报" />
      </template>
      <template v-else>
        <p>{{ appName }} · {{ workbench.unresolvedCount || 0 }} 个节点待接入 · 图版本 {{ workbench.graphVersion }}</p>
        <a-alert v-if="workbench.unrepresentedCount" type="warning" message="部分节点没有可识别的无环入口，请检查历史结构" show-icon />
        <div class="gov-toolbar"><a-select v-model:value="batchParent" show-search option-filter-prop="label" placeholder="为选中区域统一指定父节点" :options="parentOptions" class="gov-parent" /><a-button :disabled="!selected.length||!batchParent" @click="assignParent">批量指派</a-button><a-button type="primary" :disabled="!selected.length" :loading="busy" @click="merge">确认并入 {{ selected.length || '' }}</a-button><a-button :disabled="!lastBatch||busy" @click="rollback">撤销最近批次</a-button></div>
        <a-table :columns="entryColumns" :data-source="workbench.entries" row-key="pageId" :loading="busy" :scroll="{x:1100}" size="small" :pagination="{pageSize:15}" :row-selection="{ selectedRowKeys:selected, onChange:(keys:any)=>selected=keys }">
          <template #bodyCell="{column,record}">
            <div v-if="column.key==='page'" class="gov-page"><img v-if="record.images?.[0]" :src="buildImageApiUrl(record.images[0])" alt="页面截图" /><div><strong>{{ record.pageTitle }}</strong><p>{{ record.pageUrl }}</p><a-tag v-if="record.pendingReason" color="orange">入口待确认</a-tag></div></div>
            <template v-else-if="column.key==='members'">{{ record.memberPageIds.length }}</template>
            <div v-else-if="column.key==='parent'"><a-select v-model:value="parents[record.pageId]" show-search option-filter-prop="label" placeholder="搜索已接入页面" :options="parentOptions" style="width:100%" /><a-button v-for="c in record.candidates" :key="c.parentPageId" type="link" size="small" @click="parents[record.pageId]=c.parentPageId">前序建议：{{ c.parentTitle }}</a-button></div>
            <a-input v-else-if="column.key==='widget'" v-model:value="widgets[record.pageId]" placeholder="实际点击的入口控件" />
            <a-space v-else-if="column.key==='action'"><a-button size="small" @click="showEntry(record)">入口归类</a-button><a-button type="link" size="small" @click="locate(appName,record.pageId)">定位</a-button></a-space>
          </template>
        </a-table>
      </template>
    </div>
  </a-drawer>
  <a-drawer :open="!!details" :title="`${details?.appName||''} URL 明细`" width="85vw" @close="details=null">
    <div class="gov-toolbar"><a-segmented v-model:value="detailType" :options="[{value:'ALL',label:'全部'},{value:'NEW',label:'本期新增'},{value:'PRIORITY',label:'高频 URL'},{value:'GAP',label:'高频缺口'}]" /><a-input-search v-model:value="urlSearch" placeholder="搜索 URL" style="max-width:350px" /></div>
    <a-table :data-source="detailRows" row-key="pageUrl" :pagination="{pageSize:20}" :scroll="{x:800}" :columns="[{title:'URL',dataIndex:'pageUrl',ellipsis:true},{title:'覆盖',key:'covered',width:90},{title:'首次覆盖时间',dataIndex:'firstCoverageTime',width:240},{title:'图谱定位',key:'locate',width:210}]">
      <template #bodyCell="{column,record}"><a-tag v-if="column.key==='covered'" :color="record.covered?'blue':'default'">{{ record.covered?'已覆盖':'未覆盖' }}</a-tag><template v-else-if="column.key==='locate'"><a-button v-for="id in record.pageIds" :key="id" type="link" size="small" @click="locate(details.appName,id)">定位 {{ record.pageIds.length>1?id:'' }}</a-button><span v-if="!record.pageIds.length">无当前节点</span></template></template>
    </a-table>
  </a-drawer>
  <a-modal v-model:open="entryOpen" :title="entryPage?.pageTitle" :confirm-loading="busy" ok-text="保存" @ok="saveEntry">
    <a-form layout="vertical"><a-form-item label="入口类型"><a-select v-model:value="entryKind" :options="[{value:'PENDING',label:'尚未找到入口'},{value:'APP_HOME',label:'确认是应用启动页'},{value:'DEEPLINK',label:'Deep Link'},{value:'NOTIFICATION',label:'通知入口'},{value:'SYSTEM_INTENT',label:'系统 Intent'},{value:'EXTERNAL_APP',label:'其他应用唤起'}]" /></a-form-item><a-form-item :label="entryKind==='PENDING'?'待确认原因':'真实入口证据'" required><a-textarea v-model:value="entryEvidence" :rows="4" /></a-form-item></a-form>
  </a-modal>
</template>
<style scoped>
.governance-workspace{display:flex;flex-direction:column;gap:18px;min-width:0;color:#172033}.gov-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.gov-meta{color:#687489;margin:0;font-size:12px}.gov-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:20px;border-block:1px solid #edf0f4;padding:22px 0}.gov-parent{width:340px;max-width:100%}.gov-page{display:flex;gap:10px;align-items:flex-start}.gov-page img{width:38px;height:78px;object-fit:contain}.gov-page div{min-width:0}.gov-page p{font-size:12px;color:#687489;overflow-wrap:anywhere;margin:4px 0}.gov-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}input[type=date]{border:1px solid #d9d9d9;border-radius:6px;padding:5px 10px}@media(max-width:800px){.gov-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.gov-form-grid{grid-template-columns:1fr}}
</style>
