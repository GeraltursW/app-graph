<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { message } from 'ant-design-vue';
import Icon from '@/components/Icon/Icon.vue';
import { governanceRequest as api, governanceMock, requestError } from '../governance.api';
import { validateBaselineRows, validatePriorityUrls } from '../data/projectBaseline';

const open = ref(false), busy = ref(false), parsing = ref(false), error = ref('');
const overview = ref<any>({ apps: [], appCount: 0, urlCount: 0, coveredUrlCount: 0 });
const appName = ref(''), appSearch = ref(''), keyword = ref(''), page = ref(1);
const urlRows = ref<any[]>([]), total = ref(0), rowsLoading = ref(false);
const manualOpen = ref(false), manualApp = ref(''), manualUrls = ref('');
const preview = ref<any>(null), pending = ref<any>(null), settings = ref<any>(null);
const priorityOpen = ref(false), priorityApp = ref(''), priorityText = ref(''), priorityResult = ref<any>(null);
let worker: Worker | undefined, parseTimer: ReturnType<typeof setTimeout> | undefined, requestSequence = 0;
const appRows = computed(() => overview.value.apps.filter((a: any) => a.appName.toLowerCase().includes(appSearch.value.toLowerCase())));
const rate = (n: number, d: number) => d ? `${(n / d * 100).toFixed(2)}%` : '—';
const appColumns = [
  { title: 'APP名称', dataIndex: 'appName', key: 'app', width: 170 },
  { title: '基线 URL', dataIndex: 'totalUrlCount', width: 100 },
  { title: '已覆盖', dataIndex: 'coveredUrlCount', width: 90 },
  { title: '高频 URL', dataIndex: 'priorityUrlCount', width: 100 },
  { title: '覆盖率', key: 'rate', width: 100 },
  { title: '分组', key: 'groups', width: 130 },
  { title: '设置', key: 'settings', width: 65 },
];
const urlColumns = [
  { title: 'URL', dataIndex: 'pageUrl', key: 'url', width: 350 },
  { title: '覆盖状态', key: 'covered', width: 100 },
  { title: '高频', key: 'priority', width: 75 },
  { title: '来源', dataIndex: 'source', ellipsis: true, width: 180 },
  { title: '补充时间', dataIndex: 'addedAt', width: 210 },
];
async function run(task: () => Promise<void>) {
  if (busy.value || parsing.value) return;
  busy.value = true; error.value = '';
  try { await task(); } catch (e) { error.value = requestError(e); message.error(error.value); }
  finally { busy.value = false; }
}
async function loadUrls() {
  const request = ++requestSequence;
  if (!appName.value) { urlRows.value = []; total.value = 0; rowsLoading.value = false; return; }
  rowsLoading.value = true;
  try {
    const result = await api('/baseline/urls', { appName: appName.value, keyword: keyword.value, page: page.value, pageSize: 30 });
    if (request === requestSequence) { urlRows.value = result.items; total.value = result.total; }
  } catch (e) { if (request === requestSequence) { error.value = requestError(e); message.error(error.value); } }
  finally { if (request === requestSequence) rowsLoading.value = false; }
}
async function load() {
  overview.value = await api('/baseline/overview');
  if (!appName.value || !overview.value.apps.some((a: any) => a.appName === appName.value)) appName.value = overview.value.apps[0]?.appName || '';
  await loadUrls();
}
function launch() { open.value = true; run(load); }
defineExpose({ launch });
function selectApp(name: string) { appName.value = name; keyword.value = ''; page.value = 1; loadUrls(); }
function prepare(result: any, source: string) {
  preview.value = { ...result, source };
  pending.value = { requestId: crypto.randomUUID(), source, rows: result.rows };
}
function stopParser() { worker?.terminate(); worker = undefined; if (parseTimer) clearTimeout(parseTimer); parseTimer = undefined; }
async function readExcel(file: File) {
  if (busy.value || parsing.value) return false;
  if (!/\.xlsx$/i.test(file.name)) { message.error('请上传 .xlsx 文件；旧版 .xls 请另存为 .xlsx'); return false; }
  if (file.size > 5 * 1024 * 1024) { message.error('Excel 文件不能超过 5 MB'); return false; }
  parsing.value = true; error.value = '';
  try {
    const buffer = await file.arrayBuffer();
    const result = await new Promise<any>((resolve, reject) => {
      worker = new Worker(new URL('../data/baselineExcel.worker.js', import.meta.url), { type: 'module' });
      parseTimer = setTimeout(() => { stopParser(); reject(new Error('Excel 解析超时，请拆分文件')); }, 45000);
      worker.onmessage = ({ data }) => { stopParser(); data.error ? reject(new Error(data.error)) : resolve(data.result); };
      worker.onerror = () => { stopParser(); reject(new Error('Excel 解析失败，请检查文件')); };
      worker.postMessage(buffer, [buffer]);
    });
    prepare(result, file.name);
  } catch (e) { error.value = requestError(e); message.error(error.value); }
  finally { parsing.value = false; }
  return false;
}
function prepareManual() {
  try {
    const rows = manualUrls.value.split(/\r?\n/).filter(url => url.trim()).map(pageUrl => ({ appName: manualApp.value, pageUrl }));
    const result = validateBaselineRows(rows);
    if (result.errors.length) throw new Error(result.errors[0].message);
    prepare(result, '手动补充'); manualOpen.value = false;
  } catch (e) { message.error(requestError(e)); }
}
function append() {
  if (!pending.value || preview.value?.errors.length) return;
  run(async () => {
    const result = await api('/baseline/append', pending.value, 'post');
    const duplicates = result.duplicateCount + preview.value.duplicates;
    appName.value = pending.value.rows[0].appName; page.value = 1; keyword.value = '';
    pending.value = null; preview.value = null;
    message.success(`新增 ${result.addedCount} 条，跳过 ${duplicates} 条重复 URL`);
    await load();
  });
}
function saveSettings() {
  run(async () => { await api('/baseline/settings', settings.value, 'post'); settings.value = null; await load(); message.success('已保存'); });
}
function changePriority(row: any, priority: boolean) {
  run(async () => { await api('/baseline/priority', { appName: row.appName, pageUrl: row.pageUrl, priority }, 'post'); await load(); });
}
function openPriorityBatch() {
  priorityApp.value = appName.value;
  priorityText.value = ''; priorityResult.value = null; priorityOpen.value = true;
}
function savePriorityBatch() {
  run(async () => {
    if (!priorityApp.value) throw new Error('请选择 APP');
    const pageUrls = priorityText.value.split(/\r?\n/).filter(url => url.trim());
    validatePriorityUrls(pageUrls);
    priorityResult.value = await api('/baseline/priorityBatch', { appName: priorityApp.value, pageUrls }, 'post');
    appName.value = priorityApp.value; page.value = 1; keyword.value = '';
    const result = priorityResult.value;
    if (result.missingUrls.length) message.warning(`已新增 ${result.updatedCount} 条高频 URL，${result.missingUrls.length} 条未匹配`);
    else message.success(`已新增 ${result.updatedCount} 条高频 URL，原已高频 ${result.alreadyPriorityCount} 条`);
    await load();
  });
}
onBeforeUnmount(stopParser);
</script>

