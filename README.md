# rafaelwerlang.com

Static site. No dependencies: `build.py` uses only the Python standard library (own Markdown parser and code highlighter); fonts are self-hosted (Inter Tight, Instrument Serif — SIL OFL, licenses in `static/fonts/`).

- Write posts in `posts/YYYY-MM-DD-slug.md` (front matter: title, description, tags).
- `python3 build.py` generates `docs/`, which GitHub Pages serves.
- Preview: `python3 -m http.server -d docs 8000`.
