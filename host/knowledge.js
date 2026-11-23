// 知识中枢 · Host 半边
//
// 真身：Q:\能力中枢\data\atoms\ke_*.md（文件为真身，索引可重建）
// 工具：ke_search / ke_get / ke_save / ke_decide / ke_pending / ke_revert / ke_history
// 规则：写入先判定相似与冲突，列给用户；用户不在就存 pending，不擅自合并。
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

export const name = 'knowledge-hub'
export const inject = ['tools', 'webServer']

const ROOT = process.env.DSH_KNOWLEDGE_HUB_DATA || 'Q:\\能力中枢\\data'
const ATOMS = path.join(ROOT, 'atoms')
const LOGS = path.join(ROOT, 'logs')

const text = (value) => [{ type: 'text', text: value }]

let cache = { at: 0, items: [] }

function parseFrontmatter(source) {
  if (!source.startsWith('---')) return {}
  const end = source.indexOf('\n---', 3)
  if (end < 0) return {}
  const out = {}
  const lines = source.slice(3, end).split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line || line.startsWith(' ') || line.startsWith('\t') || line.startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (value === '>-' || value === '>' || value === '|' || value === '|-') {
      const block = []
      i += 1
      while (i < lines.length && (lines[i].startsWith(' ') || lines[i].startsWith('\t') || !lines[i].trim())) {
        block.push(lines[i].trim())
        i += 1
      }
      i -= 1
      out[key] = block.filter(Boolean).join(' ')
      continue
    }
    out[key] = value.replace(/^["']|["']$/g, '')
  }
  return out
}

function bodyOf(source) {
  const end = source.indexOf('\n---', 3)
  if (end < 0) return ''
  return source.slice(end + 4).replace(/^\n+/, '')
}

function listOf(raw) {
  if (!raw) return []
  const s = String(raw).trim()
  const inner = s.startsWith('[') && s.endsWith(']') ? s.slice(1, -1) : s
  return inner.split(',').map((x) => x.trim()).filter(Boolean)
}

export function scanAtoms() {
  const now = Date.now()
  if (now - cache.at < 30_000 && cache.items.length) return cache.items
  if (!existsSync(ATOMS)) throw new Error(`知识元目录不存在：${ATOMS}`)
  const items = []
  for (const name of readdirSync(ATOMS)) {
    if (!name.endsWith('.md') || !name.startsWith('ke_')) continue
    const p = path.join(ATOMS, name)
    const source = readFileSync(p, 'utf8')
    const fm = parseFrontmatter(source)
    if (!fm.id) continue
    items.push({
      ...fm,
      tags: listOf(fm.tags),
      sections: listOf(fm.sections),
      body: bodyOf(source),
      path: p,
      mtime: 0,
    })
  }
  cache = { at: now, items }
  return items
}

function byId(id) {
  const item = scanAtoms().find((a) => a.id === id)
  if (!item) throw new Error(`知识元不存在：${id}`)
  return item
}

function bg(title) {
  return String(title).replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').toLowerCase()
}

function bigrams(s) {
  const set = new Set()
  for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2))
  return set
}

function overlap(a, b) {
  if (!a.size || !b.size) return 0
  let hit = 0
  for (const x of a) if (b.has(x)) hit += 1
  return hit / Math.min(a.size, b.size)
}

function candidatesFor(meta) {
  const t = bigrams(bg(meta.title))
  const out = []
  for (const item of scanAtoms()) {
    if (item.id === meta.id) continue
    if (!['active', 'stale', 'draft'].includes(item.status)) continue
    const titleSim = overlap(t, bigrams(bg(item.title)))
    if (titleSim > 0.4) {
      out.push({ id: item.id, title: item.title, status: item.status, reason: titleSim > 0.6 ? '标题高度相似' : '标题相似' })
    }
  }
  return out.slice(0, 5)
}

function yamlField(key, value) {
  if (Array.isArray(value)) return `${key}: [${value.join(', ')}]`
  return `${key}: ${value}`
}

function serialize(meta, body) {
  const order = ['id', 'kind', 'title', 'category', 'sub', 'source', 'tier', 'status', 'verified_at', 'sections']
  const lines = ['---']
  for (const key of order) {
    const value = meta[key]
    if (value === undefined || value === null || value === '') continue
    lines.push(yamlField(key, value))
  }
  lines.push('---', '', body.trim(), '')
  return lines.join('\n')
}

