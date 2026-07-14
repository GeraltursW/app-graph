<script setup>
import Icon from '@/components/Icon/Icon.vue';
import {
  EdgeEvent,
  Graph,
  NodeEvent,
} from '@antv/g6';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { buildImageApiUrl } from '../info.api';
import { getOutgoingEdges, normalizeImageUrls } from '../data/graph.js';
import { registerAppPageNode } from './graph/AppPageNode.js';
import GraphButton from './shared/GraphButton.vue';
import SmartImage from './shared/SmartImage.vue';

const props = defineProps({
  graph: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  keyword: { type: String, default: '' },
  selected: { type: Object, required: true },
  layoutMode: { type: String, default: 'horizontal' },
  layoutRevision: { type: Number, default: 0 },
});

const emit = defineEmits(['select-node', 'select-edge']);
const containerRef = ref(null);
const previewPage = ref(null);
const collapsed = ref(new Set());
const rendering = ref(false);
let graphInstance = null;
let resizeObserver = null;
let renderSequence = 0;
let selectedElement = null;
let renderQueue = Promise.resolve();
let preparedGraphKey = '';

const clusterTones = [
  { accent: '#1769e0', stroke: '#78aef2', fill: '#dcecff', surface: '#edf6ff' },
  { accent: '#087ea4', stroke: '#67bfd3', fill: '#d9f2f7', surface: '#ebf9fb' },
  { accent: '#4f46e5', stroke: '#9b96f4', fill: '#e7e5ff', surface: '#f1f0ff' },
  { accent: '#16845b', stroke: '#73c6a7', fill: '#ddf5eb', surface: '#eefaf5' },
  { accent: '#be3f68', stroke: '#e49ab2', fill: '#f9e2ea', surface: '#fdf1f5' },
];
const floatingTone = { accent: '#b7791f', stroke: '#e7bd63', fill: '#fff0c9', surface: '#fff8e7' };

const normalizedKeyword = computed(() => props.keyword.trim().toLowerCase());
const hoveredPage = ref(null);
const rootIds = computed(() => [...props.graph.roots, ...props.graph.floatingRoots]);
const previewCandidates = computed(() => {
  const image = normalizeImageUrls(previewPage.value || {})[0];
  return image ? [buildImageApiUrl(image)] : [];
});

function searchableText(page) {
  return [
    page.page_title,
    page.displayTitle,
    page.page_text,
    page.page_url,
    page.aiInference?.label,
    page.aiInference?.reason,
    JSON.stringify(page.page_info || {}),
  ].join(' ').toLowerCase();
}

function formatEdgeControlLabel(edge = {}) {
  const label = String(edge.label || edge.widget_description || '进入').trim();
  const controlName = label.replace(/^(点击|轻触|打开|进入)/, '').trim() || label;
  return controlName.length > 8 ? `${controlName.slice(0, 8)}...` : controlName;
}

function shouldShowEdgeControl(edge = {}) {
  if (props.graph.pages.length <= 120) return true;
  if (rootIds.value.includes(edge.from)) return true;
  return Boolean(props.selected?.id)
    && (edge.id === props.selected.id || edge.from === props.selected.id || edge.to === props.selected.id);
}

function getVisibleIds() {
  const visible = new Set();
  const visiting = new Set();
  const visit = (nodeId) => {
    if (!nodeId || visible.has(nodeId) || visiting.has(nodeId)) return;
    visiting.add(nodeId);
    visible.add(nodeId);
    if (!collapsed.value.has(nodeId)) {
      getOutgoingEdges(props.graph, nodeId).forEach((edge) => visit(edge.to));
    }
    visiting.delete(nodeId);
  };
  rootIds.value.forEach(visit);
  return visible;
}

function prepareGraphVisibility() {
  const graphKey = [
    props.graph.pages.length,
    props.graph.edges.length,
    ...props.graph.roots,
    ...props.graph.floatingRoots,
  ].join(':');
  if (preparedGraphKey === graphKey) return;
  preparedGraphKey = graphKey;
  collapsed.value = props.graph.pages.length > 120
    ? new Set(props.graph.pages
        .filter((page) => page.level === 2 && !page.isFloating && getOutgoingEdges(props.graph, page.nodeId).length)
        .map((page) => page.nodeId))
    : new Set();
}

function getNodeSize() {
  return [196, 258];
}

function getClusterKey(page) {
  if (page.isFloating) return 'floating';
  let cursor = page;
  while (cursor?.parentId) {
    const parent = props.graph.pageMap.get(cursor.parentId);
    if (!parent || parent.level <= 1) return cursor.nodeId;
    cursor = parent;
  }
  return 'root';
}

