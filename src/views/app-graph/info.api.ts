import { defHttp } from '@/utils/http/axios';
import {
  mockAppList,
  mockCreateOrphan,
  mockDeleteNode,
  mockExplore,
  mockMoveNode,
  mockQueryGraph,
  mockUpdateNode,
} from '@/mock/appGraph';

const API_BASE_URL = import.meta.env.VITE_APP_GRAPH_API_URL || '/app-relation-api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const rawRequestOptions = {
  apiUrl: API_BASE_URL,
  errorMessageMode: 'none' as const,
  isTransformResponse: false,
  joinPrefix: false,
  withToken: false,
};

enum Api {
  AppList = '/appList',
  CreateOrphanNode = '/createOrphanNode',
  DeleteNode = '/deleteNode',
  MoveNode = '/moveNode',
  QueryAppGraph = '/queryAppGraph',
  UpdateNode = '/updateNode',
}

export function buildImageApiUrl(imageUrl: string) {
  if (!imageUrl) return '';
  if (/^(data:|blob:|https?:\/\/)/i.test(imageUrl)) return imageUrl;
  return `${API_BASE_URL}/image/${encodeURIComponent(imageUrl)}`;
}

export const queryAppGraph = (appName: string) =>
  USE_MOCK ? mockQueryGraph(appName) : defHttp.get<any>(
    { url: `${Api.QueryAppGraph}/${encodeURIComponent(appName)}` },
    rawRequestOptions,
  );

export async function queryAppList() {
  if (USE_MOCK) return mockAppList();
  const payload = await defHttp.get<any>({ url: Api.AppList }, rawRequestOptions);
  if (payload?.status !== 'success' || !Array.isArray(payload?.apps)) {
    throw new Error('App list response is invalid');
  }
  return payload.apps;
}

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

export function requestDeleteNode(page: any) {
  if (!page?.pageId) throw new Error('当前节点缺少后台 pageId');
  if (USE_MOCK) return mockDeleteNode(page.pageId);
  return defHttp.post<any>(
    {
      url: Api.DeleteNode,
      data: { id: page.pageId },
    },
    rawRequestOptions,
  );
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

export function requestMoveNode(page: any, targetParent: any) {
  if (!page?.pageId) throw new Error('当前节点缺少后台 pageId');
  if (!targetParent?.pageId) throw new Error('目标父节点缺少后台 pageId');
  if (USE_MOCK) return mockMoveNode(page.pageId, targetParent.pageId);
  return defHttp.post<any>(
    {
      url: Api.MoveNode,
      data: { pageId: page.pageId, newParentId: targetParent.pageId },
    },
    rawRequestOptions,
  );
}

export function requestSavePageReview(page: any, review: any) {
  if (!page?.pageId) throw new Error('Missing backend pageId');
  const formData = new FormData();
  formData.append('pageId', page.pageId);
  formData.append('pageTitle', review.pageTitle);
  formData.append('pageText', review.pageText || '');
  formData.append('pageUrl', review.pageUrl || '');
  formData.append('widgetDescription', review.widgetDescription || '');
  formData.append('keepImages', JSON.stringify(review.keepImages || []));
  formData.append('aiInference', JSON.stringify(review.aiInference || {}));
  formData.append('action', JSON.stringify(review.action || {
    popupAction: [],
    stateAction: [],
    externalAction: [],
    pageNaviAction: [],
  }));
  formData.append('aiRecursive', String(Boolean(review.aiRecursive)));
  (review.newImages || []).forEach((file: File) => formData.append('newImages', file));

  if (USE_MOCK) return mockUpdateNode(formData);
  return defHttp.post<any>(
    {
      url: Api.UpdateNode,
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    },
    rawRequestOptions,
  );
}

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
