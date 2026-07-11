type NodeRecord = Record<string, any>;

const page = (id: string, title: string, text: string, url: string, children: NodeRecord[] = [], extra = {}) => ({
  id,
  page_id: id,
  page_title: title,
  page_text: text,
  page_url: url,
  images: [],
  page_info: { page_type: 'screen', review_status: 'reviewed' },
  ai_inference: { label: '高置信页面', reason: '页面结构、文本语义与交互入口匹配。' },
  ai_recursive: false,
  widget_description: '点击功能入口',
  children,
  ...extra,
});

const qqRoot = page('qq-home', '消息首页', '展示会话列表、联系人状态和快捷入口，是应用的核心导航页面。', 'mqq://home', [
  page('qq-chat', '聊天详情', '展示单聊消息、输入框、语音、图片和更多操作入口。', 'mqq://chat/detail', [
    page('qq-profile', '好友资料', '展示头像、账号、动态和发起聊天等资料信息。', 'mqq://profile'),
    page('qq-gallery', '聊天图片', '聚合当前会话中的图片、视频与文件内容。', 'mqq://chat/gallery'),
  ]),
  page('qq-contacts', '联系人', '按好友、群聊和设备组织用户的联系人关系。', 'mqq://contacts', [
    page('qq-group', '群聊资料', '展示群成员、群公告、群文件和管理入口。', 'mqq://group/info'),
  ]),
  page('qq-feed', '动态', '展示好友动态、内容卡片和互动操作。', 'mqq://feed', [
    page('qq-feed-detail', '动态详情', '展示动态正文、图片、点赞和评论列表。', 'mqq://feed/detail'),
  ]),
  page('qq-settings', '设置', '提供账号、安全、通知、隐私和通用设置。', 'mqq://settings'),
]);

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
  QQ: {
    roots: [qqRoot],
    orphan_pages: [
      page('qq-orphan-pay', '支付扫脸页面', '需要生物识别授权，当前采集脚本无法稳定覆盖。', 'mqq://pay/face', [], {
        page_info: { page_type: 'orphan', is_orphan: true, review_status: 'draft' },
        ai_inference: { label: '可能属于支付流程', reason: 'URL 与支付场景相关，但缺少可复现的人脸授权条件。' },
      }),
      page('qq-orphan-device', '设备验证页面', '新设备登录时触发的安全验证页面。', 'mqq://security/device', [], {
        page_info: { page_type: 'orphan', is_orphan: true, review_status: 'draft' },
        ai_inference: { label: '可能属于账号安全', reason: '根据 URL 和文本推断为登录安全分支。' },
      }),
    ],
  },
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
  return { statue: 'success', node: clone(node) };
}

export async function mockExplore(pageRecord: NodeRecord) {
  await wait(850);
  return { can_merge: true, target_parent_node_id: 'page-qq-settings', target_parent_id: 'qq-settings', reason: 'AI 根据 URL 和页面语义推断该页面属于设置与安全分支。' };
}

function findInGraph(graph: { roots: NodeRecord[]; orphan_pages: NodeRecord[] }, id: string) {
  let result: NodeRecord | null = null;
  walk([...graph.roots, ...graph.orphan_pages], (node) => {
    if (node.page_id === id) result = node;
    return Boolean(result);
  });
  return result;
}

function countNodes(nodes: NodeRecord[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children || []), 0);
}
