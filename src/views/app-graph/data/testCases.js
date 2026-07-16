export function resolveTestCases(graph, templates = []) {
  return templates.map((template) => (
    template.case_type === 'path'
      ? resolvePathCase(graph, template)
      : resolveScenarioCase(graph, template)
  ));
}

export function generateFullCoveragePathCases(graph, options = {}) {
  const collection = options.collection || {
    trigger: 'target_page_ready',
    duration_seconds: 30,
    metrics: ['CPU', '内存', 'FPS', '功耗', '温度'],
  };
  const cases = [];
  const visiting = new Set();

  function visit(nodeId, pages = [], edges = []) {
    if (visiting.has(nodeId)) return;
    const page = graph.pageMap.get(nodeId);
    if (!page || page.isFloating) return;
    visiting.add(nodeId);

    const nextPages = [...pages, page];
    const outgoing = (graph.childrenMap.get(nodeId) || [])
      .filter((edge) => !graph.pageMap.get(edge.to)?.isFloating);
    if (!outgoing.length) {
      cases.push(createPathCase(graph, nextPages, edges, collection, options.appName));
    } else {
      outgoing.forEach((edge) => visit(edge.to, nextPages, [...edges, edge]));
    }
    visiting.delete(nodeId);
  }

  graph.roots.forEach((rootId) => visit(rootId));
  return cases;
}

function createPathCase(graph, pages, edges, collection, appName = '') {
  const targetPage = pages.at(-1);
  const pathFingerprint = hashPath([
    ...pages.map((page) => page.pageId || page.nodeId),
    ...edges.map((edge) => edge.id),
  ].join('|'));
  const edgeSteps = edges.map((edge, index) => ({
    ...edge,
    step_no: index + 1,
    action_label: edge.widget_description || edge.label || '进入',
    expected_page_id: graph.pageMap.get(edge.to)?.pageId || '',
    expected_page_title: graph.pageMap.get(edge.to)?.displayTitle || '',
  }));
  const stableTargetId = targetPage.pageId || targetPage.nodeId;
  return {
    case_id: `coverage-path-${stableTargetId}-${pathFingerprint}`,
    path_fingerprint: pathFingerprint,
    case_name: `${targetPage.displayTitle} · 终点采集`,
    case_type: 'path',
    source: 'graph_coverage',
    app_name: appName,
    description: `自动生成的全量覆盖路径，共 ${pages.length} 个页面，到达终点后采集性能。`,
    resolved: true,
    pages,
    pageIds: pages.map((page) => page.nodeId),
    edgeSteps,
    edgeIds: edgeSteps.map((edge) => edge.id),
    startPage: pages[0],
    targetPage,
    collection: { ...collection, metrics: [...collection.metrics] },
    steps: [
      ...edgeSteps.map((edge) => ({
        step_no: edge.step_no,
        type: 'navigate',
        page_id: edge.from,
        edge_id: edge.id,
        title: `${graph.pageMap.get(edge.from)?.displayTitle || edge.from} · ${edge.action_label}`,
        expected_page_id: edge.to,
      })),
      {
        step_no: edgeSteps.length + 1,
        type: 'collect',
        page_id: targetPage.nodeId,
        title: `${targetPage.displayTitle} · 终点性能采集`,
      },
    ],
  };
}

function hashPath(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function resolvePathCase(graph, template) {
  const pages = [];
  const edgeSteps = [];
  for (const title of template.path_titles || []) {
    const page = findPage(graph, title);
    if (page) pages.push(page);
  }

  for (let index = 0; index < pages.length - 1; index += 1) {
    const from = pages[index];
    const to = pages[index + 1];
    const edge = graph.edges.find((item) => item.from === from.nodeId && item.to === to.nodeId);
    if (!edge) continue;
    edgeSteps.push({
      ...edge,
      step_no: index + 1,
      action_label: edge.widget_description || edge.label || '进入',
      expected_page_id: to.pageId,
      expected_page_title: to.displayTitle,
    });
  }

  const complete = pages.length === (template.path_titles || []).length
    && edgeSteps.length === Math.max(0, pages.length - 1);
  return {
    ...template,
    resolved: complete,
    pages,
    pageIds: pages.map((page) => page.nodeId),
    edgeSteps,
    edgeIds: edgeSteps.map((edge) => edge.id),
    startPage: pages[0] || null,
    targetPage: pages.at(-1) || null,
    steps: [
      ...edgeSteps.map((edge) => ({
        step_no: edge.step_no,
        type: 'navigate',
        page_id: edge.from,
        edge_id: edge.id,
        title: `${graph.pageMap.get(edge.from)?.displayTitle || edge.from} · ${edge.action_label}`,
        expected_page_id: edge.to,
      })),
      ...(pages.length ? [{
        step_no: edgeSteps.length + 1,
        type: 'collect',
        page_id: pages.at(-1).nodeId,
        title: `${pages.at(-1).displayTitle} · 性能采集`,
      }] : []),
    ],
  };
}

function resolveScenarioCase(graph, template) {
  const startPage = findPage(
    graph,
    template.start_page_id || template.start_page_title,
  );
  return {
    ...template,
    resolved: Boolean(startPage),
    pages: startPage ? [startPage] : [],
    pageIds: startPage ? [startPage.nodeId] : [],
    edgeSteps: [],
    edgeIds: [],
    startPage,
    targetPage: startPage,
    steps: (template.operations || []).map((operation, index) => ({
      ...operation,
      step_no: index + 1,
      page_id: startPage?.nodeId || '',
      title: operation.label,
    })),
  };
}

function findPage(graph, title) {
  if (!title) return null;
  if (graph.pageMap.has(title)) return graph.pageMap.get(title);
  const byPageId = graph.pages.find((page) => page.pageId === title);
  if (byPageId) return byPageId;
  const exact = graph.pages.find((page) => page.page_title === title || page.displayTitle === title);
  if (exact) return exact;
  const normalized = String(title || '').toLowerCase();
  return graph.pages.find((page) => (
    page.page_title.toLowerCase().includes(normalized)
    || page.displayTitle.toLowerCase().includes(normalized)
  )) || null;
}

export function createMockPerformanceResult(testCase) {
  if (testCase.case_type === 'path') {
    return {
      score: 86,
      summary: '目标页面稳定，功耗存在轻微峰值。',
      metrics: [
        { label: '平均 FPS', value: '58.6', tone: 'good' },
        { label: '平均功耗', value: '824 mW', tone: 'warning' },
        { label: '内存峰值', value: '612 MB', tone: 'normal' },
        { label: '最高温度', value: '39.4°C', tone: 'normal' },
      ],
    };
  }
  return {
    score: 72,
    summary: '连续滑动阶段出现帧率下降，第 4 个操作功耗峰值明显。',
    metrics: [
      { label: '平均 FPS', value: '51.8', tone: 'warning' },
      { label: 'Jank', value: '6.2%', tone: 'warning' },
      { label: '平均 CPU', value: '37.4%', tone: 'normal' },
      { label: '峰值功耗', value: '1.42 W', tone: 'danger' },
    ],
  };
}
