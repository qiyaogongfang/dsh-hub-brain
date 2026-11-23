// 技能环 · Host 半边
//
// 数据真身：Q:\能力中枢\data\skills\<name>\SKILL.md（文件为真身，技能.db 只是索引）
// 工具：skill_search / skill_load / skill_list / skill_health
// 原则：不预载 97 个技能，按需检索 + 显式加载，每次加载记一行日志。
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const name = 'skill-ring'
export const inject = ['tools', 'webServer']

const DATA_ROOT = process.env.DSH_SKILL_RING_DATA || 'Q:\\能力中枢\\data'
const SKILLS_DIR = path.join(DATA_ROOT, 'skills')
const LOG_DIR = path.join(DATA_ROOT, 'logs')
const CACHE_MS = 60_000

const text = (value) => [{ type: 'text', text: value }]

const statePath = path.join(DATA_ROOT, 'state', 'current-role.json')
function pickedSkills() {
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    return Array.isArray(state.skills) ? state.skills : []
  } catch {
    return []
  }
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

let roleOwners = null
function ownersOf(skill) {
  if (!roleOwners) {
    roleOwners = {}
    try {
      for (const d of readdirSync(path.join(DATA_ROOT, 'roles'), { withFileTypes: true })) {
        if (!d.isDirectory()) continue
        try {
          const meta = JSON.parse(readFileSync(path.join(DATA_ROOT, 'roles', d.name, 'role.json'), 'utf8'))
          for (const s of meta.allowed_skills || []) {
            roleOwners[s] = roleOwners[s] || []
            roleOwners[s].push(meta.id || d.name)
          }
        } catch {
          /* 跳过坏角色 */
        }
      }
    } catch {
      roleOwners = {}
    }
  }
  return roleOwners[skill] || []
}

async function rpcAction(body) {
  const action = String(body.action || '')
  if (action === 'list') {
    const q = String(body.q || '').trim().toLowerCase()
    const kind = body.kind || ''
    const items = scanSkills()
      .filter((i) => i.status === 'active')
      .filter((i) => (kind ? i.kind === kind : true))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || String(I18N[i.name] || i.summary).toLowerCase().includes(q) || i.summary.toLowerCase().includes(q))
      .slice(0, 500)
    return { items: items.map((i) => ({ name: i.name, kind: i.kind, summary: I18N[i.name] || i.summary, tags: i.tags, owners: ownersOf(i.name) })) }
  }
  if (action === 'get') {
    const name = String(body.name || '')
    const loaded = loadBody(name)
    const meta = scanSkills().find((i) => i.name === name)
    return { name, path: loaded.path, chars: loaded.chars, body: loaded.body, kind: meta?.kind || '', summary: I18N[name] || meta?.summary || '', owners: ownersOf(name) }
  }
  if (action === 'counts') {
    const all = scanSkills()
    return { total: all.length, active: all.filter((i) => i.status === 'active').length, retired: all.filter((i) => i.status === 'retired').length }
  }
  if (action === 'create') {
    const name = String(body.name || '').trim()
    const description = String(body.description || '').trim()
    if (!name || /[\\/]|\.\./.test(name)) throw new Error('技能名必填且不能含路径分隔符')
    const dir = path.join(SKILLS_DIR, name)
    if (existsSync(dir)) throw new Error(`技能已存在：${name}`)
    mkdirSync(dir, { recursive: true })
    const md = ['---', `name: ${name}`, `description: ${description || name}`, '---', '', `# ${name}`, '', body.body || description || '', ''].join('\n')
    writeFileSync(path.join(dir, 'SKILL.md'), md, 'utf8')
    try {
      const i18nPath = path.join(DATA_ROOT, 'skills-i18n.json')
      const dict = existsSync(i18nPath) ? JSON.parse(readFileSync(i18nPath, 'utf8')) : {}
      dict[name] = description || name
      writeFileSync(i18nPath, JSON.stringify(dict, null, 2) + '\n', 'utf8')
    } catch {
      /* i18n 失败不影响技能创建 */
    }
    cache = { at: 0, items: [] }
    return { name, path: path.join(dir, 'SKILL.md') }
  }
  if (action === 'delete') {
    const name = String(body.name || '')
    if (!name || /[\\/]|\.\./.test(name)) throw new Error('非法技能名')
    const dir = path.join(SKILLS_DIR, name)
    if (!existsSync(dir)) throw new Error(`技能不存在：${name}`)
    rmSync(dir, { recursive: true, force: true })
    try {
      const i18nPath = path.join(DATA_ROOT, 'skills-i18n.json')
      if (existsSync(i18nPath)) {
        const dict = JSON.parse(readFileSync(i18nPath, 'utf8'))
        delete dict[name]
        writeFileSync(i18nPath, JSON.stringify(dict, null, 2) + '\n', 'utf8')
      }
    } catch {
      /* 忽略 */
    }
    cache = { at: 0, items: [] }
    return { name }
  }
  throw new Error(`未知 action：${action}`)
}

