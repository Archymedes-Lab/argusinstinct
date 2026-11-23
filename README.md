# argusinstinct.xyz

The Argus product page: the archymedes-site design system (warm off-white, hairline rules, Archivo / Zen Kaku Gothic /
IBM Plex Mono, one blue) with four three.js scenes drawn in the site's screentone style (`web/src/kit.ts`):

| Scene | Section | What it acts out |
| --- | --- | --- |
| `lattice.ts` | Hero (pinned) | The Argus instrument from archymedes-site: a sweep, an intruder flagged, held and released on undo, one panel left open |
| `tree.ts` | Processes (pinned) | Who started what; a postinstall script reaches for an unseen host, is flagged and held |
| `vault.ts` | Data protection (pinned) | A scan finds plain-text keys; nothing crosses the boundary |
| `rack.ts` | Servers (pinned) | A survey passes down a rack; a new-network login lights up; the unprivileged auditor stands apart |

Pinned sections are driven by scroll (`--p` per section, Lenis smooth scroll); reduced motion gets still frames.
SEO: schema.org graph (Organization, WebSite, SoftwareApplication with offers, FAQPage), Open Graph image, sitemap,
robots, `llms.txt`, `/.well-known/security.txt`. Security headers and CSP in `web/public/_headers`.

```bash
cd web && bun install
bun run dev        # http://localhost:5173
bun run deploy     # vite build → ../dist, then wrangler deploy (Worker static assets, custom domains)
```

Copy follows the claim rules: it says what Argus observes and records, never that it protects.

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
