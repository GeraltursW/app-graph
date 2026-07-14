<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { useMessage } from '@/hooks/web/useMessage';
import { computed, onMounted, ref } from "vue";
import {
  Segmented as ASegmented,
  Select as ASelect,
  SelectOption as ASelectOption,
  Tag as ATag
} from "ant-design-vue";
import GraphButton from "./components/shared/GraphButton.vue";
import GraphCanvas from "./components/GraphCanvas.vue";
import InspectorPanel from "./components/InspectorPanel.vue";
import TreeNav from "./components/TreeNav.vue";
import "./style.css";
import {
  addFloatingPageToGraph,
  applyPageReviewToGraph,
  createEmptyGraph,
  mergeFloatingPageIntoGraph,
  normalizeBackendGraph
} from "./data/graph.js";
import {
  queryAppGraph,
  queryAppList,
  requestAiExploreFloatingPage,
  requestCreateOrphanNode,
  requestDeleteNode,
  requestManualMergeFloatingPage,
  requestMergeFloatingPage,
  requestMoveNode,
  requestSavePageReview
} from "./info.api";
import { layoutModes, toolActions } from "./info.data";

const appName = ref("");
const appList = ref([]);
const appListLoading = ref(false);
const selected = ref({ type: "node", id: "" });
const keyword = ref("");
const layoutMode = ref("horizontal");
const toolAction = ref("");
const graphRef = ref(null);
const layoutRevision = ref(0);
const loading = ref(false);
const errorMessage = ref("");
const graph = ref(createEmptyGraph());
const floatingAiState = ref({});
const creatingOrphan = ref(false);
const movingNodeId = ref("");
const deletingNodeId = ref("");
const { createMessage } = useMessage();


const selectedPayload = computed(() => {
  if (selected.value.type === "edge") {
    return graph.value.edges.find((edge) => edge.id === selected.value.id) || null;
  }
  return graph.value.pageMap.get(selected.value.id) || null;
});

async function loadInitialApps() {
  appListLoading.value = true;
  errorMessage.value = "";
  try {
    appList.value = await queryAppList();
    if (!appList.value.length) {
      errorMessage.value = "暂无可查询应用";
      return;
    }
    appName.value = appList.value[0].app_name;
    await loadGraph();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "应用列表加载失败";
  } finally {
    appListLoading.value = false;
  }
}
async function loadGraph() {
  if (!appName.value.trim()) {
    errorMessage.value = "请输入 App 名称";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    const payload = await queryAppGraph(appName.value.trim());
    const normalized = normalizeBackendGraph(payload);
    graph.value = normalized;
    floatingAiState.value = {};
    selected.value = { type: "node", id: normalized.roots[0] || "" };
    layoutRevision.value += 1;
    window.setTimeout(() => graphRef.value?.fitGraph(), 80);
  } catch (error) {
    graph.value = createEmptyGraph();
    selected.value = { type: "node", id: "" };
    errorMessage.value = error instanceof Error ? error.message : "图谱加载失败";
  } finally {
    loading.value = false;
  }
}

function selectNode(nodeId) {
  selected.value = { type: "node", id: nodeId };
}

function selectEdge(edgeId) {
  selected.value = { type: "edge", id: edgeId };
}

function filterAppOption(input, option) {
  const keyword = String(input || "").trim().toLowerCase();
  const appLabel = String(option?.label || option?.value || "").toLowerCase();
  return appLabel.includes(keyword);
}

function fitGraph() {
  graphRef.value?.fitGraph();
}

function expandGraph() {
  graphRef.value?.expandAll();
}

function collapseGraph() {
  graphRef.value?.collapseAll();
}

function resetGraph() {
  layoutRevision.value += 1;
  graphRef.value?.resetLayout();
}
async function exportGraph() {
  await graphRef.value?.exportGraph();
  createMessage.success('整张图谱已导出为 PNG');
}
async function handleToolAction(value) {
  toolAction.value = value;
  const actions = {
    fit: fitGraph,
    expand: expandGraph,
    collapse: collapseGraph,
    reset: resetGraph,
    export: exportGraph
  };
  try {
    await actions[value]?.();
  } catch (error) {
    createMessage.error(error instanceof Error ? error.message : '图谱操作失败');
  } finally {
    toolAction.value = "";
  }
}


