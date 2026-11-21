// Restarts Home Assistant after a deploy and waits until it serves both panels with the new build.
// A config reload is not enough: panel_custom only reads module_url (and its ?v=<sha>) at startup, so
// without a restart the apps keep loading the old URL from their cache.
//
// Env: HA_URL, HA_TOKEN (admin), GITHUB_SHA (set by Actions; SHA overrides it). The deploy writes its
// first 7 chars as ?v=. DRY_RUN=1 checks the config and reports the panels without restarting.
const { HA_URL, HA_TOKEN, DRY_RUN } = process.env
const SHA = (process.env.SHA || process.env.GITHUB_SHA || '').slice(0, 7)
if (!HA_URL || !HA_TOKEN || !SHA) {
  console.error('Faltan HA_URL, HA_TOKEN o SHA')
  process.exit(1)
}
const base = HA_URL.replace(/\/$/, '')
const headers = { Authorization: `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// HA can take 6-7 min to start when an integration blocks the startup phase
const WAIT_MS = 10 * 60_000

/** module_url of each of our panels, read over the WebSocket API (there is no REST endpoint for panels) */
function panelUrls() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(base.replace(/^http/, 'ws') + '/api/websocket')
    let settled = false
    // Runs once, and drops the handlers before closing: closing a socket that failed to connect fires
    // "error" again synchronously, which used to call done → close → error… until the stack overflowed
    const done = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ws.onerror = ws.onmessage = null
      try { ws.close() } catch { /* already failed */ }
      fn(value)
    }
    const timer = setTimeout(() => done(reject, new Error('timeout')), 10_000)
    ws.onerror = () => done(reject, new Error('websocket'))
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: HA_TOKEN }))
      else if (msg.type === 'auth_invalid') done(reject, new Error('token inválido'))
      else if (msg.type === 'auth_ok') ws.send(JSON.stringify({ id: 1, type: 'get_panels' }))
      else if (msg.id === 1) {
        done(resolve, Object.values(msg.result ?? {})
          .map((p) => p.config?._panel_custom?.module_url)
          .filter((u) => u?.startsWith('/local/mi-dashboard/')))
      }
    }
  })
}

// exitCode instead of process.exit(): exiting while a WebSocket is closing aborts Node on Windows
process.exitCode = await (async () => {
  // 1. Never restart into a broken configuration.yaml: HA would come back in safe mode
  const res = await fetch(`${base}/api/config/core/check_config`, { method: 'POST', headers, signal: AbortSignal.timeout(90_000) })
    .catch((e) => ({ ok: false, status: e.message }))
  const check = res.ok ? await res.json() : null
  if (check?.result !== 'valid') {
    console.error(`No se reinicia HA: check_config ${res.ok ? `inválido: ${check?.errors}` : `falló (${res.status})`}`)
    return 1
  }
  console.log('OK: configuración válida')

  if (DRY_RUN) {
    console.log('DRY_RUN: paneles registrados ahora:', (await panelUrls()).join(' '))
    return 0
  }

  // 2. Restart. HA may drop the connection while answering, so a network error here is expected
  await fetch(`${base}/api/services/homeassistant/restart`, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(30_000) })
    .catch(() => {})
  console.log('Reinicio pedido, esperando a HA...')

  // 3. Wait for the new version. /api answers before panel_custom is set up, so check the panels themselves
  const deadline = Date.now() + WAIT_MS
  let last = []
  while (Date.now() < deadline) {
    await sleep(10_000)
    last = await panelUrls().catch(() => last)
    if (last.length > 0 && last.every((u) => u.endsWith(`?v=${SHA}`))) {
      console.log(`OK: HA reiniciado, paneles en ?v=${SHA}: ${last.join(' ')}`)
      return 0
    }
  }
  console.error(`HA no anunció los paneles con ?v=${SHA} en ${WAIT_MS / 60_000} min. Último: ${last.join(' ') || 'sin respuesta'}`)
  return 1
})()
