import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse } from 'vue/compiler-sfc';

const root = fileURLToPath(new URL('../', import.meta.url));
const viewRoot = path.join(root, 'src/views/app-graph');
function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  });
}

function dependencies(file) {
  let text = readFileSync(file, 'utf8');
  if (file.endsWith('.vue')) {
    const { descriptor } = parse(text, { filename: file });
    text = [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n');
  }
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const specifiers = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) {
      specifiers.push(node.arguments[0].text);
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' && node.arguments?.[0] && ts.isStringLiteral(node.arguments[0])) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return specifiers.filter(s => s.startsWith('.') || s.startsWith('@/')).map(specifier => {
    const base = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
    const resolved = [base, base + '.ts', base + '.js', base + '.vue', path.join(base, 'index.ts')].find(p => existsSync(p) && statSync(p).isFile());
    assert.ok(resolved, `Missing dependency: ${path.relative(root, file)} -> ${specifier}`);
    return resolved;
  });
}

test('module imports and Worker entries resolve without local dependency cycles', () => {
  const graph = new Map(filesIn(path.join(root, 'src')).filter(f => /\.(vue|ts|js)$/.test(f)).map(f => [f, dependencies(f)]));
  const done = new Set();
  function visit(file, stack = []) {
    assert.ok(!stack.includes(file), `Dependency cycle: ${[...stack, file].map(f => path.relative(root, f)).join(' -> ')}`);
    if (done.has(file)) return;
    for (const target of graph.get(file) || []) visit(target, [...stack, file]);
    done.add(file);
  }
  for (const file of graph.keys()) visit(file);
  for (const [file, targets] of graph) {
    if (file.startsWith(path.join(viewRoot, 'shared') + path.sep)) {
      assert.ok(targets.every(target => !target.startsWith(viewRoot + path.sep) || target.startsWith(path.join(viewRoot, 'shared') + path.sep)), 'Shared utilities must not depend on business modules');
    }
  }
});

test('business APIs are colocated and obsolete aggregate API files are removed', () => {
  for (const file of ['info.api.ts', 'governance.api.ts', 'capture.api.ts', 'info.data.ts']) {
    assert.equal(existsSync(path.join(viewRoot, file)), false, file);
  }
  for (const file of ['baseline/baseline.api.ts', 'capture-import/capture.api.ts', 'function-tree/functionTree.api.ts', 'graph/graph.api.ts', 'orphans/orphan.api.ts', 'coverage-report/coverageReport.api.ts', 'test-report/testReport.api.ts']) {
    assert.ok(existsSync(path.join(viewRoot, file)), file);
  }
  for (const file of filesIn(viewRoot).filter(f => f.endsWith('.vue'))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\bdefHttp\./, `${file} must call a module API`);
  }
});
