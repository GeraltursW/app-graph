<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { useMessage } from '@/hooks/web/useMessage';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  Segmented as ASegmented,
  Select as ASelect,
  SelectOption as ASelectOption,
  Tag as ATag,
  Modal
} from "ant-design-vue";
import GraphButton from "./components/shared/GraphButton.vue";
import GraphCanvas from "./components/GraphCanvas.vue";
import FunctionReviewPanel from "./components/FunctionReviewPanel.vue";
import FunctionTreeImportDialog from "./components/FunctionTreeImportDialog.vue";
import InspectorPanel from "./components/InspectorPanel.vue";
import TestCaseNav from "./components/TestCaseNav.vue";
import TestCasePanel from "./components/TestCasePanel.vue";
import TestReportDashboard from "./components/TestReportDashboard.vue";
import TestReportEvidence from "./components/TestReportEvidence.vue";
import TestReportNav from "./components/TestReportNav.vue";
import TreeNav from "./components/TreeNav.vue";
import GovernanceWorkspace from "./components/GovernanceWorkspace.vue";
import ProjectBaselinePanel from "./components/ProjectBaselinePanel.vue";
import CaptureImportPanel from "./components/CaptureImportPanel.vue";
import "./style.css";
import {
  addFloatingPageToGraph,
  applyPageReviewToGraph,
  createEmptyGraph,
  getMainGraphView,
  mergeFloatingPageIntoGraph,
  normalizeBackendGraph
} from "./data/graph.js";
import {
  createMockPerformanceResult,
  generateFullCoveragePathCases,
  generateMockScenarioCases,
  resolveTestCases
} from "./data/testCases.js";
import { createMockTestReport } from "./data/testReports.js";
import {
  queryFunctionBindings,
  queryFunctionCatalog,
  queryFunctionCatalogs,
  queryFunctionCoverage,
  queryFunctionMatchRuns,
  queryAppGraph,
  queryAppList,
  requestAiExploreFloatingPage,
  requestCreateOrphanNode,
  requestDeleteNode,
  requestManualMergeFloatingPage,
  requestMergeFloatingPage,
  requestMoveNode,
  requestImportFunctionTree,
  requestReviewFunctionBinding,
  requestReviewFunctionBindings,
  requestRunFunctionMatch,
  requestSavePageReview
} from "./info.api";
import {
  createEmptyFunctionCatalog,
  createFunctionCatalogView
} from "./data/functionTree";
import {
  getOfficialFunctionCatalog,
  getTestCaseCatalog,
  layoutModes,
  toolActions,
  workModes
} from "./info.data";

const appName = ref("");
const appList = ref([]);
const appListLoading = ref(false);
const selected = ref({ type: "node", id: "" });
const keyword = ref("");
const aiGraphHighlighted = ref(false);
const selectedOfficialFunction = ref(null);
const selectedFunctionCatalogId = ref("");
const officialFunctionCatalog = ref(createEmptyFunctionCatalog());
const functionCatalogLoading = ref(false);
const functionCatalogError = ref("");
const functionImportOpen = ref(false);
const importingFunctionTree = ref(false);
const reviewingFunctionBindings = ref(false);
const workMode = ref("graph");
const selectedCaseId = ref("");
const selectedReportId = ref("");
const customScenarioCases = ref([]);
const caseExecution = ref({
  caseId: "",
  status: "idle",
  currentStep: 0,
  result: null
});
let caseExecutionTimer = null;
const layoutMode = ref("horizontal");
const toolAction = ref("");
const graphRef = ref(null);
const inspectorRef = ref(null);
const treeNavRef = ref(null);
const deleteConfirmOpen = ref(false);
const shellRef = ref(null);
const leftPaneWidth = ref(280);
const rightPaneWidth = ref(380);
const resizingPane = ref("");
const layoutRevision = ref(0);
const loading = ref(false);
const errorMessage = ref("");
async function locateGovernancePage({ appName: targetApp, pageId }) {
  if (appName.value !== targetApp) { appName.value = targetApp; await loadGraph(); }
  const page = graph.value.pages.find(item => item.pageId === pageId);
  if (!page) { createMessage.warning('该报告节点已变更或删除，请刷新图谱核对'); return; }
  workMode.value = 'graph'; selectNode(page.nodeId);
}
const graph = ref(createEmptyGraph());
const canvasGraph = computed(() => getMainGraphView(graph.value));
const floatingAiState = ref({});
const creatingOrphan = ref(false);
const movingNodeId = ref("");
const deletingNodeId = ref("");
const { createMessage } = useMessage();
let paneResizeSession = null;

