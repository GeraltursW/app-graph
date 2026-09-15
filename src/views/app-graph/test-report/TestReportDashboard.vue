<script setup>
import Icon from '@/components/Icon/Icon.vue';
import {
  Card as ACard,
  Col as ACol,
  Row as ARow,
  Segmented as ASegmented,
  Statistic as AStatistic,
  Table as ATable,
  Tag as ATag,
} from 'ant-design-vue';
import { computed, ref } from 'vue';
import PerformanceTrendChart from './PerformanceTrendChart.vue';

const props = defineProps({ report: { type: Object, required: true }, selected: { type: Object, required: true } });
const failedMetrics = computed(() => props.selected.metrics.filter((item) => item.status === 'failed').length);
const trendMetric = ref('passRate');
const trendOptions = [
  { label: '通过率', value: 'passRate' },
  { label: '平均 FPS', value: 'fps' },
  { label: '平均功耗', value: 'power' },
  { label: '异常数量', value: 'issueCount' },
];
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
          <p>{{ report.batchId }}</p>
          <h1>{{ report.reportName }}</h1>
          <span>{{ report.generatedAt }} · {{ report.appVersion }} · {{ report.device }}</span>
        </div>
        <div class="report-head-status">
          <a-tag :color="report.summary.failedCases ? 'error' : 'success'">{{ report.conclusion }}</a-tag>
          <span>环境：{{ report.environment }}</span>
        </div>
      </section>

      <a-row :gutter="12" class="report-stat-row">
        <a-col :span="6"><a-card size="small"><a-statistic title="预警 URL" :value="report.summary.alertUrls"><template #prefix><Icon icon="ant-design:warning-outlined" :size="16" /></template></a-statistic><small>监控周期内触发</small></a-card></a-col>
        <a-col :span="6"><a-card size="small"><a-statistic title="图谱匹配" :value="report.summary.matchedUrls"><template #prefix><Icon icon="ant-design:deployment-unit-outlined" :size="16" /></template></a-statistic><small>URL 已全部定位</small></a-card></a-col>
        <a-col :span="6"><a-card size="small"><a-statistic title="即时用例" :value="report.summary.generatedCases"><template #prefix><Icon icon="ant-design:thunderbolt-outlined" :size="16" /></template></a-statistic><small>按风险动态生成</small></a-card></a-col>
        <a-col :span="6"><a-card size="small"><a-statistic title="执行通过率" :value="report.summary.passRate" suffix="%" :value-style="{ color: report.summary.passRate < 90 ? '#cf1322' : '#3f8600' }"><template #prefix><Icon icon="ant-design:check-circle-outlined" :size="16" /></template></a-statistic><small>{{ report.summary.failedCases }} 条异常用例</small></a-card></a-col>
      </a-row>

      <a-card size="small" class="report-admin-card report-trend-card">
        <template #title><span>周期测试趋势</span></template>
        <template #extra><a-segmented v-model:value="trendMetric" :options="trendOptions" size="small" /></template>
        <div class="report-trend-summary">
          <span>{{ selected.match.pageTitle }}</span>
          <a-tag color="blue">近 12 个周期</a-tag>
          <em>红色数据点表示越过阈值，可悬停查看批次执行次数和异常数量</em>
        </div>
        <PerformanceTrendChart :data="selected.trend" :metric="trendMetric" />
      </a-card>

      <a-card size="small" class="report-admin-card report-focus">
        <template #title><span>{{ selected.match.pageTitle }} · {{ selected.scenario }}</span></template>
        <template #extra><a-tag>{{ selected.alertId }}</a-tag></template>
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
      </a-card>

      <a-card title="测试预期与结果" size="small" class="report-admin-card report-metric-section">
        <template #extra><span class="report-card-extra">本次结果 / 测试预期 / 历史平均 / 问题</span></template>
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
      </a-card>
    </div>
  </div>
</template>
