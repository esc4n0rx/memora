-- ============================================================
-- Storage: bucket note-images + RLS policies
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Criar o bucket (caso não exista)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'note-images',
  'note-images',
  true,                         -- acesso público para leitura via URL
  5242880,                      -- limite de 5 MB por arquivo
  ARRAY['image/png','image/jpeg','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. RLS sobre storage.objects
-- O caminho de cada arquivo segue o padrão: {user_id}/{filename}
-- auth.uid()::text deve bater com o primeiro segmento do path.
-- ============================================================

-- Upload: apenas o próprio usuário pode inserir na sua pasta
CREATE POLICY "note-images: insert own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'note-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leitura pública (a URL já é pública pelo bucket, mas a policy protege a API)
CREATE POLICY "note-images: select public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'note-images');

-- Update: apenas o dono do arquivo
CREATE POLICY "note-images: update own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'note-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: apenas o dono do arquivo
CREATE POLICY "note-images: delete own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'note-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