const appShellStyle = computed(() => ({
  "--left-pane-width": `${leftPaneWidth.value}px`,
  "--right-pane-width": `${rightPaneWidth.value}px`
}));

const selectedPayload = computed(() => {
  if (selected.value.type === "edge") {
    return graph.value.edges.find((edge) => edge.id === selected.value.id) || null;
  }
  return graph.value.pageMap.get(selected.value.id) || null;
});
const highlightedFunctionPageIds = computed(() => selectedOfficialFunction.value?.pageIds || []);
const selectedFunctionDetail = computed(() => (
  officialFunctionCatalog.value.functions.find(
    (item) => item.functionId === selectedOfficialFunction.value?.functionId,
  ) || null
));
const confirmedFunctionActionMap = computed(() => {
  const confirmed = new Set(["autoConfirmed", "humanConfirmed", "inherited", "confirmed"]);
  const bindings = new Map();
  const append = (key, match) => {
    if (!key) return;
    if (!bindings.has(key)) bindings.set(key, []);
    const existing = bindings.get(key);
    if (!existing.some((item) => item.functionId === match.functionId)) existing.push(match);
  };
  officialFunctionCatalog.value.functions.forEach((item) => {
    (item.actionBindings || []).forEach((binding) => {
      if (!confirmed.has(binding.reviewStatus)) return;
      const match = {
        functionId: item.functionId,
        functionName: item.functionName,
        reviewStatus: binding.reviewStatus,
        matchScore: binding.matchScore,
      };
      if (binding.actionId) append(`id:${String(binding.actionId)}`, match);
      append(functionActionSemanticKey(
        binding.pageHashId,
        binding.actionLayer,
        binding.actionName,
      ), match);
    });
  });
  return bindings;
});

