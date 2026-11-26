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

/**
 * 给 HTTP 路由接上 DSH 准入检查：优先用 connection.requestRejection（Host/Origin 围栏 +
 * 浏览器登录令牌），服务不可用时退回本机 Host + 同源 Origin 检查，避免任意网页调用本机接口。
 */
function guarded(server, ctx) {
  const original = server.handler
  return {
    ...server,
    async handler(req, res) {
      const connection = ctx.get?.('connection')
      if (connection && typeof connection.requestRejection === 'function') {
        let rejection
        try {
          rejection = connection.requestRejection(req)
        } catch {
          rejection = 403
        }
        if (rejection !== undefined) {
          res.writeHead(rejection, { 'content-type': 'text/plain; charset=utf-8' })
          res.end(rejection === 401 ? 'Unauthorized' : 'Forbidden')
          return
        }
      } else {
        const host = String(req.headers.host || '')
        if (!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) {
          res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('Forbidden')
          return
        }
        const origin = req.headers.origin
        if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
          res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('Forbidden')
          return
        }
      }
      return original(req, res)
    },
  }
}

export function apply(ctx) {
  for (const bag of [capture(knowledge, ctx), capture(skills, ctx), capture(roles, ctx)]) {
    for (const tool of bag.tools) ctx.effect(() => ctx.tools.register(tool))
    for (const server of bag.servers) ctx.effect(() => ctx.webServer.register(guarded(server, ctx)))
    const systemPrompt = ctx.get?.('systemPrompt')
    if (systemPrompt) for (const section of bag.sections) ctx.effect(() => systemPrompt.section(section))
  }
}
