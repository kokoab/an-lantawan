-- Starting content. Everything here is editable in the admin afterwards.
INSERT INTO sections (id, name, slug, sort) VALUES
  (1, 'News', 'news', 1),
  (2, 'Opinion', 'opinion', 2),
  (3, 'Features', 'features', 3),
  (4, 'Sports', 'sports', 4);
--> statement-breakpoint
INSERT INTO sections (name, slug, parent_id, sort) VALUES ('Sci-Tech', 'sci-tech', 3, 1);
--> statement-breakpoint
INSERT INTO menu_items ("group", label, section_id, sort) VALUES
  ('header', 'News', 1, 1),
  ('header', 'Opinion', 2, 2),
  ('header', 'Features', 3, 3),
  ('header', 'Sports', 4, 4);
--> statement-breakpoint
INSERT INTO settings (key, value) VALUES
  ('site.name', '"An Lantawan"'),
  ('site.description', '"The official student publication of Leyte Normal University, Tacloban City."'),
  ('site.facebook_url', '"https://www.facebook.com/AnLantawanLNU"'),
  ('sumat.max_length', '500');
--> statement-breakpoint
INSERT INTO sumat_prompts (text, opens_at) VALUES ('What do you want to say?', unixepoch());
