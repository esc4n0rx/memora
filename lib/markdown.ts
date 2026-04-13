// ─── Lightweight syntax highlighter ─────────────────────────────────────────

const KW: Record<string, string[]> = {
  js: [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'class', 'new', 'import', 'export', 'default', 'from', 'async', 'await',
    'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'null',
    'undefined', 'true', 'false', 'this', 'super', 'extends', 'of', 'in',
    'switch', 'case', 'break', 'continue', 'delete', 'void', 'static',
    'get', 'set', 'type', 'interface', 'enum', 'namespace', 'as', 'readonly',
  ],
  py: [
    'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while',
    'import', 'from', 'as', 'with', 'try', 'except', 'finally', 'raise',
    'in', 'not', 'and', 'or', 'is', 'None', 'True', 'False', 'pass',
    'break', 'continue', 'lambda', 'yield', 'global', 'nonlocal', 'del',
    'async', 'await', 'assert',
  ],
  bash: [
    'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done',
    'case', 'esac', 'in', 'function', 'return', 'exit', 'echo', 'export',
    'source', 'local', 'readonly', 'unset', 'shift', 'true', 'false',
  ],
  sql: [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
    'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'INSERT', 'INTO',
    'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER',
    'ADD', 'COLUMN', 'INDEX', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
    'UNIQUE', 'NULL', 'DEFAULT', 'AS', 'ORDER', 'BY', 'GROUP', 'HAVING',
    'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT', 'EXISTS', 'CASE', 'WHEN',
    'THEN', 'END', 'WITH', 'RETURNING', 'CONSTRAINT',
  ],
}

const BUILTINS: Record<string, string[]> = {
  js: ['console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number',
       'Boolean', 'Promise', 'Error', 'Map', 'Set', 'Date', 'parseInt',
       'parseFloat', 'setTimeout', 'fetch', 'window', 'document', 'require',
       'module', 'process', 'Buffer'],
  py: ['print', 'len', 'range', 'list', 'dict', 'set', 'tuple', 'str',
       'int', 'float', 'bool', 'type', 'isinstance', 'hasattr', 'getattr',
       'setattr', 'open', 'enumerate', 'zip', 'map', 'filter', 'sorted',
       'reversed', 'sum', 'min', 'max', 'abs', 'round', 'super'],
  bash: [], sql: [],
}

const LANG_MAP: Record<string, string> = {
  js: 'js', jsx: 'js', javascript: 'js',
  ts: 'js', tsx: 'js', typescript: 'js',
  py: 'py', python: 'py',
  sh: 'bash', bash: 'bash', shell: 'bash', zsh: 'bash',
  sql: 'sql',
}

function escHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type TokType = 'string' | 'comment' | 'keyword' | 'number' | 'builtin' | 'plain'

function tokenize(code: string, lang: string): { type: TokType; value: string }[] {
  const nLang = LANG_MAP[lang.toLowerCase()] || 'js'
  const kws = new Set(KW[nLang] || KW.js)
  const builtins = new Set(BUILTINS[nLang] || [])
  const isPy = nLang === 'py'
  const isSql = nLang === 'sql'
  const isBash = nLang === 'bash'

  const tokens: { type: TokType; value: string }[] = []
  let i = 0

  const push = (type: TokType, value: string) => {
    if (!value) return
    const last = tokens[tokens.length - 1]
    if (type === 'plain' && last?.type === 'plain') last.value += value
    else tokens.push({ type, value })
  }

  while (i < code.length) {
    const ch = code[i], ch2 = code[i + 1]

    if (ch === '/' && ch2 === '/' && !isSql) {
      const end = code.indexOf('\n', i); const j = end === -1 ? code.length : end
      push('comment', code.slice(i, j)); i = j; continue
    }
    if ((isPy || isBash) && ch === '#') {
      const end = code.indexOf('\n', i); const j = end === -1 ? code.length : end
      push('comment', code.slice(i, j)); i = j; continue
    }
    if (isSql && ch === '-' && ch2 === '-') {
      const end = code.indexOf('\n', i); const j = end === -1 ? code.length : end
      push('comment', code.slice(i, j)); i = j; continue
    }
    if (ch === '/' && ch2 === '*') {
      const end = code.indexOf('*/', i + 2); const j = end === -1 ? code.length : end + 2
      push('comment', code.slice(i, j)); i = j; continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < code.length) {
        if (code[j] === '\\') { j += 2; continue }
        if (code[j] === ch) { j++; break }
        j++
      }
      push('string', code.slice(i, j)); i = j; continue
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(ch2 ?? ''))) {
      let j = i
      while (j < code.length && /[0-9._xXa-fA-FbBoO]/.test(code[j])) j++
      push('number', code.slice(i, j)); i = j; continue
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++
      const word = code.slice(i, j)
      const check = isSql ? word.toUpperCase() : word
      if (kws.has(check) || (isSql && kws.has(word))) push('keyword', word)
      else if (builtins.has(word)) push('builtin', word)
      else push('plain', word)
      i = j; continue
    }
    push('plain', ch); i++
  }
  return tokens
}

