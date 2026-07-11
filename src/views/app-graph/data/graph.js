export function normalizeImageUrls(page = {}) {
  const rawList = [
    page.image_url,
    ...(Array.isArray(page.image_urls) ? page.image_urls : []),
    ...(Array.isArray(page.images) ? page.images : []),
    ...(Array.isArray(page.page_info?.image_urls) ? page.page_info.image_urls : [])
  ];
  return [...new Set(rawList.map((item) => String(item || "").trim()).filter(Boolean))];
}
export function applyPageReviewToGraph(graph, nodeId, review = {}) {
  const pages = graph.pages.map((page) => {
    if (page.nodeId !== nodeId) return page;
    const imageUrls = normalizeImageUrls({ images: review.images || review.image_urls || [] });
    const pageTitle = review.page_title ?? page.page_title;
    return {
      ...page,
      page_title: pageTitle,
      displayTitle: page.titleRepeatIndex > 1 ? `${pageTitle} #${page.titleRepeatIndex}` : pageTitle,
      page_text: review.page_text ?? page.page_text,
      page_url: review.page_url ?? page.page_url,
      images: imageUrls,
      image_url: imageUrls[0] || "",
      image_urls: imageUrls,
      ai_recursive: Boolean(review.ai_recursive ?? page.ai_recursive),
      widget_description: review.widget_description ?? page.widget_description,
      aiInference: {
        ...page.aiInference,
        ...(review.ai_inference || {})
      },
      review_status: review.review_status || "edited",
      review_note: review.review_note || ""
    };
  });
  return rebuildGraphIndexes({ ...graph, pages });
}

export function normalizeBackendGraph(payload) {
  const graphPayload = payload?.data || payload?.result || payload;
  const { rootItems, floatingItems } = splitGraphPayload(graphPayload);
  const pages = [];
  const edges = [];
  const titleCounts = new Map();
  const visitedPathKeys = new Set();

  function walk(rawNode, parentId = null, depth = 1, siblingIndex = 0, path = [], isFloating = false) {
    if (!rawNode || typeof rawNode !== "object") return null;

    const rawTitle = String(rawNode.page_title || "Unnamed Page");
    const pageText = String(rawNode.page_text || "");
    const stableId = makeNodeId(rawNode, pageText, [...path, siblingIndex]);
    const pathKey = [...path, stableId, siblingIndex].join("/");

    if (visitedPathKeys.has(pathKey)) return stableId;
    visitedPathKeys.add(pathKey);

    const nextTitleCount = (titleCounts.get(rawTitle) || 0) + 1;
    titleCounts.set(rawTitle, nextTitleCount);

    const node = {
      nodeId: stableId,
      backendId: rawNode.id ?? null,
      pageId: rawNode.page_id || "",
      page_title: rawTitle,
      page_text: pageText,
      images: normalizeImageUrls(rawNode),
      image_url: normalizeImageUrls(rawNode)[0] || "",
      image_urls: normalizeImageUrls(rawNode),
      page_url: rawNode.page_url || "",
      page_info: rawNode.page_info || {},
      widget_description: getWidgetDescription(rawNode),
      ai_recursive: Boolean(rawNode.ai_recursive ?? rawNode.page_info?.ai_recursive),
      children: Array.isArray(rawNode.children) ? rawNode.children : [],
      pageActions: extractPageActions(rawNode),
      titleRepeatIndex: nextTitleCount,
      displayTitle: nextTitleCount > 1 ? `${rawTitle} #${nextTitleCount}` : rawTitle,
      level: depth,
      parentId,
      isFloating,
      aiInference: Object.keys(rawNode.ai_inference || {}).length ? rawNode.ai_inference : inferFloatingPage(rawNode),
      raw: rawNode
    };
    pages.push(node);

    if (parentId) {
      const widgetDescription = getWidgetDescription(rawNode);
      edges.push({
        id: `${parentId}__${stableId}`,
        from: parentId,
        to: stableId,
        label: widgetDescription || "进入",
        action_type: "navigate",
        widget_description: widgetDescription
      });
    }

    node.children.forEach((child, index) => {
      walk(child, stableId, depth + 1, index, [...path, stableId], isFloating);
    });

    return stableId;
  }

  rootItems.forEach((node, index) => walk(node, null, 1, index, ["root"], false));
  floatingItems.forEach((node, index) => walk(node, null, 1, index, ["floating"], true));

  const pageMap = new Map(pages.map((page) => [page.nodeId, page]));
  const childrenMap = edges.reduce((map, edge) => {
    if (!map.has(edge.from)) map.set(edge.from, []);
    map.get(edge.from).push(edge);
    return map;
  }, new Map());
  const incomingMap = edges.reduce((map, edge) => {
    if (!map.has(edge.to)) map.set(edge.to, []);
    map.get(edge.to).push(edge);
    return map;
  }, new Map());

  return {
    pages,
    edges,
    pageMap,
    childrenMap,
    incomingMap,
    roots: pages.filter((page) => !page.parentId && !page.isFloating).map((page) => page.nodeId),
    floatingRoots: pages.filter((page) => !page.parentId && page.isFloating).map((page) => page.nodeId),
    floatingPages: pages.filter((page) => page.isFloating),
    maxLevel: pages.reduce((level, page) => Math.max(level, page.level), 0)
  };
}

