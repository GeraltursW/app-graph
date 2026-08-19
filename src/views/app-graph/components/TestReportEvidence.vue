<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { computed } from 'vue';
import { Badge, ScrollArea } from './ui';

const props = defineProps({ selected: { type: Object, required: true } });
const failedStep = computed(() => props.selected.steps.find((item) => item.status === 'failed'));
function stageLabel(stage) { return { script: '设备脚本', backend: '后端', frontend: '前端' }[stage] || stage; }
</script>

<template>
  <aside class="inspector report-evidence">
    <div class="panel-head report-evidence-head">
      <div><p class="eyebrow">Evidence Chain</p><h2>执行证据</h2></div>
      <Badge :variant="selected.status === 'failed' ? 'destructive' : 'secondary'">{{ selected.status === 'failed' ? '异常' : selected.status === 'warning' ? '观察' : '通过' }}</Badge>
    </div>
    <ScrollArea class="inspector-scroll">
      <div class="report-evidence-content">
        <section class="report-diagnosis" :class="`status-${selected.status}`">
          <Icon icon="ant-design:bulb-outlined" :size="18" />
          <div><strong>AI 归因摘要</strong><p>{{ selected.diagnosis }}</p></div>
        </section>
        <section class="evidence-meta">
          <div><span>用例 ID</span><strong>{{ selected.testCase.caseId }}</strong></div>
          <div><span>动作数量</span><strong>{{ selected.testCase.actionCount }}</strong></div>
          <div><span>触发时间</span><strong>{{ selected.triggeredAt }}</strong></div>
          <div><span>失败步骤</span><strong>{{ failedStep ? `第 ${failedStep.stepNo} 步` : '无' }}</strong></div>
        </section>
        <section class="evidence-step-section">
          <div class="case-section-title"><strong>脚本执行步骤</strong><span>{{ selected.steps.length }} STEPS</span></div>
          <div class="evidence-step-list">
            <article v-for="step in selected.steps" :key="step.stepNo" class="evidence-step" :class="`status-${step.status}`">
              <span class="evidence-step-no">{{ String(step.stepNo).padStart(2, '0') }}</span>
              <div class="evidence-step-copy">
                <span>{{ stageLabel(step.stage) }} · {{ step.durationMs }}ms</span>
                <strong>{{ step.title }}</strong>
                <code>{{ step.action }}</code>
              </div>
              <Icon :icon="step.status === 'failed' ? 'ant-design:warning-filled' : 'ant-design:check-circle-filled'" :size="16" />
            </article>
          </div>
        </section>
        <section class="report-raw-contract">
          <div class="case-section-title"><strong>回传摘要</strong><span>JSON</span></div>
          <pre>{{ JSON.stringify({ alertId: selected.alertId, reportId: selected.reportId, pageId: selected.match.pageId, status: selected.status, score: selected.score }, null, 2) }}</pre>
        </section>
      </div>
    </ScrollArea>
  </aside>
</template>
