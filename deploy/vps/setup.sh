#!/usr/bin/env bash
# One-shot setup for the lab server on a fresh Ubuntu or Debian VM (tested layout: Oracle Cloud Always Free, but any VM works).
#   curl -fsSL https://raw.githubusercontent.com/debois-tech/debo-Labs/main/deploy/vps/setup.sh -o setup.sh && bash setup.sh
# It installs Docker, opens ports 80 and 443 on the machine's own firewall, asks for four values, writes .env, and starts everything.
# You still open ports 80 and 443 in your cloud provider's network settings (see README.md).
set -euo pipefail

say()  { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
[ "$(id -u)" -ne 0 ] && SUDO=sudo || SUDO=""

REPO_URL="${REPO_URL:-https://github.com/debois-tech/debo-Labs}"
DIR="${DIR:-$HOME/debo-Labs}"

say "1/5 Installing Docker (skipped if present)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | $SUDO sh
fi
$SUDO systemctl enable --now docker >/dev/null 2>&1 || true
$SUDO docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is missing. Install 'docker-compose-plugin' and run this again."

say "2/5 Opening ports 80 and 443 on this machine's firewall"
# Some cloud images ship an iptables rule that rejects everything but SSH; insert the web ports before it.
for port in 80 443; do
  $SUDO iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || $SUDO iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
done
if command -v netfilter-persistent >/dev/null 2>&1; then $SUDO netfilter-persistent save >/dev/null 2>&1 || true
else $SUDO sh -c 'mkdir -p /etc/iptables && iptables-save > /etc/iptables/rules.v4' 2>/dev/null || true; fi

say "3/5 Getting the code"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only
else command -v git >/dev/null 2>&1 || $SUDO apt-get install -y git >/dev/null; git clone "$REPO_URL" "$DIR"; fi
cd "$DIR/deploy/vps"

say "4/5 Settings"
if [ -f .env ]; then
  echo ".env already exists, keeping it."
else
  read -rp "Domain that points at this VM (e.g. labs-api.example.com): " DOMAIN
  read -rp "Page origin that may call this server (e.g. https://debo-labs.vercel.app): " ORIGIN
  read -rp "Invite code(s) learners will type, comma-separated: " TOKENS
  [ -n "$DOMAIN" ] && [ -n "$ORIGIN" ] && [ -n "$TOKENS" ] || fail "All three are required."
  ORIGIN="${ORIGIN%/}"
  { echo "LABS_DOMAIN=$DOMAIN"; echo "LAB_ALLOWED_ORIGINS=$ORIGIN"; echo "LAB_ACCESS_TOKENS=$TOKENS"; } > .env
  chmod 600 .env
fi

say "5/5 Building and starting (the first build takes a few minutes)"
$SUDO docker compose up -d --build
sleep 8
DOMAIN_NOW="$(grep '^LABS_DOMAIN=' .env | cut -d= -f2)"
if curl -fsS "https://$DOMAIN_NOW/healthz" >/dev/null 2>&1; then
  say "Done. https://$DOMAIN_NOW/healthz answers. Now set LAB_BACKEND_URL=https://$DOMAIN_NOW in your Vercel project and redeploy."
else
  echo "The server is up, but https://$DOMAIN_NOW is not answering yet. Usual causes: the DNS record has not propagated,"
  echo "or ports 80/443 are not open in the cloud provider's network settings. Logs: docker compose logs caddy"
fi
