'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Plus, Edit, Trash2, Search, Filter, Loader2, Copy, Star, ExternalLink,
  LayoutGrid, List, Table2, Download, Pin, GripVertical, Check,
  X as XIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { renderMarkdown } from '@/lib/markdown'

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCK_COLORS = [
  null,
  '#6B8AFF', '#FF8B6B', '#6BFFA8', '#FFD66B',
  '#FF6BF7', '#6BDBFF', '#F87171', '#94A3B8',
]

const DEFAULT_COLOR = '#6B8AFF'

function initials(title: string) {
  return title.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Block {
  id: string
  title: string
  description: string
  tags: string[]
  color: string | null
  pinned: boolean
  link: string | null
  position: number
}

type Layout = 'cards' | 'list' | 'table'

interface FormData {
  title: string
  description: string
  tags: string[]
  color: string | null
  pinned: boolean
  link: string
}

interface OrganizerViewProps {
  userId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrganizerView({ userId }: OrganizerViewProps) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Block | null>(null)
  const [detailBlock, setDetailBlock] = useState<Block | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [layout, setLayout] = useState<Layout>('cards')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')

  const [formData, setFormData] = useState<FormData>({
    title: '', description: '', tags: [], color: null, pinned: false, link: '',
  })

  const dragIdRef = useRef<string | null>(null)
  const posTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('organizer_blocks')
        .select('id, title, description, tags, color, pinned, link, position, category')
        .eq('user_id', userId)
        .order('pinned', { ascending: false })
        .order('position', { ascending: true })

      if (error) { toast.error('Erro ao carregar blocos'); setIsLoading(false); return }

      const mapped: Block[] = (data ?? []).map(row => ({
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        // Backwards compat: if tags empty but category exists, use it
        tags: (row.tags?.length ? row.tags : row.category ? [row.category] : []) as string[],
        color: row.color ?? null,
        pinned: row.pinned ?? false,
        link: row.link ?? null,
        position: row.position ?? 0,
      }))

      setBlocks(mapped)
      setIsLoading(false)
    }
    load()
  }, [userId])

  // ─── Keyboard shortcut: N → new block ─────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'n' || e.key === 'N') openForm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  const openForm = (block?: Block) => {
    if (block) {
      setEditing(block)
      setFormData({ title: block.title, description: block.description, tags: block.tags, color: block.color, pinned: block.pinned, link: block.link ?? '' })
    } else {
      setEditing(null)
      setFormData({ title: '', description: '', tags: [], color: null, pinned: false, link: '' })
    }
    setTagInput('')
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    const payload = {
      title: formData.title,
      description: formData.description,
      tags: formData.tags,
      color: formData.color,
      pinned: formData.pinned,
      link: formData.link || null,
    }

    if (editing) {
      const { error } = await supabase.from('organizer_blocks').update(payload).eq('id', editing.id).eq('user_id', userId)
      if (error) { toast.error('Erro ao atualizar'); setIsSaving(false); return }
      const updated = blocks.map(b => b.id === editing.id ? { ...b, ...payload } : b)
      setBlocks(updated)
      if (detailBlock?.id === editing.id) setDetailBlock({ ...editing, ...payload })
    } else {
      const newId = crypto.randomUUID()
      const position = blocks.length
      const { error } = await supabase.from('organizer_blocks').insert({ id: newId, user_id: userId, position, ...payload })
      if (error) { toast.error('Erro ao criar bloco'); setIsSaving(false); return }
      setBlocks([...blocks, { id: newId, position, ...payload }])
    }

    setIsSaving(false)
    setFormOpen(false)
  }

  const deleteBlock = async (id: string) => {
    const { error } = await supabase.from('organizer_blocks').delete().eq('id', id).eq('user_id', userId)
    if (error) { toast.error('Erro ao deletar'); return }
    setBlocks(blocks.filter(b => b.id !== id))
    if (detailBlock?.id === id) setDetailBlock(null)
  }

  const togglePin = async (block: Block) => {
    const newPinned = !block.pinned
    await supabase.from('organizer_blocks').update({ pinned: newPinned }).eq('id', block.id).eq('user_id', userId)
    const updated = blocks.map(b => b.id === block.id ? { ...b, pinned: newPinned } : b)
    setBlocks(updated)
    if (detailBlock?.id === block.id) setDetailBlock({ ...detailBlock, pinned: newPinned })
  }

  // ─── Copy to clipboard ─────────────────────────────────────────────────────

  const copyText = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
    toast.success('Copiado!', { duration: 1000 })
  }

  // ─── Drag & drop reorder ───────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragIdRef.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDragOverId(null)
    const sourceId = dragIdRef.current
    if (!sourceId || sourceId === targetId) return

    const srcIdx = blocks.findIndex(b => b.id === sourceId)
    const tgtIdx = blocks.findIndex(b => b.id === targetId)
    if (srcIdx === -1 || tgtIdx === -1) return

    const reordered = [...blocks]
    const [moved] = reordered.splice(srcIdx, 1)
    reordered.splice(tgtIdx, 0, moved)
    const withPos = reordered.map((b, i) => ({ ...b, position: i }))
    setBlocks(withPos)
    dragIdRef.current = null

    // Debounced save
    if (posTimerRef.current) clearTimeout(posTimerRef.current)
    posTimerRef.current = setTimeout(async () => {
      await Promise.all(
        withPos.map(b =>
          supabase.from('organizer_blocks').update({ position: b.position }).eq('id', b.id).eq('user_id', userId)
        )
      )
    }, 600)
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(blocks, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `organizador-${new Date().toISOString().slice(0, 10)}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    const headers = ['id', 'title', 'description', 'tags', 'color', 'pinned', 'link', 'position']
    const rows = blocks.map(b => [
      b.id,
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.description.replace(/"/g, '""')}"`,
      `"${b.tags.join('; ')}"`,
      b.color ?? '',
      b.pinned,
      b.link ?? '',
      b.position,
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `organizador-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ─── Derived state ─────────────────────────────────────────────────────────

  const allTags = Array.from(new Set(blocks.flatMap(b => b.tags))).sort()

  const filtered = blocks.filter(b => {
    const q = searchQuery.toLowerCase()
    const matchSearch = !q || b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.tags.some(t => t.toLowerCase().includes(q))
    const matchTag = !selectedTag || b.tags.includes(selectedTag)
    return matchSearch && matchTag
  })

  const pinnedBlocks = filtered.filter(b => b.pinned)
  const unpinnedBlocks = filtered.filter(b => !b.pinned)

  const groupedByTag = allTags.reduce((acc, tag) => {
    const group = unpinnedBlocks.filter(b => b.tags.includes(tag))
    if (group.length) acc[tag] = group
    return acc
  }, {} as Record<string, Block[]>)
  const untaggedBlocks = unpinnedBlocks.filter(b => b.tags.length === 0)

  // ─── Drag helpers shared ──────────────────────────────────────────────────

  const dragProps = (block: Block) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => handleDragStart(e, block.id),
    onDragOver: (e: React.DragEvent) => handleDragOver(e, block.id),
    onDrop: (e: React.DragEvent) => handleDrop(e, block.id),
    onDragLeave: () => setDragOverId(null),
  })

  const ActionBtns = ({ block, size = 'md' }: { block: Block; size?: 'sm' | 'md' }) => {
    const s = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7'
    const i = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
    const isCopied = copiedId === block.id + '-title'
    return (
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <button className={`${s} flex items-center justify-center rounded hover:bg-muted`} onClick={() => copyText(block.title, block.id + '-title')} title="Copiar título">
          {isCopied ? <Check className={`${i} text-green-400`} /> : <Copy className={i} />}
        </button>
        <button className={`${s} flex items-center justify-center rounded hover:bg-muted`} onClick={() => togglePin(block)} title={block.pinned ? 'Desafixar' : 'Fixar'}>
          <Star className={`${i} ${block.pinned ? 'text-amber-400 fill-amber-400' : ''}`} />
        </button>
        <button className={`${s} flex items-center justify-center rounded hover:bg-muted`} onClick={() => openForm(block)} title="Editar">
          <Edit className={i} />
        </button>
        <button className={`${s} flex items-center justify-center rounded hover:bg-muted text-destructive`} onClick={() => deleteBlock(block.id)} title="Excluir">
          <Trash2 className={i} />
        </button>
      </div>
    )
  }

  // ─── Fiori Card ───────────────────────────────────────────────────────────

  const FioriCard = ({ block }: { block: Block }) => {
    const accent = block.color ?? DEFAULT_COLOR
    const inits = initials(block.title)
    const isDragTarget = dragOverId === block.id
    const plainDesc = block.description.replace(/[#*`_>\-]/g, '').replace(/\n/g, ' ').trim()

    return (
      <div
        {...dragProps(block)}
        onClick={() => setDetailBlock(block)}
        className={`group flex flex-col rounded-xl border border-border bg-card cursor-pointer transition-all duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 overflow-hidden select-none ${isDragTarget ? 'ring-2 ring-primary' : ''}`}
        style={{ minHeight: 200 }}
      >
        {/* Top accent bar */}
        <div className="h-1.5 w-full shrink-0" style={{ background: accent }} />

        {/* Header */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 select-none"
            style={{ background: `${accent}22`, color: accent, border: `1.5px solid ${accent}44` }}
          >
            {inits}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm leading-snug truncate">{block.title}</h3>
                {block.tags.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{block.tags.join(' · ')}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {block.pinned && <Pin className="h-3.5 w-3.5 text-amber-400" />}
                <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab opacity-0 group-hover:opacity-100" />
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-border/60" />

        {/* Content */}
        <div className="px-4 py-3 flex-1">
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {plainDesc || <span className="italic">Sem descrição</span>}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 pb-4 pt-1 gap-2">
          <div className="flex gap-1 flex-wrap">
            {block.tags.slice(0, 2).map(t => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{ background: `${accent}18`, color: accent }}
              >
                {t}
              </span>
            ))}
            {block.tags.length > 2 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">+{block.tags.length - 2}</span>
            )}
          </div>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {block.link && (
              <a href={block.link} target="_blank" rel="noopener noreferrer" className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-primary" title={block.link}>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <ActionBtns block={block} />
          </div>
        </div>
      </div>
    )
  }

  // ─── List Row ─────────────────────────────────────────────────────────────

  const ListRow = ({ block }: { block: Block }) => {
    const accent = block.color ?? DEFAULT_COLOR
    const isDragTarget = dragOverId === block.id
    const plainDesc = block.description.replace(/[#*`_>\-]/g, '').replace(/\n/g, ' ').trim()

    return (
      <div
        {...dragProps(block)}
        onClick={() => setDetailBlock(block)}
        className={`group flex items-center gap-4 px-4 py-3 border border-border rounded-lg bg-card cursor-pointer hover:bg-muted/40 transition-colors ${isDragTarget ? 'ring-2 ring-primary' : ''}`}
      >
        {/* Color swatch */}
        <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: accent }} />

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: `${accent}22`, color: accent }}
        >
          {initials(block.title)}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {block.pinned && <Pin className="h-3 w-3 text-amber-400 shrink-0" />}
            <span className="font-semibold text-sm truncate">{block.title}</span>
          </div>
          {plainDesc && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{plainDesc}</p>
          )}
        </div>

        {/* Tags */}
        <div className="hidden md:flex gap-1 shrink-0">
          {block.tags.slice(0, 3).map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: `${accent}18`, color: accent }}>
              {t}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {block.link && (
            <a href={block.link} target="_blank" rel="noopener noreferrer"
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-primary">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <ActionBtns block={block} size="sm" />
          <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab opacity-0 group-hover:opacity-100 ml-1" />
        </div>
      </div>
    )
  }

  // ─── Table View ───────────────────────────────────────────────────────────

  const TableView = ({ items }: { items: Block[] }) => (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="w-1 p-0" />
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Título</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tags</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Descrição</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((block, idx) => {
            const accent = block.color ?? DEFAULT_COLOR
            const plainDesc = block.description.replace(/[#*`_>\-]/g, '').replace(/\n/g, ' ').trim()
            const isCopied = copiedId === block.id + '-title'
            return (
              <tr
                key={block.id}
                onClick={() => setDetailBlock(block)}
                className={`group border-b border-border/60 last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'} ${dragOverId === block.id ? 'ring-inset ring-2 ring-primary' : ''}`}
                {...dragProps(block)}
              >
                {/* Color indicator */}
                <td className="p-0 w-1">
                  <div className="w-1 h-full min-h-[48px]" style={{ background: accent }} />
                </td>
                {/* Title */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: `${accent}22`, color: accent }}>
                      {initials(block.title)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        {block.pinned && <Pin className="h-3 w-3 text-amber-400" />}
                        <span className="font-medium text-sm">{block.title}</span>
                      </div>
                    </div>
                  </div>
                </td>
                {/* Tags */}
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {block.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: `${accent}18`, color: accent }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                {/* Description */}
                <td className="px-4 py-3 hidden md:table-cell max-w-xs">
                  <p className="text-xs text-muted-foreground line-clamp-2">{plainDesc || '—'}</p>
                </td>
                {/* Actions */}
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-0.5">
                    {block.link && (
                      <a href={block.link} target="_blank" rel="noopener noreferrer"
                        className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-primary">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted" onClick={() => copyText(block.title, block.id + '-title')} title="Copiar">
                      {isCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted" onClick={() => openForm(block)} title="Editar">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-destructive" onClick={() => deleteBlock(block.id)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  // ─── Section renderer ─────────────────────────────────────────────────────

  const renderItems = (items: Block[]) => {
    if (layout === 'cards') return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map(b => <FioriCard key={b.id} block={b} />)}
      </div>
    )
    if (layout === 'list') return (
      <div className="flex flex-col gap-1.5">
        {items.map(b => <ListRow key={b.id} block={b} />)}
      </div>
    )
    return <TableView items={items} />
  }

  const Section = ({ label, items }: { label: string; items: Block[] }) => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
      </div>
      {renderItems(items)}
    </div>
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Carregando blocos...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* ── Header ── */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-0.5">Organizador</h2>
          <p className="text-sm text-muted-foreground">
            {blocks.length} blocos · pressione <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">N</kbd> para criar
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Layout toggle */}
          <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5">
            {([
              { id: 'cards' as Layout, icon: <LayoutGrid className="h-3.5 w-3.5" />, title: 'Cards' },
              { id: 'list' as Layout, icon: <List className="h-3.5 w-3.5" />, title: 'Lista' },
              { id: 'table' as Layout, icon: <Table2 className="h-3.5 w-3.5" />, title: 'Tabela' },
            ]).map(l => (
              <Button key={l.id} variant={layout === l.id ? 'secondary' : 'ghost'} size="sm"
                className="h-7 w-7 p-0" title={l.title} onClick={() => setLayout(l.id)}>
                {l.icon}
              </Button>
            ))}
          </div>

          {/* Export */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportJSON} title="Exportar JSON">
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">JSON</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportCSV} title="Exportar CSV">
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">CSV</span>
            </Button>
          </div>

          <Button size="sm" onClick={() => openForm()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Novo Bloco
          </Button>
        </div>
      </div>

      {/* ── Search & Tag filter ── */}
      <div className="mb-5 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${selectedTag === null ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
            >
              Todas ({blocks.length})
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${selectedTag === tag ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
              >
                {tag} ({blocks.filter(b => b.tags.includes(tag)).length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="pb-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
              <p className="text-muted-foreground">
                {blocks.length === 0 ? 'Nenhum bloco criado ainda' : 'Nenhum resultado encontrado'}
              </p>
              {blocks.length === 0 && (
                <Button onClick={() => openForm()} size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Criar primeiro bloco
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Pinned */}
              {pinnedBlocks.length > 0 && (
                <Section label="📌 Fixados" items={pinnedBlocks} />
              )}

              {/* Tag groups (only when showing all tags) */}
              {selectedTag === null ? (
                <>
                  {Object.entries(groupedByTag).map(([tag, items]) => (
                    <Section key={tag} label={tag} items={items} />
                  ))}
                  {untaggedBlocks.length > 0 && (
                    <Section label="Sem tag" items={untaggedBlocks} />
                  )}
                </>
              ) : (
                renderItems(filtered)
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* ── Detail Sheet ── */}
      <Sheet open={!!detailBlock} onOpenChange={open => { if (!open) setDetailBlock(null) }}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          {detailBlock && (
            <>
              {/* Color bar */}
              {detailBlock.color && (
                <div className="h-1.5 w-full shrink-0" style={{ background: detailBlock.color }} />
              )}
              <SheetHeader className="px-6 pt-5 pb-3 border-b border-border">
                <div className="flex items-start justify-between gap-2 pr-6">
                  <SheetTitle className="text-lg leading-snug">{detailBlock.title}</SheetTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => copyText(detailBlock.title, 'detail-title')} title="Copiar título">
                      {copiedId === 'detail-title' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => togglePin(detailBlock)} title={detailBlock.pinned ? 'Desafixar' : 'Fixar'}>
                      <Star className={`h-3.5 w-3.5 ${detailBlock.pinned ? 'text-amber-400 fill-amber-400' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { openForm(detailBlock); setDetailBlock(null) }} title="Editar">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => deleteBlock(detailBlock.id)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Tags + link */}
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {detailBlock.tags.map(t => (
                    <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                  {detailBlock.link && (
                    <a href={detailBlock.link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary underline hover:text-primary/80 ml-auto">
                      <ExternalLink className="h-3 w-3" />
                      {new URL(detailBlock.link).hostname}
                    </a>
                  )}
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1 px-6 py-4">
                {detailBlock.description ? (
                  <div
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(detailBlock.description) }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sem descrição.</p>
                )}
              </ScrollArea>

              <div className="px-6 py-3 border-t border-border">
                <Button variant="outline" size="sm" className="w-full gap-2"
                  onClick={() => copyText(detailBlock.description, 'detail-desc')}>
                  {copiedId === 'detail-desc' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  Copiar descrição
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Form Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Bloco' : 'Novo Bloco'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize as informações do bloco' : 'Adicione um novo bloco ao organizador'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={formData.title} required
                onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: ME21N — Criar pedido de compra" />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição <span className="text-muted-foreground font-normal text-xs">(suporta Markdown)</span></Label>
              <Textarea id="description" value={formData.description} rows={5}
                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder="Descreva a funcionalidade... suporta **negrito**, `código`, blocos de código, listas..." />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {formData.tags.map(t => (
                  <Badge key={t} variant="secondary" className="gap-1 text-xs">
                    {t}
                    <button type="button" onClick={() => setFormData(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}>
                      <XIcon className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="Adicionar tag + Enter"
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault()
                    const tag = tagInput.trim().replace(/,/g, '')
                    if (!formData.tags.includes(tag)) setFormData(f => ({ ...f, tags: [...f.tags, tag] }))
                    setTagInput('')
                  }
                }}
              />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label>Cor de destaque</Label>
              <div className="flex gap-2 flex-wrap">
                {BLOCK_COLORS.map(c => (
                  <button
                    key={c ?? 'none'}
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${formData.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{
                      background: c ?? 'transparent',
                      boxShadow: c === null ? undefined : undefined,
                      outline: c === null ? '1.5px dashed var(--border)' : undefined,
                    }}
                    title={c ?? 'Sem cor'}
                  >
                    {c === null && <XIcon className="h-3.5 w-3.5 text-muted-foreground mx-auto" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Link */}
            <div className="space-y-1.5">
              <Label htmlFor="link">Link <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
              <Input id="link" value={formData.link} type="url"
                onChange={e => setFormData(f => ({ ...f, link: e.target.value }))}
                placeholder="https://..." />
            </div>

            {/* Pinned */}
            <div className="flex items-center gap-2">
              <input
                id="pinned"
                type="checkbox"
                checked={formData.pinned}
                onChange={e => setFormData(f => ({ ...f, pinned: e.target.checked }))}
                className="accent-primary"
              />
              <Label htmlFor="pinned" className="cursor-pointer">Fixar este bloco no topo</Label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
