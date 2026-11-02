-- Header gets About; the menu panel and footer get their groups. All editable in the admin.
INSERT INTO menu_items ("group", label, href, sort) VALUES ('header', 'About', '/about', 5);
--> statement-breakpoint
INSERT INTO menu_items ("group", label, section_id, sort) VALUES
  ('sections', 'News', 1, 1),
  ('sections', 'Opinion', 2, 2),
  ('sections', 'Features', 3, 3),
  ('sections', 'Sports', 4, 4);
--> statement-breakpoint
INSERT INTO menu_items ("group", label, href, sort) VALUES
  ('publication', 'About', '/about', 1),
  ('publication', 'Editorial board', '/about#editorial-board', 2),
  ('publication', 'Print issues', '/print', 3),
  ('publication', 'Contact', '/about#contact', 4),
  ('write', 'Write to Sumat', '/sumat', 1),
  ('write', 'Published letters', '/letters', 2);
--> statement-breakpoint
INSERT INTO settings (key, value) VALUES ('site.tagline', '"Liberating the critical and creative mind."');
--> statement-breakpoint
UPDATE sections SET description = 'Reporting on Leyte Normal University: the administration, the student council, classes, board exams and sports.' WHERE slug = 'news';
--> statement-breakpoint
UPDATE sections SET description = 'The views of the editorial board and our columnists. Kept apart from news reporting, always.' WHERE slug = 'opinion';
--> statement-breakpoint
UPDATE sections SET description = 'Profiles, campus life and the longer stories behind the news.' WHERE slug = 'features';
--> statement-breakpoint
UPDATE sections SET description = 'Varsity games, Sportsfest and the athletes behind the scores.' WHERE slug = 'sports';
