'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Edit, Trash2, Search, Filter, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Block {
  id: string
  title: string
  description: string
  category?: string
}

interface OrganizerViewProps {
  userId: string
}

export function OrganizerView({ userId }: OrganizerViewProps) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<Block | null>(null)
  const [formData, setFormData] = useState({ title: '', description: '', category: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const supabase = createClient()

  // Carregar blocos do banco
  useEffect(() => {
    async function loadBlocks() {
      const { data, error } = await supabase
        .from('organizer_blocks')
        .select('id, title, description, category')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error) {
        toast.error('Erro ao carregar blocos')
        setIsLoading(false)
        return
      }

      setBlocks(data ?? [])
      setIsLoading(false)
    }

    loadBlocks()
  }, [userId])

  const openDialog = (block?: Block) => {
    if (block) {
      setEditingBlock(block)
      setFormData({ title: block.title, description: block.description, category: block.category ?? '' })
    } else {
      setEditingBlock(null)
      setFormData({ title: '', description: '', category: '' })
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    if (editingBlock) {
      const { error } = await supabase
        .from('organizer_blocks')
        .update({
          title: formData.title,
          description: formData.description,
          category: formData.category || null,
        })
        .eq('id', editingBlock.id)
        .eq('user_id', userId)

      if (error) {
        toast.error('Erro ao atualizar bloco')
        setIsSaving(false)
        return
      }

      setBlocks(blocks.map((b) =>
        b.id === editingBlock.id
          ? { ...editingBlock, ...formData, category: formData.category || undefined }
          : b
      ))
    } else {
      const newId = crypto.randomUUID()
      const { error } = await supabase.from('organizer_blocks').insert({
        id: newId,
        user_id: userId,
        title: formData.title,
        description: formData.description,
        category: formData.category || null,
      })

      if (error) {
        toast.error('Erro ao criar bloco')
        setIsSaving(false)
        return
      }

      setBlocks([...blocks, {
        id: newId,
        title: formData.title,
        description: formData.description,
        category: formData.category || undefined,
      }])
    }

    setIsSaving(false)
    setIsDialogOpen(false)
  }

  const deleteBlock = async (id: string) => {
    const { error } = await supabase
      .from('organizer_blocks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      toast.error('Erro ao deletar bloco')
      return
    }

    setBlocks(blocks.filter((b) => b.id !== id))
  }

  const categories = Array.from(new Set(blocks.map((b) => b.category).filter(Boolean))) as string[]

  const filteredBlocks = blocks.filter((block) => {
    const matchesSearch =
      searchQuery === '' ||
      block.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      block.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === null || block.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const groupedBlocks = categories.reduce((acc, category) => {
    acc[category] = filteredBlocks.filter((b) => b.category === category)
    return acc
  }, {} as Record<string, Block[]>)

  const uncategorizedBlocks = filteredBlocks.filter((b) => !b.category)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Carregando blocos...
      </div>
    )
  }

  const BlockCard = ({ block }: { block: Block }) => (
    <Card className="p-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1 leading-tight">{block.title}</h3>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openDialog(block)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => deleteBlock(block.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{block.description}</p>
    </Card>
  )

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">Organizador</h2>
          <p className="text-sm text-muted-foreground">Organize transações, comandos e referências</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Bloco
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBlock ? 'Editar Bloco' : 'Novo Bloco'}</DialogTitle>
              <DialogDescription>
                {editingBlock ? 'Atualize as informações do bloco' : 'Adicione um novo bloco ao seu organizador'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: ME21N — Criar pedido de compra"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva a funcionalidade..."
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria (opcional)</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: EWM, MM, FI, BASIS"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editingBlock ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Busca e Filtros */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por transação ou descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={selectedCategory === null ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="h-8"
            >
              Todas ({blocks.length})
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="h-8"
              >
                {category} ({blocks.filter((b) => b.category === category).length})
              </Button>
            ))}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {selectedCategory === null ? (
          <div className="space-y-8 pb-6">
            {categories.map((category) => {
              const categoryBlocks = groupedBlocks[category]
              if (!categoryBlocks || categoryBlocks.length === 0) return null
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline" className="text-sm font-semibold">{category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {categoryBlocks.length} {categoryBlocks.length === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryBlocks.map((block) => <BlockCard key={block.id} block={block} />)}
                  </div>
                </div>
              )
            })}

            {uncategorizedBlocks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="text-sm font-semibold">Sem Categoria</Badge>
                  <span className="text-xs text-muted-foreground">
                    {uncategorizedBlocks.length} {uncategorizedBlocks.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {uncategorizedBlocks.map((block) => <BlockCard key={block.id} block={block} />)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
            {filteredBlocks.map((block) => <BlockCard key={block.id} block={block} />)}
          </div>
        )}

        {filteredBlocks.length === 0 && (
          <div className="flex items-center justify-center h-64 text-center">
            <div>
              <p className="text-muted-foreground mb-4">
                {blocks.length === 0 ? 'Nenhum bloco criado ainda' : 'Nenhum resultado encontrado'}
              </p>
              {blocks.length === 0 && (
                <Button onClick={() => openDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeiro bloco
                </Button>
              )}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
