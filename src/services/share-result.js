// 結果共有の段階的フォールバック。DOMへ依存せず、依存するWeb APIは注入できる。

function isAbortError(error) {
  return error?.name === 'AbortError';
}

export async function shareResult({
  title = 'HAKODASE / ハコダセ',
  text = '',
  url = '',
  navigatorRef = typeof navigator !== 'undefined' ? navigator : null,
} = {}) {
  const fullText = [String(text || ''), String(url || '')].filter(Boolean).join('\n');

  if (typeof navigatorRef?.share === 'function') {
    try {
      await navigatorRef.share({ title, text, url });
      return Object.freeze({ status: 'shared', method: 'web-share', fullText });
    } catch (error) {
      if (isAbortError(error)) return Object.freeze({ status: 'cancelled', method: 'web-share', fullText });
    }
  }

  if (typeof navigatorRef?.clipboard?.writeText === 'function') {
    try {
      await navigatorRef.clipboard.writeText(fullText);
      return Object.freeze({ status: 'shared', method: 'clipboard', fullText });
    } catch (_) {
      // 選択可能テキストへフォールバックする。
    }
  }

  return Object.freeze({ status: 'fallback', method: null, fullText });
}
