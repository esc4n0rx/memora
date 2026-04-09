'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Plus, Bold, Italic, Code, List, Search, Tag, Trash2, Eye, Edit, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  updatedAt: Date
}

interface NotesViewProps {
  userId: string
}

export function NotesView({ userId }: NotesViewProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  // Carregar notas do banco
  useEffect(() => {
    async function loadNotes() {
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, content, tags, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) {
        toast.error('Erro ao carregar notas')
        setIsLoading(false)
        return
      }

      const mapped: Note[] = (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        tags: row.tags ?? [],
        updatedAt: new Date(row.updated_at),
      }))

      setNotes(mapped)
      setIsLoading(false)
    }

    loadNotes()
  }, [userId])

  // Salva uma nota no banco (upsert)
  const persistNote = useCallback(async (note: Note) => {
    setIsSaving(true)
    const { error } = await supabase.from('notes').upsert({
      id: note.id,
      user_id: userId,
      title: note.title,
      content: note.content,
      tags: note.tags,
      updated_at: note.updatedAt.toISOString(),
    })
    setIsSaving(false)
    if (error) toast.error('Erro ao salvar nota', { description: error.message })
  }, [userId, supabase])

  // Auto-save debounced — usado para title e content
  const scheduleSave = useCallback((note: Note) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => persistNote(note), 800)
  }, [persistNote])

  const createNewNote = async () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Nova Nota',
      content: '',
      tags: [],
      updatedAt: new Date(),
    }
    setNotes([newNote, ...notes])
    setSelectedNote(newNote)
    await persistNote(newNote)
  }

  const updateNote = (updates: Partial<Note>, immediate = false) => {
    if (!selectedNote) return
    const updated: Note = { ...selectedNote, ...updates, updatedAt: new Date() }
    setNotes(notes.map((n) => (n.id === selectedNote.id ? updated : n)))
    setSelectedNote(updated)
    if (immediate) {
      persistNote(updated)
    } else {
      scheduleSave(updated)
    }
  }

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', userId)
    if (error) {
      toast.error('Erro ao deletar nota')
      return
    }
    setNotes(notes.filter((n) => n.id !== id))
    if (selectedNote?.id === id) setSelectedNote(null)
  }

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const renderMarkdown = (text: string) => {
    let html = text
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-bold"><em class="italic">$1</em></strong>')
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    html = html.replace(/___(.+?)___/g, '<strong class="font-bold"><em class="italic">$1</em></strong>')
    html = html.replace(/__(.+?)__/g, '<strong class="font-bold">$1</strong>')
    html = html.replace(/_(.+?)_/g, '<em class="italic">$1</em>')
    html = html.replace(/`(.+?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-accent">$1</code>')
    html = html.replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre class="bg-muted p-4 rounded-lg my-4 overflow-x-auto"><code class="text-sm font-mono">$2</code></pre>')
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">$1</a>')
    html = html.replace(/^\* (.+)$/gim, '<li class="ml-4">• $1</li>')
    html = html.replace(/^- (.+)$/gim, '<li class="ml-4">• $1</li>')
    html = html.replace(/^\d+\. (.+)$/gim, '<li class="ml-4 list-decimal">$1</li>')
    html = html.replace(/\n\n/g, '<br/><br/>')
    html = html.replace(/\n/g, '<br/>')
    return html
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Carregando notas...
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <Button onClick={createNewNote} className="w-full" size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Nova Nota
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredNotes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhuma nota encontrada</p>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`w-full text-left p-3 rounded-lg mb-2 transition-all hover:bg-muted ${
                    selectedNote?.id === note.id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="font-semibold mb-1 text-sm line-clamp-1">{note.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {note.content || 'Nota vazia'}
                  </div>
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {note.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            <div className="border-b border-border p-4 bg-card">
              <div className="flex items-center gap-2">
                <Input
                  value={selectedNote.title}
                  onChange={(e) => updateNote({ title: e.target.value })}
                  className="text-2xl font-bold border-none bg-transparent px-0 focus-visible:ring-0 flex-1"
                  placeholder="Título da nota"
                />
                {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
              </div>

              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                  <Button
                    variant={viewMode === 'edit' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => setViewMode('edit')}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant={viewMode === 'split' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => setViewMode('split')}
                  >
                    <Bold className="h-4 w-4 mr-1" />
                    Split
                  </Button>
                  <Button
                    variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => setViewMode('preview')}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                </div>

                <div className="flex items-center gap-2 flex-1">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div className="flex gap-1 flex-wrap">
                    {selectedNote.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => updateNote({ tags: selectedNote.tags.filter((t) => t !== tag) }, true)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                    <Input
                      placeholder="Adicionar tag..."
                      className="h-6 w-32 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value) {
                          updateNote({ tags: [...selectedNote.tags, e.currentTarget.value] }, true)
                          e.currentTarget.value = ''
                        }
                      }}
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteNote(selectedNote.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {(viewMode === 'edit' || viewMode === 'split') && (
                <ScrollArea className={viewMode === 'split' ? 'flex-1 border-r border-border' : 'flex-1'}>
                  <div className="p-6">
                    <Textarea
                      value={selectedNote.content}
                      onChange={(e) => updateNote({ content: e.target.value })}
                      placeholder={
                        'Comece a escrever...\n\nSuporta Markdown:\n# Título\n## Subtítulo\n**negrito** *itálico*\n`código`\n- Lista'
                      }
                      className="min-h-[600px] border-none bg-transparent resize-none text-base leading-relaxed focus-visible:ring-0 font-mono"
                    />
                  </div>
                </ScrollArea>
              )}

              {(viewMode === 'preview' || viewMode === 'split') && (
                <ScrollArea className="flex-1">
                  <div className="p-6 prose prose-invert max-w-none">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(selectedNote.content || '_Nenhum conteúdo ainda..._'),
                      }}
                      className="text-base leading-relaxed"
                    />
                  </div>
                </ScrollArea>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-2">Selecione uma nota ou crie uma nova</p>
              <p className="text-sm">Use Markdown para formatação</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
