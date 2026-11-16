import type { z } from 'zod';
import type { FormValues } from '../core/forms';
import { parseForm } from '../core/forms';
import { clearResult, recordResult } from '../core/sportsfest/bracket';
import { roundName } from '../core/sportsfest/display';
import { standings } from '../core/sportsfest/standings';
import { db } from '../db/client';
import {
  addGroupMatch,
  applyBracket,
  bracketKey,
  type Competition,
  deleteMatch,
  deleteRound,
  getCompetition,
  recordGroupResult,
  toBracket,
  updateMatchDetails,
} from '../db/queries/admin/sportsfest';
import { matchForm } from './admin-schemas';

/**
 * Matches on an event's admin page: reading many matches from one form, saving each one,
 * and laying out a category's stages as elims rounds or bracket columns.
 */

/** The elims (round-robin) table of a category, and how many of its matches are left. */
export function elimsTable(comp: Competition) {
  const group = comp.stages.find((s) => s.kind === 'group');
  if (!group) return null;
  const mine = comp.matches.filter((m) => m.stageId === group.id);
  const played = mine.flatMap((m) =>
    m.status === 'done' &&
    m.homeTribuId !== null &&
    m.awayTribuId !== null &&
    m.homeScore !== null &&
    m.awayScore !== null
      ? [
          {
            homeTribuId: m.homeTribuId,
            awayTribuId: m.awayTribuId,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
          },
        ]
      : [],
  );
  const rows = standings(
    comp.entries.filter((e) => e.stageId === group.id).map((e) => e.tribuId),
    played,
    { win: group.pointsWin, draw: group.pointsDraw, loss: group.pointsLoss },
  );
  const unplayed = mine.filter((m) => m.status !== 'done' && m.status !== 'cancelled').length;
  return { rows, unplayed };
}

export const MATCH_FIELDS = [
  'homeScore',
  'awayScore',
  'status',
  'startsAt',
  'venue',
  'homeTribuId',
  'awayTribuId',
] as const;
export type MatchInput = z.output<typeof matchForm>;
type MatchRow = Awaited<ReturnType<typeof getCompetition>>['matches'][number];
const time = (d: Date | null) => d?.getTime() ?? null;

/** Whether the form changes anything about a match, so untouched ones are left alone. */
export function matchChanged(m: MatchRow, d: MatchInput) {
  const decided = m.status === 'done' || m.status === 'bye';
  return (
    d.homeScore !== m.homeScore ||
    d.awayScore !== m.awayScore ||
    time(d.startsAt) !== time(m.startsAt) ||
    (d.venue ?? null) !== (m.venue ?? null) ||
    (!decided &&
      (d.status !== m.status || d.homeTribuId !== m.homeTribuId || d.awayTribuId !== m.awayTribuId))
  );
}

/**
 * Saves one match: its time, place and status, its tribus while no result has decided it,
 * then its score. A bracket score sends the winner (and loser) on; clearing both scores
 * undoes a result. Returns what went wrong, or null.
 */
export async function applyMatch(categoryId: number, before: MatchRow, d: MatchInput) {
  const matchId = before.id;
  const comp = await getCompetition(db, categoryId);
  const match = comp.matches.find((m) => m.id === matchId);
  if (!match) {
    return 'This match is no longer here. Reload the page.';
  }
  const key = bracketKey(comp, match.id);
  const decided = match.status === 'done' || match.status === 'bye';
  // Compared with the match as the form showed it: an earlier result in the same save may
  // have just sent a winner here, and an untouched "To be decided" mustn't undo that.
  const teamsChanged =
    !decided && (d.homeTribuId !== before.homeTribuId || d.awayTribuId !== before.awayTribuId);
  if (teamsChanged && d.homeTribuId !== null && d.homeTribuId === d.awayTribuId)
    return 'a tribu can’t play itself.';
  const keepStatus = d.status === 'done' || d.status === 'bye' ? undefined : d.status;
  await updateMatchDetails(db, match.id, {
    startsAt: d.startsAt,
    venue: d.venue,
    ...(keepStatus && !decided ? { status: keepStatus } : {}),
    ...(teamsChanged ? { homeTribuId: d.homeTribuId, awayTribuId: d.awayTribuId } : {}),
  });
  const scored = d.homeScore !== null && d.awayScore !== null;
  if (key) {
    const fresh = await getCompetition(db, categoryId);
    const bracket = toBracket(fresh);
    const r = scored
      ? recordResult(bracket, key, d.homeScore as number, d.awayScore as number)
      : match.status === 'done'
        ? clearResult(bracket, key)
        : null;
    if (r && !r.ok) return r.error;
    if (r) await applyBracket(db, fresh, r.value);
  } else if (scored || match.status === 'done') {
    await recordGroupResult(db, match.id, d.homeScore, d.awayScore);
  }
  return null;
}

