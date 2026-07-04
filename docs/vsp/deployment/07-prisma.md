# Prisma

VSP Phone uses **Prisma 7** with PostgreSQL. Schema: [prisma/schema.prisma](../../../prisma/schema.prisma).

---

## Key files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Data model |
| `prisma/migrations/` | Versioned SQL migrations |
| `prisma.config.ts` | Prisma 7 config |
| `generated/` | Generated Prisma client (post-`generate`) |
| `db.js` / `db.ts` | Runtime client accessor |

---

## Local development

```bash
npm install                    # runs postinstall → ensure-prisma-client.js
npx prisma generate
npx prisma migrate deploy      # apply existing migrations
npx prisma studio              # GUI browser
npm run seed                   # initial super admin (once per env)
```

Create a new migration (dev only):

```bash
npx prisma migrate dev --name describe_change
```

Commit both `schema.prisma` and new folder under `migrations/`.

---

## Production

Only use:

```bash
npx prisma migrate deploy
```

Never `migrate dev` or `db push` on production without explicit approval.

Production `DATABASE_URL`:

- **Docker API:** `postgresql://vsp:vsp@postgres:5432/vsp_voip` (Compose override)
- **Host tools:** point at `localhost:5432` if port is published

---

## Client generation

Docker build runs `npx prisma generate` in the build stage ([Dockerfile](../../../Dockerfile)).

If API fails with "Prisma client not initialized":

```bash
docker compose build --no-cache api
docker compose up -d api
```

---

## npm scripts

| Script | Command |
|--------|---------|
| `npm run migrate:deploy` | `prisma migrate deploy` |
| `npm run seed` | `tsx seed.ts` |

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| P1001 Can't reach database | Postgres down or wrong `DATABASE_URL` |
| P3009 failed migration | Resolve failed migration record; restore backup if needed |
| Column does not exist | Run `migrate deploy` |
| Client out of sync | `npx prisma generate` |

---

## Related docs

- [06-database-migrations.md](./06-database-migrations.md)
- [01-local-development.md](./01-local-development.md)
