import { defHttp } from '@/utils/http/axios';
import { governanceMock } from './governance.api';
const options = { apiUrl: import.meta.env.VITE_APP_GRAPH_API_URL || '/appGraph' };
export async function captureRequest(path = '', body: any = {}, method: 'get' | 'post' = 'get'): Promise<any> {
  if (governanceMock) return (await import('@/mock/captureImports')).mockCaptureRequest(path, JSON.parse(JSON.stringify(body)));
  return method === 'get' ? defHttp.get({ url: '/captureImports' + path, params: body }, options) : defHttp.post({ url: '/captureImports' + path, data: body }, options);
}
export async function uploadCapture(appName: string, file: File, useAi: boolean): Promise<any> {
  if (governanceMock) return (await import('@/mock/captureImports')).uploadMockCapture(appName, file);
  const data = new FormData();data.append('appName', appName);data.append('file', file);data.append('useAi', String(useAi));
  return defHttp.post({ url: '/captureImports', data }, options);
}