function getClusterTone(clusterKey) {
  if (clusterKey === 'floating') return floatingTone;
  const keys = [...new Set(props.graph.pages
    .map(getClusterKey)
    .filter((key) => key !== 'root' && key !== 'floating'))];
  return clusterTones[Math.max(0, keys.indexOf(clusterKey)) % clusterTones.length];
}

function getClusterLabel(clusterKey) {
  if (clusterKey === 'floating') return '游离 URL';
  return props.graph.pageMap.get(clusterKey)?.displayTitle || '功能分区';
}

function toggleCollapse(nodeId) {
  const next = new Set(collapsed.value);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  collapsed.value = next;
  renderGraph({ fit: true });
}

function openPreview(page) {
  previewPage.value = page;
}

function toG6Data() {
  const visibleIds = getVisibleIds();
  const keyword = normalizedKeyword.value;
  const [width, height] = getNodeSize();
  const visiblePages = props.graph.pages.filter((page) => visibleIds.has(page.nodeId));
  const clusterCounts = visiblePages.reduce((counts, page) => {
    const clusterKey = getClusterKey(page);
    if (clusterKey !== 'root') counts.set(clusterKey, (counts.get(clusterKey) || 0) + 1);
    return counts;
  }, new Map());
  return {
    nodes: visiblePages
      .map((page) => {
        const outgoingCount = getOutgoingEdges(props.graph, page.nodeId).length;
        const firstImage = normalizeImageUrls(page)[0];
        const clusterKey = getClusterKey(page);
        const tone = getClusterTone(clusterKey);
        return {
          id: page.nodeId,
          combo: clusterKey === 'root' ? undefined : `cluster:${clusterKey}`,
          data: { page, clusterKey },
          style: {
            size: [width, height],
            title: page.displayTitle,
            description: page.page_text,
            pageUrl: page.page_url,
            imageSrc: firstImage ? buildImageApiUrl(firstImage) : '',
            metaText: `L${page.level}  ${outgoingCount} 个下级`,
            outgoingCount,
            collapsed: collapsed.value.has(page.nodeId),
            floating: page.isFloating,
            compact: false,
            accentColor: tone.accent,
            badgeText: page.ai_recursive ? 'AI 推断' : page.isFloating ? '游离' : '',
            aiRecursive: page.ai_recursive,
            matched: !keyword || searchableText(page).includes(keyword),
            onPreview: () => openPreview(page),
            onToggle: () => toggleCollapse(page.nodeId),
          },
        };
      }),
    edges: props.graph.edges
      .filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to))
      .map((edge) => ({
        id: edge.id,
        source: edge.from,
        target: edge.to,
        data: edge,
      })),
    combos: [...clusterCounts.entries()].map(([clusterKey, count]) => ({
      id: `cluster:${clusterKey}`,
      data: {
        label: getClusterLabel(clusterKey),
        count,
        tone: getClusterTone(clusterKey),
      },
    })),
  };
}

function getLayout() {
  const [width, height] = getNodeSize();
  if (props.layoutMode === 'radial') {
    return {
      type: 'combo-combined',
      nodeSize: [width, height],
      comboPadding: 70,
      spacing: 120,
    };
  }
  return {
    type: 'dagre',
    rankdir: props.layoutMode === 'vertical' ? 'TB' : 'LR',
    nodeSize: [width, height],
    nodesep: 74,
    ranksep: 170,
    ranker: 'network-simplex',
  };
}

function getBehaviors() {
  return [
    'drag-canvas',
    'zoom-canvas',
    'drag-element',
    {
      key: 'keep-controls-readable',
      type: 'fix-element-size',
      enable: true,
      reset: true,
      node: [{ shape: 'key', fields: ['lineWidth'] }],
      edge: [{ shape: 'key', fields: ['lineWidth'] }, { shape: 'label' }],
      combo: [{ shape: 'key', fields: ['lineWidth'] }, { shape: 'label' }],
    },
  ];
}

