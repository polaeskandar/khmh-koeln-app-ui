# Reference blocks

The two premium [shadcnblocks](https://www.shadcnblocks.com) blocks the prototype's largest components were
adapted from, kept unchanged for comparison:

| File | Adapted in |
| --- | --- |
| `shadcnblocks/application-shell30.tsx` | `src/components/app-shell/` (sidebar, top bar, phone tab bar) |
| `shadcnblocks/data-table13.tsx` | `src/components/data-table/` (the services and members tables) |

The other blocks the prototype builds on are named in the comment at the top of each adapted file
(`data-table17`, `calendar25`, `timeline9`, `sheet-form-4`, `settings-members2`,
`alert-dialog-form-2`, `alert-dialog-destructive-4`). To look at one of them, add it with
`pnpm shadcn add @shadcnblocks/<name>`, with `SHADCNBLOCKS_API_KEY` in your git-ignored `.env.local`.

These files are excluded from the build, the type check, linting and formatting. They fall under the
shadcnblocks premium licence, which allows using them in your own projects but not redistributing them:
keep them in this private repository and don't publish them.
