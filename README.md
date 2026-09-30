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
index.html                  the card page
customize.html              ⭐ Card Studio: create & edit client cards (login)
css/style.css               card design & animations (designed in blue)
css/customize.css           Card Studio design
js/config.js                the main-link card (Appu & Ammu)
js/defaults.js              template text used by new client cards
js/supabase.js              Supabase URL + publishable key (shared)
js/theme.js                 colour themes (blue, rose, red, purple, teal, black)
js/app.js                   the card: loads ?card=…, envelope, collage, cinema…
js/customize.js             Card Studio logic (login, uploads, save)
assets/photos, assets/video media for the main-link card
supabase/schema.sql         database + storage setup (run once in Supabase)
```

## Client cards (Card Studio)

One site, many couples. Each card has its own link: `https://<site>/?card=raj-priya`.
The main link (no `?card=`) keeps showing the card in `js/config.js`.

**One-time setup**
1. Supabase → **SQL Editor** → run all of `supabase/schema.sql` (safe to re-run).
2. Supabase → **Authentication → Users → Add user → Create new user**: your email + a password,
   tick **Auto Confirm User**.
3. Supabase → **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up",
   so nobody else can make an account.

**Making a card**
1. Open `https://<site>/customize.html` and sign in.
2. **+ New card** → fill in the names (the link name is suggested from them), pick a colour theme,
   write the text, upload photos and a video, paste the YouTube link → **Save**.
3. **Preview** opens the card. **Copy link** on the card list gives you the link to send.

Photos are shrunk and re-saved in the browser before upload (fast to load, and hidden data such as
GPS location is removed). Tap a photo in the editor to choose which part stays visible when it's
cropped. Videos up to 50 MB (under 15 MB loads best on phones). No video → the video frame is
hidden; no YouTube link → the cinema is hidden.

The card list shows how many times each card was opened and when.

**Privacy:** visitors can only fetch one card by its exact link name. They can't list other cards
or read who opened what. Uploaded photos/videos are public by link (like any image on a website).

## Edit the main-link card

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

## Supabase

URL and publishable key live in `js/supabase.js`. Tables: `cards` (client cards), `visits`
(a row each time an envelope is opened, per card). Storage bucket: `card-media`.
See `supabase/schema.sql`.

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

## After changing CSS or JS

Bump the `?v=` number on the CSS and JS links in `index.html` (and `customize.html`) (e.g. `?v=3` → `?v=4`). Browsers keep old files for a few minutes, and a new page
with an old script can stop the envelope from opening.

## Test locally

```
python3 -m http.server 8000
```
Open http://localhost:8000

---
Designed by Emoly Creations
