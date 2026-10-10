> **Simplest setup (recommended): run the whole site here.** This server serves the pages, the accounts (sign up / log in, saved progress) and the terminals from one domain,
> so nothing else is needed and Vercel is not involved. Run `setup.sh` (or the manual steps below), open `https://<your domain>`, and create an account.
> Accounts live in the `labs_data` Docker volume: back it up, and run a single lab server per volume. The split-hosting sections below are only for keeping the pages on another host.

# Lab server on your own machine (split hosting)

Real terminals need a real Linux process per learner, which serverless hosts cannot run. In this setup the **pages** live on a serverless host
(for example Vercel) and the **shells** run here, on any Linux server with Docker and a domain.

```
browser ──pages──▶ Vercel (static-ish pages)
   │
   └──/session, /ws, /lab/check──▶ https://labs-api.example.com  (this folder: Caddy + the lab server)
```

## 0. Oracle Cloud Always Free VM (the free route)

1. Sign up at oracle.com/cloud/free (a card is needed to verify you; the Always Free resources are not charged).
2. Create an instance: **Compute → Instances → Create**. Image: **Ubuntu 22.04 or 24.04**. Shape: **Ampere (ARM) `VM.Standard.A1.Flex`** with 2 OCPU and 12 GB (the free allowance
   is up to 4 OCPU and 24 GB in total), or the small AMD shape if ARM is out of capacity in your region (try another availability domain, or retry later).
   Add your SSH public key, and note the **public IP**.
3. Open the web ports in the cloud network: **Networking → your VCN → Security Lists → Default → Add Ingress Rules**: source `0.0.0.0/0`, TCP, destination ports `80` and `443`.
4. Point a domain at the IP. With `deboistech.in`, add an `A` record such as `labs-api` → the public IP. No domain? A free name from duckdns.org works too.
5. SSH in (`ssh ubuntu@<public ip>`) and run the one-command setup:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/debois-tech/debo-Labs/main/deploy/vps/setup.sh -o setup.sh && bash setup.sh
   ```

   It installs Docker, opens the machine's own firewall, asks for the domain, your Vercel URL and an invite code, then builds and starts everything.
   Then continue with step 2 below (the Vercel variable).

The manual steps follow if you prefer to do it by hand or use another provider.

## 1. The lab server

On the server (Docker with the Compose plugin; ports 80 and 443 open; an `A` record for your domain pointing at it):

```bash
git clone https://github.com/debois-tech/debo-Labs && cd debo-Labs/deploy/vps
cp .env.example .env        # set LABS_DOMAIN, LAB_ALLOWED_ORIGINS and LAB_ACCESS_TOKENS
docker compose up -d --build
curl https://<your domain>/healthz     # prints: ok
```

The server only accepts requests from the origins in `LAB_ALLOWED_ORIGINS`, and every lab needs one of the invite codes in `LAB_ACCESS_TOKENS`.
Seats are limited per server (`MAX_SESSIONS`) and per learner IP.

## 2. The pages on Vercel

In the Vercel project, add one environment variable and redeploy:

| Name | Value |
|---|---|
| `LAB_BACKEND_URL` | `https://<your domain>` (no trailing slash) |

The header chip then reads **online**, and a lab asks for an invite code, then connects to your server.

## Check it

1. Open a lab on the Vercel URL, enter an invite code, and the terminal prompt appears.
2. Run the lab's first task and press **Check**.

If the terminal says it cannot reach the server, the page origin is missing from `LAB_ALLOWED_ORIGINS` (it must match exactly, including `https://`) or the domain does not resolve yet.

## Sizing and keeping the VM healthy

- **50 learners need real CPU.** A burstable VM size (for example Azure `B`-series, AWS `t`-series) runs fast on a CPU credit balance and then
  throttles to a fraction of a core; under a full class that can freeze the machine (HTTPS and SSH both time out). For classes use a non-burstable size
  (2 vCPU / 8 GB at the very least; 4 vCPU / 16 GB is comfortable) and watch the CPU-credit metric if you stay burstable.
- **Leave headroom.** `LAB_MEMORY` (default 5 GB) must sit well below the VM's RAM, so the host and Caddy never starve.
- **Add swap** so a short memory spike slows things down instead of freezing the VM:
  `sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab`
- **After a crash or reboot**, look at why: `docker compose logs --tail 100 labs`, `docker inspect -f '{{.RestartCount}} oom={{.State.OOMKilled}}' vps-labs-1`, `dmesg | grep -i -E 'oom|killed'`, `uptime`.

## If the repository is private

The server pulls the code from GitHub, which needs a login once the repo is private. Give the VM a **read-only deploy key**, then switch it to SSH:

```bash
ssh-keygen -t ed25519 -N '' -f ~/.ssh/deploy_key -C debo-labs-vm && cat ~/.ssh/deploy_key.pub
# GitHub: repo Settings -> Deploy keys -> Add deploy key (paste it, leave "Allow write access" OFF)
git -C ~/debo-Labs remote set-url origin git@github.com:debois-tech/debo-Labs.git
git -C ~/debo-Labs config core.sshCommand "ssh -i ~/.ssh/deploy_key -o IdentitiesOnly=yes"
git -C ~/debo-Labs pull
```

`setup.sh` fetches the repo anonymously, so for a private repo clone it yourself first (with the deploy key) and run `deploy/vps/setup.sh` from the clone.
