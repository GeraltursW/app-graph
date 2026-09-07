import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { readCaptureRows, validateCapturePath } from '../src/views/app-graph/data/capturePackage.js';

test('capture rows preserve blank parents and same-package predecessors', async () => {
  const book=new ExcelJS.Workbook(), sheet=book.addWorksheet('records');
  sheet.addRow(['APP名称','目标URL','页面截图','记录ID','父节点ID','前一步记录ID']);
  sheet.addRow(['QQ','url-b','b.png','B','','']);sheet.addRow(['QQ','url-c','c.png','C','','B']);
  const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await book.xlsx.writeBuffer());
  const rows=readCaptureRows(loaded);assert.equal(rows.length,2);assert.equal(rows[0].parentPageId,'');assert.equal(rows[1].previousRecordId,'B');
});
test('capture validation rejects traversal, duplicate ids and marks formula rows invalid', () => {
  for(const path of ['../secret','C:/a','/a','a\\b','a/../b']) assert.throws(()=>validateCapturePath(path));
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('records');sheet.addRow(['APP名称','目标URL','页面截图','记录ID']);
  sheet.addRow(['QQ',{formula:'1+1'},'b.png','B']);assert.ok(readCaptureRows(book)[0].error);
  sheet.addRow(['QQ','u','c.png','B']);assert.throws(()=>readCaptureRows(book));
});
