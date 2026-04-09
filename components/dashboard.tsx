'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bell, Search, FileText, Network, Grid3x3, Settings, Info } from 'lucide-react'
import { NotesView } from './notes-view'
import { MindMapView } from './mind-map-view'
import { OrganizerView } from './organizer-view'
import { SettingsView } from './settings-view'
import { AboutView } from './about-view'
import type { User } from '@supabase/supabase-js'

type View = 'notes' | 'mindmap' | 'organizer' | 'settings' | 'about'

interface DashboardProps {
  user: User
  onLogout: () => void
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [currentView, setCurrentView] = useState<View>('notes')
  const [searchQuery, setSearchQuery] = useState('')

  const displayName: string = user.user_metadata?.full_name ?? user.email ?? 'Usuário'
  const avatarUrl: string | undefined = user.user_metadata?.avatar_url
  const initials = displayName[0].toUpperCase()

  const navigation = [
    { id: 'notes' as View, label: 'Notas', icon: FileText },
    { id: 'mindmap' as View, label: 'Mapa Mental', icon: Network },
    { id: 'organizer' as View, label: 'Organizador', icon: Grid3x3 },
    { id: 'settings' as View, label: 'Configurações', icon: Settings },
    { id: 'about' as View, label: 'Sobre', icon: Info },
  ]

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold">Memora</h1>

          {/* Navegação */}
          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  variant={currentView === item.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView(item.id)}
                  className="transition-all"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* Busca Global */}
          {currentView === 'notes' && (
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          )}

          {/* Notificações */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </Button>

          {/* Avatar e Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCurrentView('settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrentView('about')}>
                <Info className="mr-2 h-4 w-4" />
                Sobre
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive">
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden border-b border-border bg-card px-2 py-2 flex gap-1 overflow-x-auto">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.id}
              variant={currentView === item.id ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setCurrentView(item.id)}
              className="flex-shrink-0"
            >
              <Icon className="h-4 w-4" />
            </Button>
          )
        })}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full">
          {currentView === 'notes' && <NotesView userId={user.id} />}
          {currentView === 'mindmap' && <MindMapView userId={user.id} />}
          {currentView === 'organizer' && <OrganizerView userId={user.id} />}
          {currentView === 'settings' && <SettingsView user={user} />}
          {currentView === 'about' && <AboutView />}
        </div>
      </main>
    </div>
  )
}
