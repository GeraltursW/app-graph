import { defHttp } from '@/utils/http/axios';
import { USE_MOCK, requestOptions, toMockPayload } from '../shared/api.config';

async function captureRequest(path = '', body: any = {}, method: 'get' | 'post' = 'get'): Promise<any> {
  if (USE_MOCK) return (await import('./capture.mock')).mockCaptureRequest(path, toMockPayload(body));
  return method === 'get'
    ? defHttp.get({ url: '/captureImports' + path, params: body }, requestOptions)
    : defHttp.post({ url: '/captureImports' + path, data: body }, requestOptions);
}

export const queryCaptureJobs = (appName: string) => captureRequest('', { appName });
export const queryCaptureJob = (jobId: string) => captureRequest('/' + encodeURIComponent(jobId));
export const requestCommitCapture = (jobId: string, body: any) =>
  captureRequest('/' + encodeURIComponent(jobId) + '/commit', body, 'post');
export const requestRetryCapture = (jobId: string) =>
  captureRequest('/' + encodeURIComponent(jobId) + '/retry', {}, 'post');

export async function uploadCapture(appName: string, file: File, useAi: boolean): Promise<any> {
  if (USE_MOCK) return (await import('./capture.mock')).uploadMockCapture(appName, file);
  const data = new FormData();
  data.append('appName', appName);
  data.append('file', file);
  data.append('useAi', String(useAi));
  return defHttp.post({ url: '/captureImports', data }, requestOptions);
}
