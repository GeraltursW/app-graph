<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { computed, ref, watch } from 'vue';
import GraphButton from './shared/GraphButton.vue';

const props = defineProps({
  graph: { type: Object, required: true },
  catalog: { type: Object, required: true },
  selectedFunctionId: { type: String, default: '' },
});

const emit = defineEmits(['highlight-function']);
const collapsed = ref(new Set());

const functionsWithCoverage = computed(() => {
  const functions = props.catalog.functions || [];
  const childrenMap = new Map();
  functions.forEach((item) => {
    if (!childrenMap.has(item.parent_id)) childrenMap.set(item.parent_id, []);
    childrenMap.get(item.parent_id).push(item);
  });

  const decorate = (item) => {
    const matchedPages = matchFunctionPages(item);
    const confirmedPages = matchedPages.filter((page) => !page.ai_recursive);
    const status = getCoverageStatus(item, matchedPages, confirmedPages);
    return {
      ...item,
      matchedPages,
      matchedPageIds: matchedPages.map((page) => page.nodeId),
      coverageStatus: status,
      children: (childrenMap.get(item.function_id) || []).map(decorate),
    };
  };

  return (childrenMap.get(null) || []).map(decorate);
});

const flatRows = computed(() => {
  const rows = [];
  const append = (items) => {
    items.forEach((item) => {
      rows.push(item);
      if (!collapsed.value.has(item.function_id)) append(item.children);
    });
  };
  append(functionsWithCoverage.value);
  return rows;
});

const coverageSummary = computed(() => {
  const all = [];
  const collect = (items) => items.forEach((item) => {
    all.push(item);
    collect(item.children);
  });
  collect(functionsWithCoverage.value);
  return {
    total: all.length,
    covered: all.filter((item) => item.coverageStatus.key === 'covered').length,
    partial: all.filter((item) => ['partial', 'pending'].includes(item.coverageStatus.key)).length,
    uncovered: all.filter((item) => ['uncovered', 'limited'].includes(item.coverageStatus.key)).length,
  };
});

watch(() => props.catalog, () => {
  collapsed.value = new Set();
  emit('highlight-function', null);
});

function pageSearchText(page) {
  return [
    page.page_title,
    page.displayTitle,
    page.page_text,
    page.page_url,
    page.page_info?.domain,
  ].join(' ').toLowerCase();
}

function matchFunctionPages(item) {
  const keywords = (item.match_rules?.keywords || []).map((value) => value.toLowerCase());
  const urls = (item.match_rules?.urls || []).map((value) => value.toLowerCase());
  return props.graph.pages.filter((page) => {
    const text = pageSearchText(page);
    return keywords.some((keyword) => text.includes(keyword))
      || urls.some((keyword) => String(page.page_url || '').toLowerCase().includes(keyword));
  });
}

function getCoverageStatus(item, matchedPages, confirmedPages) {
  if (!matchedPages.length && item.automation_limited) {
    return { key: 'limited', label: '自动化受限' };
  }
  if (!matchedPages.length) return { key: 'uncovered', label: '未发现' };
  if (!confirmedPages.length) return { key: 'pending', label: '待确认' };
  if (matchedPages.length < (item.expected_pages || 1)) return { key: 'partial', label: '部分覆盖' };
  return { key: 'covered', label: '已覆盖' };
}

function toggle(item) {
  if (!item.children.length) return;
  const next = new Set(collapsed.value);
  if (next.has(item.function_id)) next.delete(item.function_id);
  else next.add(item.function_id);
  collapsed.value = next;
}

function selectFunction(item) {
  emit('highlight-function', {
    functionId: item.function_id,
    functionName: item.function_name,
    pageIds: item.matchedPageIds,
  });
}

function clearSelection() {
  emit('highlight-function', null);
}
</script>

<template>
  <div class="official-function-panel">
    <div class="function-catalog-meta">
      <div>
        <span>{{ catalog.source }}</span>
        <strong>{{ catalog.version || '等待数据' }}</strong>
      </div>
      <GraphButton
        v-if="selectedFunctionId"
        html-type="button"
        title="恢复显示全部页面"
        @click="clearSelection"
      >
        <template #icon><Icon icon="ant-design:clear-outlined" :size="13" /></template>
        清除高亮
      </GraphButton>
    </div>

    <div class="function-coverage-summary">
      <span><strong>{{ coverageSummary.total }}</strong> 功能</span>
      <span class="covered"><strong>{{ coverageSummary.covered }}</strong> 已覆盖</span>
      <span class="partial"><strong>{{ coverageSummary.partial }}</strong> 待补全</span>
      <span class="uncovered"><strong>{{ coverageSummary.uncovered }}</strong> 未覆盖</span>
    </div>

    <div class="function-table-head">
      <span>功能点 / 说明</span>
      <span>页面</span>
      <span>状态</span>
    </div>

    <div v-if="!flatRows.length" class="empty-state">当前应用暂无官方功能目录</div>
    <div v-else class="function-tree-table">
      <button
        v-for="item in flatRows"
        :key="item.function_id"
        type="button"
        class="function-tree-row"
        :class="{ active: selectedFunctionId === item.function_id }"
        @click="selectFunction(item)"
      >
        <span class="function-main" :style="{ '--function-indent': `${(item.level - 1) * 16}px` }">
          <span class="function-toggle" @click.stop="toggle(item)">
            <Icon
              v-if="item.children.length"
              :icon="collapsed.has(item.function_id) ? 'ant-design:plus-outlined' : 'ant-design:minus-outlined'"
              :size="11"
            />
          </span>
          <span>
            <strong>{{ item.function_name }}</strong>
            <em>{{ item.function_description }}</em>
          </span>
        </span>
        <span class="function-page-count">{{ item.matchedPages.length }}</span>
        <span class="function-status" :class="`status-${item.coverageStatus.key}`">
          {{ item.coverageStatus.label }}
        </span>
      </button>
    </div>
  </div>
</template>
