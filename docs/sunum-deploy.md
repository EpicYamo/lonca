# Standalone presentation deployment

The interactive presentation is already available at
<https://kozmos.itaskira.com/sunum/>. This guide describes an optional, separate
static deployment that contains only the presentation and the assets it needs.

## Netlify (free tier)

The repository includes `netlify.toml`. Netlify will run
`npm run build:sunum` and publish `dist/sunum-netlify/`; that output contains
the presentation, not the Lonca app or Studio. The build copies the Three.js
runtime, presentation fonts, and only the referenced images.

1. Sign in to Netlify and choose **Add new site → Import an existing project**.
2. Connect GitHub and select `EpicYamo/lonca`.
3. Use `main` as the production branch. Netlify should read the build command
   and publish directory from `netlify.toml`; if prompted, use:
   - Build command: `npm run build:sunum`
   - Publish directory: `dist/sunum-netlify`
4. Choose the **Free** plan and deploy. Netlify provides a `*.netlify.app`
   address; no custom domain is required. Do not enable paid add-ons or upgrade
   the plan. Free-plan quotas can change; when the usage limit is reached, builds
   may pause until the next period.
5. After the first successful deploy, replace the live-presentation URL in
   `README.md` with the new Netlify URL if you want the README to point to the
   separate copy instead of the existing Lonca host.

The repository is public, so Netlify can import it without exposing any account
credentials. The deploy output is static and does not need environment variables
or an AI API key.

## Build and preview locally

```bash
npm ci
npm run build:sunum
npx --yes http-server dist/sunum-netlify
```

Open the local URL printed by `http-server`. For a quick static-only preview,
the presentation does not need the Lonca API or server.

## Important: image permissions

The presentation uses a subset of the heritage inventory photos. The GitHub
repository is currently public, and the standalone deployment makes those
presentation assets publicly accessible as well. Confirm the applicable source
permissions before publishing or redistributing them.
