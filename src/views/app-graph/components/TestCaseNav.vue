<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { Segmented as ASegmented } from 'ant-design-vue';
import { computed, ref } from 'vue';
import GraphButton from './shared/GraphButton.vue';
import ScenarioCaseBuilder from './ScenarioCaseBuilder.vue';
import { Badge, ScrollArea } from './ui';

const props = defineProps({
  cases: { type: Array, default: () => [] },
  pages: { type: Array, default: () => [] },
  selectedCaseId: { type: String, default: '' },
  execution: { type: Object, required: true },
});

const emit = defineEmits(['select-case', 'create-scenario']);
const caseType = ref('path');
const keyword = ref('');
const builderOpen = ref(false);
const pathCases = computed(() => props.cases.filter((item) => item.caseType === 'path'));
const scenarioCases = computed(() => props.cases.filter((item) => item.caseType === 'scenario'));
const visibleCases = computed(() => {
  const normalized = keyword.value.trim().toLowerCase();
  return props.cases.filter((item) => (
    item.caseType === caseType.value
    && (!normalized || `${item.caseName} ${item.description} ${item.targetPage?.displayTitle || ''}`
      .toLowerCase().includes(normalized))
  ));
});

function changeCaseType(value) {
  caseType.value = value;
  const first = props.cases.find((item) => item.caseType === value);
  if (first) emit('select-case', first.caseId);
}
</script>

<template>
  <aside class="sidebar test-case-sidebar">
    <div class="case-sidebar-head">
      <div>
        <span>TEST ORCHESTRATION</span>
        <strong>图谱用例</strong>
      </div>
      <Badge variant="secondary">{{ cases.length }}</Badge>
    </div>

    <div class="case-type-summary">
      <div><Icon icon="ant-design:branches-outlined" :size="16" /><span>路径采集</span><strong>{{ pathCases.length }}</strong></div>
      <div><Icon icon="ant-design:thunderbolt-outlined" :size="16" /><span>场景性能</span><strong>{{ scenarioCases.length }}</strong></div>
    </div>

    <div class="case-list-tools">
      <a-segmented
        :value="caseType"
        :options="[
          { label: '全量路径', value: 'path' },
          { label: '过程采集', value: 'scenario' }
        ]"
        size="small"
        @change="changeCaseType"
      />
      <GraphButton v-if="caseType === 'scenario'" type="primary" html-type="button" @click="builderOpen = true">
        <template #icon><Icon icon="ant-design:plus-outlined" :size="13" /></template>
        新建
      </GraphButton>
      <label class="case-search">
        <Icon icon="ant-design:search-outlined" :size="13" />
        <input v-model="keyword" type="search" placeholder="搜索终点或用例" />
      </label>
    </div>

    <ScrollArea class="case-list-scroll">
      <div class="case-list">
        <button
          v-for="item in visibleCases"
          :key="item.caseId"
          type="button"
          class="case-list-item"
          :class="{ active: selectedCaseId === item.caseId }"
          @click="emit('select-case', item.caseId)"
        >
          <span class="case-type-icon" :class="`type-${item.caseType}`">
            <Icon :icon="item.caseType === 'path' ? 'ant-design:branches-outlined' : 'ant-design:thunderbolt-outlined'" :size="16" />
          </span>
          <span class="case-list-copy">
            <strong>{{ item.caseName }}</strong>
            <em>{{ item.description }}</em>
            <small>
              {{ item.caseType === 'path' ? `${item.pageIds.length} 页面 · ${item.edgeSteps.length} 跳转` : `${item.steps.length} 个典型操作` }}
            </small>
          </span>
          <span v-if="execution.caseId === item.caseId" class="case-run-state" :class="`state-${execution.status}`">
            {{ execution.status === 'running' ? '执行中' : execution.status === 'completed' ? '已完成' : '' }}
          </span>
        </button>
        <div v-if="!visibleCases.length" class="empty-state">当前分类暂无用例</div>
      </div>
    </ScrollArea>

    <ScenarioCaseBuilder
      v-model:open="builderOpen"
      :pages="pages"
      @create="emit('create-scenario', $event)"
    />
  </aside>
</template>