async function createFloatingNode(payload = {}) {
  const request = payload?.request || payload;
  if (!appName.value || !request.page_url || creatingOrphan.value) return;
  creatingOrphan.value = true;
  errorMessage.value = "";
  createMessage.loading({ content: "正在创建游离节点...", key: "app-graph-create-orphan", duration: 0 });
  try {
    const response = await requestCreateOrphanNode(appName.value, request.page_url);
    const existing = graph.value.pages.find((page) => page.pageId === response.node.page_id);
    if (existing) {
      selected.value = { type: "node", id: existing.nodeId };
      payload?.resolve?.(response);
      createMessage.success({ content: "游离节点已存在，已为你定位", key: "app-graph-create-orphan", duration: 2 });
      return;
    }
    graph.value = addFloatingPageToGraph(graph.value, response.node);
    const nodeId = graph.value.floatingRoots.at(-1);
    if (nodeId) selected.value = { type: "node", id: nodeId };
    payload?.resolve?.(response);
    createMessage.success({ content: "游离节点创建成功", key: "app-graph-create-orphan", duration: 2 });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "创建游离节点失败";
    payload?.reject?.(error);
    createMessage.error({ content: errorMessage.value, key: "app-graph-create-orphan", duration: 3 });
  } finally {
    creatingOrphan.value = false;
  }
}
async function exploreFloatingNode(nodeId) {
  const page = graph.value.pageMap.get(nodeId);
  if (!page) return;
  floatingAiState.value = {
    ...floatingAiState.value,
    [nodeId]: { status: "running", message: "AI 正在调用 HDC 探索 URL..." }
  };
  try {
    const result = await requestAiExploreFloatingPage(page);
    const payload = result?.data || result?.result || result;
    const canMerge = Boolean(payload?.can_merge ?? payload?.mergeable ?? payload?.suitable);
    floatingAiState.value = {
      ...floatingAiState.value,
      [nodeId]: {
        status: canMerge ? "mergeable" : "review",
        message: payload?.reason || payload?.message || (canMerge ? "AI 推断可并入主树" : "AI 未找到稳定并入位置"),
        result: payload
      }
    };
  } catch (error) {
    floatingAiState.value = {
      ...floatingAiState.value,
      [nodeId]: {
        status: "failed",
        message: error instanceof Error ? error.message : "AI 探索失败"
      }
    };
  }
}

async function mergeFloatingNode(nodeId) {
  const page = graph.value.pageMap.get(nodeId);
  const state = floatingAiState.value[nodeId];
  if (!page || !state?.result) return;
  floatingAiState.value = {
    ...floatingAiState.value,
    [nodeId]: { ...state, status: "merging", message: "正在并入主树..." }
  };
  try {
    const response = await requestMergeFloatingPage(page, state.result);
    const payload = response?.data || response?.result || response || state.result;
    graph.value = mergeFloatingPageIntoGraph(graph.value, nodeId, payload);
    floatingAiState.value = {
      ...floatingAiState.value,
      [nodeId]: { ...state, status: "merged", message: "已并入主树", result: payload }
    };
    selected.value = { type: "node", id: nodeId };
    layoutRevision.value += 1;
  } catch (error) {
    floatingAiState.value = {
      ...floatingAiState.value,
      [nodeId]: {
        ...state,
        status: "failed",
        message: error instanceof Error ? error.message : "并入失败"
      }
    };
  }
}

async function manualMergeFloatingNode({ nodeId, targetParentId }) {
  const page = graph.value.pageMap.get(nodeId);
  const targetParent = graph.value.pageMap.get(targetParentId);
  if (!page || !targetParent || page.nodeId === targetParent.nodeId) return;

  const currentState = floatingAiState.value[nodeId] || {};
  floatingAiState.value = {
    ...floatingAiState.value,
    [nodeId]: {
      ...currentState,
      status: "merging",
      message: "正在人工归类并入..."
    }
  };

  try {
    const response = await requestManualMergeFloatingPage(page, targetParent);
    const payload = response?.data || response?.result || response;
    graph.value = mergeFloatingPageIntoGraph(graph.value, nodeId, payload);
    floatingAiState.value = {
      ...floatingAiState.value,
      [nodeId]: {
        ...currentState,
        status: "merged",
        message: "已人工并入主图谱",
        result: payload
      }
    };
  } catch (error) {
    const fallbackPayload = {
      can_merge: true,
      target_parent_node_id: targetParentId,
      target_parent_id: targetParent.backendId,
      widget_description: "人工拖拽归类",
      ai_recursive: true,
      reason: error instanceof Error ? error.message : "manual merge fallback"
    };
    graph.value = mergeFloatingPageIntoGraph(graph.value, nodeId, fallbackPayload);
    floatingAiState.value = {
      ...floatingAiState.value,
      [nodeId]: {
        ...currentState,
        status: "merged",
        message: "后端暂不可用，已本地并入待复核",
        result: fallbackPayload
      }
    };
  }

  selected.value = { type: "node", id: nodeId };
  layoutRevision.value += 1;
  window.setTimeout(() => graphRef.value?.fitGraph(), 80);
}

