<script setup>
import Icon from '@/components/Icon/Icon.vue';
import GraphButton from "./shared/GraphButton.vue";
import { Modal as AModal, Segmented as ASegmented } from "ant-design-vue";
import { computed, ref, watch } from "vue";
import OfficialFunctionTree from "./OfficialFunctionTree.vue";
import TreeItem from "./TreeItem.vue";
import { Badge, Input, ScrollArea } from "./ui";
import { getOutgoingEdges } from "../data/graph.js";

const props = defineProps({
  graph: {
    type: Object,
    required: true
  },
  keyword: {
    type: String,
    default: ""
  },
  aiGraphHighlighted: {
    type: Boolean,
    default: false
  },
  functionCatalog: {
    type: Object,
    default: () => ({ source: "", version: "", functions: [] })
  },
  selectedFunctionId: {
    type: String,
    default: ""
  },
  selected: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  floatingAiState: {
    type: Object,
    default: () => ({})
  },
  creatingOrphan: {
    type: Boolean,
    default: false
  },
  structureSaving: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  "update:keyword",
  "update:ai-graph-highlighted",
  "highlight-function",
  "create-floating-node",
  "select-node",
  "explore-floating-node",
  "merge-floating-node",
  "manual-merge-floating-node",
  "move-tree-node"
]);

const collapsed = ref(new Set());
const draggingFloatingId = ref("");
const draggingTreeId = ref("");
const dragMode = ref(false);
const treeEditMode = ref(false);
const navigationMode = ref("pages");
const createDialogOpen = ref(false);
const floatingUrlDraft = ref("");
const createUrlError = ref("");

const tree = computed(() => props.graph.roots.map((rootId) => buildNode(rootId)));
const floatingTree = computed(() => props.graph.floatingRoots.map((rootId) => buildNode(rootId)));
const mainTreeNodeCount = computed(() => props.graph.pages.filter((page) => !page.isFloating).length);
const aiNodeCount = computed(() => props.graph.pages.filter((page) => page.ai_recursive).length);
const searchResults = computed(() => {
  const normalized = props.keyword.trim().toLowerCase();
  if (!normalized) return [];
  return props.graph.pages
    .filter((page) => searchableText(page).includes(normalized))
    .slice(0, 12);
});

watch(() => props.graph, () => {
  collapsed.value = new Set();
  draggingFloatingId.value = "";
  draggingTreeId.value = "";
  dragMode.value = false;
  treeEditMode.value = false;
  navigationMode.value = "pages";
});

function changeNavigationMode(value) {
  navigationMode.value = value;
  if (value === "pages" && props.selectedFunctionId) emit("highlight-function", null);
}

function buildNode(nodeId) {
  const page = props.graph.pageMap.get(nodeId);
  return {
    id: nodeId,
    page,
    children: getOutgoingEdges(props.graph, nodeId).map((edge) => buildNode(edge.to))
  };
}

function toggle(nodeId) {
  const next = new Set(collapsed.value);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  collapsed.value = next;
}

function openCreateDialog() {
  floatingUrlDraft.value = "";
  createUrlError.value = "";
  createDialogOpen.value = true;
}

async function submitFloatingUrl() {
  if (props.creatingOrphan) return;
  const pageUrl = floatingUrlDraft.value.trim();
  if (!pageUrl) {
    createUrlError.value = "请输入游离 URL";
    return;
  }
  createUrlError.value = "";
  try {
    await new Promise((resolve, reject) => {
      emit("create-floating-node", { request: { page_url: pageUrl }, resolve, reject });
    });
    createDialogOpen.value = false;
    floatingUrlDraft.value = "";
  } catch (error) {
    createUrlError.value = error instanceof Error ? error.message : "创建游离节点失败";
  }
}
function toggleDragMode() {
  dragMode.value = !dragMode.value;
  if (dragMode.value) treeEditMode.value = false;
  draggingFloatingId.value = "";
  draggingTreeId.value = "";
}

function toggleTreeEditMode() {
  treeEditMode.value = !treeEditMode.value;
  if (treeEditMode.value) dragMode.value = false;
  draggingFloatingId.value = "";
  draggingTreeId.value = "";
}

function isMuted(node) {
  const normalized = props.keyword.trim().toLowerCase();
  const missesSearch = Boolean(normalized) && !searchableText(node.page).includes(normalized);
  const missesAiGraph = props.aiGraphHighlighted && !node.page?.ai_recursive;
  return missesSearch || missesAiGraph;
}

function searchableText(page) {
  if (!page) return "";
  return [
    page.page_title,
    page.displayTitle,
    page.page_text,
    page.page_url,
    page.aiInference?.label,
    page.aiInference?.reason,
    JSON.stringify(page.page_info || {})
  ].join(" ").toLowerCase();
}

