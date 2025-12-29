-- Remove all duplicate questionnaire_responses, keeping only one per (user_id, question_id)
-- Uses ctid to handle cases where created_at is also identical
DELETE FROM public.questionnaire_responses
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM public.questionnaire_responses
  GROUP BY user_id, question_id
);

-- Now add the unique constraint
ALTER TABLE public.questionnaire_responses 
ADD CONSTRAINT questionnaire_responses_user_question_unique 
UNIQUE (user_id, question_id);