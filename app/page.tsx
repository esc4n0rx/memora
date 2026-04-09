'use client'

import { useState, useEffect } from 'react'
import { AuthScreen } from '@/components/auth-screen'
import { Dashboard } from '@/components/dashboard'
import { Toaster } from '@/components/ui/sonner'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Busca sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Escuta mudanças de auth (login, logout, refresh de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)

      if (event === 'SIGNED_IN') {
        toast.success('Bem-vindo ao Memora!', {
          description: 'Você está autenticado e pronto para começar.',
        })
      }

      if (event === 'SIGNED_OUT') {
        toast.info('Você saiu do Memora', { description: 'Até a próxima!' })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando Memora...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <AuthScreen />
      )}
      <Toaster />
    </>
  )
}
