-- Tabela de notas do usuário

CREATE TABLE IF NOT EXISTS public.notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Nova Nota',
  content     TEXT NOT NULL DEFAULT '',
  tags        TEXT[] NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para busca por usuário
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON public.notes (user_id);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS notes_set_updated_at ON public.notes;
CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes: select own"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notes: insert own"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes: update own"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes: delete own"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);