export function mergeFloatingPageIntoGraph(graph, nodeId, mergeInfo = {}) {
  const page = graph.pageMap.get(nodeId);
  if (!page) return graph;

  const requestedParentId = makeParentNodeId(mergeInfo);
  const fallbackParentId = graph.roots[0] || null;
  const parentId = graph.pageMap.has(requestedParentId) ? requestedParentId : fallbackParentId;
  const parent = parentId ? graph.pageMap.get(parentId) : null;
  const pages = graph.pages.map((item) => {
    if (item.nodeId !== nodeId) return item;
    return {
      ...item,
      isFloating: false,
      parentId,
      level: parent ? parent.level + 1 : 1,
      ai_recursive: Boolean(mergeInfo.ai_recursive ?? true),
      widget_description: mergeInfo.widget_description || mergeInfo.widgth_descirption || item.widget_description || "AI 探索并入"
    };
  });
  const edges = parentId
    ? [
        ...graph.edges,
        {
          id: `${parentId}__${nodeId}`,
          from: parentId,
          to: nodeId,
          label: mergeInfo.widget_description || mergeInfo.widgth_descirption || "AI 探索并入",
          action_type: "navigate",
          widget_description: mergeInfo.widget_description || mergeInfo.widgth_descirption || "AI 探索并入"
        }
      ]
    : graph.edges;

  return rebuildGraphIndexes({ ...graph, pages, edges });
}

export function moveGraphNode(graph, nodeId, targetParentId, moveInfo = {}) {
  if (!nodeId || !targetParentId || nodeId === targetParentId) return graph;
  const page = graph.pageMap.get(nodeId);
  const targetParent = graph.pageMap.get(targetParentId);
  if (!page || !targetParent || page.isFloating || targetParent.isFloating) return graph;
  if (isDescendantOf(graph, targetParentId, nodeId)) return graph;

  const widgetDescription = moveInfo.widget_description || page.widget_description || "人工调整归类";
  const pages = graph.pages.map((item) => {
    if (item.nodeId !== nodeId) return item;
    return {
      ...item,
      parentId: targetParentId,
      widget_description: widgetDescription,
      manual_reviewed: true,
      review_note: moveInfo.reason || "人工编辑树结构"
    };
  });
  const edges = [
    ...graph.edges.filter((edge) => edge.to !== nodeId),
    {
      id: `${targetParentId}__${nodeId}`,
      from: targetParentId,
      to: nodeId,
      label: widgetDescription,
      action_type: "navigate",
      widget_description: widgetDescription,
      source: "manual_edit"
    }
  ];

  return normalizeGraphLevels(rebuildGraphIndexes({ ...graph, pages, edges }));
}

