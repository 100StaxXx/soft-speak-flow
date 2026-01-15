-- Delete from all tables referencing the mentors being removed
DELETE FROM pep_talks WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM videos WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM quotes WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM playlists WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM hero_slides WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM daily_messages WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM mentor_chats WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM audio_clips WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM lessons WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM written_mentors WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM visual_mentors WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM pep_talk_mentors WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM lesson_mentors WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM adaptive_push_settings WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM mentor_story_relationship WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));
DELETE FROM morning_briefings WHERE mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));

-- Set affected users' selected_mentor_id to null
UPDATE profiles SET selected_mentor_id = NULL WHERE selected_mentor_id IN (SELECT id FROM mentors WHERE slug IN ('kai', 'lumi', 'nova'));

-- Finally delete the mentors
DELETE FROM mentors WHERE slug IN ('kai', 'lumi', 'nova');