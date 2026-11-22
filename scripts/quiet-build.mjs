// Builds the panels (`npm run build:panel`) without printing the build output. The repo is public and
// anyone can read the Actions logs: with the real configs (secrets) a tsc or vite error can quote entity
// IDs or other values from them. It prints only where each TypeScript error is (file, line, code), and
// the bundle sizes when it works. To see the full message, run `npm run build:panel` locally.
import { spawnSync } from 'node:child_process'
import { statSync } from 'node:fs'

const run = spawnSync('npm run build:panel', { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`

if (run.status === 0) {
  for (const file of ['dist/main.js', 'dist/plano.js']) {
    console.log(`OK ${file}: ${Math.round(statSync(file).size / 1024)} KB`)
  }
} else {
  // tsc prints "path(line,col): error TS1234: message"; the message is what can carry config values
  const errors = [...output.matchAll(/^(\S+)\((\d+),(\d+)\): error (TS\d+)/gm)]
  for (const [, file, line, col, code] of errors) {
    console.log(`::error file=${file},line=${line},col=${col}::${code} (mensaje oculto: correr npm run build:panel localmente)`)
  }
  if (!errors.length) console.log('::error::Falló el build (no es un error de TypeScript). Salida oculta: correr npm run build:panel localmente')
  process.exitCode = run.status || 1
}