export function addFloatingPageToGraph(graph, rawNode = {}) {
  const sequence = graph.floatingPages.length + 1;
  const source = typeof rawNode === "string" ? { page_url: rawNode } : rawNode;
  const nodeId = source.id ? `page-${source.id}` : `floating-draft-${Date.now()}`;
  const normalizedUrl = String(source.page_url || "").trim();
  const imageUrls = normalizeImageUrls(source);
  const pageTitle = source.page_title || `待完善页面 ${sequence}`;
  const page = {
    nodeId,
    backendId: source.id ?? null,
    pageId: source.page_id || "",
    page_title: pageTitle,
    displayTitle: pageTitle,
    page_text: source.page_text || "人工创建的游离 URL 页面，等待补充识别结果。",
    page_url: normalizedUrl,
    images: imageUrls,
    image_url: imageUrls[0] || "",
    image_urls: imageUrls,
    page_info: source.page_info || { source: "manual", review_status: "draft", is_orphan: true },
    widget_description: "",
    ai_recursive: Boolean(source.ai_recursive),
    children: [],
    pageActions: [],
    titleRepeatIndex: 1,
    level: 1,
    parentId: null,
    isFloating: true,
    aiInference: source.ai_inference || { label: "待人工补充", reason: "新建游离页面，尚未执行 AI 探索。" },
    review_status: "draft",
    raw: {}
  };
  return rebuildGraphIndexes({ ...graph, pages: [...graph.pages, page] });
}
export function createEmptyGraph() {
  return {
    pages: [],
    edges: [],
    pageMap: new Map(),
    childrenMap: new Map(),
    incomingMap: new Map(),
    roots: [],
    floatingRoots: [],
    floatingPages: [],
    maxLevel: 0
  };
}

function isDescendantOf(graph, nodeId, ancestorId) {
  let cursor = graph.pageMap.get(nodeId);
  while (cursor?.parentId) {
    if (cursor.parentId === ancestorId) return true;
    cursor = graph.pageMap.get(cursor.parentId);
  }
  return false;
}

function normalizeGraphLevels(graph) {
  const visited = new Set();
  const nextPages = graph.pages.map((page) => ({ ...page }));
  const nextPageMap = new Map(nextPages.map((page) => [page.nodeId, page]));

  function visit(nodeId, level) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const page = nextPageMap.get(nodeId);
    if (!page) return;
    page.level = level;
    (graph.childrenMap.get(nodeId) || []).forEach((edge) => visit(edge.to, level + 1));
  }

  graph.roots.forEach((rootId) => visit(rootId, 1));
  graph.floatingRoots.forEach((rootId) => visit(rootId, 1));

  return rebuildGraphIndexes({ ...graph, pages: nextPages });
}

export function makeNodeId(rawNode, pageText, path) {
  if (rawNode.id !== undefined && rawNode.id !== null) return `page-${rawNode.id}`;
  if (pageText) return `text-${hashString(pageText)}`;
  return `path-${hashString(path.join("/"))}`;
}

export function getOutgoingEdges(graph, nodeId) {
  return graph.childrenMap.get(nodeId) || [];
}

export function getIncomingEdges(graph, nodeId) {
  return graph.incomingMap.get(nodeId) || [];
}

export function getGraphLevel(graph, nodeId) {
  return graph.pageMap.get(nodeId)?.level || 1;
}

export function getAncestorPath(graph, nodeId) {
  const path = [];
  let cursor = graph.pageMap.get(nodeId);
  while (cursor) {
    path.unshift(cursor.displayTitle);
    cursor = cursor.parentId ? graph.pageMap.get(cursor.parentId) : null;
  }
  return path;
}

