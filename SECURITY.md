# Security

Debo Labs gives each learner a real shell inside a container, so we take sandbox and access-control reports seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead:
**Security tab → "Report a vulnerability"** on this repository.

Helpful details: what you did, what you expected, what happened, and whether it affects the local app
(`./start_local_labs.sh`), the hosted deployment, or both. We aim to acknowledge a report within a few days.

## Scope

In scope: escaping a lab sandbox, reading another session's files or the answers (`solutions/`), bypassing the
same-origin/loopback guards or the hosted invite code, and anything in `deploy/` that weakens the AWS setup.

Out of scope: denial of service by exhausting seats on the public deployment, and findings that need a
learner to run something outside the lab terminal.

## What the local app does and doesn't protect

The local app binds to `127.0.0.1` only and refuses requests whose `Host` or `Origin` is not loopback, so a web page
you visit can't drive your lab shell. The lab shell runs inside the container as an unprivileged user, not on your machine.
Never expose the local port to a network.
