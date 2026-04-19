ALTER TABLE public.companion_chat_threads
ADD COLUMN IF NOT EXISTS message_count integer NOT NULL DEFAULT 0;

UPDATE public.companion_chat_threads AS threads
SET message_count = counts.message_count
FROM (
  SELECT
    session_id,
    surface,
    COUNT(*)::integer AS message_count
  FROM public.companion_chats
  GROUP BY session_id, surface
) AS counts
WHERE threads.session_id = counts.session_id
  AND threads.surface = counts.surface;