let cache = { at: 0, items: [] }

let I18N = {}
try {
  I18N = JSON.parse(readFileSync('Q:\\能力中枢\\data\\skills-i18n.json', 'utf8'))
} catch {
  I18N = {}
}


function frontmatter(source) {
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

export function scanSkills() {
  const now = Date.now()
  if (now - cache.at < CACHE_MS && cache.items.length) return cache.items
  if (!existsSync(SKILLS_DIR)) throw new Error(`技能目录不存在：${SKILLS_DIR}（检查 data 根或 DSH_SKILL_RING_DATA）`)
  const items = []
  for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const md = path.join(SKILLS_DIR, entry.name, 'SKILL.md')
    if (!existsSync(md)) continue
    let fm = {}
    try {
      fm = frontmatter(readFileSync(md, 'utf8'))
    } catch {
      fm = {}
    }
    const retired = entry.name.startsWith('eco-rs-') && entry.name !== 'eco-rs-master'
    items.push({
      name: entry.name,
      kind: entry.name.startsWith('role-') ? 'role' : 'general',
      status: retired ? 'retired' : 'active',
      summary: fm.description || '',
      version: fm.version || '',
      tags: fm.tags || '',
      entry: `skills\\${entry.name}\\SKILL.md`,
      mtime: statSync(md).mtimeMs,
    })
  }
  items.sort((a, b) => a.name.localeCompare(b.name))
  cache = { at: now, items }
  return items
}

function pick(items, { query = '', kind, status = 'active', limit = 8 }) {
  const q = String(query || '').trim().toLowerCase()
  return items
    .filter((item) => item.status === status)
    .filter((item) => (kind ? item.kind === kind : true))
    .filter((item) => {
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        String(item.tags).toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const an = q && a.name.toLowerCase().includes(q) ? 0 : 1
      const bn = q && b.name.toLowerCase().includes(q) ? 0 : 1
      return an - bn || a.name.localeCompare(b.name)
    })
    .slice(0, Math.min(Math.max(limit, 1), 30))
}

function resolveSkill(name) {
  if (!name || /[\\/]/.test(name) || name.includes('..')) throw new Error(`非法技能名：${name}`)
  const dir = path.join(SKILLS_DIR, name)
  const md = path.join(dir, 'SKILL.md')
  if (!existsSync(md)) throw new Error(`技能不存在：${name}`)
  return { dir, md }
}

function loadBody(name) {
  const { md } = resolveSkill(name)
  const raw = readFileSync(md, 'utf8')
  const body = raw.length > 40000 ? `${raw.slice(0, 40000)}\n\n…（已截断，完整内容见 ${md}）` : raw
  try {
    // 审计：谁在什么时候加载了哪个技能（失败不影响主流程）
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
    appendFileSync(
      path.join(LOG_DIR, 'skill-load.jsonl'),
      `${JSON.stringify({ at: new Date().toISOString(), skill: name })}\n`,
    )
  } catch {
    // 忽略日志失败
  }
  return { path: md, body, chars: raw.length }
}