function functionActionSemanticKey(pageId, layer, name) {
  const normalizedName = String(name || "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
  if (!pageId || !layer || !normalizedName) return "";
  return `semantic:${String(pageId)}::${String(layer)}::${normalizedName}`;
}
const resolvedTestCases = computed(() => [
  ...generateFullCoveragePathCases(graph.value, { appName: appName.value }),
  ...(appName.value === "QQ"
    ? generateMockScenarioCases(graph.value, 80, { appName: appName.value })
    : []),
  ...resolveTestCases(graph.value, [
    ...getTestCaseCatalog(appName.value).filter((item) => item.caseType === "scenario"),
    ...customScenarioCases.value
  ])
]);
const activeTestCase = computed(() => (
  resolvedTestCases.value.find((item) => item.caseId === selectedCaseId.value)
  || resolvedTestCases.value[0]
  || null
));
const testReport = computed(() => createMockTestReport(graph.value, appName.value));
const activeUrlReport = computed(() => (
  testReport.value.urlReports.find((item) => item.reportId === selectedReportId.value)
  || testReport.value.urlReports[0]
));

async function loadInitialApps() {
  appListLoading.value = true;
  errorMessage.value = "";
  try {
    appList.value = await queryAppList();
    if (!appList.value.length) {
      errorMessage.value = "暂无可查询应用";
      return;
    }
    appName.value = appList.value[0].appName;
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
    aiGraphHighlighted.value = false;
    selectedOfficialFunction.value = null;
    selectedCaseId.value = "";
    customScenarioCases.value = [];
    stopCaseExecution();
    floatingAiState.value = {};
    selected.value = { type: "node", id: normalized.roots[0] || "" };
    layoutRevision.value += 1;
    await loadFunctionCatalogs();
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

async function loadFunctionCatalogs() {
  functionCatalogLoading.value = true;
  functionCatalogError.value = "";
  selectedOfficialFunction.value = null;
  try {
    const catalogs = await queryFunctionCatalogs(appName.value.trim());
    if (!catalogs.length) {
      selectedFunctionCatalogId.value = "";
      officialFunctionCatalog.value = createEmptyFunctionCatalog();
      return;
    }
    const selectedCatalog = catalogs[0];
    selectedFunctionCatalogId.value = String(selectedCatalog.catalogId);
    await loadFunctionCatalog(selectedFunctionCatalogId.value);
  } catch (error) {
    const fallback = getOfficialFunctionCatalog(appName.value);
    selectedFunctionCatalogId.value = "";
    officialFunctionCatalog.value = fallback;
    functionCatalogError.value = error instanceof Error
      ? `后端 Function Tree 查询失败，当前显示离线目录：${error.message}`
      : "后端 Function Tree 查询失败，当前显示离线目录";
  } finally {
    functionCatalogLoading.value = false;
  }
}

async function loadFunctionCatalog(catalogId) {
  if (!catalogId) return;
  functionCatalogLoading.value = true;
  functionCatalogError.value = "";
  selectedOfficialFunction.value = null;
  try {
    const [catalogPayload, runs] = await Promise.all([
      queryFunctionCatalog(catalogId),
      queryFunctionMatchRuns(catalogId),
    ]);
    const latestRun = runs.find((item) => item.status === "completed") || runs[0] || null;
    const [bindings, coverage] = latestRun
      ? await Promise.all([
          queryFunctionBindings(String(latestRun.runId)),
          queryFunctionCoverage(String(latestRun.runId)),
        ])
      : [{ pageBindings: [], actionBindings: [] }, { functions: [], summary: {} }];
    officialFunctionCatalog.value = createFunctionCatalogView(
      catalogPayload,
      bindings,
      latestRun,
      coverage,
    );
  } catch (error) {
    officialFunctionCatalog.value = createEmptyFunctionCatalog("Function Tree 加载失败");
    functionCatalogError.value = error instanceof Error ? error.message : "Function Tree 加载失败";
  } finally {
    functionCatalogLoading.value = false;
  }
}

function highlightOfficialFunction(payload) {
  selectedOfficialFunction.value = payload;
  if (payload?.pageIds?.length) {
    selected.value = { type: "node", id: payload.pageIds[0] };
  }
}

function selectOfficialFunctionById(functionId) {
  const item = officialFunctionCatalog.value.functions.find(
    (candidate) => candidate.functionId === functionId,
  );
  if (!item) {
    selectedOfficialFunction.value = null;
    return;
  }
  const pageHashes = new Set(
    (item.pageBindings || [])
      .filter((binding) => binding.reviewStatus !== "rejected")
      .map((binding) => String(binding.pageHashId || "")),
  );
  highlightOfficialFunction({
    functionId: item.functionId,
    functionName: item.functionName,
    pageIds: graph.value.pages
      .filter((page) => pageHashes.has(String(page.pageId)))
      .map((page) => page.nodeId),
  });
}

async function importAndMatchFunctionTree(request) {
  if (importingFunctionTree.value) return;
  importingFunctionTree.value = true;
  createMessage.loading({
    content: "正在导入 Function Tree 并运行匹配...",
    key: "function-tree-import",
    duration: 0,
  });
  try {
    const imported = await requestImportFunctionTree(
      request.metadataFile,
      request.treeFile,
      request.source,
      request.vendorVersion,
    );
    if (imported.appName && imported.appName !== appName.value) {
      throw new Error(`导入文件属于 ${imported.appName}，当前应用是 ${appName.value}`);
    }
    await requestRunFunctionMatch(String(imported.catalogId));
    await loadFunctionCatalogs();
    functionImportOpen.value = false;
    createMessage.success({
      content: `已导入 ${imported.functionCount || 0} 个功能点并完成匹配`,
      key: "function-tree-import",
      duration: 3,
    });
  } catch (error) {
    createMessage.error({
      content: error instanceof Error ? error.message : "Function Tree 导入失败",
      key: "function-tree-import",
      duration: 4,
    });
  } finally {
    importingFunctionTree.value = false;
  }
}

async function reviewFunctionBindings(request) {
  if (reviewingFunctionBindings.value || !request.bindingIds?.length) return;
  reviewingFunctionBindings.value = true;
  const functionId = selectedOfficialFunction.value?.functionId || "";
  try {
    if (request.bindingIds.length === 1) {
      await requestReviewFunctionBinding(
        request.bindingIds[0],
        request.targetType,
        request.reviewStatus,
        "Function Tree 人工复核",
      );
    } else {
      await requestReviewFunctionBindings(
        request.bindingIds,
        request.targetType,
        request.reviewStatus,
        "Function Tree 批量复核",
      );
    }
    await loadFunctionCatalog(selectedFunctionCatalogId.value);
    selectOfficialFunctionById(functionId);
    createMessage.success(
      request.reviewStatus === "humanConfirmed" ? "匹配结果已确认" : "匹配结果已拒绝",
    );
  } catch (error) {
    createMessage.error(error instanceof Error ? error.message : "复核保存失败");
  } finally {
    reviewingFunctionBindings.value = false;
  }
}

function locateFunctionBinding(binding) {
  const page = graph.value.pages.find(
    (item) => String(item.pageId) === String(binding.pageHashId || ""),
  );
  if (!page) {
    createMessage.warning("该绑定页面不在当前图谱版本中");
    return;
  }
  selected.value = { type: "node", id: page.nodeId };
}

function selectTestCase(caseId) {
  selectedCaseId.value = caseId;
  const testCase = resolvedTestCases.value.find((item) => item.caseId === caseId);
  if (testCase?.startPage) selected.value = { type: "node", id: testCase.startPage.nodeId };
}

function selectUrlReport(reportId) {
  selectedReportId.value = reportId;
  const report = testReport.value.urlReports.find((item) => item.reportId === reportId);
  if (report?.match?.nodeId) selected.value = { type: "node", id: report.match.nodeId };
}

function createScenarioCase(testCase) {
  customScenarioCases.value = [...customScenarioCases.value, testCase];
  selectedCaseId.value = testCase.caseId;
  const startPage = graph.value.pageMap.get(testCase.startPageId);
  if (startPage) selected.value = { type: "node", id: startPage.nodeId };
  createMessage.success("过程采集用例已创建");
}

function runTestCase(caseId) {
  const testCase = resolvedTestCases.value.find((item) => item.caseId === caseId);
  if (!testCase?.resolved) return;
  stopCaseExecution();
  selectedCaseId.value = caseId;
  caseExecution.value = {
    caseId,
    status: "running",
    currentStep: 1,
    result: null
  };
  caseExecutionTimer = window.setInterval(() => {
    if (caseExecution.value.currentStep >= testCase.steps.length) {
      window.clearInterval(caseExecutionTimer);
      caseExecutionTimer = null;
      caseExecution.value = {
        caseId,
        status: "completed",
        currentStep: testCase.steps.length + 1,
        result: createMockPerformanceResult(testCase)
      };
      return;
    }
    caseExecution.value = {
      ...caseExecution.value,
      currentStep: caseExecution.value.currentStep + 1
    };
  }, 1100);
}

function stopCaseExecution() {
  if (caseExecutionTimer) window.clearInterval(caseExecutionTimer);
  caseExecutionTimer = null;
  if (caseExecution.value.status === "running") {
    caseExecution.value = {
      ...caseExecution.value,
      status: "stopped"
    };
  }
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
  if (!appName.value || !request.pageUrl || creatingOrphan.value) return;
  creatingOrphan.value = true;
  errorMessage.value = "";
  createMessage.loading({ content: "正在创建游离节点...", key: "app-graph-create-orphan", duration: 0 });
  try {
    const response = await requestCreateOrphanNode(appName.value, request.pageUrl);
    const existing = graph.value.pages.find((page) => page.pageId === response.node.pageId);
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
    const canMerge = Boolean(payload?.canMerge ?? payload?.mergeable ?? payload?.suitable);
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
      canMerge: true,
      targetParentNodeId: targetParentId,
      targetParentId: targetParent.backendId,
      widgetDescription: "人工拖拽归类",
      aiRecursive: true,
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

function confirmDeleteNode(nodeId) {
  const page = graph.value.pageMap.get(nodeId);
  if (!page || deletingNodeId.value || deleteConfirmOpen.value) return;
  const targetApp = appName.value;
  deleteConfirmOpen.value = true;
  Modal.confirm({
    title: `确认删除「${page.pageTitle}」？`,
    content: `URL：${page.pageUrl || '未填写'}。删除无法撤销，相关连线将由后端同步处理。`,
    okText: '删除节点', cancelText: '取消', okButtonProps: { danger: true },
    maskClosable: false,
    onOk: async () => {
      if (targetApp !== appName.value || graph.value.pageMap.get(nodeId)?.pageId !== page.pageId) {
        createMessage.warning('当前图谱已变化，请重新选择节点'); return;
      }
      await deleteNode(nodeId);
    },
    afterClose: () => { deleteConfirmOpen.value = false; },
  });
}

async function handleNodeMenu({ key, nodeId }) {
  if (loading.value || deletingNodeId.value) return;
  workMode.value = 'graph';
  selectedOfficialFunction.value = null;
  if (key === 'create') { await nextTick(); treeNavRef.value?.openCreateDialog(); return; }
  if (!graph.value.pageMap.has(nodeId)) return;
  selectNode(nodeId);
  if (key === 'delete') { confirmDeleteNode(nodeId); return; }
  await nextTick();
  inspectorRef.value?.beginEdit({ images: key === 'images' });
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
    throw error;
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
function clampPaneWidth(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function paneWidthLimits() {
  const shellWidth = shellRef.value?.getBoundingClientRect().width || window.innerWidth;
  const available = Math.max(900, shellWidth - 64);
  return {
    maxLeft: Math.min(520, available - rightPaneWidth.value - 520),
    maxRight: Math.min(620, available - leftPaneWidth.value - 520)
  };
}

function persistPaneWidths() {
  localStorage.setItem("app-graph-pane-widths", JSON.stringify({
    left: leftPaneWidth.value,
    right: rightPaneWidth.value
  }));
}

function restorePaneWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem("app-graph-pane-widths") || "{}");
    if (Number.isFinite(saved.left)) leftPaneWidth.value = clampPaneWidth(saved.left, 220, 520);
    if (Number.isFinite(saved.right)) rightPaneWidth.value = clampPaneWidth(saved.right, 300, 620);
  } catch {
    localStorage.removeItem("app-graph-pane-widths");
  }
}

function startPaneResize(event, pane) {
  event.preventDefault();
  event.stopPropagation();
  paneResizeSession = {
    pane,
    startX: event.clientX,
    left: leftPaneWidth.value,
    right: rightPaneWidth.value
  };
  resizingPane.value = pane;
  document.body.classList.add("app-graph-pane-resizing");
  document.addEventListener("pointermove", handlePaneResize);
  document.addEventListener("pointerup", stopPaneResize, { once: true });
}

function handlePaneResize(event) {
  if (!paneResizeSession) return;
  const delta = event.clientX - paneResizeSession.startX;
  const limits = paneWidthLimits();
  if (paneResizeSession.pane === "left") {
    leftPaneWidth.value = clampPaneWidth(paneResizeSession.left + delta, 220, limits.maxLeft);
  } else {
    rightPaneWidth.value = clampPaneWidth(paneResizeSession.right - delta, 300, limits.maxRight);
  }
}

function stopPaneResize() {
  if (!paneResizeSession) return;
  paneResizeSession = null;
  resizingPane.value = "";
  document.body.classList.remove("app-graph-pane-resizing");
  document.removeEventListener("pointermove", handlePaneResize);
  persistPaneWidths();
  window.setTimeout(() => graphRef.value?.fitGraph(), 80);
}

function resizePaneByKeyboard(event, pane) {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const direction = event.key === "ArrowRight" ? 1 : -1;
  const limits = paneWidthLimits();
  if (pane === "left") {
    leftPaneWidth.value = clampPaneWidth(leftPaneWidth.value + direction * 20, 220, limits.maxLeft);
  } else {
    rightPaneWidth.value = clampPaneWidth(rightPaneWidth.value - direction * 20, 300, limits.maxRight);
  }
  persistPaneWidths();
  window.setTimeout(() => graphRef.value?.fitGraph(), 80);
}

onMounted(() => {
  restorePaneWidths();
  loadInitialApps();
});
onBeforeUnmount(() => {
  stopCaseExecution();
  paneResizeSession = null;
  document.body.classList.remove("app-graph-pane-resizing");
  document.removeEventListener("pointermove", handlePaneResize);
});

watch(workMode, (value) => {
  if (value === "cases") {
    aiGraphHighlighted.value = false;
    selectedOfficialFunction.value = null;
    if (!selectedCaseId.value && resolvedTestCases.value.length) {
      selectTestCase(resolvedTestCases.value[0].caseId);
    }
    return;
  }
  if (value === "reports") {
    aiGraphHighlighted.value = false;
    selectedOfficialFunction.value = null;
    stopCaseExecution();
    if (!selectedReportId.value && testReport.value.urlReports.length) {
      selectUrlReport(testReport.value.urlReports[0].reportId);
    }
    return;
  }
  stopCaseExecution();
});
</script>

<template>
  <div
    ref="shellRef"
    class="app-shell"
    :class="{ 'is-pane-resizing': resizingPane, 'report-mode': workMode === 'reports' }"
    :style="appShellStyle"
  >
    <header class="topbar">
        <div class="topbar-actions">
          <a-segmented
            v-model:value="workMode"
            class="work-mode-switch"
            :options="workModes"
            aria-label="工作模式切换"
          />
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
                :key="app.appName"
                :value="app.appName"
                :label="app.appName"
              >
                <span class="app-option-content">
                  <span>{{ app.appName }}</span>
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
            v-if="workMode !== 'reports'"
            v-model:value="layoutMode"
            class="layout-switch"
            :options="layoutModes"
            aria-label="图谱布局切换"
          />

          <a-segmented
            v-if="workMode !== 'reports'"
            :value="toolAction"
            class="graph-tools"
            :options="toolActions"
            aria-label="图谱操作"
            @change="handleToolAction"
          />
        </div>
        <div class="topbar-project-actions" role="group" aria-label="项目管理">
          <ProjectBaselinePanel />
          <CaptureImportPanel :app-name="appName" @changed="loadGraph" @locate="locateGovernancePage" />
          <GovernanceWorkspace :app-name="appName" @changed="loadGraph" @locate="locateGovernancePage" />
        </div>
      </header>
    <TreeNav
      v-if="workMode === 'graph'"
      ref="treeNavRef"
      v-model:keyword="keyword"
      v-model:ai-graph-highlighted="aiGraphHighlighted"
      :graph="graph"
      :function-catalog="officialFunctionCatalog"
      :function-catalog-error="functionCatalogError"
      :function-catalog-loading="functionCatalogLoading"
      :floating-ai-state="floatingAiState"
      :creating-orphan="creatingOrphan"
      :loading="loading"
      :structure-saving="Boolean(movingNodeId)"
      :selected="selected"
      :selected-function-id="selectedOfficialFunction?.functionId || ''"
      @create-floating-node="createFloatingNode"
      @explore-floating-node="exploreFloatingNode"
      @manual-merge-floating-node="manualMergeFloatingNode"
      @merge-floating-node="mergeFloatingNode"
      @move-tree-node="moveTreeNode"
      @highlight-function="highlightOfficialFunction"
      @import-function-tree="functionImportOpen = true"
      @reload-function-catalog="loadFunctionCatalogs"
      @select-node="selectNode"
    />
    <TestCaseNav
      v-else-if="workMode === 'cases'"
      :cases="resolvedTestCases"
      :execution="caseExecution"
      :pages="graph.pages.filter((page) => !page.isFloating)"
      :selected-case-id="activeTestCase?.caseId || ''"
      @create-scenario="createScenarioCase"
      @select-case="selectTestCase"
    />
    <TestReportNav
      v-else
      :report="testReport"
      :selected-report-id="activeUrlReport?.reportId || ''"
      @select-report="selectUrlReport"
    />

    <div
      class="pane-resizer pane-resizer-left"
      :class="{ active: resizingPane === 'left' }"
      role="separator"
      aria-label="调整左侧导航宽度"
      aria-orientation="vertical"
      :aria-valuenow="leftPaneWidth"
      tabindex="0"
      @keydown="resizePaneByKeyboard($event, 'left')"
      @pointerdown="startPaneResize($event, 'left')"
    />

    <main class="workspace">
      

      <div v-if="errorMessage" class="graph-error">
        {{ errorMessage }}
      </div>

      <GraphCanvas
        v-if="workMode !== 'reports'"
        ref="graphRef"
        :graph="canvasGraph"
        :loading="loading"
        :mutation-busy="Boolean(deletingNodeId) || creatingOrphan || Boolean(movingNodeId)"
        :layout-mode="layoutMode"
        :layout-revision="layoutRevision"
        :keyword="keyword"
        :ai-graph-highlighted="aiGraphHighlighted"
        :function-highlight-active="Boolean(selectedOfficialFunction)"
        :function-highlight-label="selectedOfficialFunction?.functionName || ''"
        :highlighted-page-ids="highlightedFunctionPageIds"
        :selected="selected"
        :test-case="workMode === 'cases' ? activeTestCase : null"
        :case-execution="caseExecution"
        @select-node="selectNode"
        @select-edge="selectEdge"
        @node-menu="handleNodeMenu"
      />
      <TestReportDashboard
        v-else-if="activeUrlReport"
        :report="testReport"
        :selected="activeUrlReport"
      />
    </main>

    <div
      class="pane-resizer pane-resizer-right"
      :class="{ active: resizingPane === 'right' }"
      role="separator"
      aria-label="调整右侧详情宽度"
      aria-orientation="vertical"
      :aria-valuenow="rightPaneWidth"
      tabindex="0"
      @keydown="resizePaneByKeyboard($event, 'right')"
      @pointerdown="startPaneResize($event, 'right')"
    />

    <FunctionReviewPanel
      v-if="workMode === 'graph' && selectedFunctionDetail"
      :function-item="selectedFunctionDetail"
      :loading="reviewingFunctionBindings"
      @close="highlightOfficialFunction(null)"
      @locate="locateFunctionBinding"
      @review="reviewFunctionBindings"
    />
    <InspectorPanel
      v-else-if="workMode === 'graph'"
      ref="inspectorRef"
      :deleting="Boolean(deletingNodeId)"
      :function-action-bindings="confirmedFunctionActionMap"
      :graph="graph"
      :selected="selected"
      :payload="selectedPayload"
      @save-page-review="savePageReview"
      @delete-node="confirmDeleteNode"
    />
    <TestCasePanel
      v-else-if="workMode === 'cases'"
      :execution="caseExecution"
      :test-case="activeTestCase"
      @run-case="runTestCase"
      @stop-case="stopCaseExecution"
    />
    <TestReportEvidence
      v-else-if="activeUrlReport"
      :selected="activeUrlReport"
    />

    <FunctionTreeImportDialog
      :app-name="appName"
      :loading="importingFunctionTree"
      :open="functionImportOpen"
      @cancel="functionImportOpen = false"
      @submit="importAndMatchFunctionTree"
    />
  </div>
</template>