/** A category's stages with their rounds, titled the way the admin shows them. */
export function buildStageViews(comp: Competition) {
  return comp.stages.map((st) => {
    const mine = comp.matches.filter((m) => m.stageId === st.id);
    const rounds = [...new Set(mine.map((m) => m.round))].sort((a, b) => a - b);
    return {
      stage: st,
      rounds: rounds.map((round, i) => ({
        round,
        title:
          st.kind === 'group'
            ? `Round ${round}`
            : mine.length === 1
              ? st.name
              : st.kind === 'single'
                ? roundName(i + 1, rounds.length).title
                : `Round ${i + 1}`,
        matches: mine.filter((m) => m.round === round),
      })),
    };
  });
}

type Outcome =
  | { ok: true; stageId: number; summary: string | null; done: 'saved' | 'deleted' }
  | { ok: false; problem: string };

const one = (form: FormValues, key: string) => {
  const v = form[key];
  return (Array.isArray(v) ? v[0] : v) ?? '';
};

/**
 * Handles a round's or a bracket's form: Delete match, Delete round, or saving every match
 * in it. Every match is checked before any is saved, so one typo never half-saves a round.
 */
export async function saveMatchesForm(
  form: FormValues,
  categoryId: number,
  name: (id: number | null) => string,
): Promise<Outcome> {
  const comp = await getCompetition(db, categoryId);
  const elims = new Set(comp.stages.filter((st) => st.kind === 'group').map((st) => st.id));

  const deleteId = Number(one(form, 'deleteMatch'));
  if (deleteId) {
    const m = comp.matches.find((x) => x.id === deleteId);
    if (!m || !elims.has(m.stageId)) {
      return {
        ok: false,
        problem: 'Only elims matches can be deleted one by one. Reload the page.',
      };
    }
    await deleteMatch(db, m.id);
    return { ok: true, stageId: m.stageId, summary: 'Deleted a match', done: 'deleted' };
  }

  const roundToDelete = one(form, 'deleteRound');
  if (roundToDelete) {
    const [stageId, round] = roundToDelete.split(':').map(Number);
    if (
      !elims.has(stageId) ||
      !comp.matches.some((m) => m.stageId === stageId && m.round === round)
    ) {
      return { ok: false, problem: 'That round is no longer here. Reload the page.' };
    }
    await deleteRound(db, stageId, round);
    return { ok: true, stageId, summary: `Deleted round ${round}`, done: 'deleted' };
  }

  const ids = ([] as string[]).concat(form.ids ?? []).map(Number);
  const parsed: { match: MatchRow; d: MatchInput }[] = [];
  for (const m of comp.matches.filter((x) => ids.includes(x.id))) {
    const values = Object.fromEntries(MATCH_FIELDS.map((f) => [f, form[`${f}_${m.id}`] ?? '']));
    const r = parseForm(matchForm, values);
    if (!r.ok) {
      const why = Object.values(r.errors)[0] ?? 'check the match.';
      return { ok: false, problem: `${name(m.homeTribuId)} v ${name(m.awayTribuId)}: ${why}` };
    }
    parsed.push({ match: m, d: r.data });
  }
  if (!parsed.length)
    return { ok: false, problem: 'Those matches are no longer here. Reload the page.' };

  // Earlier rounds first, so a winner reaches the next match before its score is read.
  parsed.sort((a, b) => a.match.round - b.match.round || a.match.position - b.match.position);
  let changed = 0;
  for (const { match, d } of parsed) {
    if (!matchChanged(match, d)) continue;
    const problem = await applyMatch(categoryId, match, d);
    if (problem) {
      const saved = changed ? ' The matches before it were saved.' : '';
      return {
        ok: false,
        problem: `${name(match.homeTribuId)} v ${name(match.awayTribuId)}: ${problem}${saved}`,
      };
    }
    changed++;
  }
  const summary =
    changed === 0 ? null : changed === 1 ? 'Updated a match' : `Updated ${changed} matches`;
  return { ok: true, stageId: parsed[0].match.stageId, summary, done: 'saved' };
}

/** Adds a match to an elims round, from the Add a match form. */
export async function addMatchForm(
  form: FormValues,
  categoryId: number,
  teams: readonly { id: number; name: string }[],
): Promise<{ ok: true; stageId: number; summary: string } | { ok: false; problem: string }> {
  const comp = await getCompetition(db, categoryId);
  const stage = comp.stages.find(
    (st) => st.id === Number(one(form, 'stageId')) && st.kind === 'group',
  );
  const round = Number(one(form, 'round'));
  const home = teams.find((t) => t.id === Number(one(form, 'home')));
  const away = teams.find((t) => t.id === Number(one(form, 'away')));
  if (!stage)
    return { ok: false, problem: 'Matches can be added to the elims only. Reload the page.' };
  if (!Number.isInteger(round) || round < 1 || round > 99) {
    return { ok: false, problem: 'Rounds go from 1 to 99.' };
  }
  if (!home || !away) return { ok: false, problem: 'Choose both tribus.' };
  if (home.id === away.id) return { ok: false, problem: 'A tribu can’t play itself.' };
  await addGroupMatch(db, stage.id, round, home.id, away.id);
  return {
    ok: true,
    stageId: stage.id,
    summary: `Added ${home.name} v ${away.name} to round ${round}`,
  };
}
