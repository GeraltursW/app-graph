import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { readBaselineWorkbook, validateBaselineRows, validatePriorityUrls } from '../src/views/app-graph/data/projectBaseline.js';

test('priority batch trims and deduplicates exact URLs without removing query strings', () => {
  assert.deepEqual(validatePriorityUrls([' a ', 'a', 'a?q=1']), { urls: ['a', 'a?q=1'], inputCount: 3, duplicateCount: 1 });
  for (const invalid of [[], [''], [null], ['a\nb'], Array(5001).fill('a')]) {
    assert.throws(() => validatePriorityUrls(invalid));
  }
});

test('APP + exact URL deduplication keeps different apps and query strings', () => {
  const result=validateBaselineRows([{appName:' QQ ',pageUrl:'mqq://a'}, {appName:'QQ',pageUrl:'mqq://a'}, {appName:'QQ',pageUrl:'mqq://a?q=1'}, {appName:'微信',pageUrl:'mqq://a'}]);
  assert.equal(result.rows.length,3);assert.equal(result.duplicates,1);
});
test('empty values and control characters are reported without silently filling APP', () => {
  const result=validateBaselineRows([{appName:'',pageUrl:'u'}, {appName:'QQ',pageUrl:'a\nb'}]);
  assert.equal(result.errors.length,2);
});
test('actual xlsx round trip reads Chinese headers and hyperlink URL', async () => {
  const input=new ExcelJS.Workbook(), sheet=input.addWorksheet('清单');
  sheet.addRow(['URL','APP名称']);
  sheet.addRow([{text:'打开页面',hyperlink:'mqq://message/1'},'QQ']);
  sheet.addRow(['mqq://message/1','QQ']);
  const buffer=await input.xlsx.writeBuffer(), loaded=new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer);
  const result=readBaselineWorkbook(loaded);
  assert.deepEqual(result.rows,[{appName:'QQ',pageUrl:'mqq://message/1'}]);assert.equal(result.duplicates,1);
});
test('formulas and missing headers are rejected', () => {
  const workbook=new ExcelJS.Workbook(), sheet=workbook.addWorksheet('Sheet1');
  sheet.addRow(['APP名称','URL']);sheet.addRow(['QQ',{formula:'"mqq://home"',result:'mqq://home'}]);
  assert.throws(()=>readBaselineWorkbook(workbook),/公式/);
  const missing=new ExcelJS.Workbook();missing.addWorksheet('Sheet1').addRow(['APP']);
  assert.throws(()=>readBaselineWorkbook(missing),/两列/);
});
