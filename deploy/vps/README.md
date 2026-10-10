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