function createGraph() {
  if (!containerRef.value || graphInstance) return;
  const nodeType = registerAppPageNode();
  graphInstance = new Graph({
    container: containerRef.value,
    autoResize: true,
    padding: 56,
    data: toG6Data(),
    layout: getLayout(),
    node: {
      type: nodeType,
      style: {
        fill: (datum) => getClusterTone(datum.data.clusterKey).surface,
        stroke: (datum) => datum.data.page.ai_recursive
          ? '#eab308'
          : datum.data.page.isFloating ? '#f59e0b' : '#b9c9dc',
        lineWidth: (datum) => datum.data.page.ai_recursive || datum.data.page.isFloating ? 2 : 1.5,
        radius: 6,
        shadowColor: 'rgba(40, 79, 128, 0.15)',
        shadowBlur: 12,
        shadowOffsetY: 4,
        opacity: (datum) => datum.style.matched ? 1 : 0.24,
        cursor: 'pointer',
        port: true,
        ports: [{ placement: 'left' }, { placement: 'right' }, { placement: 'top' }, { placement: 'bottom' }],
      },
      state: {
        selected: { stroke: '#1677ff', lineWidth: 3, shadowColor: 'rgba(22, 119, 255, 0.3)', shadowBlur: 18 },
      },
    },
    combo: {
      type: 'rect',
      style: {
        fill: (datum) => datum.data.tone.fill,
        fillOpacity: 0.32,
        stroke: (datum) => datum.data.tone.stroke,
        strokeOpacity: 0.88,
        lineWidth: 2,
        lineDash: [8, 6],
        radius: 10,
        padding: [54, 28, 30, 28],
        labelText: (datum) => `${datum.data.label} · ${datum.data.count}`,
        labelPlacement: 'top-left',
        labelFill: '#ffffff',
        labelFontSize: 15,
        labelFontWeight: 700,
        labelBackground: true,
        labelBackgroundFill: (datum) => datum.data.tone.accent,
        labelBackgroundOpacity: 1,
        labelBackgroundRadius: 5,
        labelBackgroundPadding: [6, 10],
      },
    },
    edge: {
      type: (datum) => props.layoutMode === 'radial' ? 'line' : 'polyline',
      style: {
        stroke: '#6d8fba',
        lineWidth: 1.8,
        endArrow: true,
        endArrowSize: 8,
        labelText: (datum) => shouldShowEdgeControl(datum.data)
          ? formatEdgeControlLabel(datum.data)
          : '',
        labelPlacement: 0.68,
        labelAutoRotate: false,
        labelFill: '#ffffff',
        labelFontSize: 13,
        labelFontWeight: 700,
        labelBackground: true,
        labelBackgroundFill: (datum) => {
          const sourcePage = props.graph.pageMap.get(datum.data.from);
          return getClusterTone(sourcePage ? getClusterKey(sourcePage) : 'root').accent;
        },
        labelBackgroundStroke: '#ffffff',
        labelBackgroundLineWidth: 2,
        labelBackgroundRadius: 5,
        labelPadding: [5, 9],
        cursor: 'pointer',
      },
      state: {
        selected: { stroke: '#1769e0', lineWidth: 4 },
      },
    },
    behaviors: getBehaviors(),
    plugins: [{ type: 'minimap', key: 'minimap', size: [168, 104] }],
  });

  graphInstance.on(NodeEvent.CLICK, (event) => emit('select-node', event.target.id));
  graphInstance.on(NodeEvent.POINTER_ENTER, (event) => {
    hoveredPage.value = props.graph.pageMap.get(event.target.id) || null;
  });
  graphInstance.on(NodeEvent.POINTER_LEAVE, () => {
    hoveredPage.value = null;
  });
  graphInstance.on(NodeEvent.DBLCLICK, (event) => {
    const page = props.graph.pageMap.get(event.target.id);
    if (page) openPreview(page);
  });
  graphInstance.on(EdgeEvent.CLICK, (event) => emit('select-edge', event.target.id));
}

async function performRender({ fit = false } = {}) {
  prepareGraphVisibility();
  createGraph();
  if (!graphInstance) return;
  const sequence = ++renderSequence;
  rendering.value = true;
  try {
    selectedElement = null;
    graphInstance.setData(toG6Data());
    graphInstance.setLayout(getLayout());
    graphInstance.setOptions({
      behaviors: getBehaviors(),
    });
    await graphInstance.render();
    if (sequence !== renderSequence) return;
    await syncSelection(false);
    if (fit) await fitReadableView();
  } finally {
    if (sequence === renderSequence) rendering.value = false;
  }
}

function renderGraph(options = {}) {
  renderQueue = renderQueue
    .catch(() => undefined)
    .then(() => performRender(options));
  return renderQueue;
}

async function syncSelection(focus = true) {
  if (!graphInstance) return;
  if (selectedElement?.id) {
    await graphInstance.setElementState(selectedElement.id, []);
  }
  if (!props.selected?.id) {
    selectedElement = null;
    return;
  }
  const visibleIds = getVisibleIds();
  const exists = props.selected.type === 'edge'
    ? props.graph.edges.some((edge) => (
        edge.id === props.selected.id
        && visibleIds.has(edge.from)
        && visibleIds.has(edge.to)
      ))
    : visibleIds.has(props.selected.id);
  if (!exists) return;
  selectedElement = props.selected;
  await graphInstance.setElementState(props.selected.id, ['selected']);
  if (focus && props.selected.type === 'node') {
    await graphInstance.focusElement(props.selected.id, { duration: 420 });
  }
}

