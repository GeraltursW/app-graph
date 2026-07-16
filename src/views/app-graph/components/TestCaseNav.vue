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
const pathCases = computed(() => props.cases.filter((item) => item.case_type === 'path'));
const scenarioCases = computed(() => props.cases.filter((item) => item.case_type === 'scenario'));
const visibleCases = computed(() => {
  const normalized = keyword.value.trim().toLowerCase();
  return props.cases.filter((item) => (
    item.case_type === caseType.value
    && (!normalized || `${item.case_name} ${item.description} ${item.targetPage?.displayTitle || ''}`
      .toLowerCase().includes(normalized))
  ));
});

function changeCaseType(value) {
  caseType.value = value;
  const first = props.cases.find((item) => item.case_type === value);
  if (first) emit('select-case', first.case_id);
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
          :key="item.case_id"
          type="button"
          class="case-list-item"
          :class="{ active: selectedCaseId === item.case_id }"
          @click="emit('select-case', item.case_id)"
        >
          <span class="case-type-icon" :class="`type-${item.case_type}`">
            <Icon :icon="item.case_type === 'path' ? 'ant-design:branches-outlined' : 'ant-design:thunderbolt-outlined'" :size="16" />
          </span>
          <span class="case-list-copy">
            <strong>{{ item.case_name }}</strong>
            <em>{{ item.description }}</em>
            <small>
              {{ item.case_type === 'path' ? `${item.pageIds.length} 页面 · ${item.edgeSteps.length} 跳转` : `${item.steps.length} 个典型操作` }}
            </small>
          </span>
          <span v-if="execution.caseId === item.case_id" class="case-run-state" :class="`state-${execution.status}`">
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
