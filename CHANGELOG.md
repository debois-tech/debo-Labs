# Release notes

What changed in each version of Debo Labs, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/): a new lab or feature is a minor version, a fix is a patch, and anything
that needs action from you (a new image, a changed setting, a Terraform apply) is called out under **Upgrade notes**.

To see what you are running, check `version` in `package.json`. Self-hosters: `git pull && ./start_local_labs.sh` rebuilds the image when it changed.

## [Unreleased]

### Added
- **Preview mode for serverless hosts** (`api/index.js`, `vercel.json`, or `LAB_TERMINAL=off`). The pages render, but no shells start: a lab shows that live terminals need Docker.
  `node-pty` is now an optional dependency, loaded only when a terminal starts.

- **Split hosting.** The pages can live on a serverless host while the shells run on your own Docker server. The lab server takes `LAB_ALLOWED_ORIGINS` (the page origins it answers, with CORS);
  the pages host takes `LAB_BACKEND_URL`. Setup kit with HTTPS, a one-command `setup.sh` and an Oracle Cloud Always Free guide in `deploy/vps/`. The header chip reads preview, online, cluster or local, depending on the host.

- **Everything on Vercel.** With `LAB_SANDBOX=1`, a Vercel function (`api/backend.js`) starts the lab server inside a Vercel Sandbox microVM from our own image, and the lab page connects to it
  (invite code required). `deploy/vercel/` has the image push script and a setup guide with the plan limits (Hobby: 45-minute runs; Pro for a real class).
- The image now has 40 learner users (`lab0..lab39`, was 16) so up to 40 learners can share one server.

### Fixed
- The progress marker no longer hides behind the active step dot.

### Changed
- **Rebranded as Debo Labs**, a Deboistech project: new name, the Deboistech turtle logo in the header, an emerald gradient theme, and Sora for headings. Anything
  that named the previous owner or brand was removed from the code, docs, labs and deploy notes. The terminal prompt mark replaces the old rocket, and the welcome banner
  in the terminal now reads DEBO LABS.
- **Labs only.** The Roadmap and Videos pages, the topic map, the Subscribe button and the per-track videos are gone. The home page now shows one card per track,
  built straight from `labs/<track>/track.yaml`; `labs/roadmap.json` and `labs/site.yaml` no longer exist. `npm run lab:new` takes `<track> <lab-id>` (no `--topic`).
- The Docker image is `debo-labs:dev` locally, and the sandbox folder is `debo-labs-sandbox`.
- The learner shell now has full `vim` (syntax highlighting; `vi` opens it) and working `man` with the standard manual pages (`man ls`, `man 5 hosts`, `man 7 signal`).
  The image grows by about 80 MB uncompressed, mostly the `vim` runtime files (36 MB) and the manual pages.

### Upgrade notes
- **Local:** rebuild the image once (`./start_local_labs.sh` does it). Progress you saved in your browser is stored under a new key, so finished labs show as not done again.
- **Hosted:** `/roadmap`, `/videos` and `/upcoming` now return 404; update any bookmark or monitor that points at them (`deploy/smoke-test.py` is already updated). The GitHub repo must move to its new
  owner and name before the next deploy; see AGENTS.md on the OIDC trust policy.
- The runtime image changed, so the next push to `main` redeploys it through `deploy.yml`. No Terraform or settings changes.

## [1.1.0] - 2026-10-06

### Highlights
- **Nine new labs on three new topics.** Docker, Networking and CI/CD with GitHub Actions are now live (19 labs in 6 tracks).
- **A passing Check now says so.** You get a short green confirmation, and failing checks keep the amber hint.

### Added
- **Docker** (3 labs): containers are just processes, writing a Dockerfile that builds fast, and layers, secrets and compose.
  There is no Docker daemon in the sandbox; the labs grade the files you write and real evidence from the sandbox itself.
- **Networking** (3 labs): IP addresses and CIDR, ports and sockets, and name to page (DNS, the Host header, TLS). Each session gets its own port,
  so two learners never collide.
- **CI/CD with GitHub Actions** (3 labs): workflow anatomy, jobs, matrix and secrets, and OIDC to AWS.
- Optional `success:` text on a lab step, shown in green when its check passes (see `docs/authoring.md`).
- Check-script helpers in `labs/lib.sh`: `listening`, `http_code` and `yaml_get`.
- A new README: demo GIF, badges, a "Start here" table by goal, and a table of tracks. `npm run readme:stats` regenerates the lab and task counts
  and the track table from the real catalog; a unit test fails if the README is stale.
- A 1280x640 social preview image (`docs/media/social-preview.png`).

### Changed
- The image now includes `jq`, `dig` (dnsutils), `ss` (iproute2), `nc` (netcat-openbsd) and `openssl`.
- Docker, Networking and CI/CD with GitHub Actions went live.

### Upgrade notes
- **Local:** rebuild the image once (`./start_local_labs.sh` does it for you). No settings changed.
- **Hosted:** the image changed, so the next push to `main` redeploys it through `deploy.yml`. No Terraform changes. The new labs were run end to end on the hosted
  profile after deploy (see `deploy/CHECKLIST.md`). The Networking labs use `bash`, `nc` and `openssl` servers rather than `node`, because learner shells run under the hosted address-space cap.

## [1.0.0] - 2026-10-01

First public release: Linux fundamentals, shell scripting, Git basics and the Elastic Beanstalk Cluster Mode lab, one lab server for
local (`docker compose up`) and hosted (Elastic Beanstalk Cluster Mode) use, MIT licensed.
