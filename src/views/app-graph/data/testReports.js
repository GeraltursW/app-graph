function metric(label, baseline, current, unit, threshold, direction = 'lower') {
  const delta = current - baseline;
  const failed = direction === 'lower' ? current > threshold : current < threshold;
  return {
    label,
    baseline,
    current,
    unit,
    threshold,
    direction,
    delta,
    status: failed ? 'failed' : 'passed',
  };
}

export function createMockTestReport(graph, appName = 'QQ') {
  const pages = graph.pages.filter((page) => !page.isFloating);
  const pick = (index) => pages[index % Math.max(1, pages.length)] || {
    nodeId: `mock-${index}`,
    pageId: `mock-page-${index}`,
    displayTitle: `示例页面 ${index + 1}`,
    pageUrl: `mqq://page/${index + 1}`,
    imageUrls: [],
  };
  const levels = ['critical', 'high', 'high', 'medium', 'medium', 'low'];
  const scenarios = ['消息列表连续加载', '短视频首屏滑动', '搜索结果快速切换', '群聊图片查看', '会员中心打开', '设置页往返'];
  const reports = scenarios.map((scenario, index) => {
    const page = pick(index * 11 + 3);
    const failed = index < 2;
    const warning = index === 2;
    const score = failed ? 62 + index * 7 : warning ? 78 : 88 + (index % 3) * 3;
    const url = page.pageUrl || `mqq://risk/${page.pageId || index}`;
    const image = page.imageUrls?.[0] || page.imageUrl || '';
    return {
      reportId: `risk-report-${index + 1}`,
      alertId: `ALERT-20260819-${String(index + 1).padStart(3, '0')}`,
      url,
      riskLevel: levels[index],
      status: failed ? 'failed' : warning ? 'warning' : 'passed',
      score,
      scenario,
      triggeredAt: `2026-08-19 ${String(10 + index).padStart(2, '0')}:${String(8 + index * 7).padStart(2, '0')}:20`,
      match: {
        pageId: page.pageId,
        nodeId: page.nodeId,
        pageTitle: page.displayTitle,
        score: 0.96 - index * 0.035,
        strategy: index === 2 ? 'URL 归一化 + 页面语义候选' : '标准 URL 精确匹配',
        candidates: index === 2 ? 3 : 1,
      },
      testCase: {
        caseId: `JIT-CASE-${String(index + 1).padStart(3, '0')}`,
        source: 'riskTriggered',
        name: `${page.displayTitle} · ${scenario}`,
        path: ['应用冷启动', '首页', page.displayTitle],
        actionCount: 4 + (index % 3),
      },
      metrics: [
        metric('平均 FPS', 58.8, failed ? 43.6 + index * 3 : 56.8 + index * .3, 'fps', 52, 'higher'),
        metric('Jank', 2.8, failed ? 10.9 - index : 3.2 + index * .25, '%', 8),
        metric('CPU 峰值', 31.2, failed ? 57.4 - index * 5 : 36.8 + index, '%', 50),
        metric('平均功耗', 0.84, failed ? 1.48 - index * .12 : .91 + index * .03, 'W', 1.3),
        metric('内存峰值', 512, failed ? 698 - index * 26 : 548 + index * 8, 'MB', 680),
      ],
      steps: [
        { stepNo: 1, stage: 'script', title: '重置应用并恢复账号态', action: 'forceStop -> launch', status: 'passed', durationMs: 1840, evidence: image },
        { stepNo: 2, stage: 'backend', title: '按图谱最短路径恢复页面', action: '首页 -> 目标功能入口', status: 'passed', durationMs: 2320, evidence: image },
        { stepNo: 3, stage: 'script', title: scenario, action: index % 2 ? 'swipe(up) x 4' : 'tap + wait + swipe', status: failed ? 'failed' : 'passed', durationMs: 5680, evidence: image },
        { stepNo: 4, stage: 'backend', title: '采集并对齐性能时间窗', action: 'collect(cpu,fps,power,memory)', status: 'passed', durationMs: 30000, evidence: image },
        { stepNo: 5, stage: 'frontend', title: '生成可追溯测试报告', action: 'aggregate -> render', status: 'passed', durationMs: 420, evidence: image },
      ],
      diagnosis: failed
        ? '连续交互阶段出现 FPS 下探并伴随功耗峰值，异常集中在第 3 步，建议关联线程采样与渲染耗时继续定位。'
        : warning
          ? '页面整体可用，但 CPU 峰值接近阈值，建议进入观察名单并在下个版本复测。'
          : '关键指标均处于阈值内，路径恢复、动作执行和数据采集结果稳定。',
    };
  });

  const failedCount = reports.filter((item) => item.status === 'failed').length;
  const warningCount = reports.filter((item) => item.status === 'warning').length;
  return {
    batchId: 'REPORT-BATCH-20260819-01',
    reportName: `${appName || '应用'}高危 URL 定向测试报告`,
    generatedAt: '2026-08-19 16:42:18',
    appName: appName || 'QQ',
    appVersion: '9.2.15-demo',
    device: 'Android 15 · Snapdragon 8 Gen 3',
    environment: '实验室 Wi-Fi · 25°C · 80% 电量',
    conclusion: failedCount ? '存在高风险性能回归' : '本批次通过',
    score: 76,
    summary: {
      alertUrls: reports.length,
      matchedUrls: reports.length,
      generatedCases: reports.length,
      executedCases: reports.length,
      failedCases: failedCount,
      warningCases: warningCount,
      passRate: Math.round(((reports.length - failedCount) / reports.length) * 100),
    },
    pipeline: [
      { key: 'script', label: '设备脚本', detail: '6/6 任务完成', status: 'passed', duration: '4m 18s' },
      { key: 'backend', label: '后端编排', detail: 'URL 匹配与用例生成完成', status: 'passed', duration: '1.8s' },
      { key: 'frontend', label: '前端报告', detail: '证据链完整可下钻', status: 'passed', duration: '420ms' },
    ],
    urlReports: reports,
  };
}
