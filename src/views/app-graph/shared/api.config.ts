export const API_BASE_URL = import.meta.env.VITE_APP_GRAPH_API_URL || '/appGraph';
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export const requestOptions = { apiUrl: API_BASE_URL };
export const rawRequestOptions = {
  ...requestOptions,
  errorMessageMode: 'none' as const,
  isTransformResponse: false,
  joinPrefix: false,
  withToken: false,
};

// Match the HTTP JSON boundary without leaking reactive proxies into mock storage.
export function toMockPayload(body: any) {
  return JSON.parse(JSON.stringify(body));
}

export function requestError(error: any) {
  return error?.response?.data?.message || error?.message || '请求失败';
}
