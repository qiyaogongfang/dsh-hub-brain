// 角色体系 · Host 半边
//
// 真身：Q:\能力中枢\data\roles\<id>\{role.json, core.md, prompt.md, skills.md, eval\}
// 工具：role_list / role_load / role_bind / role_mode / role_status / role_create
// 规则：CORE 冻结，hash 不一致拒绝加载；角色掌握技能与知识（知识本身不属于任何角色）。
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const name = 'roles'
export const inject = ['tools', 'webServer']

const ROOT = process.env.DSH_ROLES_DATA || 'Q:\\能力中枢\\data'
const ROLES = path.join(ROOT, 'roles')
const STATE_DIR = path.join(ROOT, 'state')
const STATE = path.join(STATE_DIR, 'current-role.json')
const MODES = ['use', 'learn', 'evolve']

async function readBody(req) {
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

const text = (value) => [{ type: 'text', text: value }]

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

function readJson(p, fallback) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}

function roles() {
  if (!existsSync(ROLES)) throw new Error(`角色目录不存在：${ROLES}`)
  const out = []
  for (const entry of readdirSync(ROLES, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const meta = readJson(path.join(ROLES, entry.name, 'role.json'), null)
    if (!meta) continue
    out.push(meta)
  }
  return out.sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

function roleById(id) {
  const meta = roles().find((r) => r.id === id)
  if (!meta) throw new Error(`角色不存在：${id}`)
  return meta
}

function current() {
  const state = readJson(STATE, null)
  if (!state || typeof state !== 'object') return null
  if (!state.id && !(state.roles?.length) && !(state.skills?.length) && !(state.atoms?.length)) return null
  return state
}

function setCurrent(id, mode, skills, roles, atoms) {
  mkdirSync(STATE_DIR, { recursive: true })
  const prev = current() || {}
  const list = Array.isArray(roles) ? roles.filter(Boolean) : (id ? [id] : [])
  const next = { id: list[0] || '', roles: list, mode: mode || prev.mode || 'use', skills: skills || prev.skills || [], atoms: Array.isArray(atoms) ? atoms : prev.atoms || [], bound_at: new Date().toISOString(), session: process.env.DSH_SESSION_ID || '' }
  writeFileSync(STATE, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

function clearCurrent() {
  mkdirSync(STATE_DIR, { recursive: true })
  const next = { id: '', mode: 'use', skills: [], bound_at: new Date().toISOString() }
  writeFileSync(STATE, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

function verifyCore(meta) {
  const core = path.join(ROLES, meta.id, 'core.md')
  if (!existsSync(core)) return { ok: false, reason: '缺 core.md' }
  const hash = sha256(readFileSync(core))
  if (meta.core_hash && hash !== meta.core_hash) return { ok: false, reason: `CORE 漂移（文件 ${hash.slice(0, 12)} ≠ 记录 ${meta.core_hash.slice(0, 12)}）` }
  return { ok: true, hash }
}

const ATOMS_DIR = path.join(ROOT, 'atoms')

function knowledgeItems(ids) {
  return (ids || []).map((id) => {
    let title = id
    try {
      const m = readFileSync(path.join(ATOMS_DIR, `${id}.md`), 'utf8').match(/^title:\s*(.+)$/m)
      if (m) title = m[1].trim()
    } catch {
      /* 知识元可能已被删 */
    }
    return { id, title }
  })
}

function saveMeta(meta) {
  writeFileSync(path.join(ROLES, meta.id, 'role.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
}

const CORE_TEMPLATE = (name, mission, redlines) =>  [
    `# ${name} · 核心（冻结层）`,
    '',
    '> 本文件是角色的不变层：身份、信条、工作协议、输出协议与红线。',
    '> 修改入口：用户口令「修订核心：<角色名>」；改完必须重算 role.json 的 core_hash。',
    '',
    '## 身份',
    '',
    `我是**${name}**。${mission}`,
    '',
    '**我负责的**：',
    '',
    '- 把用户的问题拆成可验证的判据，再给结论',
    '- 结论必须带来源、条件与失效边界',
    '- 不确定就说不确定，并给出下一步核实路径',
    '',
    '**我不接的活**：',
    '',
    '- 不替用户做最终决定，只给方案与代价',
    '- 不在没有证据时下结论',
    '',
    '## 红线',
    '',
    ...redlines.map((line, i) => `${i + 1}. ${line}`),
    '',
    '## 输出协议',
    '',
    '- 先给结论，再给依据，最后给边界与下一步',
    '- 引用知识元写明 id，引用来源写明路径',
    '',
  ].join('\n')

function slug(text) {
  return String(text).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').slice(0, 40) || 'role'
}

function writeLearnedAtom(role, title, body, category, sub) {
  const atomsDir = path.join(ROOT, 'atoms')
  mkdirSync(atomsDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const id = `ke_learn_${slug(role)}_${stamp}`
  const text = [
    '---',
    `id: ${id}`,
    'kind: knowledge',
    `title: ${String(title).replace(/\n/g, ' ')}`,
    `category: ${category || '角色学习'}`,
    `sub: ${sub || role}`,
    `source: 对话学习（${role}）${new Date().toISOString().slice(0, 10)}`,
    'tier: B',
    'status: active',
    `verified_at: ${new Date().toISOString().slice(0, 10)}`,
    'sections: [content]',
    '---',
    '',
    '## 1. 内容',
    '',
    String(body).trim(),
    '',
  ].join('\n')
  writeFileSync(path.join(atomsDir, `${id}.md`), text, 'utf8')
  const meta = JSON.parse(readFileSync(path.join(ROLES, role, 'role.json'), 'utf8'))
  const list = Array.isArray(meta.knowledge) ? meta.knowledge.slice() : []
  if (!list.includes(id)) list.push(id)
  saveMeta({ ...meta, knowledge: list })
  return { id, role, knowledge: list.length }
}

export function buildTools() {
  return [
    {
      name: 'role_list',
      description: '列出角色体系里的角色（id、名称、模式、技能数、评估数），不加载核心内容。',
      parameters: { type: 'object', additionalProperties: false, properties: {} },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['count', 'items'], properties: { count: { type: 'integer' }, items: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
        render: (_a, v) => text([`共 ${v.count} 个角色：`, ...v.items.map((r) => `- ${r.id}（${r.mode}，技能 ${r.skills}，评估 ${r.eval}）`)].join('\n')),
      },
      execute() {
        const items = roles().map((r) => ({ id: r.id, name: r.name, mode: r.mode, skills: (r.allowed_skills || []).length, knowledge: (r.knowledge || []).length, eval: r.eval_golden || 0 }))
        return { count: items.length, items }
      },
    },
    {
      name: 'role_load',
      description: '加载一个角色的核心：先校验 CORE 哈希，再返回 core.md、prompt.md、掌握的技能与知识。进入角色后按这个顺序工作。',
      parameters: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' } }, required: ['id'] },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'name', 'mode', 'core', 'prompt', 'allowed_skills', 'knowledge'],
          properties: {
            id: { type: 'string' }, name: { type: 'string' }, mode: { type: 'string' },
            core: { type: 'string' }, prompt: { type: 'string' },
            allowed_skills: { type: 'array', items: { type: 'string' } },
            knowledge: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (_a, v) => text(`${v.core}\n\n---\n\n${v.prompt}`),
      },
      execute(rawArgs) {
        const meta = roleById(String(rawArgs?.id || ''))
        const check = verifyCore(meta)
        if (!check.ok) throw new Error(`${meta.id}：${check.reason}。确认后用 role_mode 或手工重锁。`)
        const promptPath = path.join(ROLES, meta.id, 'prompt.md')
        const prompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf8') : ''
        return { id: meta.id, name: meta.name, mode: meta.mode, core: readFileSync(path.join(ROLES, meta.id, 'core.md'), 'utf8'), prompt, allowed_skills: meta.allowed_skills || [], knowledge: (meta.knowledge || []).map((k) => `${k}｜${knowledgeItems([k])[0].title}`) }
      },
    },
    {
      name: 'role_bind',
      description: '把当前会话绑定到一个角色（写入 data/state/current-role.json），可同时设模式 use/learn/evolve。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'string' }, mode: { type: 'string', enum: MODES } },
        required: ['id'],
      },
      output: { schema: { type: 'object', additionalProperties: false, required: ['id', 'mode'], properties: { id: { type: 'string' }, mode: { type: 'string' } } }, render: (_a, v) => text(`已绑定 ${v.id}（${v.mode}）`) },
      execute(rawArgs) {
        if (!rawArgs?.id || rawArgs.id === 'default') return { id: '', mode: 'use' }
        const meta = roleById(String(rawArgs?.id || ''))
        const check = verifyCore(meta)
        if (!check.ok) throw new Error(`${meta.id}：${check.reason}`)
        const state = setCurrent(meta.id, rawArgs?.mode)
        if (rawArgs?.mode) saveMeta({ ...meta, mode: rawArgs.mode })
        return { id: state.id, mode: state.mode }
      },
    },
    {
      name: 'role_mode',
      description: '切换角色模式：use 只读使用、learn 可写知识草稿、evolve 可改技能与角色（仍需用户口令）。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'string' }, mode: { type: 'string', enum: MODES } },
        required: ['id', 'mode'],
      },
      output: { schema: { type: 'object', additionalProperties: false, required: ['id', 'mode'], properties: { id: { type: 'string' }, mode: { type: 'string' } } }, render: (_a, v) => text(`${v.id} 已切换到 ${v.mode}`) },
      execute(rawArgs) {
        const meta = roleById(String(rawArgs?.id || ''))
        saveMeta({ ...meta, mode: rawArgs.mode })
        const state = current()
        if (state?.id === meta.id) setCurrent(meta.id, rawArgs.mode)
        return { id: meta.id, mode: rawArgs.mode }
      },
    },
    {
      name: 'role_status',
      description: '看当前绑定的角色、模式、CORE 校验结果。',
      parameters: { type: 'object', additionalProperties: false, properties: {} },
      output: { schema: { type: 'object', additionalProperties: false, required: ['bound', 'id', 'mode', 'core_ok'], properties: { bound: { type: 'boolean' }, id: { type: 'string' }, mode: { type: 'string' }, core_ok: { type: 'boolean' }, note: { type: 'string' } } }, render: (_a, v) => text(v.bound ? `当前角色：${v.id}（${v.mode}），CORE ${v.core_ok ? '校验通过' : `异常：${v.note}`}` : v.note || '未绑定角色') },
      execute() {
        const state = current()
        if (!state) return { bound: false, id: '', mode: '', core_ok: false, note: '未绑定角色，按通用身份工作' }
        const meta = roles().find((r) => r.id === state.id)
        if (!meta) return { bound: false, id: state.id, mode: state.mode, core_ok: false, note: '角色已不存在' }
        const check = verifyCore(meta)
        return { bound: true, id: state.id, mode: state.mode, core_ok: check.ok, note: check.ok ? '' : check.reason }
      },
    },
    {
      name: 'role_learn',
      description: '对所选角色执行「学习」：把本轮材料写成一条知识元并挂到该角色（写入知识中枢，CORE 不动）。用户在对话里说「学习」「记住这些」时直接调用，不用再问。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', description: '角色 id' },
          title: { type: 'string', description: '知识标题' },
          body: { type: 'string', description: '知识正文（Markdown）' },
          category: { type: 'string' },
          sub: { type: 'string' },
        },
        required: ['role', 'title', 'body'],
      },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['id', 'role', 'knowledge'], properties: { id: { type: 'string' }, role: { type: 'string' }, knowledge: { type: 'integer' } } },
        render: (_a, v) => text(`已学习：${v.id} → ${v.role}（该角色知识 ${v.knowledge} 条）`),
      },
      execute(rawArgs) {
        const role = String(rawArgs?.role || '')
        roleById(role)
        return writeLearnedAtom(role, rawArgs?.title || '学习记录', rawArgs?.body || '', rawArgs?.category, rawArgs?.sub)
      },
    },
    {
      name: 'role_evolve',
      description: '对所选角色执行「进化」：更新 prompt.md（追加一段能力说明）、增删技能白名单、版本号 +0.1；CORE 不动。用户在对话里说「进化」「升级这个角色」时直接调用。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string' },
          note: { type: 'string', description: '追加到 prompt.md 的进化说明' },
          add_skills: { type: 'array', items: { type: 'string' } },
          remove_skills: { type: 'array', items: { type: 'string' } },
        },
        required: ['role'],
      },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['role', 'version', 'skills'], properties: { role: { type: 'string' }, version: { type: 'string' }, skills: { type: 'integer' } } },
        render: (_a, v) => text(`已进化：${v.role} → v${v.version}，白名单技能 ${v.skills} 个`),
      },
      execute(rawArgs) {
        const role = String(rawArgs?.role || '')
        const meta = roleById(role)
        let skills = Array.isArray(meta.allowed_skills) ? meta.allowed_skills.slice() : []
        for (const s of rawArgs?.add_skills || []) if (!skills.includes(String(s))) skills.push(String(s))
        if (rawArgs?.remove_skills?.length) {
          const drop = new Set(rawArgs.remove_skills.map(String))
          skills = skills.filter((s) => !drop.has(s))
        }
        const promptPath = path.join(ROLES, role, 'prompt.md')
        const oldPrompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf8') : ''
        const note = String(rawArgs?.note || '').trim()
        const nextPrompt = oldPrompt + (note ? `\n\n## 进化记录 ${new Date().toISOString().slice(0, 10)}\n\n${note}\n` : '')
        writeFileSync(promptPath, nextPrompt, 'utf8')
        const ver = String(meta.version || '1.0')
        const parts = ver.split('.')
        const nextVer = `${parts[0]}.${Number(parts[1] || 0) + 1}`
        saveMeta({ ...meta, version: nextVer, allowed_skills: skills })
        return { role, version: nextVer, skills: skills.length }
      },
    },
    {
      name: 'role_create',
      description: '创建一个新角色：填名称、使命、红线、技能白名单，自动生成 core.md（冻结）、prompt.md 与 role.json（含 core_hash）。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', description: '角色名，如「合规审阅师」' },
          id: { type: 'string', description: '目录 id，留空用名称' },
          mission: { type: 'string', description: '一句话使命' },
          redlines: { type: 'array', items: { type: 'string' } },
          allowed_skills: { type: 'array', items: { type: 'string' } },
          mode: { type: 'string', enum: MODES },
        },
        required: ['name', 'mission'],
      },
      output: { schema: { type: 'object', additionalProperties: false, required: ['id', 'path', 'core_hash'], properties: { id: { type: 'string' }, path: { type: 'string' }, core_hash: { type: 'string' } } }, render: (_a, v) => text(`已创建角色 ${v.id}（core_hash ${v.core_hash.slice(0, 12)}），目录 ${v.path}`) },
      execute(rawArgs) {
        const name = String(rawArgs?.name || '').trim()
        const mission = String(rawArgs?.mission || '').trim()
        if (!name || !mission) throw new Error('name 与 mission 必填')
        const id = String(rawArgs?.id || name).trim()
        if (/[\\/]|\.\./.test(id)) throw new Error('id 不能含路径分隔符')
        const dir = path.join(ROLES, id)
        if (existsSync(dir)) throw new Error(`角色已存在：${id}`)
        mkdirSync(path.join(dir, 'eval'), { recursive: true })
        const redlines = (rawArgs?.redlines || []).length ? rawArgs.redlines : ['不编造来源、不越过证据下结论', '不把用户材料写进公开文档']
        const core = CORE_TEMPLATE(name, mission, redlines)
        writeFileSync(path.join(dir, 'core.md'), core, 'utf8')
        const prompt = [
          `# ${name} · 能力清单（可变层）`,
          '',
          '> 本文件可变：技能白名单、知识视图、评估入口。改动不影响 core。',
          '',
          '## 技能白名单',
          '',
          ...(rawArgs?.allowed_skills || []).map((s) => `- ${s}`),
          '',
          '## 知识视图',
          '',
          '',
        ].join('\n')
        writeFileSync(path.join(dir, 'prompt.md'), prompt, 'utf8')
        const meta = {
          id,
          name,
          version: '0.1.0',
          core_hash: sha256(Buffer.from(core, 'utf8')),
          mode: rawArgs?.mode || 'use',
          allowed_skills: rawArgs?.allowed_skills || [],
          knowledge_view: [],
          eval_golden: 0,
        }
        saveMeta(meta)
        return { id, path: dir, core_hash: meta.core_hash }
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
        path: '/roles/api/rpc',
        async handler(req, res) {
          if (req.method !== 'POST') {
            res.writeHead(405, { allow: 'POST' })
            res.end()
            return
          }
          try {
            const body = await readBody(req)
            const action = String(body.action || '')
            const state = current()
            if (action === 'list') {
              const items = roles().map((r) => ({ id: r.id, name: r.name, mode: r.mode, skills: (r.allowed_skills || []).length, knowledge: (r.knowledge || []).length, eval: r.eval_golden || 0 }))
              return sendJson(res, 200, { ok: true, data: { items, current: state } })
            }
            if (action === 'get') {
              const meta = roleById(String(body.id || ''))
              const check = verifyCore(meta)
              if (!check.ok) throw new Error(check.reason)
              const promptPath = path.join(ROLES, meta.id, 'prompt.md')
              return sendJson(res, 200, {
                ok: true,
                data: {
                  id: meta.id, name: meta.name, mode: meta.mode,
                  core: readFileSync(path.join(ROLES, meta.id, 'core.md'), 'utf8'),
                  prompt: existsSync(promptPath) ? readFileSync(promptPath, 'utf8') : '',
                  allowed_skills: meta.allowed_skills || [], knowledge: knowledgeItems(meta.knowledge || []),
                },
              })
            }
            if (action === 'create') {
              const name = String(body.name || '').trim()
              const mission = String(body.mission || '').trim()
              if (!name || !mission) throw new Error('name 与 mission 必填')
              const id = String(body.id || name).trim()
              if (/[\\/]|\.\./.test(id)) throw new Error('id 不能含路径分隔符')
              const dir = path.join(ROLES, id)
              if (existsSync(dir)) throw new Error(`角色已存在：${id}`)
              mkdirSync(path.join(dir, 'eval'), { recursive: true })
              const redlines = (body.redlines || []).length ? body.redlines : ['不编造来源、不越过证据下结论']
              const core = CORE_TEMPLATE(name, mission, redlines)
              writeFileSync(path.join(dir, 'core.md'), core, 'utf8')
              const prompt = ['# ' + name + ' · 能力清单（可变层）', '', '> 本文件可变：技能白名单、知识视图、评估入口。', '', '## 技能白名单', '', ...(body.allowed_skills || []).map((s) => '- ' + s), ''].join('\n')
              writeFileSync(path.join(dir, 'prompt.md'), prompt, 'utf8')
              const meta = { id, name, version: '0.1.0', core_hash: sha256(Buffer.from(core, 'utf8')), mode: body.mode || 'use', scope: ['public'], allowed_skills: body.allowed_skills || [], knowledge_view: [], eval_golden: 0, knowledge: [] }
              saveMeta(meta)
              return sendJson(res, 200, { ok: true, data: { id, path: dir, core_hash: meta.core_hash } })
            }
            if (action === 'delete') {
              const id = String(body.id || '')
              const meta = roleById(id)
              rmSync(path.join(ROLES, meta.id), { recursive: true, force: true })
              const st = current()
              if (st && st.id === meta.id) clearCurrent()
              return sendJson(res, 200, { ok: true, data: { id: meta.id } })
            }
            if (action === 'update_skills') {
              const meta = roleById(String(body.id || ''))
              const next = Array.isArray(body.skills) ? [...new Set(body.skills.map(String))] : []
              saveMeta({ ...meta, allowed_skills: next })
              return sendJson(res, 200, { ok: true, data: { id: meta.id, allowed_skills: next } })
            }
            if (action === 'bind') {
              const list = Array.isArray(body.roles) && body.roles.length
                ? [...new Set(body.roles.map(String))]
                : body.id && body.id !== 'default' ? [String(body.id)] : []
              const skills = Array.isArray(body.skills) ? body.skills.map(String) : []
              const atoms = Array.isArray(body.atoms) ? body.atoms.map(String) : (current()?.atoms || [])
              if (!list.length) {
                if (!skills.length && !atoms.length) return sendJson(res, 200, { ok: true, data: clearCurrent() })
                const kept = setCurrent('', 'use', skills, [], atoms)
                return sendJson(res, 200, { ok: true, data: kept })
              }
              let first = null
              for (const rid of list) {
                const m = roleById(rid)
                const c = verifyCore(m)
                if (!c.ok) throw new Error(`${rid}：${c.reason}`)
                if (!first) first = m
              }
              const next = setCurrent(list[0], body.mode || first.mode, body.skills, list, atoms)
              if (body.mode) saveMeta({ ...first, mode: body.mode })
              return sendJson(res, 200, { ok: true, data: next })
            }
            if (action === 'status') return sendJson(res, 200, { ok: true, data: state || { id: '', mode: '' } })
            throw new Error(`未知 action：${action}`)
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
        name: 'roles',
        order: 44,
        text: () => {
          const state = current()
          if (!state?.id) {
            const bits = []
            if ((state?.skills || []).length) bits.push(`技能 ${state.skills.join('、')}`)
            if ((state?.atoms || []).length) bits.push(`知识元 ${state.atoms.join('、')}`)
            return bits.length
              ? `本次对话使用默认身份（未选角色），已选 ${bits.join('；')}，优先使用它们。`
              : '本次对话使用默认身份（未选角色）。用户可在输入框左侧切换角色、技能与知识元。'
          }
          const picked = (state.skills || []).length ? `本次选定技能：${state.skills.join('、')}。` : ''
          const atoms = (state.atoms || []).length ? `本次选定知识元：${state.atoms.join('、')}。` : ''
          const roles = (state.roles || (state.id ? [state.id] : [])).join('、')
          return `本次选择角色：${roles}（${state.mode}）。${picked}${atoms}先遵守所选角色 CORE 的红线与输出协议；技能与知识按角色掌握的范围使用，越界先说明理由。用户在对话里说「学习」「记住这些」时，直接对该角色调用 role_learn 把材料写成知识元；说「进化」「升级角色」时调用 role_evolve 更新 prompt 与技能白名单，CORE 不动，不用再问。`
        },
      }),
    )
  }
}
