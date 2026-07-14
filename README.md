# Application Map Demo

第三方移动应用页面关系图谱独立演示项目。该版本从 Vben Admin 的 `app-graph` 视图中抽离，可直接运行，不需要登录、数据库或后端服务。

## 快速运行

环境要求：Node.js 18 或更高版本。

```bash
npm install
npm run dev
```

浏览器访问：

```text
http://127.0.0.1:5176
```

生产构建：

```bash
npm run build
npm run preview
```

## 演示内容

- QQ、微信应用切换与节点数量统计
- 左右、上下、自由三种图谱布局
- 图谱缩放、平移、适配、展开与收起
- 简洁模式与完整模式
- 主树导航、层级展开和节点搜索
- 游离 URL 创建、AI 探索和拖拽并入
- 主树结构拖拽调整与后台结构回查逻辑
- 页面详情、AI 推理信息和上下游关系
- 页面复核编辑、图片维护与全屏预览
- 节点二次确认删除与后台数据同步
- 请求 Loading、防重复提交和成功/失败提示

## 数据模式

项目默认使用内置 Mock 数据，所有主要交互都可以直接演示：

```env
VITE_USE_MOCK=true
```

Mock 数据仅保存在当前浏览器运行会话中，刷新页面后恢复为初始演示数据。

如需连接真实 FastAPI 后端，创建 `.env.local`：

```env
VITE_USE_MOCK=false
VITE_APP_GRAPH_API_URL=/app-relation-api
```

开发服务器会将 `/app-relation-api` 转发到：

```text
http://127.0.0.1:8000
```

## 技术栈

- Vue 3
- Vite
- Ant Design Vue
- Vue Flow
- D3 Force
- Iconify
- TypeScript

## 目录说明

```text
src/views/app-graph/
  index.vue          页面入口与交互编排
  info.api.ts        接口适配与 Mock/真实后端切换
  info.data.ts       固定布局和工具配置
  components/        图谱、树导航和详情组件
  data/graph.js      图谱标准化与结构计算

src/mock/appGraph.ts 内置可交互演示数据
```
