// ============================================================
// 科研工作台 · Cloudflare Worker
// 认证(D1+PBKDF2+session cookie) / 项目任务API / LLM代理 / 工作流引擎
// ============================================================

const SESSION_COOKIE = 'wb_session';
const SESSION_DAYS = 30;

// ---------- 组员配置（单一事实源，前端经 /api/meta 获取） ----------
const MEMBERS = {
  lit: {
    id: 'lit', no: '01', name: 'AI 文献组员', en: 'Literature Assistant',
    tagline: '文献调研与知识管理',
    duties: ['检索中英文文献', '筛选高相关文献', '深度阅读与提炼要点', '生成阅读卡片', '管理参考文献'],
    subs: [
      { id: 'search', name: 'Search subagent', duty: '检索文献、制定关键词、多数据库搜索、去重与初筛' },
      { id: 'reading', name: 'Reading subagent', duty: '深度阅读、提取研究问题/方法/结果/局限、生成阅读笔记' },
      { id: 'citation', name: 'Citation subagent', duty: '管理文献、生成引用格式、构建参考文献库' },
    ],
    tools: ['Scopus', 'Web of Science', 'Google Scholar', 'Zotero', 'Connected Papers'],
    input: ['研究主题', '关键词', '研究方向', '目标期刊或综述需求'],
    output: ['高相关文献清单', '阅读卡片', '研究脉络总结', '参考文献库'],
    stages: [
      { name: '研究主题', sub: 'search', out: 'points' },
      { name: '检索', sub: 'search', out: 'points' },
      { name: '初筛', sub: 'search', out: 'points' },
      { name: '精读', sub: 'reading', out: 'cards' },
      { name: '整理引用', sub: 'citation', out: 'refs' },
    ],
  },
  exec: {
    id: 'exec', no: '02', name: 'AI 科研执行组员', en: 'Research Execution',
    tagline: '模拟计算与数据处理',
    duties: ['编写/修改代码', '设置仿真算例', '批量运行与监控', '生成 UDF/脚本', '结果处理与可视化'],
    subs: [
      { id: 'code', name: 'Code subagent', duty: '编写/修改代码、生成 UDF、检查脚本错误' },
      { id: 'simulation', name: 'Simulation subagent', duty: '设置算例、参数配置、批量运行与监控' },
      { id: 'post', name: 'Post-process subagent', duty: '提取结果、数据整理、生成图表' },
    ],
    tools: ['ANSYS Fluent', 'Python', 'MATLAB', 'Origin', 'ParaView'],
    input: ['研究目标', '模型与边界条件', '参数表', '原始结果文件'],
    output: ['可运行脚本/UDF', '仿真结果', '后处理图表', '整理后的数据表'],
    stages: [
      { name: '研究问题', sub: 'code', out: 'points' },
      { name: '设定', sub: 'simulation', out: 'points' },
      { name: '运行', sub: 'simulation', out: 'points' },
      { name: '后处理', sub: 'post', out: 'points' },
      { name: '汇总', sub: 'post', out: 'points' },
    ],
  },
  edit: {
    id: 'edit', no: '03', name: 'AI 论文编辑组员', en: 'Paper Editor',
    tagline: '论文写作与表达优化',
    duties: ['检查文章结构与逻辑', '优化段落表达', '统一术语与格式', '润色语言', '贴近目标期刊风格'],
    subs: [
      { id: 'structure', name: 'Structure subagent', duty: '检查文章结构、优化逻辑链、段落重组' },
      { id: 'terminology', name: 'Terminology subagent', duty: '统一术语、检查变量/单位、规范缩写' },
      { id: 'language', name: 'Language subagent', duty: '润色表达、精简句子、提升可读性' },
    ],
    tools: ['Word', 'Overleaf', 'Grammarly', 'LaTeX', 'Journal Guide'],
    input: ['论文初稿', '目标期刊', '图表与表格', '术语表/写作要求'],
    output: ['结构优化建议', '润色稿', '术语统一清单', '段落表达检查'],
    stages: [
      { name: '初稿', sub: 'structure', out: 'points' },
      { name: '查结构', sub: 'structure', out: 'points' },
      { name: '统一术语', sub: 'terminology', out: 'points' },
      { name: '润色', sub: 'language', out: 'points' },
      { name: '定稿', sub: 'language', out: 'points' },
    ],
  },
  review: {
    id: 'review', no: '04', name: 'AI 严格审稿组员', en: 'Strict Reviewer',
    tagline: '质量把关与风险识别',
    duties: ['检查方法合理性', '识别假设问题', '检查统计与证据支撑', '检查图表/单位/术语', '提出修改建议'],
    subs: [
      { id: 'method', name: 'Method subagent', duty: '检查方法设计、识别验证缺口、评估假设合理性' },
      { id: 'statistics', name: 'Statistics subagent', duty: '检查统计方法、复核关键计算、评估数据支撑' },
      { id: 'consistency', name: 'Consistency subagent', duty: '检查前后一致性、图表与正文校对、识别过度结论' },
    ],
    tools: ['Review Checklist', 'Journal Scope', 'Method Notes', 'Statistics Guide', 'Manuscript PDF'],
    input: ['论文草稿', '图表与表格', '补充材料', '目标期刊要求'],
    output: ['问题清单', '严重程度', '证据位置', '修改建议'],
    stages: [
      { name: '读稿', sub: 'method', out: 'points' },
      { name: '找问题', sub: 'method', out: 'findings' },
      { name: '分级', sub: 'statistics', out: 'findings' },
      { name: '给建议', sub: 'consistency', out: 'findings' },
      { name: '复审', sub: 'consistency', out: 'findings' },
    ],
  },
  qa: {
    id: 'qa', no: '05', name: 'AI 质检组员', en: 'AI Quality Inspector',
    tagline: '多维度检查与最终审核',
    duties: ['核查事实与来源', '检查计算与单位', '识别前后矛盾', '复核引用与图表', '最终质量把关'],
    subs: [
      { id: 'verify', name: 'Verify subagent', duty: '核对事实、检查来源、验证结论依据' },
      { id: 'crosscheck', name: 'Cross-check subagent', duty: '交叉核验各组员输出、识别矛盾、补查遗漏' },
      { id: 'qa', name: 'QA subagent', duty: '输出质检报告、标定风险点、确认是否可提交' },
    ],
    tools: ['Fact Check', 'Table Check', 'Checklist', 'Reference Check', 'Final Draft'],
    input: ['各组员输出', '原始数据', '图表与引用', '论文定稿'],
    output: ['错误清单', '风险提示', '终审意见', '可提交版本'],
    stages: [
      { name: '汇总材料', sub: 'verify', out: 'points' },
      { name: '核实', sub: 'verify', out: 'findings' },
      { name: '互查', sub: 'crosscheck', out: 'findings' },
      { name: '质检', sub: 'qa', out: 'findings' },
      { name: '提交', sub: 'qa', out: 'findings' },
    ],
  },
};

