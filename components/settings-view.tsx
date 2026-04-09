'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Loader2, Download, Trash2, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface SettingsViewProps {
  user: SupabaseUser
}

export function SettingsView({ user }: SettingsViewProps) {
  const [name, setName] = useState(user.user_metadata?.full_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user.user_metadata?.avatar_url)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const supabase = createClient()

  // Busca perfil atualizado da tabela profiles
  useEffect(() => {
    async function fetchProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()
      if (data?.full_name) setName(data.full_name)
      if (data?.avatar_url) setAvatarUrl(data.avatar_url)
    }
    fetchProfile()
  }, [user.id])

  const handleSaveProfile = async () => {
    setIsSavingProfile(true)

    // Atualiza metadados do auth
    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: name },
    })

    // Atualiza tabela profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: name })
      .eq('id', user.id)

    setIsSavingProfile(false)

    if (authError || profileError) {
      toast.error('Erro ao salvar perfil')
    } else {
      toast.success('Perfil atualizado com sucesso!')
    }
  }

  const handleExport = async () => {
    setIsExporting(true)

    const [notesRes, mindMapRes, blocksRes] = await Promise.all([
      supabase.from('notes').select('id, title, content, tags, updated_at, created_at').eq('user_id', user.id),
      supabase.from('mind_maps').select('elements, updated_at').eq('user_id', user.id).single(),
      supabase.from('organizer_blocks').select('id, title, description, category, created_at').eq('user_id', user.id),
    ])

    if (notesRes.error || blocksRes.error) {
      toast.error('Erro ao exportar dados')
      setIsExporting(false)
      return
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      notes: notesRes.data ?? [],
      mindMap: {
        elements: mindMapRes.data?.elements ?? [],
        updatedAt: mindMapRes.data?.updated_at ?? null,
      },
      organizerBlocks: blocksRes.data ?? [],
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memora-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)

    setIsExporting(false)
    toast.success('Dados exportados com sucesso!')
  }

  const handleClearData = async () => {
    setIsClearing(true)

    const [notesRes, mindMapRes, blocksRes] = await Promise.all([
      supabase.from('notes').delete().eq('user_id', user.id),
      supabase.from('mind_maps').delete().eq('user_id', user.id),
      supabase.from('organizer_blocks').delete().eq('user_id', user.id),
    ])

    setIsClearing(false)

    if (notesRes.error || mindMapRes.error || blocksRes.error) {
      toast.error('Erro ao limpar dados')
    } else {
      toast.success('Todos os dados foram apagados')
    }
  }

  const displayEmail = user.email ?? ''
  const initials = (name || displayEmail)[0]?.toUpperCase() ?? 'M'

  const memberSince = new Date(user.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-1">Configurações</h2>
        <p className="text-sm text-muted-foreground mb-6">Gerencie suas preferências e perfil</p>

        <div className="space-y-6">
          {/* Perfil */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Perfil</h3>

            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-16 w-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{name || 'Sem nome'}</p>
                <p className="text-sm text-muted-foreground">{displayEmail}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Membro desde {memberSince}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={displayEmail}
                  disabled
                  className="opacity-60 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  O email não pode ser alterado por aqui.
                </p>
              </div>
              <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <User className="h-4 w-4 mr-2" />}
                Salvar Perfil
              </Button>
            </div>
          </Card>

          {/* Dados */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-1">Dados</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Todos os seus dados são salvos de forma segura no Supabase e sincronizados entre dispositivos.
            </p>

            <div className="space-y-4">
              {/* Exportar */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Exportar dados</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Baixa um arquivo JSON com todas as suas notas, mapa mental e blocos do organizador.
                  </p>
                </div>
                <Button variant="outline" onClick={handleExport} disabled={isExporting} className="shrink-0">
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Exportar
                </Button>
              </div>

              <Separator />

              {/* Limpar */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-destructive">Limpar todos os dados</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Remove permanentemente todas as notas, o mapa mental e os blocos do organizador. A conta não é excluída.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="shrink-0" disabled={isClearing}>
                      {isClearing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Limpar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação é <strong>irreversível</strong>. Todas as suas notas, mapa mental e blocos do organizador serão excluídos permanentemente.
                        <br /><br />
                        Sua conta não será afetada.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearData}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Sim, apagar tudo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
