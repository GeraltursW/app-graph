export const layoutModes = [
  { value: 'horizontal', label: '左右排列' },
  { value: 'vertical', label: '上下排列' },
  { value: 'radial', label: '自由排列' },
];

export const toolActions = [
  { value: 'fit', label: '适配视图' },
  { value: 'expand', label: '全部展开' },
  { value: 'collapse', label: '全部收起' },
  { value: 'reset', label: '重置布局' },
  { value: 'export', label: '导出整图' },
];

export const workModes = [
  { value: 'graph', label: '图谱探索' },
  { value: 'cases', label: '用例编排' },
];

export const graphNodeBox = {
  width: 260,
  height: 230,
  horizontalGap: 190,
  verticalGap: 110,
  siblingGap: 56,
};

export const officialFunctionCatalogs = {
  QQ: {
    source: 'QQ 官方能力目录',
    version: 'demo-2026.07',
    functions: [
      {
        function_id: 'message',
        parent_id: null,
        level: 1,
        function_name: '消息',
        function_description: '会话、消息检索和聊天记录等核心通信能力。',
        expected_pages: 8,
        match_rules: { keywords: ['消息中心', '会话列表', '单聊窗口', '群聊窗口', '消息搜索', '聊天记录', '消息设置'] },
      },
      {
        function_id: 'message.single-chat',
        parent_id: 'message',
        level: 2,
        function_name: '单聊',
        function_description: '与单个联系人进行即时消息沟通。',
        expected_pages: 2,
        match_rules: { keywords: ['单聊窗口', '聊天记录'] },
      },
      {
        function_id: 'message.group-chat',
        parent_id: 'message',
        level: 2,
        function_name: '群聊',
        function_description: '多人会话、群消息和群聊管理。',
        expected_pages: 2,
        match_rules: { keywords: ['群聊窗口', '群聊列表'] },
      },
      {
        function_id: 'contacts',
        parent_id: null,
        level: 1,
        function_name: '联系人',
        function_description: '好友、群组、通讯录和联系人资料管理。',
        expected_pages: 7,
        match_rules: { keywords: ['联系人中心', '好友列表', '好友资料', '群聊列表', '设备通讯录', '新朋友', '分组管理'] },
      },
      {
        function_id: 'contacts.new-friend',
        parent_id: 'contacts',
        level: 2,
        function_name: '新朋友',
        function_description: '处理好友申请和新的联系人关系。',
        expected_pages: 1,
        match_rules: { keywords: ['新朋友'] },
      },
      {
        function_id: 'social',
        parent_id: null,
        level: 1,
        function_name: '动态与空间',
        function_description: '好友动态、内容发布、评论和点赞互动。',
        expected_pages: 7,
        match_rules: { keywords: ['动态中心', '好友动态', '动态详情', '评论列表', '点赞列表', '空间主页', '发布动态'] },
      },
      {
        function_id: 'video',
        parent_id: null,
        level: 1,
        function_name: '短视频',
        function_description: '视频推荐、内容详情、作者和评论浏览。',
        expected_pages: 7,
        match_rules: { keywords: ['短视频中心', '视频推荐', '视频详情', '作者主页', '视频评论', '关注列表', '视频搜索'] },
      },
      {
        function_id: 'live',
        parent_id: null,
        level: 1,
        function_name: '直播',
        function_description: '直播发现、直播间互动与主播关系。',
        expected_pages: 7,
        match_rules: { keywords: ['直播中心', '直播广场', '直播间', '主播主页', '礼物面板', '粉丝榜', '直播回放'] },
      },
      {
        function_id: 'wallet',
        parent_id: null,
        level: 1,
        function_name: '钱包与支付',
        function_description: '余额、支付、账单、银行卡和充值服务。',
        expected_pages: 7,
        match_rules: { keywords: ['钱包中心', '钱包首页', '支付页面', '账单列表', '银行卡', '充值中心', '会员支付'] },
      },
      {
        function_id: 'wallet.face-pay',
        parent_id: 'wallet',
        level: 2,
        function_name: '刷脸支付',
        function_description: '依赖生物识别授权的支付确认能力。',
        expected_pages: 1,
        automation_limited: true,
        match_rules: { keywords: ['支付扫脸', '刷脸支付'], urls: ['face'] },
      },
      {
        function_id: 'files',
        parent_id: null,
        level: 1,
        function_name: '文件',
        function_description: '文件助手、群文件、图片和视频内容管理。',
        expected_pages: 7,
        match_rules: { keywords: ['文件中心', '文件助手', '最近文件', '群文件', '图片查看', '视频播放', '下载管理'] },
      },
      {
        function_id: 'membership',
        parent_id: null,
        level: 1,
        function_name: '会员服务',
        function_description: '会员权益、成长、装扮和订阅服务。',
        expected_pages: 6,
        match_rules: { keywords: ['会员中心', '会员首页', '会员权益', '成长中心', '个性装扮', '会员订阅'] },
      },
      {
        function_id: 'security',
        parent_id: null,
        level: 1,
        function_name: '设置与安全',
        function_description: '账号、隐私、通知、设备和安全验证。',
        expected_pages: 7,
        match_rules: { keywords: ['设置中心', '账号管理', '隐私设置', '通知设置', '安全中心', '设备管理', '通用设置', '设备验证'] },
      },
    ],
  },
};

export function getOfficialFunctionCatalog(appName: string) {
  return officialFunctionCatalogs[appName as keyof typeof officialFunctionCatalogs] || {
    source: '暂无官方目录',
    version: '',
    functions: [],
  };
}

export const testCaseCatalogs = {
  QQ: [
    {
      case_id: 'qq-scenario-video-scroll',
      case_name: '短视频连续滑动性能',
      case_type: 'scenario',
      description: '从短视频推荐页开始执行连续滑动、停留和长按操作，记录全过程性能变化。',
      start_page_title: '视频推荐 01',
      operations: [
        { type: 'wait', label: '等待页面稳定', duration_ms: 2000 },
        { type: 'swipe', label: '向上滑动', direction: 'up', repeat: 5, duration_ms: 420 },
        { type: 'wait', label: '内容停留', duration_ms: 1800 },
        { type: 'long_press', label: '长按视频内容', duration_ms: 800 },
        { type: 'swipe', label: '滑动评论区域', direction: 'up', repeat: 3, duration_ms: 360 },
      ],
      collection: {
        trigger: 'case_lifecycle',
        duration_seconds: 24,
        metrics: ['FPS', 'Jank', 'CPU', '内存', '功耗'],
      },
    },
  ],
};

export function getTestCaseCatalog(appName: string) {
  return testCaseCatalogs[appName as keyof typeof testCaseCatalogs] || [];
}
