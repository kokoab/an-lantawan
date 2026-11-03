import { describe, expect, it } from 'vitest';
import { cleanDoc, docMediaIds, isEmptyDoc, parseEmbedUrl } from './validate';

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const t = (text: string, marks?: unknown[]) => ({
  type: 'text',
  text,
  ...(marks ? { marks } : {}),
});

describe('cleanDoc', () => {
  it('keeps the allowed structure as it is', () => {
    const body = doc(
      { type: 'heading', attrs: { level: 2 }, content: [t('Title')] },
      p(t('Hello '), t('world', [{ type: 'bold' }]), { type: 'hardBreak' }, t('again')),
      { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('one'))] }] },
      { type: 'blockquote', content: [p(t('quoted'))] },
      { type: 'horizontalRule' },
    );
    expect(cleanDoc(body)).toEqual(body);
  });

  it('refuses things that are not a document', () => {
    expect(cleanDoc(null)).toBeNull();
    expect(cleanDoc('<p>hi</p>')).toBeNull();
    expect(cleanDoc({ type: 'paragraph' })).toBeNull();
  });

  it('drops unknown nodes and marks, including code and raw HTML', () => {
    const r = cleanDoc(
      doc(
        { type: 'codeBlock', content: [t('x')] },
        { type: 'html', value: '<script>alert(1)</script>' },
        p(t('a', [{ type: 'strike' }, { type: 'italic' }, { type: 'italic' }])),
      ),
    );
    expect(r).toEqual(doc(p(t('a', [{ type: 'italic' }]))));
  });

  it('keeps only safe links and only their address', () => {
    const link = (href: string) =>
      p(t('x', [{ type: 'link', attrs: { href, target: '_blank', class: 'evil' } }]));
    expect(cleanDoc(doc(link('https://lnu.edu.ph')))?.content[0]).toEqual(
      p(t('x', [{ type: 'link', attrs: { href: 'https://lnu.edu.ph' } }])),
    );
    expect(cleanDoc(doc(link('/news/story')))?.content[0]).toEqual(
      p(t('x', [{ type: 'link', attrs: { href: '/news/story' } }])),
    );
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.com', 'vbscript:x']) {
      expect(cleanDoc(doc(link(bad)))?.content[0]).toEqual(p(t('x')));
    }
  });

  it('keeps headings between levels 2 and 4', () => {
    const h = (level: number) => ({ type: 'heading', attrs: { level }, content: [t('H')] });
    expect(
      cleanDoc(doc(h(1), h(6)))?.content.map((b) => b.type === 'heading' && b.attrs.level),
    ).toEqual([2, 4]);
  });

  it('keeps only the photo fields the site reads and drops photos without a file', () => {
    const r = cleanDoc(
      doc(
        {
          type: 'image',
          attrs: { mediaId: 4, key: 'uploads/2026/03/a.jpg', alt: 'A', caption: 'C', onerror: 'x' },
        },
        { type: 'image', attrs: { mediaId: 5, key: '../../etc"><script>' } },
        { type: 'image', attrs: { src: 'https://evil.com/x.jpg' } },
      ),
    );
    expect(r?.content).toEqual([
      {
        type: 'image',
        attrs: { mediaId: 4, key: 'uploads/2026/03/a.jpg', alt: 'A', caption: 'C' },
      },
    ]);
  });

  it('turns video links into the stored form and drops other sites', () => {
    const r = cleanDoc(
      doc(
        { type: 'embed', attrs: { url: 'https://youtu.be/dQw4w9WgXcQ' } },
        { type: 'embed', attrs: { url: 'https://evil.com/embed/x' } },
      ),
    );
    expect(r?.content).toEqual([
      {
        type: 'embed',
        attrs: { provider: 'youtube', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
      },
    ]);
  });

  it('keeps info boxes and charts, cleaning their rows', () => {
    const r = cleanDoc(
      doc(
        {
          type: 'infoBox',
          attrs: {
            title: ' What the law says ',
            rows: [{ label: 'Section 6', text: 'Exempt.' }, { label: '', text: '' }, 'junk'],
          },
        },
        {
          type: 'chart',
          attrs: {
            title: 'Cases',
            kind: 'pie',
            rows: [
              { label: '2017', value: '26,000', highlight: 'yes' },
              { label: '2025', value: 5698, highlight: true },
              { label: 'Bad', value: 'many' },
            ],
            source: 'JJWC',
          },
        },
        { type: 'chart', attrs: { title: 'Empty', rows: [] } },
      ),
    );
    expect(r?.content).toEqual([
      {
        type: 'infoBox',
        attrs: { title: 'What the law says', rows: [{ label: 'Section 6', text: 'Exempt.' }] },
      },
      {
        type: 'chart',
        attrs: {
          title: 'Cases',
          kind: 'bars',
          rows: [
            { label: '2017', value: 26000, highlight: false },
            { label: '2025', value: 5698, highlight: true },
          ],
          source: 'JJWC',
        },
      },
    ]);
  });

  it('stops nesting at a sane depth', () => {
    let node: unknown = p(t('deep'));
    for (let i = 0; i < 50; i++) node = { type: 'blockquote', content: [node] };
    expect(() => cleanDoc(doc(node))).not.toThrow();
  });
});

describe('parseEmbedUrl', () => {
  it('reads the usual YouTube and Drive links', () => {
    const yt = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    for (const u of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ]) {
      expect(parseEmbedUrl(u)).toEqual({ provider: 'youtube', url: yt });
    }
    expect(parseEmbedUrl('https://drive.google.com/file/d/1AbCdEfGh/view?usp=sharing')).toEqual({
      provider: 'drive',
      url: 'https://drive.google.com/file/d/1AbCdEfGh/view',
    });
  });

  it('refuses other sites, plain http and junk', () => {
    for (const u of [
      'http://youtu.be/dQw4w9WgXcQ',
      'https://vimeo.com/1',
      'not a url',
      'https://youtube.com/watch',
    ]) {
      expect(parseEmbedUrl(u)).toBeNull();
    }
  });
});

describe('docMediaIds and isEmptyDoc', () => {
  it('finds photos anywhere in the body', () => {
    const img = (mediaId: number) => ({
      type: 'image' as const,
      attrs: { mediaId, key: 'k', alt: '', caption: '' },
    });
    expect(
      docMediaIds({
        type: 'doc',
        content: [img(1), { type: 'blockquote', content: [img(2)] }, img(1)],
      }),
    ).toEqual([1, 2]);
  });

  it('treats a body of empty paragraphs as empty', () => {
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'horizontalRule' }] })).toBe(false);
  });
});
