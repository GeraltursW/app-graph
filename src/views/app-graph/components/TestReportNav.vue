<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { computed, ref } from 'vue';
import { Badge, ScrollArea } from './ui';

const props = defineProps({
  report: { type: Object, required: true },
  selectedReportId: { type: String, default: '' },
});
const emit = defineEmits(['select-report']);
const keyword = ref('');
const filter = ref('all');
const visibleReports = computed(() => props.report.urlReports.filter((item) => {
  const matchesFilter = filter.value === 'all' || item.status === filter.value;
  const text = `${item.url} ${item.scenario} ${item.match.pageTitle}`.toLowerCase();
  return matchesFilter && text.includes(keyword.value.trim().toLowerCase());
}));
</script>

<template>
  <aside class="sidebar report-sidebar">
    <div class="case-sidebar-head report-sidebar-head">
      <div><span>RISK REPORT</span><strong>风险 URL</strong></div>
      <Badge variant="secondary">{{ report.summary.alertUrls }}</Badge>
    </div>
    <div class="report-filter-row">
      <button v-for="item in [{ key: 'all', label: '全部' }, { key: 'failed', label: '异常' }, { key: 'warning', label: '观察' }]" :key="item.key" type="button" :class="{ active: filter === item.key }" @click="filter = item.key">
        {{ item.label }}
      </button>
    </div>
    <label class="case-search report-search">
      <Icon icon="ant-design:search-outlined" :size="13" />
      <input v-model="keyword" type="search" placeholder="搜索 URL、页面或场景" />
    </label>
    <ScrollArea class="case-list-scroll">
      <div class="report-url-list">
        <button v-for="item in visibleReports" :key="item.reportId" type="button" class="report-url-item" :class="[{ active: selectedReportId === item.reportId }, `status-${item.status}`]" @click="emit('select-report', item.reportId)">
          <span class="report-risk-dot" />
          <span class="report-url-copy">
            <strong>{{ item.match.pageTitle }}</strong>
            <em>{{ item.url }}</em>
            <small>{{ item.scenario }} · {{ Math.round(item.match.score * 100) }}% 匹配</small>
          </span>
          <b>{{ item.score }}</b>
        </button>
        <div v-if="!visibleReports.length" class="empty-state">没有符合条件的报告</div>
      </div>
    </ScrollArea>
  </aside>
</template>
