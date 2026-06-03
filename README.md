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

A working API key is included in `.env.local`. Replace if needed:

```
NEXT_PUBLIC_TMDB_API_KEY=your_key
NEXT_PUBLIC_TMDB_BASE_URL=https://api.themoviedb.org/3
```

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
