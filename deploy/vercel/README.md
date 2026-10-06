# Run everything on Vercel (pages + lab server in a Vercel Sandbox)

Serverless functions cannot hold a shell, but **Vercel Sandbox** can: a Linux microVM with root, started from our own Docker image, with WebSockets on an exposed port.
In this setup the pages are the usual Vercel deployment, and one sandbox runs the lab server for everyone.

```
browser ──pages──▶ Vercel project
   │   POST /api/backend (invite code) ─▶ function: finds or starts the sandbox, says where it is
   └──/session, /ws, /lab/check──▶ https://<sandbox-id>-8080.<region>.sandbox.vercel.app  (the lab server, one microVM)
```

The first learner of the day waits up to a minute while the sandbox starts; after that it is instant. The lab page keeps the sandbox alive while labs are open, and when nobody is using it
the sandbox expires on its own and stops billing.

## Plan and cost (check the current numbers at vercel.com/docs/sandbox/pricing)

| | Hobby (free) | Pro |
|---|---|---|
| Longest single run of the sandbox | **45 minutes** | 24 hours |
| Active CPU included | 5 hours/month | usage-based, covered by the $20 monthly credit |
| Memory included | 420 GB-hours/month | usage-based |
| Most CPU/memory for one sandbox | 4 vCPU / 8 GB | 8 vCPU / 16 GB |

- **30 learners fit in one sandbox** (4 vCPU / 8 GB): each shell is a few tens of MB, and the labs are mostly idle between commands.
- **Hobby is enough to try it or to run a short class.** Every 45 minutes the sandbox ends and all open labs are cut off; learners reload and start again. Hobby also stops creating sandboxes once the monthly allowance is used.
- **Pro is the plan for a real class.** A sandbox with 8 GB of memory costs about $0.17/hour while it runs, so a 3-hour class is roughly $0.50 plus a little CPU.

## Set it up

1. **Enable Sandbox** for the Vercel project and make sure the CLI works: `npx vercel login`, then `npx vercel link` in the repo.
2. **Push the lab server image** (needs Docker; the image must be `linux/amd64`, so build on an x86 machine):
   ```bash
   bash deploy/vercel/push-image.sh
   ```
   Wait until the repository page in the Vercel dashboard shows the image as **Ready**.
3. **Set these environment variables** in the Vercel project (Settings → Environment Variables), then redeploy:

   | Name | Value |
   |---|---|
   | `LAB_SANDBOX` | `1` |
   | `LAB_ACCESS_TOKENS` | the invite code(s) learners type, comma-separated |
   | `LAB_ALLOWED_ORIGINS` | your site's origin, e.g. `https://debo-labs.vercel.app` (no trailing slash; add other domains comma-separated) |
   | `LAB_SANDBOX_VCPUS` | optional, default `4` (Pro can use up to `8`) |
   | `LAB_SANDBOX_MINUTES` | optional, how long a fresh sandbox lives, default `40` (keep it under 45 on Hobby) |
   | `LAB_MAX_SESSIONS` | optional, learners at once, default `32` (the image has 40 learner users) |

4. **Try it:** open a lab, enter the invite code, wait for "Starting the lab server", and the terminal prompt appears.

## When you change the labs or the code

The sandbox runs the pushed image, so after changing anything under `labs/`, `src/` or `public/`, run `push-image.sh` again and stop the old sandbox
(Vercel dashboard → Sandboxes, or `npx sandbox stop debo-labs-server`) so the next learner gets the new one. The pages themselves redeploy on every push as usual.

## If something goes wrong

- *"Could not start the lab server"*: the image is not **Ready** yet, `LAB_SANDBOX_IMAGE` does not match the pushed name, or Sandbox is not enabled for the project. Check the function logs for `lab server sandbox:`.
- *The terminal says it cannot reach the server*: `LAB_ALLOWED_ORIGINS` does not match the site's address exactly (including `https://`).
- *Every learner gets "too many labs open"*: the sandbox's proxy hides learner addresses; `MAX_SESSIONS_PER_IP` is already set high, so check that you are on the latest image.