function queueSelectionSync() {
  renderQueue = renderQueue
    .catch(() => undefined)
    .then(async () => {
      if (graphInstance && props.graph.pages.length > 120) await graphInstance.draw();
      await syncSelection(true);
    });
  return renderQueue;
}

async function fitReadableView() {
  if (!graphInstance) return;
  await graphInstance.fitView({ when: 'always', direction: 'both' }, { duration: 360 });
  if (props.graph.pages.length > 120) {
    if (graphInstance.getZoom() < 0.32) {
      await graphInstance.zoomTo(0.32, { duration: 280 });
    }
    const primaryRoot = rootIds.value.find((id) => !props.graph.pageMap.get(id)?.isFloating);
    if (primaryRoot) await graphInstance.focusElement(primaryRoot, { duration: 280 });
    return;
  }
  if (graphInstance.getZoom() >= 0.52) return;
  await graphInstance.zoomTo(0.4, { duration: 280 });
  const visibleIds = getVisibleIds();
  const primaryRoot = rootIds.value.find((id) => visibleIds.has(id));
  const focusIds = primaryRoot
    ? [primaryRoot, ...getOutgoingEdges(props.graph, primaryRoot)
        .map((edge) => edge.to)
        .filter((id) => visibleIds.has(id))]
    : [];
  if (focusIds.length) await graphInstance.focusElement(focusIds, { duration: 280 });
}

async function fitGraph() {
  if (!graphInstance) return;
  await graphInstance.fitView({ when: 'always', direction: 'both' }, { duration: 420 });
}

async function expandAll() {
  collapsed.value = new Set();
  await renderGraph({ fit: true });
}

async function collapseAll() {
  collapsed.value = new Set(props.graph.pages
    .filter((page) => getOutgoingEdges(props.graph, page.nodeId).length > 0)
    .map((page) => page.nodeId));
  await renderGraph({ fit: true });
}

async function resetLayout() {
  await renderGraph({ fit: true });
}

async function exportGraph() {
  if (!graphInstance) return;
  const dataUrl = await graphInstance.toDataURL({ mode: 'overall', type: 'image/png' });
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `app-graph-${Date.now()}.png`;
  link.click();
}

defineExpose({ fitGraph, expandAll, collapseAll, resetLayout, exportGraph });

watch(() => [props.layoutMode, props.layoutRevision, props.graph], () => {
  nextTick(() => renderGraph({ fit: true }));
}, { deep: false });

watch(() => props.keyword, () => {
  nextTick(() => renderGraph());
});

watch(() => props.selected, () => {
  nextTick(queueSelectionSync);
}, { deep: true });

onMounted(async () => {
  await renderGraph({ fit: true });
  resizeObserver = new ResizeObserver(() => graphInstance?.resize());
  if (containerRef.value) resizeObserver.observe(containerRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  graphInstance?.destroy();
  graphInstance = null;
});
</script>

<template>
  <section class="graph-area g6-graph-area">
    <div class="canvas-stats" aria-label="图谱统计">
      <div class="stat"><span>节点</span><strong>{{ graph.pages.length }}</strong></div>
      <div class="stat"><span>跳转</span><strong>{{ graph.edges.length }}</strong></div>
      <div class="stat"><span>游离</span><strong>{{ graph.floatingPages.length }}</strong></div>
      <div class="stat"><span>引擎</span><strong>G6</strong></div>
    </div>

    <div ref="containerRef" class="g6-canvas" />
    <div v-if="hoveredPage" class="graph-node-tooltip">
      <strong>{{ hoveredPage.displayTitle }}</strong>
      <p>{{ hoveredPage.page_text || '暂无页面描述' }}</p>
      <span>{{ hoveredPage.page_url || '暂无页面 URL' }}</span>
    </div>
    <div v-if="loading || rendering" class="g6-rendering">
      {{ loading ? '正在加载图谱' : '正在计算布局' }}
    </div>

    <Teleport to="body">
      <div v-if="previewPage" class="image-preview-overlay" @click="previewPage = null">
        <div class="image-preview-shell" @click.stop>
          <GraphButton
            class="image-preview-close"
            icon-only
            html-type="button"
            aria-label="关闭预览"
            title="关闭预览"
            @click="previewPage = null"
          >
            <template #icon><Icon icon="ant-design:close-outlined" :size="16" /></template>
          </GraphButton>
          <SmartImage
            class="image-preview-full"
            :candidates="previewCandidates"
            :title="previewPage.displayTitle"
            kind="页面截图"
          />
        </div>
      </div>
    </Teleport>
  </section>
</template>
