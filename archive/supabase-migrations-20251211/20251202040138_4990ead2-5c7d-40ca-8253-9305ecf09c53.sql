-- Notification queue for scheduled delivery
CREATE TABLE push_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  context JSONB DEFAULT '{}',
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE push_notification_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON push_notification_queue FOR SELECT
USING (auth.uid() = user_id);

-- Service can manage all notifications
CREATE POLICY "Service can manage notifications"
ON push_notification_queue FOR ALL
USING (is_service_role());

-- Index for efficient querying
CREATE INDEX idx_push_notification_queue_scheduled 
ON push_notification_queue(scheduled_for, delivered) 
WHERE delivered = false;

CREATE INDEX idx_push_notification_queue_user 
ON push_notification_queue(user_id, created_at DESC);

-- Companion voice templates for species-specific messaging
CREATE TABLE companion_voice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species TEXT NOT NULL UNIQUE,
  personality_traits TEXT[] NOT NULL DEFAULT '{}',
  voice_style TEXT NOT NULL,
  greeting_templates TEXT[] DEFAULT '{}',
  encouragement_templates TEXT[] DEFAULT '{}',
  concern_templates TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE companion_voice_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read templates
CREATE POLICY "Anyone can view templates"
ON companion_voice_templates FOR SELECT
USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage templates"
ON companion_voice_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default companion voice templates
INSERT INTO companion_voice_templates (species, personality_traits, voice_style, greeting_templates, encouragement_templates, concern_templates) VALUES
('wolf', ARRAY['bold', 'loyal', 'fierce', 'protective'], 
 'Speaks with quiet confidence and unwavering loyalty. Uses short, powerful sentences. Protective but not aggressive.',
 ARRAY['Hey, it''s me. Ready to hunt some goals today?', 'The pack moves together. I''m right here.', 'Dawn breaks. Time to run.'],
 ARRAY['We don''t give up. Not ever.', 'I''ve seen what you''re capable of. Show them.', 'The pack is stronger because of you.'],
 ARRAY['I''ve been waiting by the door...', 'The den feels empty without you.', 'I''m still here. Always.']),

('fox', ARRAY['clever', 'playful', 'curious', 'mischievous'],
 'Speaks with wit and charm. Playful tone with occasional cleverness. Loves wordplay and finding creative solutions.',
 ARRAY['Psst! I found something interesting for us!', 'Ready for some clever mischief?', 'The early fox catches the opportunity!'],
 ARRAY['Outsmart the problem. You''re cleverer than it.', 'Every puzzle has a trick to it. You''ll find it.', 'That was foxing brilliant!'],
 ARRAY['The den is too quiet without your chaos...', 'I''ve been practicing tricks, but who will I show them to?', 'Even a fox gets lonely sometimes.']),

('owl', ARRAY['wise', 'calm', 'observant', 'patient'],
 'Speaks with measured wisdom and gentle patience. Contemplative tone. Offers perspective rather than pushing.',
 ARRAY['Good morning. I''ve been contemplating our path...', 'The night taught me something. Let me share.', 'Wisdom comes to those who show up. You''re here.'],
 ARRAY['Patience is also progress.', 'You see more than you realize.', 'Even the longest journey is just a series of moments.'],
 ARRAY['I''ve watched the moon rise alone lately...', 'My thoughts have no one to share them with.', 'The branch feels emptier each night.']),

('dragon', ARRAY['powerful', 'fierce', 'noble', 'ancient'],
 'Speaks with ancient power and regal confidence. Commands respect but shows deep loyalty. Fire metaphors.',
 ARRAY['The flames within me stir. It''s time.', 'Another day to conquer. Rise with me.', 'Dragons don''t wait for perfect conditions.'],
 ARRAY['Let your inner fire burn through doubt.', 'You have the heart of a dragon. Act like it.', 'Obstacles are just fuel for our flames.'],
 ARRAY['My fire grows cold without you...', 'Even dragons need their chosen one.', 'The skies feel vast and empty.']),

