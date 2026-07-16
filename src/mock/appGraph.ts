type NodeRecord = Record<string, any>;

const page = (id: string, title: string, text: string, url: string, children: NodeRecord[] = [], extra = {}) => ({
  id,
  page_id: id,
  page_title: title,
  page_text: text,
  page_url: url,
  images: [],
  action: {
    popupAction: [],
    stateAction: [],
    externalAction: [],
    pageNaviAction: children.map((child) => ({
      id: `${id}-${child.id}`,
      label: child.widget_description || `进入${child.page_title}`,
      action_type: 'tap',
      description: `从${title}进入${child.page_title}`,
      target_page_id: child.page_id,
      target_page_title: child.page_title,
    })),
  },
  page_info: { page_type: 'screen', review_status: 'reviewed' },
  ai_inference: { label: '高置信页面', reason: '页面结构、文本语义与交互入口匹配。' },
  ai_recursive: false,
  widget_description: '点击功能入口',
  children,
  ...extra,
});

const qqDomains = [
  ['message', '消息', '#1769e0', ['会话列表', '单聊窗口', '群聊窗口', '消息搜索', '聊天记录', '消息设置']],
  ['contacts', '联系人', '#087ea4', ['好友列表', '群聊列表', '设备通讯录', '好友资料', '分组管理', '新朋友']],
  ['feed', '动态', '#4f46e5', ['好友动态', '动态详情', '评论列表', '点赞列表', '空间主页', '发布动态']],
  ['video', '短视频', '#be3f68', ['视频推荐', '视频详情', '作者主页', '视频评论', '关注列表', '视频搜索']],
  ['live', '直播', '#a13db8', ['直播广场', '直播间', '主播主页', '礼物面板', '粉丝榜', '直播回放']],
  ['wallet', '钱包', '#16845b', ['钱包首页', '支付页面', '账单列表', '银行卡', '充值中心', '会员支付']],
  ['games', '游戏', '#b7791f', ['游戏中心', '游戏详情', '礼包中心', '好友排行', '启动游戏', '游戏社区']],
  ['files', '文件', '#326f9f', ['文件助手', '最近文件', '群文件', '图片查看', '视频播放', '下载管理']],
  ['membership', '会员', '#d24b74', ['会员首页', '特权中心', '装扮商城', '成长值', '订单记录', '续费管理']],
  ['settings', '设置', '#237a57', ['设置首页', '账号安全', '隐私设置', '通知设置', '通用设置', '关于 QQ']],
] as const;

