<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from '@/components/Icon/Icon.vue';
import { USE_MOCK } from '../shared/api.config';
import CoverageReportPanel from '../coverage-report/CoverageReportPanel.vue';
import OrphanMergePanel from '../orphans/OrphanMergePanel.vue';

defineProps<{ appName: string }>();
const emit = defineEmits(['changed', 'locate']);
const open = ref(false), tab = ref('daily');
const dailyRef = ref<InstanceType<typeof CoverageReportPanel>>();
const orphanRef = ref<InstanceType<typeof OrphanMergePanel>>();
const activePanel = computed(() => tab.value === 'daily' ? dailyRef.value : orphanRef.value);
function launch(mode: string) { tab.value = mode; open.value = true; }
function locate(target: { appName: string; pageId: string }) {
  open.value = false;
  emit('locate', target);
}
</script>

<template>
  <a-space size="small">
    <a-button size="small" @click="launch('orphans')"><Icon icon="ant-design:branches-outlined" /> 批量并入</a-button>
    <a-button size="small" @click="launch('daily')"><Icon icon="ant-design:bar-chart-outlined" /> 建设日报</a-button>
  </a-space>
  <a-drawer v-model:open="open" title="图谱建设" width="96vw">
    <div class="governance-shell">
      <div class="gov-toolbar">
        <a-segmented v-model:value="tab" :options="[{value:'daily',label:'建设日报'},{value:'orphans',label:'游离区域'}]" />
        <a-tag v-if="USE_MOCK" color="gold">演示数据</a-tag>
        <a-button :loading="activePanel?.busy" @click="activePanel?.refresh()">刷新</a-button>
      </div>
      <div v-show="tab==='daily'">
        <CoverageReportPanel ref="dailyRef" :active="open && tab==='daily'" @locate="locate" />
      </div>
      <div v-show="tab==='orphans'">
        <OrphanMergePanel ref="orphanRef" :active="open && tab==='orphans'" :app-name="appName" @changed="emit('changed')" @locate="locate" />
      </div>
    </div>
  </a-drawer>
</template>

<style scoped>
.governance-shell{display:flex;flex-direction:column;gap:18px;min-width:0}
.gov-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
</style>
