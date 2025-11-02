# Mirador

Mirador is a terminal-based database explorer for PostgreSQL, MySQL, and SQLite built with Ink and Bun.

## Development

- `bun run dev` – start the development server with hot reload.
- `bun run lint`, `bun run format`, `bun run type-check`, `bun run test` – project quality checks.

## Building

- `bun run build` – bundles the CLI to `dist/index.js` and produces a standalone executable at `dist/mirador`.
- `bun run build:bundle` – bundles to JavaScript only (previous build flow).
- `bun run build:compile` – creates the native Bun executable directly.

After running any build command you can launch the binary with:

```bash
./dist/mirador
```

The application header now includes the current package version so you can quickly verify which build you are running.
