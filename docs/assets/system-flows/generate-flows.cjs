const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outputDir = __dirname;

const palette = {
  bg: '#F4F7FB',
  surface: '#FFFFFF',
  ink: '#17233C',
  muted: '#64748B',
  border: '#D8E2F0',
  blue: '#176BFF',
  blueSoft: '#EAF2FF',
  cyan: '#0EA5C6',
  green: '#159B68',
  greenSoft: '#E9F8F1',
  amber: '#C77A08',
  amberSoft: '#FFF6DE',
  red: '#D14B4B',
  redSoft: '#FFF0F0',
};

const layers = ['脚本采集', '后端治理', '前端应用', '用例下发', '真机结果'];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function textLines(lines, x, y, options = {}) {
  const {
    size = 16,
    color = palette.ink,
    weight = 400,
    lineHeight = 26,
    anchor = 'start',
  } = options;
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join('')}</text>`;
}

function statusChip(label, tone, x, y) {
  const tones = {
    done: [palette.greenSoft, palette.green],
    partial: [palette.amberSoft, palette.amber],
    gap: [palette.redSoft, palette.red],
  };
  const [fill, color] = tones[tone];
  const width = Math.max(74, label.length * 16 + 24);
  return `
    <rect x="${x}" y="${y}" width="${width}" height="30" rx="6" fill="${fill}"/>
    <circle cx="${x + 15}" cy="${y + 15}" r="4" fill="${color}"/>
    <text x="${x + 27}" y="${y + 21}" font-size="14" font-weight="700" fill="${color}">${escapeXml(label)}</text>
  `;
}

function card(item, index) {
  const x = 58 + index * 302;
  const y = 218;
  const width = 270;
  const height = 360;
  const status = item.status === 'done'
    ? ['已完成', 'done', palette.green]
    : ['待联调', 'partial', palette.amber];
  const number = String(index + 1).padStart(2, '0');
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${palette.surface}" stroke="${palette.border}" stroke-width="1.5"/>
      <rect x="${x}" y="${y}" width="6" height="${height}" rx="3" fill="${status[2]}"/>
      <circle cx="${x + 38}" cy="${y + 42}" r="20" fill="${palette.blueSoft}"/>
      <text x="${x + 38}" y="${y + 49}" text-anchor="middle" font-size="16" font-weight="800" fill="${palette.blue}">${number}</text>
      ${statusChip(status[0], status[1], x + 154, y + 27)}
      ${textLines([item.title], x + 24, y + 96, { size: 22, weight: 800 })}
      ${textLines([item.subtitle], x + 24, y + 124, { size: 14, color: palette.muted })}
      <line x1="${x + 24}" y1="${y + 148}" x2="${x + width - 24}" y2="${y + 148}" stroke="${palette.border}"/>
      ${item.lines.map((line, lineIndex) => `
        <circle cx="${x + 29}" cy="${y + 183 + lineIndex * 43}" r="4" fill="${lineIndex === 0 ? palette.blue : palette.cyan}"/>
        ${textLines(line, x + 42, y + 189 + lineIndex * 43, { size: 15, lineHeight: 20, color: palette.ink })}
      `).join('')}
      ${index < 4 ? `
        <path d="M ${x + width + 8} ${y + 180} H ${x + width + 25}" stroke="${palette.blue}" stroke-width="3" stroke-linecap="round" marker-end="url(#arrow)"/>
      ` : ''}
    </g>
  `;
}

