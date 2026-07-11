import axios from 'axios';

const client = axios.create({ timeout: 15000 });

function request(method: 'get' | 'post', config: any, options: any = {}) {
  const base = options.apiUrl || '';
  return client.request({
    method,
    url: `${base}${config.url}`,
    params: config.params,
    data: config.data,
    headers: config.headers,
  }).then((response) => response.data);
}

export const defHttp = {
  get: <T = any>(config: any, options?: any) => request('get', config, options) as Promise<T>,
  post: <T = any>(config: any, options?: any) => request('post', config, options) as Promise<T>,
};
