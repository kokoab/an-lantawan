import { describe, expect, it } from 'vitest';
import { htmlToDoc } from './html-to-doc.ts';

const blocks = (html: string) => htmlToDoc(html).doc.content;

describe('htmlToDoc', () => {
  it('turns paragraphs with bold, italic and links into marked text', () => {
    expect(
      blocks(
        '<p>The <strong>SSC</strong> met <em>today</em>. <a href="https://lnu.edu.ph">LNU</a></p>',
      ),
    ).toEqual([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'The ' },
          { type: 'text', text: 'SSC', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' met ' },
          { type: 'text', text: 'today', marks: [{ type: 'italic' }] },
          { type: 'text', text: '. ' },
          {
            type: 'text',
            text: 'LNU',
            marks: [{ type: 'link', attrs: { href: 'https://lnu.edu.ph' } }],
          },
        ],
      },
    ]);
  });

  it('drops unsafe links but keeps their text', () => {
    expect(blocks('<p><a href="javascript:alert(1)">click</a></p>')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'click' }] },
    ]);
  });

  it('decodes entities and collapses whitespace and non-breaking spaces', () => {
    expect(blocks('<p>  It&#8217;s&nbsp;&nbsp;here\n now </p>')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'It’s here now' }] },
    ]);
  });

  it('drops empty paragraphs and trailing line breaks', () => {
    expect(blocks('<p>&nbsp;</p><p>Hi<br><br></p><p></p>')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] },
    ]);
  });

  it('keeps single line breaks inside a paragraph', () => {
    expect(blocks('<p>Line one<br>Line two</p>')[0]).toEqual({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Line one' },
        { type: 'hardBreak' },
        { type: 'text', text: 'Line two' },
      ],
    });
  });

  it('turns WordPress figures into images with captions', () => {
    const { doc, images } = htmlToDoc(
      '<figure class="wp-block-image"><img src="https://anlantawan.wordpress.com/a.jpg?w=1024" alt="Graduates"><figcaption>Photo by <em>Juan</em></figcaption></figure>',
    );
    expect(doc.content).toEqual([
      {
        type: 'image',
        attrs: { mediaId: null, key: null, alt: 'Graduates', caption: 'Photo by Juan' },
      },
    ]);
    expect(images[0].src).toBe('https://anlantawan.wordpress.com/a.jpg?w=1024');
    expect(images[0].node).toBe(doc.content[0]);
  });

  it('splits a paragraph around an image inside it', () => {
    expect(blocks('<p>Before<img src="x.jpg">After</p>').map((b) => b.type)).toEqual([
      'paragraph',
      'image',
      'paragraph',
    ]);
  });

  it('maps headings to levels 2 to 4', () => {
    expect(
      blocks('<h1>A</h1><h3>B</h3><h6>C</h6>').map((b) =>
        b.type === 'heading' ? b.attrs.level : 0,
      ),
    ).toEqual([2, 3, 4]);
  });

  it('keeps lists and quotes', () => {
    expect(
      blocks('<ul><li>One</li><li><p>Two</p></li></ul><blockquote><p>Said</p></blockquote>'),
    ).toEqual([
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }],
          },
        ],
      },
      {
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Said' }] }],
      },
    ]);
  });

  it('keeps YouTube and Google Drive embeds and drops other frames', () => {
    expect(
      blocks(
        '<iframe src="https://www.youtube.com/embed/abc123XYZ?feature=oembed"></iframe><iframe src="https://drive.google.com/file/d/1AbC/preview"></iframe><iframe src="https://newsinfo.inquirer.net/x/embed"></iframe>',
      ),
    ).toEqual([
      {
        type: 'embed',
        attrs: { provider: 'youtube', url: 'https://www.youtube.com/embed/abc123XYZ' },
      },
      {
        type: 'embed',
        attrs: { provider: 'drive', url: 'https://drive.google.com/file/d/1AbC/preview' },
      },
    ]);
  });

  it('keeps Drive embeds that use a school account link', () => {
    expect(
      blocks(
        '<iframe src="https://drive.google.com/a/lnu.edu.ph/file/d/0Bx5hy/preview?"></iframe>',
      ),
    ).toEqual([
      {
        type: 'embed',
        attrs: { provider: 'drive', url: 'https://drive.google.com/file/d/0Bx5hy/preview' },
      },
    ]);
  });

  it('ignores scripts, styles and meta tags', () => {
    expect(
      blocks('<script>alert(1)</script><style>p{}</style><meta charset="x"><p>Kept</p>'),
    ).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: 'Kept' }] }]);
  });

  it('wraps loose text in a paragraph', () => {
    expect(blocks('<div>Loose <b>text</b></div>')).toEqual([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Loose ' },
          { type: 'text', text: 'text', marks: [{ type: 'bold' }] },
        ],
      },
    ]);
  });
});
