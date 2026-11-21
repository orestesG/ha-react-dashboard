// Restarts Home Assistant after a deploy: panel_custom only reads module_url (and its ?v=<sha>) at
// startup, so a config reload is not enough and the apps would keep loading their cached build.
// It only triggers the restart (after checking the config); it doesn't wait for HA to come back.
//
// Env: HA_URL, HA_TOKEN (admin). DRY_RUN=1 only checks the config.
const { HA_URL, HA_TOKEN, DRY_RUN } = process.env
const base = HA_URL?.replace(/\/$/, '')
const headers = { Authorization: `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' }

// exitCode instead of process.exit(): exiting with a connection still open aborts Node on Windows
process.exitCode = await (async () => {
  if (!HA_URL || !HA_TOKEN) {
    console.error('Faltan HA_URL o HA_TOKEN')
    return 1
  }

  // Never restart into a broken configuration.yaml: HA would come back in safe mode
  const res = await fetch(`${base}/api/config/core/check_config`, { method: 'POST', headers, signal: AbortSignal.timeout(90_000) })
    .catch((e) => ({ ok: false, status: e.message }))
  const check = res.ok ? await res.json() : null
  if (check?.result !== 'valid') {
    console.error(`No se reinicia HA: check_config ${res.ok ? `inválido: ${check?.errors}` : `falló (${res.status})`}`)
    return 1
  }
  console.log('OK: configuración válida')
  if (DRY_RUN) return 0

  // HA may drop the connection while answering: only an HTTP error means it refused
  const restart = await fetch(`${base}/api/services/homeassistant/restart`, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(30_000) })
    .catch(() => null)
  await restart?.body?.cancel()
  if (restart && !restart.ok) {
    console.error(`HA rechazó el reinicio: HTTP ${restart.status}`)
    return 1
  }
  console.log('OK: reinicio de HA pedido')
  return 0
})()
