import { mockCoverageRows } from './appGraph';
import { validateBaselineRows, validatePriorityUrls } from '../views/app-graph/data/projectBaseline';

const urls = new Map<string, any>();
const settings = new Map<string, any>();
const requests = new Map<string, any>();
const key = (app: string, url: string) => JSON.stringify([app, url]);
mockCoverageRows().forEach((row, index) => {
  urls.set(key(row.appName, row.pageUrl), { appName: row.appName, pageUrl: row.pageUrl, source: '演示基线', priority: index < 30, addedAt: new Date().toISOString() });
  settings.set(row.appName, { appGroups: ['TOP'], specialNote: '' });
});

export function mockReportBaseline() {
  return { source: '项目 URL 基线', apps: [...settings].map(([appName, config]) => {
    const rows = [...urls.values()].filter(r => r.appName === appName);
    return { appName, ...config, totalUrlCount: rows.length, baselineUrls: rows.map(r => r.pageUrl), priorityUrls: rows.filter(r => r.priority).map(r => r.pageUrl) };
  }) };
}

export async function mockProjectBaseline(path: string, body: any) {
  const covered = new Set(mockCoverageRows().filter(r => r.embeddingText.trim()).map(r => key(r.appName, r.pageUrl)));
  if (path.endsWith('/overview')) {
    const apps = mockReportBaseline().apps.map(a => ({ ...a, coveredUrlCount: a.baselineUrls.filter((url: string) => covered.has(key(a.appName, url))).length, priorityUrlCount: a.priorityUrls.length }));
    return { apps, appCount: apps.length, urlCount: urls.size, coveredUrlCount: [...urls.keys()].filter(k => covered.has(k)).length };
  }
  if (path.endsWith('/urls')) {
    const rows = [...urls.values()].filter(r => r.appName === body.appName && r.pageUrl.includes(body.keyword || '')).reverse();
    const page = body.page || 1, pageSize = body.pageSize || 30;
    return { items: rows.slice((page - 1) * pageSize, page * pageSize).map(r => ({ ...r, covered: covered.has(key(r.appName, r.pageUrl)) })), total: rows.length, page, pageSize };
  }
  if (path.endsWith('/append')) {
    const serialized = JSON.stringify(body), old = requests.get(body.requestId);
    if (old) { if (old.body !== serialized) throw new Error('请求标识重复'); return old.result; }
    const validated = validateBaselineRows(body.rows);
    if (validated.errors.length) throw new Error(`第 ${validated.errors[0].rowNo} 行无效`);
    let added = 0;
    for (const row of validated.rows) {
      const id = key(row.appName, row.pageUrl);
      if (urls.has(id)) continue;
      urls.set(id, { ...row, priority: false, source: body.source, addedAt: new Date().toISOString() });
      if (!settings.has(row.appName)) settings.set(row.appName, { appGroups: [], specialNote: '' });
      added++;
    }
    const result = { requestId: body.requestId, addedCount: added, duplicateCount: body.rows.length - added, receivedCount: body.rows.length };
    requests.set(body.requestId, { body: serialized, result }); return result;
  }
  if (path.endsWith('/priorityBatch')) {
    const appName = typeof body.appName === 'string' ? body.appName.trim() : '';
    if (!settings.has(appName)) throw new Error('基线 APP 不存在');
    const parsed = validatePriorityUrls(body.pageUrls);
    let updatedCount = 0, alreadyPriorityCount = 0;
    const missingUrls: string[] = [];
    for (const url of parsed.urls) {
      const row = urls.get(key(appName, url));
      if (!row) { missingUrls.push(url); continue; }
      if (row.priority) alreadyPriorityCount++;
      else { row.priority = true; updatedCount++; }
    }
    return { appName, receivedCount: parsed.inputCount, duplicateCount: parsed.duplicateCount, matchedCount: updatedCount + alreadyPriorityCount, updatedCount, alreadyPriorityCount, missingUrls };
  }
  if (path.endsWith('/settings')) {
    if (!settings.has(body.appName)) throw new Error('APP 不存在');
    settings.set(body.appName, { appGroups: [...body.appGroups], specialNote: body.specialNote || '' });
  }
  if (path.endsWith('/priority')) {
    const row = urls.get(key(body.appName, body.pageUrl));
    if (!row) throw new Error('URL 不存在'); row.priority = body.priority;
  }
  return { status: 'success' };
}
