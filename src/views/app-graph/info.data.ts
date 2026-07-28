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
        functionId: 'message',
        parentId: null,
        level: 1,
        functionName: '消息',
        functionDescription: '会话、消息检索和聊天记录等核心通信能力。',
        expectedPages: 8,
        matchRules: { keywords: ['消息中心', '会话列表', '单聊窗口', '群聊窗口', '消息搜索', '聊天记录', '消息设置'] },
      },
      {
        functionId: 'message.single-chat',
        parentId: 'message',
        level: 2,
        functionName: '单聊',
        functionDescription: '与单个联系人进行即时消息沟通。',
        expectedPages: 2,
        matchRules: { keywords: ['单聊窗口', '聊天记录'] },
      },
      {
        functionId: 'message.group-chat',
        parentId: 'message',
        level: 2,
        functionName: '群聊',
        functionDescription: '多人会话、群消息和群聊管理。',
        expectedPages: 2,
        matchRules: { keywords: ['群聊窗口', '群聊列表'] },
      },
      {
        functionId: 'contacts',
        parentId: null,
        level: 1,
        functionName: '联系人',
        functionDescription: '好友、群组、通讯录和联系人资料管理。',
        expectedPages: 7,
        matchRules: { keywords: ['联系人中心', '好友列表', '好友资料', '群聊列表', '设备通讯录', '新朋友', '分组管理'] },
      },
      {
        functionId: 'contacts.new-friend',
        parentId: 'contacts',
        level: 2,
        functionName: '新朋友',
        functionDescription: '处理好友申请和新的联系人关系。',
        expectedPages: 1,
        matchRules: { keywords: ['新朋友'] },
      },
      {
        functionId: 'social',
        parentId: null,
        level: 1,
        functionName: '动态与空间',
        functionDescription: '好友动态、内容发布、评论和点赞互动。',
        expectedPages: 7,
        matchRules: { keywords: ['动态中心', '好友动态', '动态详情', '评论列表', '点赞列表', '空间主页', '发布动态'] },
      },
      {
        functionId: 'video',
        parentId: null,
        level: 1,
        functionName: '短视频',
        functionDescription: '视频推荐、内容详情、作者和评论浏览。',
        expectedPages: 7,
        matchRules: { keywords: ['短视频中心', '视频推荐', '视频详情', '作者主页', '视频评论', '关注列表', '视频搜索'] },
      },
      {
        functionId: 'live',
        parentId: null,
        level: 1,
        functionName: '直播',
        functionDescription: '直播发现、直播间互动与主播关系。',
        expectedPages: 7,
        matchRules: { keywords: ['直播中心', '直播广场', '直播间', '主播主页', '礼物面板', '粉丝榜', '直播回放'] },
      },
      {
        functionId: 'wallet',
        parentId: null,
        level: 1,
        functionName: '钱包与支付',
        functionDescription: '余额、支付、账单、银行卡和充值服务。',
        expectedPages: 7,
        matchRules: { keywords: ['钱包中心', '钱包首页', '支付页面', '账单列表', '银行卡', '充值中心', '会员支付'] },
      },
      {
        functionId: 'wallet.face-pay',
        parentId: 'wallet',
        level: 2,
        functionName: '刷脸支付',
        functionDescription: '依赖生物识别授权的支付确认能力。',
        expectedPages: 1,
        automationLimited: true,
        matchRules: { keywords: ['支付扫脸', '刷脸支付'], urls: ['face'] },
      },
      {
        functionId: 'files',
        parentId: null,
        level: 1,
        functionName: '文件',
        functionDescription: '文件助手、群文件、图片和视频内容管理。',
        expectedPages: 7,
        matchRules: { keywords: ['文件中心', '文件助手', '最近文件', '群文件', '图片查看', '视频播放', '下载管理'] },
      },
      {
        functionId: 'membership',
        parentId: null,
        level: 1,
        functionName: '会员服务',
        functionDescription: '会员权益、成长、装扮和订阅服务。',
        expectedPages: 6,
        matchRules: { keywords: ['会员中心', '会员首页', '会员权益', '成长中心', '个性装扮', '会员订阅'] },
      },
      {
        functionId: 'security',
        parentId: null,
        level: 1,
        functionName: '设置与安全',
        functionDescription: '账号、隐私、通知、设备和安全验证。',
        expectedPages: 7,
        matchRules: { keywords: ['设置中心', '账号管理', '隐私设置', '通知设置', '安全中心', '设备管理', '通用设置', '设备验证'] },
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
  QQ: [],
};

export function getTestCaseCatalog(appName: string) {
  return testCaseCatalogs[appName as keyof typeof testCaseCatalogs] || [];
}
