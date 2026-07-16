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
  AppList = '/app_list',
  CreateOrphanNode = '/create_orphan_node',
  DeleteNode = '/delete_node',
  MoveNode = '/move_node',
  QueryAppGraph = '/queryAppGraph',
  UpdateNode = '/update_node',
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
  if (payload?.statue !== 'success' || !Array.isArray(payload?.apps)) {
    throw new Error('App list response is invalid');
  }
  return payload.apps;
}

export async function requestCreateOrphanNode(appName: string, pageUrl: string) {
  if (USE_MOCK) return mockCreateOrphan(appName, pageUrl);
  const payload = await defHttp.post<any>(
    {
      url: Api.CreateOrphanNode,
      data: { app_name: appName, page_url: pageUrl },
    },
    rawRequestOptions,
  );
  if (payload?.statue !== 'success' || !payload?.node) {
    throw new Error('Create orphan node response is invalid');
  }
  return payload;
}

export function requestDeleteNode(page: any) {
  if (!page?.pageId) throw new Error('当前节点缺少后台 page_id');
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
      '/ai/explore-floating-page',
      '/api/ai/explore-floating-page',
    ],
    {
      id: page.backendId,
      page_title: page.page_title,
      page_text: page.page_text,
      image_url: page.image_url,
      page_url: page.page_url,
      page_info: page.page_info,
    },
    'AI explore',
  );

export const requestMergeFloatingPage = (page: any, exploration: any) =>
  USE_MOCK ? Promise.resolve(exploration) : postToFirstAvailable(
    [
      '/ai/mergeFloatingPage',
      '/api/ai/mergeFloatingPage',
      '/ai/merge-floating-page',
      '/api/ai/merge-floating-page',
    ],
    {
      id: page.backendId,
      node_id: page.nodeId,
      page_url: page.page_url,
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
    can_merge: true,
    target_parent_node_id: targetParent.nodeId,
    target_parent_id: targetParent.backendId,
    widget_description: options.widget_description || '人工拖拽归类',
  })) : postToFirstAvailable(
    [
      '/ai/manualMergeFloatingPage',
      '/api/ai/manualMergeFloatingPage',
      '/ai/manual-merge-floating-page',
      '/api/ai/manual-merge-floating-page',
    ],
    {
      id: page.backendId,
      node_id: page.nodeId,
      page_title: page.page_title,
      page_text: page.page_text,
      page_url: page.page_url,
      image_url: page.image_url,
      target_parent_id: targetParent?.backendId ?? null,
      target_parent_node_id: targetParent?.nodeId || '',
      widget_description: options.widget_description || '人工拖拽归类',
      operator_note: options.operator_note || '人工拖拽游离页面到主图谱',
    },
    'Manual merge floating page',
  );

export function requestMoveNode(page: any, targetParent: any) {
  if (!page?.pageId) throw new Error('当前节点缺少后台 page_id');
  if (!targetParent?.pageId) throw new Error('目标父节点缺少后台 page_id');
  if (USE_MOCK) return mockMoveNode(page.pageId, targetParent.pageId);
  return defHttp.post<any>(
    {
      url: Api.MoveNode,
      data: { page_id: page.pageId, new_parent_id: targetParent.pageId },
    },
    rawRequestOptions,
  );
}

export function requestSavePageReview(page: any, review: any) {
  if (!page?.pageId) throw new Error('Missing backend page_id');
  const formData = new FormData();
  formData.append('page_id', page.pageId);
  formData.append('page_title', review.page_title);
  formData.append('page_text', review.page_text || '');
  formData.append('page_url', review.page_url || '');
  formData.append('widget_description', review.widget_description || '');
  formData.append('keep_images', JSON.stringify(review.keep_images || []));
  formData.append('ai_inference', JSON.stringify(review.ai_inference || {}));
  formData.append('action', JSON.stringify(review.action || {
    popupAction: [],
    stateAction: [],
    externalAction: [],
    pageNaviAction: [],
  }));
  formData.append('ai_recursive', String(Boolean(review.ai_recursive)));
  (review.new_images || []).forEach((file: File) => formData.append('new_images', file));

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
