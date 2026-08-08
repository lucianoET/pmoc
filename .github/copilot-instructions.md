# PMOC Workspace Instructions

## Workspace boundaries

- Treat `/home/luc/Downloads/pmoc-overlay` as the only development target.
- Treat `/home/luc/DEV_ERP` and every descendant directory or repository as strictly read-only reference material.
- Access `DEV_ERP` only with read and search tools. Do not edit, create, delete, rename, format, generate, install, build, test, start services, run migrations, or perform Git operations in that tree.
- You may adapt patterns and domain knowledge from `DEV_ERP`, but write all code, documentation, generated files, and command side effects only inside `pmoc-overlay`.
- If completing a request appears to require a change in `DEV_ERP`, stop and request explicit authorization.

## Project conventions

- Keep code identifiers, comments, UI strings, and documentation in Portuguese.
- Preserve the zero-build HTML, vanilla JavaScript, and Supabase architecture unless the user approves a new design.
- Keep Supabase migrations additive; never drop production tables or columns.
- Read [CLAUDE.md](../CLAUDE.md) for architecture, commands, and domain-specific conventions.