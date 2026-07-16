<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { computed } from 'vue';
import GraphButton from './shared/GraphButton.vue';
import { Badge, ScrollArea } from './ui';

const props = defineProps({
  testCase: { type: Object, default: null },
  execution: { type: Object, required: true },
});

const emit = defineEmits(['run-case', 'stop-case']);
const isRunning = computed(() => props.execution.status === 'running'
  && props.execution.caseId === props.testCase?.case_id);
const displayedStep = computed(() => {
  if (props.execution.caseId !== props.testCase?.case_id) return 0;
  return Math.min(props.execution.currentStep, props.testCase?.steps?.length || 0);
});

function operationIcon(step) {
  return {
    navigate: 'ant-design:arrow-right-outlined',
    collect: 'ant-design:fund-projection-screen-outlined',
    swipe: 'ant-design:swap-outlined',
    long_press: 'ant-design:clock-circle-outlined',
    wait: 'ant-design:hourglass-outlined',
    tap: 'ant-design:aim-outlined',
  }[step.type] || 'ant-design:play-circle-outlined';
}
</script>

<template>
  <aside class="inspector test-case-panel">
    <div class="panel-head case-panel-head">
      <div>
        <p class="eyebrow">Test Case</p>
        <h2>{{ testCase?.case_name || '请选择用例' }}</h2>
      </div>
      <Badge v-if="testCase" variant="secondary">
        {{ testCase.case_type === 'path' ? '全量路径' : testCase.source === 'user_configured' ? '用户配置' : '场景模板' }}
      </Badge>
    </div>

    <ScrollArea v-if="testCase" class="inspector-scroll">
      <div class="case-panel-content">
        <section class="case-overview">
          <div>
            <span>起始页面</span>
            <strong>{{ testCase.startPage?.displayTitle || '未解析' }}</strong>
          </div>
          <div>
            <span>{{ testCase.case_type === 'path' ? '目标页面' : '操作数量' }}</span>
            <strong>{{ testCase.case_type === 'path' ? (testCase.targetPage?.displayTitle || '未解析') : `${testCase.steps.length} 步` }}</strong>
          </div>
          <div>
            <span>采集时长</span>
            <strong>{{ testCase.collection.duration_seconds }} 秒</strong>
          </div>
          <div>
            <span>解析状态</span>
            <strong :class="testCase.resolved ? 'text-success' : 'text-danger'">
              {{ testCase.resolved ? '图谱已绑定' : '存在缺失节点' }}
            </strong>
          </div>
        </section>

        <section class="case-description">
          <p>{{ testCase.description }}</p>
          <div class="case-metrics">
            <span v-for="metric in testCase.collection.metrics" :key="metric">{{ metric }}</span>
          </div>
        </section>

        <section class="case-step-section">
          <div class="case-section-title">
            <strong>执行步骤</strong>
            <span>{{ displayedStep }}/{{ testCase.steps.length }}</span>
          </div>
          <div class="case-step-list">
            <div
              v-for="step in testCase.steps"
              :key="`${testCase.case_id}-${step.step_no}`"
              class="case-step"
              :class="{
                active: isRunning && execution.currentStep === step.step_no,
                completed: execution.caseId === testCase.case_id && execution.currentStep > step.step_no
              }"
            >
              <span class="case-step-index">{{ String(step.step_no).padStart(2, '0') }}</span>
              <span class="case-step-icon"><Icon :icon="operationIcon(step)" :size="15" /></span>
              <span class="case-step-copy">
                <strong>{{ step.title }}</strong>
                <em v-if="step.type === 'swipe'">{{ step.target || '页面内容区' }} · {{ step.direction === 'up' ? '向上' : step.direction }} · 重复 {{ step.repeat || 1 }} 次</em>
                <em v-else-if="step.type === 'long_press'">{{ step.target || '目标区域' }} · 持续 {{ step.duration_ms }} ms</em>
                <em v-else-if="step.type === 'tap'">点击 {{ step.target || '目标控件' }} · 重复 {{ step.repeat || 1 }} 次</em>
                <em v-else-if="step.type === 'wait'">等待 {{ step.duration_ms }} ms</em>
                <em v-else-if="step.type === 'collect'">在目标页面记录全部性能指标</em>
                <em v-else>校验目标页面后继续执行</em>
              </span>
              <Icon v-if="execution.caseId === testCase.case_id && execution.currentStep > step.step_no" class="case-step-check" icon="ant-design:check-circle-filled" :size="16" />
            </div>
          </div>
        </section>

        <section v-if="execution.caseId === testCase.case_id && execution.result" class="case-result">
          <div class="case-result-score">
            <strong>{{ execution.result.score }}</strong>
            <span>性能评分</span>
          </div>
          <p>{{ execution.result.summary }}</p>
          <div class="case-result-metrics">
            <div v-for="metric in execution.result.metrics" :key="metric.label" :class="`tone-${metric.tone}`">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
        </section>

        <div class="case-run-actions">
          <GraphButton
            v-if="!isRunning"
            type="primary"
            html-type="button"
            :disabled="!testCase.resolved"
            @click="emit('run-case', testCase.case_id)"
          >
            <template #icon><Icon icon="ant-design:play-circle-outlined" :size="15" /></template>
            {{ execution.caseId === testCase.case_id && execution.result ? '重新执行' : '下发并模拟执行' }}
          </GraphButton>
          <GraphButton v-else danger html-type="button" @click="emit('stop-case')">
            <template #icon><Icon icon="ant-design:stop-outlined" :size="15" /></template>
            停止执行
          </GraphButton>
        </div>
      </div>
    </ScrollArea>
    <div v-else class="empty-state inspector-empty">请选择一条测试用例</div>
  </aside>
</template>
