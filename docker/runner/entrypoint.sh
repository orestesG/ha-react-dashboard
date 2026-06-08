#!/bin/bash
set -e

# Obtener token de registro via GitHub API usando un PAT
REG_TOKEN=$(curl -fsSL \
  -X POST \
  -H "Authorization: token ${GITHUB_PAT}" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runners/registration-token" \
  | jq -r .token)

if [ -z "$REG_TOKEN" ] || [ "$REG_TOKEN" = "null" ]; then
  echo "ERROR: No se pudo obtener el token de registro. Verificá GITHUB_PAT, GITHUB_OWNER y GITHUB_REPO."
  exit 1
fi

# Configurar el runner
./config.sh \
  --url "https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}" \
  --token "${REG_TOKEN}" \
  --name "${RUNNER_NAME:-docker-runner}" \
  --labels "self-hosted,docker,linux" \
  --unattended \
  --replace

# Desregistrar al salir
cleanup() {
  echo "Desregistrando runner..."
  ./config.sh remove --unattended --token "${REG_TOKEN}" || true
}
trap cleanup EXIT INT TERM

./run.sh
