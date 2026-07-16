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

export function generateMockScenarioCases(graph, count = 80, options = {}) {
  const pages = graph.pages.filter((page) => !page.isFloating && page.level > 1);
  if (!pages.length || count <= 0) return [];
  const operationFactories = [
    (page) => ({
      suffix: '连续滑动',
      operations: [
        { type: 'wait', label: '等待页面稳定', target: page.displayTitle, duration_ms: 1200, repeat: 1 },
        { type: 'swipe', label: '连续向上浏览', target: '页面内容区', direction: 'up', duration_ms: 420, repeat: 5 },
        { type: 'wait', label: '观察内容加载', target: page.displayTitle, duration_ms: 1600, repeat: 1 },
      ],
    }),
    () => ({
      suffix: '长按交互',
      operations: [
        { type: 'wait', label: '等待页面稳定', target: '当前页面', duration_ms: 1000, repeat: 1 },
        { type: 'long_press', label: '长按核心内容', target: '核心内容区', duration_ms: 800, repeat: 2 },
        { type: 'wait', label: '观察弹层反馈', target: '当前页面', duration_ms: 1400, repeat: 1 },
      ],
    }),
    () => ({
      suffix: '点击响应',
      operations: [
        { type: 'tap', label: '点击首个可交互控件', target: '首个主要控件', duration_ms: 200, repeat: 3 },
        { type: 'wait', label: '等待状态刷新', target: '当前页面', duration_ms: 900, repeat: 1 },
        { type: 'tap', label: '点击次要控件', target: '次要操作区', duration_ms: 200, repeat: 2 },
      ],
    }),
    () => ({
      suffix: '往返滚动',
      operations: [
        { type: 'swipe', label: '向上滚动', target: '页面内容区', direction: 'up', duration_ms: 380, repeat: 4 },
        { type: 'wait', label: '中段停留', target: '当前页面', duration_ms: 1200, repeat: 1 },
        { type: 'swipe', label: '向下回滚', target: '页面内容区', direction: 'down', duration_ms: 380, repeat: 3 },
      ],
    }),
    () => ({
      suffix: '混合压力',
      operations: [
        { type: 'swipe', label: '连续浏览内容', target: '页面内容区', direction: 'up', duration_ms: 400, repeat: 3 },
        { type: 'long_press', label: '长按内容区域', target: '核心内容区', duration_ms: 700, repeat: 1 },
        { type: 'tap', label: '点击操作入口', target: '主要操作区', duration_ms: 180, repeat: 3 },
        { type: 'wait', label: '持续观察', target: '当前页面', duration_ms: 1800, repeat: 1 },
      ],
    }),
  ];
  const metricSets = [
    ['FPS', 'Jank', 'CPU', '内存'],
    ['CPU', '内存', '功耗', '温度'],
    ['FPS', 'Jank', '功耗'],
    ['CPU', 'FPS', '功耗', '温度'],
  ];
  const templates = Array.from({ length: count }, (_, index) => {
    const page = pages[(index * 37 + Math.floor(index / pages.length)) % pages.length];
    const operationSet = operationFactories[index % operationFactories.length](page);
    return {
      case_id: `demo-scenario-${String(index + 1).padStart(3, '0')}`,
      case_name: `演示 ${String(index + 1).padStart(2, '0')} · ${page.displayTitle}${operationSet.suffix}`,
      case_type: 'scenario',
      source: 'demo_mock',
      mock_index: index + 1,
      app_name: options.appName || '',
      description: `Mock 过程采集用例，验证 ${page.displayTitle} 的${operationSet.suffix}性能。`,
      start_page_id: page.nodeId,
      operations: operationSet.operations,
      collection: {
        trigger: 'case_lifecycle',
        duration_seconds: 18 + (index % 7) * 4,
        metrics: metricSets[index % metricSets.length],
      },
    };
  });
  return resolveTestCases(graph, templates);
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
  const seed = stableSeed(testCase.case_id || testCase.case_name || 'scenario');
  const score = 68 + (seed % 27);
  const fps = (48 + (seed % 115) / 10).toFixed(1);
  const jank = (2.1 + (seed % 58) / 10).toFixed(1);
  const cpu = (24 + (seed % 190) / 10).toFixed(1);
  const power = (0.78 + (seed % 81) / 100).toFixed(2);
  return {
    score,
    summary: score >= 85
      ? '操作过程整体稳定，未发现明显性能异常。'
      : score >= 75
        ? '操作过程中存在轻微波动，建议关注峰值步骤。'
        : '连续交互阶段存在性能下降，建议检查高负载操作。',
    metrics: [
      { label: '平均 FPS', value: fps, tone: Number(fps) >= 56 ? 'good' : 'warning' },
      { label: 'Jank', value: `${jank}%`, tone: Number(jank) > 6 ? 'warning' : 'normal' },
      { label: '平均 CPU', value: `${cpu}%`, tone: Number(cpu) > 38 ? 'warning' : 'normal' },
      { label: '峰值功耗', value: `${power} W`, tone: Number(power) > 1.35 ? 'danger' : 'normal' },
    ],
  };
}

function stableSeed(value) {
  return [...String(value)].reduce((seed, character) => (
    (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0
  ), 17);
}
