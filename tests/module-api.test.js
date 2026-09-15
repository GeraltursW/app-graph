import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));

async function withApi(mock, task) {
  const server = await createServer({
    root,
    configFile: false,
    mode: 'test',
    envFile: false,
    logLevel: 'error',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    define: {
      'import.meta.env.VITE_USE_MOCK': JSON.stringify(String(mock)),
      'import.meta.env.VITE_APP_GRAPH_API_URL': JSON.stringify('/appGraph'),
    },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const load = name => server.ssrLoadModule('/src/views/app-graph/' + name);
    const { defHttp } = await server.ssrLoadModule('/src/utils/http/axios/index.ts');
    await task(load, defHttp);
  } finally {
    await server.close();
  }
}

test('module APIs preserve endpoint prefixes, methods, payloads and multipart data', async () => {
  await withApi(false, async (load, http) => {
    const calls = [];
    const response = { status: 'success', apps: [], node: {}, catalogs: [], catalog: {}, roots: [], runs: [], pageBindings: [], actionBindings: [], functions: [], reports: [], report: {}, catalogId: 'c', runId: 'r' };
    http.get = async (config, options) => { calls.push({ method: 'get', ...config, options }); return response; };
    http.post = async (config, options) => { calls.push({ method: 'post', ...config, options }); return response; };
    const baseline = await load('baseline/baseline.api.ts');
    const payload = { appName: 'QQ', pageUrls: ['mqq://test'] };
    await baseline.queryBaselineOverview();
    await baseline.queryBaselineUrls({ appName: 'QQ', keyword: '', page: 1, pageSize: 30 });
    await baseline.requestAppendBaseline(payload);
    await baseline.requestSaveBaselineSettings(payload);
    await baseline.requestSetBaselinePriority(payload);
    await baseline.requestSetBaselinePriorityBatch(payload);
    assert.deepEqual(calls.map(c => [c.method, c.url]), [
      ['get', '/baseline/overview'], ['get', '/baseline/urls'], ['post', '/baseline/append'],
      ['post', '/baseline/settings'], ['post', '/baseline/priority'], ['post', '/baseline/priorityBatch'],
    ]);
    assert.deepEqual(calls.at(-1).data, payload);

    const capture = await load('capture-import/capture.api.ts');
    const zip = new File(['zip'], 'capture.zip', { type: 'application/zip' });
    await capture.queryCaptureJobs('QQ');
    await capture.queryCaptureJob('job/a');
    await capture.requestCommitCapture('job/a', payload);
    await capture.requestRetryCapture('job/a');
    await capture.uploadCapture('QQ', zip, true);
    assert.deepEqual(calls.slice(-5).map(c => [c.method, c.url]), [
      ['get', '/captureImports'], ['get', '/captureImports/job%2Fa'],
      ['post', '/captureImports/job%2Fa/commit'], ['post', '/captureImports/job%2Fa/retry'], ['post', '/captureImports'],
    ]);
    assert.equal(calls.at(-1).data.get('appName'), 'QQ');
    assert.equal(calls.at(-1).data.get('useAi'), 'true');
    assert.equal(calls.at(-1).data.get('file').name, 'capture.zip');

    const orphan = await load('orphans/orphan.api.ts');
    await orphan.queryOrphanWorkbench('QQ');
    await orphan.requestBatchMerge(payload);
    await orphan.requestRollbackBatch(payload);
    await orphan.requestSaveOrphanEntry({ entryKind: 'PENDING' });
    await orphan.requestSaveOrphanEntry({ entryKind: 'DEEPLINK' });
    assert.deepEqual(calls.slice(-5).map(c => c.url), [
      '/orphans/workbench', '/orphans/batchMerge', '/orphans/rollbackBatch',
      '/orphans/createProvisionalEntry', '/orphans/registerEntry',
    ]);
    await orphan.requestCreateOrphanNode('QQ', 'mqq://test');
    assert.deepEqual(calls.at(-1).data, { appName: 'QQ', pageUrl: 'mqq://test' });

    const graph = await load('graph/graph.api.ts');
    await graph.queryAppList();
    await graph.queryAppGraph('QQ/a');
    assert.equal(calls.at(-1).url, '/queryAppGraph/QQ%2Fa');
    await graph.requestMoveNode({ pageId: 'p' }, { pageId: 'root' });
    assert.deepEqual(calls.at(-1).data, { pageId: 'p', newParentId: 'root' });
    await graph.requestDeleteNode({ pageId: 'p' });
    assert.deepEqual(calls.at(-1).data, { id: 'p' });
    const action = { popupAction: [], stateAction: [{ label: 'like' }], externalAction: [], pageNaviAction: [] };
    await graph.requestSavePageReview({ pageId: 'p' }, { pageTitle: 'title', embeddingText: 'classification', keepImages: ['old.png'], action, newImages: [new File(['image'], 'new.png')] });
    const review = calls.at(-1);
    assert.equal(review.url, '/updateNode');
    assert.deepEqual(JSON.parse(review.data.get('action')), action);
    assert.deepEqual(JSON.parse(review.data.get('keepImages')), ['old.png']);
    assert.equal(review.data.get('embeddingText'), 'classification');
    assert.equal(review.data.getAll('newImages').length, 1);

    const functions = await load('function-tree/functionTree.api.ts');
    await functions.queryFunctionCatalogs('QQ');
    await functions.queryFunctionCatalog('c/a');
    await functions.queryFunctionMatchRuns('c');
    await functions.queryFunctionBindings('r');
    await functions.queryFunctionCoverage('r');
    await functions.requestRunFunctionMatch('c');
    assert.equal(calls.at(-1).data.autoConfirmScore, 0.85);
    assert.equal(calls.at(-1).data.actionAutoConfirmScore, 0.90);
    await functions.requestImportFunctionTree(new File(['{}'], 'meta.json'), new File(['{}'], 'tree.json'));
    assert.equal(calls.at(-1).url, '/api/functionTree/import?source=vendor');
    await functions.requestReviewFunctionBinding('b', 'action', 'humanConfirmed');
    await functions.requestReviewFunctionBindings(['b'], 'page', 'rejected');
    assert.equal(calls.at(-1).url, '/api/functionBindings/reviewBatch');
    assert.equal(calls.at(-1).data.reviewStatus, 'rejected');

    const coverage = await load('coverage-report/coverageReport.api.ts');
    await coverage.queryDailyReports();
    await coverage.requestGenerateDailyReport({ requestId: '1', date: '2026-09-01', reportType: 'MORNING' });
    const reports = await load('test-report/testReport.api.ts');
    await reports.queryTestReports('QQ');
    await reports.queryTestReport('run/a');
    assert.deepEqual(calls.slice(-4).map(c => c.url), ['/reports/daily', '/reports/generate', '/api/testReports', '/api/testReports/run%2Fa']);
    assert.ok(calls.every(c => c.options.apiUrl === '/appGraph'));
    assert.ok(calls.every(c => !c.url.startsWith('/appGraph')));
  });
});

test('image API preserves inline images and encodes S3 filenames', async () => {
  await withApi(false, async load => {
    const { buildImageApiUrl, buildGraphThumbnailApiUrl } = await load('shared/image.api.ts');
    assert.equal(buildImageApiUrl(''), '');
    assert.equal(buildImageApiUrl('blob:preview'), 'blob:preview');
    assert.equal(buildImageApiUrl('data:image/png;base64,AA'), 'data:image/png;base64,AA');
    assert.equal(buildImageApiUrl('folder/a b.png'), '/appGraph/s3file/image?fileName=folder%2Fa%20b.png');
    assert.equal(buildImageApiUrl('/appGraph/s3file/image?fileName=a'), '/appGraph/s3file/image?fileName=a');
    assert.ok(buildGraphThumbnailApiUrl('a.png', 999).endsWith('&width=480'));
  });
});

test('relocated mock modules share graph and baseline state without backend requests', async () => {
  await withApi(true, async (load, http) => {
    http.get = http.post = async () => { throw new Error('Unexpected backend request in mock mode'); };
    const graph = await load('graph/graph.api.ts');
    const orphan = await load('orphans/orphan.api.ts');
    const baseline = await load('baseline/baseline.api.ts');
    const coverage = await load('coverage-report/coverageReport.api.ts');
    const capture = await load('capture-import/capture.api.ts');
    const created = await orphan.requestCreateOrphanNode('QQ', 'mqq://module-test');
    const workbench = await orphan.queryOrphanWorkbench('QQ');
    assert.ok(workbench.nodes.some(n => n.pageId === created.node.pageId));
    assert.match(JSON.stringify(await graph.queryAppGraph('QQ')), /mqq:\/\/module-test/);
    await baseline.requestAppendBaseline({ requestId: 'module-baseline', source: 'test', rows: [{ appName: 'ModuleTest', pageUrl: 'test://one' }] });
    await baseline.requestSetBaselinePriorityBatch({ appName: 'ModuleTest', pageUrls: ['test://one'] });
    const report = await coverage.requestGenerateDailyReport({ requestId: 'module-report', date: '2026-09-01', reportType: 'MORNING' });
    const app = report.apps.find(a => a.appName === 'ModuleTest');
    assert.equal(app.totalUrlCount, 1);
    assert.equal(app.priorityUrlCount, 1);
    assert.equal(app.baselineCoveredCount, 0);
    assert.equal((await coverage.queryDailyReports()).length, 1);
    assert.ok(await capture.queryCaptureJobs('QQ'));
  });
});
