export const BASELINE_ROW_LIMIT = 50000;

export function validatePriorityUrls(input) {
  if (!Array.isArray(input) || !input.length || input.length > 5000) throw new Error('每次提交 1 至 5000 条 URL');
  const urls = input.map((value, index) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 16000 || /[\x00-\x1f]/.test(value.trim())) {
      throw new Error(`第 ${index + 1} 条 URL 无效`);
    }
    return value.trim();
  });
  return { urls: [...new Set(urls)], inputCount: urls.length, duplicateCount: urls.length - new Set(urls).size };
}

export function validateBaselineRows(input) {
  if (!input.length || input.length > BASELINE_ROW_LIMIT) throw new Error('每次提交 1 至 50000 行');
  const rows = [], errors = [], seen = new Set();
  let duplicates = 0;
  input.forEach((raw, index) => {
    const appName = typeof raw.appName === 'string' ? raw.appName.trim() : '';
    const pageUrl = typeof raw.pageUrl === 'string' ? raw.pageUrl.trim() : '';
    const rowNo = raw.rowNo || index + 1;
    if (!appName || !pageUrl || appName.length > 255 || pageUrl.length > 16000 || /[\x00-\x1f]/.test(appName + pageUrl)) {
      errors.push({ rowNo, sheet: raw.sheet || '', message: 'APP名称或URL为空、过长或包含控制字符' }); return;
    }
    const key = JSON.stringify([appName, pageUrl]);
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key); rows.push({ appName, pageUrl });
  });
  return { rows, errors, duplicates, inputCount: input.length };
}

function cellText(cell, url = false) {
  const value = cell.value;
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') throw new Error('APP名称和URL必须是文本');
  if ('formula' in value || 'sharedFormula' in value) throw new Error('不接受公式单元格，请粘贴为文本值');
  if ('hyperlink' in value) return url ? value.hyperlink : value.text;
  if ('richText' in value) return value.richText.map(part => part.text).join('');
  throw new Error('无法识别的单元格类型');
}

export function readBaselineWorkbook(workbook) {
  const input = [];
  for (const sheet of workbook.worksheets) {
    if (!sheet.actualRowCount) continue;
    let appCol = 0, urlCol = 0;
    sheet.getRow(1).eachCell((cell, col) => {
      const name = cellText(cell).replace(/\s+/g, '').toLowerCase();
      if (['app名称', '应用名称', 'appname'].includes(name)) {
        if (appCol) throw new Error(`${sheet.name}：APP名称列重复`);
        appCol = col;
      }
      if (['url', 'pageurl'].includes(name)) {
        if (urlCol) throw new Error(`${sheet.name}：URL列重复`);
        urlCol = col;
      }
    });
    if (!appCol || !urlCol) throw new Error(`${sheet.name}：首行需要 APP名称、URL 两列`);
    sheet.eachRow((row, rowNo) => {
      if (rowNo === 1) return;
      try {
        const appName = cellText(row.getCell(appCol));
        const pageUrl = cellText(row.getCell(urlCol), true);
        if (!appName.trim() && !pageUrl.trim()) return;
        input.push({ appName, pageUrl, rowNo, sheet: sheet.name });
        if (input.length > BASELINE_ROW_LIMIT) throw new Error('最多支持 50000 行');
      } catch (error) { throw new Error(`${sheet.name} 第 ${rowNo} 行：${error.message}`); }
    });
  }
  return validateBaselineRows(input);
}
