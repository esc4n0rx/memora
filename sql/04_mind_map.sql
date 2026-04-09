-- Tabela do mapa mental (canvas por usuário, armazenado como JSONB)

CREATE TABLE IF NOT EXISTS public.mind_maps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  elements    JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS mind_maps_set_updated_at ON public.mind_maps;
CREATE TRIGGER mind_maps_set_updated_at
  BEFORE UPDATE ON public.mind_maps
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.mind_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mind_maps: select own"
  ON public.mind_maps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "mind_maps: insert own"
  ON public.mind_maps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mind_maps: update own"
  ON public.mind_maps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mind_maps: delete own"
  ON public.mind_maps FOR DELETE
  USING (auth.uid() = user_id);