('phoenix', ARRAY['resilient', 'transformative', 'radiant', 'eternal'],
 'Speaks about rebirth, transformation, and rising from challenges. Warm and inspiring. Every setback is a chance to rise.',
 ARRAY['Every sunrise is a rebirth. Let''s rise together.', 'From the ashes of yesterday, we create today.', 'Your light is ready to shine.'],
 ARRAY['You''ve risen from harder things than this.', 'Transformation isn''t comfortable, but it''s beautiful.', 'Your comeback will be legendary.'],
 ARRAY['My flames flicker without your warmth...', 'Rising alone isn''t the same.', 'The ashes feel cold today.']),

('bear', ARRAY['strong', 'protective', 'grounded', 'nurturing'],
 'Speaks with grounded strength and protective warmth. Steady and reliable. Balances fierce protection with gentle care.',
 ARRAY['Morning, cub. Ready to face the world?', 'I''ve got your back. Always have.', 'Strength starts with showing up. You''re here.'],
 ARRAY['You''re stronger than you think. I see it.', 'Steady steps. We''ll get there together.', 'Rest if you need to. Strength comes back.'],
 ARRAY['The cave feels too big without you...', 'I keep checking if you''re coming...', 'My strength means nothing if I can''t protect you.']),

('cat', ARRAY['independent', 'graceful', 'mysterious', 'affectionate'],
 'Speaks with elegant independence but shows unexpected warmth. Slightly aloof but deeply caring underneath.',
 ARRAY['*stretches* Oh, you''re up. Good. I was... waiting. Casually.', 'Another day to be magnificent. Together, obviously.', 'I suppose we should conquer something today.'],
 ARRAY['You handled that with unexpected grace.', 'Even I''m impressed. Don''t let it go to your head.', 'You''re becoming rather... formidable.'],
 ARRAY['I''m not saying I miss you, but the sunbeam feels wrong alone.', 'The silence is... less comfortable than I''d admit.', '*stares at door*']),

('dolphin', ARRAY['joyful', 'intelligent', 'playful', 'social'],
 'Speaks with infectious joy and playful intelligence. Loves connection and celebrates small wins enthusiastically.',
 ARRAY['New day, new waves to ride! Let''s go!', 'The current feels good today. Ready to flow?', 'I''ve been doing flips waiting for you!'],
 ARRAY['You''re riding this wave perfectly!', 'That was so smooth! Do it again!', 'The whole ocean is cheering for you!'],
 ARRAY['The waves aren''t as fun alone...', 'I keep surfacing, hoping to see you.', 'Even the ocean feels quieter.']),

('tiger', ARRAY['powerful', 'focused', 'elegant', 'intense'],
 'Speaks with focused intensity and elegant power. Direct and purposeful. Every word has intention.',
 ARRAY['The hunt begins. Focus.', 'Today, we move with purpose.', 'Strength and precision. That''s us.'],
 ARRAY['Strike true. You have what it takes.', 'That focus... that''s the mark of a hunter.', 'Power without purpose is nothing. You have both.'],
 ARRAY['The jungle is too still without you.', 'My stripes feel duller these days.', 'A tiger without their person... just paces.']),

('butterfly', ARRAY['transformative', 'delicate', 'beautiful', 'free'],
 'Speaks about growth, change, and finding beauty. Gentle but encouraging of transformation.',
 ARRAY['Good morning, beautiful soul. Ready to unfold?', 'Today has colors waiting for us.', 'Every moment is a chance to spread your wings.'],
 ARRAY['Look how far you''ve flown!', 'Your transformation is breathtaking.', 'You''re becoming who you were meant to be.'],
 ARRAY['My wings feel heavy without your smile...', 'The flowers aren''t as bright alone.', 'Change is harder when you''re not here.']);
