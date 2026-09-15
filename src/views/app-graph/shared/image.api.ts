import { API_BASE_URL } from './api.config';

export function buildImageApiUrl(imageUrl: string) {
  const normalizedUrl = String(imageUrl || '').trim();
  if (!normalizedUrl) return '';
  if (/^(data:|blob:)/i.test(normalizedUrl)) return normalizedUrl;
  if (/\/s3file\/image(?:\?|$)/i.test(normalizedUrl)) return normalizedUrl;
  return `${API_BASE_URL}/s3file/image?fileName=${encodeURIComponent(normalizedUrl)}`;
}

export function buildGraphThumbnailApiUrl(imageUrl: string, width = 240) {
  const fullSizeUrl = buildImageApiUrl(imageUrl);
  if (!fullSizeUrl || /^(data:|blob:)/i.test(fullSizeUrl)) return fullSizeUrl;
  const separator = fullSizeUrl.includes('?') ? '&' : '?';
  return `${fullSizeUrl}${separator}width=${Math.max(80, Math.min(width, 480))}`;
}
