'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { getGoogleAuthResult } from '@/lib/firebase/google-auth'
import { toast } from 'sonner'
import Prism from '@/components/Prism'

export function AuthScreen() {
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (error) {
      toast.error('Erro ao entrar', { description: error.message })
    }

    setIsLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (registerPassword !== registerConfirmPassword) {
      toast.error('Senhas não coincidem')
      return
    }

    if (registerPassword.length < 6) {
      toast.error('Senha muito curta', { description: 'Mínimo de 6 caracteres.' })
      return
    }

    setIsLoading(true)

    const { error } = await supabase.auth.signUp({
      email: registerEmail,
      password: registerPassword,
      options: {
        data: { full_name: registerName },
      },
    })

    if (error) {
      toast.error('Erro ao criar conta', { description: error.message })
    } else {
      toast.success('Conta criada!', {
        description: 'Verifique seu email para confirmar o cadastro.',
      })
    }

    setIsLoading(false)
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      // 1. Firebase abre o popup → devolve idToken + perfil do Google
      const { idToken, profile } = await getGoogleAuthResult()

      // 2. Supabase cria a sessão com o idToken do Google
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      })

      if (error) {
        toast.error('Erro ao entrar com Google', { description: error.message })
        return
      }

      // 3. Popula user_metadata com nome e foto (não vêm automaticamente via idToken)
      if (data.user && (profile.full_name || profile.avatar_url)) {
        await supabase.auth.updateUser({
          data: {
            full_name:  profile.full_name,
            avatar_url: profile.avatar_url,
          },
        })

        // Sincroniza também na tabela profiles
        await supabase
          .from('profiles')
          .update({
            full_name:  profile.full_name,
            avatar_url: profile.avatar_url,
          })
          .eq('id', data.user.id)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      if (!message.includes('popup-closed')) {
        toast.error('Erro ao entrar com Google', { description: message })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Prism animado */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black">
        {/* Canvas WebGL ocupa todo o painel */}
        <div className="absolute inset-0">
          <Prism
            animationType="rotate"
            timeScale={0.5}
            height={3.5}
            baseWidth={5.5}
            scale={3.6}
            hueShift={0}
            colorFrequency={1}
            noise={0}
            glow={1}
          />
        </div>

        {/* Texto sobre o canvas */}
        <div className="relative z-10 flex flex-col justify-end p-12 w-full bg-gradient-to-t from-black/80 via-black/20 to-transparent">
          <h1 className="text-4xl font-bold mb-3 leading-tight text-white drop-shadow-lg">
            Organize seu conhecimento de forma inteligente
          </h1>
          <p className="text-base text-white/70 leading-relaxed">
            Notas, fluxos, mapas mentais e organização em um só lugar
          </p>
        </div>
      </div>

      {/* Lado Direito - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Memora</h2>
            <p className="text-muted-foreground">Entre na sua conta ou crie uma nova</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Registro</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-border p-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>

                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    size="lg"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                  >
                    <GoogleIcon />
                    Login com Google
                  </Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="border-border p-6">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nome</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Seu nome"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Senha</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">Confirmar Senha</Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? 'Criando conta...' : 'Criar Conta'}
                  </Button>
                </form>

                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    size="lg"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                  >
                    <GoogleIcon />
                    Registrar com Google
                  </Button>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
