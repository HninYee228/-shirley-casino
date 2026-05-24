# Shirley Casino (GitHub Pages)

This is a **static** web app (no backend). Everyone can open it on their phone via the GitHub Pages link.

## Publish on GitHub Pages (recommended)

1. Create a GitHub repo (public is easiest).
2. Upload everything in this folder (or push with git).
3. Go to **Settings → Pages**.
4. **Source:** Deploy from a branch
5. **Branch:** `main`
6. **Folder:** `/docs`
7. Save.

Your site will be:

`https://<your-username>.github.io/<repo-name>/`

## Important note about sharing

- Game + Monthly data is stored in the browser using **localStorage**.
- That means **each phone has its own data** (it does NOT sync between players).
- If you ever want real-time shared sessions across everyone, you need a backend (Firebase/Supabase/etc.).

## Run locally

Just open `index.html` in a browser, or run a tiny local server:

```bash
python3 -m http.server 8000
```
Then open: `http://localhost:8000`
