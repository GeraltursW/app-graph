import { mockGovernance, mockCommitCapture } from './appGraph';
const jobs = new Map<string, any>(), hashes = new Map<string, string>(), commits = new Map<string, any>();
export async function uploadMockCapture(appName: string, file: File) {
  const buffer = await file.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))).map(b => b.toString(16).padStart(2, '0')).join('');
  const key = appName + hash, old = hashes.get(key);if (old) return { jobId: old, duplicate: true };
  const rows: any[] = await new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../views/app-graph/data/capturePackage.worker.js', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('解析超时，请拆分采集包')); }, 45000);
    worker.onmessage = ({ data }) => { clearTimeout(timer);worker.terminate();data.error ? reject(new Error(data.error)) : resolve(data.rows); };
    worker.onerror = () => { clearTimeout(timer);worker.terminate();reject(new Error('采集包解析失败')); };
    worker.postMessage({ buffer, appName }, [buffer]);
  });
  const work = await mockGovernance('/orphans/workbench', { appName });
  const jobId = crypto.randomUUID();
  const job = { jobId, appName, fileName: file.name, status: 'READY', progress: 100, error: '', createdAt: new Date().toISOString(), records: rows.map(row => {
    const targetCandidates = work.nodes.filter(n => n.pageUrl === row.pageUrl);
    const parentCandidates = work.nodes.filter(n => n.pageId === row.parentPageId || (row.parentUrl && n.pageUrl === row.parentUrl));
    return { recordId: row.recordId, rowNo: row.rowNo, payload: row, error: row.error, committedPageId: '', analysis: { aiStatus: 'UNAVAILABLE', targetCandidates, parentCandidates, state: row.previousRecordId || parentCandidates.length === 1 ? 'REVIEW_READY' : parentCandidates.length ? 'CHOOSE_PARENT' : 'ENTRY_UNKNOWN' } };
  }) };
  jobs.set(jobId, job);hashes.set(key, jobId);return { jobId, duplicate: false };
}
export async function mockCaptureRequest(path: string, body: any = {}) {
  if (path === '') return { aiAvailable: false, jobs: [...jobs.values()].filter(j => j.appName === body.appName).reverse() };
  const [, id, operation] = path.split('/'); const job = jobs.get(id);if (!job) throw new Error('任务不存在');
  const work = await mockGovernance('/orphans/workbench', { appName: job.appName });
  if (operation === 'commit') {
    const serialized = JSON.stringify({ id, body }), old = commits.get(body.requestId);
    if (old) { if (old.serialized !== serialized) throw new Error('请求标识内容不一致');return old.result; }
    if (body.graphVersion !== work.graphVersion) throw new Error('图谱已变化，请刷新后重新确认');
    const seen = new Set();
    const rows = body.items.map((item: any) => {
      const record = job.records.find(r => r.recordId === item.recordId);
      if (!record || record.error || record.committedPageId || seen.has(item.recordId)) throw new Error('记录无效、重复或已入库');
      seen.add(item.recordId);return { ...item, payload: record.payload };
    });
    const previous = Object.fromEntries(job.records.filter(r => r.committedPageId).map(r => [r.recordId, r.committedPageId]));
    const result = mockCommitCapture(job.appName, rows, previous, id);
    result.pages.forEach(p => job.records.find(r => r.recordId === p.recordId).committedPageId = p.pageId);
    commits.set(body.requestId, { serialized, result });return result;
  }
  return { ...structuredClone(job), nodes: work.nodes, graphVersion: work.graphVersion };
}
