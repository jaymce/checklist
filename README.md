# My Checklist

A small checklist web app: add items, check them off, delete them. Your list
is saved in your browser, so it survives a refresh.

**Live:** https://jaymce.github.io/checklist

## Files

| File | Role |
|------|------|
| `index.html` | Page structure |
| `style.css` | Appearance, including light and dark mode |
| `app.js` | Behavior — add, toggle, delete, persist |

No build step and no dependencies. It is three files a browser can open directly.

## Running it locally

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Deploying

Pushing to the `main` branch publishes the site via GitHub Pages.

```sh
git add -A
git commit -m "Describe what changed"
git push
```

The live site updates about 30 seconds later.
