import { ExtensionCategory, Rect, register } from '@antv/g6';

const NODE_TYPE = 'app-page-node';
const registrationKey = '__APP_GRAPH_G6_NODE_REGISTERED__';

class AppPageNode extends Rect {
  drawText(key, style, container) {
    return this.upsert(key, 'text', style, container);
  }

  bindClick(shape, callback) {
    if (!shape || shape.__appGraphClickBound) return;
    shape.addEventListener('click', (event) => {
      event.stopPropagation();
      callback?.();
    });
    shape.__appGraphClickBound = true;
  }

  drawHeaderAction(key, x, y, label, callback, container) {
    const background = this.upsert(`${key}-background`, 'rect', {
      x,
      y,
      width: 34,
      height: 20,
      radius: 4,
      fill: 'rgba(255, 255, 255, 0.18)',
      stroke: 'rgba(255, 255, 255, 0.48)',
      lineWidth: 1,
      cursor: 'pointer',
    }, container);
    const text = this.drawText(`${key}-label`, {
      x: x + 17,
      y: y + 10,
      text: label,
      fill: '#ffffff',
      fontSize: 10,
      fontWeight: 600,
      textAlign: 'center',
      textBaseline: 'middle',
      cursor: 'pointer',
    }, container);
    this.bindClick(background, callback);
    this.bindClick(text, callback);
  }

  render(attributes = this.parsedAttributes, container) {
    super.render(attributes, container);

    const [width, height] = this.getSize(attributes);
    const compact = Boolean(attributes.compact);
    const top = -height / 2;
    const left = -width / 2;
    const headerHeight = 36;
    const padding = 10;
    const imageTop = top + headerHeight + 10;
    const imageWidth = width - padding * 2;
    const imageHeight = compact ? height - headerHeight - 20 : 142;
    const accentColor = attributes.accentColor || '#1769e0';

    this.upsert('header', 'rect', {
      x: left,
      y: top,
      width,
      height: headerHeight,
      radius: [6, 6, 0, 0],
      fill: accentColor,
    }, container);

    this.drawText('title', {
      x: left + 10,
      y: top + headerHeight / 2,
      text: attributes.title || '未命名页面',
      fill: '#ffffff',
      fontSize: compact ? 11 : 13,
      fontWeight: 700,
      textAlign: 'left',
      textBaseline: 'middle',
      wordWrap: true,
      wordWrapWidth: width - (compact && attributes.outgoingCount > 0 ? 92 : 58),
      maxLines: 1,
      textOverflow: '...',
    }, container);

    this.drawHeaderAction('preview', left + width - 44, top + 8, '查看', attributes.onPreview, container);
    if (compact && attributes.outgoingCount > 0) {
      this.drawHeaderAction(
        'collapse',
        left + width - 82,
        top + 8,
        attributes.collapsed ? '展开' : '收起',
        attributes.onToggle,
        container,
      );
    }

    this.upsert('image-background', 'rect', {
      x: left + padding,
      y: imageTop,
      width: imageWidth,
      height: imageHeight,
      radius: 4,
      fill: '#dbeafe',
      stroke: 'rgba(67, 111, 166, 0.24)',
      lineWidth: 1,
    }, container);

    if (attributes.imageSrc) {
      const screenshot = this.upsert('screenshot', 'image', {
        x: left + padding,
        y: imageTop,
        width: imageWidth,
        height: imageHeight,
        src: attributes.imageSrc,
        preserveAspectRatio: 'xMidYMin meet',
        cursor: 'pointer',
      }, container);
      this.bindClick(screenshot, attributes.onPreview);
    } else {
      this.drawText('image-placeholder', {
        x: 0,
        y: imageTop + imageHeight / 2,
        text: '暂无截图',
        fill: '#7490b4',
        fontSize: 11,
        textAlign: 'center',
        textBaseline: 'middle',
      }, container);
    }

    if (attributes.badgeText) {
      this.upsert('badge-background', 'rect', {
        x: left + 16,
        y: imageTop + 8,
        width: 44,
        height: 19,
        radius: 3,
        fill: attributes.aiRecursive ? '#facc15' : '#2563eb',
      }, container);
      this.drawText('badge-label', {
        x: left + 38,
        y: imageTop + 17.5,
        text: attributes.badgeText,
        fill: attributes.aiRecursive ? '#713f12' : '#ffffff',
        fontSize: 9,
        fontWeight: 700,
        textAlign: 'center',
        textBaseline: 'middle',
      }, container);
    }

    if (!compact) {
      const detailsTop = imageTop + imageHeight + 10;
      this.drawText('description', {
        x: left + padding,
        y: detailsTop,
        text: attributes.description || '暂无页面描述',
        fill: '#354965',
        fontSize: 10,
        lineHeight: 14,
        textAlign: 'left',
        textBaseline: 'top',
        wordWrap: true,
        wordWrapWidth: width - padding * 2,
        maxLines: 2,
        textOverflow: '...',
      }, container);
      this.drawText('url', {
        x: left + padding,
        y: top + height - 13,
        text: attributes.pageUrl || 'no page url',
        fill: '#59708e',
        fontSize: 9,
        textAlign: 'left',
        textBaseline: 'middle',
        wordWrap: true,
        wordWrapWidth: width - 58,
        maxLines: 1,
        textOverflow: '...',
      }, container);
      if (attributes.outgoingCount > 0) {
        const toggle = this.drawText('collapse-action', {
          x: left + width - 10,
          y: top + height - 13,
          text: attributes.collapsed ? '展开' : '收起',
          fill: accentColor,
          fontSize: 9,
          fontWeight: 700,
          textAlign: 'right',
          textBaseline: 'middle',
          cursor: 'pointer',
        }, container);
        this.bindClick(toggle, attributes.onToggle);
      }
    }
  }
}

export function registerAppPageNode() {
  if (globalThis[registrationKey]) return NODE_TYPE;
  register(ExtensionCategory.NODE, NODE_TYPE, AppPageNode);
  globalThis[registrationKey] = true;
  return NODE_TYPE;
}
