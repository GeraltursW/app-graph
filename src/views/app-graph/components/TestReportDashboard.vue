<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { Table as ATable, Tag as ATag } from 'ant-design-vue';
import { computed } from 'vue';

const props = defineProps({ report: { type: Object, required: true }, selected: { type: Object, required: true } });
const failedMetrics = computed(() => props.selected.metrics.filter((item) => item.status === 'failed').length);
const metricColumns = [
  { title: '指标', dataIndex: 'label', key: 'label' },
  { title: '测试预期', dataIndex: 'expectedDisplay', key: 'expectedDisplay' },
  { title: '本次结果', dataIndex: 'currentDisplay', key: 'currentDisplay' },
  { title: '历史平均', dataIndex: 'baselineDisplay', key: 'baselineDisplay' },
  { title: '问题', dataIndex: 'issue', key: 'issue', width: 150 },
];
const metricRows = computed(() => props.selected.metrics.map((item) => ({
  ...item,
  key: item.label,
  expectedDisplay: `${item.direction === 'higher' ? '不低于' : '不高于'} ${item.threshold}${item.unit}`,
  baselineDisplay: `${item.baseline}${item.unit}`,
  currentDisplay: `${item.current}${item.unit}`,
  deltaDisplay: deltaText(item),
  issue: item.status === 'failed'
    ? `${item.label}较历史平均${item.delta >= 0 ? '上升' : '下降'} ${Math.abs(item.delta).toFixed(1)}${item.unit}`
    : '未发现异常',
})));
function deltaText(item) {
  const value = Math.abs(item.delta);
  const formatted = Number.isInteger(value) ? value : value.toFixed(1);
  return `${item.delta >= 0 ? '+' : '-'}${formatted}${item.unit}`;
}
</script>

<template>
  <div class="report-workspace">
    <div class="report-scroll">
      <section class="report-hero">
        <div>
          <p>EXECUTION REPORT · {{ report.batchId }}</p>
          <h1>{{ report.reportName }}</h1>
          <span>{{ report.generatedAt }} · {{ report.appVersion }} · {{ report.device }}</span>
        </div>
        <div class="report-score" :class="{ danger: report.summary.failedCases }">
          <strong>{{ report.score }}</strong><span>综合评分</span>
        </div>
      </section>

      <section class="report-kpis">
        <div><span>预警 URL</span><strong>{{ report.summary.alertUrls }}</strong><small>监控触发</small></div>
        <div><span>图谱匹配</span><strong>{{ report.summary.matchedUrls }}</strong><small>100% 已定位</small></div>
        <div><span>即时用例</span><strong>{{ report.summary.generatedCases }}</strong><small>按需生成</small></div>
        <div><span>执行通过率</span><strong>{{ report.summary.passRate }}%</strong><small>{{ report.summary.failedCases }} 条异常</small></div>
      </section>

      <section class="report-pipeline">
        <div class="report-section-heading"><div><span>END-TO-END</span><strong>端到端执行链</strong></div><em>脚本、后端、前端证据已对齐</em></div>
        <div class="pipeline-track">
          <div v-for="(item, index) in report.pipeline" :key="item.key" class="pipeline-stage">
            <span class="pipeline-index">0{{ index + 1 }}</span>
            <span class="pipeline-icon"><Icon :icon="index === 0 ? 'ant-design:mobile-outlined' : index === 1 ? 'ant-design:database-outlined' : 'ant-design:bar-chart-outlined'" :size="19" /></span>
            <div><strong>{{ item.label }}</strong><small>{{ item.detail }}</small></div>
            <em>{{ item.duration }}</em>
          </div>
        </div>
      </section>

      <section class="report-focus">
        <div class="report-section-heading"><div><span>SELECTED RISK</span><strong>{{ selected.match.pageTitle }} · {{ selected.scenario }}</strong></div><em>{{ selected.alertId }}</em></div>
        <div class="report-focus-grid">
          <div class="report-path-card">
            <span>即时生成路径</span>
            <div class="report-path">
              <template v-for="(page, index) in selected.testCase.path" :key="page">
                <b>{{ page }}</b><Icon v-if="index < selected.testCase.path.length - 1" icon="ant-design:arrow-right-outlined" :size="13" />
              </template>
            </div>
            <small>{{ selected.match.strategy }} · 候选 {{ selected.match.candidates }} · 置信度 {{ Math.round(selected.match.score * 100) }}%</small>
          </div>
          <div class="report-verdict-card" :class="`status-${selected.status}`">
            <span>单 URL 结论</span><strong>{{ selected.score }}</strong><em>{{ failedMetrics ? `${failedMetrics} 项指标越界` : '关键指标通过' }}</em>
          </div>
        </div>
      </section>

      <section class="report-metric-section">
        <div class="report-section-heading"><div><span>METRIC COMPARISON</span><strong>基线与本次结果</strong></div><em>{{ report.environment }}</em></div>
        <a-table
          class="report-ant-table"
          :columns="metricColumns"
          :data-source="metricRows"
          :pagination="false"
          :row-class-name="(record) => `status-${record.status}`"
          row-key="key"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <strong v-if="column.key === 'label'">{{ record.label }}</strong>
            <b v-else-if="column.key === 'currentDisplay'" class="report-current-value">{{ record.currentDisplay }}</b>
            <span v-else-if="column.key === 'expectedDisplay'" class="report-expected-value">{{ record.expectedDisplay }}</span>
            <span v-else-if="column.key === 'issue'" class="report-issue-cell">
              <a-tag :color="record.status === 'failed' ? 'error' : 'success'">
                {{ record.status === 'failed' ? '异常' : '正常' }}
              </a-tag>
              <em>{{ record.issue }}</em>
            </span>
          </template>
        </a-table>
      </section>
    </div>
  </div>
</template>
