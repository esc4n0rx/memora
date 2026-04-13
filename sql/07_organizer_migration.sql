-- ============================================================
-- Migração: novas colunas para organizer_blocks
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

ALTER TABLE public.organizer_blocks
  ADD COLUMN IF NOT EXISTS tags     TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS color    TEXT,
  ADD COLUMN IF NOT EXISTS pinned   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link     TEXT,
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Migra category → tags[0] para linhas que ainda não têm tags
UPDATE public.organizer_blocks
SET tags = ARRAY[category]
WHERE category IS NOT NULL
  AND array_length(tags, 1) IS NULL;

-- Define posição inicial baseada em created_at por usuário
WITH ordered AS (
  SELECT id,
         (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) - 1) AS pos
  FROM public.organizer_blocks
)
UPDATE public.organizer_blocks b
SET position = o.pos
FROM ordered o
WHERE b.id = o.id;