function summaryPanel(title, tone, x, y, width, items) {
  const isDone = tone === 'done';
  const fill = isDone ? palette.greenSoft : palette.amberSoft;
  const color = isDone ? palette.green : palette.amber;
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="214" rx="8" fill="${fill}" stroke="${color}" stroke-opacity="0.28"/>
      <rect x="${x}" y="${y}" width="8" height="214" rx="4" fill="${color}"/>
      <text x="${x + 28}" y="${y + 39}" font-size="20" font-weight="800" fill="${color}">${escapeXml(title)}</text>
      ${items.map((item, index) => `
        <circle cx="${x + 33}" cy="${y + 76 + index * 39}" r="5" fill="${color}"/>
        <text x="${x + 49}" y="${y + 82 + index * 39}" font-size="15" fill="${palette.ink}">${escapeXml(item)}</text>
      `).join('')}
    </g>
  `;
}

function footerPipeline(activeIndex) {
  const startX = 163;
  const gap = 310;
  return `
    <line x1="${startX}" y1="942" x2="${startX + gap * 4}" y2="942" stroke="${palette.border}" stroke-width="6" stroke-linecap="round"/>
    ${layers.map((label, index) => {
      const x = startX + gap * index;
      const active = index === activeIndex;
      const completed = index < activeIndex;
      const color = active ? palette.blue : completed ? palette.green : '#9AA9BD';
      return `
        <circle cx="${x}" cy="942" r="${active ? 15 : 11}" fill="${color}" stroke="${palette.surface}" stroke-width="5"/>
        <text x="${x}" y="980" text-anchor="middle" font-size="14" font-weight="${active ? 800 : 600}" fill="${color}">${label}</text>
      `;
    }).join('')}
  `;
}

function buildSvg(data) {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
    <defs>
      <style>
        text { font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", Arial, sans-serif; }
      </style>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="18" flood-color="#173B73" flood-opacity="0.08"/>
      </filter>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 0 L 8 4 L 0 8 Z" fill="${palette.blue}"/>
      </marker>
      <linearGradient id="header" x1="0" x2="1">
        <stop offset="0" stop-color="#0E5FE5"/>
        <stop offset="0.72" stop-color="#1979F3"/>
        <stop offset="1" stop-color="#0EA5C6"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="1000" fill="${palette.bg}"/>
    <rect x="34" y="30" width="1532" height="134" rx="10" fill="url(#header)" filter="url(#shadow)"/>
    <text x="70" y="78" font-size="15" font-weight="700" fill="#DDEBFF">${escapeXml(data.eyebrow)}</text>
    <text x="70" y="122" font-size="34" font-weight="800" fill="#FFFFFF">${escapeXml(data.title)}</text>
    <text x="70" y="149" font-size="15" fill="#DDEBFF">${escapeXml(data.description)}</text>
    ${statusChip(`完成 ${data.counts.done}`, 'done', 1198, 60)}
    ${statusChip(`联调 ${data.counts.partial}`, 'partial', 1320, 60)}
    ${statusChip(`缺口 ${data.counts.gap}`, 'gap', 1434, 60)}
    ${data.cards.map(card).join('')}
    ${summaryPanel('已经完成', 'done', 58, 616, 720, data.done)}
    ${summaryPanel('不足与下一步', 'partial', 822, 616, 720, data.gaps)}
    ${footerPipeline(data.activeLayer)}
  </svg>`;
}