<template>
  <a-button size="small" @click="launch"><Icon icon="ant-design:database-outlined" /> 项目基线</a-button>
  <a-drawer v-model:open="open" title="项目 URL 基线" width="96vw" :mask-closable="!busy && !parsing" :closable="!busy && !parsing" :keyboard="!busy && !parsing">
    <div class="baseline-workspace">
      <div class="baseline-toolbar">
        <a-upload accept=".xlsx" :before-upload="readExcel" :show-upload-list="false" :disabled="busy || parsing">
          <a-button type="primary" :loading="parsing" :disabled="busy"><Icon icon="ant-design:upload-outlined" /> 导入 Excel</a-button>
        </a-upload>
        <a-button :disabled="busy || parsing" @click="manualApp=appName;manualUrls='';manualOpen=true"><Icon icon="ant-design:plus-outlined" /> 补充 URL</a-button>
        <a-button :disabled="busy || parsing || !overview.apps.length" @click="openPriorityBatch"><Icon icon="ant-design:thunderbolt-outlined" /> 批量设置高频 URL</a-button>
        <a-button :loading="busy" :disabled="parsing" @click="run(load)"><Icon icon="ant-design:reload-outlined" /> 刷新</a-button>
        <a-tag v-if="governanceMock" color="gold">演示数据</a-tag>
      </div>
      <a-alert v-if="error" type="error" :message="error" show-icon />
      <div class="baseline-stats">
        <a-statistic title="APP" :value="overview.appCount" />
        <a-statistic title="基线 URL" :value="overview.urlCount" />
        <a-statistic title="已覆盖 URL" :value="overview.coveredUrlCount" />
        <a-statistic title="覆盖率" :value="rate(overview.coveredUrlCount,overview.urlCount)" />
      </div>
      <section>
        <div class="baseline-section-head"><h3>应用清单</h3><a-input-search v-model:value="appSearch" placeholder="搜索 APP名称" style="max-width:280px" /></div>
        <a-table :data-source="appRows" :columns="appColumns" row-key="appName" size="small" :loading="busy" :pagination="{pageSize:8}" :scroll="{x:780}">
          <template #bodyCell="{column,record}">
            <a-button v-if="column.key==='app'" type="link" @click="selectApp(record.appName)">{{ record.appName }}</a-button>
            <template v-else-if="column.key==='rate'">{{ rate(record.coveredUrlCount,record.totalUrlCount) }}</template>
            <template v-else-if="column.key==='groups'"><a-tag v-for="g in record.appGroups" :key="g">{{ g }}</a-tag></template>
            <a-button v-else-if="column.key==='settings'" type="text" aria-label="应用设置" :disabled="busy" @click="settings={appName:record.appName,appGroups:[...record.appGroups],specialNote:record.specialNote}"><Icon icon="ant-design:setting-outlined" /></a-button>
          </template>
        </a-table>
      </section>
      <section>
        <div class="baseline-section-head"><h3>{{ appName || 'URL' }} · URL 清单</h3><a-input-search v-model:value="keyword" placeholder="搜索 URL" style="max-width:360px" @search="page=1;loadUrls()" /></div>
        <a-table :columns="urlColumns" :data-source="urlRows" row-key="pageUrl" size="small" :loading="rowsLoading" :scroll="{x:1015}" :pagination="{current:page,pageSize:30,total,showSizeChanger:false}" @change="(p:any)=>{page=p.current;loadUrls()}">
          <template #bodyCell="{column,record}">
            <span v-if="column.key==='url'" class="baseline-url">{{ record.pageUrl }}</span>
            <a-tag v-else-if="column.key==='covered'" :color="record.covered?'blue':'default'">{{ record.covered?'已覆盖':'待覆盖' }}</a-tag>
            <a-switch v-else-if="column.key==='priority'" size="small" :checked="record.priority" :disabled="busy" :aria-label="`高频 URL ${record.pageUrl}`" @change="(value:boolean)=>changePriority(record,value)" />
          </template>
        </a-table>
      </section>
    </div>
  </a-drawer>
  <a-modal :open="!!preview" title="确认补充基线" width="min(880px,94vw)" centered :body-style="{maxHeight:'65vh',overflowY:'auto'}" :confirm-loading="busy" :closable="!busy" :keyboard="!busy" :mask-closable="false" :cancel-button-props="{disabled:busy}" :ok-button-props="{disabled:!preview?.rows.length||!!preview?.errors.length}" ok-text="确认入库" cancel-text="取消" @ok="append" @cancel="preview=null;pending=null">
    <template v-if="preview">
      <p>{{ preview.source }} · {{ preview.rows.length }} 条有效 URL · 文件内重复 {{ preview.duplicates }} 条</p>
      <a-alert v-if="preview.errors.length" type="error" :message="`${preview.errors.length} 行数据无效，请修正后重新导入`" show-icon />
      <ul v-if="preview.errors.length"><li v-for="e in preview.errors.slice(0,20)" :key="`${e.sheet}-${e.rowNo}`">{{ e.sheet }} 第 {{ e.rowNo }} 行：{{ e.message }}</li></ul>
      <a-table :data-source="preview.rows" :columns="[{title:'APP名称',dataIndex:'appName',width:160},{title:'URL',dataIndex:'pageUrl',ellipsis:true}]" :row-key="(row:any)=>JSON.stringify([row.appName,row.pageUrl])" :pagination="{pageSize:10}" size="small" />
    </template>
  </a-modal>
  <a-modal v-model:open="priorityOpen" title="批量设置高频 URL" width="min(680px,94vw)" :body-style="{maxHeight:'65vh',overflowY:'auto'}" :mask-closable="false" :closable="!busy" :keyboard="!busy">
    <a-form v-if="!priorityResult" layout="vertical" :disabled="busy">
      <a-form-item label="APP名称" required><a-select v-model:value="priorityApp" show-search :options="overview.apps.map((a:any)=>({value:a.appName,label:a.appName}))" /></a-form-item>
      <a-form-item label="高频 URL（每行一条）" required><a-textarea v-model:value="priorityText" :rows="10" /></a-form-item>
    </a-form>
    <template v-else>
      <a-alert :type="priorityResult.missingUrls.length?'warning':'success'" show-icon :message="`${priorityResult.appName}：新增高频 ${priorityResult.updatedCount} 条，原已高频 ${priorityResult.alreadyPriorityCount} 条`" :description="`重复 ${priorityResult.duplicateCount} 条，未匹配 ${priorityResult.missingUrls.length} 条`" />
      <a-form v-if="priorityResult.missingUrls.length" layout="vertical" style="margin-top:16px"><a-form-item label="未匹配 URL"><a-textarea :value="priorityResult.missingUrls.join('\n')" readonly :rows="8" /></a-form-item></a-form>
    </template>
    <template #footer>
      <a-button :disabled="busy" @click="priorityOpen=false">{{ priorityResult?'关闭':'取消' }}</a-button>
      <a-button v-if="!priorityResult" type="primary" :loading="busy" :disabled="!priorityApp || !priorityText.trim()" @click="savePriorityBatch">确认设为高频</a-button>
    </template>
  </a-modal>
  <a-modal v-model:open="manualOpen" title="补充 URL" ok-text="下一步" cancel-text="取消" @ok="prepareManual">
    <a-form layout="vertical"><a-form-item label="APP名称" required><a-auto-complete v-model:value="manualApp" :options="overview.apps.map((a:any)=>({value:a.appName}))" /></a-form-item><a-form-item label="URL（每行一条）" required><a-textarea v-model:value="manualUrls" :rows="8" /></a-form-item></a-form>
  </a-modal>
  <a-modal :open="!!settings" :title="`${settings?.appName||''} 设置`" ok-text="保存" cancel-text="取消" :confirm-loading="busy" :keyboard="!busy" :mask-closable="false" :closable="!busy" :cancel-button-props="{disabled:busy}" @ok="saveSettings" @cancel="settings=null">
    <a-form v-if="settings" layout="vertical" :disabled="busy"><a-form-item label="应用分组"><a-select v-model:value="settings.appGroups" mode="multiple" :options="[{value:'TOP'},{value:'TGI'}]" /></a-form-item><a-form-item label="特殊说明"><a-textarea v-model:value="settings.specialNote" :maxlength="2000" /></a-form-item></a-form>
  </a-modal>
</template>

<style scoped>
.baseline-workspace { display: flex; flex-direction: column; gap: 22px; color: #172033; }
.baseline-toolbar,.baseline-section-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.baseline-section-head { justify-content: space-between; margin-bottom: 12px; }
.baseline-section-head h3 { margin: 0; font-size: 15px; }
.baseline-stats { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 20px; padding: 20px 0; border-block: 1px solid #edf0f4; }
.baseline-url { overflow-wrap: anywhere; }
@media(max-width:640px) { .baseline-stats { grid-template-columns:repeat(2,minmax(0,1fr)); } }
</style>
