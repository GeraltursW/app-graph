<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { requestError } from '../shared/api.config';
import { buildImageApiUrl } from '../shared/image.api';
import { queryOrphanWorkbench, requestBatchMerge, requestRollbackBatch, requestSaveOrphanEntry } from './orphan.api';

const props = defineProps<{ appName: string; active: boolean }>();
const emit = defineEmits(['changed', 'locate']);
const busy = ref(false), error = ref('');
const workbench = ref<any>({ entries: [], nodes: [], graphVersion: 0 }), selected = ref<string[]>([]), lastBatch = ref('');
const parents = ref<Record<string, string>>({}), widgets = ref<Record<string, string>>({}), batchParent = ref<string>();

const entryOpen = ref(false), entryPage = ref<any>(null), entryKind = ref('PENDING'), entryEvidence = ref('');

const parentOptions = computed(() => workbench.value.nodes.filter((n: any) => n.reachable).map((n: any) => ({ label: `${n.pageTitle} · ${n.pageUrl}`, value: n.pageId })));

const entryColumns = [{ title: '待接入区域', key: 'page', width: 270 }, { title: '可达成员', key: 'members', width: 85 }, { title: '父节点', key: 'parent', width: 300 }, { title: '进入控件', key: 'widget', width: 180 }, { title: '处理', key: 'action', width: 180 }];

async function run(task: () => Promise<void>) {
  if (busy.value) return; busy.value = true; error.value = '';
  try { await task(); } catch (e) { error.value = requestError(e); message.error(error.value); } finally { busy.value = false; }
}

async function reloadWorkbench() {
  if (!props.appName) return;
  workbench.value = await queryOrphanWorkbench(props.appName);
  selected.value = [];
}

async function refresh() { await run(reloadWorkbench); }
function assignParent() { if (batchParent.value) selected.value.forEach(id => parents.value[id] = batchParent.value!); }
function merge() {
  const items = selected.value.map(pageId => ({ pageId, newParentId: parents.value[pageId], widgetDescription: widgets.value[pageId] }));
  if (!items.length || items.some(i => !i.newParentId || !i.widgetDescription?.trim())) { message.warning('请为选中区域指定父节点和真实进入控件'); return; }
  Modal.confirm({ title: `确认并入 ${items.length} 个入口？`, content: '将保留区域内部关系。任一校验失败时整批不写入。', onOk: () => run(async () => {
    const result = await requestBatchMerge( { requestId: crypto.randomUUID(), appName: props.appName, graphVersion: workbench.value.graphVersion, items });
    lastBatch.value = result.batchId; await reloadWorkbench();
    if (items.some(i => !workbench.value.nodes.find((n: any) => n.pageId === i.pageId)?.reachable)) throw new Error('后台写入完成，但可达性回查失败，请刷新核对');
    emit('changed'); message.success('已并入并通过结构回查');
  }) });
}
function rollback() { Modal.confirm({ title: '撤销最近一次批量并入？', onOk: () => run(async () => { await requestRollbackBatch( { appName: props.appName, batchId: lastBatch.value, graphVersion: workbench.value.graphVersion }); lastBatch.value = ''; await reloadWorkbench(); emit('changed'); message.success('已撤销'); }) }); }
function showEntry(row: any) { entryPage.value = row; entryKind.value = 'PENDING'; entryEvidence.value = row.pendingReason || ''; entryOpen.value = true; }
async function saveEntry() {
  await run(async () => {
    await requestSaveOrphanEntry( { appName: props.appName, pageId: entryPage.value.pageId, graphVersion: workbench.value.graphVersion, reason: entryEvidence.value, evidence: entryEvidence.value, entryKind: entryKind.value });
    entryOpen.value = false; await reloadWorkbench(); emit('changed'); message.success('入口状态已保存');
  });
}

function locate(appName: string, pageId: string) { emit('locate', { appName, pageId }); }
watch(() => props.active, active => { if (active) refresh(); }, { immediate: true });
watch(() => props.appName, () => {
  parents.value = {}; widgets.value = {}; lastBatch.value = '';
  if (props.active) refresh();
});
defineExpose({ refresh, busy });
</script>
<template>
  <div class="governance-workspace">
    <a-alert v-if="error" :message="error" type="error" show-icon />

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
  </div>
  <a-modal v-model:open="entryOpen" :title="entryPage?.pageTitle" :confirm-loading="busy" ok-text="保存" @ok="saveEntry">
    <a-form layout="vertical"><a-form-item label="入口类型"><a-select v-model:value="entryKind" :options="[{value:'PENDING',label:'尚未找到入口'},{value:'APP_HOME',label:'确认是应用启动页'},{value:'DEEPLINK',label:'Deep Link'},{value:'NOTIFICATION',label:'通知入口'},{value:'SYSTEM_INTENT',label:'系统 Intent'},{value:'EXTERNAL_APP',label:'其他应用唤起'}]" /></a-form-item><a-form-item :label="entryKind==='PENDING'?'待确认原因':'真实入口证据'" required><a-textarea v-model:value="entryEvidence" :rows="4" /></a-form-item></a-form>
  </a-modal>

</template>
<style scoped>
.governance-workspace{display:flex;flex-direction:column;gap:18px;min-width:0;color:#172033}.gov-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.gov-meta{color:#687489;margin:0;font-size:12px}.gov-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:20px;border-block:1px solid #edf0f4;padding:22px 0}.gov-parent{width:340px;max-width:100%}.gov-page{display:flex;gap:10px;align-items:flex-start}.gov-page img{width:38px;height:78px;object-fit:contain}.gov-page div{min-width:0}.gov-page p{font-size:12px;color:#687489;overflow-wrap:anywhere;margin:4px 0}.gov-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}input[type=date]{border:1px solid #d9d9d9;border-radius:6px;padding:5px 10px}@media(max-width:800px){.gov-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.gov-form-grid{grid-template-columns:1fr}}
</style>
