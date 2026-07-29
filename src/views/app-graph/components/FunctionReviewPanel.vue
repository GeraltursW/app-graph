<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { Segmented as ASegmented } from 'ant-design-vue';
import { computed, ref } from 'vue';
import GraphButton from './shared/GraphButton.vue';
import { Badge, ScrollArea } from './ui';

const props = defineProps({
  functionItem: { type: Object, required: true },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'locate', 'review']);
const filter = ref('attention');
const filterOptions = [
  { label: '需处理', value: 'attention' },
  { label: '全部', value: 'all' },
  { label: '已确认', value: 'confirmed' },
];

const confirmedStatuses = new Set(['autoConfirmed', 'humanConfirmed', 'inherited', 'confirmed']);
const attentionStatuses = new Set(['pendingReview', 'suggested', 'conflicted']);

const pageBindings = computed(() => filterBindings(props.functionItem.pageBindings || []));
const actionBindings = computed(() => filterBindings(props.functionItem.actionBindings || []));
const pendingPages = computed(() => (props.functionItem.pageBindings || [])
  .filter((item) => attentionStatuses.has(item.reviewStatus)));
const pendingActions = computed(() => (props.functionItem.actionBindings || [])
  .filter((item) => attentionStatuses.has(item.reviewStatus)));

const summary = computed(() => {
  const bindings = [
    ...(props.functionItem.pageBindings || []),
    ...(props.functionItem.actionBindings || []),
  ];
  return {
    automatic: bindings.filter((item) => item.reviewStatus === 'autoConfirmed').length,
    reviewed: bindings.filter((item) => ['humanConfirmed', 'confirmed'].includes(item.reviewStatus)).length,
    inherited: bindings.filter((item) => item.reviewStatus === 'inherited').length,
    pending: bindings.filter((item) => ['pendingReview', 'suggested'].includes(item.reviewStatus)).length,
    conflicted: bindings.filter((item) => item.reviewStatus === 'conflicted').length,
  };
});

function filterBindings(bindings) {
  if (filter.value === 'attention') {
    return bindings.filter((item) => attentionStatuses.has(item.reviewStatus));
  }
  if (filter.value === 'confirmed') {
    return bindings.filter((item) => confirmedStatuses.has(item.reviewStatus));
  }
  return bindings.filter((item) => item.reviewStatus !== 'rejected');
}

function statusLabel(status) {
  return {
    autoConfirmed: '自动确认',
    humanConfirmed: '人工复核',
    inherited: '历史继承',
    pendingReview: '待复核',
    conflicted: '有冲突',
    rejected: '已拒绝',
    confirmed: '人工复核',
    suggested: '待复核',
  }[status] || status;
}

function actionLayerLabel(layer) {
  return {
    popupAction: '弹层',
    stateAction: '状态',
    externalAction: '外部',
    pageNaviAction: '跳转',
  }[layer] || layer || '动作';
}

