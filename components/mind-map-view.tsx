'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Square, Circle, Minus, Type, MousePointer, Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type Tool = 'select' | 'rectangle' | 'circle' | 'line' | 'text'

interface Element {
  id: string
  type: 'rectangle' | 'circle' | 'line' | 'text'
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  x2?: number
  y2?: number
  text?: string
  color: string
}

const COLORS = ['#6B8AFF', '#FF8B6B', '#6BFFA8', '#FFD66B', '#FF6BF7', '#6BDBFF']

interface MindMapViewProps {
  userId: string
}

export function MindMapView({ userId }: MindMapViewProps) {
  const [selectedTool, setSelectedTool] = useState<Tool>('select')
  const [elements, setElements] = useState<Element[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentElement, setCurrentElement] = useState<Element | null>(null)
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [selectedColor, setSelectedColor] = useState(COLORS[0])
  const [isLoading, setIsLoading] = useState(true)
  const canvasRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  // Carregar elementos do banco
  useEffect(() => {
    async function loadCanvas() {
      const { data, error } = await supabase
        .from('mind_maps')
        .select('elements')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = row not found (usuário nunca salvou nada)
        toast.error('Erro ao carregar mapa mental')
      }

      if (data) {
        setElements(data.elements as Element[])
      }

      setIsLoading(false)
    }

    loadCanvas()
  }, [userId])

  // Persiste o canvas no banco (upsert por user_id)
  const persistCanvas = useCallback(async (els: Element[]) => {
    const { error } = await supabase.from('mind_maps').upsert(
      { user_id: userId, elements: els },
      { onConflict: 'user_id' }
    )
    if (error) toast.error('Erro ao salvar mapa mental', { description: error.message })
  }, [userId, supabase])

  // Debounce para drag (frequente) — 600ms
  const scheduleSave = useCallback((els: Element[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => persistCanvas(els), 600)
  }, [persistCanvas])

  const getMousePos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e)

    if (selectedTool === 'select') {
      const clickedElement = elements.find((el) => {
        if (el.type === 'rectangle' && el.width && el.height) {
          return pos.x >= el.x && pos.x <= el.x + el.width && pos.y >= el.y && pos.y <= el.y + el.height
        }
        if (el.type === 'circle' && el.radius) {
          const distance = Math.sqrt(Math.pow(pos.x - el.x, 2) + Math.pow(pos.y - el.y, 2))
          return distance <= el.radius
        }
        if (el.type === 'text' && el.width && el.height) {
          return pos.x >= el.x && pos.x <= el.x + el.width && pos.y >= el.y && pos.y <= el.y + el.height
        }
        return false
      })

      if (clickedElement) {
        setSelectedElement(clickedElement.id)
        setIsDragging(true)
        setDragOffset({ x: pos.x - clickedElement.x, y: pos.y - clickedElement.y })
      } else {
        setSelectedElement(null)
      }
    } else {
      setIsDrawing(true)
      const newElement: Element = {
        id: crypto.randomUUID(),
        type: selectedTool as Element['type'],
        x: pos.x,
        y: pos.y,
        color: selectedColor,
      }
      if (selectedTool === 'text') {
        newElement.text = 'Texto'
        newElement.width = 100
        newElement.height = 30
      }
      setCurrentElement(newElement)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e)

    if (isDragging && selectedElement) {
      const updated = elements.map((el) =>
        el.id === selectedElement ? { ...el, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y } : el
      )
      setElements(updated)
      scheduleSave(updated) // debounce enquanto arrasta
    } else if (isDrawing && currentElement) {
      const updated = { ...currentElement }
      if (currentElement.type === 'rectangle') {
        updated.width = Math.abs(pos.x - currentElement.x)
        updated.height = Math.abs(pos.y - currentElement.y)
        if (pos.x < currentElement.x) updated.x = pos.x
        if (pos.y < currentElement.y) updated.y = pos.y
      } else if (currentElement.type === 'circle') {
        updated.radius = Math.sqrt(Math.pow(pos.x - currentElement.x, 2) + Math.pow(pos.y - currentElement.y, 2))
      } else if (currentElement.type === 'line') {
        updated.x2 = pos.x
        updated.y2 = pos.y
      }
      setCurrentElement(updated)
    }
  }

  const handleMouseUp = () => {
    if (isDrawing && currentElement) {
      const valid =
        (currentElement.type === 'rectangle' && (currentElement.width ?? 0) > 10 && (currentElement.height ?? 0) > 10) ||
        (currentElement.type === 'circle' && (currentElement.radius ?? 0) > 5) ||
        (currentElement.type === 'line' && currentElement.x2 && currentElement.y2) ||
        currentElement.type === 'text'

      if (valid) {
        const updated = [...elements, currentElement]
        setElements(updated)
        persistCanvas(updated) // imediato ao finalizar o desenho
      }
      setCurrentElement(null)
    }

    if (isDragging) {
      // Cancela o debounce e salva imediatamente ao soltar
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      persistCanvas(elements)
    }

    setIsDrawing(false)
    setIsDragging(false)
  }

  const deleteSelected = async () => {
    if (!selectedElement) return
    const updated = elements.filter((el) => el.id !== selectedElement)
    setElements(updated)
    setSelectedElement(null)
    await persistCanvas(updated)
  }

  const renderElement = (el: Element, isSelected = false) => {
    const strokeWidth = isSelected ? 3 : 2
    const opacity = isSelected ? 1 : 0.9

    if (el.type === 'rectangle' && el.width && el.height) {
      return (
        <div
          key={el.id}
          style={{
            position: 'absolute',
            left: el.x,
            top: el.y,
            width: el.width,
            height: el.height,
            border: `${strokeWidth}px solid ${el.color}`,
            backgroundColor: `${el.color}20`,
            borderRadius: '8px',
            opacity,
          }}
        />
      )
    }

    if (el.type === 'circle' && el.radius) {
      return (
        <div
          key={el.id}
          style={{
            position: 'absolute',
            left: el.x - el.radius,
            top: el.y - el.radius,
            width: el.radius * 2,
            height: el.radius * 2,
            border: `${strokeWidth}px solid ${el.color}`,
            backgroundColor: `${el.color}20`,
            borderRadius: '50%',
            opacity,
          }}
        />
      )
    }

    if (el.type === 'text' && el.width && el.height) {
      return (
        <div
          key={el.id}
          style={{
            position: 'absolute',
            left: el.x,
            top: el.y,
            color: el.color,
            fontSize: '14px',
            fontWeight: 600,
            opacity,
            border: isSelected ? `2px dashed ${el.color}` : 'none',
            padding: '4px 8px',
            borderRadius: '4px',
          }}
        >
          {el.text}
        </div>
      )
    }

    return null
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Carregando mapa mental...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar Flutuante */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-card border border-border rounded-xl shadow-lg p-2 flex items-center gap-1">
          <Button
            variant={selectedTool === 'select' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedTool('select')}
            className="h-9 w-9 p-0"
          >
            <MousePointer className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant={selectedTool === 'rectangle' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedTool('rectangle')}
            className="h-9 w-9 p-0"
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedTool === 'circle' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedTool('circle')}
            className="h-9 w-9 p-0"
          >
            <Circle className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedTool === 'line' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedTool('line')}
            className="h-9 w-9 p-0"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedTool === 'text' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedTool('text')}
            className="h-9 w-9 p-0"
          >
            <Type className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />

          {/* Cores */}
          <div className="flex gap-1 px-2">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  selectedColor === color ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {selectedElement && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteSelected}
                className="h-9 w-9 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 bg-background relative overflow-hidden cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border opacity-30" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {elements.filter((el) => el.type === 'line').map((el) => (
            <line
              key={el.id}
              x1={el.x} y1={el.y} x2={el.x2} y2={el.y2}
              stroke={el.color}
              strokeWidth={selectedElement === el.id ? 3 : 2}
              opacity={selectedElement === el.id ? 1 : 0.9}
            />
          ))}

          {currentElement?.type === 'line' && currentElement.x2 && currentElement.y2 && (
            <line
              x1={currentElement.x} y1={currentElement.y}
              x2={currentElement.x2} y2={currentElement.y2}
              stroke={currentElement.color} strokeWidth={2} opacity={0.7}
            />
          )}
        </svg>

        {elements.filter((el) => el.type !== 'line').map((el) => renderElement(el, el.id === selectedElement))}
        {currentElement && currentElement.type !== 'line' && renderElement(currentElement)}

        {elements.length === 0 && !isDrawing && (
          <div className="absolute bottom-8 left-8 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-4 max-w-sm">
            <div className="text-sm font-semibold mb-2">Canvas Interativo</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Selecione uma ferramenta na barra acima</p>
              <p>• Clique e arraste para desenhar</p>
              <p>• Use o ponteiro para mover elementos</p>
              <p>• Escolha cores para categorizar ideias</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