async function moveTreeNode({ nodeId, targetParentId }) {
  const page = graph.value.pageMap.get(nodeId);
  const targetParent = graph.value.pageMap.get(targetParentId);
  if (!page || !targetParent || page.nodeId === targetParent.nodeId || movingNodeId.value) return;

  movingNodeId.value = nodeId;
  errorMessage.value = "";
  createMessage.loading({ content: "正在保存并校验图谱结构...", key: "app-graph-move-node", duration: 0 });
  try {
    await requestMoveNode(page, targetParent);
    const payload = await queryAppGraph(appName.value.trim());
    const normalized = normalizeBackendGraph(payload);
    const movedPage = normalized.pages.find((item) => item.pageId === page.pageId);
    const actualParent = movedPage?.parentId ? normalized.pageMap.get(movedPage.parentId) : null;
    graph.value = normalized;
    selected.value = { type: "node", id: movedPage?.nodeId || normalized.roots[0] || "" };
    layoutRevision.value += 1;
    window.setTimeout(() => graphRef.value?.fitGraph(), 80);
    if (!movedPage || actualParent?.pageId !== targetParent.pageId) {
      throw new Error("节点已保存，但后台图谱父子关系校验未通过，请刷新后复核");
    }
    createMessage.success({ content: "节点移动成功，图谱结构已同步", key: "app-graph-move-node", duration: 2 });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "节点移动失败";
    createMessage.error({ content: errorMessage.value, key: "app-graph-move-node", duration: 3 });
  } finally {
    movingNodeId.value = "";
  }
}

async function deleteNode(nodeId) {
  const page = graph.value.pageMap.get(nodeId);
  if (!page || deletingNodeId.value) return;
  deletingNodeId.value = nodeId;
  errorMessage.value = "";
  createMessage.loading({ content: "正在删除节点...", key: "app-graph-delete-node", duration: 0 });
  try {
    await requestDeleteNode(page);
    const payload = await queryAppGraph(appName.value.trim());
    const normalized = normalizeBackendGraph(payload);
    graph.value = normalized;
    selected.value = { type: "node", id: normalized.roots[0] || normalized.floatingRoots[0] || "" };
    layoutRevision.value += 1;
    createMessage.success({ content: "节点删除成功", key: "app-graph-delete-node", duration: 2 });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "节点删除失败";
    createMessage.error({ content: errorMessage.value, key: "app-graph-delete-node", duration: 3 });
  } finally {
    deletingNodeId.value = "";
  }
}

async function savePageReview(submission) {
  const review = submission?.review || submission;
  const page = graph.value.pageMap.get(review.nodeId);
  if (!page) {
    submission?.reject?.(new Error("未找到待保存节点"));
    return;
  }
  try {
    const response = await requestSavePageReview(page, review);
    const payload = response?.node || response?.data || response?.result || response;
    graph.value = applyPageReviewToGraph(graph.value, review.nodeId, payload);
    selected.value = { type: "node", id: review.nodeId };
    layoutRevision.value += 1;
    submission?.resolve?.(payload);
  } catch (error) {
    submission?.reject?.(error);
  }
}
onMounted(loadInitialApps);
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
        <div class="topbar-actions">
          <div class="app-query">
            <a-select
              v-model:value="appName"
              class="app-name-select"
              :loading="appListLoading"
              :filter-option="filterAppOption"
              placeholder="选择应用"
              show-search
              @change="loadGraph"
            >
              <a-select-option
                v-for="app in appList"
                :key="app.app_name"
                :value="app.app_name"
                :label="app.app_name"
              >
                <span class="app-option-content">
                  <span>{{ app.app_name }}</span>
                  <a-tag color="blue">{{ app.count }} 节点</a-tag>
                </span>
              </a-select-option>
            </a-select>
            <GraphButton type="primary" :disabled="loading || !appName" @click="loadGraph">
              <template #icon><Icon icon="ant-design:reload-outlined" :size="14" /></template>
              {{ loading ? "加载中" : "刷新" }}
            </GraphButton>
          </div>

          <a-segmented
            v-model:value="layoutMode"
            class="layout-switch"
            :options="layoutModes"
            aria-label="图谱布局切换"
          />

          <a-segmented
            :value="toolAction"
            class="graph-tools"
            :options="toolActions"
            aria-label="图谱操作"
            @change="handleToolAction"
          />
        </div>
      </header>
    <TreeNav
      v-model:keyword="keyword"
      :graph="graph"
      :floating-ai-state="floatingAiState"
      :creating-orphan="creatingOrphan"
      :loading="loading"
      :structure-saving="Boolean(movingNodeId)"
      :selected="selected"
      @create-floating-node="createFloatingNode"
      @explore-floating-node="exploreFloatingNode"
      @manual-merge-floating-node="manualMergeFloatingNode"
      @merge-floating-node="mergeFloatingNode"
      @move-tree-node="moveTreeNode"
      @select-node="selectNode"
    />

    <main class="workspace">
      

      <div v-if="errorMessage" class="graph-error">
        {{ errorMessage }}
      </div>

      <GraphCanvas
        ref="graphRef"
        :graph="graph"
        :loading="loading"

        :layout-mode="layoutMode"
        :layout-revision="layoutRevision"
        :keyword="keyword"
        :selected="selected"
        @select-node="selectNode"
        @select-edge="selectEdge"
      />
    </main>

    <InspectorPanel
      :deleting="Boolean(deletingNodeId)"
      :graph="graph"
      :selected="selected"
      :payload="selectedPayload"
      @save-page-review="savePageReview"
      @delete-node="deleteNode"
    />
  </div>
</template>



