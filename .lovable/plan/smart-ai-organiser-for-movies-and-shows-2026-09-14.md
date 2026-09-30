# Smart AI organiser for movies and shows

Titles from your provider come with messy names and often no genre or year. This adds a smart organiser that looks each title up in a free online movie database and, when that comes up empty, asks the AI to classify it. Results are saved, so each title is only looked up once.

## What you get

- Real genres (Action, Horror, Documentary, Comedy, Sci-Fi, Family, and so on) instead of provider rows like "New Added EN" or "Top 500".
- Correct release year, even when the title has none.
- Better posters and short descriptions where your provider's are missing.
- An "Organise smartly" switch on the Movies and Series pages. While it is running you see a small progress note; rows re-sort as results arrive.
- Everything is remembered, so the second visit is instant and costs nothing.

## How much gets looked up

Only what you are browsing: the visible category or search results, in batches of a few hundred, newest rows first. Nothing runs in the background over your whole library, so credits stay low. Already-known titles are skipped.

## What I need from you

A free TMDB API key (themoviedb.org, Settings > API). I'll ask for it securely when the work starts. Without it, the organiser still works using AI only, just with fewer posters and descriptions.

## Technical notes

- New `title_metadata` table keyed by a normalised title plus year: resolved title, genres, year, poster, backdrop, overview, source (`tmdb` or `ai`), confidence, timestamps. Rows are shared across users (no personal data), readable by signed-in users, written only by the server. GRANTs and RLS included.
- New `src/lib/metadata.server.ts`: title normalisation (strips `EN -`, `NF -`, `4K`, bracketed tags, trailing year), TMDB search + genre mapping, plus a Lovable AI fallback (`openai/gpt-6-astra` via the Responses API) that classifies unmatched titles in batches with a strict schema, and writes results to `title_metadata`.
- New `src/lib/metadata.functions.ts`: `enrichTitles` server function (auth middleware, ownership-checked playlist, capped batch size) returning metadata for a list of catalogue ids; cached lookups short-circuit before any TMDB or AI call.
- `src/lib/organize.ts`: `groupItems` accepts an optional metadata map and prefers its genres and year over category-derived guesses; existing category and cross-reference logic stays as the fallback.
- `src/components/catalog-browser.tsx`: adds the "Organise smartly" toggle, a React Query mutation that enriches the visible page in chunks, and passes the metadata map into `groupItems`. TV screens keep their current grouping for now.
- TMDB key stored as a server secret, read inside handlers only. AI failures degrade to category-based grouping rather than erroring.
