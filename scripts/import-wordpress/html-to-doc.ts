/**
 * Converts WordPress post HTML into the story document format (src/core/content/doc.ts).
 * Anything outside that format is dropped or flattened to text; nothing is kept as HTML.
 */
import type { ChildNode, Element } from 'domhandler';
import { parseDocument } from 'htmlparser2';
import type { Block, Doc, Embed, Image, Inline, Mark } from '../../src/core/content/doc.ts';

/** A photo found in the post, still pointing at WordPress. The loader fills in `node.attrs`. */
export interface FoundImage {
  src: string;
  node: Image;
}

export interface Converted {
  doc: Doc;
  images: FoundImage[];
}

const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'ul',
  'ol',
  'figure',
  'hr',
  'iframe',
  'div',
  'pre',
  'section',
  'article',
  'table',
  'header',
  'footer',
]);
const DROP_TAGS = new Set(['script', 'style', 'meta', 'link', 'noscript', 'svg', 'form', 'button']);
const MARK_FOR: Record<string, Mark['type']> = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  u: 'underline',
};

const isElement = (n: ChildNode): n is Element =>
  n.type === 'tag' || n.type === 'script' || n.type === 'style';

function textOf(node: ChildNode): string {
  if (node.type === 'text') return node.data;
  if (isElement(node)) return node.children.map(textOf).join('');
  return '';
}

const clean = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ');

function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  const h = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(h) ? h : null;
}

function embedFor(src: string | undefined): Embed | null {
  if (!src) return null;
  const yt =
    src.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/) ??
    src.match(/youtu\.be\/([\w-]{6,})/);
  if (yt)
    return {
      type: 'embed',
      attrs: { provider: 'youtube', url: `https://www.youtube.com/embed/${yt[1]}` },
    };
  // Includes school-account links: drive.google.com/a/lnu.edu.ph/file/d/…
  const drive = src.match(/drive\.google\.com\/(?:a\/[^/]+\/)?file\/d\/([\w-]+)/);
  if (drive) {
    return {
      type: 'embed',
      attrs: { provider: 'drive', url: `https://drive.google.com/file/d/${drive[1]}/preview` },
    };
  }
  return null;
}

function headingLevel(tag: string): 2 | 3 | 4 {
  if (tag === 'h1' || tag === 'h2') return 2;
  if (tag === 'h3') return 3;
  return 4;
}

class Builder {
  blocks: Block[] = [];
  images: FoundImage[] = [];
  private inline: Inline[] = [];

  /** Ends the paragraph being collected, if it has any visible text. */
  flush(wrap: (content: Inline[]) => Block = (content) => ({ type: 'paragraph', content })) {
    const content = tidyInline(this.inline);
    this.inline = [];
    if (content.length) this.blocks.push(wrap(content));
  }

  text(t: string, marks: Mark[]) {
    if (!t) return;
    const last = this.inline.at(-1);
    if (last?.type === 'text' && sameMarks(last.marks, marks)) last.text += t;
    else
      this.inline.push(
        marks.length ? { type: 'text', text: t, marks: [...marks] } : { type: 'text', text: t },
      );
  }

  hardBreak() {
    this.inline.push({ type: 'hardBreak' });
  }

  image(el: Element, caption: string) {
    const src = el.attribs.src ?? el.attribs['data-orig-file'] ?? '';
    if (!src) return;
    this.flush();
    const node: Image = {
      type: 'image',
      attrs: {
        mediaId: null,
        key: null,
        alt: clean(el.attribs.alt ?? '').trim(),
        caption: clean(caption).trim(),
      },
    };
    this.blocks.push(node);
    this.images.push({ src, node });
  }
}

function sameMarks(a: Mark[] | undefined, b: Mark[]) {
  const x = a ?? [];
  return x.length === b.length && x.every((m, i) => JSON.stringify(m) === JSON.stringify(b[i]));
}

/** Collapses whitespace, trims the ends and drops paragraphs that are only breaks or spaces. */
function tidyInline(content: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const n of content) {
    if (n.type === 'text') {
      const text = clean(n.text);
      const prev = out.at(-1);
      const joined =
        prev?.type === 'text' && prev.text.endsWith(' ') ? text.replace(/^ /, '') : text;
      if (joined) out.push({ ...n, text: joined });
    } else if (out.length && out.at(-1)?.type !== 'hardBreak') {
      out.push(n);
    }
  }
  while (out.at(-1)?.type === 'hardBreak') out.pop();
  const first = out[0];
  if (first?.type === 'text') first.text = first.text.trimStart();
  const last = out.at(-1);
  if (last?.type === 'text') last.text = last.text.trimEnd();
  const visible = out.filter((n) => n.type === 'text' && n.text.trim() !== '');
  return visible.length ? out.filter((n) => n.type !== 'text' || n.text !== '') : [];
}

