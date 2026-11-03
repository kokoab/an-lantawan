-- Whoever signs in with the publication account picks their name from staff who can edit.
-- Francis is the first; he adds everyone else in the admin under Staff.
INSERT OR IGNORE INTO people (name, slug, can_edit) VALUES ('Francis Angelo Batiancela', 'francis-angelo-batiancela', 1);
UPDATE people SET can_edit = 1 WHERE slug = 'francis-angelo-batiancela';
