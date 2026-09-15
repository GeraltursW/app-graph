<script setup>
import { BarChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { init, use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const props = defineProps({
  data: { type: Array, default: () => [] },
  metric: { type: String, default: 'passRate' },
});

const chartEl = ref(null);
let chart = null;
let resizeObserver = null;

const definitions = {
  passRate: { name: '通过率', unit: '%', threshold: 90, direction: 'higher', color: '#1677ff', area: true },
  fps: { name: '平均 FPS', unit: 'fps', threshold: 52, direction: 'higher', color: '#13a8a8', area: true },
  power: { name: '平均功耗', unit: 'W', threshold: 1.3, direction: 'lower', color: '#722ed1', area: true },
  issueCount: { name: '异常数量', unit: '项', threshold: 2, direction: 'lower', color: '#fa8c16', type: 'bar' },
};
const definition = computed(() => definitions[props.metric] || definitions.passRate);

function renderChart() {
  if (!chartEl.value) return;
  if (!chart) chart = init(chartEl.value);
  const meta = definition.value;
  const values = props.data.map((item) => item[props.metric]);
  chart.setOption({
    animationDuration: 360,
    color: [meta.color],
    grid: { left: 42, right: 18, top: 28, bottom: 38 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,.98)',
      borderColor: '#d9d9d9',
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: '#262626', fontSize: 11 },
      formatter(params) {
        const point = params[0];
        const source = props.data[point.dataIndex];
        return [
          `<strong>${source.period}</strong>`,
          `${meta.name}：${point.value}${meta.unit}`,
          `执行：${source.runCount} 次`,
          `异常：${source.issueCount} 项`,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: meta.type === 'bar',
      data: props.data.map((item) => item.period),
      axisLine: { lineStyle: { color: '#d9d9d9' } },
      axisTick: { show: false },
      axisLabel: { color: '#8c8c8c', fontSize: 10, interval: 1 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitNumber: 4,
      axisLabel: { color: '#8c8c8c', fontSize: 10, formatter: `{value}${meta.unit}` },
      splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
    },
    series: [{
      name: meta.name,
      type: meta.type || 'line',
      data: values,
      smooth: meta.type !== 'bar' ? 0.28 : false,
      symbol: 'circle',
      symbolSize: 6,
      barMaxWidth: 22,
      lineStyle: { width: 2 },
      areaStyle: meta.area ? { color: `${meta.color}18` } : undefined,
      itemStyle: {
        color(params) {
          const failed = meta.direction === 'higher'
            ? params.value < meta.threshold
            : params.value > meta.threshold;
          return failed ? '#ff4d4f' : meta.color;
        },
      },
      markLine: {
        silent: true,
        symbol: 'none',
        label: { formatter: `阈值 ${meta.threshold}${meta.unit}`, color: '#8c8c8c', fontSize: 9 },
        lineStyle: { color: '#ff7875', type: 'dashed', width: 1 },
        data: [{ yAxis: meta.threshold }],
      },
    }],
  }, true);
}

onMounted(() => {
  nextTick(renderChart);
  resizeObserver = new ResizeObserver(() => chart?.resize());
  if (chartEl.value) resizeObserver.observe(chartEl.value);
});
watch(() => [props.data, props.metric], () => nextTick(renderChart), { deep: true });
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div ref="chartEl" class="performance-trend-chart" role="img" :aria-label="`${definition.name}周期趋势图`" />
</template>
