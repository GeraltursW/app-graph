import { defHttp } from '@/utils/http/axios';
import { rawRequestOptions } from '../shared/api.config';
enum Api {
  FunctionCatalogs = '/api/functionTree/catalogs',
  FunctionMatchRuns = '/api/functionMatch/runs',
  FunctionMatchRun = '/api/functionMatch/run',
  FunctionBindings = '/api/functionBindings',
}

export async function queryFunctionCatalogs(appName: string) {
  const payload = await defHttp.get<any>(
    {
      url: Api.FunctionCatalogs,
      params: { appName },
    },
    rawRequestOptions,
  );
  if (payload?.status !== 'success' || !Array.isArray(payload?.catalogs)) {
    throw new Error('Function Tree catalog response is invalid');
  }
  return payload.catalogs;
}

export async function queryFunctionCatalog(catalogId: string) {
  const payload = await defHttp.get<any>(
    { url: `${Api.FunctionCatalogs}/${encodeURIComponent(catalogId)}` },
    rawRequestOptions,
  );
  if (payload?.status !== 'success' || !payload?.catalog || !Array.isArray(payload?.roots)) {
    throw new Error('Function Tree response is invalid');
  }
  return payload;
}

export async function queryFunctionMatchRuns(catalogId: string) {
  const payload = await defHttp.get<any>(
    {
      url: Api.FunctionMatchRuns,
      params: { catalogId },
    },
    rawRequestOptions,
  );
  if (payload?.status !== 'success' || !Array.isArray(payload?.runs)) {
    throw new Error('Function match runs response is invalid');
  }
  return payload.runs;
}

export async function queryFunctionBindings(runId: string) {
  const payload = await defHttp.get<any>(
    { url: `${Api.FunctionMatchRuns}/${encodeURIComponent(runId)}/bindings` },
    rawRequestOptions,
  );
  if (
    payload?.status !== 'success'
    || !Array.isArray(payload?.pageBindings)
    || !Array.isArray(payload?.actionBindings)
  ) {
    throw new Error('Function match bindings response is invalid');
  }
  return payload;
}

export async function queryFunctionCoverage(runId: string) {
  const payload = await defHttp.get<any>(
    { url: `${Api.FunctionMatchRuns}/${encodeURIComponent(runId)}/coverage` },
    rawRequestOptions,
  );
  if (payload?.status !== 'success' || !Array.isArray(payload?.functions)) {
    throw new Error('Function coverage response is invalid');
  }
  return payload;
}

export async function requestImportFunctionTree(
  metadataFile: File,
  treeFile: File,
  source = 'vendor',
  vendorVersion = '',
) {
  const formData = new FormData();
  formData.append('metadataFile', metadataFile);
  formData.append('treeFile', treeFile);
  const query = new URLSearchParams({ source });
  if (vendorVersion.trim()) query.set('vendorVersion', vendorVersion.trim());
  const payload = await defHttp.post<any>(
    {
      url: `/api/functionTree/import?${query.toString()}`,
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    },
    rawRequestOptions,
  );
  if (payload?.status !== 'success' || !payload?.catalogId) {
    throw new Error('Function Tree import response is invalid');
  }
  return payload;
}

export async function requestRunFunctionMatch(catalogId: string) {
  const payload = await defHttp.post<any>(
    {
      url: Api.FunctionMatchRun,
      data: {
        catalogId,
        topK: 5,
        minScore: 0.45,
        autoConfirmScore: 0.85,
        reviewScore: 0.55,
        actionAutoConfirmScore: 0.90,
        actionReviewScore: 0.65,
        minScoreMargin: 0.12,
        enableAiReview: false,
        enableInheritance: true,
      },
    },
    rawRequestOptions,
  );
  if (payload?.status !== 'success' || !payload?.runId) {
    throw new Error('Function match run response is invalid');
  }
  return payload;
}

export async function requestReviewFunctionBinding(
  bindingId: string,
  targetType: 'page' | 'action',
  reviewStatus: 'humanConfirmed' | 'rejected',
  operatorNote = '',
) {
  return defHttp.post<any>(
    {
      url: `${Api.FunctionBindings}/${encodeURIComponent(bindingId)}/review`,
      data: { targetType, reviewStatus, operatorNote, reviewedBy: 'demo-user' },
    },
    rawRequestOptions,
  );
}

export async function requestReviewFunctionBindings(
  bindingIds: string[],
  targetType: 'page' | 'action',
  reviewStatus: 'humanConfirmed' | 'rejected',
  operatorNote = '',
) {
  if (!bindingIds.length) return { status: 'success', updated: 0 };
  return defHttp.post<any>(
    {
      url: `${Api.FunctionBindings}/reviewBatch`,
      data: { targetType, reviewStatus, bindingIds, operatorNote, reviewedBy: 'demo-user' },
    },
    rawRequestOptions,
  );
}