function writeAtom(meta, body) {
  const p = path.join(ATOMS, `${meta.id}.md`)
  writeFileSync(p, serialize(meta, body), 'utf8')
  cache = { at: 0, items: [] }
  return p
}

function log(name, payload) {
  try {
    if (!existsSync(LOGS)) mkdirSync(LOGS, { recursive: true })
    appendFileSync(path.join(LOGS, `${name}.jsonl`), `${JSON.stringify({ at: new Date().toISOString(), ...payload })}\n`)
  } catch {
    // 日志失败不影响主流程
  }
}

function setStatus(id, status, note) {
  const item = byId(id)
  const source = readFileSync(item.path, 'utf8')
  const next = source.replace(/^status:\s*\w+$/m, `status: ${status}`)
  writeFileSync(item.path, next, 'utf8')
  cache = { at: 0, items: [] }
  log('atom-decisions', { id, status, note: note || '' })
  return { id, status }
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(body)
}

async function rpcAction(body) {
  const action = String(body.action || '')
  if (action === 'list') {
    const q = String(body.q || '').trim().toLowerCase()
    const status = body.status || 'active'
    const items = scanAtoms()
      .filter((a) => (status === 'all' ? ['active', 'stale', 'pending', 'draft'].includes(a.status) : a.status === status))
      .filter((a) => !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q))
      .slice(0, 200)
      .map((a) => ({ id: a.id, title: a.title, status: a.status, chars: a.body.length, category: a.category }))
    return { items, total: items.length }
  }
  if (action === 'get') {
    const a = byId(String(body.id || ''))
    return { id: a.id, title: a.title, body: a.body, status: a.status, source: a.source, tier: a.tier }
  }
  if (action === 'decide') {
    const id = String(body.id || '')
    const act = String(body.action2 || body.decision || '')
    if (act === 'accept') return setStatus(id, 'active', 'ui')
    if (act === 'pending') return setStatus(id, 'pending', 'ui')
    if (act === 'discard') return setStatus(id, 'discarded', 'ui')
    throw new Error(`未知裁定：${act}`)
  }
  if (action === 'update_meta') {
    const id = String(body.id || '')
    const a = byId(id)
    const patch = body.patch || {}
    const source = readFileSync(a.path, 'utf8')
    let next = source
    for (const key of ['title', 'category', 'sub']) {
      if (patch[key] === undefined) continue
      const line = `${key}: ${String(patch[key]).replace(/\n/g, ' ')}`
      if (new RegExp(`^${key}:.*$`, 'm').test(next)) next = next.replace(new RegExp(`^${key}:.*$`, 'm'), line)
      else next = next.replace(/^id: .*$/m, (m) => `${m}\n${line}`)
    }
    writeFileSync(a.path, next, 'utf8')
    cache = { at: 0, items: [] }
    log('atom-meta-edits', { id, patch })
    return { id, title: patch.title ?? a.title, category: patch.category ?? a.category, sub: patch.sub ?? a.sub }
  }
  if (action === 'counts') {
    const all = scanAtoms()
    return { total: all.length, active: all.filter((a) => a.status === 'active').length, pending: all.filter((a) => a.status === 'pending').length }
  }
  throw new Error(`未知 action：${action}`)
}

