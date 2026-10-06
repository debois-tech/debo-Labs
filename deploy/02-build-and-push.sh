#!/usr/bin/env bash
# Builds the Debo Labs image and pushes it to a new ECR repo.
set -euo pipefail

REPO_NAME="${REPO_NAME:-beanstalk-grows}"
# `aws configure get region` only reads the CLI config file - it ignores the
# AWS_REGION/AWS_DEFAULT_REGION env vars that CI (and any env-var-based auth)
# sets, which broke this script's first real CI run. Env var wins when set.
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-$(aws configure get region)}}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
IMAGE_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest"

if ! aws ecr describe-repositories --repository-names "$REPO_NAME" >/dev/null 2>&1; then
  aws ecr create-repository --repository-name "$REPO_NAME" \
    --tags Key=project,Value=beanstalk-grows >/dev/null
  echo "Created ECR repo $REPO_NAME"
fi

aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# Beanstalk Cluster Mode nodes run amd64; build for that explicitly even on
# Apple Silicon, otherwise EB rejects the image with an architecture mismatch.
# One image serves every deployment; the build context is the repo root.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
docker buildx build --platform linux/amd64 -t "$IMAGE_URI" --push "$ROOT"

echo
echo "Image pushed: $IMAGE_URI"
echo "Pass this as ImageConfiguration.Source.Uri when creating the application version."
