/**
 * Writes scripts/out/import-report.md: where each post will go, who it credits, which
 * names were merged and which need a decision. Run it before loading.
 *
 *   node scripts/import-wordpress/report.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { planImport, type WpPost } from './transform.ts';

const posts = JSON.parse(
  readFileSync(new URL('../out/wp-posts.json', import.meta.url), 'utf8'),
) as WpPost[];
const aliases = JSON.parse(
  readFileSync(new URL('./aliases.json', import.meta.url), 'utf8'),
) as Record<string, string>;
const { stories, people } = planImport(posts, aliases);

const bySection = new Map<string, number>();
for (const s of stories)
  bySection.set(`${s.section} (${s.kind})`, (bySection.get(`${s.section} (${s.kind})`) ?? 0) + 1);

const merged = new Map<string, string[]>();
for (const [spelling, name] of people.canonical) {
  if (!merged.has(name)) merged.set(name, []);
  if (spelling !== name) merged.get(name)?.push(spelling);
}

const lines = [
  '# WordPress import report',
  '',
  `${stories.length} stories, ${stories.filter((s) => s.credits.some((c) => c.role === 'writer')).length} with a writer, ${stories.filter((s) => s.cover).length} with a cover photo, ${stories.reduce((n, s) => n + s.images.length, 0)} photos in story bodies.`,
  '',
  '## Sections',
  ...[...bySection].sort().map(([k, v]) => `- ${k}: ${v}`),
  '',
  '## People',
  `${merged.size} people.`,
  '',
  '### Spellings merged into one person',
  ...[...merged].filter(([, v]) => v.length).map(([k, v]) => `- **${k}** ← ${v.join(', ')}`),
  '',
  '### Need a decision (add to aliases.json if they are the same person)',
  ...people.review.map((r) => `- ${r.a} / ${r.b} (${r.why})`),
  '',
  '## Filed under News because WordPress had no section for them',
  ...stories.filter((s) => s.needsReview).map((s) => `- ${s.title} (${s.url})`),
  '',
  '## No writer found',
  ...stories
    .filter((s) => !s.credits.some((c) => c.role === 'writer') && s.kind !== 'editorial')
    .map((s) => `- ${s.title} (${s.url})`),
];
writeFileSync(new URL('../out/import-report.md', import.meta.url), `${lines.join('\n')}\n`);
console.log(lines.slice(0, 12).join('\n'));
console.log('Full report: scripts/out/import-report.md');
