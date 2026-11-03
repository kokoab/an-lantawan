import type { Block, Doc, Inline, ListItem, Mark } from './doc';

/**
 * Turns whatever the editor sent into a story body the site can render. Anything outside
 * the allowed nodes and marks is dropped, links keep only safe addresses, and photos and
 * videos keep only the fields the renderer reads. Text is never interpreted as HTML.
 */

const MAX_TEXT = 20_000;
const MAX_BLOCKS = 3_000;
const MEDIA_KEY = /^[\w\-./]{1,300}$/;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** A YouTube or Google Drive link in any of its usual forms, as the address the site stores. */
export function parseEmbedUrl(raw: string): { provider: 'youtube' | 'drive'; url: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  const id = (s: string | null | undefined) => (s && /^[\w-]{6,64}$/.test(s) ? s : null);
  let yt: string | null = null;
  if (host === 'youtu.be') yt = id(url.pathname.slice(1));
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    yt =
      parts[0] === 'watch'
        ? id(url.searchParams.get('v'))
        : ['embed', 'shorts', 'live'].includes(parts[0] ?? '')
          ? id(parts[1])
          : null;
  }
  if (yt) return { provider: 'youtube', url: `https://www.youtube.com/embed/${yt}` };
  if (host === 'drive.google.com') {
    const drive =
      id(url.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1]) ?? id(url.searchParams.get('id'));
    if (drive) return { provider: 'drive', url: `https://drive.google.com/file/d/${drive}/view` };
  }
  return null;
}

const SAFE_HREF = /^(https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+|\/(?!\/)[^\s]*)$/i;

function marks(raw: unknown): Mark[] {
  const out: Mark[] = [];
  const seen = new Set<string>();
  for (const m of list(raw)) {
    if (!isObj(m) || typeof m.type !== 'string' || seen.has(m.type)) continue;
    if (m.type === 'bold' || m.type === 'italic' || m.type === 'underline')
      out.push({ type: m.type });
    else if (m.type === 'link') {
      const href = isObj(m.attrs) ? str(m.attrs.href, 2000).trim() : '';
      if (SAFE_HREF.test(href)) out.push({ type: 'link', attrs: { href } });
      else continue;
    } else continue;
    seen.add(m.type);
  }
  return out;
}

function inlines(raw: unknown): Inline[] {
  const out: Inline[] = [];
  for (const n of list(raw)) {
    if (!isObj(n)) continue;
    if (n.type === 'hardBreak') out.push({ type: 'hardBreak' });
    else if (n.type === 'text') {
      const text = str(n.text, MAX_TEXT);
      if (!text) continue;
      const m = marks(n.marks);
      out.push(m.length ? { type: 'text', text, marks: m } : { type: 'text', text });
    }
  }
  return out;
}

function listItems(raw: unknown, depth: number): ListItem[] {
  return list(raw).flatMap((n) => {
    if (!isObj(n) || n.type !== 'listItem') return [];
    const content = blocks(n.content, depth + 1);
    return content.length ? [{ type: 'listItem' as const, content }] : [];
  });
}

function blocks(raw: unknown, depth = 0): Block[] {
  // Lists inside lists inside quotes stop somewhere; nine levels is far past real use.
  if (depth > 8) return [];
  const out: Block[] = [];
  for (const n of list(raw)) {
    if (!isObj(n)) continue;
    switch (n.type) {
      case 'paragraph': {
        const content = inlines(n.content);
        out.push(content.length ? { type: 'paragraph', content } : { type: 'paragraph' });
        break;
      }
      case 'heading': {
        const asked = isObj(n.attrs) ? Number(n.attrs.level) : 2;
        const level = Math.min(4, Math.max(2, Number.isFinite(asked) ? asked : 2)) as 2 | 3 | 4;
        const content = inlines(n.content);
        if (content.length) out.push({ type: 'heading', attrs: { level }, content });
        break;
      }
      case 'blockquote': {
        const content = blocks(n.content, depth + 1);
        if (content.length) out.push({ type: 'blockquote', content });
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        const content = listItems(n.content, depth);
        if (content.length) out.push({ type: n.type, content });
        break;
      }
      case 'image': {
        const a = isObj(n.attrs) ? n.attrs : {};
        const key = str(a.key, 300);
        if (!MEDIA_KEY.test(key)) break;
        const mediaId =
          Number.isInteger(a.mediaId) && (a.mediaId as number) > 0 ? (a.mediaId as number) : null;
        out.push({
          type: 'image',
          attrs: { mediaId, key, alt: str(a.alt, 300), caption: str(a.caption, 500) },
        });
        break;
      }
      case 'embed': {
        const a = isObj(n.attrs) ? n.attrs : {};
        const parsed = parseEmbedUrl(str(a.url, 500));
        if (parsed) out.push({ type: 'embed', attrs: parsed });
        break;
      }
      case 'horizontalRule':
        out.push({ type: 'horizontalRule' });
        break;
      case 'infoBox': {
        const a = isObj(n.attrs) ? n.attrs : {};
        const rows = list(a.rows)
          .filter(isObj)
          .map((r) => ({ label: str(r.label, 80).trim(), text: str(r.text, 600).trim() }))
          .filter((r) => r.label || r.text)
          .slice(0, 20);
        const title = str(a.title, 120).trim();
        if (title || rows.length) out.push({ type: 'infoBox', attrs: { title, rows } });
        break;
      }
      case 'chart': {
        const a = isObj(n.attrs) ? n.attrs : {};
        const kind = a.kind === 'line' || a.kind === 'table' ? a.kind : 'bars';
        const rows = list(a.rows)
          .filter(isObj)
          .map((r) => ({
            label: str(r.label, 60).trim(),
            value:
              typeof r.value === 'number'
                ? r.value
                : Number(String(r.value ?? '').replace(/,/g, '')),
            highlight: r.highlight === true,
          }))
          .filter((r) => r.label && Number.isFinite(r.value))
          .slice(0, 24);
        if (rows.length) {
          out.push({
            type: 'chart',
            attrs: {
              title: str(a.title, 120).trim(),
              kind,
              rows,
              source: str(a.source, 300).trim(),
            },
          });
        }
        break;
      }
    }
    if (out.length >= MAX_BLOCKS) break;
  }
  return out;
}

/** A clean story body, or null when the input isn't a document at all. */
export function cleanDoc(raw: unknown): Doc | null {
  if (!isObj(raw) || raw.type !== 'doc') return null;
  return { type: 'doc', content: blocks(raw.content) };
}

/** Media IDs of every photo in a body, for keeping track of which files a story uses. */
export function docMediaIds(doc: Doc): number[] {
  const ids = new Set<number>();
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (b.type === 'image' && b.attrs.mediaId) ids.add(b.attrs.mediaId);
      if (b.type === 'blockquote') walk(b.content);
      if (b.type === 'bulletList' || b.type === 'orderedList')
        for (const li of b.content) walk(li.content);
    }
  };
  walk(doc.content);
  return [...ids];
}

/** True when a body has no words, photos or videos in it. */
export function isEmptyDoc(doc: Doc) {
  return doc.content.every((b) => b.type === 'paragraph' && !b.content?.length);
}
