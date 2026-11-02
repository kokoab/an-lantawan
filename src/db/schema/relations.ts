import { relations } from 'drizzle-orm';
import {
  issues,
  media,
  people,
  sections,
  staffTerms,
  stories,
  storyAuthors,
  storyMedia,
  storyTags,
  storyVersions,
  tags,
} from './publishing';
import { editors, sessions } from './site';
import {
  categories,
  events,
  matches,
  matchSets,
  placements,
  sportsfests,
  sportsfestTribus,
  stageEntries,
  stages,
  storyEvents,
  tribus,
} from './sportsfest';
import { sumatMessages, sumatPrompts } from './sumat';

export const peopleRelations = relations(people, ({ one, many }) => ({
  photo: one(media, { fields: [people.photoId], references: [media.id] }),
  terms: many(staffTerms),
  credits: many(storyAuthors),
}));

export const staffTermsRelations = relations(staffTerms, ({ one }) => ({
  person: one(people, { fields: [staffTerms.personId], references: [people.id] }),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  parent: one(sections, {
    fields: [sections.parentId],
    references: [sections.id],
    relationName: 'subsections',
  }),
  children: many(sections, { relationName: 'subsections' }),
  stories: many(stories),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  creditPerson: one(people, { fields: [media.creditPersonId], references: [people.id] }),
  uploadedBy: one(editors, { fields: [media.uploadedBy], references: [editors.id] }),
  usedIn: many(storyMedia),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
  section: one(sections, { fields: [stories.sectionId], references: [sections.id] }),
  cover: one(media, { fields: [stories.coverId], references: [media.id] }),
  sourceMessage: one(sumatMessages, {
    fields: [stories.sourceMessageId],
    references: [sumatMessages.id],
  }),
  authors: many(storyAuthors),
  tags: many(storyTags),
  media: many(storyMedia),
  versions: many(storyVersions),
  events: many(storyEvents),
}));

export const storyAuthorsRelations = relations(storyAuthors, ({ one }) => ({
  story: one(stories, { fields: [storyAuthors.storyId], references: [stories.id] }),
  person: one(people, { fields: [storyAuthors.personId], references: [people.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({ stories: many(storyTags) }));

export const storyTagsRelations = relations(storyTags, ({ one }) => ({
  story: one(stories, { fields: [storyTags.storyId], references: [stories.id] }),
  tag: one(tags, { fields: [storyTags.tagId], references: [tags.id] }),
}));

export const storyMediaRelations = relations(storyMedia, ({ one }) => ({
  story: one(stories, { fields: [storyMedia.storyId], references: [stories.id] }),
  media: one(media, { fields: [storyMedia.mediaId], references: [media.id] }),
}));

export const storyVersionsRelations = relations(storyVersions, ({ one }) => ({
  story: one(stories, { fields: [storyVersions.storyId], references: [stories.id] }),
  savedBy: one(editors, { fields: [storyVersions.savedBy], references: [editors.id] }),
}));

export const issuesRelations = relations(issues, ({ one }) => ({
  pdf: one(media, { fields: [issues.pdfId], references: [media.id], relationName: 'issuePdf' }),
  cover: one(media, {
    fields: [issues.coverId],
    references: [media.id],
    relationName: 'issueCover',
  }),
}));

export const sumatPromptsRelations = relations(sumatPrompts, ({ many }) => ({
  messages: many(sumatMessages),
}));

export const sumatMessagesRelations = relations(sumatMessages, ({ one }) => ({
  prompt: one(sumatPrompts, { fields: [sumatMessages.promptId], references: [sumatPrompts.id] }),
  letter: one(stories, { fields: [sumatMessages.id], references: [stories.sourceMessageId] }),
}));

export const tribusRelations = relations(tribus, ({ one, many }) => ({
  logo: one(media, { fields: [tribus.logoId], references: [media.id] }),
  sportsfests: many(sportsfestTribus),
  placements: many(placements),
}));

export const sportsfestsRelations = relations(sportsfests, ({ many }) => ({
  tribus: many(sportsfestTribus),
  events: many(events),
}));

export const sportsfestTribusRelations = relations(sportsfestTribus, ({ one }) => ({
  sportsfest: one(sportsfests, {
    fields: [sportsfestTribus.sportsfestId],
    references: [sportsfests.id],
  }),
  tribu: one(tribus, { fields: [sportsfestTribus.tribuId], references: [tribus.id] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  sportsfest: one(sportsfests, { fields: [events.sportsfestId], references: [sportsfests.id] }),
  categories: many(categories),
  stories: many(storyEvents),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  event: one(events, { fields: [categories.eventId], references: [events.id] }),
  placements: many(placements),
  stages: many(stages),
}));

export const placementsRelations = relations(placements, ({ one }) => ({
  category: one(categories, { fields: [placements.categoryId], references: [categories.id] }),
  tribu: one(tribus, { fields: [placements.tribuId], references: [tribus.id] }),
}));

export const stagesRelations = relations(stages, ({ one, many }) => ({
  category: one(categories, { fields: [stages.categoryId], references: [categories.id] }),
  entries: many(stageEntries),
  matches: many(matches),
}));

export const stageEntriesRelations = relations(stageEntries, ({ one }) => ({
  stage: one(stages, { fields: [stageEntries.stageId], references: [stages.id] }),
  tribu: one(tribus, { fields: [stageEntries.tribuId], references: [tribus.id] }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  stage: one(stages, { fields: [matches.stageId], references: [stages.id] }),
  home: one(tribus, {
    fields: [matches.homeTribuId],
    references: [tribus.id],
    relationName: 'home',
  }),
  away: one(tribus, {
    fields: [matches.awayTribuId],
    references: [tribus.id],
    relationName: 'away',
  }),
  winnerTo: one(matches, {
    fields: [matches.winnerToMatchId],
    references: [matches.id],
    relationName: 'winnerTo',
  }),
  loserTo: one(matches, {
    fields: [matches.loserToMatchId],
    references: [matches.id],
    relationName: 'loserTo',
  }),
  sets: many(matchSets),
}));

export const matchSetsRelations = relations(matchSets, ({ one }) => ({
  match: one(matches, { fields: [matchSets.matchId], references: [matches.id] }),
}));

export const storyEventsRelations = relations(storyEvents, ({ one }) => ({
  story: one(stories, { fields: [storyEvents.storyId], references: [stories.id] }),
  event: one(events, { fields: [storyEvents.eventId], references: [events.id] }),
}));

export const editorsRelations = relations(editors, ({ many }) => ({ sessions: many(sessions) }));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  editor: one(editors, { fields: [sessions.editorId], references: [editors.id] }),
}));
