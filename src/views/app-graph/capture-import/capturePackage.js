import JSZip from 'jszip';
import ExcelJS from 'exceljs';

export const captureHeaders = {
  'APP名称': 'appName', '目标URL': 'pageUrl', '页面截图': 'pageImage', '控件截图': 'widgetImage',
  '控件说明': 'widgetDescription', '父节点ID': 'parentPageId', '父页面URL': 'parentUrl',
  '父页面截图': 'parentImage', '操作类型': 'actionType', '采集时间': 'capturedAt',
  '备注': 'notes', '记录ID': 'recordId', '前一步记录ID': 'previousRecordId', '页面标题': 'pageTitle',
};
export function validateCapturePath(path) {
  if (!path || /[\\:\x00]/.test(path) || path.startsWith('/') || path.split('/').some(p => p === '.' || p === '..')) throw new Error('非法包内路径');
  return path;
}
export function readCaptureRows(book) {
  if (book.worksheets.length !== 1) throw new Error('采集表需且仅需一个工作表');
  const sheet = book.worksheets[0], cols = new Map(), ids = new Set(), rows = [];
  sheet.getRow(1).eachCell((cell, col) => {
    if (typeof cell.value !== 'string') throw new Error('表头必须为文本');
    const field = captureHeaders[cell.value.trim()] || cell.value.trim();
    if (Object.values(captureHeaders).includes(field)) {
      if ([...cols.values()].includes(field)) throw new Error('重复列'); cols.set(col, field);
    }
  });
  if (!['appName', 'pageUrl', 'pageImage'].every(f => [...cols.values()].includes(f))) throw new Error('需要 APP名称、目标URL、页面截图 三列');
  if (sheet.rowCount > 501) throw new Error('每包最多 500 行');
  sheet.eachRow((row, rowNo) => {
    if (rowNo === 1) return;
    const item = {}; let error = '';
    for (const [col, field] of cols) {
      const value = row.getCell(col).value;
      if (value != null && typeof value !== 'string') error = '单元格必须为文本，不接受公式、数字或日期类型';
      item[field] = typeof value === 'string' ? value.trim() : '';
      if (item[field].length > 16000 || /[\x00-\x09\x0b\x0c\x0e-\x1f]/.test(item[field])) error = '字段过长或含非法字符';
    }
    if (!Object.values(item).some(Boolean) && !error) return;
    const id = item.recordId || `row-${rowNo}`;
    if (id.length > 128 || ids.has(id)) throw new Error(`记录ID重复或过长：${id}`);
    ids.add(id); rows.push({ ...item, recordId: id, rowNo, error });
  });
  if (!rows.length) throw new Error('采集表为空');return rows;
}
export async function parseCaptureZip(buffer, appName) {
  if (buffer.byteLength > 20 * 1024 * 1024) throw new Error('ZIP 最大 20 MB');
  const zip = await JSZip.loadAsync(buffer), entries = Object.values(zip.files);
  if (entries.length > 1600) throw new Error('ZIP 文件项过多');
  const files = new Map(); let total = 0;
  for (const entry of entries) {
    validateCapturePath(entry.unsafeOriginalName || entry.name);
    if (entry.dir) continue;
    if (entry.name !== 'records.xlsx' && !/\.(png|jpe?g)$/i.test(entry.name)) throw new Error(`不支持的文件：${entry.name}`);
    const bytes = await entry.async('uint8array');total += bytes.byteLength;
    if (bytes.byteLength > 10 * 1024 * 1024 || total > 200 * 1024 * 1024) throw new Error('解压大小超限');
    files.set(entry.name, bytes);
  }
  if (!files.has('records.xlsx')) throw new Error('ZIP 根目录缺少 records.xlsx');
  const book = new ExcelJS.Workbook();await book.xlsx.load(files.get('records.xlsx'));
  const rows = readCaptureRows(book), ids = new Set(rows.map(r => r.recordId));
  for (const row of rows) {
    try {
      if (row.error) throw new Error(row.error);
      if (row.appName !== appName) throw new Error('APP名称与当前应用不一致，请按 APP 拆包');
      if (!row.pageUrl || !row.pageImage) throw new Error('目标URL和页面截图必填');
      if (row.previousRecordId && (!ids.has(row.previousRecordId) || row.previousRecordId === row.recordId)) throw new Error('前一步记录ID不存在或引用自身');
      row.actionType = ({ '点击': 'tap', '滑动': 'swipe', '长按': 'longPress', '返回': 'back' })[row.actionType] || row.actionType || 'tap';
      if (!['tap', 'swipe', 'longPress', 'back'].includes(row.actionType)) throw new Error('不支持的操作类型');
      for (const field of ['pageImage', 'parentImage', 'widgetImage']) {
        const name = row[field]; if (!name) continue;
        const bytes = files.get(validateCapturePath(name));if (!bytes) throw new Error(`缺少图片：${name}`);
        const blob = new Blob([bytes], { type: /\.png$/i.test(name) ? 'image/png' : 'image/jpeg' });
        const bitmap = await createImageBitmap(blob);
        const pixels = bitmap.width * bitmap.height;bitmap.close();
        if (pixels > 30000000) throw new Error('图片尺寸超限');
        row[field + 'Source'] = name;
        row[field] = await new Promise((resolve, reject) => { const reader = new FileReader();reader.onload = () => resolve(reader.result);reader.onerror = reject;reader.readAsDataURL(blob); });
      }
    } catch (e) { row.error = e.message || '图片解析失败'; }
  }
  return rows;
}