const OUT_SCHEMAS = {
  points: {
    desc: '{"summary": "本阶段总结(120字内)", "points": [{"title": "要点标题", "detail": "详细说明, 每条2-5句"}]}，points 给 3-6 条。',
    fields: ['summary', 'points'],
  },
  cards: {
    desc: '{"summary": "本阶段总结(120字内)", "cards": [{"lit_title": "文献标题", "question": "研究问题", "method": "研究方法", "result": "主要结果", "limitation": "局限"}]}，cards 给 2-4 张，每个字段 1-3 句。',
    fields: ['summary', 'cards'],
  },
  refs: {
    desc: '{"summary": "本阶段总结(120字内)", "references": [{"title": "文献题名", "authors": "作者(如 Zhang Y, Wang L)", "year": "2023", "venue": "期刊/会议名", "doi": "DOI, 不确定则留空"}]}，references 给 5-10 条，按相关性排序。',
    fields: ['summary', 'references'],
  },
  findings: {
    desc: '{"summary": "总体评估(120字内)", "findings": [{"severity": "high|mid|low", "location": "问题位置(如: 第2节/表3/图5)", "evidence": "问题描述与依据", "suggestion": "具体修改建议"}]}，findings 给 3-8 条，按严重程度排序。',
    fields: ['summary', 'findings'],
  },
};

const SEV_LABEL = { high: '严重', mid: '中等', low: '轻微' };

// ---------- 小工具 ----------
const enc = new TextEncoder();

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders },
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(saltHex), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(nBytes) {
  const b = new Uint8Array(nBytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function getUser(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare('SELECT s.user_id, s.expires_at, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?')
    .bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at + 'Z') < new Date()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }
  return { id: row.user_id, username: row.username, token };
}

async function setSession(env, userId) {
  const token = randomHex(24);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)')
    .bind(token, userId, expires.toISOString().slice(0, 19).replace('T', ' ')).run();
  const cookie = `${SESSION_COOKIE}=${token}; HttpOnly; Secure; Path=/; Max-Age=${SESSION_DAYS * 86400}; SameSite=None`;
  return cookie;
}

function parseBody(request) {
  return request.json().catch(() => ({}));
}

function maskKey(k) {
  if (!k) return '';
  return k.length <= 4 ? '••••' : '••••••••' + k.slice(-4);
}

