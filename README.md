# nishchalpanta.com.np

Personal site for **Nishchal Panta**, a computer science undergraduate in
Kathmandu working on machine-learning models and the web platforms that serve
them.

The page is written as a narrative in nine movements rather than a list of
sections, and it uses scroll-linked motion so that scroll position carries
meaning instead of merely triggering effects.

## Stack

| | |
|---|---|
| Framework | **Astro**, static output, no UI framework and no hydration runtime |
| Styling | one hand-written CSS file pair, no preprocessor, no utility framework |
| Script | vanilla ES modules, no dependencies |
| Fonts | three self-hosted, subset WOFF2 faces |
| Images | Astro's image service, WebP with responsive `srcset` |
| Hosting | S3 + CloudFront, GitHub Actions on OIDC |
| Contact | API Gateway → Lambda → Amazon SES |

Runtime dependencies: `astro` only. `@aws-sdk/client-ses` is used by the
Lambda, not the site.

## Local development

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static build into dist/
npm run preview   # serve the built output
npm run photos    # photo curator at http://localhost:4322 (local only)
npm run csp:hash  # hash for the inline theme bootstrap, after editing it
```

## Project layout

```
astro.config.mjs
src/
  assets/                 build inputs, resized copies. Originals untouched.
    album/ events/ credentials/ site/
  components/             Album, ContactForm, Credentials, Events, Gallery,
                          Rail, ThemeToggle
  content/                content collections (JSON)
    events/ credentials/ skills.json
  content.config.ts       collection schemas
  data/album.ts           album slides
  integrations/           prunes unreferenced build output
  layouts/BaseLayout.astro
  pages/                  index.astro, 404.astro
  styles/                 tokens.css, site.css
public/                   fonts, cv, certs, evidence, og image
lambda_function.js        contact handler
docs/                     design system, CloudFront headers policy
```

### Content

Events, credentials and skills are data, not markup. Add one JSON file per
entry in `src/content/events/` or `src/content/credentials/`; the schema in
`src/content.config.ts` validates it at build time.

An event may name a credential by id, which renders as a link into the ledger.
This is deliberate: **credentials appear once, in the ledger, and never again in
the events list.**

### Images

`src/assets/` holds build inputs, resized to what their slot actually needs
(album 1000px, events 1200px, credentials 1200px). The originals in
`assets/Carousel_photos/` and `assets/certificates/` are never modified.

Astro emits an untouched copy of every imported image alongside its
derivatives. The `prune-unreferenced-assets` integration deletes any file in
`dist/` that no emitted document references, which removed 4.2 MB per build.
It only ever deletes provably unreferenced files.

## Deployment

`.github/workflows/deploy.yml` builds, asserts the 404 exists and that `dist/`
stays under 12 MB, then syncs to S3 and invalidates CloudFront.

**It authenticates with GitHub OIDC.** There are no long-lived access keys and
nothing secret in the repository.

Before the first deploy, set these as **repository or environment variables**:

| Variable | Meaning |
|---|---|
| `vars.AWS_DEPLOY_ROLE_ARN` (or `secrets.AWS_DEPLOY_ROLE_ARN`) | IAM role trusting this repo's `main` branch |
| `vars.AWS_REGION` | e.g. `ap-south-1` |
| `vars.S3_BUCKET` | the site's bucket |
| `vars.CLOUDFRONT_DISTRIBUTION_ID` | distribution to invalidate |

Create the OIDC trust relationship and attach the role in the AWS console or
with the CLI. That is a one-time change on the AWS side and is deliberately not
automated here.

### Caching

| Path | Policy |
|---|---|
| `_astro/*`, `fonts/*` | `max-age=31536000, immutable` (content-hashed filenames) |
| HTML | `max-age=0, must-revalidate` |
| `og/*`, `certs/*`, `cv/*` | `max-age=86400` |

### Security headers

`docs/cloudfront-headers-policy.json` is a CloudFront response-headers policy
definition: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy` and `Permissions-Policy`.

The CSP is a strict `script-src 'self'`. That is only possible because the
theme bootstrap lives in `/public/theme-init.js` and is loaded synchronously,
rather than being an inline `<script>`. **If you ever inline a script, this
policy will block it.**

Apply it to the distribution with
`aws cloudfront create-response-headers-policy` then
`update-distribution`. Do that manually; nothing here changes it for you.

### 404

`dist/404.html` is uploaded explicitly with a `text/html` content type, and the
workflow sets the bucket's website error document to it. CloudFront should be
configured to use a custom error response for `404` pointing at `/404.html`, or
it will serve its own default page instead.

## Contact form

The form posts to an API Gateway URL that is resolved at build time by
`src/config.local.ts`, in this order:

1. `PUBLIC_CONTACT_ENDPOINT`, set in CI from the GitHub repository variable
   `CONTACT_ENDPOINT` - so a hosted build works with no local file present.
2. `invokeURL` in `config.js` at the project root (gitignored, never committed)
   - so a local build works without touching GitHub settings.

`npm run sync:vars` is the bridge: it copies `config.js` into those repository
variables, so CI has what it needs while the file stays local. Only the
endpoint reaches the page, and only as a `data-endpoint` attribute; no
credential is ever placed in the front end. The function is protected by the
spam controls below.

`lambda_function.js` validates server-side regardless of what the client did:

- honeypot field, silently accepted and discarded
- length limits on every field
- email format check
- a link-count ceiling, which removes the cheapest spam outright
- per-IP rate limit, 3 messages per minute

The in-memory rate limit is a soft control: a Lambda container is not shared
across all concurrent invocations. Put API Gateway throttling in front if you
want a hard guarantee.

**The function sends real email.** Test it with your own address before
pointing anything real at it, or set `FROM_EMAIL`/`TO_EMAIL` to a sink.

## Accessibility and verification

Verified in Chromium at 360, 390, 430, 768, 1440 and 1920 px:

- zero horizontal overflow at every width
- zero console errors and zero warnings
- cumulative layout shift **0.0006**
- one `h1`, one `h2` per movement, semantic landmarks throughout
- every image has alt text, explicit dimensions and lazy loading
- no image renders larger than its own file
- the rail tracks all nine movements with no gaps
- carousel works by keyboard, touch and mouse at both widths
- theme toggle is keyboard operable with `aria-pressed`, persists, and defaults
  to the system preference with no flash of the wrong theme
- with `prefers-reduced-motion: reduce`, everything above still works and no
  animation runs

## Replacing content

- **Resume**: replace `public/cv/Nishchal_Panta_CV.pdf`
- **CV text**: the ledger and events are JSON in `src/content/`
- **Theme colours**: `src/styles/tokens.css`, the `:root` block
- **Type scale and space**: the same file

## Documentation

- `docs/design-system.md` — tokens, contrast measurements, motion strategy
- `docs/cloudfront-headers-policy.json` — headers policy, with notes