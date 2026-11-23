# 中枢大脑 · dsh-hub-brain

> DeepSeek Harness（DSH）插件：知识元、技能、角色三个模块，合在一个「中枢大脑」里。
> 侧栏一个入口；对话输入框旁可临时挑选角色、技能与知识元。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/release/qiyaogongfang/dsh-hub-brain)](https://github.com/qiyaogongfang/dsh-hub-brain/releases)

---

## 1. 简介

中枢大脑是 DSH 的一个插件，提供三块能力：

- **知识元**：可检索、可裁定、可回退的本地知识库；
- **技能**：可检索、可加载、可新建的 `SKILL.md` 技能实体；
- **角色**：带 CORE 冻结层、PROMPT 能力层、技能白名单与知识视图的智能体人格。

三块共用一个侧栏入口、一套本地数据、一条对话内选择链路。数据全部在本机，插件不联网、不上传任何内容。

---

## 2. 功能

### 2.1 知识元

- 列表、搜索（标题 / 正文，2 字起）、按状态筛选（已生效 / 待裁定 / 全部）；
- 查看正文（Markdown：标题、列表、表格、代码块）；
- 改标题、一级分类、二级分类；
- 挂起（active → pending，默认检索不再返回）与通过（pending → active）；
- 新建知识元：对话里说「记一下……」，或调用 `ke_save`。

### 2.2 技能

- 卡片网格：名称、中文说明、公用 / 特定标签与归属角色；
- 查看完整 `SKILL.md`；
- 新建技能（名称 + 中文说明 + 正文），自动同步中文简介；
- 删除技能（二次确认，删除目录与简介）。

### 2.3 角色

- 角色卡片：技能数 / 知识数；
- 查看 CORE、PROMPT、掌握技能、掌握知识；
- 新建角色（名称 + 使命 + 红线，自动生成 `core.md`、`prompt.md`、`role.json` 与 `core_hash`）；
- 删除角色（二次确认；若为当前选中角色会清空选择）；
- 增删角色技能白名单；
- 学习 / 进化（见 §6）。

### 2.4 对话内选择

输入框左侧「知识中枢」按钮，弹框三个页签：

| 页签 | 选择方式 |
|---|---|
| 角色 | 单选（再点即取消） |
| 技能 | 多选 |
| 知识元 | 多选 |

确定后，选中项显示为输入框上方的胶囊，每枚带 ×，点击即取消并持久化。未选角色时也能只带技能 / 知识元，系统提示会列出本次选定内容。

---

## 3. 安装

### 方式 A：GitHub Release（推荐）

1. 打开 [Releases](https://github.com/qiyaogongfang/dsh-hub-brain/releases)，下载 `dsh-hub-brain-<版本>.tgz`；
2. 在 DSH 插件管理器里安装该 tgz；
3. 刷新页面，侧栏出现「中枢大脑」。

### 方式 B：GitHub Packages（npm）

包名 `@qiyaogongfang/dsh-hub-brain`，注册表 `https://npm.pkg.github.com`。

```bash
npm config set @qiyaogongfang:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken <你的_GITHUB_TOKEN>
npm install @qiyaogongfang/dsh-hub-brain
```

### 方式 C：本地打包

```bash
git clone https://github.com/qiyaogongfang/dsh-hub-brain.git
cd dsh-hub-brain
npm pack
# 得到 dsh-hub-brain-<版本>.tgz，用 DSH 插件管理器安装
```

> 本插件是 DSH 插件（cordis bundle + client），不是独立 Node 应用。

---

## 4. 数据与配置

默认数据根 `Q:\能力中枢\data`，可用环境变量改：

| 环境变量 | 作用 |
|---|---|
| `DSH_KNOWLEDGE_HUB_DATA` | 知识元 / 索引 / 状态 |
| `DSH_SKILL_RING_DATA` | 技能实体 |
| `DSH_ROLES_DATA` | 角色定义 |

目录结构：

```
data/
├── atoms/       知识元 *.md（一元一文件）
├── skills/      技能实体 <name>/SKILL.md + 资产
├── roles/       角色 <id>/role.json + core.md + prompt.md + eval/
├── state/       本次对话选择 current-role.json
├── archive/     历史知识卡归档
└── index/       可重建索引（不入 git）
```

`state/current-role.json` 示例：

```json
{
  "id": "公司创业大师",
  "roles": ["公司创业大师"],
  "mode": "use",
  "skills": ["docx"],
  "atoms": ["ke_cn_filing_01"],
  "bound_at": "2026-11-23T03:46:27.007Z"
}
```

---

## 5. 工具（模型侧）

| 模块 | 工具 |
|---|---|
| 知识元 | `ke_search` `ke_get` `ke_save` `ke_decide` `ke_pending` `ke_revert` `ke_history` |
| 技能 | `skill_search` `skill_load` `skill_list` `skill_health` `skill_create` |
| 角色 | `role_list` `role_load` `role_bind` `role_mode` `role_status` `role_create` `role_learn` `role_evolve` |

---

## 6. 学习与进化

在对话里直接说：

| 你说 | 行为 |
|---|---|
| 「学习：……」/「记住这些」 | `role_learn`：把材料写成一条知识元，挂到所选角色 |
| 「进化：……」/「升级这个角色」 | `role_evolve`：追加 prompt、增删技能白名单、版本 +0.1 |

两条都不改 CORE 冻结层；改核心必须显式口令并重算 `core_hash`。

---

## 7. 界面结构

```
侧栏「中枢大脑」
└── 主面板
    ├── 页签：知识元 | 技能 | 角色
    └── 各页：列表/卡片 + 详情

输入框
├── 左侧「知识中枢」按钮（弹框三页签）
└── 上方胶囊：角色 / 技能 / 知识 各一枚，带 ×
```

---

## 8. 开发

```
dsh-hub-brain/
├── index.js              Host 入口：注册三个模块的工具、RPC、系统提示
├── host/
│   ├── knowledge.js      知识元（检索/保存/裁定/回退）
│   ├── skills.js         技能（检索/加载/创建/健康检查）
│   └── roles.js          角色（加载/绑定/创建/学习/进化）
├── client.js             浏览器端：三页签面板 + 输入框选择器 + 胶囊浮层
├── cordis.patch.yml      插件挂载声明
└── package.json
```

本地调试：

```bash
npm pack
# 安装 tgz 后刷新页面；RPC 自测：
curl -X POST http://127.0.0.1:<dsh端口>/hub/api/rpc    -d '{"action":"counts"}'
curl -X POST http://127.0.0.1:<dsh端口>/skills/api/rpc -d '{"action":"counts"}'
curl -X POST http://127.0.0.1:<dsh端口>/roles/api/rpc  -d '{"action":"list"}'
```

发布：构建 dist → 发布 npm → 打 tag 并上传 Release 附件。版本号遵循 `主.次.修订`。

---

## 9. 常见问题

**Q：侧栏没有「中枢大脑」？**
A：确认插件已启用、页面已刷新；DSH 客户端插件在页面加载时注入。

**Q：胶囊不显示？**
A：胶囊是 `document.body` 上的浮层，按输入框位置定位；刷新一次页面即可恢复。

**Q：知识元选了但没生效？**
A：看按钮标签计数；`pending` 状态的知识元默认检索不返回，需要在知识元页「通过」。

**Q：数据会上传吗？**
A：不会。插件只读写本地目录，没有外发请求。

---

## 10. 版本

| 版本 | 日期 | 说明 |
|---|---|---|
| 1.0.0 | 2026-11-23 | 首个版本：知识元、技能、角色三模块，对话内选择与学习/进化 |

## 11. License

[MIT](LICENSE)