function walkInline(nodes: ChildNode[], b: Builder, marks: Mark[]) {
  for (const node of nodes) {
    if (node.type === 'text') {
      b.text(node.data, marks);
      continue;
    }
    if (!isElement(node) || DROP_TAGS.has(node.name)) continue;
    const tag = node.name;
    if (tag === 'br') b.hardBreak();
    else if (tag === 'img') b.image(node, '');
    else if (BLOCK_TAGS.has(tag)) walkBlock([node], b);
    else if (tag === 'a') {
      const href = safeHref(node.attribs.href);
      walkInline(node.children, b, href ? [...marks, { type: 'link', attrs: { href } }] : marks);
    } else if (MARK_FOR[tag]) {
      const type = MARK_FOR[tag];
      walkInline(
        node.children,
        b,
        marks.some((m) => m.type === type) ? marks : [...marks, { type } as Mark],
      );
    } else walkInline(node.children, b, marks);
  }
}

function walkBlock(nodes: ChildNode[], b: Builder) {
  for (const node of nodes) {
    if (!isElement(node)) {
      if (node.type === 'text') b.text(node.data, []);
      continue;
    }
    if (DROP_TAGS.has(node.name)) continue;
    const tag = node.name;
    switch (tag) {
      case 'p':
        b.flush();
        walkInline(node.children, b, []);
        b.flush();
        break;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        b.flush();
        walkInline(node.children, b, []);
        const level = headingLevel(tag);
        b.flush((content) => ({ type: 'heading', attrs: { level }, content }));
        break;
      }
      case 'blockquote': {
        b.flush();
        const inner = new Builder();
        walkBlock(node.children, inner);
        inner.flush();
        b.images.push(...inner.images);
        if (inner.blocks.length) b.blocks.push({ type: 'blockquote', content: inner.blocks });
        break;
      }
      case 'ul':
      case 'ol': {
        b.flush();
        const items = node.children
          .filter((c): c is Element => isElement(c) && c.name === 'li')
          .map((li) => {
            const inner = new Builder();
            walkBlock(li.children, inner);
            inner.flush();
            b.images.push(...inner.images);
            return {
              type: 'listItem' as const,
              content: inner.blocks.length ? inner.blocks : [{ type: 'paragraph' as const }],
            };
          });
        if (items.length)
          b.blocks.push({ type: tag === 'ul' ? 'bulletList' : 'orderedList', content: items });
        break;
      }
      case 'figure': {
        b.flush();
        const caption = node.children
          .filter((c): c is Element => isElement(c) && c.name === 'figcaption')
          .map(textOf)
          .join(' ');
        const imgs = findAll(node, 'img');
        const frame = findAll(node, 'iframe')[0];
        if (imgs.length) {
          // The caption belongs under the last photo of the group.
          imgs.forEach((img, i) => {
            b.image(img, i === imgs.length - 1 ? caption : '');
          });
        } else if (frame) {
          const embed = embedFor(frame.attribs.src);
          if (embed) b.blocks.push(embed);
        } else
          walkBlock(
            node.children.filter((c) => !(isElement(c) && c.name === 'figcaption')),
            b,
          );
        break;
      }
      case 'iframe': {
        b.flush();
        const embed = embedFor(node.attribs.src);
        if (embed) b.blocks.push(embed);
        break;
      }
      case 'hr':
        b.flush();
        b.blocks.push({ type: 'horizontalRule' });
        break;
      case 'pre':
        // Pasted text, not code: keep its line breaks as paragraphs.
        b.flush();
        for (const line of textOf(node).split(/\n\s*\n/)) {
          b.text(line, []);
          b.flush();
        }
        break;
      case 'img':
        b.image(node, '');
        break;
      case 'div':
      case 'section':
      case 'article':
      case 'header':
      case 'footer':
      case 'table':
        walkBlock(node.children, b);
        break;
      default:
        walkInline([node], b, []);
    }
  }
}

function findAll(root: Element, name: string): Element[] {
  const out: Element[] = [];
  const visit = (n: ChildNode) => {
    if (!isElement(n)) return;
    if (n.name === name) out.push(n);
    n.children.forEach(visit);
  };
  root.children.forEach(visit);
  return out;
}

export function htmlToDoc(html: string): Converted {
  const dom = parseDocument(html, { decodeEntities: true });
  const b = new Builder();
  walkBlock(dom.children, b);
  b.flush();
  return { doc: { type: 'doc', content: b.blocks }, images: b.images };
}
