// 中枢大脑 · 浏览器半边：知识元 / 技能 / 角色 三大模块
window.__ModuleLoader__.load({
  id: '@local/hub-brain',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const KnowledgeMod = (() => {

    const React = require('react')
    const h = React.createElement
    const PANEL = 'knowledge-hub'
    const API = '/hub/api/rpc'

    async function rpc(action, payload) {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(payload || {}) }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body || body.ok !== true) throw new Error((body && body.error) || `HTTP ${response.status}`)
      return body.data
    }

    function inlineNodes(text, keyBase) {
      const nodes = []
      const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
      let last = 0
      let m
      let i = 0
      while ((m = re.exec(text))) {
        if (m.index > last) nodes.push(text.slice(last, m.index))
        const tok = m[0]
        if (tok.startsWith('**')) nodes.push(h('strong', { key: `${keyBase}-b${i++}` }, tok.slice(2, -2)))
        else nodes.push(h('code', { key: `${keyBase}-c${i++}`, className: 'md-code' }, tok.slice(1, -1)))
        last = m.index + tok.length
      }
      if (last < text.length) nodes.push(text.slice(last))
      return nodes
    }

    function Markdown(props) {
      const lines = String(props.text || '').replace(/\r/g, '').split('\n')
      const out = []
      let i = 0
      let k = 0
      while (i < lines.length) {
        const line = lines[i]
        if (!line.trim()) { i++; continue }
        if (line.startsWith('```')) {
          const buf = []
          i++
          while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++ }
          i++
          out.push(h('pre', { key: k++, className: 'md-pre' }, buf.join('\n')))
          continue
        }
        const hm = /^(#{1,6})\s+(.*)$/.exec(line)
        if (hm) { out.push(h('div', { key: k++, className: `md-h md-h${hm[1].length}` }, ...inlineNodes(hm[2], k))); i++; continue }
        if (/^\s*[-*]\s+/.test(line)) {
          const items = []
          while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++ }
          out.push(h('ul', { key: k++, className: 'md-ul' }, ...items.map((it, j) => h('li', { key: j }, ...inlineNodes(it, `${k}-${j}`)))))
          continue
        }
        if (/^\s*\d+\.\s+/.test(line)) {
          const items = []
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++ }
          out.push(h('ol', { key: k++, className: 'md-ol' }, ...items.map((it, j) => h('li', { key: j }, ...inlineNodes(it, `${k}-${j}`)))))
          continue
        }
        if (line.trim().startsWith('|')) {
          const rows = []
          while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++ }
          const cells = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r)).map((r) => r.replace(/^\||\|$/g, '').split('|').map((x) => x.trim()))
          const head = cells[0] || []
          out.push(h('table', { key: k++, className: 'md-table' },
            h('thead', null, h('tr', null, ...head.map((c, j) => h('th', { key: j }, ...inlineNodes(c, `${k}-h${j}`))))),
            h('tbody', null, ...cells.slice(1).map((row, ri) => h('tr', { key: ri }, ...row.map((c, j) => h('td', { key: j }, ...inlineNodes(c, `${k}-${ri}-${j}`)))))),
          ))
          continue
        }
        const start = i
        const para = []
        while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*[-*]\s|\s*\d+\.\s|\|)/.test(lines[i])) { para.push(lines[i]); i++ }
        if (i === start) { i++; continue }
        out.push(h('p', { key: k++, className: 'md-p' }, ...inlineNodes(para.join(' '), k)))
      }
      return h('div', { className: 'md' }, ...out)
    }

    const CSS = `
      * { box-sizing: border-box; }
      .kh-root { display: flex; flex-direction: column; height: 100%; min-height: 0; font-size: 13px; }
      .kh-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding: 22px 26px 12px; }
      .kh-title { font-size: 18px; font-weight: 650; letter-spacing: .2px; }
      .kh-sub { font-size: 12px; color: var(--dsw-alias-label-secondary); margin-top: 3px; }
      .kh-bar { display: flex; gap: 10px; align-items: center; padding: 0 26px 16px; flex-wrap: wrap; }
      .kh-search { flex: 1; min-width: 220px; }
      .kh-search input { width: 100%; padding: 9px 12px; border-radius: 11px; border: 1px solid rgba(17,24,39,.1);
        background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; font: inherit; font-size: 12.5px; box-shadow: 0 1px 3px rgba(17,24,39,.04); }
      .kh-seg { display: inline-flex; padding: 3px; border-radius: 11px; background: rgba(17,24,39,.05); }
      .kh-seg button { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px;
        padding: 6px 12px; border-radius: 8px; cursor: pointer; }
      .kh-seg button.is-on { background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; box-shadow: 0 1px 3px rgba(17,24,39,.1); }
      .kh-body { flex: 1; min-height: 0; display: flex; padding: 0 26px 22px; gap: 16px; }
      .kh-list { width: 330px; flex: none; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 2px; }
      .kh-item { width: 100%; text-align: left; padding: 12px 13px; border-radius: 12px; border: 1px solid rgba(17,24,39,.06);
        background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; font: inherit; cursor: pointer; display: flex; flex-direction: column; gap: 5px;
        box-shadow: 0 3px 10px rgba(17,24,39,.04); transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease; }
      .kh-item:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(17,24,39,.08); }
      .kh-item.is-on { border-color: var(--dsw-alias-brand-primary); }
      .kh-item-title { font-size: 12.8px; font-weight: 550; line-height: 1.45; }
      .kh-item-meta { font-size: 10.5px; color: var(--dsw-alias-label-secondary); display: flex; gap: 8px; }
      .kh-detail { flex: 1; min-width: 0; display: flex; flex-direction: column; border-radius: 14px;
        border: 1px solid rgba(17,24,39,.06); background: var(--dsw-alias-bg-layer-0, #fff);
        box-shadow: 0 4px 14px rgba(17,24,39,.05); overflow: hidden; }
      .kh-detail-head { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid rgba(17,24,39,.06); }
      .kh-detail-title { font-size: 14px; font-weight: 650; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .kh-pill { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: rgba(17,24,39,.05); color: var(--dsw-alias-label-secondary); }
      .kh-detail-body { flex: 1; overflow: auto; padding: 16px 20px 26px; }
      .kh-btn { padding: 6px 13px; border-radius: 9px; border: 1px solid rgba(17,24,39,.1);
        background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; font: inherit; font-size: 12px; cursor: pointer; }
      .kh-btn.is-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: #fff; }
      .kh-empty { padding: 44px; text-align: center; color: var(--dsw-alias-label-secondary); }
      .kh-err { margin: 0 26px 10px; padding: 8px 11px; border-radius: 10px; background: rgba(200,60,60,.1); color: #c33; font-size: 12px; }
      .kh-edit { display: flex; flex-direction: column; gap: 10px; padding: 12px; margin-bottom: 14px;
        border-radius: 12px; background: rgba(37,99,235,.05); border: 1px solid rgba(37,99,235,.14); }
      .kh-edit label { display: block; font-size: 11.5px; color: var(--dsw-alias-label-secondary); margin-bottom: 4px; }
      .kh-edit input { width: 100%; padding: 7px 10px; border-radius: 9px; border: 1px solid rgba(17,24,39,.12);
        background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; font: inherit; font-size: 12.5px; }
      .kh-edit-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .md { line-height: 1.75; font-size: 13px; }
      .md-h { font-weight: 600; margin: 18px 0 8px; }
      .md-h1 { font-size: 17px; } .md-h2 { font-size: 15px; } .md-h3 { font-size: 13.5px; }
      .md-p { margin: 8px 0; }
      .md-ul, .md-ol { margin: 8px 0; padding-left: 22px; }
      .md-ul li, .md-ol li { margin: 4px 0; }
      .md-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; background: rgba(17,24,39,.06); border-radius: 4px; padding: 1px 5px; }
      .md-pre { background: rgba(17,24,39,.05); border-radius: 10px; padding: 10px 12px; overflow-x: auto; font-size: 12px; line-height: 1.55; }
      .md-table { border-collapse: collapse; margin: 10px 0; font-size: 12.5px; width: 100%; }
      .md-table th, .md-table td { border: 1px solid rgba(17,24,39,.1); padding: 6px 9px; text-align: left; vertical-align: top; }
      .md-table th { background: rgba(17,24,39,.04); font-weight: 600; }
    `

    function Icon(props) {
      const size = props.size || 16
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M5 4.5h9.5L19 9v10.5H5z' }),
        h('path', { d: 'M14 4.5V9h4.5' }),
        h('path', { d: 'M8 13h8M8 16h5' }),
      )
    }

    function Panel() {
      const [q, setQ] = React.useState('')
      const [status, setStatus] = React.useState('active')
      const [items, setItems] = React.useState([])
      const [counts, setCounts] = React.useState({ total: 0, active: 0, pending: 0 })
      const [sel, setSel] = React.useState(null)
      const [detail, setDetail] = React.useState(null)
      const [editing, setEditing] = React.useState(false)
      const [form, setForm] = React.useState({ title: '', category: '', sub: '' })
      const [err, setErr] = React.useState('')

      async function load() {
        try {
          const data = await rpc('list', { q, status })
          setItems(data.items || [])
          setErr('')
        } catch (error) { setErr(error.message) }
        try { setCounts(await rpc('counts', {})) } catch { /* 忽略 */ }
      }

      React.useEffect(() => { load() }, [q, status])

      async function open(item) {
        setSel(item.id)
        try {
          const d = await rpc('get', { id: item.id })
          setDetail(d)
          setForm({ title: d.title, category: d.category || '', sub: d.sub || '' })
          setEditing(false)
        } catch (error) { setErr(error.message) }
      }

      async function saveMeta() {
        if (!detail) return
        try {
          const d = await rpc('update_meta', { id: detail.id, patch: form })
          setDetail({ ...detail, title: d.title, category: d.category, sub: d.sub })
          setEditing(false)
          await load()
        } catch (error) { setErr(error.message) }
      }

      async function decide(action) {
        if (!detail) return
        try {
          await rpc('decide', { id: detail.id, action2: action })
          setDetail(null)
          setSel(null)
          await load()
        } catch (error) { setErr(error.message) }
      }

      return h('div', { className: 'kh-root' },
        h('style', null, CSS),
        h('div', { className: 'kh-head' },
          h('div', null,
            h('div', { className: 'kh-title' }, '知识中枢'),
            h('div', { className: 'kh-sub' }, `${counts.active} 条知识 · 按题目随时改`),
          ),
        ),
        h('div', { className: 'kh-bar' },
          h('div', { className: 'kh-search' },
            h('input', { value: q, placeholder: '搜标题或正文', onChange: (e) => setQ(e.target.value) }),
          ),
          h('div', { className: 'kh-seg' },
            ...[['active', `已生效 ${counts.active}`], ['pending', `待裁定 ${counts.pending}`], ['all', `全部 ${counts.total}`]].map(([key, label]) =>
              h('button', { key, className: status === key ? 'is-on' : '', onClick: () => setStatus(key) }, label),
            ),
          ),
        ),
        err ? h('div', { className: 'kh-err' }, err) : null,
        h('div', { className: 'kh-body' },
          h('div', { className: 'kh-list' },
            items.length
              ? items.map((item) =>
                  h('button', { key: item.id, className: `kh-item${sel === item.id ? ' is-on' : ''}`, onClick: () => open(item) },
                    h('span', { className: 'kh-item-title' }, item.title),
                    h('span', { className: 'kh-item-meta' },
                      h('span', null, item.id),
                      h('span', null, `${item.chars} 字`),
                    ),
                  ),
                )
              : h('div', { className: 'kh-empty' }, '没有匹配的知识'),
          ),
          h('div', { className: 'kh-detail' },
            detail
              ? h(React.Fragment, null,
                  h('div', { className: 'kh-detail-head' },
                    h('span', { className: 'kh-detail-title' }, detail.title),
                    h('span', { className: 'kh-pill' }, detail.status),
                    editing
                      ? h(React.Fragment, null,
                          h('button', { className: 'kh-btn is-primary', onClick: saveMeta }, '保存'),
                          h('button', { className: 'kh-btn', onClick: () => setEditing(false) }, '取消'),
                        )
                      : h('button', { className: 'kh-btn', onClick: () => setEditing(true) }, '改标题/分类'),
                    detail.status === 'pending'
                      ? h('button', { className: 'kh-btn is-primary', onClick: () => decide('accept') }, '通过')
                      : h('button', { className: 'kh-btn', onClick: () => decide('pending') }, '挂起'),
                  ),
                  h('div', { className: 'kh-detail-body' },
                    editing
                      ? h('div', { className: 'kh-edit' },
                          h('label', null, '标题'),
                          h('input', { value: form.title, onChange: (e) => setForm({ ...form, title: e.target.value }) }),
                          h('div', { className: 'kh-edit-row' },
                            h('div', null, h('label', null, '一级分类'), h('input', { value: form.category, onChange: (e) => setForm({ ...form, category: e.target.value }) })),
                            h('div', null, h('label', null, '二级分类'), h('input', { value: form.sub, onChange: (e) => setForm({ ...form, sub: e.target.value }) })),
                          ),
                        )
                      : null,
                    h(Markdown, { text: detail.body }),
                  ),
                )
              : h('div', { className: 'kh-empty' }, '从左侧选一条知识查看'),
          ),
        ),
      )
    }
      return { Panel }
    })()

    const SkillMod = (() => {

    const React = require('react')
    const h = React.createElement
    const PANEL = 'skill-ring'
    const API = '/skills/api/rpc'

    async function rpc(action, payload) {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(payload || {}) }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body || body.ok !== true) throw new Error((body && body.error) || `HTTP ${response.status}`)
      return body.data
    }

    function inlineNodes(text, keyBase) {
      const nodes = []
      const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
      let last = 0
      let m
      let i = 0
      while ((m = re.exec(text))) {
        if (m.index > last) nodes.push(text.slice(last, m.index))
        const tok = m[0]
        if (tok.startsWith('**')) nodes.push(h('strong', { key: `${keyBase}-b${i++}` }, tok.slice(2, -2)))
        else nodes.push(h('code', { key: `${keyBase}-c${i++}`, className: 'md-code' }, tok.slice(1, -1)))
        last = m.index + tok.length
      }
      if (last < text.length) nodes.push(text.slice(last))
      return nodes
    }

    function Markdown(props) {
      const lines = String(props.text || '').replace(/\r/g, '').split('\n')
      const out = []
      let i = 0
      let k = 0
      while (i < lines.length) {
        const line = lines[i]
        if (!line.trim()) { i++; continue }
        if (line.startsWith('```')) {
          const buf = []
          i++
          while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++ }
          i++
          out.push(h('pre', { key: k++, className: 'md-pre' }, buf.join('\n')))
          continue
        }
        const hm = /^(#{1,6})\s+(.*)$/.exec(line)
        if (hm) { out.push(h('div', { key: k++, className: `md-h md-h${hm[1].length}` }, ...inlineNodes(hm[2], k))); i++; continue }
        if (/^\s*[-*]\s+/.test(line)) {
          const items = []
          while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++ }
          out.push(h('ul', { key: k++, className: 'md-ul' }, ...items.map((it, j) => h('li', { key: j }, ...inlineNodes(it, `${k}-${j}`)))))
          continue
        }
        if (/^\s*\d+\.\s+/.test(line)) {
          const items = []
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++ }
          out.push(h('ol', { key: k++, className: 'md-ol' }, ...items.map((it, j) => h('li', { key: j }, ...inlineNodes(it, `${k}-${j}`)))))
          continue
        }
        if (line.trim().startsWith('|')) {
          const rows = []
          while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++ }
          const cells = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r)).map((r) => r.replace(/^\||\|$/g, '').split('|').map((x) => x.trim()))
          const head = cells[0] || []
          out.push(h('table', { key: k++, className: 'md-table' },
            h('thead', null, h('tr', null, ...head.map((c, j) => h('th', { key: j }, ...inlineNodes(c, `${k}-h${j}`))))),
            h('tbody', null, ...cells.slice(1).map((row, ri) => h('tr', { key: ri }, ...row.map((c, j) => h('td', { key: j }, ...inlineNodes(c, `${k}-${ri}-${j}`)))))),
          ))
          continue
        }
        const start = i
        const para = []
        while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*[-*]\s|\s*\d+\.\s|\|)/.test(lines[i])) { para.push(lines[i]); i++ }
        if (i === start) { i++; continue }
        out.push(h('p', { key: k++, className: 'md-p' }, ...inlineNodes(para.join(' '), k)))
      }
      return h('div', { className: 'md' }, ...out)
    }

    const CSS = `
      * { box-sizing: border-box; }
      .sr-root { display: flex; flex-direction: column; height: 100%; min-height: 0; font-size: 13px; }
      .sr-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding: 22px 26px 12px; }
      .sr-title { font-size: 18px; font-weight: 650; letter-spacing: .2px; }
      .sr-sub { font-size: 12px; color: var(--dsw-alias-label-secondary); margin-top: 3px; }
      .sr-bar { display: flex; gap: 10px; align-items: center; padding: 0 26px 16px; flex-wrap: wrap; }
      .sr-search { flex: 1; min-width: 220px; }
      .sr-search input { width: 100%; padding: 9px 12px; border-radius: 11px; border: 1px solid rgba(17,24,39,.1);
        background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; font: inherit; font-size: 12.5px; box-shadow: 0 1px 3px rgba(17,24,39,.04); }
      .sr-seg { display: inline-flex; padding: 3px; border-radius: 11px; background: rgba(17,24,39,.05); }
      .sr-seg button { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px;
        padding: 6px 12px; border-radius: 8px; cursor: pointer; }
      .sr-seg button.is-on { background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; box-shadow: 0 1px 3px rgba(17,24,39,.1); }
      .sr-grid { flex: 1; overflow-y: auto; padding: 4px 26px 26px; display: grid; gap: 14px;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); align-content: start; }
      .sr-box { text-align: left; padding: 16px 16px 15px; border-radius: 14px; border: 1px solid rgba(17,24,39,.06);
        background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; font: inherit; cursor: pointer; display: flex; flex-direction: column; gap: 8px;
        box-shadow: 0 4px 14px rgba(17,24,39,.05); transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
      .sr-box:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(17,24,39,.1); border-color: rgba(17,24,39,.12); }
      .sr-box-top { display: flex; align-items: center; gap: 8px; }
      .sr-name { font-weight: 600; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
      .sr-badge { flex: none; padding: 2px 8px; border-radius: 999px; font-size: 10.5px; }
      .sr-badge.is-role { color: #b45309; background: rgba(245,158,11,.12); }
      .sr-badge.is-general { color: #047857; background: rgba(16,185,129,.12); }
      .sr-owner { font-size: 10.5px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sr-desc { font-size: 12px; line-height: 1.65; color: var(--dsw-alias-label-secondary);
        display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      .sr-empty { padding: 44px; color: var(--dsw-alias-label-secondary); text-align: center; grid-column: 1 / -1; }
      .sr-err { margin: 0 26px 10px; padding: 8px 11px; border-radius: 10px; background: rgba(200,60,60,.1); color: #c33; font-size: 12px; }
      .sr-modal { position: fixed; inset: 0; background: rgba(15,23,42,.5); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 45; }
      .sr-modal-card { width: min(940px, 94vw); max-height: 86vh; display: flex; flex-direction: column; border-radius: 18px;
        background: var(--dsw-alias-bg-layer-0, #fff); border: 1px solid rgba(17,24,39,.08); overflow: hidden; box-shadow: 0 24px 64px rgba(15,23,42,.28); }
      .sr-modal-head { display: flex; align-items: center; gap: 10px; padding: 15px 20px; border-bottom: 1px solid rgba(17,24,39,.06); flex-wrap: wrap; }
      .sr-modal-title { font-weight: 650; font-size: 14.5px; }
      .sr-modal-meta { font-size: 11.5px; color: var(--dsw-alias-label-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sr-modal-body { flex: 1; overflow: auto; padding: 18px 22px 28px; }
      .sr-btn { padding: 6px 13px; border-radius: 9px; border: 1px solid rgba(17,24,39,.1);
        background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; font: inherit; font-size: 12px; cursor: pointer; }
      .sr-sec-title { margin: 20px 0 10px; font-size: 13px; font-weight: 650; padding-top: 14px; border-top: 1px solid rgba(17,24,39,.08); }
      .sr-meta-list { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
      .sr-meta-list div { display: flex; gap: 12px; font-size: 12.5px; }
      .sr-meta-list span { color: var(--dsw-alias-label-secondary); width: 64px; flex: none; }
      .sr-meta-list b { font-weight: 550; }
      .sr-path { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; color: var(--dsw-alias-label-secondary); word-break: break-all; }
      .sr-zh { padding: 12px 14px; border-radius: 12px; background: rgba(37,99,235,.06); border: 1px solid rgba(37,99,235,.14); }
      .sr-zh-label { font-size: 11px; font-weight: 600; color: var(--dsw-alias-brand-primary); margin-bottom: 4px; }
      .sr-zh-text { font-size: 13px; line-height: 1.7; }
      .sr-toggle { margin: 12px 0 8px; }
      .md { line-height: 1.75; font-size: 13px; }
      .md-h { font-weight: 600; margin: 18px 0 8px; }
      .md-h1 { font-size: 17px; } .md-h2 { font-size: 15px; } .md-h3 { font-size: 13.5px; }
      .md-p { margin: 8px 0; }
      .md-ul, .md-ol { margin: 8px 0; padding-left: 22px; }
      .md-ul li, .md-ol li { margin: 4px 0; }
      .md-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; background: rgba(17,24,39,.06); border-radius: 4px; padding: 1px 5px; }
      .md-pre { background: rgba(17,24,39,.05); border-radius: 10px; padding: 10px 12px; overflow-x: auto; font-size: 12px; line-height: 1.55; }
      .md-table { border-collapse: collapse; margin: 10px 0; font-size: 12.5px; width: 100%; }
      .md-table th, .md-table td { border: 1px solid rgba(17,24,39,.1); padding: 6px 9px; text-align: left; vertical-align: top; }
      .md-table th { background: rgba(17,24,39,.04); font-weight: 600; }
    `

    function openSkillDialog(onDone) {
      const dlg = document.createElement('dialog')
      dlg.style.cssText = 'border:1px solid rgba(17,24,39,.12);border-radius:14px;padding:0;width:min(520px,92vw);background:var(--dsw-alias-bg-layer-0,#fff);color:inherit;'
      dlg.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;padding:18px 20px;">
          <div style="font-size:15px;font-weight:600;">新建技能</div>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary);">技能名（目录名）
            <input data-name style="padding:8px 10px;border-radius:8px;border:1px solid rgba(17,24,39,.12);font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);" />
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary);">中文说明（一句话）
            <input data-desc style="padding:8px 10px;border-radius:8px;border:1px solid rgba(17,24,39,.12);font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);" />
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary);">说明正文（可选）
            <textarea data-body rows="5" style="padding:8px 10px;border-radius:8px;border:1px solid rgba(17,24,39,.12);font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);resize:vertical;"></textarea>
          </label>
          <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:4px;">
            <button data-cancel style="padding:6px 14px;border-radius:8px;border:1px solid rgba(17,24,39,.12);background:transparent;color:inherit;font:inherit;cursor:pointer;">取消</button>
            <button data-ok style="padding:6px 14px;border-radius:8px;border:0;background:var(--dsw-alias-brand-primary,#0d6e5a);color:#fff;font:inherit;cursor:pointer;">创建</button>
          </div>
        </div>`
      document.body.appendChild(dlg)
      const close = () => { dlg.close(); dlg.remove() }
      dlg.querySelector('[data-cancel]').addEventListener('click', close)
      dlg.querySelector('[data-ok]').addEventListener('click', async () => {
        const name = dlg.querySelector('[data-name]').value.trim()
        const description = dlg.querySelector('[data-desc]').value.trim()
        const body = dlg.querySelector('[data-body]').value.trim()
        if (!name) { dlg.querySelector('[data-name]').focus(); return }
        try {
          await rpc('create', { name, description: description || name, body })
          close()
          onDone()
        } catch (error) {
          window.alert ? window.alert(error.message) : null
        }
      })
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); close() })
      dlg.showModal()
    }

    function Icon(props) {
      const size = props.size || 16
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M12 3.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.8l5-.7z' }),
      )
    }

    function Panel() {
      const [q, setQ] = React.useState('')
      const [tab, setTab] = React.useState('all')
      const [items, setItems] = React.useState([])
      const [counts, setCounts] = React.useState({ total: 0, active: 0 })
      const [detail, setDetail] = React.useState(null)
      const [showRaw, setShowRaw] = React.useState(false)
      const [err, setErr] = React.useState('')

      async function refresh() {
        try {
          const data = await rpc('list', { q })
          setItems(data.items || [])
          setErr('')
        } catch (error) { setErr(error.message) }
        try { setCounts(await rpc('counts', {})) } catch { /* 忽略 */ }
      }

      React.useEffect(() => { refresh() }, [q])

      async function open(item) {
        try { setDetail(await rpc('get', { name: item.name })); setShowRaw(false) } catch (error) { setErr(error.message) }
      }

      async function createSkill() {
        openSkillDialog(refresh)
      }

      async function deleteSkill() {
        if (!detail) return
        const dlg = document.createElement('dialog')
        dlg.style.cssText = 'border:1px solid rgba(17,24,39,.12);border-radius:14px;padding:0;width:min(420px,92vw);background:var(--dsw-alias-bg-layer-0,#fff);color:inherit;'
        dlg.innerHTML = `<div style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
          <div style="font-size:14px;font-weight:600;">删除技能</div>
          <div style="font-size:12.5px;color:var(--dsw-alias-label-secondary);">删除「${detail.name}」及其目录，无法撤销。</div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button data-no style="padding:6px 12px;border-radius:8px;border:1px solid rgba(17,24,39,.12);background:transparent;color:inherit;font:inherit;cursor:pointer;">取消</button>
            <button data-yes style="padding:6px 12px;border-radius:8px;border:0;background:#b42318;color:#fff;font:inherit;cursor:pointer;">删除</button>
          </div>
        </div>`
        document.body.appendChild(dlg)
        const close = () => { dlg.close(); dlg.remove() }
        dlg.querySelector('[data-no]').addEventListener('click', close)
        dlg.querySelector('[data-yes]').addEventListener('click', async () => {
          close()
          try {
            await rpc('delete', { name: detail.name })
            setDetail(null)
            await refresh()
          } catch (error) { setErr(error.message) }
        })
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); close() })
        dlg.showModal()
      }

      const shown = items.filter((i) => (tab === 'all' ? true : tab === 'role' ? i.kind === 'role' : i.kind !== 'role'))
      const generalCount = items.filter((i) => i.kind !== 'role').length
      const roleCount = items.filter((i) => i.kind === 'role').length

      return h('div', { className: 'sr-root' },
        h('style', null, CSS),
        h('div', { className: 'sr-head' },
          h('div', null,
            h('div', { className: 'sr-title' }, '技能环'),
            h('div', { className: 'sr-sub' }, `公用 ${generalCount} 个 · 角色专属 ${roleCount} 个 · 共 ${counts.total} 个`),
          ),
          h('button', { className: 'sr-btn', style: { marginLeft: 'auto' }, onClick: createSkill }, '新建技能'),
        ),
        h('div', { className: 'sr-bar' },
          h('div', { className: 'sr-search' },
            h('input', { value: q, placeholder: '搜技能名或说明', onChange: (e) => setQ(e.target.value) }),
          ),
          h('div', { className: 'sr-seg' },
            ...[['all', '全部'], ['general', '公用'], ['role', '特定']].map(([key, label]) =>
              h('button', { key, className: tab === key ? 'is-on' : '', onClick: () => setTab(key) }, label),
            ),
          ),
        ),
        err ? h('div', { className: 'sr-err' }, err) : null,
        h('div', { className: 'sr-grid' },
          shown.length
            ? shown.map((item) =>
                h('button', { key: item.name, className: 'sr-box', onClick: () => open(item) },
                  h('span', { className: 'sr-box-top' },
                    h('span', { className: 'sr-name' }, item.name),
                    h('span', { className: `sr-badge ${item.kind === 'role' ? 'is-role' : 'is-general'}` }, item.kind === 'role' ? '特定' : '公用'),
                  ),
                  item.kind === 'role' && item.owners && item.owners.length
                    ? h('span', { className: 'sr-owner' }, `属于：${item.owners.join('、')}`)
                    : h('span', { className: 'sr-owner' }, '所有角色可用'),
                  h('span', { className: 'sr-desc' }, item.summary || '（无说明）'),
                ),
              )
            : h('div', { className: 'sr-empty' }, '没有匹配的技能'),
        ),
        detail
          ? h('div', { className: 'sr-modal', onClick: () => setDetail(null) },
              h('div', { className: 'sr-modal-card', onClick: (e) => e.stopPropagation() },
                h('div', { className: 'sr-modal-head' },
                  h('span', { className: 'sr-modal-title' }, detail.name),
                  h('span', { className: 'sr-modal-meta' }, detail.kind === 'role' ? '特定技能' : '公用技能'),
                  h('button', { className: 'sr-btn', style: { marginLeft: 'auto' }, onClick: deleteSkill }, '删除技能'),
                  h('button', { className: 'sr-btn', onClick: () => setDetail(null) }, '关闭'),
                ),
                h('div', { className: 'sr-modal-body' },
                  h('div', { className: 'sr-zh' },
                    h('div', { className: 'sr-zh-label' }, '中文说明'),
                    h('div', { className: 'sr-zh-text' }, detail.summary || '（暂无中文说明）'),
                  ),
                  h('div', { className: 'sr-meta-list' },
                    h('div', null, h('span', null, '类型'), h('b', null, detail.kind === 'role' ? '特定（角色专属）' : '公用')),
                    h('div', null, h('span', null, '归属'), h('b', null, (detail.owners && detail.owners.length) ? detail.owners.join('、') : '所有角色可用')),
                    h('div', null, h('span', null, '技能目录'), h('b', { className: 'sr-path' }, detail.path)),
                  ),
                  h('div', { className: 'sr-sec-title' }, '完整说明'),
                  h(Markdown, { text: detail.body }),
                ),
              ),
            )
          : null,
      )
    }
      return { Panel }
    })()

    const RoleMod = (() => {

    const React = require('react')
    const h = React.createElement
    const PANEL = 'roles'
    const API = '/roles/api/rpc'
    const SKILLS_API = '/skills/api/rpc'

    async function rpc(action, payload) {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(payload || {}) }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body || body.ok !== true) throw new Error((body && body.error) || `HTTP ${response.status}`)
      return body.data
    }

    async function skillsRpc(action, payload) {
      const response = await fetch(SKILLS_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(payload || {}) }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body || body.ok !== true) throw new Error((body && body.error) || `HTTP ${response.status}`)
      return body.data
    }

    function cleanTitle(text) {
      return String(text || '')
        .replace(/（\d+ 张卡合并）/g, '')
        .replace(/（\d+ 条）/g, '')
        .replace(/·观察索引 第\d+批/g, '')
        .trim()
    }

    function fuzzy(text, q) {
      const s = String(text || '').toLowerCase()
      const t = String(q || '').toLowerCase()
      if (!t) return true
      if (s.includes(t)) return true
      let i = 0
      for (const ch of t) {
        i = s.indexOf(ch, i)
        if (i < 0) return false
        i += 1
      }
      return true
    }

    function inlineNodes(text, keyBase) {
      const nodes = []
      const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
      let last = 0
      let m
      let i = 0
      while ((m = re.exec(text))) {
        if (m.index > last) nodes.push(text.slice(last, m.index))
        const tok = m[0]
        if (tok.startsWith('**')) nodes.push(h('strong', { key: `${keyBase}-b${i++}` }, tok.slice(2, -2)))
        else nodes.push(h('code', { key: `${keyBase}-c${i++}`, className: 'md-code' }, tok.slice(1, -1)))
        last = m.index + tok.length
      }
      if (last < text.length) nodes.push(text.slice(last))
      return nodes
    }

    function Markdown(props) {
      const lines = String(props.text || '').replace(/\r/g, '').split('\n')
      const out = []
      let i = 0
      let k = 0
      while (i < lines.length) {
        const line = lines[i]
        if (!line.trim()) { i++; continue }
        if (line.startsWith('```')) {
          const buf = []
          i++
          while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++ }
          i++
          out.push(h('pre', { key: k++, className: 'md-pre' }, buf.join('\n')))
          continue
        }
        const hm = /^(#{1,6})\s+(.*)$/.exec(line)
        if (hm) { out.push(h('div', { key: k++, className: `md-h md-h${hm[1].length}` }, ...inlineNodes(hm[2], k))); i++; continue }
        if (/^\s*[-*]\s+/.test(line)) {
          const items = []
          while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++ }
          out.push(h('ul', { key: k++, className: 'md-ul' }, ...items.map((it, j) => h('li', { key: j }, ...inlineNodes(it, `${k}-${j}`)))))
          continue
        }
        if (/^\s*\d+\.\s+/.test(line)) {
          const items = []
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++ }
          out.push(h('ol', { key: k++, className: 'md-ol' }, ...items.map((it, j) => h('li', { key: j }, ...inlineNodes(it, `${k}-${j}`)))))
          continue
        }
        if (line.trim().startsWith('|')) {
          const rows = []
          while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++ }
          const cells = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r)).map((r) => r.replace(/^\||\|$/g, '').split('|').map((x) => x.trim()))
          const head = cells[0] || []
          out.push(h('table', { key: k++, className: 'md-table' },
            h('thead', null, h('tr', null, ...head.map((c, j) => h('th', { key: j }, ...inlineNodes(c, `${k}-h${j}`))))),
            h('tbody', null, ...cells.slice(1).map((row, ri) => h('tr', { key: ri }, ...row.map((c, j) => h('td', { key: j }, ...inlineNodes(c, `${k}-${ri}-${j}`)))))),
          ))
          continue
        }
        const start = i
        const para = []
        while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*[-*]\s|\s*\d+\.\s|\|)/.test(lines[i])) { para.push(lines[i]); i++ }
        if (i === start) { i++; continue }
        out.push(h('p', { key: k++, className: 'md-p' }, ...inlineNodes(para.join(' '), k)))
      }
      return h('div', { className: 'md' }, ...out)
    }

    const CSS = `
      * { box-sizing: border-box; }
      .rl-root { display: flex; flex-direction: column; height: 100%; min-height: 0; font-size: 13px; }
      .rl-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding: 22px 26px 12px; }
      .rl-title { font-size: 18px; font-weight: 650; letter-spacing: .2px; }
      .rl-sub { font-size: 12px; color: var(--dsw-alias-label-secondary); margin-top: 3px; }
      .rl-current { font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .rl-grid { flex: 1; overflow-y: auto; padding: 4px 26px 26px; display: grid; gap: 14px;
        grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); align-content: start; }
      .rl-card { text-align: left; padding: 15px 16px; border-radius: 14px; border: 1px solid rgba(17,24,39,.06);
        background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; font: inherit; cursor: pointer; display: flex; flex-direction: column; gap: 7px;
        box-shadow: 0 4px 14px rgba(17,24,39,.05); transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
      .rl-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(17,24,39,.1); border-color: rgba(17,24,39,.12); }
      .rl-card.is-on { border-color: var(--dsw-alias-brand-primary); }
      .rl-name { font-weight: 600; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rl-meta { display: flex; gap: 6px; flex-wrap: wrap; }
      .rl-tag { font-size: 10.5px; padding: 2px 7px; border-radius: 999px; background: rgba(17,24,39,.05); color: var(--dsw-alias-label-secondary); }
      .rl-empty { padding: 44px; color: var(--dsw-alias-label-secondary); text-align: center; grid-column: 1 / -1; }
      .rl-err { margin: 0 26px 10px; padding: 8px 11px; border-radius: 10px; background: rgba(200,60,60,.1); color: #c33; font-size: 12px; }
      .rl-btn { padding: 6px 13px; border-radius: 9px; border: 1px solid rgba(17,24,39,.1);
        background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; font: inherit; font-size: 12px; cursor: pointer; }
      .rl-btn.is-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: #fff; }
      .rl-pick { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 10px;
        border: 1px solid rgba(17,24,39,.1); background: var(--dsw-alias-bg-layer-0, #fff); color: inherit;
        font: inherit; font-size: 12px; cursor: pointer; box-shadow: 0 2px 8px rgba(17,24,39,.05); }
      .rl-pick:hover { border-color: var(--dsw-alias-brand-primary); }
      .rl-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-brand-primary); }
      .rl-wrap { position: relative; display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .rl-dock { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 2px 4px; }
      .rl-dock-label { font-size: 11px; color: var(--dsw-alias-label-secondary); }
      .rl-chip-sel b { font-weight: 600; margin-right: 4px; opacity: .75; }
      .rl-chips { display: inline-flex; gap: 6px; flex-wrap: wrap; max-width: min(56vw, 560px); }
      .rl-chip-sel { display: inline-flex; align-items: center; gap: 5px; padding: 4px 5px 4px 10px; border-radius: 999px;
        background: var(--dsw-alias-bg-layer-0, #fff); border: 1px solid rgba(17,24,39,.08); color: inherit;
        font-size: 11.5px; box-shadow: 0 2px 6px rgba(17,24,39,.06); }
      .rl-chip-sel b { color: var(--dsw-alias-brand-primary, #0d6e5a); }
      .rl-chip-x { border: 0; background: transparent; color: inherit; font-size: 12px; line-height: 1; cursor: pointer;
        padding: 2px 5px; border-radius: 999px; }
      .rl-chip-x:hover { background: rgba(17,24,39,.1); }
      .rl-err-inline { font-size: 11px; color: #c33; }
      .rl-pop { position: absolute; left: 0; bottom: calc(100% + 10px); z-index: 80; width: min(760px, calc(100vw - 48px));
        max-height: min(560px, calc(100vh - 120px)); display: flex; flex-direction: column; border-radius: 16px;
        background: var(--dsw-alias-bg-layer-0, #fff); border: 1px solid rgba(17,24,39,.08); overflow: hidden;
        box-shadow: 0 18px 48px rgba(15,23,42,.22); }
      .rl-pop-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px; }
      .rl-pop-title { font-size: 14px; font-weight: 650; }
      .rl-pop-sub { font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
      .rl-pop-body { flex: 1; min-height: 0; display: flex; border-top: 1px solid rgba(17,24,39,.06); }
      .rl-col { display: flex; flex-direction: column; min-height: 0; }
      .rl-col-roles { width: 300px; border-right: 1px solid rgba(17,24,39,.06); }
      .rl-col-skills { flex: 1; }
      .rl-col-head { padding: 10px 14px 6px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); display: flex; justify-content: space-between; }
      .rl-search { padding: 0 12px 8px; }
      .rl-search input { width: 100%; padding: 7px 10px; border-radius: 9px; border: 1px solid rgba(17,24,39,.1);
        background: var(--dsw-alias-bg-layer-1); color: inherit; font: inherit; font-size: 12px; }
      .rl-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 2px 8px 10px; }
      .rl-opt { width: 100%; display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 10px;
        border: 1px solid transparent; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
      .rl-opt:hover { background: var(--dsw-alias-bg-layer-1); }
      .rl-opt.is-on { background: rgba(37,99,235,.08); border-color: rgba(37,99,235,.24); }
      .rl-opt-main { flex: 1; min-width: 0; }
      .rl-opt-name { display: block; font-size: 12.5px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rl-opt-meta { display: block; font-size: 10.5px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rl-radio { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid rgba(17,24,39,.25); flex: none; }
      .rl-radio.is-on { border: 4px solid var(--dsw-alias-brand-primary); }
      .rl-check { width: 15px; height: 15px; border-radius: 4px; border: 1.5px solid rgba(17,24,39,.25); flex: none;
        display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; }
      .rl-check.is-on { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
      .rl-chip { font-size: 10px; padding: 1px 7px; border-radius: 999px; background: rgba(17,24,39,.05); color: var(--dsw-alias-label-secondary); }
      .rl-hint { padding: 24px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 12px; }
      .rl-pop-foot { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid rgba(17,24,39,.06); }
      .rl-foot-note { flex: 1; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
      .rl-modal { position: fixed; inset: 0; background: rgba(15,23,42,.5); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 45; }
      .rl-modal-card { width: min(940px, calc(100vw - 40px)); max-height: 88vh; display: flex; flex-direction: column; border-radius: 18px;
        background: var(--dsw-alias-bg-layer-0, #fff); border: 1px solid rgba(17,24,39,.08); overflow: hidden; box-shadow: 0 24px 64px rgba(15,23,42,.28); }
      .rl-modal-head { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-bottom: 1px solid rgba(17,24,39,.06); flex-wrap: wrap; }
      .rl-modal-title { font-weight: 650; font-size: 14.5px; }
      .rl-modal-meta { font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
      .rl-modal-body { flex: 1; overflow: auto; padding: 14px 22px 26px; }
      .rl-sec { font-weight: 600; margin: 18px 0 8px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
      .rl-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .rl-chip-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 3px 9px; border-radius: 999px;
        border: 1px solid rgba(17,24,39,.1); background: var(--dsw-alias-bg-layer-1); color: inherit; cursor: pointer; }
      .rl-chip-btn b { color: #c33; font-weight: 600; }
      .rl-add { margin: 8px 0 0; }
      .rl-add input { width: 100%; padding: 7px 10px; border-radius: 9px; border: 1px solid rgba(17,24,39,.1);
        background: var(--dsw-alias-bg-layer-1); color: inherit; font: inherit; font-size: 12px; }
      .rl-add-list { margin-top: 6px; max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
      .rl-add-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; border: 0;
        background: transparent; color: inherit; font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
      .rl-add-row:hover { background: var(--dsw-alias-bg-layer-1); }
      .rl-add-row span { color: var(--dsw-alias-label-secondary); font-size: 11px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rl-mask { position: fixed; inset: 0; background: rgba(15,23,42,.45); backdrop-filter: blur(3px); display: flex;
        align-items: center; justify-content: center; z-index: 100000; padding: 16px; }
      .rl-box { width: min(720px, calc(100vw - 32px)); height: min(560px, calc(100vh - 32px)); display: flex; flex-direction: column;
        border-radius: 16px; background: var(--dsw-alias-bg-layer-0, #fff); border: 1px solid rgba(17,24,39,.08);
        overflow: hidden; box-shadow: 0 24px 64px rgba(15,23,42,.28); }
      .rl-box-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px; flex-wrap: wrap; }
      .rl-box-title { font-size: 14px; font-weight: 650; }
      .rl-tabs { display: inline-flex; padding: 3px; border-radius: 10px; background: rgba(17,24,39,.06); }
      .rl-tabs button { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px;
        padding: 5px 12px; border-radius: 7px; cursor: pointer; }
      .rl-tabs button.is-on { background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; box-shadow: 0 1px 3px rgba(17,24,39,.12); }
      .rl-box-search { padding: 0 16px 10px; }
      .rl-box-search input { width: 100%; padding: 8px 11px; border-radius: 9px; border: 1px solid rgba(17,24,39,.1);
        background: var(--dsw-alias-bg-layer-1); color: inherit; font: inherit; font-size: 12.5px; }
      .rl-box-grid { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 16px 12px;
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-content: start; }
      .rl-card-name { font-size: 12.5px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rl-card-desc { font-size: 10.5px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rl-card { display: flex; align-items: center; gap: 8px; text-align: left; padding: 10px 12px; border-radius: 10px;
        border: 1px solid rgba(17,24,39,.08); background: var(--dsw-alias-bg-layer-1); color: inherit; font: inherit; cursor: pointer; }
      .rl-card:hover { border-color: rgba(37,99,235,.4); }
      .rl-card.is-on { border-color: var(--dsw-alias-brand-primary); background: rgba(37,99,235,.07); }
      .rl-box-foot { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-top: 1px solid rgba(17,24,39,.06); }
      .rl-foot-note { flex: 1; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
      .md { line-height: 1.75; font-size: 13px; }
      .md { line-height: 1.75; font-size: 13px; }
      .md-h { font-weight: 600; margin: 18px 0 8px; }
      .md-h1 { font-size: 17px; } .md-h2 { font-size: 15px; } .md-h3 { font-size: 13.5px; }
      .md-p { margin: 8px 0; }
      .md-ul, .md-ol { margin: 8px 0; padding-left: 22px; }
      .md-ul li, .md-ol li { margin: 4px 0; }
      .md-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; background: rgba(17,24,39,.06); border-radius: 4px; padding: 1px 5px; }
      .md-pre { background: rgba(17,24,39,.05); border-radius: 10px; padding: 10px 12px; overflow-x: auto; font-size: 12px; line-height: 1.55; }
      .md-table { border-collapse: collapse; margin: 10px 0; font-size: 12.5px; width: 100%; }
      .md-table th, .md-table td { border: 1px solid rgba(17,24,39,.1); padding: 6px 9px; text-align: left; vertical-align: top; }
      .md-table th { background: rgba(17,24,39,.04); font-weight: 600; }
    `

    function openRoleDialog(onDone) {
      const dlg = document.createElement('dialog')
      dlg.style.cssText = 'border:1px solid rgba(17,24,39,.12);border-radius:14px;padding:0;width:min(520px,92vw);background:var(--dsw-alias-bg-layer-0,#fff);color:inherit;'
      dlg.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;padding:18px 20px;">
          <div style="font-size:15px;font-weight:600;">新建角色</div>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary);">角色名
            <input data-name style="padding:8px 10px;border-radius:8px;border:1px solid rgba(17,24,39,.12);font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);" />
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary);">一句话使命
            <input data-mission style="padding:8px 10px;border-radius:8px;border:1px solid rgba(17,24,39,.12);font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);" />
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary);">红线（每行一条，可留空）
            <textarea data-lines rows="4" style="padding:8px 10px;border-radius:8px;border:1px solid rgba(17,24,39,.12);font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);resize:vertical;"></textarea>
          </label>
          <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:4px;">
            <button data-cancel style="padding:6px 14px;border-radius:8px;border:1px solid rgba(17,24,39,.12);background:transparent;color:inherit;font:inherit;cursor:pointer;">取消</button>
            <button data-ok style="padding:6px 14px;border-radius:8px;border:0;background:var(--dsw-alias-brand-primary,#0d6e5a);color:#fff;font:inherit;cursor:pointer;">创建</button>
          </div>
        </div>`
      document.body.appendChild(dlg)
      const close = () => { dlg.close(); dlg.remove() }
      dlg.querySelector('[data-cancel]').addEventListener('click', close)
      dlg.querySelector('[data-ok]').addEventListener('click', async () => {
        const name = dlg.querySelector('[data-name]').value.trim()
        const mission = dlg.querySelector('[data-mission]').value.trim()
        const redlines = dlg.querySelector('[data-lines]').value.split('\n').map((x) => x.trim()).filter(Boolean)
        if (!name || !mission) { (name ? dlg.querySelector('[data-mission]') : dlg.querySelector('[data-name]')).focus(); return }
        try {
          await rpc('create', { name, mission, redlines })
          close()
          onDone()
        } catch (error) {
          window.alert ? window.alert(error.message) : null
        }
      })
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); close() })
      dlg.showModal()
    }

    function Icon(props) {
      const size = props.size || 16
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('circle', { cx: 12, cy: 8, r: 3.4 }),
        h('path', { d: 'M5 20c0-3.4 3.1-5.6 7-5.6s7 2.2 7 5.6' }),
      )
    }

    function Panel() {
      const [items, setItems] = React.useState([])
      const [cur, setCur] = React.useState(null)
      const [detail, setDetail] = React.useState(null)
      const [allSkills, setAllSkills] = React.useState([])
      const [skillQuery, setSkillQuery] = React.useState('')
      const [err, setErr] = React.useState('')
      const [savedTip, setSavedTip] = React.useState('')

      async function load() {
        try {
          const data = await rpc('list', {})
          setItems(data.items || [])
          setCur(data.current || null)
          setErr('')
        } catch (error) { setErr(error.message) }
      }

      React.useEffect(() => { load() }, [])

      async function open(item) {
        try {
          setDetail(await rpc('get', { id: item.id }))
          setSkillQuery('')
          setSavedTip('')
          const s = await skillsRpc('list', { q: '' })
          setAllSkills(s.items || [])
        } catch (error) { setErr(error.message) }
      }

      async function saveSkills(next) {
        if (!detail) return
        try {
          await rpc('update_skills', { id: detail.id, skills: next })
          setDetail({ ...detail, allowed_skills: next })
          setSavedTip('已保存')
          await load()
        } catch (error) { setErr(error.message) }
      }

      async function createRole() {
        openRoleDialog(load)
      }

      async function deleteRole() {
        if (!detail) return
        const dlg = document.createElement('dialog')
        dlg.style.cssText = 'border:1px solid rgba(17,24,39,.12);border-radius:14px;padding:0;width:min(420px,92vw);background:var(--dsw-alias-bg-layer-0,#fff);color:inherit;'
        dlg.innerHTML = `<div style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
          <div style="font-size:14px;font-weight:600;">删除角色</div>
          <div style="font-size:12.5px;color:var(--dsw-alias-label-secondary);">删除「${detail.id}」及其目录，无法撤销。</div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button data-no style="padding:6px 12px;border-radius:8px;border:1px solid rgba(17,24,39,.12);background:transparent;color:inherit;font:inherit;cursor:pointer;">取消</button>
            <button data-yes style="padding:6px 12px;border-radius:8px;border:0;background:#b42318;color:#fff;font:inherit;cursor:pointer;">删除</button>
          </div>
        </div>`
        document.body.appendChild(dlg)
        const close = () => { dlg.close(); dlg.remove() }
        dlg.querySelector('[data-no]').addEventListener('click', close)
        dlg.querySelector('[data-yes]').addEventListener('click', async () => {
          close()
          try {
            await rpc('delete', { id: detail.id })
            setDetail(null)
            await load()
          } catch (error) { setErr(error.message) }
        })
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); close() })
        dlg.showModal()
      }

      async function useRole() {
        if (!detail) return
        try {
          await rpc('bind', { roles: [detail.id], mode: detail.mode, skills: (cur && cur.skills) || [], atoms: (cur && cur.atoms) || [] })
          setDetail(null)
          await load()
        } catch (error) { setErr(error.message) }
      }

      async function resetRole() {
        try { await rpc('bind', { roles: [], skills: (cur && cur.skills) || [], atoms: (cur && cur.atoms) || [] }); await load() } catch (error) { setErr(error.message) }
      }

      const addable = allSkills.filter((s) => detail && !detail.allowed_skills.includes(s.name) && fuzzy(s.name, skillQuery))

      return h('div', { className: 'rl-root' },
        h('style', null, CSS),
        h('div', { className: 'rl-head' },
          h('div', null,
            h('div', { className: 'rl-title' }, '角色体系'),
            h('div', { className: 'rl-sub' }, `${items.length} 个角色 · 点开可改技能 · 在输入框选择本次对话用谁`),
          ),
          h('button', { className: 'rl-btn', onClick: createRole }, '新建角色'),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            h('span', { className: 'rl-current' }, '当前：', h('b', { style: { color: 'inherit' } }, cur && cur.id ? cur.id : '默认（不选角色）')),
            cur && cur.id ? h('button', { className: 'rl-btn', onClick: resetRole }, '恢复默认') : null,
          ),
        ),
        err ? h('div', { className: 'rl-err' }, err) : null,
        h('div', { className: 'rl-grid' },
          items.length
            ? items.map((item) =>
                h('button', { key: item.id, className: `rl-card${cur && cur.id === item.id ? ' is-on' : ''}`, onClick: () => open(item) },
                  h('span', { className: 'rl-name' }, item.id),
                  h('span', { className: 'rl-meta' },
                    h('span', { className: 'rl-tag' }, `技能 ${item.skills}`),
                    h('span', { className: 'rl-tag' }, `知识 ${item.knowledge || 0}`),
                  ),
                ),
              )
            : h('div', { className: 'rl-empty' }, '还没有角色'),
        ),
        detail
          ? h('div', { className: 'rl-modal', onClick: () => setDetail(null) },
              h('div', { className: 'rl-modal-card', onClick: (e) => e.stopPropagation() },
                h('div', { className: 'rl-modal-head' },
                  h('span', { className: 'rl-modal-title' }, detail.id),
                  h('span', { className: 'rl-modal-meta' }, `模式 ${detail.mode}`),
                  savedTip ? h('span', { className: 'rl-modal-meta', style: { color: '#047857' } }, savedTip) : null,
                  h('button', { className: 'rl-btn is-primary', onClick: useRole }, '在本次对话中使用'),
                  h('button', { className: 'rl-btn', style: { marginLeft: 'auto' }, onClick: deleteRole }, '删除角色'),
                  h('button', { className: 'rl-btn', onClick: () => setDetail(null) }, '关闭'),
                ),
                h('div', { className: 'rl-modal-body' },
                  h('div', { className: 'rl-sec' }, `掌握技能（${detail.allowed_skills.length}）· 点 × 移除`),
                  h('div', { className: 'rl-chips' },
                    ...detail.allowed_skills.map((s) =>
                      h('button', {
                        key: s,
                        className: 'rl-chip-btn',
                        title: '移除该技能',
                        onClick: () => saveSkills(detail.allowed_skills.filter((x) => x !== s)),
                      }, s, h('b', null, '×')),
                    ),
                  ),
                  h('div', { className: 'rl-add' },
                    h('input', { value: skillQuery, placeholder: '搜索并添加技能（模糊匹配）', onChange: (e) => setSkillQuery(e.target.value) }),
                    skillQuery
                      ? h('div', { className: 'rl-add-list' },
                          ...addable.slice(0, 8).map((s) =>
                            h('button', { key: s.name, className: 'rl-add-row', onClick: () => { saveSkills([...detail.allowed_skills, s.name]); setSkillQuery('') } },
                              h('span', null, `+ ${s.name}`),
                              h('span', null, s.summary || ''),
                            ),
                          ),
                          addable.length ? null : h('div', { className: 'rl-hint' }, '没有匹配的技能'),
                        )
                      : null,
                  ),
                  h('div', { className: 'rl-sec' }, `掌握知识（${detail.knowledge.length}）`),
                  h('div', { className: 'rl-chips' }, ...detail.knowledge.map((k) => h('span', { key: k.id, className: 'rl-tag' }, cleanTitle(k.title)))),
                  h('div', { className: 'rl-sec' }, '核心（CORE）'),
                  h(Markdown, { text: detail.core }),
                  h('div', { className: 'rl-sec' }, '能力清单（PROMPT）'),
                  h(Markdown, { text: detail.prompt }),
                ),
              ),
            )
          : null,
      )
    }

    function composerText(roles, skills) {
      const parts = []
      if (roles.length) parts.push(`【角色】${roles.join('、')}`)
      if (skills.length) parts.push(`【技能】${skills.join('、')}`)
      return parts.length ? parts.join(' ') + '\n' : ''
    }

    function composerEditor() {
      return document.querySelector('[data-composer-input]') || document.querySelector('[contenteditable="true"]')
    }

    function placeCaretAtStart(editor) {
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(true)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }

    function injectIntoComposer(text) {
      if (!text) return false
      const editor = composerEditor()
      if (!editor) return false
      try {
        editor.focus()
        if ((editor.innerText || '').includes('【角色】') || (editor.innerText || '').includes('【技能】')) return true
        placeCaretAtStart(editor)
        const inserted = document.execCommand && document.execCommand('insertText', false, text)
        if (inserted && (editor.innerText || '').includes('【技能】')) return true
        try {
          const dt = new DataTransfer()
          dt.setData('text/plain', text)
          editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
          if ((editor.innerText || '').includes('【技能】')) return true
        } catch {
          /* 继续兜底 */
        }
        return false
      } catch {
        return false
      }
    }

    function ensureComposerStyles() {
      if (document.getElementById('rs-composer-style')) return
      const style = document.createElement('style')
      style.id = 'rs-composer-style'
      style.textContent = `
        .rl-dock { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; width: 100%; padding: 2px 12px 0; box-sizing: border-box; }
        .rl-dock-label { font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
        .rl-dock .rl-chip-sel { display: inline-flex; align-items: center; gap: 4px; padding: 2px 3px 2px 8px;
          border-radius: 999px; background: var(--dsw-alias-bg-layer-0, #fff); border: 1px solid rgba(17,24,39,.1);
          color: inherit; font-size: 11px; line-height: 1.5; box-shadow: 0 1px 3px rgba(17,24,39,.05); }
        .rl-dock .rl-chip-sel b { font-weight: 600; font-size: 10px; opacity: .6; margin-right: 2px; }
        .rl-dock .rl-chip-x { border: 0; background: transparent; color: inherit; font-size: 11px; line-height: 1;
          cursor: pointer; padding: 1px 4px; border-radius: 999px; opacity: .7; }
        .rl-dock .rl-chip-x:hover { background: rgba(17,24,39,.1); opacity: 1; }
      `
      document.head.appendChild(style)
    }

    function ensurePickerStyles() {
      if (document.getElementById('rs-picker-style')) return
      const style = document.createElement('style')
      style.id = 'rs-picker-style'
      style.textContent = `
        .rs-dlg { width: min(760px, calc(100vw - 48px)); height: min(560px, calc(100vh - 48px)); max-height: none;
          padding: 0; border: 1px solid rgba(17,24,39,.08); border-radius: 16px; overflow: hidden;
          background: var(--dsw-alias-bg-layer-0, #fff); color: var(--dsw-alias-label-primary, #0f2232);
          box-shadow: 0 24px 64px rgba(15,23,42,.28); font: inherit; }
        .rs-dlg::backdrop { background: rgba(15,23,42,.45); backdrop-filter: blur(2px); }
        .rs-shell { display: flex; flex-direction: column; height: 100%; min-height: 0; font-size: 13px; }
        .rs-head { display: flex; align-items: center; gap: 12px; padding: 16px 20px 12px; flex-wrap: wrap; }
        .rs-title { font-size: 15px; font-weight: 600; }
        .rs-tabs { display: inline-flex; padding: 3px; border-radius: 10px; background: rgba(17,24,39,.06); }
        .rs-tab { border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #536676); font: inherit;
          font-size: 12px; padding: 6px 12px; border-radius: 7px; cursor: pointer; }
        .rs-tab.is-on { background: var(--dsw-alias-bg-layer-0, #fff); color: var(--dsw-alias-label-primary, #0f2232);
          box-shadow: 0 1px 3px rgba(17,24,39,.12); }
        .rs-x { margin-left: auto; border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #536676);
          font: inherit; font-size: 12px; cursor: pointer; padding: 8px; border-radius: 8px; }
        .rs-x:hover { background: rgba(17,24,39,.05); }
        .rs-search { padding: 0 20px 12px; }
        .rs-search input { width: 100%; padding: 8px 11px; border-radius: 9px; border: 1px solid rgba(17,24,39,.12);
          background: var(--dsw-alias-bg-layer-1, #f5f7f9); color: inherit; font: inherit; font-size: 12.5px; }
        .rs-search input:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #0d6e5a); outline-offset: 1px; }
        .rs-grid { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 20px 16px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-content: start; }
        .rs-card { display: flex; align-items: center; gap: 9px; min-height: 44px; padding: 10px 12px; border-radius: 10px;
          border: 1px solid rgba(17,24,39,.1); background: var(--dsw-alias-bg-layer-1, #f5f7f9); color: inherit;
          font: inherit; font-size: 12.5px; text-align: left; cursor: pointer; }
        .rs-card:hover { border-color: rgba(17,24,39,.22); }
        .rs-card.is-on { border-color: var(--dsw-alias-brand-primary, #0d6e5a); background: rgba(13,110,90,.07); }
        .rs-card .rs-check { width: 16px; height: 16px; flex: none; border-radius: 4px; border: 1.5px solid rgba(17,24,39,.25);
          display: flex; align-items: center; justify-content: center; font-size: 10px; color: #fff; }
        .rs-card.is-on .rs-check { background: var(--dsw-alias-brand-primary, #0d6e5a); border-color: var(--dsw-alias-brand-primary, #0d6e5a); }
        .rs-card .rs-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rs-empty { grid-column: 1 / -1; padding: 40px 0; text-align: center; color: var(--dsw-alias-label-secondary, #536676); }
        .rs-foot { display: flex; align-items: center; gap: 10px; padding: 12px 20px; border-top: 1px solid rgba(17,24,39,.08); }
        .rs-note { flex: 1; font-size: 11.5px; color: var(--dsw-alias-label-secondary, #536676); }
        .rs-btn { min-height: 36px; padding: 0 14px; border-radius: 9px; border: 1px solid rgba(17,24,39,.12);
          background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; font: inherit; font-size: 12.5px; cursor: pointer; }
        .rs-btn.rs-primary { background: var(--dsw-alias-brand-primary, #0d6e5a); border-color: var(--dsw-alias-brand-primary, #0d6e5a); color: #fff; }
      `
      document.head.appendChild(style)
    }

    async function hubRpc(action, payload) {
      const response = await fetch('/hub/api/rpc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(payload || {}) }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body || body.ok !== true) throw new Error((body && body.error) || `HTTP ${response.status}`)
      return body.data
    }

    function openPicker(opts) {
      ensurePickerStyles()
      const dlg = document.createElement('dialog')
      dlg.className = 'rs-dlg'
      dlg.innerHTML = `
        <div class="rs-shell">
          <div class="rs-head">
            <div class="rs-title">本次对话使用</div>
            <div class="rs-tabs">
              <button class="rs-tab is-on" data-tab="roles">角色 0</button>
              <button class="rs-tab" data-tab="skills">技能 0</button>
              <button class="rs-tab" data-tab="atoms">知识元 0</button>
            </div>
            <button class="rs-x" data-close>关闭</button>
          </div>
          <div class="rs-search"><input data-q placeholder="搜索角色名称" /></div>
          <div class="rs-grid" data-grid></div>
          <div class="rs-foot">
            <div class="rs-note" data-note></div>
            <button class="rs-btn" data-close>取消</button>
            <button class="rs-btn rs-primary" data-ok>确定</button>
          </div>
        </div>`
      document.body.appendChild(dlg)

      let tab = 'roles'
      let q = ''
      const chosenRoles = new Set(opts.pickedRoles || [])
      const chosenSkills = new Set(opts.pickedSkills || [])
      const chosenAtoms = new Set(opts.pickedAtoms || [])
      const grid = dlg.querySelector('[data-grid]')
      const note = dlg.querySelector('[data-note]')
      const input = dlg.querySelector('[data-q]')
      const tabs = {
        roles: dlg.querySelector('[data-tab="roles"]'),
        skills: dlg.querySelector('[data-tab="skills"]'),
        atoms: dlg.querySelector('[data-tab="atoms"]'),
      }

      function render() {
        tabs.roles.textContent = `角色 ${chosenRoles.size}`
        tabs.skills.textContent = `技能 ${chosenSkills.size}`
        tabs.atoms.textContent = `知识元 ${chosenAtoms.size}`
        for (const key of ['roles', 'skills', 'atoms']) tabs[key].classList.toggle('is-on', tab === key)
        note.textContent = `已选 角色 ${chosenRoles.size} · 技能 ${chosenSkills.size} · 知识元 ${chosenAtoms.size}`
        input.placeholder = tab === 'roles' ? '搜索角色名称' : tab === 'skills' ? '搜索技能名称或说明' : '搜索知识元标题或正文'
        grid.innerHTML = ''
        let rows = []
        if (tab === 'roles') {
          rows = opts.roles.filter((r) => fuzzy(r.id, q)).map((r) => ({ name: r.id, checked: chosenRoles.has(r.id), key: r.id }))
        } else if (tab === 'skills') {
          rows = opts.skills.filter((s) => fuzzy(s.name, q) || fuzzy(s.summary, q)).map((s) => ({ name: s.name, checked: chosenSkills.has(s.name), key: s.name }))
        } else {
          rows = opts.atoms.filter((a) => fuzzy(a.title, q) || fuzzy(a.id, q)).map((a) => ({ name: a.title || a.id, checked: chosenAtoms.has(a.id), key: a.id }))
        }
        if (!rows.length) {
          const empty = document.createElement('div')
          empty.className = 'rs-empty'
          empty.textContent = tab === 'roles' ? '没有匹配的角色' : tab === 'skills' ? '没有匹配的技能' : '没有匹配的知识元'
          grid.appendChild(empty)
          return
        }
        for (const row of rows) {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = `rs-card${row.checked ? ' is-on' : ''}`
          btn.innerHTML = `<span class="rs-check">${row.checked ? '✓' : ''}</span><span class="rs-name"></span>`
          btn.querySelector('.rs-name').textContent = row.name
          btn.addEventListener('click', () => {
            if (tab === 'roles') {
              if (chosenRoles.has(row.key)) chosenRoles.clear()
              else {
                chosenRoles.clear()
                chosenRoles.add(row.key)
              }
            } else if (tab === 'skills') {
              if (chosenSkills.has(row.key)) chosenSkills.delete(row.key)
              else chosenSkills.add(row.key)
            } else if (chosenAtoms.has(row.key)) chosenAtoms.delete(row.key)
            else chosenAtoms.add(row.key)
            render()
          })
          grid.appendChild(btn)
        }
      }

      function close() {
        dlg.close()
        dlg.remove()
      }

      for (const key of ['roles', 'skills', 'atoms']) {
        tabs[key].addEventListener('click', () => {
          tab = key
          q = ''
          input.value = ''
          render()
        })
      }
      input.addEventListener('input', () => { q = input.value; render() })
      dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close))
      dlg.querySelector('[data-ok]').addEventListener('click', () => {
        const roles = [...chosenRoles]
        const skills = [...chosenSkills]
        const atoms = [...chosenAtoms]
        close()
        opts.onConfirm(roles, skills, atoms)
      })
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); close() })
      render()
      dlg.showModal()
      input.focus()
    }

    function DockChips() {
      const [cur, setCur] = React.useState(null)
      const [err, setErr] = React.useState('')

      async function load() {
        try {
          const data = await rpc('list', {})
          setCur(data.current || null)
        } catch (error) { setErr(error.message) }
      }

      React.useEffect(() => {
        load()
        const onChange = () => load()
        window.addEventListener('dsh-role-selection', onChange)
        return () => window.removeEventListener('dsh-role-selection', onChange)
      }, [])

      const base = cur || {}
      const roles = ((base.roles) || (base.id ? [base.id] : [])).slice(0, 1)
      const skills = base.skills || []
      const atoms = base.atoms || []
      if (!roles.length && !skills.length && !atoms.length) return null

      async function apply(next) {
        try {
          const state = await rpc('bind', next)
          setCur(state)
          setErr('')
        } catch (error) { setErr(error.message) }
        window.dispatchEvent(new Event('dsh-role-selection'))
      }

      return h('div', { className: 'rl-dock' },
        h('span', { className: 'rl-dock-label' }, '本次对话'),
        ...roles.map((r) => h('span', { className: 'rl-chip-sel', key: `r-${r}` }, h('b', null, '角色'), r,
          h('button', { className: 'rl-chip-x', title: '取消该角色', onClick: () => apply({ roles: [], skills, atoms }) }, '×'))),
        ...skills.map((s) => h('span', { className: 'rl-chip-sel', key: `s-${s}` }, h('b', null, '技能'), s,
          h('button', { className: 'rl-chip-x', title: '取消该技能', onClick: () => apply({ roles, skills: skills.filter((x) => x !== s), atoms }) }, '×'))),
        ...atoms.map((a) => h('span', { className: 'rl-chip-sel', key: `a-${a}` }, h('b', null, '知识'), a,
          h('button', { className: 'rl-chip-x', title: '取消该知识元', onClick: () => apply({ roles, skills, atoms: atoms.filter((x) => x !== a) }) }, '×'))),
        err ? h('span', { className: 'rl-err-inline' }, err) : null,
      )
    }

    function Selector() {
      const [roles, setRoles] = React.useState([])
      const [skills, setSkills] = React.useState([])
      const [atoms, setAtoms] = React.useState([])
      const [cur, setCur] = React.useState(null)
      const [err, setErr] = React.useState('')

      async function load() {
        try {
          const data = await rpc('list', {})
          setRoles(data.items || [])
          setCur(data.current || null)
          const s = await skillsRpc('list', { q: '' })
          setSkills(s.items || [])
          const a = await hubRpc('list', { q: '', status: 'active' })
          setAtoms(a.items || [])
        } catch (error) { setErr(error.message) }
      }

      React.useEffect(() => {
        load()
        const onChange = () => load()
        window.addEventListener('dsh-role-selection', onChange)
        return () => window.removeEventListener('dsh-role-selection', onChange)
      }, [])

      async function apply(rolesSel, skillsSel, atomsSel) {
        try {
          await rpc('bind', { roles: rolesSel, skills: skillsSel, atoms: atomsSel || [] })
          await load()
          window.dispatchEvent(new Event('dsh-role-selection'))
        } catch (error) { setErr(error.message) }
      }

      const base = cur || {}
      const activeRoles = ((base.roles) || (base.id ? [base.id] : [])).slice(0, 1)
      const activeSkills = base.skills || []
      const activeAtoms = base.atoms || []
      const counts = activeRoles.length + activeSkills.length + activeAtoms.length

      return h('span', { className: 'rl-wrap' },
        h('button', {
          className: 'rl-pick',
          onClick: () => openPicker({
            roles,
            skills,
            atoms,
            pickedRoles: activeRoles,
            pickedSkills: activeSkills,
            pickedAtoms: activeAtoms,
            onConfirm: apply,
          }),
        },
          h('span', { className: 'rl-dot' }),
          counts ? `知识中枢 · ${activeRoles.length}/${activeSkills.length}/${activeAtoms.length}` : '知识中枢',
        ),
        err ? h('span', { className: 'rl-err-inline' }, err) : null,
      )
    }
      return { Panel, Selector, ensureComposerStyles }
    })()

    const HB_CSS = `
      .hb-root { display: flex; flex-direction: column; height: 100%; min-height: 0; }
      .hb-tabs { display: flex; gap: 4px; padding: 12px 20px 0; }
      .hb-tab { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 13px;
        padding: 8px 14px; border-radius: 10px 10px 0 0; cursor: pointer; }
      .hb-tab:hover { background: rgba(17,24,39,.05); color: inherit; }
      .hb-tab.is-on { background: var(--dsw-alias-bg-layer-0, #fff); color: inherit; font-weight: 600;
        box-shadow: 0 -1px 3px rgba(17,24,39,.06); }
      .hb-body { flex: 1; min-height: 0; border-top: 1px solid rgba(17,24,39,.08); overflow: hidden; }
    `

    let chipsBar = null
    let chipsTimer = null

    function ensureChipsStyle() {
      if (document.getElementById('hub-chips-style')) return
      const s = document.createElement('style')
      s.id = 'hub-chips-style'
      s.textContent = `
        .hub-chips-bar { position: fixed; z-index: 2147483000; display: none; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px; pointer-events: auto; }
        .hub-chips-bar .chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 3px 3px 9px; pointer-events: auto;
          border-radius: 999px; background: var(--dsw-alias-bg-layer-0,#fff); border: 1px solid rgba(17,24,39,.12);
          color: inherit; box-shadow: 0 2px 6px rgba(17,24,39,.08); }
        .hub-chips-bar .chip b { color: var(--dsw-alias-brand-primary,#0d6e5a); font-size: 10px; font-weight: 600; }
        .hub-chips-bar .x { border: 0; background: transparent; color: inherit; font-size: 12px; cursor: pointer; min-width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; opacity: .75; }
        .hub-chips-bar .x:hover { background: rgba(17,24,39,.1); opacity: 1; }
      `
      document.head.appendChild(s)
    }

    async function chipsCall(action, payload) {
      const res = await fetch('/roles/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...(payload || {}) }) })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body || body.ok !== true) throw new Error((body && body.error) || 'rpc error')
      return body.data
    }

    async function refreshChips() {
      ensureChipsStyle()
      if (!chipsBar) { chipsBar = document.createElement('div'); chipsBar.className = 'hub-chips-bar'; document.body.appendChild(chipsBar) }
      let state = null
      try { const data = await chipsCall('list', {}); state = data.current || null } catch { return }
      const roles = (state && state.roles) || (state && state.id ? [state.id] : [])
      const skills = (state && state.skills) || []
      const atoms = (state && state.atoms) || []
      const editor = document.querySelector('[data-composer-input]')
      if (!editor || (!roles.length && !skills.length && !atoms.length)) { chipsBar.style.display = 'none'; return }
      const rect = editor.getBoundingClientRect()
      chipsBar.style.display = 'flex'
      chipsBar.style.left = Math.round(rect.left) + 'px'
      chipsBar.style.width = Math.max(220, Math.round(rect.width)) + 'px'
      chipsBar.style.bottom = Math.round(window.innerHeight - rect.top + 8) + 'px'
      const key = JSON.stringify([roles, skills, atoms, Math.round(rect.left), Math.round(rect.width), Math.round(window.innerHeight - rect.top)])
      if (chipsBar.dataset.key === key) return
      chipsBar.dataset.key = key
      chipsBar.innerHTML = ''
      const add = (label, name, kind) => {
        const chip = document.createElement('span'); chip.className = 'chip'
        const b = document.createElement('b'); b.textContent = label; chip.appendChild(b)
        chip.appendChild(document.createTextNode(name))
        const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.textContent = '×'
        x.title = '取消该' + label
        x.addEventListener('click', async (ev) => {
          ev.preventDefault()
          ev.stopPropagation()
          let fr = roles
          let fs = skills
          let fa = atoms
          try {
            const data = await chipsCall('list', {})
            const st = data.current || {}
            fr = st.roles || (st.id ? [st.id] : [])
            fs = st.skills || []
            fa = st.atoms || []
          } catch { /* 用当前渲染值兜底 */ }
          const nextRoles = kind === '角色' ? fr.filter((r) => r !== name) : fr
          const nextSkills = kind === '技能' ? fs.filter((s) => s !== name) : fs
          const nextAtoms = kind === '知识' ? fa.filter((a) => a !== name) : fa
          try {
            await chipsCall('bind', { roles: nextRoles, skills: nextSkills, atoms: nextAtoms })
          } catch { return }
          window.dispatchEvent(new Event('dsh-role-selection'))
          chipsBar.dataset.key = ''
          refreshChips()
        })
        chip.addEventListener('mousedown', (ev) => ev.stopPropagation())
        chip.appendChild(x); chipsBar.appendChild(chip)
      }
      roles.slice(0, 1).forEach((r) => add('角色', r, '角色'))
      skills.forEach((s) => add('技能', s, '技能'))
      atoms.forEach((a) => add('知识', a, '知识'))
    }

    function mountChips() {
      refreshChips()
      window.addEventListener('dsh-role-selection', refreshChips)
      window.addEventListener('resize', refreshChips)
      document.addEventListener('focusin', refreshChips)
      if (chipsTimer) clearInterval(chipsTimer)
      chipsTimer = setInterval(refreshChips, 2000)
    }

    function Icon(props) {
      const size = props.size || 16
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M12 4.5c-3.4 0-6 2-6 4.6 0 1.2.7 2.2 1.8 3-1.1.7-1.8 1.7-1.8 2.9 0 2.6 2.6 4.5 6 4.5s6-1.9 6-4.5c0-1.2-.7-2.2-1.8-2.9 1.1-.8 1.8-1.8 1.8-3 0-2.6-2.6-4.6-6-4.6z' }),
        h('path', { d: 'M12 4.5v13.5' }),
      )
    }

    function BrainPanel() {
      const [tab, setTab] = React.useState('knowledge')
      return h('div', { className: 'hb-root' },
        h('style', null, HB_CSS),
        h('div', { className: 'hb-tabs' },
          ...[['knowledge', '知识元'], ['skills', '技能'], ['roles', '角色']].map(([key, label]) =>
            h('button', { key, className: `hb-tab${tab === key ? ' is-on' : ''}`, onClick: () => setTab(key) }, label),
          ),
        ),
        h('div', { className: 'hb-body' },
          tab === 'knowledge' ? h(KnowledgeMod.Panel) : tab === 'skills' ? h(SkillMod.Panel) : h(RoleMod.Panel),
        ),
      )
    }

    function apply(ctx) {
      RoleMod.ensureComposerStyles()
      mountChips()
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: 'hub-brain', order: 21, label: () => '中枢大脑' }, Icon))
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'hub-brain' }, BrainPanel))
      ctx.slots.inject('conversation.input.left', () =>
        ctx.slots.register({ name: 'conversation.input.left', id: 'role-skill-picker', order: 9, label: () => '知识中枢' }, RoleMod.Selector))
    }

    return { inject: ['slots'], apply }
  },
})
