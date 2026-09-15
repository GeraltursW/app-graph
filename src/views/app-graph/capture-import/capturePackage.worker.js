import { parseCaptureZip } from './capturePackage';
self.onmessage = async ({ data }) => {
  try { self.postMessage({ rows: await parseCaptureZip(data.buffer, data.appName) }); }
  catch (error) { self.postMessage({ error: error.message || '采集包解析失败' }); }
};
