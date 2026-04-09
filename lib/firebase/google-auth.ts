import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { firebaseApp } from './client'

export interface GoogleAuthResult {
  idToken: string
  profile: {
    full_name: string | null
    avatar_url: string | null
    email: string | null
  }
}

/**
 * Abre o popup do Google via Firebase.
 * Retorna o idToken do Google (para o Supabase) + dados do perfil do usuário.
 */
export async function getGoogleAuthResult(): Promise<GoogleAuthResult> {
  const auth     = getAuth(firebaseApp)
  const provider = new GoogleAuthProvider()

  const result     = await signInWithPopup(auth, provider)
  const credential = GoogleAuthProvider.credentialFromResult(result)
  const idToken    = credential?.idToken

  if (!idToken) throw new Error('Não foi possível obter o token do Google.')

  const profile = {
    full_name:  result.user.displayName ?? null,
    avatar_url: result.user.photoURL    ?? null,
    email:      result.user.email       ?? null,
  }

  // Firebase só serviu para o popup; Supabase assume o gerenciamento da sessão
  await signOut(auth)

  return { idToken, profile }
}
