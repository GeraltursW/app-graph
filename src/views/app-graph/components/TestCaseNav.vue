<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { computed } from 'vue';
import { Badge, ScrollArea } from './ui';

const props = defineProps({
  cases: { type: Array, default: () => [] },
  selectedCaseId: { type: String, default: '' },
  execution: { type: Object, required: true },
});

const emit = defineEmits(['select-case']);
const pathCases = computed(() => props.cases.filter((item) => item.case_type === 'path'));
const scenarioCases = computed(() => props.cases.filter((item) => item.case_type === 'scenario'));
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

    <ScrollArea class="case-list-scroll">
      <div class="case-list">
        <button
          v-for="item in cases"
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
      </div>
    </ScrollArea>
  </aside>
</template>
