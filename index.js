// 中枢大脑 · Host 半边：合并 知识元 / 技能 / 角色 三个模块
import * as knowledge from './host/knowledge.js'
import * as skills from './host/skills.js'
import * as roles from './host/roles.js'

export const name = 'hub-brain'
export const inject = ['tools', 'webServer']

function capture(mod, ctx) {
  const tools = []
  const servers = []
  const sections = []
  const sys = { section: (cfg) => sections.push(cfg) }
  const local = {
    effect: (fn) => { fn() },
    tools: { register: (t) => tools.push(t) },
    webServer: { register: (s) => servers.push(s) },
    get: (key) => (key === 'systemPrompt' ? sys : ctx.get?.(key)),
  }
  mod.apply(local)
  return { tools, servers, sections }
}

export function apply(ctx) {
  for (const bag of [capture(knowledge, ctx), capture(skills, ctx), capture(roles, ctx)]) {
    for (const tool of bag.tools) ctx.effect(() => ctx.tools.register(tool))
    for (const server of bag.servers) ctx.effect(() => ctx.webServer.register(server))
    const systemPrompt = ctx.get?.('systemPrompt')
    if (systemPrompt) for (const section of bag.sections) ctx.effect(() => systemPrompt.section(section))
  }
}
