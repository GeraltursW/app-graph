import { defHttp } from '@/utils/http/axios';
import { USE_MOCK, requestOptions, toMockPayload } from '../shared/api.config';
import { mockProjectBaseline } from './baseline.mock';

async function baselineRequest(path: string, body: any = {}, method: 'get' | 'post' = 'get'): Promise<any> {
  if (USE_MOCK) return mockProjectBaseline(path, toMockPayload(body));
  return method === 'get'
    ? defHttp.get({ url: path, params: body }, requestOptions)
    : defHttp.post({ url: path, data: body }, requestOptions);
}

export const queryBaselineOverview = () => baselineRequest('/baseline/overview');
export const queryBaselineUrls = (params: { appName: string; keyword: string; page: number; pageSize: number }) =>
  baselineRequest('/baseline/urls', params);
export const requestAppendBaseline = (body: any) => baselineRequest('/baseline/append', body, 'post');
export const requestSaveBaselineSettings = (body: any) => baselineRequest('/baseline/settings', body, 'post');
export const requestSetBaselinePriority = (body: { appName: string; pageUrl: string; priority: boolean }) =>
  baselineRequest('/baseline/priority', body, 'post');
export const requestSetBaselinePriorityBatch = (body: { appName: string; pageUrls: string[] }) =>
  baselineRequest('/baseline/priorityBatch', body, 'post');
