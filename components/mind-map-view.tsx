'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Square, Circle, Minus, Type, MousePointer,
  Trash2, Loader2, Pencil, Undo2, Redo2, Bold, Italic,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type Tool = 'select' | 'pen' | 'rectangle' | 'circle' | 'line' | 'text'
type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se'

interface CanvasElement {
  id: string
  type: 'rectangle' | 'circle' | 'line' | 'text' | 'pen'
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  x2?: number
  y2?: number
  text?: string
  color: string
  strokeWidth: number
  points?: { x: number; y: number }[]
  fontFamily?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
}

const COLORS = ['#6B8AFF', '#FF8B6B', '#6BFFA8', '#FFD66B', '#FF6BF7', '#6BDBFF', '#FFFFFF', '#374151']

const FONTS = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Open Sans', value: 'Open Sans' },
  { label: 'Lato', value: 'Lato' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Pacifico', value: 'Pacifico' },
  { label: 'Dancing Script', value: 'Dancing Script' },
  { label: 'Oswald', value: 'Oswald' },
]

/** Smooth freehand points using quadratic bezier through midpoints */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  if (points.length === 2)
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2
    const midY = (points[i].y + points[i + 1].y) / 2
    d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

interface MindMapViewProps {
  userId: string
}

export function MindMapView({ userId }: MindMapViewProps) {
  const [selectedTool, setSelectedTool] = useState<Tool>('select')
  const [elements, setElements] = useState<CanvasElement[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentElement, setCurrentElement] = useState<CanvasElement | null>(null)
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [selectedColor, setSelectedColor] = useState(COLORS[0])
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [isLoading, setIsLoading] = useState(true)
  const [editingElement, setEditingElement] = useState<string | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null)
  const [resizeStart, setResizeStart] = useState<{
    mouseX: number; mouseY: number; el: CanvasElement
  } | null>(null)
  const [historyIndex, setHistoryIndex] = useState(0)

  const canvasRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const historyRef = useRef<CanvasElement[][]>([[]])
  const elementsRef = useRef<CanvasElement[]>([])
  const editTextRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  // Keep ref in sync so async handlers always see latest elements
  useEffect(() => { elementsRef.current = elements }, [elements])

  // Load Google Fonts
  useEffect(() => {
    const families = FONTS.map(f => f.value.replace(/ /g, '+')).join('&family=')
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  // Load from DB
  useEffect(() => {
    async function loadCanvas() {
      const { data, error } = await supabase
        .from('mind_maps')
        .select('elements')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        toast.error('Erro ao carregar mapa mental')
      }
      if (data) {
        const els = data.elements as CanvasElement[]
        setElements(els)
        historyRef.current = [els]
        setHistoryIndex(0)
      }
      setIsLoading(false)
    }
    loadCanvas()
  }, [userId])

  const persistCanvas = useCallback(async (els: CanvasElement[]) => {
    const { error } = await supabase.from('mind_maps').upsert(
      { user_id: userId, elements: els },
      { onConflict: 'user_id' }
    )
    if (error) toast.error('Erro ao salvar', { description: error.message })
  }, [userId, supabase])

  const scheduleSave = useCallback((els: CanvasElement[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => persistCanvas(els), 600)
  }, [persistCanvas])

  const pushHistory = useCallback((els: CanvasElement[]) => {
    const idx = historyRef.current.length - 1 === historyIndex
      ? historyIndex
      : historyIndex
    const newHistory = historyRef.current.slice(0, idx + 1)
    newHistory.push([...els])
    historyRef.current = newHistory
    setHistoryIndex(newHistory.length - 1)
  }, [historyIndex])

  const undo = useCallback(() => {
    const newIdx = historyIndex - 1
    if (newIdx < 0) return
    const els = historyRef.current[newIdx]
    setElements(els)
    setHistoryIndex(newIdx)
    persistCanvas(els)
  }, [historyIndex, persistCanvas])

  const redo = useCallback(() => {
    const newIdx = historyIndex + 1
    if (newIdx >= historyRef.current.length) return
    const els = historyRef.current[newIdx]
    setElements(els)
    setHistoryIndex(newIdx)
    persistCanvas(els)
  }, [historyIndex, persistCanvas])

  const deleteSelected = useCallback(async () => {
    if (!selectedElement) return
    const updated = elementsRef.current.filter(el => el.id !== selectedElement)
    setElements(updated)
    setSelectedElement(null)
    pushHistory(updated)
    await persistCanvas(updated)
  }, [selectedElement, persistCanvas, pushHistory])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault(); redo()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement && !editingElement) {
        deleteSelected()
      }
      if (e.key === 'Escape') {
        setEditingElement(null)
        setSelectedElement(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, selectedElement, editingElement, deleteSelected])

  // Focus textarea when text editing starts
  useEffect(() => {
    if (editingElement && editTextRef.current) {
      editTextRef.current.focus()
      editTextRef.current.select()
    }
  }, [editingElement])

  const getMousePos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const getElementBounds = (el: CanvasElement) => {
    if ((el.type === 'rectangle' || el.type === 'text') && el.width && el.height) {
      return { x: el.x, y: el.y, width: el.width, height: el.height }
    }
    if (el.type === 'circle' && el.radius) {
      return { x: el.x - el.radius, y: el.y - el.radius, width: el.radius * 2, height: el.radius * 2 }
    }
    return null
  }

  const hitTest = (el: CanvasElement, pos: { x: number; y: number }): boolean => {
    if (el.type === 'rectangle' && el.width && el.height) {
      return pos.x >= el.x && pos.x <= el.x + el.width && pos.y >= el.y && pos.y <= el.y + el.height
    }
    if (el.type === 'circle' && el.radius) {
      return Math.sqrt((pos.x - el.x) ** 2 + (pos.y - el.y) ** 2) <= el.radius
    }
    if (el.type === 'text' && el.width && el.height) {
      return pos.x >= el.x && pos.x <= el.x + el.width && pos.y >= el.y && pos.y <= el.y + el.height
    }
    if (el.type === 'pen' && el.points && el.points.length > 1) {
      const xs = el.points.map(p => p.x)
      const ys = el.points.map(p => p.y)
      const pad = (el.strokeWidth ?? 2) + 8
      return (
        pos.x >= Math.min(...xs) - pad && pos.x <= Math.max(...xs) + pad &&
        pos.y >= Math.min(...ys) - pad && pos.y <= Math.max(...ys) + pad
      )
    }
    return false
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editingElement) return
    const pos = getMousePos(e)

    if (selectedTool === 'select') {
      const clicked = [...elements].reverse().find(el => hitTest(el, pos))
      if (clicked) {
        setSelectedElement(clicked.id)
        setIsDragging(true)
        setDragOffset({ x: pos.x - clicked.x, y: pos.y - clicked.y })
      } else {
        setSelectedElement(null)
      }
    } else {
      setIsDrawing(true)
      const newEl: CanvasElement = {
        id: crypto.randomUUID(),
        type: selectedTool as CanvasElement['type'],
        x: pos.x,
        y: pos.y,
        color: selectedColor,
        strokeWidth,
      }
      if (selectedTool === 'text') {
        newEl.text = 'Texto'
        newEl.width = 120
        newEl.height = 40
        newEl.fontFamily = 'Inter'
        newEl.fontSize = 16
        newEl.fontWeight = 'normal'
        newEl.fontStyle = 'normal'
      }
      if (selectedTool === 'pen') {
        newEl.points = [{ x: pos.x, y: pos.y }]
      }
      setCurrentElement(newEl)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (editingElement) return
    const pos = getMousePos(e)

    if (isResizing && resizeHandle && resizeStart) {
      const dx = pos.x - resizeStart.mouseX
      const dy = pos.y - resizeStart.mouseY
      const orig = resizeStart.el
      const updated = elements.map(el => {
        if (el.id !== orig.id) return el
        const n = { ...el }
        if (orig.type === 'rectangle' && orig.width && orig.height) {
          switch (resizeHandle) {
            case 'se': n.width = Math.max(20, orig.width + dx); n.height = Math.max(20, orig.height + dy); break
            case 'sw': n.x = orig.x + dx; n.width = Math.max(20, orig.width - dx); n.height = Math.max(20, orig.height + dy); break
            case 'ne': n.y = orig.y + dy; n.width = Math.max(20, orig.width + dx); n.height = Math.max(20, orig.height - dy); break
            case 'nw': n.x = orig.x + dx; n.y = orig.y + dy; n.width = Math.max(20, orig.width - dx); n.height = Math.max(20, orig.height - dy); break
            case 'e': n.width = Math.max(20, orig.width + dx); break
            case 'w': n.x = orig.x + dx; n.width = Math.max(20, orig.width - dx); break
            case 's': n.height = Math.max(20, orig.height + dy); break
            case 'n': n.y = orig.y + dy; n.height = Math.max(20, orig.height - dy); break
          }
        } else if (orig.type === 'circle' && orig.radius) {
          const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
          n.radius = Math.max(10, orig.radius + delta)
        } else if (orig.type === 'text' && orig.width) {
          if (['e', 'se', 'ne'].includes(resizeHandle)) n.width = Math.max(60, orig.width + dx)
        }
        return n
      })
      setElements(updated)
      scheduleSave(updated)
      return
    }

    if (isDragging && selectedElement) {
      const updated = elements.map(el =>
        el.id === selectedElement ? { ...el, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y } : el
      )
      setElements(updated)
      scheduleSave(updated)
      return
    }

    if (isDrawing && currentElement) {
      const upd = { ...currentElement }
      if (currentElement.type === 'rectangle') {
        upd.width = Math.abs(pos.x - currentElement.x)
        upd.height = Math.abs(pos.y - currentElement.y)
        if (pos.x < currentElement.x) upd.x = pos.x
        if (pos.y < currentElement.y) upd.y = pos.y
      } else if (currentElement.type === 'circle') {
        upd.radius = Math.sqrt((pos.x - currentElement.x) ** 2 + (pos.y - currentElement.y) ** 2)
      } else if (currentElement.type === 'line') {
        upd.x2 = pos.x; upd.y2 = pos.y
      } else if (currentElement.type === 'pen' && currentElement.points) {
        const last = currentElement.points[currentElement.points.length - 1]
        if (Math.sqrt((pos.x - last.x) ** 2 + (pos.y - last.y) ** 2) > 3) {
          upd.points = [...currentElement.points, { x: pos.x, y: pos.y }]
        }
      }
      setCurrentElement(upd)
    }
  }

  const handleMouseUp = () => {
    if (editingElement) return

    if (isResizing) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      const cur = elementsRef.current
      pushHistory(cur)
      persistCanvas(cur)
      setIsResizing(false)
      setResizeHandle(null)
      setResizeStart(null)
      return
    }

    if (isDrawing && currentElement) {
      const valid =
        (currentElement.type === 'rectangle' && (currentElement.width ?? 0) > 10 && (currentElement.height ?? 0) > 10) ||
        (currentElement.type === 'circle' && (currentElement.radius ?? 0) > 5) ||
        (currentElement.type === 'line' && currentElement.x2 !== undefined) ||
        currentElement.type === 'text' ||
        (currentElement.type === 'pen' && (currentElement.points?.length ?? 0) > 1)

      if (valid) {
        const updated = [...elementsRef.current, currentElement]
        setElements(updated)
        pushHistory(updated)
        persistCanvas(updated)
        // Auto-enter text edit mode right after placing text
        if (currentElement.type === 'text') {
          setSelectedElement(currentElement.id)
          setEditingElement(currentElement.id)
        }
      }
      setCurrentElement(null)
    }

    if (isDragging) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      const cur = elementsRef.current
      pushHistory(cur)
      persistCanvas(cur)
    }

    setIsDrawing(false)
    setIsDragging(false)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (selectedTool !== 'select') return
    const pos = getMousePos(e)
    const el = [...elements].reverse().find(el => el.type === 'text' && hitTest(el, pos))
    if (el) {
      e.stopPropagation()
      setSelectedElement(el.id)
      setEditingElement(el.id)
    }
  }

  const finishTextEdit = useCallback((id: string, newText: string) => {
    const updated = elementsRef.current.map(el =>
      el.id === id ? { ...el, text: newText || 'Texto' } : el
    )
    setElements(updated)
    setEditingElement(null)
    pushHistory(updated)
    persistCanvas(updated)
  }, [persistCanvas, pushHistory])

  const updateProp = useCallback(<K extends keyof CanvasElement>(id: string, key: K, value: CanvasElement[K]) => {
    const updated = elementsRef.current.map(el => el.id === id ? { ...el, [key]: value } : el)
    setElements(updated)
    scheduleSave(updated)
  }, [scheduleSave])

  const handleResizeMouseDown = (e: React.MouseEvent, handle: ResizeHandle, elId: string) => {
    e.stopPropagation()
    e.preventDefault()
    const pos = getMousePos(e)
    const el = elements.find(el => el.id === elId)
    if (!el) return
    setIsResizing(true)
    setResizeHandle(handle)
    setResizeStart({ mouseX: pos.x, mouseY: pos.y, el: { ...el } })
  }

  const renderResizeHandles = (el: CanvasElement) => {
    const bounds = getElementBounds(el)
    if (!bounds) return null
    const { x, y, width, height } = bounds

    const handles: { id: ResizeHandle; cx: number; cy: number; cursor: string }[] = el.type === 'text'
      ? [
          { id: 'e', cx: x + width, cy: y + height / 2, cursor: 'e-resize' },
        ]
      : [
          { id: 'nw', cx: x, cy: y, cursor: 'nw-resize' },
          { id: 'n', cx: x + width / 2, cy: y, cursor: 'n-resize' },
          { id: 'ne', cx: x + width, cy: y, cursor: 'ne-resize' },
          { id: 'w', cx: x, cy: y + height / 2, cursor: 'w-resize' },
          { id: 'e', cx: x + width, cy: y + height / 2, cursor: 'e-resize' },
          { id: 'sw', cx: x, cy: y + height, cursor: 'sw-resize' },
          { id: 's', cx: x + width / 2, cy: y + height, cursor: 's-resize' },
          { id: 'se', cx: x + width, cy: y + height, cursor: 'se-resize' },
        ]

    return handles.map(h => (
      <div
        key={h.id}
        onMouseDown={e => handleResizeMouseDown(e, h.id, el.id)}
        style={{
          position: 'absolute',
          left: h.cx - 5,
          top: h.cy - 5,
          width: 10,
          height: 10,
          backgroundColor: '#fff',
          border: '2px solid #6B8AFF',
          borderRadius: '2px',
          cursor: h.cursor,
          zIndex: 20,
          pointerEvents: 'auto',
        }}
      />
    ))
  }

  const renderElement = (el: CanvasElement, isSelected = false) => {
    const sw = el.strokeWidth ?? 2
    const opacity = isSelected ? 1 : 0.9

    if (el.type === 'rectangle' && el.width && el.height) {
      return (
        <div key={el.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: el.x, top: el.y,
              width: el.width, height: el.height,
              border: `${isSelected ? sw + 1 : sw}px solid ${el.color}`,
              backgroundColor: `${el.color}20`,
              borderRadius: '8px',
              opacity,
              pointerEvents: 'auto',
              boxSizing: 'border-box',
            }}
          />
          {isSelected && renderResizeHandles(el)}
        </div>
      )
    }

    if (el.type === 'circle' && el.radius) {
      return (
        <div key={el.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: el.x - el.radius, top: el.y - el.radius,
              width: el.radius * 2, height: el.radius * 2,
              border: `${isSelected ? sw + 1 : sw}px solid ${el.color}`,
              backgroundColor: `${el.color}20`,
              borderRadius: '50%',
              opacity,
              pointerEvents: 'auto',
              boxSizing: 'border-box',
            }}
          />
          {isSelected && renderResizeHandles(el)}
        </div>
      )
    }

    if (el.type === 'text') {
      const fs = el.fontSize ?? 16
      const ff = el.fontFamily ?? 'Inter'
      const fw = el.fontWeight ?? 'normal'
      const fst = el.fontStyle ?? 'normal'
      const isEditing = editingElement === el.id

      return (
        <div key={el.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {isEditing ? (
            <textarea
              ref={editTextRef}
              defaultValue={el.text ?? ''}
              onBlur={e => finishTextEdit(el.id, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') finishTextEdit(el.id, (e.target as HTMLTextAreaElement).value)
                e.stopPropagation()
              }}
              style={{
                position: 'absolute',
                left: el.x, top: el.y,
                color: el.color,
                fontSize: fs,
                fontFamily: ff,
                fontWeight: fw,
                fontStyle: fst,
                border: `2px solid ${el.color}`,
                borderRadius: '4px',
                padding: '4px 8px',
                minWidth: el.width ?? 80,
                minHeight: el.height ?? 40,
                background: 'rgba(15,15,25,0.85)',
                outline: 'none',
                resize: 'both',
                zIndex: 30,
                pointerEvents: 'auto',
                lineHeight: 1.4,
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                left: el.x, top: el.y,
                color: el.color,
                fontSize: fs,
                fontFamily: ff,
                fontWeight: fw,
                fontStyle: fst,
                opacity,
                border: isSelected ? `2px dashed ${el.color}` : '2px solid transparent',
                padding: '4px 8px',
                borderRadius: '4px',
                pointerEvents: 'auto',
                cursor: selectedTool === 'select' ? 'default' : 'crosshair',
                userSelect: 'none',
                whiteSpace: 'pre-wrap',
                minWidth: el.width ?? 80,
                lineHeight: 1.4,
              }}
            >
              {el.text}
            </div>
          )}
          {isSelected && !isEditing && renderResizeHandles(el)}
        </div>
      )
    }

    return null
  }

  const selectedEl = elements.find(el => el.id === selectedElement)
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < historyRef.current.length - 1

  const cursorStyle = selectedTool === 'select'
    ? (isDragging ? 'grabbing' : 'default')
    : 'crosshair'

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Carregando mapa mental...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* ── Main Toolbar ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <div className="bg-card border border-border rounded-xl shadow-lg p-2 flex items-center gap-1 flex-wrap">

          {/* Undo / Redo */}
          <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} className="h-9 w-9 p-0" title="Desfazer (Ctrl+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} className="h-9 w-9 p-0" title="Refazer (Ctrl+Y)">
            <Redo2 className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Tools */}
          {([
            { id: 'select', icon: <MousePointer className="h-4 w-4" />, title: 'Selecionar (S)' },
            { id: 'pen', icon: <Pencil className="h-4 w-4" />, title: 'Lápis (P)' },
          ] as const).map(t => (
            <Button key={t.id} variant={selectedTool === t.id ? 'secondary' : 'ghost'} size="sm"
              onClick={() => setSelectedTool(t.id)} className="h-9 w-9 p-0" title={t.title}>
              {t.icon}
            </Button>
          ))}

          <div className="w-px h-6 bg-border mx-1" />

          {([
            { id: 'rectangle', icon: <Square className="h-4 w-4" />, title: 'Retângulo' },
            { id: 'circle', icon: <Circle className="h-4 w-4" />, title: 'Círculo' },
            { id: 'line', icon: <Minus className="h-4 w-4" />, title: 'Linha' },
            { id: 'text', icon: <Type className="h-4 w-4" />, title: 'Texto' },
          ] as const).map(t => (
            <Button key={t.id} variant={selectedTool === t.id ? 'secondary' : 'ghost'} size="sm"
              onClick={() => setSelectedTool(t.id)} className="h-9 w-9 p-0" title={t.title}>
              {t.icon}
            </Button>
          ))}

          <div className="w-px h-6 bg-border mx-1" />

          {/* Stroke width slider */}
          <div className="flex items-center gap-2 px-1">
            <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-50 shrink-0">
              <circle cx="5" cy="5" r="1.5" fill="currentColor" />
            </svg>
            <input
              type="range" min={1} max={24} value={strokeWidth}
              onChange={e => setStrokeWidth(Number(e.target.value))}
              className="w-20 accent-primary"
              title={`Espessura: ${strokeWidth}px`}
            />
            <svg width="14" height="14" viewBox="0 0 14 14" className="opacity-50 shrink-0">
              <circle cx="7" cy="7" r="4" fill="currentColor" />
            </svg>
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Color swatches */}
          <div className="flex gap-1 px-1">
            {COLORS.map(color => (
              <button
                key={color}
                onClick={() => {
                  setSelectedColor(color)
                  if (selectedElement) updateProp(selectedElement, 'color', color)
                }}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  selectedColor === color ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color, boxShadow: color === '#FFFFFF' ? '0 0 0 1px #666 inset' : undefined }}
                title={color}
              />
            ))}
          </div>

          {selectedElement && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <Button variant="ghost" size="sm" onClick={deleteSelected}
                className="h-9 w-9 p-0 text-destructive hover:text-destructive" title="Excluir (Delete)">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Text Formatting Toolbar (shows when text element selected) ── */}
      {selectedEl?.type === 'text' && !editingElement && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-card border border-border rounded-xl shadow-lg p-2 flex items-center gap-2">

            {/* Font family */}
            <select
              value={selectedEl.fontFamily ?? 'Inter'}
              onChange={e => updateProp(selectedEl.id, 'fontFamily', e.target.value)}
              className="h-8 text-xs bg-background border border-border rounded px-2"
              style={{ fontFamily: selectedEl.fontFamily ?? 'Inter' }}
            >
              {FONTS.map(f => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
              ))}
            </select>

            {/* Font size */}
            <div className="flex items-center gap-1">
              <button onClick={() => updateProp(selectedEl.id, 'fontSize', Math.max(8, (selectedEl.fontSize ?? 16) - 2))}
                className="h-8 w-8 text-sm border border-border rounded hover:bg-muted flex items-center justify-center">−</button>
              <span className="text-xs w-8 text-center tabular-nums">{selectedEl.fontSize ?? 16}</span>
              <button onClick={() => updateProp(selectedEl.id, 'fontSize', Math.min(96, (selectedEl.fontSize ?? 16) + 2))}
                className="h-8 w-8 text-sm border border-border rounded hover:bg-muted flex items-center justify-center">+</button>
            </div>

            <div className="w-px h-6 bg-border" />

            {/* Bold */}
            <Button variant={selectedEl.fontWeight === 'bold' ? 'secondary' : 'ghost'} size="sm"
              className="h-8 w-8 p-0"
              onClick={() => updateProp(selectedEl.id, 'fontWeight', selectedEl.fontWeight === 'bold' ? 'normal' : 'bold')}
              title="Negrito">
              <Bold className="h-3.5 w-3.5" />
            </Button>

            {/* Italic */}
            <Button variant={selectedEl.fontStyle === 'italic' ? 'secondary' : 'ghost'} size="sm"
              className="h-8 w-8 p-0"
              onClick={() => updateProp(selectedEl.id, 'fontStyle', selectedEl.fontStyle === 'italic' ? 'normal' : 'italic')}
              title="Itálico">
              <Italic className="h-3.5 w-3.5" />
            </Button>

            <div className="w-px h-6 bg-border" />

            {/* Edit text button */}
            <Button variant="ghost" size="sm" className="h-8 px-3 text-xs"
              onClick={() => setEditingElement(selectedEl.id)}>
              Editar texto
            </Button>
          </div>
        </div>
      )}

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        className="flex-1 bg-background relative overflow-hidden select-none"
        style={{ cursor: cursorStyle, marginTop: selectedEl?.type === 'text' && !editingElement ? '6rem' : '4rem' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Grid + SVG elements */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border opacity-30" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Saved lines */}
          {elements.filter(el => el.type === 'line').map(el => (
            <line key={el.id}
              x1={el.x} y1={el.y} x2={el.x2} y2={el.y2}
              stroke={el.color}
              strokeWidth={selectedElement === el.id ? (el.strokeWidth ?? 2) + 1 : (el.strokeWidth ?? 2)}
              opacity={selectedElement === el.id ? 1 : 0.9}
              strokeLinecap="round"
            />
          ))}

          {/* Saved pen strokes */}
          {elements.filter(el => el.type === 'pen').map(el => (
            <path key={el.id}
              d={smoothPath(el.points ?? [])}
              stroke={el.color}
              strokeWidth={selectedElement === el.id ? (el.strokeWidth ?? 2) + 1 : (el.strokeWidth ?? 2)}
              fill="none"
              opacity={selectedElement === el.id ? 1 : 0.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Preview: line */}
          {currentElement?.type === 'line' && currentElement.x2 !== undefined && (
            <line x1={currentElement.x} y1={currentElement.y} x2={currentElement.x2} y2={currentElement.y2}
              stroke={currentElement.color} strokeWidth={currentElement.strokeWidth ?? 2}
              opacity={0.6} strokeLinecap="round" />
          )}

          {/* Preview: pen */}
          {currentElement?.type === 'pen' && (currentElement.points?.length ?? 0) > 1 && (
            <path d={smoothPath(currentElement.points ?? [])}
              stroke={currentElement.color} strokeWidth={currentElement.strokeWidth ?? 2}
              fill="none" opacity={0.7} strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>

        {/* DOM elements (rect, circle, text) */}
        {elements
          .filter(el => el.type !== 'line' && el.type !== 'pen')
          .map(el => renderElement(el, el.id === selectedElement))}

        {/* Drawing preview (rect, circle, text) */}
        {currentElement && currentElement.type !== 'line' && currentElement.type !== 'pen' &&
          renderElement(currentElement)}

        {/* Empty state hint */}
        {elements.length === 0 && !isDrawing && (
          <div className="absolute bottom-8 left-8 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-4 max-w-xs">
            <div className="text-sm font-semibold mb-2">Canvas Interativo</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Lápis</kbd> — desenho livre suavizado</p>
              <p>• Formas e linhas com espessura ajustável</p>
              <p>• <strong>Duplo clique</strong> no texto para editar</p>
              <p>• <strong>Selecionar</strong> + arrastar alças para redimensionar</p>
              <p>• <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+Z</kbd> desfaz · <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+Y</kbd> refaz</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
