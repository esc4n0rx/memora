-- Tabela de blocos do organizador

CREATE TABLE IF NOT EXISTS public.organizer_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para busca por usuário
CREATE INDEX IF NOT EXISTS organizer_blocks_user_id_idx ON public.organizer_blocks (user_id);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS organizer_blocks_set_updated_at ON public.organizer_blocks;
CREATE TRIGGER organizer_blocks_set_updated_at
  BEFORE UPDATE ON public.organizer_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.organizer_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizer_blocks: select own"
  ON public.organizer_blocks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "organizer_blocks: insert own"
  ON public.organizer_blocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "organizer_blocks: update own"
  ON public.organizer_blocks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "organizer_blocks: delete own"
  ON public.organizer_blocks FOR DELETE
  USING (auth.uid() = user_id);
