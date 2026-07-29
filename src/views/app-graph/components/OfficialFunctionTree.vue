<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { computed, ref, watch } from 'vue';
import GraphButton from './shared/GraphButton.vue';

const props = defineProps({
  graph: { type: Object, required: true },
  catalog: { type: Object, required: true },
  selectedFunctionId: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
});

const emit = defineEmits(['highlight-function', 'import-tree', 'reload']);
const collapsed = ref(new Set());

const functionsWithCoverage = computed(() => {
  const functions = props.catalog.functions || [];
  const childrenMap = new Map();
  functions.forEach((item) => {
    if (!childrenMap.has(item.parentId)) childrenMap.set(item.parentId, []);
    childrenMap.get(item.parentId).push(item);
  });

  const decorate = (item) => {
    const matchedPages = matchFunctionPages(item);
    return {
      ...item,
      matchedPages,
      matchedPageIds: matchedPages.map((page) => page.nodeId),
      coverageStatus: getCoverageStatus(item, matchedPages),
      children: (childrenMap.get(item.functionId) || []).map(decorate),
    };
  };

  return (childrenMap.get(null) || []).map(decorate);
});

const flatRows = computed(() => {
  const rows = [];
  const append = (items) => {
    items.forEach((item) => {
      rows.push(item);
      if (!collapsed.value.has(item.functionId)) append(item.children);
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
  const bindings = all.flatMap((item) => [
    ...(item.pageBindings || []),
    ...(item.actionBindings || []),
  ]);
  return {
    total: all.length,
    automatic: bindings.filter((item) => item.reviewStatus === 'autoConfirmed').length,
    reviewed: bindings.filter((item) => ['humanConfirmed', 'confirmed'].includes(item.reviewStatus)).length,
    inherited: bindings.filter((item) => item.reviewStatus === 'inherited').length,
    pending: bindings.filter((item) => ['pendingReview', 'suggested'].includes(item.reviewStatus)).length,
    conflicted: bindings.filter((item) => item.reviewStatus === 'conflicted').length,
    uncovered: all.filter((item) => ['uncovered', 'limited'].includes(item.coverageStatus.key)).length,
  };
});

watch(() => props.catalog, () => {
  collapsed.value = new Set();
  emit('highlight-function', null);
});

function pageSearchText(page) {
  return [
    page.pageTitle,
    page.displayTitle,
    page.pageText,
    page.pageUrl,
    page.pageInfo?.domain,
  ].join(' ').toLowerCase();
}

function matchFunctionPages(item) {
  if (item.hasBindingSnapshot) {
    const boundPageIds = new Set(
      (item.pageBindings || [])
        .filter((binding) => binding.reviewStatus !== 'rejected')
        .map((binding) => String(binding.pageHashId || binding.pageId || ''))
        .filter(Boolean),
    );
    return props.graph.pages.filter((page) => boundPageIds.has(String(page.pageId)));
  }

  const keywords = (item.matchRules?.keywords || []).map((value) => String(value).toLowerCase());
  const urls = (item.matchRules?.urls || []).map((value) => String(value).toLowerCase());
  return props.graph.pages.filter((page) => {
    const text = pageSearchText(page);
    return keywords.some((keyword) => text.includes(keyword))
      || urls.some((keyword) => String(page.pageUrl || '').toLowerCase().includes(keyword));
  });
}

function getCoverageStatus(item, matchedPages) {
  const bindings = [...(item.pageBindings || []), ...(item.actionBindings || [])];
  const statuses = new Set(bindings.map((binding) => binding.reviewStatus));
  if (statuses.has('conflicted')) return { key: 'conflicted', label: '有冲突' };
  if (statuses.has('pendingReview') || statuses.has('suggested')) {
    return { key: 'pending', label: '待复核' };
  }
  if (statuses.has('humanConfirmed') || statuses.has('confirmed')) {
    return { key: 'reviewed', label: '已复核' };
  }
  if (statuses.has('autoConfirmed')) return { key: 'automatic', label: '自动确认' };
  if (statuses.has('inherited')) return { key: 'inherited', label: '历史继承' };
  if (matchedPages.length) return { key: 'partial', label: '规则命中' };
  if (item.automationLimited) return { key: 'limited', label: '受限' };
  return { key: 'uncovered', label: '未覆盖' };
}

function toggle(item) {
  if (!item.children.length) return;
  const next = new Set(collapsed.value);
  if (next.has(item.functionId)) next.delete(item.functionId);
  else next.add(item.functionId);
  collapsed.value = next;
}

function selectFunction(item) {
  emit('highlight-function', {
    functionId: item.functionId,
    functionName: item.functionName,
    pageIds: item.matchedPageIds,
  });
}
</script>

<template>
  <div class="official-function-panel">
    <div class="function-catalog-meta">
      <div class="function-catalog-heading">
        <span>{{ catalog.source }}</span>
        <strong>
          {{ catalog.version || '等待目录数据' }}
          <template v-if="catalog.run?.startedAt"> · {{ catalog.run.status }}</template>
        </strong>
      </div>
      <div class="function-catalog-actions">
        <GraphButton html-type="button" title="导入最新 Function Tree" @click="emit('import-tree')">
          <template #icon><Icon icon="ant-design:upload-outlined" :size="13" /></template>
          导入
        </GraphButton>
        <GraphButton
          icon-only
          html-type="button"
          title="重新查询 Function Tree"
          :disabled="loading"
          @click="emit('reload')"
        >
          <template #icon>
            <Icon :icon="loading ? 'ant-design:loading-outlined' : 'ant-design:reload-outlined'" :size="13" />
          </template>
        </GraphButton>
      </div>
    </div>

    <div v-if="error" class="function-query-state error">{{ error }}</div>
    <div v-else-if="loading" class="function-query-state">
      <Icon icon="ant-design:loading-outlined" :size="14" />
      正在查询厂商功能树与匹配结果
    </div>

    <template v-else>
      <div class="function-coverage-summary">
        <span><strong>{{ coverageSummary.total }}</strong> 功能</span>
        <span class="covered"><strong>{{ coverageSummary.automatic }}</strong> 自动确认</span>
        <span class="reviewed"><strong>{{ coverageSummary.reviewed }}</strong> 已复核</span>
        <span class="inherited"><strong>{{ coverageSummary.inherited }}</strong> 继承</span>
        <span class="partial"><strong>{{ coverageSummary.pending }}</strong> 待复核</span>
        <span class="conflicted"><strong>{{ coverageSummary.conflicted }}</strong> 冲突</span>
        <span class="uncovered"><strong>{{ coverageSummary.uncovered }}</strong> 未覆盖</span>
      </div>

      <div class="function-table-head">
        <span>功能点 / 说明</span>
        <span>页面</span>
        <span>动作</span>
        <span>状态</span>
      </div>

      <div v-if="!flatRows.length" class="empty-state">当前应用暂无厂商 Function Tree</div>
      <div v-else class="function-tree-table">
        <button
          v-for="item in flatRows"
          :key="item.functionId"
          type="button"
          class="function-tree-row"
          :class="{ active: selectedFunctionId === item.functionId }"
          @click="selectFunction(item)"
        >
          <span class="function-main" :style="{ '--function-indent': `${(item.level - 1) * 14}px` }">
            <span class="function-toggle" @click.stop="toggle(item)">
              <Icon
                v-if="item.children.length"
                :icon="collapsed.has(item.functionId) ? 'ant-design:plus-outlined' : 'ant-design:minus-outlined'"
                :size="11"
              />
            </span>
            <span>
              <strong>{{ item.functionName }}</strong>
              <em :title="item.functionDescription">{{ item.functionDescription || item.functionPath }}</em>
            </span>
          </span>
          <span class="function-page-count">{{ item.matchedPages.length }}</span>
          <span class="function-action-count">{{ item.actionBindings?.length || 0 }}</span>
          <span class="function-status" :class="`status-${item.coverageStatus.key}`">
            {{ item.coverageStatus.label }}
          </span>
        </button>
      </div>
    </template>

    <GraphButton
      v-if="selectedFunctionId"
      class="function-clear-highlight"
      html-type="button"
      @click="emit('highlight-function', null)"
    >
      <template #icon><Icon icon="ant-design:clear-outlined" :size="13" /></template>
      清除功能高亮
    </GraphButton>
  </div>
</template>
