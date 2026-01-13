-- Reassign all content from Darius to Eli and from Solace to Elizabeth
-- Darius ID: a3e66e5b-4e9c-4a1d-b229-dd7e6c843f94 -> Eli ID: ac39505d-3373-41a2-9e1d-30d44650921c
-- Solace ID: 3d20090f-f19f-4cf8-899d-b318c9af5a81 -> Elizabeth ID: 66d0b7e0-215c-4c6c-b091-33c217de7fbb

-- Update profiles
UPDATE profiles SET selected_mentor_id = 'ac39505d-3373-41a2-9e1d-30d44650921c' WHERE selected_mentor_id = 'a3e66e5b-4e9c-4a1d-b229-dd7e6c843f94';
UPDATE profiles SET selected_mentor_id = '66d0b7e0-215c-4c6c-b091-33c217de7fbb' WHERE selected_mentor_id = '3d20090f-f19f-4cf8-899d-b318c9af5a81';

-- Update pep_talks
UPDATE pep_talks SET mentor_id = 'ac39505d-3373-41a2-9e1d-30d44650921c' WHERE mentor_id = 'a3e66e5b-4e9c-4a1d-b229-dd7e6c843f94';
UPDATE pep_talks SET mentor_id = '66d0b7e0-215c-4c6c-b091-33c217de7fbb' WHERE mentor_id = '3d20090f-f19f-4cf8-899d-b318c9af5a81';

-- Update videos
UPDATE videos SET mentor_id = 'ac39505d-3373-41a2-9e1d-30d44650921c' WHERE mentor_id = 'a3e66e5b-4e9c-4a1d-b229-dd7e6c843f94';
UPDATE videos SET mentor_id = '66d0b7e0-215c-4c6c-b091-33c217de7fbb' WHERE mentor_id = '3d20090f-f19f-4cf8-899d-b318c9af5a81';

-- Update quotes
UPDATE quotes SET mentor_id = 'ac39505d-3373-41a2-9e1d-30d44650921c' WHERE mentor_id = 'a3e66e5b-4e9c-4a1d-b229-dd7e6c843f94';
UPDATE quotes SET mentor_id = '66d0b7e0-215c-4c6c-b091-33c217de7fbb' WHERE mentor_id = '3d20090f-f19f-4cf8-899d-b318c9af5a81';

-- Update playlists
UPDATE playlists SET mentor_id = 'ac39505d-3373-41a2-9e1d-30d44650921c' WHERE mentor_id = 'a3e66e5b-4e9c-4a1d-b229-dd7e6c843f94';
UPDATE playlists SET mentor_id = '66d0b7e0-215c-4c6c-b091-33c217de7fbb' WHERE mentor_id = '3d20090f-f19f-4cf8-899d-b318c9af5a81';

-- Update adaptive_push_settings
UPDATE adaptive_push_settings SET mentor_id = 'ac39505d-3373-41a2-9e1d-30d44650921c' WHERE mentor_id = 'a3e66e5b-4e9c-4a1d-b229-dd7e6c843f94';
UPDATE adaptive_push_settings SET mentor_id = '66d0b7e0-215c-4c6c-b091-33c217de7fbb' WHERE mentor_id = '3d20090f-f19f-4cf8-899d-b318c9af5a81';

-- Update mentor_story_relationship
UPDATE mentor_story_relationship SET mentor_id = 'ac39505d-3373-41a2-9e1d-30d44650921c' WHERE mentor_id = 'a3e66e5b-4e9c-4a1d-b229-dd7e6c843f94';
UPDATE mentor_story_relationship SET mentor_id = '66d0b7e0-215c-4c6c-b091-33c217de7fbb' WHERE mentor_id = '3d20090f-f19f-4cf8-899d-b318c9af5a81';

-- Update morning_briefings
UPDATE morning_briefings SET mentor_id = 'ac39505d-3373-41a2-9e1d-30d44650921c' WHERE mentor_id = 'a3e66e5b-4e9c-4a1d-b229-dd7e6c843f94';
UPDATE morning_briefings SET mentor_id = '66d0b7e0-215c-4c6c-b091-33c217de7fbb' WHERE mentor_id = '3d20090f-f19f-4cf8-899d-b318c9af5a81';

-- Now delete Darius and Solace (CASCADE will handle the remaining tables)
DELETE FROM mentors WHERE slug = 'darius';
DELETE FROM mentors WHERE slug = 'solace';