function handleFloatingDragStart(event, nodeId) {
  if (!dragMode.value) {
    event.preventDefault();
    return;
  }
  draggingFloatingId.value = nodeId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-floating-node-id", nodeId);
  event.dataTransfer.setData("text/plain", nodeId);
}

function handleFloatingDragEnd() {
  draggingFloatingId.value = "";
}

function handleDropOnTree(payload) {
  const nodeId = payload?.nodeId || draggingFloatingId.value;
  const targetParentId = payload?.targetParentId || payload;
  if (!nodeId || nodeId === targetParentId) return;
  emit("manual-merge-floating-node", { nodeId, targetParentId });
  draggingFloatingId.value = "";
  dragMode.value = false;
}

function handleTreeDragStart(nodeId) {
  draggingTreeId.value = nodeId;
}

function handleTreeDragEnd() {
  draggingTreeId.value = "";
}

function handleMoveTreeNode(payload) {
  if (props.structureSaving || !payload?.nodeId || !payload?.targetParentId) return;
  emit("move-tree-node", payload);
  draggingTreeId.value = "";
  treeEditMode.value = false;
}
</script>

<template>
  <aside class="sidebar">

    <div class="search-box">
      <Input
        :value="keyword"
        type="search"
        placeholder="搜索页面、URL、AI 文本"
        @input="emit('update:keyword', $event.target.value)"
      />
    </div>

    <div v-if="searchResults.length" class="search-results">
      <GraphButton
        v-for="page in searchResults"
        :key="page.nodeId"
        html-type="button"
        @click="emit('select-node', page.nodeId)"
      >
        <strong>{{ page.displayTitle }}</strong>
        <span>{{ page.page_url || "no url" }}</span>
      </GraphButton>
    </div>

    <section class="sidebar-section main-tree-section" :class="{ 'drop-mode': dragMode || treeEditMode }">
      <div class="sidebar-section-head">
        <a-segmented
          class="navigation-mode-switch"
          :value="navigationMode"
          :options="[
            { label: '页面树', value: 'pages' },
            { label: '官方功能', value: 'functions' }
          ]"
          size="small"
          @change="changeNavigationMode"
        />
        <div v-if="navigationMode === 'pages'" class="floating-head-actions">
          <GraphButton
            class="ai-graph-toggle"
            :type="aiGraphHighlighted ? 'primary' : 'default'"
            html-type="button"
            :disabled="!aiNodeCount && !aiGraphHighlighted"
            :title="aiGraphHighlighted ? '恢复显示全部图谱节点' : '仅高亮 AI 探索节点'"
            @click="emit('update:ai-graph-highlighted', !aiGraphHighlighted)"
          >
            <template #icon>
              <Icon icon="ant-design:robot-outlined" :size="14" />
            </template>
            AI 图
            <span class="ai-graph-count">{{ aiNodeCount }}</span>
          </GraphButton>
          <GraphButton
            class="drag-mode-toggle"
            :type="treeEditMode ? 'primary' : 'default'"
            html-type="button"
            :disabled="!graph.roots.length || structureSaving"
            @click="toggleTreeEditMode"
          >
            <template #icon>
              <Icon :icon="structureSaving ? 'ant-design:loading-outlined' : (treeEditMode ? 'ant-design:check-outlined' : 'ant-design:edit-outlined')" :size="14" />
            </template>
            {{ structureSaving ? "保存中" : (treeEditMode ? "完成" : "编辑") }}
          </GraphButton>
          <Badge variant="secondary">{{ mainTreeNodeCount }}</Badge>
        </div>
        <Badge v-else variant="secondary">{{ functionCatalog.functions.length }}</Badge>
      </div>
      <ScrollArea class="tree-scroll module-scroll">
        <div v-if="loading" class="empty-state">图谱加载中...</div>
        <OfficialFunctionTree
          v-else-if="navigationMode === 'functions'"
          :catalog="functionCatalog"
          :graph="graph"
          :selected-function-id="selectedFunctionId"
          @highlight-function="emit('highlight-function', $event)"
        />
        <div v-else-if="!tree.length" class="empty-state">暂无主树数据</div>
        <div v-else>
          <p v-if="treeEditMode" class="manual-merge-hint active">
            拖动主树节点到另一个节点上，可调整父子关系。系统会阻止拖到自身或子节点下。
          </p>
          <nav class="tree-nav" aria-label="主图谱树">
            <TreeItem
              v-for="node in tree"
              :key="node.id"
              :node="node"
              :collapsed="collapsed"
              :selected="selected"
              :is-muted="isMuted"
              :can-drop-floating="dragMode || Boolean(draggingFloatingId)"
              :tree-edit-mode="treeEditMode && !structureSaving"
              @toggle="toggle"
              @drop-floating-node="handleDropOnTree"
              @move-tree-node="handleMoveTreeNode"
              @tree-drag-start="handleTreeDragStart"
              @tree-drag-end="handleTreeDragEnd"
              @select-node="emit('select-node', $event)"
            />
          </nav>
        </div>
      </ScrollArea>
    </section>

    <section class="sidebar-section floating-section">
      <div class="sidebar-section-head">
        <strong>游离 URL</strong>
        <div class="floating-head-actions">
          <GraphButton type="primary" title="创建游离 URL 页面" @click="openCreateDialog">
            <template #icon><Icon icon="ant-design:plus-outlined" :size="14" /></template>
            新建
          </GraphButton>
          <GraphButton
            class="drag-mode-toggle"
            :type="dragMode ? 'primary' : 'default'"
            html-type="button"
            :disabled="!graph.floatingPages.length"
            @click="toggleDragMode"
          >
            <template #icon>
              <Icon :icon="dragMode ? 'ant-design:check-outlined' : 'ant-design:drag-outlined'" :size="14" />
            </template>
            {{ dragMode ? "完成" : "拖拽" }}
          </GraphButton>
          <Badge variant="secondary">{{ graph.floatingPages.length }}</Badge>
        </div>
      </div>
      <ScrollArea class="floating-scroll module-scroll">
        <div v-if="loading" class="empty-state">等待图谱数据...</div>
        <div v-else-if="!floatingTree.length" class="empty-state">暂无游离页面</div>
        <div v-else class="floating-list">
          <p class="manual-merge-hint" :class="{ active: dragMode }">
            {{ dragMode ? "拖住卡片或拖拽按钮，放到主树节点上完成归类。" : "点击“开启拖拽”后，可把游离页面拖到主树节点下。" }}
          </p>
          <div
            v-for="node in floatingTree"
            :key="node.id"
            class="floating-page-card"
            :class="{
              active: selected.type === 'node' && selected.id === node.id,
              muted: isMuted(node),
              dragging: draggingFloatingId === node.id,
              'drag-enabled': dragMode
            }"
            :draggable="dragMode"
            role="button"
            tabindex="0"
            @click="emit('select-node', node.id)"
            @dragend="handleFloatingDragEnd"
            @dragstart="handleFloatingDragStart($event, node.id)"
            @keyup.enter="emit('select-node', node.id)"
          >
            <div class="floating-card-head">
              <span>{{ node.page.displayTitle }}</span>
              <GraphButton
                v-if="dragMode"
                class="drag-handle"
                draggable="true"
                title="拖拽到主树节点并入"
                html-type="button"
                @click.stop
                @dragend="handleFloatingDragEnd"
                @dragstart.stop="handleFloatingDragStart($event, node.id)"
              >
                <template #icon><Icon icon="ant-design:drag-outlined" :size="14" /></template>
                拖拽
              </GraphButton>
            </div>
            <strong>{{ node.page.aiInference.label }}</strong>
            <em>{{ node.page.aiInference.reason }}</em>
            <small>{{ node.page.page_url || "no page url" }}</small>
            <span
              v-if="floatingAiState[node.id]"
              class="floating-ai-status"
              :class="`status-${floatingAiState[node.id].status}`"
            >
              {{ floatingAiState[node.id].message }}
            </span>
            <span class="floating-actions" @click.stop>
              <GraphButton
                html-type="button"
                :disabled="floatingAiState[node.id]?.status === 'running' || floatingAiState[node.id]?.status === 'merging'"
                @click="emit('explore-floating-node', node.id)"
              >
                <template #icon><Icon icon="ant-design:robot-outlined" :size="14" /></template>
                {{ floatingAiState[node.id]?.status === "running" ? "探索中" : "AI 探索" }}
              </GraphButton>
              <GraphButton
                v-if="floatingAiState[node.id]?.status === 'mergeable'"
                html-type="button"
                class="merge"
                @click="emit('merge-floating-node', node.id)"
              >
                <template #icon><Icon icon="ant-design:merge-cells-outlined" :size="14" /></template>
                并入
              </GraphButton>
            </span>
          </div>
        </div>
      </ScrollArea>
    </section>

    <a-modal
      v-model:open="createDialogOpen"
      title="创建游离 URL 页面"
      ok-text="创建"
      cancel-text="取消"
      :ok-button-props="{ disabled: creatingOrphan || !floatingUrlDraft.trim() }"
      :confirm-loading="creatingOrphan"
      @ok="submitFloatingUrl"
    >
      <div class="floating-url-form">
        <label for="floating-page-url">游离 URL</label>
        <Input
          id="floating-page-url"
          v-model:value="floatingUrlDraft"
          :disabled="creatingOrphan"
          placeholder="请输入大数据返回的页面 URL"
          @keyup.enter="submitFloatingUrl"
        />
        <span v-if="createUrlError" class="floating-url-error">{{ createUrlError }}</span>
        <small>创建后可继续补充页面描述、截图，并通过 AI 探索或拖拽归类。</small>
      </div>
    </a-modal>
  </aside>
</template>
