-- Full-text search over published stories. Kept in sync by triggers, so every way a story
-- is saved (admin, import, console) updates the index. The body's text is read out of the
-- story document's "text" nodes.
CREATE VIRTUAL TABLE stories_fts USING fts5(title, dek, body, tokenize = 'unicode61 remove_diacritics 2');
--> statement-breakpoint
INSERT INTO stories_fts (rowid, title, dek, body)
  SELECT id, title, coalesce(dek, ''), coalesce((SELECT group_concat(value, ' ') FROM json_tree(stories.body) WHERE key = 'text'), '')
  FROM stories;
--> statement-breakpoint
CREATE TRIGGER stories_fts_insert AFTER INSERT ON stories BEGIN
  INSERT INTO stories_fts (rowid, title, dek, body)
  VALUES (new.id, new.title, coalesce(new.dek, ''), coalesce((SELECT group_concat(value, ' ') FROM json_tree(new.body) WHERE key = 'text'), ''));
END;
--> statement-breakpoint
CREATE TRIGGER stories_fts_update AFTER UPDATE OF title, dek, body ON stories BEGIN
  DELETE FROM stories_fts WHERE rowid = old.id;
  INSERT INTO stories_fts (rowid, title, dek, body)
  VALUES (new.id, new.title, coalesce(new.dek, ''), coalesce((SELECT group_concat(value, ' ') FROM json_tree(new.body) WHERE key = 'text'), ''));
END;
--> statement-breakpoint
CREATE TRIGGER stories_fts_delete AFTER DELETE ON stories BEGIN
  DELETE FROM stories_fts WHERE rowid = old.id;
END;
