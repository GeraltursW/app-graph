import { defHttp } from '@/utils/http/axios';
import { rawRequestOptions } from '../shared/api.config';
enum Api { TestReports = '/api/testReports' }

export async function queryTestReports(appName: string) {
  const payload = await defHttp.get<any>(
    { url: Api.TestReports, params: { appName } },
    rawRequestOptions,
  );
  if (payload?.status !== 'success' || !Array.isArray(payload?.reports)) {
    throw new Error('Test report list response is invalid');
  }
  return payload.reports;
}

export async function queryTestReport(runId: string) {
  const payload = await defHttp.get<any>(
    { url: `${Api.TestReports}/${encodeURIComponent(runId)}` },
    rawRequestOptions,
  );
  if (payload?.status !== 'success' || !payload?.report) {
    throw new Error('Test report response is invalid');
  }
  return payload.report;
}