function score(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function review(targetType, bindings, reviewStatus) {
  const bindingIds = bindings.map((item) => String(item.bindingId)).filter(Boolean);
  if (!bindingIds.length) return;
  emit('review', { targetType, bindingIds, reviewStatus });
}
</script>

<template>
  <aside class="inspector function-review-panel">
    <div class="panel-head function-review-head">
      <div>
        <p class="eyebrow">Function Review</p>
        <h2>{{ functionItem.functionName }}</h2>
        <span>{{ functionItem.functionPath || functionItem.functionDescription }}</span>
      </div>
      <GraphButton icon-only title="关闭功能复核" @click="emit('close')">
        <template #icon><Icon icon="ant-design:close-outlined" :size="14" /></template>
      </GraphButton>
    </div>

    <ScrollArea class="inspector-scroll">
      <div class="function-review-content">
        <div class="function-review-summary">
          <span><strong>{{ summary.automatic }}</strong>自动确认</span>
          <span><strong>{{ summary.reviewed }}</strong>人工复核</span>
          <span><strong>{{ summary.inherited }}</strong>继承</span>
          <span><strong>{{ summary.pending }}</strong>待复核</span>
          <span class="conflicted"><strong>{{ summary.conflicted }}</strong>冲突</span>
        </div>

        <a-segmented v-model:value="filter" :options="filterOptions" size="small" block />

        <section class="function-binding-section">
          <div class="function-binding-head">
            <div>
              <strong>页面候选</strong>
              <Badge variant="secondary">{{ pageBindings.length }}</Badge>
            </div>
            <div v-if="filter === 'attention' && pendingPages.length" class="function-binding-bulk">
              <GraphButton :disabled="loading" @click="review('page', pendingPages, 'rejected')">整组拒绝</GraphButton>
              <GraphButton type="primary" :disabled="loading" @click="review('page', pendingPages, 'humanConfirmed')">
                整组确认
              </GraphButton>
            </div>
          </div>

          <div v-if="!pageBindings.length" class="function-review-empty">当前筛选下没有页面候选</div>
          <article v-for="binding in pageBindings" :key="binding.bindingId" class="function-binding-item">
            <button type="button" class="function-binding-main" @click="emit('locate', binding)">
              <span>
                <strong>{{ binding.pageTitle }}</strong>
                <em>{{ binding.pageHashId }}</em>
              </span>
              <span class="function-binding-score">{{ score(binding.matchScore) }}</span>
            </button>
            <div class="function-binding-meta">
              <span :class="`binding-status status-${binding.reviewStatus}`">
                {{ statusLabel(binding.reviewStatus) }}
              </span>
              <span>分差 {{ score(binding.scoreMargin) }}</span>
              <span>{{ binding.decisionSource || binding.bindingSource }}</span>
            </div>
            <div v-if="attentionStatuses.has(binding.reviewStatus)" class="function-binding-actions">
              <GraphButton :disabled="loading" @click="review('page', [binding], 'rejected')">拒绝</GraphButton>
              <GraphButton type="primary" :disabled="loading" @click="review('page', [binding], 'humanConfirmed')">
                确认
              </GraphButton>
            </div>
          </article>
        </section>

        <section class="function-binding-section">
          <div class="function-binding-head">
            <div>
              <strong>四层动作候选</strong>
              <Badge variant="secondary">{{ actionBindings.length }}</Badge>
            </div>
            <div v-if="filter === 'attention' && pendingActions.length" class="function-binding-bulk">
              <GraphButton :disabled="loading" @click="review('action', pendingActions, 'rejected')">整组拒绝</GraphButton>
              <GraphButton type="primary" :disabled="loading" @click="review('action', pendingActions, 'humanConfirmed')">
                整组确认
              </GraphButton>
            </div>
          </div>

          <div v-if="!actionBindings.length" class="function-review-empty">当前筛选下没有动作候选</div>
          <article v-for="binding in actionBindings" :key="binding.bindingId" class="function-binding-item">
            <button type="button" class="function-binding-main" @click="emit('locate', binding)">
              <span>
                <strong>{{ binding.actionName }}</strong>
                <em>{{ binding.pageTitle }} · {{ actionLayerLabel(binding.actionLayer) }}</em>
              </span>
              <span class="function-binding-score">{{ score(binding.matchScore) }}</span>
            </button>
            <div class="function-binding-meta">
              <span :class="`binding-status status-${binding.reviewStatus}`">
                {{ statusLabel(binding.reviewStatus) }}
              </span>
              <span>分差 {{ score(binding.scoreMargin) }}</span>
              <span>{{ binding.policyVersion }}</span>
            </div>
            <div v-if="attentionStatuses.has(binding.reviewStatus)" class="function-binding-actions">
              <GraphButton :disabled="loading" @click="review('action', [binding], 'rejected')">拒绝</GraphButton>
              <GraphButton type="primary" :disabled="loading" @click="review('action', [binding], 'humanConfirmed')">
                确认
              </GraphButton>
            </div>
          </article>
        </section>
      </div>
    </ScrollArea>
  </aside>
</template>
