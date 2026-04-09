import { initializeApp, getApps } from 'firebase/app'

const firebaseConfig = {
  apiKey:     process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId:      process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// Evita reinicializar em hot-reload
export const firebaseApp = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig)
