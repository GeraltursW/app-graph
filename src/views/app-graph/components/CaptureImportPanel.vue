<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Modal, message } from 'ant-design-vue';
import Icon from '@/components/Icon/Icon.vue';
import { captureRequest as api, uploadCapture } from '../capture.api';
import { governanceMock, requestError } from '../governance.api';
import { buildImageApiUrl } from '../info.api';

const props = defineProps<{appName: string}>();
const emit = defineEmits(['changed','locate']);
const open = ref(false), busy = ref(false), error = ref(''), jobs = ref<any[]>([]), job = ref<any>(null);
const jobId = ref(''), selected = ref<string[]>([]), drafts = ref<Record<string,any>>({}), editId = ref('');
const useAi = ref(false), aiAvailable = ref(false), pending = ref<any>(null);
const filter = ref('全部');
let timer: ReturnType<typeof setTimeout> | undefined, generation = 0;
const edit = computed(() => drafts.value[editId.value]);
const record = computed(() => job.value?.records.find((r:any)=>r.recordId===editId.value));
const targetNode = computed(() => job.value?.nodes.find((n:any)=>n.pageId===edit.value?.targetPageId));
const displayRows = computed(() => (job.value?.records||[]).filter((r:any)=>filter.value==='全部'||(filter.value==='异常'?!!r.error:filter.value==='已入库'?!!r.committedPageId:filter.value==='入口未知'?!r.error&&!r.committedPageId&&drafts.value[r.recordId]?.mode==='orphan':!r.error&&!r.committedPageId)));
const nodes = computed(() => (job.value?.nodes || []).map((n:any)=>({value:n.pageId,label:`${n.pageTitle} · ${n.pageUrl}`})));
const statusLabels: Record<string,string> = {QUEUED:'排队中',ANALYZING:'分析中',READY:'分析完成',FAILED:'失败',REVIEW_READY:'前序待核对',ENTRY_UNKNOWN:'入口未知',CHOOSE_PARENT:'选择父节点'};
const columns = [{title:'采集记录',key:'page',width:280},{title:'证据',key:'images',width:190},{title:'归并状态',key:'state',width:160},{title:'处理',key:'actions',width:170}];
const imageUrl = (value:string) => /^(data:|blob:)/.test(value) ? value : buildImageApiUrl(value);
function stopPoll() { if(timer) clearTimeout(timer);timer=undefined; }
function invalidate() { generation++;stopPoll();job.value=null;jobId.value='';selected.value=[];drafts.value={};editId.value='';pending.value=null; }
async function run(task:()=>Promise<void>) {
  if(busy.value) return;busy.value=true;error.value='';
  try {await task();} catch(e) {error.value=requestError(e);message.error(error.value);} finally {busy.value=false;}
}
function draft(row:any) {
  const p=row.payload,a=row.analysis;
  const previous=p.previousRecordId||'', parent=previous?'':a.parentCandidates?.length===1?a.parentCandidates[0].pageId:'';
  return {recordId:row.recordId,targetPageId:'',pageTitle:p.pageTitle||a.pageTitle||p.pageUrl.slice(0,255),pageText:a.pageText||'',embeddingText:a.embeddingText||'',widgetDescription:p.widgetDescription||a.widgetDescription||'',actionType:p.actionType||'tap',parentPageId:parent,previousRecordId:previous,mode:parent||previous?'link':'orphan'};
}
async function loadJob(id:string, reset=true) {
  stopPoll();const token=++generation;
  const result=await api('/'+id);
  if(token!==generation || !open.value) return;
  job.value=result;jobId.value=id;
  if(reset) {selected.value=[];drafts.value={};pending.value=null;editId.value='';filter.value='全部';}
  for(const row of result.records) drafts.value[row.recordId] ||= draft(row);
  if(['QUEUED','ANALYZING'].includes(result.status)) timer=setTimeout(()=>{loadJob(id,false).catch(e=>{error.value=requestError(e);});},2000);
}
async function refresh() {
  const token=generation, name=props.appName;
  const result=await api('',{appName:name});if(token!==generation||name!==props.appName||!open.value) return;
  jobs.value=result.jobs;aiAvailable.value=result.aiAvailable;
  if(!aiAvailable.value) useAi.value=false;
  const id=jobId.value||result.jobs[0]?.jobId;if(id) await loadJob(id,true);
}
function launch(){open.value=true;run(refresh);}
async function readUpload(file:File) {
  if(busy.value) return false;
  if(!/\.zip$/i.test(file.name)||file.size>20*1024*1024){message.error('请上传不超过 20 MB 的 ZIP');return false;}
  await run(async()=>{const result=await uploadCapture(props.appName,file,useAi.value);jobId.value=result.jobId;await refresh();message.success(result.duplicate?'采集包已存在，已打开原任务':'采集包已接收');});return false;
}
function saveReview(){pending.value=null;editId.value='';}
function commit() {
  if(!selected.value.length||busy.value) return;
  const items=selected.value.map(id=>({...drafts.value[id]}));
  if(items.some(i=>!i.pageTitle.trim()||(i.mode==='link'&&(!i.widgetDescription.trim()||(!i.parentPageId&&!i.previousRecordId))))) {message.warning('请先补齐标题、前序关系和控件说明');return;}
  const signature=JSON.stringify({graphVersion:job.value.graphVersion,items});
  if(pending.value?.signature!==signature) pending.value={signature,requestId:crypto.randomUUID()};
  const body={requestId:pending.value.requestId,graphVersion:job.value.graphVersion,items};
  Modal.confirm({title:`确认入库 ${items.length} 条人工采集记录？`,okText:'确认入库',cancelText:'取消',content:`${items.filter(i=>i.mode==='link').length} 条保存前序关系；${items.filter(i=>i.mode==='orphan').length} 条仅保存页面。缺少归类信息的页面不会新增 URL 覆盖。`,onOk:()=>run(async()=>{
    const result=await api('/'+jobId.value+'/commit',body,'post');
    const reachable=result.pages.filter((p:any)=>p.reachable).length;
    pending.value=null;emit('changed');await loadJob(jobId.value,true);
    message.success(`已入库 ${result.savedCount} 条，${reachable} 条已接入主图谱，其余保留待接入`);
  })});
}
async function template() {
  await run(async()=>{
    const {default:ExcelJS}=await import('exceljs');const {captureHeaders}=await import('../data/capturePackage');
    const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('人工采集');sheet.addRow(Object.keys(captureHeaders));sheet.columns.forEach(c=>c.width=24);
    const url=URL.createObjectURL(new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const a=document.createElement('a');a.href=url;a.download='records.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
}
async function demo() {
  await run(async()=>{
    const {createCaptureDemo}=await import('../data/captureDemo');
    const file=await createCaptureDemo(props.appName);const result=await uploadCapture(props.appName,file,false);jobId.value=result.jobId;await refresh();
  });
}
watch(()=>props.appName,()=>{invalidate();jobs.value=[];if(open.value) run(refresh);});
watch(open,value=>{if(!value){generation++;stopPoll();}});
onBeforeUnmount(()=>{generation++;stopPoll();});
</script>

<template>
  <a-button size="small" :disabled="!appName" @click="launch"><Icon icon="ant-design:folder-add-outlined" /> 人工采集导入</a-button>
  <a-drawer v-model:open="open" title="人工采集导入" width="96vw" :closable="!busy" :keyboard="!busy" :mask-closable="!busy">
    <div class="capture-workspace">
      <div class="capture-toolbar">
        <a-tag color="blue">{{ appName }}</a-tag><a-tag v-if="governanceMock" color="gold">演示模式 · 内存数据</a-tag>
        <a-upload accept=".zip" :before-upload="readUpload" :show-upload-list="false" :disabled="busy"><a-button type="primary" :loading="busy"><Icon icon="ant-design:upload-outlined" /> 上传采集包</a-button></a-upload>
        <a-button :disabled="busy" @click="template">下载表格模板</a-button>
        <a-button v-if="governanceMock" :disabled="busy" @click="demo">载入示例包</a-button>
        <a-checkbox v-model:checked="useAi" :disabled="busy||!aiAvailable">截图 AI 分析</a-checkbox>
        <a-button :disabled="busy" @click="run(refresh)"><Icon icon="ant-design:reload-outlined" /> 刷新</a-button>
      </div>
      <a-alert v-if="error" type="error" :message="error" show-icon />
      <a-select :value="jobId||undefined" placeholder="选择采集任务" :disabled="busy" :options="jobs.map(j=>({value:j.jobId,label:`${j.fileName} · ${statusLabels[j.status]} · ${j.createdAt}`}))" @change="(id:string)=>run(()=>loadJob(id,true))" />
      <template v-if="job">
        <div class="capture-toolbar"><a-tag>{{ statusLabels[job.status] }}</a-tag><span>{{ job.records.length }} 条记录</span><a-button v-if="job.status==='FAILED'" :disabled="busy" @click="run(async()=>{await api('/'+jobId+'/retry',{},'post');await loadJob(jobId)})">重新分析</a-button></div>
        <a-progress v-if="['QUEUED','ANALYZING'].includes(job.status)" :percent="job.progress" />
        <a-alert v-if="job.error" type="error" :message="job.error" show-icon />
        <div class="capture-toolbar"><a-segmented v-model:value="filter" :options="['全部','待核对','入口未知','已入库','异常']" /><a-button type="primary" :disabled="busy||!selected.length||job.status!=='READY'" @click="commit">确认入库 {{ selected.length||'' }}</a-button></div>
        <a-table :columns="columns" :data-source="displayRows" row-key="recordId" size="small" :scroll="{x:850}" :pagination="{pageSize:10}" :row-selection="{selectedRowKeys:selected,preserveSelectedRowKeys:true,onChange:(keys:string[])=>{selected=keys;pending=null},getCheckboxProps:(r:any)=>({disabled:busy||job.status!=='READY'||!!r.error||!!r.committedPageId})}">
          <template #bodyCell="{column,record:r}">
            <div v-if="column.key==='page'"><strong>{{ drafts[r.recordId]?.pageTitle||r.recordId }}</strong><p class="capture-url">{{ r.payload.pageUrl }}</p><span class="capture-muted">{{ r.recordId }} · 第 {{ r.rowNo }} 行</span></div>
            <a-image-preview-group v-else-if="column.key==='images'"><div class="capture-thumbs"><a-image v-for="field in ['pageImage','parentImage','widgetImage'].filter(f=>r.payload[f] && !r.error)" :key="field" :src="imageUrl(r.payload[field])" :width="42" :height="76" :alt="field==='pageImage'?'目标页面':field==='parentImage'?'父页面':'操作控件'" /></div></a-image-preview-group>
            <template v-else-if="column.key==='state'"><a-tag :color="r.error?'red':r.committedPageId?'green':'blue'">{{ r.error?'导入异常':r.committedPageId?(job.nodes.some((n:any)=>n.pageId===r.committedPageId&&n.reachable)?'已接入主图谱':'已入库 · 待接入'):drafts[r.recordId]?.mode==='link'?'前序待确认':'入口未知' }}</a-tag><p v-if="r.error" class="capture-url">{{ r.error }}</p><span v-else class="capture-muted">{{ r.analysis.aiStatus==='ANALYZED'?'AI 建议待复核':'人工归类' }}</span></template>
            <a-space v-else-if="column.key==='actions'"><a-button size="small" :disabled="busy||!!r.error||!!r.committedPageId||job.status!=='READY'" @click="editId=r.recordId">核对</a-button><a-button v-if="r.committedPageId" size="small" type="link" @click="emit('locate',appName,r.committedPageId);open=false">定位</a-button></a-space>
          </template>
        </a-table>
      </template>
      <a-empty v-else description="暂无采集任务" />
    </div>
  </a-drawer>
  <a-modal :open="!!edit" title="核对采集记录" width="min(1000px,96vw)" :body-style="{maxHeight:'70vh',overflowY:'auto'}" ok-text="完成核对" cancel-text="关闭" @ok="saveReview" @cancel="saveReview">
    <div v-if="edit&&record" class="capture-review">
      <a-image-preview-group><div class="capture-evidence"><figure v-for="field in ['pageImage','parentImage','widgetImage'].filter(f=>record.payload[f])" :key="field"><figcaption>{{ field==='pageImage'?'目标页面':field==='parentImage'?'父页面':'操作控件' }}</figcaption><a-image :src="imageUrl(record.payload[field])" :alt="field" /></figure></div></a-image-preview-group>
      <a-form layout="vertical">
        <a-form-item label="目标 URL"><span class="capture-url">{{ record.payload.pageUrl }}</span></a-form-item>
        <a-form-item label="页面归属"><a-select v-model:value="edit.targetPageId" show-search option-filter-prop="label" :options="[{value:'',label:'创建独立功能页面'},...nodes]" /></a-form-item>
        <a-image-preview-group v-if="targetNode?.images?.length"><div class="capture-thumbs"><a-image v-for="url in targetNode.images.slice(0,4)" :key="url" :src="imageUrl(url)" :width="50" :height="96" alt="已有功能页面截图" /></div></a-image-preview-group>
        <div v-if="record.analysis.targetCandidates?.length" class="capture-candidates"><span>同 URL 候选</span><a-button v-for="n in record.analysis.targetCandidates" :key="n.pageId" size="small" @click="edit.targetPageId=n.pageId">{{ n.pageTitle }}</a-button></div>
        <a-form-item label="页面标题" required><a-input v-model:value="edit.pageTitle" :maxlength="255" /></a-form-item>
        <a-form-item label="页面描述"><a-textarea v-model:value="edit.pageText" :rows="2" :maxlength="16000" /></a-form-item>
        <a-form-item label="功能归类 embeddingText"><a-textarea v-model:value="edit.embeddingText" :rows="3" :maxlength="16000" /></a-form-item>
        <a-alert v-if="record.analysis.aiMessage" type="warning" :message="record.analysis.aiMessage" />
        <a-form-item label="入库方式"><a-radio-group v-model:value="edit.mode"><a-radio value="orphan">仅保存页面</a-radio><a-radio value="link">保存页面及前序关系</a-radio></a-radio-group></a-form-item>
        <template v-if="edit.mode==='link'">
          <a-form-item label="图谱父节点"><a-select v-model:value="edit.parentPageId" allow-clear show-search option-filter-prop="label" :options="nodes" @change="()=>edit.previousRecordId=''" /></a-form-item>
          <div v-if="record.analysis.parentCandidates?.length" class="capture-candidates"><span>前序候选</span><a-button v-for="n in record.analysis.parentCandidates" :key="n.pageId" size="small" @click="edit.parentPageId=n.pageId;edit.previousRecordId=''">{{ n.pageTitle }}</a-button></div>
          <a-form-item label="或选择同包前一步记录"><a-select v-model:value="edit.previousRecordId" allow-clear :options="job.records.filter((r:any)=>r.recordId!==edit.recordId&&!r.error).map((r:any)=>({value:r.recordId,label:`${r.recordId} · ${r.payload.pageUrl}`}))" @change="()=>edit.parentPageId=''" /></a-form-item>
          <a-form-item label="进入控件 / 操作说明" required><a-input v-model:value="edit.widgetDescription" :maxlength="255" /></a-form-item>
          <a-form-item label="操作类型"><a-select v-model:value="edit.actionType" :options="[{value:'tap',label:'点击'},{value:'longPress',label:'长按'},{value:'swipe',label:'滑动'},{value:'back',label:'返回'}]" /></a-form-item>
        </template>
        <a-form-item v-if="record.payload.capturedAt" label="采集时间">{{ record.payload.capturedAt }}</a-form-item>
        <a-form-item v-if="record.payload.notes" label="采集备注">{{ record.payload.notes }}</a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>

<style scoped>
.capture-workspace{display:flex;flex-direction:column;gap:16px;min-width:0}.capture-toolbar,.capture-candidates{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.capture-url{overflow-wrap:anywhere;white-space:normal;margin:6px 0}.capture-muted{color:#7a8495;font-size:12px}.capture-thumbs{display:flex;gap:8px}.capture-thumbs :deep(img){object-fit:contain}.capture-review{display:grid;grid-template-columns:280px minmax(0,1fr);gap:24px}.capture-evidence{display:flex;flex-direction:column;gap:14px}.capture-evidence figure{margin:0}.capture-evidence figcaption{margin-bottom:8px;color:#657086}.capture-evidence :deep(img){max-height:340px;object-fit:contain}.capture-candidates{margin-bottom:16px;font-size:12px}@media(max-width:700px){.capture-review{grid-template-columns:1fr}.capture-evidence{flex-direction:row;flex-wrap:wrap}.capture-evidence figure{width:100px}.capture-evidence :deep(img){max-height:180px}}
</style>
