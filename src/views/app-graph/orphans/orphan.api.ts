import { defHttp } from '@/utils/http/axios';
import { USE_MOCK, rawRequestOptions, requestOptions, toMockPayload } from '../shared/api.config';
import { mockCreateOrphan, mockExplore, mockMoveNode, mockGovernance } from '../graph/graph.mock';
enum Api { CreateOrphanNode = '/createOrphanNode' }

export async function requestCreateOrphanNode(appName: string, pageUrl: string) {
  if (USE_MOCK) return mockCreateOrphan(appName, pageUrl);
  const payload = await defHttp.post<any>(
    {
      url: Api.CreateOrphanNode,
      data: { appName, pageUrl },
    },
    rawRequestOptions,
  );
  if (payload?.status !== 'success' || !payload?.node) {
    throw new Error('Create orphan node response is invalid');
  }
  return payload;
}

export const requestAiExploreFloatingPage = (page: any) =>
  USE_MOCK ? mockExplore(page) : postToFirstAvailable(
    [
      '/ai/exploreFloatingPage',
      '/api/ai/exploreFloatingPage',
    ],
    {
      id: page.backendId,
      pageTitle: page.pageTitle,
      pageText: page.pageText,
      imageUrl: page.imageUrl,
      pageUrl: page.pageUrl,
      pageInfo: page.pageInfo,
    },
    'AI explore',
  );

export const requestMergeFloatingPage = (page: any, exploration: any) =>
  USE_MOCK ? Promise.resolve(exploration) : postToFirstAvailable(
    [
      '/ai/mergeFloatingPage',
      '/api/ai/mergeFloatingPage',
    ],
    {
      id: page.backendId,
      nodeId: page.nodeId,
      pageUrl: page.pageUrl,
      exploration,
    },
    'Merge floating page',
  );

export const requestManualMergeFloatingPage = (
  page: any,
  targetParent: any,
  options: Record<string, string> = {},
) =>
  USE_MOCK ? mockMoveNode(page.pageId, targetParent.pageId).then(() => ({
    canMerge: true,
    targetParentNodeId: targetParent.nodeId,
    targetParentId: targetParent.backendId,
    widgetDescription: options.widgetDescription || '人工拖拽归类',
  })) : postToFirstAvailable(
    [
      '/ai/manualMergeFloatingPage',
      '/api/ai/manualMergeFloatingPage',
    ],
    {
      id: page.backendId,
      nodeId: page.nodeId,
      pageTitle: page.pageTitle,
      pageText: page.pageText,
      pageUrl: page.pageUrl,
      imageUrl: page.imageUrl,
      targetParentId: targetParent?.backendId ?? null,
      targetParentNodeId: targetParent?.nodeId || '',
      widgetDescription: options.widgetDescription || '人工拖拽归类',
      operatorNote: options.operatorNote || '人工拖拽游离页面到主图谱',
    },
    'Manual merge floating page',
  );

async function postToFirstAvailable(paths: string[], payload: any, label: string) {
  const errors: string[] = [];
  for (const path of paths) {
    try {
      return await defHttp.post<any>({ url: path, data: payload }, rawRequestOptions);
    } catch (error: any) {
      const status = error?.response?.status;
      errors.push(`${path}: ${status || 'request failed'}`);
      if (status !== 404) throw error;
    }
  }
  throw new Error(`${label} endpoint not found. Tried ${errors.join(', ')}`);
}

async function orphanRequest(path: string, body: any = {}, method: 'get' | 'post' = 'get'): Promise<any> {
  if (USE_MOCK) return mockGovernance(path, toMockPayload(body));
  return method === 'get'
    ? defHttp.get({ url: path, params: body }, requestOptions)
    : defHttp.post({ url: path, data: body }, requestOptions);
}

export const queryOrphanWorkbench = (appName: string) => orphanRequest('/orphans/workbench', { appName });
export const requestBatchMerge = (body: any) => orphanRequest('/orphans/batchMerge', body, 'post');
export const requestRollbackBatch = (body: any) => orphanRequest('/orphans/rollbackBatch', body, 'post');
export const requestSaveOrphanEntry = (body: any) => orphanRequest(
  '/orphans/' + (body.entryKind === 'PENDING' ? 'createProvisionalEntry' : 'registerEntry'), body, 'post',
);