export function getPageCategory(page) {
  const info = page?.page_info || {};
  const type = info.page_type || info.type || info.category || "page";
  return {
    label: String(type),
    tone: pickTone(String(type))
  };
}

export function groupPageActions(actions = []) {
  return actions.reduce((groups, action) => {
    const key = action.effect_type || "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(action);
    return groups;
  }, {});
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

function pickTone(value) {
  const lowered = value.toLowerCase();
  if (/home|root|首页/.test(lowered)) return "blue";
  if (/search|搜索/.test(lowered)) return "cyan";
  if (/order|pay|订单|支付/.test(lowered)) return "amber";
  if (/account|profile|user|我的|账号/.test(lowered)) return "rose";
  if (/message|chat|消息/.test(lowered)) return "violet";
  return "slate";
}

function extractPageActions(rawNode) {
  const info = rawNode.page_info || {};
  const candidates = [
    ...asArray(rawNode.actions),
    ...asArray(rawNode.controls),
    ...asArray(rawNode.widgets),
    ...asArray(info.actions),
    ...asArray(info.controls),
    ...asArray(info.widgets),
    ...asArray(info.interactions)
  ];

  return candidates
    .map((item, index) => normalizeAction(item, index))
    .filter((action) => action.effect_type !== "navigate");
}

function normalizeAction(item, index) {
  const label = String(
    item.label ||
    item.text ||
    item.name ||
    item.semantic_name ||
    item.semanticName ||
    item.function_desc ||
    `action-${index + 1}`
  );
  const rawType = String(item.effect_type || item.effectType || item.action_effect || item.type || "").toLowerCase();
  const effectType = inferEffectType(label, rawType, item);

  return {
    id: item.id || item.widget_id || item.key || `action-${index + 1}`,
    label,
    action_type: item.action_type || item.actionType || "tap",
    effect_type: effectType,
    state_key: item.state_key || item.stateKey || inferStateKey(label),
    state_value: item.state_value ?? item.stateValue ?? null,
    confidence: item.confidence ?? null,
    description: item.description || item.reason || item.function_desc || "",
    raw: item
  };
}

function inferEffectType(label, rawType, item) {
  if (/navigate|jump|link|page|route/.test(rawType) || item.target_page || item.targetPage) return "navigate";
  if (/overlay|modal|sheet|dialog|popup|弹层|浮层|面板/.test(rawType + label)) return "overlay";
  if (/external|system|share|camera|album|outside|系统|分享|相机|相册/.test(rawType + label)) return "external";
  if (/like|favorite|collect|follow|subscribe|select|toggle|点赞|收藏|关注|订阅|选择|领取|加购/.test(rawType + label)) return "state_change";
  return rawType || "state_change";
}

function inferStateKey(label) {
  const value = label.toLowerCase();
  if (/like|点赞/.test(value)) return "liked";
  if (/favorite|collect|收藏/.test(value)) return "collected";
  if (/follow|关注/.test(value)) return "followed";
  if (/cart|加购/.test(value)) return "cart_added";
  if (/coupon|领取/.test(value)) return "coupon_received";
  if (/select|选择/.test(value)) return "selected";
  return "state_changed";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function rebuildGraphIndexes(graph) {
  const pageMap = new Map(graph.pages.map((page) => [page.nodeId, page]));
  const childrenMap = graph.edges.reduce((map, edge) => {
    if (!map.has(edge.from)) map.set(edge.from, []);
    map.get(edge.from).push(edge);
    return map;
  }, new Map());
  const incomingMap = graph.edges.reduce((map, edge) => {
    if (!map.has(edge.to)) map.set(edge.to, []);
    map.get(edge.to).push(edge);
    return map;
  }, new Map());
  return {
    ...graph,
    pageMap,
    childrenMap,
    incomingMap,
    roots: graph.pages.filter((page) => !page.parentId && !page.isFloating).map((page) => page.nodeId),
    floatingRoots: graph.pages.filter((page) => !page.parentId && page.isFloating).map((page) => page.nodeId),
    floatingPages: graph.pages.filter((page) => page.isFloating),
    maxLevel: graph.pages.reduce((level, page) => Math.max(level, page.level), 0)
  };
}

function makeParentNodeId(mergeInfo = {}) {
  const id = mergeInfo.target_parent_node_id || mergeInfo.parent_node_id;
  if (id) return String(id);
  const backendId = mergeInfo.target_parent_id || mergeInfo.parent_id || mergeInfo.parent_page_id;
  if (backendId !== undefined && backendId !== null) return `page-${backendId}`;
  return "";
}

function getWidgetDescription(rawNode) {
  return String(
    rawNode.widgth_descirption ||
    rawNode.widget_description ||
    rawNode.width_description ||
    rawNode.widgetDescription ||
    rawNode.page_info?.widgth_descirption ||
    rawNode.page_info?.widget_description ||
    ""
  ).trim();
}

function splitGraphPayload(graphPayload) {
  if (Array.isArray(graphPayload)) {
    return {
      rootItems: graphPayload.slice(0, 1),
      floatingItems: graphPayload.slice(1)
    };
  }

  if (!graphPayload || typeof graphPayload !== "object") {
    return { rootItems: [], floatingItems: [] };
  }

  const explicitFloating = firstArray(
    graphPayload.floating_pages,
    graphPayload.orphan_pages,
    graphPayload.detached_pages,
    graphPayload.free_pages,
    graphPayload.floatingUrls,
    graphPayload.floating_urls
  );

  const explicitRoots = firstArray(graphPayload.roots, graphPayload.trees, graphPayload.pages, graphPayload.nodes);
  if (explicitRoots) {
    return {
      rootItems: explicitRoots,
      floatingItems: explicitFloating || []
    };
  }

  const singleRoot = graphPayload.tree || graphPayload.root || graphPayload.graph || graphPayload.main_tree;
  if (singleRoot) {
    return {
      rootItems: Array.isArray(singleRoot) ? singleRoot : [singleRoot],
      floatingItems: explicitFloating || []
    };
  }

  if ("page_title" in graphPayload || "page_text" in graphPayload || "page_url" in graphPayload) {
    return {
      rootItems: [graphPayload],
      floatingItems: explicitFloating || []
    };
  }

  return { rootItems: [], floatingItems: explicitFloating || [] };
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value));
}

