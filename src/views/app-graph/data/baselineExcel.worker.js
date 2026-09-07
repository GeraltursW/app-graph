import ExcelJS from 'exceljs';
import { readBaselineWorkbook } from './projectBaseline.js';

self.onmessage = async ({ data }) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data, { ignoreNodes: ['drawing', 'conditionalFormatting', 'dataValidations'] });
    self.postMessage({ result: readBaselineWorkbook(workbook) });
  } catch (error) {
    self.postMessage({ error: error.message || '无法读取 Excel，请检查文件格式' });
  }
};
