<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
const props = defineProps<{ reports: any[]; group: string }>();
const host = ref<HTMLElement>(); let chart: echarts.ECharts | undefined; let observer: ResizeObserver;
function render() {
  if (!chart) return;
  const rows = [...props.reports].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const values = rows.map(r => {
    const apps = r.apps.filter((a: any) => props.group === 'ALL' || a.appGroups.includes(props.group));
    const valid = apps.filter((a: any) => a.totalUrlCount > 0), denominator = valid.reduce((s: number, a: any) => s + a.totalUrlCount, 0);
    return { newCount: apps.reduce((s: number, a: any) => s + a.newUrlCount, 0), rate: denominator ? +(valid.reduce((s: number, a: any) => s + Math.min(a.baselineCoveredCount ?? a.coveredUrlCount, a.totalUrlCount), 0) / denominator * 100).toFixed(2) : null };
  });
  chart.setOption({ tooltip: { trigger: 'axis' }, legend: { data: ['新增 URL', '全量覆盖率'] }, grid: { left: 55, right: 55, top: 45, bottom: 50 },
    xAxis: { type: 'category', data: rows.map(r => `${r.date} ${r.reportType === 'MORNING' ? '早' : '晚'}`) },
    yAxis: [{ type: 'value', minInterval: 1, name: 'URL' }, { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } }],
    series: [{ name: '新增 URL', type: 'line', data: values.map(v => v.newCount), itemStyle: { color: '#1677ff' } }, { name: '全量覆盖率', type: 'line', yAxisIndex: 1, data: values.map(v => v.rate), itemStyle: { color: '#08979c' } }] }, true);
}
onMounted(() => { chart = echarts.init(host.value!); observer = new ResizeObserver(() => chart?.resize()); observer.observe(host.value!); render(); });
watch(() => [props.reports, props.group], async () => { await nextTick(); render(); }, { deep: true });
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose(); });
</script>
<template><div ref="host" class="coverage-chart" role="img" aria-label="新增 URL 与全量覆盖率趋势" /></template>
<style scoped>.coverage-chart{width:100%;height:290px;min-width:0}</style>
