export function resolveTestCases(graph, templates = []) {
  return templates.map((template) => (
    template.case_type === 'path'
      ? resolvePathCase(graph, template)
      : resolveScenarioCase(graph, template)
  ));
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
  const startPage = findPage(graph, template.start_page_title);
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
