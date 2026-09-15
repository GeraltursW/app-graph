import { defHttp } from '@/utils/http/axios';
import { USE_MOCK, requestOptions, toMockPayload } from '../shared/api.config';
import { mockCoverageRequest } from './coverageReport.mock';

export function queryDailyReports(): Promise<any> {
  if (USE_MOCK) return mockCoverageRequest('/reports/daily');
  return defHttp.get({ url: '/reports/daily' }, requestOptions);
}

export function requestGenerateDailyReport(body: { requestId: string; date: string; reportType: string }): Promise<any> {
  if (USE_MOCK) return mockCoverageRequest('/reports/generate', toMockPayload(body));
  return defHttp.post({ url: '/reports/generate', data: body }, requestOptions);
}
