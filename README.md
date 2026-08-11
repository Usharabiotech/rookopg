# PG Platform

A PG and hostel marketplace + management platform, launching in Hyderabad.

Tenants (students and working professionals) discover properties, check room/bed
availability, book, and pay online. Owners manage listings, tenants, QR-based
check-in, and rent reminders from an owner dashboard.

**Stack:** Flutter (mobile) · Next.js (web) · NestJS + Prisma + PostgreSQL (backend) ·
Cloudflare R2 · Razorpay · Google Maps · Firebase Cloud Messaging · Docker ·
Railway now, AWS later.

## Repository layout

```
PGPlatform/
├── apps/
│   ├── mobile/          # Flutter mobile client
│   ├── web/             # Next.js web client
│   └── backend/         # NestJS API & services
├── packages/            # Shared libraries consumed by apps (types, contracts, config, utils)
├── docs/                # Architecture notes, decisions, runbooks
├── infrastructure/      # Docker, IaC, CI/CD, environment config
├── tests/               # Cross-app integration & end-to-end tests
├── .claude/             # Claude Code settings, agents, and slash commands
├── CLAUDE.md            # Working notes for AI assistants in this repo
└── README.md
```

Anything used by more than one app belongs in `packages/`, not copied between apps.
Tests that exercise a single app live inside that app; `tests/` is for flows that
cross app boundaries.

## Getting started

```bash
# TODO: fill in once the toolchain is chosen
# install dependencies
# start the backend
# start a client
```

## Development

| Task | Command |
| --- | --- |
| Install | _TODO_ |
| Run dev servers | _TODO_ |
| Test | _TODO_ |
| Lint / format | _TODO_ |
| Build | _TODO_ |

## Documentation

Longer-form docs live in [docs/](docs/). Start there for architecture, data model,
and deployment details.

## License

_TODO_