function mockScreenshot(title: string, domain: string, color: string, index: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="780" viewBox="0 0 360 780">
    <rect width="360" height="780" fill="#f4f8fd"/><rect width="360" height="82" fill="${color}"/>
    <text x="20" y="30" fill="#fff" font-size="13" font-family="Arial,Microsoft YaHei">09:41</text>
    <text x="20" y="62" fill="#fff" font-size="22" font-weight="700" font-family="Arial,Microsoft YaHei">${title}</text>
    <rect x="18" y="104" width="324" height="58" rx="8" fill="#fff" stroke="#d8e4f1"/>
    <circle cx="48" cy="133" r="15" fill="${color}" opacity=".2"/><text x="76" y="139" fill="#24364d" font-size="15" font-family="Arial,Microsoft YaHei">${domain}功能导航</text>
    <rect x="18" y="182" width="324" height="184" rx="8" fill="#fff" stroke="#d8e4f1"/>
    <rect x="34" y="200" width="104" height="148" rx="6" fill="${color}" opacity=".12"/>
    <text x="158" y="236" fill="#172033" font-size="18" font-weight="700" font-family="Arial,Microsoft YaHei">页面 #${String(index).padStart(3, '0')}</text>
    <rect x="158" y="260" width="148" height="11" rx="5" fill="#dbe6f2"/><rect x="158" y="284" width="116" height="10" rx="5" fill="#e8eef5"/>
    <rect x="158" y="316" width="122" height="31" rx="5" fill="${color}"/><text x="177" y="337" fill="#fff" font-size="13" font-family="Arial,Microsoft YaHei">进入下一页面</text>
    <rect x="18" y="386" width="324" height="92" rx="8" fill="#fff" stroke="#d8e4f1"/><circle cx="58" cy="432" r="22" fill="${color}" opacity=".18"/>
    <rect x="96" y="414" width="190" height="12" rx="6" fill="#dbe6f2"/><rect x="96" y="440" width="138" height="10" rx="5" fill="#e8eef5"/>
    <rect x="18" y="496" width="324" height="92" rx="8" fill="#fff" stroke="#d8e4f1"/><circle cx="58" cy="542" r="22" fill="${color}" opacity=".12"/>
    <rect x="96" y="524" width="210" height="12" rx="6" fill="#dbe6f2"/><rect x="96" y="550" width="156" height="10" rx="5" fill="#e8eef5"/>
    <rect x="18" y="606" width="324" height="94" rx="8" fill="#fff" stroke="#d8e4f1"/><text x="34" y="637" fill="#526176" font-size="13" font-family="Arial,Microsoft YaHei">AI 页面识别结果</text>
    <rect x="34" y="656" width="272" height="10" rx="5" fill="#dbe6f2"/><rect x="34" y="678" width="210" height="9" rx="4" fill="#e8eef5"/>
    <rect y="724" width="360" height="56" fill="#fff"/><circle cx="70" cy="750" r="8" fill="${color}"/><circle cx="180" cy="750" r="8" fill="#b9c8d8"/><circle cx="290" cy="750" r="8" fill="#b9c8d8"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function refreshNavigationActions(node: NodeRecord) {
  node.action.pageNaviAction = (node.children || []).map((child: NodeRecord) => ({
    id: `${node.id}-${child.id}`,
    label: child.widget_description || `进入${child.page_title}`,
    action_type: 'tap',
    description: `从${node.page_title}进入${child.page_title}`,
    target_page_id: child.page_id,
    target_page_title: child.page_title,
  }));
  (node.children || []).forEach(refreshNavigationActions);
}

function buildQqDemoGraph() {
  const root = page('qq-home', 'QQ 首页', 'QQ 应用主入口，聚合消息、联系人、动态与服务功能。', 'mqq://home', [], {
    page_info: { page_type: 'home', domain: 'home', review_status: 'confirmed' },
  });
  const byKey = new Map<string, NodeRecord>([['home', root]]);
  let sequence = 1;
  const mainNodeCount = 293;
  const remaining = mainNodeCount - 1;
  const baseCount = Math.floor(remaining / qqDomains.length);
  const remainder = remaining % qqDomains.length;

  qqDomains.forEach(([domainKey, domainName, color, titles], domainIndex) => {
    const domainCount = baseCount + (domainIndex < remainder ? 1 : 0);
    const domainPages: NodeRecord[] = [];
    for (let localIndex = 0; localIndex < domainCount; localIndex += 1) {
      sequence += 1;
      const key = `${domainKey}-${String(localIndex + 1).padStart(2, '0')}`;
      const title = localIndex === 0
        ? `${domainName}中心`
        : `${titles[(localIndex - 1) % titles.length]} ${String(localIndex).padStart(2, '0')}`;
      const parentKey = localIndex === 0
        ? 'home'
        : domainPages[Math.floor((localIndex - 1) / 4)].id;
      const widget = localIndex === 0 ? domainName : titles[(localIndex + domainIndex) % titles.length];
      const node = page(
        key,
        title,
        `QQ ${domainName}功能域中的${title}，用于展示大规模图谱的布局、检索和跳转关系。`,
        `mqq://${domainKey}/${localIndex + 1}`,
        [],
        {
          widget_description: widget,
          ai_recursive: localIndex > 0 && localIndex % 13 === 0,
          page_info: { page_type: domainKey, domain: domainName, source: 'frontend_mock', review_status: 'confirmed' },
        },
      );
      node.images = [mockScreenshot(title, domainName, color, sequence)];
      byKey.get(parentKey)?.children.push(node);
      byKey.set(key, node);
      domainPages.push(node);
    }
  });

  root.images = [
    mockScreenshot('QQ 首页', '首页', '#1769e0', 1),
    mockScreenshot('QQ 消息', '首页', '#087ea4', 1),
    mockScreenshot('QQ 服务', '首页', '#4f46e5', 1),
  ];
  root.action.popupAction.push({ id: 'qq-home-search', label: '打开搜索', action_type: 'tap', popup_name: '全局搜索面板', description: '首页顶部搜索入口' });
  root.action.stateAction.push({ id: 'qq-home-dnd', label: '消息免打扰', action_type: 'tap', state_key: 'dnd_enabled', state_value: true, description: '切换消息提醒状态' });
  root.action.externalAction.push({ id: 'qq-home-scan', label: '扫一扫', action_type: 'tap', target: 'system_camera', description: '调用系统相机扫码' });
  refreshNavigationActions(root);

  const orphanPages = Array.from({ length: 7 }, (_, index) => {
    const title = `待探索页面 ${index + 1}`;
    const node = page(`orphan-${index + 1}`, title, '由线上 URL 或 AI 探索发现，当前尚未确认其稳定父节点。', `mqq://uncovered/${index + 1}`, [], {
      images: [mockScreenshot(title, '游离 URL', '#b7791f', 294 + index)],
      ai_recursive: true,
      page_info: { page_type: 'orphan', domain: '游离 URL', is_orphan: true, source: 'frontend_mock', review_status: 'pending' },
      ai_inference: { label: 'AI 推断页面', reason: '线上 URL 已发现，但尚未确认稳定父节点。' },
    });
    return node;
  });
  return { roots: [root], orphan_pages: orphanPages };
}

const wechatRoot = page('wx-home', '微信首页', '展示最近会话、未读消息和搜索入口。', 'weixin://home', [
  page('wx-chat', '聊天页面', '支持文本、语音、图片、红包和小程序消息。', 'weixin://chat'),
  page('wx-contacts', '通讯录', '展示好友、群聊、标签和公众号入口。', 'weixin://contacts'),
  page('wx-discover', '发现', '承载朋友圈、视频号、扫一扫和小程序入口。', 'weixin://discover', [
    page('wx-moments', '朋友圈', '展示好友内容流、点赞和评论互动。', 'weixin://moments'),
    page('wx-scan', '扫一扫', '调用相机识别二维码、条码和物体。', 'weixin://scan'),
  ]),
  page('wx-me', '我的', '展示支付、收藏、朋友圈和个人设置入口。', 'weixin://me'),
]);

const store: Record<string, { roots: NodeRecord[]; orphan_pages: NodeRecord[] }> = {
  QQ: buildQqDemoGraph(),
  微信: { roots: [wechatRoot], orphan_pages: [] },
};

const wait = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = <T>(value: T): T => structuredClone(value);

function walk(nodes: NodeRecord[], visitor: (node: NodeRecord, parent: NodeRecord | null) => boolean, parent = null as NodeRecord | null): boolean {
  for (const node of nodes) {
    if (visitor(node, parent)) return true;
    if (walk(node.children || [], visitor, node)) return true;
  }
  return false;
}

function findNode(appName: string, pageId: string) {
  let result: NodeRecord | null = null;
  const graph = store[appName];
  if (!graph) return null;
  walk([...graph.roots, ...graph.orphan_pages], (node) => {
    if (node.page_id === pageId) result = node;
    return Boolean(result);
  });
  return result;
}

function removeNode(nodes: NodeRecord[], pageId: string): NodeRecord | null {
  const index = nodes.findIndex((node) => node.page_id === pageId);
  if (index >= 0) return nodes.splice(index, 1)[0];
  for (const node of nodes) {
    const found = removeNode(node.children || [], pageId);
    if (found) return found;
  }
  return null;
}

export async function mockAppList() {
  await wait(260);
  return Object.entries(store).map(([app_name, graph]) => ({
    app_name,
    count: countNodes([...graph.roots, ...graph.orphan_pages]),
  }));
}

export async function mockQueryGraph(appName: string) {
  await wait(350);
  return clone(store[appName] || { roots: [], orphan_pages: [] });
}

export async function mockCreateOrphan(appName: string, pageUrl: string) {
  await wait();
  const graph = store[appName];
  if (!graph) throw new Error(`应用 ${appName} 不存在`);
  let existing: NodeRecord | null = null;
  walk([...graph.roots, ...graph.orphan_pages], (node) => {
    if (node.page_url === pageUrl) existing = node;
    return Boolean(existing);
  });
  if (existing) return { statue: 'success', created: false, node: clone(existing) };
  const id = `orphan-${Date.now()}`;
  const node = page(id, '待探索页面', '人工创建的游离 URL 页面，等待 AI 探索和截图识别。', pageUrl, [], {
    page_info: { page_type: 'orphan', is_orphan: true, review_status: 'draft' },
    ai_inference: { label: '待探索', reason: '该 URL 尚未归入主图谱。' },
  });
  graph.orphan_pages.push(node);
  return { statue: 'success', created: true, node: clone(node) };
}

export async function mockMoveNode(pageId: string, parentId: string) {
  await wait(600);
  for (const graph of Object.values(store)) {
    const target = findInGraph(graph, parentId);
    if (!target) continue;
    const moved = removeNode(graph.roots, pageId) || removeNode(graph.orphan_pages, pageId);
    if (!moved) throw new Error('待移动节点不存在');
    target.children ||= [];
    target.children.push(moved);
    return { statue: 'success', moved: true, page_id: pageId, new_parent_id: parentId };
  }
  throw new Error('目标父节点不存在');
}

export async function mockDeleteNode(pageId: string) {
  await wait(600);
  for (const graph of Object.values(store)) {
    if (deleteNodeOnly(graph.roots, pageId) || deleteNodeOnly(graph.orphan_pages, pageId)) {
      return { statue: 'success', deleted: true, page_id: pageId };
    }
  }
  throw new Error('待删除节点不存在');
}

export async function mockUpdateNode(formData: FormData) {
  await wait(600);
  const pageId = String(formData.get('page_id') || '');
  let node: NodeRecord | null = null;
  for (const appName of Object.keys(store)) node ||= findNode(appName, pageId);
  if (!node) throw new Error('页面不存在');
  node.page_title = String(formData.get('page_title') || node.page_title);
  node.page_text = String(formData.get('page_text') || '');
  node.page_url = String(formData.get('page_url') || '');
  node.widget_description = String(formData.get('widget_description') || '');
  node.ai_recursive = String(formData.get('ai_recursive')) === 'true';
  node.ai_inference = JSON.parse(String(formData.get('ai_inference') || '{}'));
  node.action = JSON.parse(String(formData.get('action') || '{}'));
  return { statue: 'success', node: clone(node) };
}

export async function mockExplore(pageRecord: NodeRecord) {
  await wait(850);
  return { can_merge: true, target_parent_node_id: 'page-settings-01', target_parent_id: 'settings-01', reason: 'AI 根据 URL 和页面语义推断该页面属于设置与安全分支。' };
}

function findInGraph(graph: { roots: NodeRecord[]; orphan_pages: NodeRecord[] }, id: string) {
  let result: NodeRecord | null = null;
  walk([...graph.roots, ...graph.orphan_pages], (node) => {
    if (node.page_id === id) result = node;
    return Boolean(result);
  });
  return result;
}

function deleteNodeOnly(nodes: NodeRecord[], pageId: string): boolean {
  const index = nodes.findIndex((node) => node.page_id === pageId);
  if (index >= 0) {
    const [deleted] = nodes.splice(index, 1);
    nodes.splice(index, 0, ...(deleted.children || []));
    return true;
  }
  return nodes.some((node) => deleteNodeOnly(node.children || [], pageId));
}

function countNodes(nodes: NodeRecord[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children || []), 0);
}
