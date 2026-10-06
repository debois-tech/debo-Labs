# Lab server on your own machine (split hosting)

Real terminals need a real Linux process per learner, which serverless hosts cannot run. In this setup the **pages** live on a serverless host
(for example Vercel) and the **shells** run here, on any Linux server with Docker and a domain.

```
browser ──pages──▶ Vercel (static-ish pages)
   │
   └──/session, /ws, /lab/check──▶ https://labs-api.example.com  (this folder: Caddy + the lab server)
```

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
