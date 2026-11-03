import { describe, expect, it } from 'vitest';
import { checkUpload, pdfPageCount, sniff, uploadKey } from './media';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);
const HTML = new TextEncoder().encode('<!doctype html><script>alert(1)</script>');

describe('sniff', () => {
  it('recognises photos and PDFs by their bytes', () => {
    expect(sniff(JPG)?.mime).toBe('image/jpeg');
    expect(sniff(PNG)?.mime).toBe('image/png');
    expect(sniff(WEBP)?.mime).toBe('image/webp');
    expect(sniff(PDF)).toEqual({ kind: 'pdf', mime: 'application/pdf', ext: 'pdf' });
  });

  it('refuses SVG, HTML and anything unknown', () => {
    expect(sniff(SVG)).toBeNull();
    expect(sniff(HTML)).toBeNull();
    expect(sniff(bytes(1, 2, 3))).toBeNull();
  });
});

describe('checkUpload', () => {
  it('accepts a known file of the wanted kind', () => {
    expect(checkUpload(JPG, 'image')).toMatchObject({ ok: true });
    expect(checkUpload(PDF)).toMatchObject({ ok: true });
  });

  it('refuses empty files, the wrong kind and oversized files', () => {
    expect(checkUpload(new Uint8Array())).toEqual({ ok: false, error: 'That file is empty.' });
    expect(checkUpload(PDF, 'image')).toEqual({ ok: false, error: 'Upload a photo here.' });
    expect(checkUpload(JPG, 'pdf')).toEqual({ ok: false, error: 'Upload a PDF here.' });
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(checkUpload(big)).toEqual({ ok: false, error: 'Keep photos under 10 MB.' });
  });
});

describe('uploadKey', () => {
  it('builds a dated, random, readable key with the real extension', () => {
    const key = uploadKey(
      'Basketball Finals (1).JPEG',
      { kind: 'image', mime: 'image/jpeg', ext: 'jpg' },
      new Date('2026-03-12T05:00:00Z'),
      'k3x9',
    );
    expect(key).toBe('uploads/2026/03/k3x9-basketball-finals-1.jpg');
  });

  it('falls back to a plain name when the file name has no usable letters', () => {
    const key = uploadKey(
      '…',
      { kind: 'pdf', mime: 'application/pdf', ext: 'pdf' },
      new Date('2026-11-01T00:00:00Z'),
      'r',
    );
    expect(key).toBe('uploads/2026/11/r-file.pdf');
  });
});

describe('pdfPageCount', () => {
  const pdf = (body: string) => new TextEncoder().encode(`%PDF-1.4\n${body}\n%%EOF`);
  const page = (n: number) => `${n} 0 obj << /Type /Page /Parent 2 0 R >> endobj\n`;

  it('reads the count on the page tree', () => {
    expect(pdfPageCount(pdf('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 32 >> endobj'))).toBe(32);
    expect(pdfPageCount(pdf('2 0 obj <</Count 12/Kids[3 0 R]/Type/Pages>> endobj'))).toBe(12);
  });

  it('uses the root count when the tree is nested', () => {
    const body =
      '1 0 obj << /Type /Pages /Count 40 /Kids [2 0 R 3 0 R] >> endobj 2 0 obj << /Type /Pages /Count 16 /Parent 1 0 R >> endobj';
    expect(pdfPageCount(pdf(body))).toBe(40);
  });

  it('ignores outline counts', () => {
    const body = `4 0 obj << /Type /Outlines /Count 99 >> endobj ${page(5)}${page(6)}`;
    expect(pdfPageCount(pdf(body))).toBe(2);
  });

  it('counts page objects when there is no tree count', () => {
    expect(pdfPageCount(pdf([1, 2, 3].map(page).join('')))).toBe(3);
  });

  it('gives up on a tree it cannot see', () => {
    expect(pdfPageCount(pdf('1 0 obj << /Type /ObjStm /N 40 >> stream ... endstream'))).toBeNull();
  });

  it('counts pages across the megabyte boundaries once each', () => {
    const filler = ' '.repeat(1024 * 1024 - 30);
    const body = `${page(1)}${filler}${page(2)}${filler}${page(3)}`;
    expect(pdfPageCount(pdf(body))).toBe(3);
  });

  it('finds a page object cut in half by a chunk edge', () => {
    const head = '%PDF-1.4\n';
    const before = ' '.repeat(1024 * 1024 - head.length - 5);
    const bytes = new TextEncoder().encode(`${head}${before}/Type /Page /Parent 2 0 R`);
    expect(pdfPageCount(bytes)).toBe(1);
  });
});