export function highlightCode(code: string, lang: string): string {
  if (!lang || lang === 'plaintext' || lang === 'text') return escHtml(code)
  try {
    return tokenize(code, lang).map(t => {
      const v = escHtml(t.value)
      switch (t.type) {
        case 'keyword': return `<span style="color:#ff7b72">${v}</span>`
        case 'string':  return `<span style="color:#a5d6ff">${v}</span>`
        case 'number':  return `<span style="color:#79c0ff">${v}</span>`
        case 'comment': return `<span style="color:#8b949e;font-style:italic">${v}</span>`
        case 'builtin': return `<span style="color:#ffa657">${v}</span>`
        default:        return v
      }
    }).join('')
  } catch { return escHtml(code) }
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

const BLOCK_SEP = '\x00'

export function renderInline(text: string): string {
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="max-w-full rounded-lg my-2 border border-border" loading="lazy"/>')
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">$1</a>')
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
  text = text.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
  text = text.replace(/__(.+?)__/g, '<strong class="font-bold">$1</strong>')
  text = text.replace(/_(.+?)_/g, '<em class="italic">$1</em>')
  text = text.replace(/~~(.+?)~~/g, '<del class="opacity-50 line-through">$1</del>')
  text = text.replace(/`([^`]+)`/g,
    '<code class="bg-muted/80 px-1.5 py-0.5 rounded text-sm font-mono" style="color:#79c0ff">$1</code>')
  return text
}

export function renderMarkdown(raw: string): string {
  if (!raw.trim()) return '<p class="text-muted-foreground italic text-sm">Nenhum conteúdo ainda...</p>'

  const codeBlocks: string[] = []
  let text = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const language = (lang ?? '').trim()
    const highlighted = highlightCode(code.trimEnd(), language)
    const displayLang = language || 'texto'
    const block =
      `<div class="my-4 rounded-lg overflow-hidden border border-border">` +
        `<div class="flex items-center gap-2 px-4 py-2 border-b border-border" style="background:#161b22">` +
          `<span class="flex gap-1.5">` +
            `<span class="w-3 h-3 rounded-full" style="background:#ff5f57"></span>` +
            `<span class="w-3 h-3 rounded-full" style="background:#febc2e"></span>` +
            `<span class="w-3 h-3 rounded-full" style="background:#28c840"></span>` +
          `</span>` +
          `<span class="text-xs font-mono ml-2" style="color:#8b949e">${displayLang}</span>` +
        `</div>` +
        `<pre class="p-4 overflow-x-auto m-0 text-sm" style="background:#0d1117;color:#c9d1d9">` +
          `<code class="font-mono leading-6">${highlighted}</code>` +
        `</pre>` +
      `</div>`
    const idx = codeBlocks.length
    codeBlocks.push(block)
    return `${BLOCK_SEP}CODE${idx}${BLOCK_SEP}`
  })

  const tables: string[] = []
  text = text.replace(
    /(\|[^\n]+\|\n)((?:\|[ :|-]+\|\n))((?:\|[^\n]+\|\n?)*)/gm,
    (_, header, _sep, rows) => {
      const parseRow = (r: string) =>
        r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const ths = parseRow(header)
        .map(h => `<th class="border border-border px-3 py-2 text-left text-sm font-semibold bg-muted/50">${renderInline(h)}</th>`)
        .join('')
      const trs = rows.trim().split('\n').filter(Boolean)
        .map((row: string) => `<tr class="even:bg-muted/20">${parseRow(row).map(c => `<td class="border border-border px-3 py-2 text-sm">${renderInline(c)}</td>`).join('')}</tr>`)
        .join('')
      const table = `<div class="my-4 overflow-x-auto"><table class="w-full border-collapse"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
      const idx = tables.length
      tables.push(table)
      return `${BLOCK_SEP}TABLE${idx}${BLOCK_SEP}`
    }
  )

  const blocks = text.split(/\n\n+/)

  function processBlock(block: string): string {
    block = block.trim()
    if (!block) return ''

    const codeMatch = block.match(new RegExp(`^${BLOCK_SEP}CODE(\\d+)${BLOCK_SEP}$`))
    if (codeMatch) return codeBlocks[+codeMatch[1]]
    const tableMatch = block.match(new RegExp(`^${BLOCK_SEP}TABLE(\\d+)${BLOCK_SEP}$`))
    if (tableMatch) return tables[+tableMatch[1]]

    const lines = block.split('\n')
    const isUL = lines.every(l => /^[\-\*\+] /.test(l) || !l.trim())
    const isOL = lines.every(l => /^\d+\. /.test(l) || !l.trim())
    if (isUL || isOL) {
      const items = lines.filter(l => l.trim()).map(line => {
        const content = line.replace(/^[\-\*\+] /, '').replace(/^\d+\. /, '')
        if (/^\[ \] /.test(content)) return `<li class="flex gap-2 items-start my-0.5"><input type="checkbox" disabled class="mt-1 shrink-0"/><span>${renderInline(content.slice(4))}</span></li>`
        if (/^\[x\] /i.test(content)) return `<li class="flex gap-2 items-start my-0.5"><input type="checkbox" checked disabled class="mt-1 shrink-0"/><span class="line-through opacity-60">${renderInline(content.slice(4))}</span></li>`
        return `<li class="${isOL ? 'list-decimal ml-5' : 'list-disc ml-5'} my-0.5">${renderInline(content)}</li>`
      }).join('')
      return `<${isOL ? 'ol' : 'ul'} class="my-3">${items}</${isOL ? 'ol' : 'ul'}>`
    }
    if (lines.every(l => l.startsWith('> '))) {
      const inner = lines.map(l => renderInline(l.slice(2))).join('<br/>')
      return `<blockquote class="border-l-4 pl-4 py-1 my-4 rounded-r italic text-muted-foreground" style="border-color:#3b82f6;background:rgba(59,130,246,0.06)">${inner}</blockquote>`
    }

    const out: string[] = []
    const para: string[] = []
    const flushPara = () => {
      if (!para.length) return
      out.push(`<p class="my-2 leading-7">${para.join('<br/>')}</p>`)
      para.length = 0
    }
    for (const line of lines) {
      const cm = line.match(new RegExp(`^${BLOCK_SEP}CODE(\\d+)${BLOCK_SEP}$`))
      if (cm) { flushPara(); out.push(codeBlocks[+cm[1]]); continue }
      const hm = line.match(/^(#{1,4}) (.+)/)
      if (hm) {
        flushPara()
        const level = hm[1].length
        const cls = ['text-2xl font-bold mt-6 mb-3 pb-2 border-b border-border','text-xl font-semibold mt-5 mb-2','text-lg font-semibold mt-4 mb-2','text-base font-semibold mt-3 mb-1'][level - 1]
        out.push(`<h${level} class="${cls}">${renderInline(hm[2])}</h${level}>`); continue
      }
      if (/^[-*_]{3,}$/.test(line)) { flushPara(); out.push('<hr class="my-6 border-border"/>'); continue }
      if (line.startsWith('> ')) {
        flushPara()
        out.push(`<blockquote class="border-l-4 pl-4 py-0.5 my-2 rounded-r italic text-muted-foreground" style="border-color:#3b82f6;background:rgba(59,130,246,0.06)">${renderInline(line.slice(2))}</blockquote>`)
        continue
      }
      if (!line.trim()) { flushPara(); continue }
      para.push(renderInline(line))
    }
    flushPara()
    return out.join('\n')
  }

  return blocks.map(processBlock).filter(Boolean).join('\n')
}