const diagrams = [
  {
    file: '01-script-exploration-flow',
    eyebrow: 'APP GRAPH · LAYER 01',
    title: '手机探索脚本：从启动应用到生成可导入证据',
    description: '每次动作从稳定根状态重放路径，避免重复点击同一控件，并保留同一页面的多条到达关系。',
    activeLayer: 0,
    counts: { done: 8, partial: 3, gap: 3 },
    cards: [
      {
        title: '选择探索模式',
        subtitle: '明确本轮扫描范围',
        status: 'done',
        lines: [
          ['initial：初始页面骨架'],
          ['incremental：四层动作补充'],
          ['single-node：指定节点探索'],
          ['参数：步数、深度、输出目录'],
        ],
      },
      {
        title: '恢复与路径重放',
        subtitle: '回到可重复的页面状态',
        status: 'done',
        lines: [
          ['关闭并重新启动应用'],
          ['重放最短已知动作路径'],
          ['校验目标页面结构指纹'],
          ['安全关闭启动广告或弹窗'],
        ],
      },
      {
        title: 'AI 发现候选动作',
        subtitle: '截图 + UI 树 + 上下文',
        status: 'done',
        lines: [
          ['识别页面、控件与 OCR'],
          ['输出四层 Action 候选'],
          ['生成结构与状态指纹'],
          ['风险过滤：只自动执行 safe'],
        ],
      },
      {
        title: '执行与二次验证',
        subtitle: '用动作前后证据确认效果',
        status: 'done',
        lines: [
          ['HDC / Mock 执行 tap、swipe'],
          ['对比前后截图和页面上下文'],
          ['确认跳转、状态、弹层、外部'],
          ['记录边、结果与失败原因'],
        ],
      },
      {
        title: '持久化与交付',
        subtitle: '可中断恢复并进入后端',
        status: 'partial',
        lines: [
          ['SQLite 保存 Frontier 与 Attempt'],
          ['action_fingerprint 防止重复'],
          ['输出 ai_result.json + 截图'],
          ['可调用 scan-folder 自动导入'],
        ],
      },
    ],
    done: [
      '三种探索模式已经在 Mock 场景完成端到端验证',
      '页面状态、动作尝试、路径和多入口边可以持续保存',
      'DISCOVERY + VERIFICATION 两阶段识别已形成代码',
      '输出结构已经兼容现有后端 AiFolderImporter',
    ],
    gaps: [
      '需要按真实 HarmonyOS 版本校准 HDC 命令模板',
      '需要接入真实视觉模型并建立识别准确率 Benchmark',
      '尚缺后端任务 Worker、心跳、暂停、取消和设备调度',
      '性能采集适配器与实时结果回传尚未接入脚本',
    ],
  },
  {
    file: '02-backend-data-governance-flow',
    eyebrow: 'APP GRAPH · LAYER 02',
    title: '后端数据治理：从扫描证据到可查询应用图谱',
    description: '后端负责证据入库、功能页面去重、关系保存、人工复核和稳定 API，不把 AI 结论直接当作最终事实。',
    activeLayer: 1,
    counts: { done: 10, partial: 4, gap: 5 },
    cards: [
      {
        title: '接收扫描证据',
        subtitle: '本地目录或脚本自动导入',
        status: 'done',
        lines: [
          ['读取 ai_result.json'],
          ['接收截图、OCR、UI 控件'],
          ['保存 App 与 Scan 批次'],
          ['记录原始 AI Payload'],
        ],
      },
      {
        title: '归一化与去重',
        subtitle: '动态内容不制造新功能页',
        status: 'done',
        lines: [
          ['截图 SHA-256 资源去重'],
          ['结构字段归一化'],
          ['structure_hash 功能页去重'],
          ['PageInstance 作为证据保留'],
        ],
      },
      {
        title: 'PostgreSQL 图模型',
        subtitle: '页面、控件、边和资源',
        status: 'done',
        lines: [
          ['CanonicalPage / PageInstance'],
          ['PageWidget / PageEdge / Asset'],
          ['动作 JSON 与 AI 推理信息'],
          ['pgvector 表结构已具备'],
        ],
      },
      {
        title: '管理与复核 API',
        subtitle: '支持前端图谱持续修正',
        status: 'done',
        lines: [
          ['查询应用与递归图谱'],
          ['编辑、删除、移动节点'],
          ['创建与合并游离 URL'],
          ['图片访问与 URL Replay 候选'],
        ],
      },
      {
        title: '语义与用例服务',
        subtitle: '方案完成，代码尚待落地',
        status: 'partial',
        lines: [
          ['Function Catalog + Binding'],
          ['PageAction 标准化与检索'],
          ['Region Resolver + 路径规划'],
          ['TestCase / Run / Metrics'],
        ],
      },
    ],
    done: [
      'FastAPI、PostgreSQL、pgvector 基础工程和导入接口已存在',
      '功能页面按结构去重，截图和页面实例仍保留证据链',
      '图谱查询、节点编辑、删除、移动和游离节点接口已实现',
      '四层动作可随页面更新保存，页面跳转可从边关系补充',
    ],
    gaps: [
      'Function Tree、页面和动作 Binding 目前只有设计文档',
      '四层动作仍需从 JSONB 归一化到 page_actions 表',
      '区域动作检索、Dijkstra / K-shortest 规划器尚未实现',
      '用例任务、真机 Dry Run、实时事件与性能样本尚未落库',
    ],
  },
  {
    file: '03-frontend-product-flow',
    eyebrow: 'APP GRAPH · LAYER 03',
    title: '前端产品闭环：从选择应用到图谱复核与用例编排',
    description: 'Vue 3 + Ant Design Vue + AntV G6 将后端图数据转化为可搜索、可复核、可编辑、可演示的应用页面地图。',
    activeLayer: 2,
    counts: { done: 12, partial: 4, gap: 4 },
    cards: [
      {
        title: '选择应用与加载',
        subtitle: '真实接口或纯前端 Mock',
        status: 'done',
        lines: [
          ['应用 Select 支持搜索与数量'],
          ['queryAppGraph 加载整张图'],
          ['QQ 300 节点离线演示'],
          ['加载、提示与防重复提交'],
        ],
      },
      {
        title: '结构导航',
        subtitle: '页面树、官方功能、游离 URL',
        status: 'done',
        lines: [
          ['递归页面树与搜索定位'],
          ['AI 节点一键高亮'],
          ['Function Tree 覆盖 Demo'],
          ['拖拽并入与结构调整'],
        ],
      },
      {
        title: 'G6 图谱画布',
        subtitle: '大图展示与多布局切换',
        status: 'done',
        lines: [
          ['左右树 / 上下树 / 引力图'],
          ['图片节点、边标签与分区'],
          ['平移、缩放、Minimap、定位'],
          ['完整图谱图片导出'],
        ],
      },
      {
        title: '人工复核',
        subtitle: '页面、图片与四层动作编辑',
        status: 'done',
        lines: [
          ['标题、描述、URL、AI 信息'],
          ['截图保留、上传、删除、预览'],
          ['四层 Action 查看与编辑'],
          ['节点删除、移动和后端保存'],
        ],
      },
      {
        title: '用例与结果',
        subtitle: 'Demo 完成，真实执行待接通',
        status: 'partial',
        lines: [
          ['220 条 root-to-leaf 路径'],
          ['80 条过程性能 Mock 用例'],
          ['图谱路径与步骤实时高亮'],
          ['区域生成和真机结果待实现'],
        ],
      },
    ],
    done: [
      '三栏图谱工作台、G6 多布局和大规模 Mock 演示可直接运行',
      '页面树、游离节点、AI 高亮、截图复核和动作编辑已具备',
      'Function Tree 已有前端展示与关键词匹配 Demo',
      '路径型和过程型用例可在图谱中预览与模拟执行',
    ],
    gaps: [
      'Function Tree 仍是静态 QQ 数据，正式 Binding API 未接入',
      '尚缺 Function / 半径 / 框选区域选择器和动作矩阵',
      '用例目前在前端内存生成，未接后端生成、校验与版本冻结',
      '执行进度和性能结果仍是 Mock，尚未连接真实手机脚本',
    ],
  },
];

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const diagram of diagrams) {
    const svg = buildSvg(diagram);
    const svgPath = path.join(outputDir, `${diagram.file}.svg`);
    const pngPath = path.join(outputDir, `${diagram.file}.png`);
    fs.writeFileSync(svgPath, svg, 'utf8');
    await sharp(Buffer.from(svg)).png().toFile(pngPath);
    console.log(`${diagram.file}: SVG + PNG`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
