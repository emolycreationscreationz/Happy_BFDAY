# Happy Boyfriend's Day 💌

A digital surprise card for Boyfriend's Day, built on the same idea as the *Raikan Cinta* invitation:
an envelope opening, then a scroll-down story of little "gifts".
Theme: royal blue · gold · black, with blue and ivory roses, fairy lights and falling petals. Static site (HTML/CSS/JS), no build step.

## The flow

1. **Envelope (full screen)**: the whole screen is a rose-velvet envelope with rose bouquets, a gold frame and a
   beating wax-heart seal. Tap it and the seal cracks in two, the flap swings open, a card rises out of the
   envelope and your message types itself out. Then *Open your gifts*.
2. **Wishes**: "Happy Boyfriend's Day, *name*", the **AI video** in a glowing arch frame (silent, looping),
   then the wish cards.
3. **Nudge**: a wiggling gift box: *"Wait… there's more! Keep scrolling…"*
4. **Gift 01 · Memories**: polaroids fly into a **heart shape** around a beating heart photo. Tap any photo to open it.
5. **Gift 02 · Letter**: a handwritten letter on lined paper; each paragraph fades in as he scrolls.
6. **Gift 03 · Cinema**: marquee lights, red curtains and two glowing seats (*you* and *me*).
   *Open the curtains* plays the **YouTube song** right on the screen.
7. **I Appreciate You**: flip cards with reasons, heart fireworks, and a framed photo of you two.

There are also falling rose petals and floating hearts across the page, little hearts wherever he taps, and a heart in the corner that fills up as he scrolls.

## Structure

```
index.html            page structure
css/style.css         design & animations (colours at the top in :root)
js/config.js          ⭐ ALL TEXT & SETTINGS: edit this file
js/app.js             envelope, collage, cinema, Supabase, animations
assets/photos/        your photos
assets/video/         your AI video
supabase/schema.sql   database setup (run once in Supabase)
```

## Edit the content

Open `js/config.js`. Names, opening lines, wishes, photo captions, the letter, reasons and button text are all there.

- **AI video**: put the file in `assets/video/` (e.g. `wishes.mp4`, keep it under ~10 MB) and set
  `video: "assets/video/wishes.mp4"`. Set `videoAspect` to `"9/16"` (portrait), `"16/9"` or `"1/1"`.
  While `video` is empty a "video coming soon" placeholder is shown.
  `videoWebm` is an optional fallback copy for browsers that can't play MP4 (e.g. some Linux browsers).
  To shrink a new video before adding it:
  `ffmpeg -i in.mp4 -c:v libx264 -crf 24 -preset slow -movflags +faststart -an assets/video/wishes.mp4`
- **Photos**: put them in `assets/photos/` (`.jpg`/`.webp`, around 800px wide is plenty), then set `src` for
  `heartPhoto` (middle), up to 9 `memories` and `finalPhoto` (framed photo near the end). `focus` picks which part stays visible when cropped (`"50% 30%"`).
  Empty `src` shows a soft pink placeholder.
- **YouTube song**: paste any link into `youtubeUrl` (`https://youtu.be/…`, `…watch?v=…`, shorts all work).
  `youtubeStart` starts it at a given second (a `?t=45` in the link works too).
- **Colours**: the variables at the top of `css/style.css` (`--rose`, `--gold`, `--bg`, …).

## Supabase ("he opened it")

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste all of `supabase/schema.sql`, **Run**.
3. Copy the **Project URL** and the **publishable** (or legacy anon) key into
   `supabaseUrl` and `supabaseAnonKey` in `js/config.js`.

Every time the envelope is opened, a row (time + device) is added to the `visits` table.
See it in **Table Editor**. The page can only add rows, never read them, and the publishable key
is meant to be public. Leave both fields empty to turn this off.

## Deploy (GitHub Pages)

One-time setup: repo **Settings → Pages → Source: Deploy from a branch**, pick the branch and
`/ (root)`, then **Save**. The site is then at `https://<user>.github.io/<repo>/` (each push goes
live in 1–2 minutes; progress is under the **Actions** tab). `.nojekyll` makes GitHub serve the
files as-is.

## Deploy (Netlify / Vercel)

No build. Connect this repo:

- **Netlify**: New site → Import from Git → pick the repo. Build command empty, publish directory `.`
  (already set in `netlify.toml`).
- **Vercel**: New Project → pick the repo → Framework preset *Other* → Deploy.

For a nice WhatsApp preview, add
`<meta property="og:image" content="https://your-site.netlify.app/assets/photos/…">` to `index.html` once you have the domain.

## Test locally

```
python3 -m http.server 8000
```
Open http://localhost:8000

---
Designed by Emoly Creations
