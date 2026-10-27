#!/bin/bash
set -e

# Pedir un token (registration-token | remove-token) via GitHub API usando un PAT
get_token() {
  curl -fsSL \
    -X POST \
    -H "Authorization: token ${GITHUB_PAT}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runners/$1" \
    | jq -r .token
}

REG_TOKEN=$(get_token registration-token)

if [ -z "$REG_TOKEN" ] || [ "$REG_TOKEN" = "null" ]; then
  echo "ERROR: No se pudo obtener el token de registro. Verificá GITHUB_PAT, GITHUB_OWNER y GITHUB_REPO."
  exit 1
fi

# restart: unless-stopped reinicia el MISMO contenedor, que conserva la config del arranque
# anterior: config.sh falla con "already configured" y el contenedor queda en loop para siempre.
# --replace ya pisa el registro viejo en GitHub, así que alcanza con borrar la config local.
rm -f .runner .runner_migrated .credentials .credentials_migrated .credentials_rsaparams

# Configurar el runner
./config.sh \
  --url "https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}" \
  --token "${REG_TOKEN}" \
  --name "${RUNNER_NAME:-docker-runner}" \
  --labels "self-hosted,docker,linux" \
  --unattended \
  --replace

# Desregistrar al salir (el token de registro vence a la hora: pedir uno de remove nuevo)
cleanup() {
  echo "Desregistrando runner..."
  ./config.sh remove --unattended --token "$(get_token remove-token)" || true
}
trap cleanup EXIT INT TERM

./run.sh