export function buildTools() {
  return [
    {
      name: 'ke_search',
      description:
        '检索知识中枢的知识元（按标题与正文）。返回命中元与命中片段。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string', description: '关键词；2 字也能搜' },
          limit: { type: 'integer', minimum: 1, maximum: 20 },
          include_pending: { type: 'boolean', description: '是否包含待裁定元，默认 false' },
        },
        required: ['query'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['count', 'items'],
          properties: {
            count: { type: 'integer' },
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
        render: (_a, v) =>
          text(v.count ? v.items.map((i) => `[${i.status}] ${i.id} ${i.title}\n   ${i.snippet}`).join('\n') : '无命中'),
      },
      execute(rawArgs) {
        const q = String(rawArgs?.query || '').trim().toLowerCase()
        const limit = Math.min(Math.max(rawArgs?.limit || 5, 1), 20)
        const statuses = rawArgs?.include_pending ? ['active', 'stale', 'pending'] : ['active', 'stale']
        const items = scanAtoms()
          .filter((a) => statuses.includes(a.status))
          .filter((a) => !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q))
          .sort((a, b) => {
            const at = a.title.toLowerCase().includes(q) ? 0 : 1
            const bt = b.title.toLowerCase().includes(q) ? 0 : 1
            return at - bt || a.body.length - b.body.length
          })
          .slice(0, limit)
        return {
          count: items.length,
          items: items.map((a) => ({ id: a.id, title: a.title, status: a.status, chars: a.body.length, snippet: a.body.replace(/\s+/g, ' ').slice(0, 160) })),
        }
      },
    },
    {
      name: 'ke_get',
      description: '取一个知识元的完整正文。',
      parameters: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' } }, required: ['id'] },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['id', 'title', 'body'], properties: { id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, status: { type: 'string' } } },
        render: (_a, v) => text(v.body),
      },
      execute(rawArgs) {
        const a = byId(String(rawArgs?.id || ''))
        return { id: a.id, title: a.title, body: a.body, status: a.status }
      },
    },
    {
      name: 'ke_save',
      description:
        '新建或覆盖一个知识元。写入前会比对相似与冲突：有候选就返回候选并默认存为 pending，等用户裁定；用户在场且已确认才传 force。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'ke_<域>_<序号>，全库唯一' },
          title: { type: 'string' },
          kind: { type: 'string', enum: ['knowledge', 'document'] },
          category: { type: 'string' },
          sub: { type: 'string' },
          source: { type: 'string' },
          tier: { type: 'string', enum: ['S', 'A', 'B', 'C'] },
          body: { type: 'string' },
          force: { type: 'boolean', description: '用户已确认合并/接受时用，跳过 pending' },
        },
        required: ['id', 'title', 'source', 'tier', 'body'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'status', 'path', 'candidates'],
          properties: { id: { type: 'string' }, status: { type: 'string' }, path: { type: 'string' }, candidates: { type: 'array', items: { type: 'object', additionalProperties: true } } },
        },
        render: (_a, v) =>
          text(
            v.candidates.length
              ? `已写入 ${v.id}（${v.status}）。候选：\n${v.candidates.map((c) => `- ${c.id} ${c.title}：${c.reason}`).join('\n')}\n请裁定合并 / 并存 / 替换 / 挂起。`
              : `已写入 ${v.id}（${v.status}）。`,
          ),
      },
      execute(rawArgs) {
        const a = rawArgs || {}
        const body = String(a.body || '').trim()
        if (body.length > 6000) throw new Error(`正文 ${body.length} 字，超过 6000，请拆元`)
        const meta = {
          id: String(a.id),
          kind: a.kind || 'knowledge',
          title: a.title,
          category: a.category || '',
          sub: a.sub || '',
          source: a.source,
          tier: a.tier,
          status: 'draft',
          verified_at: new Date().toISOString().slice(0, 10),
          sections: [],
        }
        const candidates = candidatesFor(meta)
        let status = a.force ? 'active' : candidates.length ? 'pending' : 'active'
        meta.status = status
        const p = writeAtom(meta, body)
        log('atom-writes', { id: meta.id, status, candidates: candidates.map((c) => c.id) })
        return { id: meta.id, status, path: p, candidates }
      },
    },
    {
      name: 'ke_decide',
      description: '对 pending 或新建的元做裁定：accept 直接生效、merge 旧元并入、replace 替代旧元、coexist 并存、discard 丢弃。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: '要裁定的元 id' },
          action: { type: 'string', enum: ['accept', 'merge', 'replace', 'coexist', 'discard'] },
          other: { type: 'string', description: '关联的旧元 id（merge/replace/coexist 用）' },
          note: { type: 'string' },
        },
        required: ['id', 'action'],
      },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['id', 'status', 'other'], properties: { id: { type: 'string' }, status: { type: 'string' }, other: { type: 'string' } } },
        render: (_a, v) => text(v.other ? `已裁定：${v.id} → ${v.status}，${v.other} 已同步。` : `已裁定：${v.id} → ${v.status}。`),
      },
      execute(rawArgs) {
        const id = String(rawArgs?.id || '')
        const action = String(rawArgs?.action || '')
        const other = String(rawArgs?.other || '')
        if (action === 'accept') return { ...setStatus(id, 'active', rawArgs?.note), other: '' }
        if (action === 'discard') return { ...setStatus(id, 'discarded', rawArgs?.note), other: '' }
        if (!other) throw new Error('merge / replace / coexist 需要 other（旧元 id）')
        if (action === 'merge') {
          setStatus(other, 'merged', `并入 ${id}`)
          return { ...setStatus(id, 'active', `吸收 ${other}`), other }
        }
        if (action === 'replace') {
          setStatus(other, 'superseded', `被 ${id} 替代`)
          return { ...setStatus(id, 'active', `替代 ${other}`), other }
        }
        setStatus(other, 'active', `与 ${id} 并存`)
        return { ...setStatus(id, 'active', `与 ${other} 并存`), other }
      },
    },
    {
      name: 'ke_pending',
      description: '列出待裁定的知识元（status: pending），以及候选元。',
      parameters: { type: 'object', additionalProperties: false, properties: {} },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['count', 'items'], properties: { count: { type: 'integer' }, items: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
        render: (_a, v) => text(v.count ? v.items.map((i) => `- ${i.id} ${i.title}（待裁定）`).join('\n') : '没有待裁定的元'),
      },
      execute() {
        const items = scanAtoms().filter((a) => a.status === 'pending').map((a) => ({ id: a.id, title: a.title }))
        return { count: items.length, items }
      },
    },
    {
      name: 'ke_revert',
      description: '用 git 回退一个知识元到指定提交；不传 commit 时回退到上一版。只在用户明确要回退时调用。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'string' }, commit: { type: 'string', description: '可选，git commit hash' } },
        required: ['id'],
      },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['id', 'commit'], properties: { id: { type: 'string' }, commit: { type: 'string' } } },
        render: (_a, v) => text(`已回退 ${v.id} 到 ${v.commit}，重建索引后生效。`),
      },
      execute(rawArgs) {
        const id = String(rawArgs?.id || '')
        byId(id)
        let commit = String(rawArgs?.commit || '')
        const rel = `atoms/${id}.md`
        if (!commit) {
          const logText = execFileSync('git', ['-C', ROOT, 'log', '--format=%H', '--', rel], { encoding: 'utf8' })
          const hashes = logText.split('\n').filter(Boolean)
          if (hashes.length < 2) throw new Error(`${id} 只有一个版本，无法回退`)
          commit = hashes[1]
        }
        execFileSync('git', ['-C', ROOT, 'checkout', commit, '--', rel], { encoding: 'utf8' })
        log('atom-reverts', { id, commit })
        cache = { at: 0, items: [] }
        return { id, commit }
      },
    },
    {
      name: 'ke_history',
      description: '看一个知识元的 git 版本历史（最近 10 条）。',
      parameters: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' } }, required: ['id'] },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['id', 'items'], properties: { id: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } } },
        render: (_a, v) => text(v.items.length ? v.items.join('\n') : '没有版本记录'),
      },
      execute(rawArgs) {
        const id = String(rawArgs?.id || '')
        const out = execFileSync('git', ['-C', ROOT, 'log', '--oneline', '-10', '--', `atoms/${id}.md`], { encoding: 'utf8' })
        return { id, items: out.split('\n').filter(Boolean) }
      },
    },
  ]
}

export function apply(ctx) {
  for (const tool of buildTools()) ctx.effect(() => ctx.tools.register(tool))
  if (ctx.webServer) {
    ctx.effect(() =>
      ctx.webServer.register({
        kind: 'prefix',
        path: '/hub/api/rpc',
        async handler(req, res) {
          if (req.method !== 'POST') {
            res.writeHead(405, { allow: 'POST' })
            res.end()
            return
          }
          try {
            const body = await readJson(req)
            sendJson(res, 200, { ok: true, data: await rpcAction(body) })
          } catch (error) {
            sendJson(res, 400, { ok: false, error: error.message })
          }
        },
      }),
    )
  }
  const systemPrompt = ctx.get?.('systemPrompt')
  if (systemPrompt) {
    ctx.effect(() =>
      systemPrompt.section({
        name: 'knowledge-hub',
        order: 43,
        text: () =>
          '用户的知识中枢里有知识元（ke_*）。查知识先 ke_search，取正文用 ke_get；写入用 ke_save，有候选就列给用户裁定，不要擅自合并；用户不在就留 pending。',
      }),
    )
  }
}