function extractJSON(text) {
  if (!text) return null;
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s === -1 || e === -1 || e <= s) return null;
  try {
    return JSON.parse(t.slice(s, e + 1));
  } catch {
    try {
      return JSON.parse(t.slice(s, e + 1).replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}

function clip(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ---------- LLM 调用 ----------
async function callLLM(config, messages, temperature = 0.3) {
  const base = String(config.base_url || '').replace(/\/+$/, '');
  if (!base || !config.model) throw new Error('模型配置不完整：请先到「设置」填写 API 地址与模型');
  const url = base + '/chat/completions';
  const body = {
    model: config.model,
    messages,
    temperature,
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  const text = await resp.text();
  if (!resp.ok) {
    let msg = text;
    try { msg = JSON.parse(text).error?.message || text; } catch {}
    throw new Error(`LLM 接口错误 ${resp.status}: ${clip(msg, 300)}`);
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('LLM 返回非 JSON：' + clip(text, 200)); }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 返回内容为空');
  return content;
}

async function getActiveConfig(env, userId) {
  const row = await env.DB.prepare('SELECT configs, active_id FROM settings WHERE user_id = ?').bind(userId).first();
  if (!row) throw new Error('尚未配置 AI 模型：请到「设置」添加模型配置');
  const configs = JSON.parse(row.configs || '[]');
  const c = configs.find((x) => x.id === row.active_id) || configs[0];
  if (!c) throw new Error('尚未配置 AI 模型：请到「设置」添加模型配置');
  return c;
}

// ---------- 提示词组装 ----------
function projectBlock(p) {
  let s = `【研究项目】${p.title}`;
  if (p.topic) s += `\n研究主题：${p.topic}`;
  if (p.direction) s += `\n研究方向：${p.direction}`;
  if (p.target_journal) s += `\n目标期刊：${p.target_journal}`;
  return s;
}

async function loadTerms(env, userId) {
  const { results } = await env.DB.prepare('SELECT term, definition, unit FROM terms WHERE user_id = ? ORDER BY id DESC LIMIT 15')
    .bind(userId).all();
  return results;
}

function termsBlock(terms) {
  if (!terms.length) return '';
  return '\n【知识库·术语表】\n' + terms.map((t) => `- ${t.term}${t.definition ? '：' + t.definition : ''}${t.unit ? '（单位 ' + t.unit + '）' : ''}`).join('\n');
}

async function taskContext(env, task, limit = 600) {
  const p = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(task.project_id).first();
  const stages = await env.DB.prepare("SELECT * FROM stages WHERE task_id = ? AND status = 'done' ORDER BY idx")
    .bind(task.id).all();
  let prev = '';
  if (stages.length) {
    prev = '\n【前序阶段产出】\n' + stages.map((st) => {
      let out = '';
      try {
        const o = JSON.parse(st.output);
        out = o.summary || '';
        if (o.points) out += '\n' + o.points.map((pt) => `· ${pt.title}: ${clip(pt.detail, 160)}`).join('\n');
      } catch {}
      return `第${st.idx + 1}步「${st.name}」: ${clip(out, limit)}`;
    }).join('\n\n');
  }
  return { p, block: projectBlock(p) + `\n\n【任务问题】${task.question}` + (task.detail ? `\n【任务详情】${task.detail}` : '') + prev };
}

// ---------- API 主体 ----------
async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  // ----- 公开接口 -----
  if (method === 'GET' && path === '/api/meta') {
    return json({ ok: true, members: MEMBERS, sev: SEV_LABEL });
  }

  if (method === 'POST' && path === '/api/register') {
    const { username, password } = await parseBody(request);
    const uname = String(username || '').trim();
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,24}$/.test(uname)) return json({ error: '用户名需 2-24 位（中文/字母/数字/下划线）' }, 400);
    if (String(password || '').length < 6) return json({ error: '密码至少 6 位' }, 400);
    const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(uname).first();
    if (exists) return json({ error: '用户名已存在' }, 409);
    const salt = randomHex(16);
    const hash = await hashPassword(password, salt);
    const r = await env.DB.prepare('INSERT INTO users (username, pass_hash, salt) VALUES (?,?,?)').bind(uname, hash, salt).run();
    const cookie = await setSession(env, r.meta.last_row_id);
    return json({ ok: true, username: uname }, 200, { 'set-cookie': cookie });
  }

  if (method === 'POST' && path === '/api/login') {
    const { username, password } = await parseBody(request);
    const row = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(String(username || '').trim()).first();
    if (!row) return json({ error: '用户或密码错误' }, 401);
    const hash = await hashPassword(String(password || ''), row.salt);
    if (hash !== row.pass_hash) return json({ error: '用户或密码错误' }, 401);
    const cookie = await setSession(env, row.id);
    return json({ ok: true, username: row.username }, 200, { 'set-cookie': cookie });
  }

  if (method === 'POST' && path === '/api/logout') {
    const token = getCookie(request, SESSION_COOKIE);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return json({ ok: true }, 200, { 'set-cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=None` });
  }

  // ----- 以下需登录 -----
  const user = await getUser(request, env);
  if (!user) return json({ error: '未登录' }, 401);
  const uid = user.id;

  // meta（含登录态）
  if (method === 'GET' && path === '/api/me') {
    return json({ ok: true, user, members: MEMBERS, sev: SEV_LABEL });
  }

  // ----- 设置：模型配置 -----
  if (path === '/api/settings' && method === 'GET') {
    const row = await env.DB.prepare('SELECT configs, active_id FROM settings WHERE user_id = ?').bind(uid).first();
    const configs = row ? JSON.parse(row.configs || '[]') : [];
    return json({
      ok: true,
      active_id: row?.active_id || '',
      configs: configs.map((c) => ({ id: c.id, name: c.name, base_url: c.base_url, model: c.model, api_key_masked: maskKey(c.api_key) })),
    });
  }

  if (path === '/api/settings' && method === 'PUT') {
    const body = await parseBody(request);
    const incoming = Array.isArray(body.configs) ? body.configs : [];
    const row = await env.DB.prepare('SELECT configs FROM settings WHERE user_id = ?').bind(uid).first();
    const old = row ? JSON.parse(row.configs || '[]') : [];
    const configs = incoming.map((c) => {
      const id = c.id || crypto.randomUUID();
      const prev = old.find((o) => o.id === id);
      const api_key = (c.api_key && c.api_key.trim()) ? c.api_key.trim() : (prev ? prev.api_key : '');
      return { id, name: String(c.name || '未命名').slice(0, 40), base_url: String(c.base_url || '').trim(), model: String(c.model || '').trim(), api_key };
    });
    const active_id = configs.find((c) => c.id === body.active_id) ? body.active_id : (configs[0]?.id || '');
    await env.DB.prepare('INSERT INTO settings (user_id, configs, active_id) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET configs = excluded.configs, active_id = excluded.active_id')
      .bind(uid, JSON.stringify(configs), active_id).run();
    return json({ ok: true });
  }

  if (path === '/api/settings/test' && method === 'POST') {
    const body = await parseBody(request);
    let cfg = { base_url: body.base_url, api_key: body.api_key, model: body.model };
    if (!cfg.api_key && body.id) {
      const row = await env.DB.prepare('SELECT configs FROM settings WHERE user_id = ?').bind(uid).first();
      const old = row ? JSON.parse(row.configs || '[]') : [];
      const prev = old.find((o) => o.id === body.id);
      if (prev) cfg.api_key = prev.api_key;
    }
    if (!cfg.base_url || !cfg.model) return json({ error: '请填写 API 地址与模型名' }, 400);
    try {
      const content = await callLLM(cfg, [{ role: 'user', content: '连通性测试，请只回复：pong' }], 0);
      return json({ ok: true, reply: clip(content, 50) });
    } catch (e) {
      return json({ error: e.message }, 200);
    }
  }

  if (path === '/api/password' && method === 'PUT') {
    const { old_password, new_password } = await parseBody(request);
    if (String(new_password || '').length < 6) return json({ error: '新密码至少 6 位' }, 400);
    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(uid).first();
    const hash = await hashPassword(String(old_password || ''), row.salt);
    if (hash !== row.pass_hash) return json({ error: '旧密码错误' }, 401);
    const salt = randomHex(16);
    const newHash = await hashPassword(new_password, salt);
    await env.DB.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').bind(newHash, salt, uid).run();
    return json({ ok: true });
  }

  // ----- 项目 -----
  if (path === '/api/projects' && method === 'GET') {
    const { results } = await env.DB.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
             (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'archived') AS open_count
      FROM projects p WHERE p.user_id = ? ORDER BY p.id DESC`).bind(uid).all();
    return json({ ok: true, projects: results });
  }

  if (path === '/api/projects' && method === 'POST') {
    const b = await parseBody(request);
    if (!String(b.title || '').trim()) return json({ error: '项目标题不能为空' }, 400);
    const r = await env.DB.prepare('INSERT INTO projects (user_id, title, topic, direction, target_journal) VALUES (?,?,?,?,?)')
      .bind(uid, String(b.title).trim(), String(b.topic || ''), String(b.direction || ''), String(b.target_journal || '')).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }

  let m;
  if ((m = path.match(/^\/api\/projects\/(\d+)$/))) {
    const pid = +m[1];
    const p = await env.DB.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').bind(pid, uid).first();
    if (!p) return json({ error: '项目不存在' }, 404);
    if (method === 'GET') {
      const { results: tasks } = await env.DB.prepare(`
        SELECT t.*, (SELECT COUNT(*) FROM stages s WHERE s.task_id = t.id AND s.status = 'done') AS stages_done
        FROM tasks t WHERE t.project_id = ? ORDER BY t.id DESC`).bind(pid).all();
      return json({ ok: true, project: p, tasks });
    }
    if (method === 'PUT') {
      const b = await parseBody(request);
      await env.DB.prepare('UPDATE projects SET title = ?, topic = ?, direction = ?, target_journal = ? WHERE id = ?')
        .bind(String(b.title || p.title).trim(), String(b.topic ?? p.topic), String(b.direction ?? p.direction), String(b.target_journal ?? p.target_journal), pid).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const { results: tids } = await env.DB.prepare('SELECT id FROM tasks WHERE project_id = ?').bind(pid).all();
      for (const t of tids) await deleteTask(env, t.id);
      await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(pid).run();
      return json({ ok: true });
    }
  }

  // ----- 任务 -----
  if (path === '/api/tasks' && method === 'GET') {
    const pid = +(url.searchParams.get('project_id') || 0);
    const { results } = await env.DB.prepare(`
      SELECT t.*, (SELECT title FROM projects p WHERE p.id = t.project_id) AS project_title,
             (SELECT COUNT(*) FROM stages s WHERE s.task_id = t.id AND s.status = 'done') AS stages_done
      FROM tasks t WHERE t.user_id = ? ${pid ? 'AND t.project_id = ?' : ''} ORDER BY t.id DESC LIMIT 100`)
      .bind(...(pid ? [uid, pid] : [uid])).all();
    return json({ ok: true, tasks: results });
  }

  if (path === '/api/tasks' && method === 'POST') {
    const b = await parseBody(request);
    const pid = +b.project_id;
    const member = MEMBERS[b.owner_member] ? b.owner_member : null;
    const question = String(b.question || '').trim();
    if (!pid || !member || !question) return json({ error: '缺少必要字段（项目/组员/问题）' }, 400);
    const p = await env.DB.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').bind(pid, uid).first();
    if (!p) return json({ error: '项目不存在' }, 404);
    const collab = Array.isArray(b.collab) ? b.collab.filter((x) => MEMBERS[x]) : [];
    const r = await env.DB.prepare('INSERT INTO tasks (project_id, user_id, question, detail, owner_member, collab) VALUES (?,?,?,?,?,?)')
      .bind(pid, uid, question, String(b.detail || ''), member, JSON.stringify(collab)).run();
    const tid = r.meta.last_row_id;
    const cfg = MEMBERS[member];
    for (let i = 0; i < cfg.stages.length; i++) {
      const st = cfg.stages[i];
      await env.DB.prepare('INSERT INTO stages (task_id, idx, member, name, subagent) VALUES (?,?,?,?,?)')
        .bind(tid, i, member, st.name, st.sub).run();
    }
    return json({ ok: true, id: tid });
  }

  if ((m = path.match(/^\/api\/tasks\/(\d+)$/))) {
    const tid = +m[1];
    const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(tid, uid).first();
    if (!task) return json({ error: '任务不存在' }, 404);
    if (method === 'GET') {
      const { results: stages } = await env.DB.prepare('SELECT * FROM stages WHERE task_id = ? ORDER BY idx').bind(tid).all();
      const { results: reviews } = await env.DB.prepare('SELECT * FROM reviews WHERE task_id = ? ORDER BY id DESC').bind(tid).all();
      const { results: decisions } = await env.DB.prepare('SELECT * FROM decisions WHERE task_id = ? ORDER BY id DESC LIMIT 100').bind(tid).all();
      const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(task.project_id).first();
      return json({
        ok: true, task, project, members: MEMBERS,
        stages: stages.map((s) => ({ ...s, output: s.output ? JSON.parse(s.output) : null })),
        reviews: reviews.map((r) => ({ ...r, findings: JSON.parse(r.findings || '[]') })),
        decisions,
      });
    }
    if (method === 'DELETE') {
      await deleteTask(env, tid);
      return json({ ok: true });
    }
  }

  // 运行某阶段
  if ((m = path.match(/^\/api\/tasks\/(\d+)\/stages\/(\d+)\/run$/)) && method === 'POST') {
    const tid = +m[1], idx = +m[2];
    const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(tid, uid).first();
    if (!task) return json({ error: '任务不存在' }, 404);
    const stage = await env.DB.prepare('SELECT * FROM stages WHERE task_id = ? AND idx = ?').bind(tid, idx).first();
    if (!stage) return json({ error: '阶段不存在' }, 404);
    try {
      const cfg = await getActiveConfig(env, uid);
      const member = MEMBERS[stage.member];
      const sub = member.subs.find((s) => s.id === stage.subagent) || member.subs[0];
      const schema = OUT_SCHEMAS[MEMBERS[stage.member].stages[stage.idx]?.out || 'points'];
      const { block, p } = await taskContext(env, task);
      const terms = await loadTerms(env, uid);
      const sys = `你是用户个人的 AI 科研团队中的「${member.name}」（${member.tagline}），当前由下属「${sub.name}」执行工作。该 subagent 职责：${sub.duty}。
要求：基于给定上下文严谨、专业地完成本阶段任务；输出中文（专业术语保留英文）；只输出一个 JSON 对象，不要输出任何解释或代码块标记。
JSON 格式：${schema.desc}`;
      const userMsg = `${block}\n${termsBlock(terms)}\n\n【本阶段任务】请完成第 ${stage.idx + 1}/5 步「${stage.name}」，以「${sub.name}」的身份产出结果。`;
      const content = await callLLM(cfg, [
        { role: 'system', content: sys },
        { role: 'user', content: userMsg },
      ]);
      const parsed = extractJSON(content) || { summary: clip(content, 500), points: [] };
      await env.DB.prepare("UPDATE stages SET status = 'done', output = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(JSON.stringify({ kind: MEMBERS[stage.member].stages[stage.idx]?.out || 'points', data: parsed, raw: clip(content, 8000) }), stage.id).run();
      await env.DB.prepare('INSERT INTO runs (user_id, task_id, member, subagent, model, base_url, prompt, response) VALUES (?,?,?,?,?,?,?,?)')
        .bind(uid, tid, stage.member, stage.subagent, cfg.model, cfg.base_url, clip(userMsg, 4000), clip(content, 8000)).run();
      return json({ ok: true });
    } catch (e) {
      await env.DB.prepare('INSERT INTO runs (user_id, task_id, member, subagent, model, base_url, prompt, response, ok) VALUES (?,?,?,?,?,?,?,?,0)')
        .bind(uid, tid, stage.member, stage.subagent, '-', '-', '', clip(e.message, 500)).run();
      return json({ error: e.message }, 200);
    }
  }

  // 重置某阶段
  if ((m = path.match(/^\/api\/tasks\/(\d+)\/stages\/(\d+)\/reset$/)) && method === 'POST') {
    const tid = +m[1], idx = +m[2];
    const task = await env.DB.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?').bind(tid, uid).first();
    if (!task) return json({ error: '任务不存在' }, 404);
    await env.DB.prepare("UPDATE stages SET status = 'pending', output = NULL WHERE task_id = ? AND idx = ?").bind(tid, idx).run();
    return json({ ok: true });
  }

  // 送审（reviewer=qa 为自动质检三连；其余为手动送审某组员）
  if ((m = path.match(/^\/api\/tasks\/(\d+)\/review$/)) && method === 'POST') {
    const tid = +m[1];
    const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(tid, uid).first();
    if (!task) return json({ error: '任务不存在' }, 404);
    const b = await parseBody(request);
    const reviewer = MEMBERS[b.reviewer] ? b.reviewer : 'qa';
    const note = String(b.note || '').slice(0, 500);
    try {
      const cfg = await getActiveConfig(env, uid);
      const mem = MEMBERS[reviewer];
      const { block } = await taskContext(env, task, 900);
      const allStages = await env.DB.prepare("SELECT * FROM stages WHERE task_id = ? AND status = 'done' ORDER BY idx").bind(tid).all();
      if (!allStages.length) return json({ error: '暂无已完成的阶段产出，先运行主流程' }, 400);
      const outputs = allStages.map((st) => {
        let out = '';
        try {
          const o = JSON.parse(st.output);
          out = o.summary || '';
          if (o.points) out += '\n' + o.points.map((pt) => `· ${pt.title}: ${clip(pt.detail, 200)}`).join('\n');
          if (o.findings) out += '\n' + o.findings.map((f) => `· [${f.severity}] ${clip(f.location, 80)}: ${clip(f.evidence, 200)}`).join('\n');
        } catch {}
        return `第${st.idx + 1}步「${st.name}」（${st.subagent}）:\n${clip(out, 1200)}`;
      }).join('\n\n');
      const duties = mem.subs.map((s) => s.duty).join('；');
      const sys = `你是用户个人的 AI 科研团队中的「${mem.name}」（${mem.tagline}）。你的综合检查职责：${duties}。
请以严格的审读视角，对给定任务的全部阶段产出进行交叉检查，找出问题、识别矛盾、评估风险。输出中文；只输出一个 JSON 对象，不要输出任何解释或代码块标记。
JSON 格式：${OUT_SCHEMAS.findings.desc}`;
      const userMsg = `${block}\n\n【全部阶段产出】\n${outputs}` + (note ? `\n\n【送审说明】${note}` : '') + '\n\n请完成检查并输出问题清单。';
      const content = await callLLM(cfg, [
        { role: 'system', content: sys },
        { role: 'user', content: userMsg },
      ], 0.2);
      const parsed = extractJSON(content) || { summary: clip(content, 500), findings: [] };
      const findings = (parsed.findings || []).map((f) => ({
        severity: ['high', 'mid', 'low'].includes(f.severity) ? f.severity : 'mid',
        location: String(f.location || ''), evidence: String(f.evidence || ''), suggestion: String(f.suggestion || ''),
        verdict: 'pending', note: '',
      }));
      const r = await env.DB.prepare('INSERT INTO reviews (task_id, reviewer, kind, note, summary, findings, status) VALUES (?,?,?,?,?,?,?)')
        .bind(tid, reviewer, b.reviewer === 'qa' ? 'auto' : 'manual', note, String(parsed.summary || ''), JSON.stringify(findings), 'done').run();
      await env.DB.prepare("UPDATE tasks SET status = 'decide' WHERE id = ? AND status != 'archived'").bind(tid).run();
      await env.DB.prepare('INSERT INTO runs (user_id, task_id, member, subagent, model, base_url, prompt, response) VALUES (?,?,?,?,?,?,?,?)')
        .bind(uid, tid, reviewer, 'crosscheck', cfg.model, cfg.base_url, clip(userMsg, 4000), clip(content, 8000)).run();
      return json({ ok: true, id: r.meta.last_row_id });
    } catch (e) {
      return json({ error: e.message }, 200);
    }
  }

  // 处理 finding（采纳/驳回/修改）
  if ((m = path.match(/^\/api\/reviews\/(\d+)\/verdict$/)) && method === 'POST') {
    const rid = +m[1];
    const b = await parseBody(request);
    const idx = +b.idx;
    const verdict = ['accepted', 'rejected', 'modified'].includes(b.verdict) ? b.verdict : null;
    if (verdict === null) return json({ error: '无效的处理方式' }, 400);
    const review = await env.DB.prepare(`
      SELECT r.*, t.user_id FROM reviews r JOIN tasks t ON t.id = r.task_id WHERE r.id = ? AND t.user_id = ?`).bind(rid, uid).first();
    if (!review) return json({ error: '记录不存在' }, 404);
    const findings = JSON.parse(review.findings || '[]');
    if (!findings[idx]) return json({ error: '条目不存在' }, 404);
    findings[idx].verdict = verdict;
    findings[idx].note = String(b.note || '').slice(0, 500);
    await env.DB.prepare('UPDATE reviews SET findings = ? WHERE id = ?').bind(JSON.stringify(findings), rid).run();
    await env.DB.prepare('INSERT INTO decisions (task_id, target_type, target_id, verdict, note) VALUES (?,?,?,?,?)')
      .bind(review.task_id, 'finding', rid, verdict, `[${idx}] ` + String(b.note || '').slice(0, 480)).run();
    if (verdict === 'rejected') {
      await env.DB.prepare("UPDATE tasks SET status = 'running' WHERE id = ? AND status != 'archived'").bind(review.task_id).run();
    }
    return json({ ok: true });
  }

  // 归档（可沉淀知识资产）
  if ((m = path.match(/^\/api\/tasks\/(\d+)\/archive$/)) && method === 'POST') {
    const tid = +m[1];
    const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(tid, uid).first();
    if (!task) return json({ error: '任务不存在' }, 404);
    const b = await parseBody(request);
    const stages = await env.DB.prepare("SELECT * FROM stages WHERE task_id = ? AND status = 'done'").bind(tid).all();
    let savedCards = 0, savedRefs = 0;
    for (const st of stages) {
      if (!st.output) continue;
      try {
        const o = JSON.parse(st.output);
        if (b.save_cards && o.kind === 'cards' && Array.isArray(o.data.cards)) {
          for (const c of o.data.cards) {
            await env.DB.prepare('INSERT INTO reading_cards (user_id, lit_title, question, method, result, limitation) VALUES (?,?,?,?,?,?)')
              .bind(uid, String(c.lit_title || ''), String(c.question || ''), String(c.method || ''), String(c.result || ''), String(c.limitation || '')).run();
            savedCards++;
          }
        }
        if (b.save_refs && o.kind === 'refs' && Array.isArray(o.data.references)) {
          for (const rf of o.data.references) {
            await env.DB.prepare('INSERT INTO literature (user_id, title, authors, year, venue, doi) VALUES (?,?,?,?,?,?)')
              .bind(uid, String(rf.title || ''), String(rf.authors || ''), String(rf.year || ''), String(rf.venue || ''), String(rf.doi || '')).run();
            savedRefs++;
          }
        }
      } catch {}
    }
    await env.DB.prepare("UPDATE tasks SET status = 'archived', closed_at = datetime('now') WHERE id = ?").bind(tid).run();
    return json({ ok: true, saved_cards: savedCards, saved_refs: savedRefs });
  }

  // 调用日志
  if (path === '/api/runs' && method === 'GET') {
    const tid = +(url.searchParams.get('task_id') || 0);
    const { results } = await env.DB.prepare('SELECT id, task_id, member, subagent, model, ok, created_at, response FROM runs WHERE user_id = ? AND (? = 0 OR task_id = ?) ORDER BY id DESC LIMIT 50')
      .bind(uid, tid, tid).all();
    return json({ ok: true, runs: results });
  }

  // ----- 知识库 -----
  const KN = { lit: 'literature', cards: 'reading_cards', terms: 'terms', checklists: 'checklists' };
  if ((m = path.match(/^\/api\/knowledge\/([a-z]+)$/))) {
    const type = m[1];
    const table = KN[type];
    if (!table) return json({ error: '未知类型' }, 404);
    if (method === 'GET') {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table} WHERE user_id = ? ORDER BY id DESC LIMIT 500`).bind(uid).all();
      return json({ ok: true, items: results });
    }
    if (method === 'POST') {
      const b = await parseBody(request);
      if (type === 'lit') {
        await env.DB.prepare('INSERT INTO literature (user_id, title, authors, year, venue, doi, note) VALUES (?,?,?,?,?,?,?)')
          .bind(uid, String(b.title || '未命名'), String(b.authors || ''), String(b.year || ''), String(b.venue || ''), String(b.doi || ''), String(b.note || '')).run();
      } else if (type === 'cards') {
        await env.DB.prepare('INSERT INTO reading_cards (user_id, lit_title, question, method, result, limitation) VALUES (?,?,?,?,?,?)')
          .bind(uid, String(b.lit_title || ''), String(b.question || ''), String(b.method || ''), String(b.result || ''), String(b.limitation || '')).run();
      } else if (type === 'terms') {
        if (!String(b.term || '').trim()) return json({ error: '术语不能为空' }, 400);
        await env.DB.prepare('INSERT INTO terms (user_id, term, definition, unit) VALUES (?,?,?,?)')
          .bind(uid, String(b.term).trim(), String(b.definition || ''), String(b.unit || '')).run();
      } else if (type === 'checklists') {
        await env.DB.prepare('INSERT INTO checklists (user_id, name, items) VALUES (?,?,?)')
          .bind(uid, String(b.name || '清单'), JSON.stringify(Array.isArray(b.items) ? b.items : [])).run();
      }
      return json({ ok: true });
    }
  }

  if ((m = path.match(/^\/api\/knowledge\/([a-z]+)\/(\d+)$/)) && method === 'DELETE') {
    const table = KN[m[1]];
    if (!table) return json({ error: '未知类型' }, 404);
    await env.DB.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).bind(+m[2], uid).run();
    return json({ ok: true });
  }

  // ----- 总览 -----
  if (path === '/api/dashboard' && method === 'GET') {
    const { results: recent } = await env.DB.prepare(`
      SELECT t.id, t.question, t.status, t.owner_member, t.created_at,
             (SELECT title FROM projects p WHERE p.id = t.project_id) AS project_title,
             (SELECT COUNT(*) FROM stages s WHERE s.task_id = t.id AND s.status = 'done') AS stages_done
      FROM tasks t WHERE t.user_id = ? ORDER BY t.id DESC LIMIT 8`).bind(uid).all();
    const counts = {};
    counts.projects = (await env.DB.prepare('SELECT COUNT(*) AS c FROM projects WHERE user_id = ?').bind(uid).first()).c;
    counts.open_tasks = (await env.DB.prepare("SELECT COUNT(*) AS c FROM tasks WHERE user_id = ? AND status != 'archived'").bind(uid).first()).c;
    counts.reviews = (await env.DB.prepare('SELECT COUNT(*) AS c FROM reviews r JOIN tasks t ON t.id = r.task_id WHERE t.user_id = ?').bind(uid).first()).c;
    counts.pending_findings = (await env.DB.prepare(`
      SELECT COUNT(*) AS c FROM reviews r JOIN tasks t ON t.id = r.task_id, json_each(r.findings) je
      WHERE t.user_id = ? AND je.value->>'verdict' = 'pending'`).bind(uid).first().catch(() => ({ c: 0 }))).c || 0;
    counts.lit = (await env.DB.prepare('SELECT COUNT(*) AS c FROM literature WHERE user_id = ?').bind(uid).first()).c;
    counts.cards = (await env.DB.prepare('SELECT COUNT(*) AS c FROM reading_cards WHERE user_id = ?').bind(uid).first()).c;
    counts.terms = (await env.DB.prepare('SELECT COUNT(*) AS c FROM terms WHERE user_id = ?').bind(uid).first()).c;
    return json({ ok: true, recent, counts });
  }

  return json({ error: 'not found' }, 404);
}

async function deleteTask(env, tid) {
  await env.DB.prepare('DELETE FROM stages WHERE task_id = ?').bind(tid).run();
  await env.DB.prepare('DELETE FROM reviews WHERE task_id = ?').bind(tid).run();
  await env.DB.prepare('DELETE FROM decisions WHERE task_id = ?').bind(tid).run();
  await env.DB.prepare('DELETE FROM runs WHERE task_id = ?').bind(tid).run();
  await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(tid).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) {
        const resp = await handleApi(request, env, url);
        // 补充 set-cookie 头（json() 不带额外头时的统一出口）
        return resp;
      }
      return env.ASSETS.fetch(request);
    } catch (e) {
      return json({ error: '服务器错误: ' + e.message }, 500);
    }
  },
};
