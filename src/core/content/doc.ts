/**
 * Story bodies are stored as a ProseMirror document (the format Tiptap, the admin editor,
 * reads and writes). Only the node and mark types below are allowed; the site renders
 * them itself, so no stored HTML ever reaches a page.
 */

export type Mark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'link'; attrs: { href: string } };

export interface TextNode {
  type: 'text';
  text: string;
  marks?: Mark[];
}

export interface HardBreak {
  type: 'hardBreak';
}

export type Inline = TextNode | HardBreak;

export interface Paragraph {
  type: 'paragraph';
  content?: Inline[];
}

export interface Heading {
  type: 'heading';
  attrs: { level: 2 | 3 | 4 };
  content?: Inline[];
}

export interface Blockquote {
  type: 'blockquote';
  content: Block[];
}

export interface ListItem {
  type: 'listItem';
  content: Block[];
}

export interface BulletList {
  type: 'bulletList';
  content: ListItem[];
}

export interface OrderedList {
  type: 'orderedList';
  content: ListItem[];
}

/** A photo in the story. `key` is the R2 object, kept beside the ID so rendering needs no lookup. */
export interface Image {
  type: 'image';
  attrs: { mediaId: number | null; key: string | null; alt: string; caption: string };
}

/** A YouTube video or Google Drive file, shown in a frame. */
export interface Embed {
  type: 'embed';
  attrs: { provider: 'youtube' | 'drive'; url: string };
}

export interface HorizontalRule {
  type: 'horizontalRule';
}

/** A boxed list of short facts beside the story: “What the law says”. */
export interface InfoBox {
  type: 'infoBox';
  attrs: { title: string; rows: Array<{ label: string; text: string }> };
}

/** A small chart drawn by the site from typed numbers. Highlighted rows use the yellow fill. */
export interface Chart {
  type: 'chart';
  attrs: {
    title: string;
    kind: 'bars' | 'line' | 'table';
    rows: Array<{ label: string; value: number; highlight: boolean }>;
    source: string;
  };
}

export type Block =
  | Paragraph
  | Heading
  | Blockquote
  | BulletList
  | OrderedList
  | Image
  | Embed
  | HorizontalRule
  | InfoBox
  | Chart;

export interface Doc {
  type: 'doc';
  content: Block[];
}

export const emptyDoc = (): Doc => ({ type: 'doc', content: [] });

/** Plain text of inline content, for search, previews and checks. */
export const inlineText = (content: Inline[] | undefined) =>
  (content ?? []).map((n) => (n.type === 'text' ? n.text : '\n')).join('');
