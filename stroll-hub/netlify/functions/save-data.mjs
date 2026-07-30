// Netlify Function (v2) — commits the edited notion.json back to GitHub.
// Secrets live ONLY in Netlify site env vars, never in the client bundle:
//   GH_TOKEN    : GitHub fine-grained PAT with Contents: Read/Write on this repo
//   EDIT_SECRET : password the browser must send to authorize a save
const OWNER = 'strollpresskr-commits'
const REPO = 'strollpress-site'
const BRANCH = 'claude/cool-knuth-rClsT'
const FILE_PATH = 'stroll-hub/src/data/notion.json'

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body
  try { body = await req.json() } catch { return json({ error: 'bad json' }, 400) }
  const { secret, data } = body || {}

  if (!process.env.EDIT_SECRET) return json({ error: 'EDIT_SECRET not configured' }, 500)
  if (secret !== process.env.EDIT_SECRET) return json({ error: 'unauthorized' }, 401)

  const token = process.env.GH_TOKEN
  if (!token) return json({ error: 'GH_TOKEN not configured' }, 500)
  if (!data || typeof data !== 'object' || !Array.isArray(data.projects))
    return json({ error: 'invalid data' }, 400)

  const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'stroll-hub-save',
  }

  // current file sha (required to update)
  const cur = await fetch(`${api}?ref=${BRANCH}`, { headers })
  if (!cur.ok) return json({ error: 'read failed', status: cur.status }, 502)
  const sha = (await cur.json()).sha

  const content = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64')
  const put = await fetch(api, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'data: dashboard edit via web',
      content,
      sha,
      branch: BRANCH,
    }),
  })
  if (!put.ok) return json({ error: 'write failed', detail: (await put.text()).slice(0, 200) }, 502)

  return json({ ok: true })
}
