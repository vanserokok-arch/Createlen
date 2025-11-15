#!/usr/bin/env bash
set -euo pipefail

OWNER=${1:-vanserokok-arch}
IMAGE=${2:-createlen}
SHA=$(git rev-parse --short HEAD)
IMAGE_TAG="ghcr.io/${OWNER}/${IMAGE}:${SHA}"
IMAGE_LATEST="ghcr.io/${OWNER}/${IMAGE}:latest"

echo "Building image ${IMAGE_LATEST} and ${IMAGE_TAG}"

if [ -n "${GHCR_PAT:-}" ]; then
  echo "Logging into ghcr.io"
  echo -n "${GHCR_PAT}" | docker login ghcr.io -u "${OWNER}" --password-stdin
fi

docker build -t "${IMAGE_LATEST}" -t "${IMAGE_TAG}" .
docker push "${IMAGE_LATEST}"
docker push "${IMAGE_TAG}"
echo "Pushed images successfully"
