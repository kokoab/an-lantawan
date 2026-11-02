/**
 * Step 3: copies the photos into R2 and loads the stories into D1. Safe to run again.
 *
 *   node scripts/import-wordpress/load.ts --local    your computer's database (default)
 *   node scripts/import-wordpress/load.ts --remote   the live site
 *
 * Photos are downloaded once into scripts/out/images and uploads are remembered in
 * scripts/out/uploaded-<target>.json, so a second run only does what is left.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { imageSize } from 'image-size';
import { slugify } from './classify.ts';
import type { FoundImage } from './html-to-doc.ts';
import { mediaSql, orphanPeopleSql, personSql, type StoredImage, storySql, tagSql } from './sql.ts';
import { planImport, type WpPost } from './transform.ts';

const run = promisify(execFile);
const target = process.argv.includes('--remote') ? '--remote' : '--local';
const OUT = new URL('../out/', import.meta.url);
const IMAGES = new URL('images/', OUT);
const WRANGLER = fileURLToPath(new URL('../../node_modules/.bin/wrangler', import.meta.url));
const BUCKET = 'an-lantawan-media';
const MAX_WIDTH = 1600;
mkdirSync(IMAGES, { recursive: true });

/** Where to fetch a photo from, or null for hosts whose photos aren't ours to copy. */
export function downloadUrl(src: string): string | null {
  let url: URL;
  try {
    url = new URL(src.startsWith('//') ? `https:${src}` : src);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (
    host === 'anlantawan.wordpress.com' ||
    (/^i\d\.wp\.com$/.test(host) && url.pathname.includes('anlantawan'))
  ) {
    // WordPress resizes on request; 1600px wide is plenty and keeps files small.
    return `${url.origin}${url.pathname}?w=${MAX_WIDTH}`;
  }
  if (host.endsWith('googleusercontent.com') || host.endsWith('fbcdn.net')) return url.href;
  return null;
}

function sniffMime(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
    }),
  );
}

interface Downloaded {
  file: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
}

/** Downloads a photo once and caches it; later runs read the cached copy. */
async function download(url: string): Promise<Downloaded | null> {
  const id = createHash('sha1').update(url).digest('hex').slice(0, 16);
  const cached = [...Object.values(EXT)]
    .map((e) => new URL(`${id}.${e}`, IMAGES))
    .find((u) => existsSync(u));
  let data: Uint8Array;
  if (cached) data = readFileSync(cached);
  else {
    const res = await fetch(url, { redirect: 'follow' }).catch(() => null);
    if (!res?.ok) return null;
    data = new Uint8Array(await res.arrayBuffer());
  }
  const mime = sniffMime(data);
  if (!mime) return null;
  const file = new URL(`${id}.${EXT[mime]}`, IMAGES);
  if (!cached) writeFileSync(file, data);
  let width: number | null = null;
  let height: number | null = null;
  try {
    ({ width, height } = imageSize(data));
  } catch {}
  return { file: fileURLToPath(file), mime, bytes: data.byteLength, width, height };
}

// --- Plan -----------------------------------------------------------------
const posts = JSON.parse(readFileSync(new URL('wp-posts.json', OUT), 'utf8')) as WpPost[];
const aliases = JSON.parse(
  readFileSync(new URL('./aliases.json', import.meta.url), 'utf8'),
) as Record<string, string>;
const { stories, people } = planImport(posts, aliases);
console.log(`Planned ${stories.length} stories.`);

// --- Photos ---------------------------------------------------------------
const media = new Map<string, StoredImage & { file: string }>();
const keyFor = new Map<FoundImage, string>();
const dropped: string[] = [];
const jobs = stories.flatMap((s) =>
  [...(s.cover ? [s.cover] : []), ...s.images].map((img) => ({ s, img })),
);