function inferFloatingPage(rawNode) {
  const url = String(rawNode.page_url || "").toLowerCase();
  const text = `${rawNode.page_title || ""} ${rawNode.page_text || ""} ${JSON.stringify(rawNode.page_info || {})}`.toLowerCase();
  const value = `${url} ${text}`;

  const rules = [
    {
      pattern: /face|facial|verify|identity|auth|realname|人脸|扫脸|实名认证/,
      label: "AI 推断: 身份/人脸验证页",
      reason: "该页面通常依赖摄像头、实名状态或安全风控，自动化脚本难以稳定覆盖。"
    },
    {
      pattern: /address|coupon|voucher|cart|checkout|poi|shipping|地址|优惠券|结算|下单|点单/,
      label: "AI 推断: 条件组合交易页",
      reason: "该页面受地址、库存、优惠券、门店或用户状态影响，图谱覆盖需要大量状态组合。"
    },
    {
      pattern: /pay|payment|cashier|wallet|bank|支付|收银台|钱包/,
      label: "AI 推断: 支付链路页",
      reason: "支付链路往往被安全策略、第三方 SDK 或账户状态隔离，适合作为游离节点保留。"
    }
  ];

  const matched = rules.find((rule) => rule.pattern.test(value));
  if (matched) return matched;

  return {
    label: "AI 推断: 未覆盖 URL 页面",
    reason: "该 URL 暂未在主树 children 关系中找到稳定位置，建议后续结合 URL、页面文本和向量检索补充归因。"
  };
}

