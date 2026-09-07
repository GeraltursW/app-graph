import { mockCoverageRows } from './appGraph';
import { mockReportBaseline } from './projectBaseline';

const facts = new Map<string, string | null>();
mockCoverageRows().forEach((r, i) => { if (r.embeddingText.trim()) facts.set(JSON.stringify([r.appName, r.pageUrl]), i < 20 ? new Date(Date.now() - (i + 1) * 3600000).toISOString() : null); });
const reports: any[] = [], requests = new Map<string, { body: string; result: any }>();
export async function mockCoverageRequest(path: string, body: any = {}) {
  const baseline = mockReportBaseline();
  if (path.endsWith('/current')) return structuredClone(baseline);
  if (path.endsWith('/daily') || path.endsWith('/trends')) {
    const keys = new Set(); return structuredClone(reports.filter(r => { const k = r.date + r.reportType; if (keys.has(k)) return false; keys.add(k); return true; }));
  }
  const previous = requests.get(body.requestId);
  if (previous) { if (previous.body !== JSON.stringify(body)) throw new Error('请求标识重复'); return structuredClone(previous.result); }
  if (path.endsWith('/generate')) {
    const end = new Date(`${body.date}T${body.reportType === 'MORNING' ? '08' : '20'}:00:00+08:00`).getTime(), start = end - 12 * 3600000;
    if (!Number.isFinite(end) || end > Date.now()) throw new Error('统计区间尚未结束');
    const rows = mockCoverageRows();
    rows.forEach(r => { const key = JSON.stringify([r.appName, r.pageUrl]); if (r.embeddingText.trim() && !facts.has(key)) facts.set(key, new Date().toISOString()); });
    const apps = baseline.apps.map((a: any) => {
      const live = rows.filter(r => r.appName === a.appName), urls = new Map<string, any>();
      for (const r of live) {
        const old = urls.get(r.pageUrl) || { pageUrl: r.pageUrl, pageIds: [], covered: false, priority: false };
        old.pageIds.push(r.pageId); old.pageTitle = r.pageTitle; old.covered ||= !!r.embeddingText.trim(); urls.set(r.pageUrl, old);
      }
      for (const url of a.baselineUrls) { const item = urls.get(url) || { pageUrl: url, pageIds: [], covered: false }; item.inBaseline = true; urls.set(url, item); }
      for (const url of a.priorityUrls) { const item = urls.get(url) || { pageUrl: url, pageIds: [], covered: false }; item.priority = true; urls.set(url, item); }
      let newUrlCount = 0;
      for (const [key, time] of facts) {
        const [name, url] = JSON.parse(key); if (name !== a.appName) continue;
        const isNew = !!time && new Date(time).getTime() >= start && new Date(time).getTime() < end;
        if (isNew) newUrlCount++;
        if (isNew || urls.has(url)) { const item = urls.get(url) || { pageUrl: url, pageIds: [], covered: false }; item.isNew = isNew; item.firstCoverageTime = time; urls.set(url, item); }
      }
      const values = [...urls.values()];
      return { ...a, nodeCount: new Set(live.filter(r => r.embeddingText.trim()).map(r => r.pageId)).size, newUrlCount,
        coveredUrlCount: values.filter(u => u.covered).length, baselineCoveredCount: values.filter(u => u.covered && u.inBaseline).length, orphanUrlCount: values.filter(u => !u.covered && u.pageIds.length).length,
        priorityUrlCount: a.priorityUrls.length, priorityCoveredCount: values.filter(u => u.priority && u.covered).length, functionCount: null, urls: values };
    });
    const result = { reportId: crypto.randomUUID(), date: body.date, reportType: body.reportType, periodStart: new Date(start).toISOString(), periodEnd: new Date(end).toISOString(), generatedAt: new Date().toISOString(), baselineSource: baseline.source, apps };
    reports.unshift(result); requests.set(body.requestId, { body: JSON.stringify(body), result }); return structuredClone(result);
  }
  return structuredClone(reports.find(r => path.endsWith(r.reportId)));
}
