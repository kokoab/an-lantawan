import { mergeAttributes, Node } from '@tiptap/core';

/**
 * The two story blocks Tiptap doesn't have: a photo from the library (by media ID and R2
 * key, with its own alt text and caption) and a YouTube or Drive video. Both are single
 * units in the editor; their details are edited in the panel under the toolbar.
 */
export const StoryImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      mediaId: { default: null },
      key: { default: null },
      alt: { default: '' },
      caption: { default: '' },
    };
  },
  renderHTML({ node }) {
    const { key, alt, caption } = node.attrs as {
      key: string | null;
      alt: string;
      caption: string;
    };
    return [
      'figure',
      { class: 'ed-figure' },
      ['img', { src: key ? `/media/${key}` : '', alt }],
      ['figcaption', {}, caption || 'No caption'],
    ];
  },
});

export const StoryEmbed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { provider: { default: 'youtube' }, url: { default: '' } };
  },
  renderHTML({ node, HTMLAttributes }) {
    const { provider, url } = node.attrs as { provider: string; url: string };
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'ed-embed' }),
      `${provider === 'drive' ? 'Google Drive file' : 'YouTube video'}: ${url}`,
    ];
  },
});
