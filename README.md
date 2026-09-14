# Tashido TV

A premium, private movie and live TV streaming web app — Apple TV+ inspired.

## Stack
- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Lucide React** (icons)
- **react-player** (HLS playback for Live TV)
- **TMDB API** for catalog metadata

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Environment

Set the following in `.env.local` and in your hosting provider's environment settings:

```
TMDB_API_KEY=your_key
```

The server also accepts the existing `NEXT_PUBLIC_TMDB_API_KEY` as a migration
fallback, so existing deployments can be rebuilt without changing their settings.
New installations should use `TMDB_API_KEY`. The browser no longer reads this key.
Upstream TMDB hosts are fixed; `NEXT_PUBLIC_TMDB_BASE_URL` is no longer used.

## Network access and deployment

Catalog requests use `/api/tmdb/...`; posters, backdrops and cast photos use
`/api/tmdb-image/...`. These routes fetch TMDB on the server and cache successful
responses. They allow only supported catalog paths and image sizes, reject
arbitrary URLs and redirects, and never cache error responses in the browser/CDN.
Keep `images.unoptimized` enabled: the image route already serves cached images
for both Next Image and plain image elements.

Deploy with the Next.js runtime (Vercel or Netlify's Next.js integration), not a
static export. Rebuild/redeploy to apply these changes. Test without VPN on the
target network: open Home, search, and a detail page; confirm images and catalog
requests use your website's `/api/` paths and return 200.

External video embeds and Firebase still make their own network connections.
The app cannot repair requests inside a cross-origin video player or resume a
browser debugger. The player provides manual reload/server switching and help.
An iframe `load` event does not confirm successful playback. Test playback and
sign-in separately; these changes cannot fix blocking of the website itself.

Run proxy regression checks with `node --test tests/tmdb-proxy.test.mjs`.

## Structure

```
app/
  layout.js           # Global layout, navbar, footer
  page.js             # Home (hero + content rows)
  loading.js
  not-found.js
  movies/page.js      # Movies hub
  tv/page.js          # TV Shows hub
  live/page.js        # Live TV grid (HLS)
  search/page.js      # Multi-search
  movie/[id]/page.js  # Movie detail + iframe player
  tv/[id]/page.js     # TV detail + iframe player
components/
  Navbar.jsx          # Floating blurred top bar
  Footer.jsx
  Hero.jsx            # Full-screen carousel
  ContentRow.jsx      # Horizontal scroller
  MediaCard.jsx       # Poster / backdrop card
  DetailView.jsx      # Backdrop hero + cast + similar
  StreamPlayer.jsx    # vidsrc.to iframe modal
  LivePlayer.jsx      # react-player HLS modal
lib/
  tmdb.js             # API fetcher utility
  channels.js         # Live IPTV channels (.m3u8)
```

## Streaming

- **Movies / TV**: embedded via `https://vidsrc.to/embed/{type}/{tmdb_id}` in a sandboxed iframe modal.
- **Live TV**: HLS playback via `react-player`, channels defined in `lib/channels.js`.

## Disclaimer
For personal, private use only. All catalog metadata is provided by TMDB; streams come from third-party providers.
