/**
 * Step 1: download every post from anlantawan.wordpress.com through the public
 * WordPress.com API and save them to scripts/out/wp-posts.json. No login needed.
 *
 *   node scripts/import-wordpress/fetch.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const SITE = 'anlantawan.wordpress.com';
const FIELDS =
  'ID,date,modified,title,slug,URL,content,excerpt,categories,tags,featured_image,format';
const OUT = new URL('../out/wp-posts.json', import.meta.url);

interface Page {
  found: number;
  posts: unknown[];
  meta: { next_page?: string };
}

const posts: unknown[] = [];
let pageHandle: string | undefined;
let total: number | undefined;
do {
  const url = new URL(`https://public-api.wordpress.com/rest/v1.1/sites/${SITE}/posts`);
  url.searchParams.set('number', '100');
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('order', 'DESC');
  if (pageHandle) url.searchParams.set('page_handle', pageHandle);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WordPress API ${res.status}: ${await res.text()}`);
  const page = (await res.json()) as Page;
  posts.push(...page.posts);
  total ??= page.found;
  console.log(`Fetched ${posts.length} of ${total}`);
  pageHandle = page.meta.next_page;
} while (pageHandle);

mkdirSync(new URL('.', OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(posts, null, 2));
console.log(`Saved ${posts.length} posts to scripts/out/wp-posts.json`);
