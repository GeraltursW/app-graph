import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBackendGraph } from '../src/views/app-graph/data/graph.js';

const page = (id, children = []) => ({ id, pageId: String(id), pageTitle: `Page ${id}`, children });

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
