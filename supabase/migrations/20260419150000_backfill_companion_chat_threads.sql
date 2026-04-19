WITH session_stats AS (
  SELECT
    chats.session_id,
    chats.user_id,
    chats.companion_id,
    chats.surface,
    MIN(chats.created_at) AS created_at,
    MAX(chats.created_at) AS last_message_at,
    COUNT(*)::integer AS message_count
  FROM public.companion_chats AS chats
  GROUP BY chats.session_id, chats.user_id, chats.companion_id, chats.surface
),
session_titles AS (
  SELECT DISTINCT ON (chats.session_id, chats.user_id, chats.companion_id, chats.surface)
    chats.session_id,
    chats.user_id,
    chats.companion_id,
    chats.surface,
    chats.content AS raw_title
  FROM public.companion_chats AS chats
  ORDER BY
    chats.session_id,
    chats.user_id,
    chats.companion_id,
    chats.surface,
    CASE WHEN chats.role = 'user' THEN 0 ELSE 1 END,
    chats.created_at ASC,
    chats.id ASC
),
session_previews AS (
  SELECT DISTINCT ON (chats.session_id, chats.user_id, chats.companion_id, chats.surface)
    chats.session_id,
    chats.user_id,
    chats.companion_id,
    chats.surface,
    chats.content AS raw_preview
  FROM public.companion_chats AS chats
  ORDER BY
    chats.session_id,
    chats.user_id,
    chats.companion_id,
    chats.surface,
    chats.created_at DESC,
    chats.id DESC
),
ranked_sessions AS (
  SELECT
    stats.session_id,
    stats.user_id,
    stats.companion_id,
    stats.surface,
    CASE
      WHEN LENGTH(title_text.normalized) <= 72 THEN title_text.normalized
      ELSE RTRIM(LEFT(title_text.normalized, 69)) || '...'
    END AS title,
    CASE
      WHEN LENGTH(preview_text.normalized) <= 160 THEN preview_text.normalized
      ELSE RTRIM(LEFT(preview_text.normalized, 157)) || '...'
    END AS preview_text,
    stats.created_at,
    stats.last_message_at,
    stats.message_count,
    ROW_NUMBER() OVER (
      PARTITION BY stats.user_id, stats.companion_id, stats.surface
      ORDER BY stats.last_message_at DESC, stats.created_at DESC, stats.session_id DESC
    ) AS session_rank
  FROM session_stats AS stats
  INNER JOIN session_titles AS titles
    ON titles.session_id = stats.session_id
    AND titles.user_id = stats.user_id
    AND titles.companion_id = stats.companion_id
    AND titles.surface = stats.surface
  INNER JOIN session_previews AS previews
    ON previews.session_id = stats.session_id
    AND previews.user_id = stats.user_id
    AND previews.companion_id = stats.companion_id
    AND previews.surface = stats.surface
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      NULLIF(REGEXP_REPLACE(BTRIM(titles.raw_title), '\s+', ' ', 'g'), ''),
      'New thread'
    ) AS normalized
  ) AS title_text
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      NULLIF(REGEXP_REPLACE(BTRIM(previews.raw_preview), '\s+', ' ', 'g'), ''),
      'No messages yet.'
    ) AS normalized
  ) AS preview_text
)
INSERT INTO public.companion_chat_threads (
  session_id,
  user_id,
  companion_id,
  surface,
  title,
  preview_text,
  created_at,
  last_message_at,
  archived_at,
  message_count
)
SELECT
  ranked.session_id,
  ranked.user_id,
  ranked.companion_id,
  ranked.surface,
  ranked.title,
  ranked.preview_text,
  ranked.created_at,
  ranked.last_message_at,
  CASE WHEN ranked.session_rank = 1 THEN NULL ELSE ranked.last_message_at END AS archived_at,
  ranked.message_count
FROM ranked_sessions AS ranked
ON CONFLICT (session_id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  companion_id = EXCLUDED.companion_id,
  surface = EXCLUDED.surface,
  title = EXCLUDED.title,
  preview_text = EXCLUDED.preview_text,
  created_at = EXCLUDED.created_at,
  last_message_at = EXCLUDED.last_message_at,
  archived_at = EXCLUDED.archived_at,
  message_count = EXCLUDED.message_count;
