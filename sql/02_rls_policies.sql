-- RLS (Row Level Security) para todas as tabelas do Memora
-- Execute este arquivo após o 01_profiles.sql

-- ============================================================
-- PROFILES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usuário pode visualizar apenas seu próprio perfil
CREATE POLICY "profiles: select own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Usuário pode atualizar apenas seu próprio perfil
CREATE POLICY "profiles: update own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert é feito apenas via trigger (handle_new_user), não diretamente
-- Portanto não há policy de INSERT para usuários

-- ============================================================
-- NOTAS (placeholder para uso futuro)
-- ============================================================
-- Quando criar a tabela de notas, use o template abaixo:
--
-- CREATE TABLE public.notes (
--   id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   title      TEXT NOT NULL DEFAULT '',
--   content    TEXT NOT NULL DEFAULT '',
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "notes: select own"
--   ON public.notes FOR SELECT
--   USING (auth.uid() = user_id);
--
-- CREATE POLICY "notes: insert own"
--   ON public.notes FOR INSERT
--   WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "notes: update own"
--   ON public.notes FOR UPDATE
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "notes: delete own"
--   ON public.notes FOR DELETE
--   USING (auth.uid() = user_id);

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- Para verificar as policies ativas:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
