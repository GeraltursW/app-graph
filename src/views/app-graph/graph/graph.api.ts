import { defHttp } from '@/utils/http/axios';
import { USE_MOCK, rawRequestOptions } from '../shared/api.config';
import { mockAppList, mockQueryGraph, mockDeleteNode, mockMoveNode, mockUpdateNode } from './graph.mock';
enum Api {
  AppList = '/appList',
  QueryAppGraph = '/queryAppGraph',
  DeleteNode = '/deleteNode',
  MoveNode = '/moveNode',
  UpdateNode = '/updateNode',
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
  if (review.embeddingText !== undefined) formData.append('embeddingText', review.embeddingText);
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