await pool(jobs, 6, async ({ s, img }) => {
  const url = downloadUrl(img.src);
  const got = url ? await download(url) : null;
  if (!got) {
    dropped.push(`${s.url} ← ${img.src}`);
    return;
  }
  const base =
    slugify(
      decodeURIComponent(new URL(url as string).pathname.split('/').pop() ?? '').replace(
        /\.[a-z0-9]+$/i,
        '',
      ),
    ) || 'photo';
  const key = `wp/${s.wpId}/${base}.${EXT[got.mime]}`;
  keyFor.set(img, key);
  if (!media.has(key)) {
    media.set(key, { key, ...got, alt: img.node.attrs.alt, caption: img.node.attrs.caption });
  }
});
console.log(`${media.size} photos ready, ${dropped.length} skipped.`);

// Point image nodes at their stored files; photos that couldn't be copied leave the story.
for (const s of stories) {
  for (const img of s.images) img.node.attrs.key = keyFor.get(img) ?? null;
  s.doc.content = s.doc.content.filter((b) => b.type !== 'image' || b.attrs.key !== null);
}

// --- Upload to R2 ---------------------------------------------------------
const uploadedFile = new URL(`uploaded-${target.slice(2)}.json`, OUT);
const uploaded = new Set<string>(
  existsSync(uploadedFile) ? JSON.parse(readFileSync(uploadedFile, 'utf8')) : [],
);
const toUpload = [...media.values()].filter((m) => !uploaded.has(m.key));
let done = 0;
// Local storage is a single SQLite file that locks under parallel writes; R2 itself doesn't.
await pool(toUpload, target === '--local' ? 1 : 4, async (m) => {
  await run(WRANGLER, [
    'r2',
    'object',
    'put',
    `${BUCKET}/${m.key}`,
    '--file',
    m.file,
    '--content-type',
    m.mime,
    target,
  ]);
  uploaded.add(m.key);
  if (++done % 25 === 0) {
    console.log(`Uploaded ${done} of ${toUpload.length}`);
    writeFileSync(uploadedFile, JSON.stringify([...uploaded]));
  }
});
writeFileSync(uploadedFile, JSON.stringify([...uploaded]));
console.log(`Uploads done (${toUpload.length} new).`);

// --- Database -------------------------------------------------------------
const sql: string[] = [];
for (const m of media.values()) sql.push(mediaSql(m));
const personSlug = new Map<string, string>();
for (const name of new Set(people.canonical.values())) {
  personSlug.set(name, slugify(name));
  sql.push(personSql(name, slugify(name)));
}
const tagNames = new Set(stories.flatMap((s) => s.tags));
for (const t of tagNames) sql.push(tagSql(t, slugify(t)));
for (const s of stories) {
  const seen = new Set<string>();
  const authors = s.credits
    .map((c) => ({
      personSlug: personSlug.get(people.canonical.get(c.name) ?? c.name) ?? slugify(c.name),
      role: c.role,
    }))
    .filter((a) => {
      const k = `${a.personSlug}:${a.role}`;
      return !seen.has(k) && seen.add(k);
    });
  sql.push(
    ...storySql(s, {
      coverKey: s.cover ? (keyFor.get(s.cover) ?? null) : null,
      bodyKeys: s.images.map((i) => keyFor.get(i)).filter((k): k is string => Boolean(k)),
      authors,
      tagSlugs: s.tags.map(slugify),
    }),
  );
}
// Spellings that were merged into someone else (aliases.json, or matched automatically).
const mergedAway = [...people.canonical]
  .filter(([spelling, name]) => spelling !== name)
  .map(([s]) => slugify(s));
sql.push(...orphanPeopleSql(mergedAway.filter((slug) => ![...personSlug.values()].includes(slug))));
const sqlFile = new URL(`import-${target.slice(2)}.sql`, OUT);
writeFileSync(sqlFile, `${sql.join('\n')}\n`);
writeFileSync(new URL('import-skipped-photos.txt', OUT), `${dropped.join('\n')}\n`);
console.log(`Running ${sql.length} statements against the ${target.slice(2)} database…`);
const { stdout } = await run(
  WRANGLER,
  ['d1', 'execute', 'an-lantawan', target, '--file', fileURLToPath(sqlFile), '--yes'],
  {
    maxBuffer: 64 * 1024 * 1024,
  },
);
console.log(
  stdout
    .split('\n')
    .filter((l) => /executed|error/i.test(l))
    .join('\n'),
);
console.log('Import finished.');
