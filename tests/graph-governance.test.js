import test from 'node:test';
import assert from 'node:assert/strict';
import { getMainGraphView, normalizeBackendGraph } from '../src/views/app-graph/data/graph.js';

const page = (id, children = []) => ({ id, pageId: String(id), pageTitle: `Page ${id}`, children });

test('canvas projection excludes orphan subtrees and their edges without changing the source', () => {
  const graph = normalizeBackendGraph({ roots: [page(1, [page(2)])], orphanPages: [page(3, [page(4)])] });
  const view = getMainGraphView(graph);
  assert.deepEqual(view.pages.map(p => p.pageId), ['1', '2']);
  assert.equal(view.edges.length, 1);
  assert.equal(view.floatingPages.length, 0);
  assert.equal(graph.pages.length, 4);
  assert.equal(graph.floatingPages.length, 2);
  const orphan = graph.pages.find(p => p.pageId === '3');
  graph.edges.push({ id: 'cross', from: view.pages[0].nodeId, to: orphan.nodeId });
  assert.equal(getMainGraphView(graph).edges.length, 1);
});

test('merged pages return to the canvas and orphan-only apps have an empty canvas', () => {
  const before = normalizeBackendGraph({ roots: [], orphanPages: [page(3, [page(4)])] });
  assert.equal(getMainGraphView(before).pages.length, 0);
  const after = normalizeBackendGraph({ roots: [page(1, [page(3, [page(4)])])], orphanPages: [] });
  assert.equal(getMainGraphView(after).pages.length, 3);
  assert.equal(getMainGraphView(after).edges.length, 2);
});

test('shared DAG pages render once while both entry edges remain', () => {
  const graph = normalizeBackendGraph({ roots: [page(1, [page(2, [page(4)]), page(3, [page(4)])])] });
  assert.equal(graph.pages.length, 4);
  assert.equal(graph.edges.length, 4);
  assert.equal(graph.incomingMap.get(graph.pages.find(p => p.pageId === '4').nodeId).length, 2);
});

test('explicit edge records preserve distinct widgets for a shared target', () => {
  const graph = normalizeBackendGraph({ roots: [page(1, [page(2), page(3)])], edges: [
    { id: 'first', fromPageId: '1', toPageId: '2', widgetDescription: 'Search' },
    { id: 'second', fromPageId: '3', toPageId: '2', widgetDescription: 'Recent' },
  ] });
  assert.deepEqual(graph.edges.map(e => e.label), ['Search', 'Recent']);
  assert.deepEqual(graph.edges.map(e => e.id), ['first', 'second']);
});

test('raw production embedding_text is not replaced with pageText', () => {
  const graph = normalizeBackendGraph({ roots: [{ ...page(1), pageText: 'summary', embedding_text: 'classification' }, page(2)] });
  assert.equal(graph.pages[0].embeddingText, 'classification');
  assert.equal(graph.pages[1].embeddingText, '');
});