export function buildTools() {  return [
    {
      name: 'skill_search',
      description:
        '检索技能环里的技能（97 个，按需加载，不要一次载入多个）。返回 3~8 条候选的名称、一句话说明、类型与状态；确定要用后再 skill_load 取正文。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string', description: '关键词，可命中名称、说明或标签；留空则按类型列出' },
          kind: { type: 'string', enum: ['general', 'role'], description: 'general 通用技能，role 角色私有技能' },
          status: { type: 'string', enum: ['active', 'retired'], description: '默认 active；retired 为已退役技能' },
          limit: { type: 'integer', minimum: 1, maximum: 30, description: '返回条数，默认 8' },
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
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'kind', 'status', 'summary'],
                properties: {
                  name: { type: 'string' },
                  kind: { type: 'string' },
                  status: { type: 'string' },
                  summary: { type: 'string' },
                },
              },
            },
          },
        },
        render: (_args, value) =>
          text(value.count ? value.items.map((i) => `- ${i.name}（${i.kind}/${i.status}）：${i.summary.slice(0, 90)}`).join('\n') : '没有匹配的技能'),
      },
      execute(rawArgs) {
        const items = pick(scanSkills(), rawArgs || {})
        return {
          count: items.length,
          items: items.map((i) => ({ name: i.name, kind: i.kind, status: i.status, summary: i.summary })),
        }
      },
    },
    {
      name: 'skill_create',
      description: '新建一个技能：写入 SKILL.md 与中文简介。用户在对话里说「新建技能 xxx」时直接调用，不用再问。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', description: '技能名（目录名）' },
          description: { type: 'string', description: '中文一句话说明' },
          body: { type: 'string', description: '说明正文（Markdown，可选）' },
        },
        required: ['name'],
      },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['name', 'path'], properties: { name: { type: 'string' }, path: { type: 'string' } } },
        render: (_a, v) => text(`已创建技能：${v.name}（${v.path}）`),
      },
      execute(rawArgs) {
        const name = String(rawArgs?.name || '').trim()
        const description = String(rawArgs?.description || '').trim()
        if (!name || /[\\/]|\.\./.test(name)) throw new Error('技能名必填且不能含路径分隔符')
        const dir = path.join(SKILLS_DIR, name)
        if (existsSync(dir)) throw new Error(`技能已存在：${name}`)
        mkdirSync(dir, { recursive: true })
        const md = ['---', `name: ${name}`, `description: ${description || name}`, '---', '', `# ${name}`, '', rawArgs?.body || description || '', ''].join('\n')
        writeFileSync(path.join(dir, 'SKILL.md'), md, 'utf8')
        try {
          const i18nPath = path.join(DATA_ROOT, 'skills-i18n.json')
          const dict = existsSync(i18nPath) ? JSON.parse(readFileSync(i18nPath, 'utf8')) : {}
          dict[name] = description || name
          writeFileSync(i18nPath, JSON.stringify(dict, null, 2) + '\n', 'utf8')
        } catch {
          /* 忽略 */
        }
        cache = { at: 0, items: [] }
        return { name, path: path.join(dir, 'SKILL.md') }
      },
    },
    {
      name: 'skill_load',
      description: '从技能环加载一个技能的 SKILL.md 正文。只在确定要按该技能执行时调用；加载会记审计日志。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { name: { type: 'string', description: '技能目录名，如 hyperframes' } },
        required: ['name'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'path', 'chars', 'body'],
          properties: {
            name: { type: 'string' },
            path: { type: 'string' },
            chars: { type: 'integer' },
            body: { type: 'string' },
          },
        },
        render: (_args, value) => text(value.body),
      },
      execute(rawArgs) {
        const name = String(rawArgs?.name || '')
        const loaded = loadBody(name)
        return { name, path: loaded.path, chars: loaded.chars, body: loaded.body }
      },
    },
    {
      name: 'skill_list',
      description: '列出技能环里的技能（默认前 30 个，按名称排序），用于了解都有什么，不加载正文。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', enum: ['general', 'role'] },
          limit: { type: 'integer', minimum: 1, maximum: 120 },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['total', 'items'],
          properties: {
            total: { type: 'integer' },
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
        render: (_args, value) => text(`共 ${value.total} 个：\n${value.items.map((i) => `- ${i.name}（${i.kind}）`).join('\n')}`),
      },
      execute(rawArgs) {
        const all = scanSkills()
        const items = pick(all, { ...(rawArgs || {}), query: '', status: 'active', limit: rawArgs?.limit || 30 })
        return { total: all.filter((i) => i.status === 'active').length, items: items.map((i) => ({ name: i.name, kind: i.kind })) }
      },
    },
    {
      name: 'skill_health',
      description: '检查技能环健康：数量、类型分布、退役技能、缺少 SKILL.md 的目录。',
      parameters: { type: 'object', additionalProperties: false, properties: {} },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok', 'summary'],
          properties: { ok: { type: 'boolean' }, summary: { type: 'string' } },
        },
        render: (_args, value) => text(value.summary),
      },
      execute() {
        const items = scanSkills()
        const active = items.filter((i) => i.status === 'active').length
        const role = items.filter((i) => i.kind === 'role').length
        const retired = items.filter((i) => i.status === 'retired').length
        const ok = existsSync(SKILLS_DIR)
        const summary = `技能 ${items.length} 个（active ${active} / retired ${retired}，role ${role} 个，general ${items.length - role} 个），数据根 ${DATA_ROOT}`
        return { ok, summary }
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
        path: '/skills/api/rpc',
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
        name: 'skill-ring',
        order: 42,
        text: () => {
          const picked = pickedSkills()
          const head = '用户的技能环里有 97 个技能，不要一次全部加载：需要能力时先 skill_search 检索，选定后再 skill_load 读正文。'
          return picked.length ? `${head} 本次对话用户选定了技能：${picked.join('、')}，优先加载这些。` : head
        },
      }),
    )
  }
}
