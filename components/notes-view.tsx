'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Search, Tag, Trash2, Eye, Edit, Loader2, Bold, Italic,
  Code, List, ListOrdered, Quote, Minus, Link, CheckSquare,
  Image, Table, Heading1, Columns2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { renderMarkdown } from '@/lib/markdown'

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

export function NotesView({ userId }: NotesViewProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Load notes
  useEffect(() => {
    async function loadNotes() {
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, content, tags, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) { toast.error('Erro ao carregar notas'); setIsLoading(false); return }
      setNotes((data ?? []).map(row => ({
        id: row.id, title: row.title, content: row.content,
        tags: row.tags ?? [], updatedAt: new Date(row.updated_at),
      })))
      setIsLoading(false)
    }
    loadNotes()
  }, [userId])

  const persistNote = useCallback(async (note: Note) => {
    setIsSaving(true)
    const { error } = await supabase.from('notes').upsert({
      id: note.id, user_id: userId, title: note.title,
      content: note.content, tags: note.tags, updated_at: note.updatedAt.toISOString(),
    })
    setIsSaving(false)
    if (error) toast.error('Erro ao salvar nota', { description: error.message })
  }, [userId, supabase])

  const scheduleSave = useCallback((note: Note) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => persistNote(note), 800)
  }, [persistNote])

  const createNewNote = async () => {
    const note: Note = { id: crypto.randomUUID(), title: 'Nova Nota', content: '', tags: [], updatedAt: new Date() }
    setNotes([note, ...notes])
    setSelectedNote(note)
    await persistNote(note)
  }

  const updateNote = (updates: Partial<Note>, immediate = false) => {
    if (!selectedNote) return
    const updated: Note = { ...selectedNote, ...updates, updatedAt: new Date() }
    setNotes(notes.map(n => n.id === selectedNote.id ? updated : n))
    setSelectedNote(updated)
    if (immediate) persistNote(updated)
    else scheduleSave(updated)
  }

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', userId)
    if (error) { toast.error('Erro ao deletar nota'); return }
    setNotes(notes.filter(n => n.id !== id))
    if (selectedNote?.id === id) setSelectedNote(null)
  }

  // Insert markdown at cursor
  const insertAtCursor = useCallback((before: string, after = '', placeholder = '') => {
    const ta = textareaRef.current
    if (!ta || !selectedNote) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = ta.value.slice(start, end) || placeholder
    const newContent = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end)
    updateNote({ content: newContent })
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }, [selectedNote]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts inside textarea
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key === 'b') { e.preventDefault(); insertAtCursor('**', '**', 'negrito') }
    if (ctrl && e.key === 'i') { e.preventDefault(); insertAtCursor('*', '*', 'itálico') }
    if (ctrl && e.key === 'k') { e.preventDefault(); insertAtCursor('[', '](url)', 'link') }
    if (ctrl && e.key === 'e') { e.preventDefault(); insertAtCursor('`', '`', 'código') }
  }

  // Image upload to Supabase Storage
  const handleImageUpload = async (file: File) => {
    if (!selectedNote) return
    setIsUploading(true)
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${userId}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('note-images')
      .upload(path, file, { upsert: false })

    if (uploadError) {
      toast.error('Erro no upload', {
        description: uploadError.message.includes('bucket')
          ? 'Crie o bucket "note-images" com acesso público no Supabase Dashboard.'
          : uploadError.message,
      })
      setIsUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('note-images').getPublicUrl(path)
    const url = urlData.publicUrl
    const alt = file.name.replace(/\.[^.]+$/, '')
    insertAtCursor(`\n![${alt}](${url})\n`, '', '')
    setIsUploading(false)
    toast.success('Imagem inserida!')
  }

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const wordCount = (selectedNote?.content ?? '').trim().split(/\s+/).filter(Boolean).length
  const charCount = (selectedNote?.content ?? '').length

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
      {/* ── Sidebar ── */}
      <div className="w-72 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <Button onClick={createNewNote} className="w-full" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nova Nota
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              placeholder="Buscar notas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 bg-background border border-border rounded-md pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredNotes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma nota encontrada
              </div>
            ) : (
              filteredNotes.map(note => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`w-full text-left p-3 rounded-lg mb-1 transition-all hover:bg-muted ${
                    selectedNote?.id === note.id ? 'bg-muted ring-1 ring-border' : ''
                  }`}
                >
                  <div className="font-medium mb-0.5 text-sm line-clamp-1">{note.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                    {note.content.replace(/[#*`_>]/g, '').trim() || 'Nota vazia'}
                  </div>
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {note.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0 h-4">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Editor area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedNote ? (
          <>
            {/* Header */}
            <div className="border-b border-border px-4 py-3 bg-card shrink-0">
              <div className="flex items-center gap-2">
                <input
                  value={selectedNote.title}
                  onChange={e => updateNote({ title: e.target.value })}
                  className="text-xl font-bold bg-transparent flex-1 focus:outline-none placeholder:text-muted-foreground"
                  placeholder="Título da nota"
                />
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                <Button variant="ghost" size="sm" onClick={() => deleteNote(selectedNote.id)}
                  className="text-destructive hover:text-destructive h-8 w-8 p-0 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* View mode + tags row */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5">
                  {([
                    { id: 'edit' as const, icon: <Edit className="h-3.5 w-3.5 mr-1" />, label: 'Editar' },
                    { id: 'split' as const, icon: <Columns2 className="h-3.5 w-3.5 mr-1" />, label: 'Split' },
                    { id: 'preview' as const, icon: <Eye className="h-3.5 w-3.5 mr-1" />, label: 'Preview' },
                  ] as const).map(m => (
                    <Button key={m.id} variant={viewMode === m.id ? 'secondary' : 'ghost'} size="sm"
                      className="h-7 px-2 text-xs" onClick={() => setViewMode(m.id)}>
                      {m.icon}{m.label}
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex gap-1 flex-wrap">
                    {selectedNote.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer text-xs"
                        onClick={() => updateNote({ tags: selectedNote.tags.filter(t => t !== tag) }, true)}>
                        {tag} ×
                      </Badge>
                    ))}
                    <input
                      placeholder="+ tag"
                      className="h-5 w-20 text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          updateNote({ tags: [...selectedNote.tags, e.currentTarget.value.trim()] }, true)
                          e.currentTarget.value = ''
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Formatting toolbar (only shown in edit/split mode) */}
              {viewMode !== 'preview' && (
                <div className="flex items-center gap-0.5 mt-2 flex-wrap">
                  {/* Headings */}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Título (H1)"
                    onClick={() => insertAtCursor('# ', '', 'Título')}>
                    <Heading1 className="h-3.5 w-3.5" />
                  </Button>

                  <div className="w-px h-4 bg-border mx-0.5" />

                  {/* Inline formatting */}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 font-bold" title="Negrito (Ctrl+B)"
                    onClick={() => insertAtCursor('**', '**', 'negrito')}>
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 italic" title="Itálico (Ctrl+I)"
                    onClick={() => insertAtCursor('*', '*', 'itálico')}>
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Código inline (Ctrl+E)"
                    onClick={() => insertAtCursor('`', '`', 'código')}>
                    <Code className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Link (Ctrl+K)"
                    onClick={() => insertAtCursor('[', '](url)', 'texto')}>
                    <Link className="h-3.5 w-3.5" />
                  </Button>

                  <div className="w-px h-4 bg-border mx-0.5" />

                  {/* Blocks */}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Lista"
                    onClick={() => insertAtCursor('\n- ', '', 'item')}>
                    <List className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Lista numerada"
                    onClick={() => insertAtCursor('\n1. ', '', 'item')}>
                    <ListOrdered className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Checkbox"
                    onClick={() => insertAtCursor('\n- [ ] ', '', 'tarefa')}>
                    <CheckSquare className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Citação"
                    onClick={() => insertAtCursor('\n> ', '', 'citação')}>
                    <Quote className="h-3.5 w-3.5" />
                  </Button>

                  <div className="w-px h-4 bg-border mx-0.5" />

                  {/* Code block */}
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" title="Bloco de código"
                    onClick={() => insertAtCursor('\n```javascript\n', '\n```\n', 'seu código aqui')}>
                    <Code className="h-3.5 w-3.5" />
                    <span>Código</span>
                  </Button>

                  {/* Table */}
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" title="Tabela"
                    onClick={() => insertAtCursor(
                      '\n| Coluna 1 | Coluna 2 | Coluna 3 |\n| --- | --- | --- |\n| ',
                      ' | valor | valor |\n', 'valor'
                    )}>
                    <Table className="h-3.5 w-3.5" />
                    <span>Tabela</span>
                  </Button>

                  {/* Divider */}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Divisor"
                    onClick={() => insertAtCursor('\n\n---\n\n', '', '')}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>

                  <div className="w-px h-4 bg-border mx-0.5" />

                  {/* Image upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleImageUpload(file)
                      e.target.value = ''
                    }}
                  />
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" title="Inserir imagem"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}>
                    {isUploading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Image className="h-3.5 w-3.5" />}
                    <span>Imagem</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Content area */}
            <div className="flex-1 flex overflow-hidden">
              {(viewMode === 'edit' || viewMode === 'split') && (
                <ScrollArea className={viewMode === 'split' ? 'flex-1 border-r border-border' : 'flex-1'}>
                  <div className="p-6">
                    <textarea
                      ref={textareaRef}
                      value={selectedNote.content}
                      onChange={e => updateNote({ content: e.target.value })}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder={'Comece a escrever...\n\nSuporta Markdown:\n# Título  ## Subtítulo\n**negrito**  *itálico*  ~~riscado~~\n`código`  ```javascript\\ncódigo\\n```\n- Lista  1. Numerada  - [ ] Checkbox\n> Citação  | Tabela |\n---\n\n![imagem](url)  [link](url)'}
                      className="w-full min-h-[600px] bg-transparent resize-none text-sm leading-7 focus:outline-none font-mono text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                </ScrollArea>
              )}

              {(viewMode === 'preview' || viewMode === 'split') && (
                <ScrollArea className="flex-1">
                  <div className="p-6 max-w-none">
                    <div
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedNote.content) }}
                      className="text-sm text-foreground"
                    />
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Footer: word count */}
            <div className="border-t border-border px-4 py-1.5 flex items-center gap-4 text-xs text-muted-foreground bg-card shrink-0">
              <span>{wordCount} palavras</span>
              <span>{charCount} caracteres</span>
              <span className="ml-auto opacity-60">
                Ctrl+B negrito · Ctrl+I itálico · Ctrl+K link · Ctrl+E código
              </span>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-base mb-2">Selecione uma nota ou crie uma nova</p>
              <p className="text-sm opacity-60">Suporte completo a Markdown com syntax highlighting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
