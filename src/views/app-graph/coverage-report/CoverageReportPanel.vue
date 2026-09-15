<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { requestError } from '../shared/api.config';
import { queryDailyReports, requestGenerateDailyReport } from './coverageReport.api';
import CoverageTrend from './CoverageTrend.vue';

const props = defineProps<{ active: boolean }>();
const emit = defineEmits(['locate']);
const busy = ref(false), error = ref('');
const reports = ref<any[]>([]), report = ref<any>(null);

const group = ref('ALL'), details = ref<any>(null), detailType = ref('ALL'), urlSearch = ref('');

const now = new Date(Date.now() + 8 * 3600000);
const defaultDate = new Date(now.getTime() - (now.getUTCHours() < 8 ? 86400000 : 0));
const date = ref(defaultDate.toISOString().slice(0, 10));
const reportType = ref(now.getUTCHours() >= 8 && now.getUTCHours() < 20 ? 'MORNING' : 'EVENING');
const appRows = computed(() => (report.value?.apps || []).filter((a: any) => group.value === 'ALL' || a.appGroups.includes(group.value)));

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

async function run(task: () => Promise<void>) {
  if (busy.value) return; busy.value = true; error.value = '';
  try { await task(); } catch (e) { error.value = requestError(e); message.error(error.value); } finally { busy.value = false; }
}

async function refresh() {
  await run(async () => { reports.value = await queryDailyReports(); report.value ||= reports.value[0] || null; });
}
async function generate() {
  await run(async () => { report.value = await requestGenerateDailyReport( { requestId: crypto.randomUUID(), date: date.value, reportType: reportType.value }); reports.value = await queryDailyReports(); message.success('日报已生成'); });
}

function locate(appName: string, pageId: string) { details.value = null; emit('locate', { appName, pageId }); }
function exportHtml() {
  if (!report.value) return;
  const escape = (value: any) => String(value ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const rows = appRows.value.map((a: any) => `<tr><td>${escape(a.appName)}</td><td>${a.newUrlCount}</td><td>${a.nodeCount}</td><td>${baselineCovered(a)}</td><td>${escape(a.totalUrlCount)}</td><td>${percent(Math.min(baselineCovered(a), a.totalUrlCount), a.totalUrlCount)}</td></tr>`).join('');
  const urls = appRows.value.map((a: any) => `<details><summary>${escape(a.appName)} URL 明细</summary><ul>${a.urls.map((u: any) => `<li>${escape(u.pageUrl)} · ${u.covered ? '已覆盖' : '未覆盖'} · ${escape(u.firstCoverageTime)}</li>`).join('')}</ul></details>`).join('');
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>知识图谱建设日报</title><style>body{font:14px system-ui;margin:24px;color:#172033;background:#f5f7fa}table{width:100%;border-collapse:collapse;background:white}td,th{text-align:left;padding:12px;border-bottom:1px solid #ddd}details{padding:16px;background:white;margin-top:12px}li{overflow-wrap:anywhere}</style><h1>知识图谱建设日报 ${escape(report.value.date)}</h1><p>生成时间 ${escape(report.value.generatedAt)} · ${escape(group.value)}</p><p>新增区间 ${escape(report.value.periodStart)} 至 ${escape(report.value.periodEnd)}</p><table><tr><th>APP</th><th>新增 URL</th><th>节点数</th><th>基线已覆盖</th><th>基线 URL</th><th>覆盖率</th></tr>${rows}</table>${urls}</html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), link = document.createElement('a'); link.href = url; link.download = `图谱日报-${report.value.date}.html`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

watch(() => props.active, active => { if (active) refresh(); }, { immediate: true });
defineExpose({ refresh, busy });
</script>
<template>
  <div class="governance-workspace">
    <a-alert v-if="error" :message="error" type="error" show-icon />

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
  </div>
  <a-drawer :open="!!details" :title="`${details?.appName||''} URL 明细`" width="85vw" @close="details=null">
    <div class="gov-toolbar"><a-segmented v-model:value="detailType" :options="[{value:'ALL',label:'全部'},{value:'NEW',label:'本期新增'},{value:'PRIORITY',label:'高频 URL'},{value:'GAP',label:'高频缺口'}]" /><a-input-search v-model:value="urlSearch" placeholder="搜索 URL" style="max-width:350px" /></div>
    <a-table :data-source="detailRows" row-key="pageUrl" :pagination="{pageSize:20}" :scroll="{x:800}" :columns="[{title:'URL',dataIndex:'pageUrl',ellipsis:true},{title:'覆盖',key:'covered',width:90},{title:'首次覆盖时间',dataIndex:'firstCoverageTime',width:240},{title:'图谱定位',key:'locate',width:210}]">
      <template #bodyCell="{column,record}"><a-tag v-if="column.key==='covered'" :color="record.covered?'blue':'default'">{{ record.covered?'已覆盖':'未覆盖' }}</a-tag><template v-else-if="column.key==='locate'"><a-button v-for="id in record.pageIds" :key="id" type="link" size="small" @click="locate(details.appName,id)">定位 {{ record.pageIds.length>1?id:'' }}</a-button><span v-if="!record.pageIds.length">无当前节点</span></template></template>
    </a-table>
  </a-drawer>

</template>
<style scoped>
.governance-workspace{display:flex;flex-direction:column;gap:18px;min-width:0;color:#172033}.gov-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.gov-meta{color:#687489;margin:0;font-size:12px}.gov-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:20px;border-block:1px solid #edf0f4;padding:22px 0}.gov-parent{width:340px;max-width:100%}.gov-page{display:flex;gap:10px;align-items:flex-start}.gov-page img{width:38px;height:78px;object-fit:contain}.gov-page div{min-width:0}.gov-page p{font-size:12px;color:#687489;overflow-wrap:anywhere;margin:4px 0}.gov-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}input[type=date]{border:1px solid #d9d9d9;border-radius:6px;padding:5px 10px}@media(max-width:800px){.gov-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.gov-form-grid{grid-template-columns:1fr}}
</style>
