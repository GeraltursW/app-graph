import { defHttp } from '@/utils/http/axios';
import { mockGovernance } from '@/mock/appGraph';
import { mockCoverageRequest } from '@/mock/coverageReports';
export const governanceMock = import.meta.env.VITE_USE_MOCK !== 'false';
const options = { apiUrl: import.meta.env.VITE_APP_GRAPH_API_URL || '/appGraph' };
export async function governanceRequest(path: string, body: any = {}, method: 'get' | 'post' = 'get'): Promise<any> {
  if (governanceMock) {
    // Match the HTTP JSON boundary and avoid leaking Vue proxies into mock storage.
    const payload = JSON.parse(JSON.stringify(body));
    return path.startsWith('/orphans') ? mockGovernance(path, payload) : mockCoverageRequest(path, payload);
  }
  return method === 'get' ? defHttp.get({ url: path, params: body }, options) : defHttp.post({ url: path, data: body }, options);
}
export function requestError(error: any) { return error?.response?.data?.message || error.message || '请求失败'; }
