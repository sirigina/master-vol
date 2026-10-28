"""
Check every internal link in the built site (dist/) resolves to a page.
Usage: python3 scripts/check-links.py   (run after `npx astro build`)
"""
import pathlib, re, sys

dist = pathlib.Path(__file__).resolve().parent.parent / 'dist'
pages = {('/' + str(p.relative_to(dist)).replace('index.html', '')).replace('//', '/') for p in dist.rglob('index.html')}
bad = []
for html in dist.rglob('*.html'):
    src = html.read_text(errors='ignore')
    for href in re.findall(r'href="(/[^"#?]*)', src):
        if href.startswith(('/_astro', '/pagefind', '/favicon', '/sitemap')) or '.' in href.rsplit('/', 1)[-1]:
            continue
        h = href if href.endswith('/') else href + '/'
        if h not in pages:
            bad.append((str(html.relative_to(dist)), href))
for f, h in sorted(set(bad)):
    print(f'BROKEN {h}  (in {f})')
print(f'{len(pages)} pages, {len(set(bad))} broken links')
sys.exit(1 if bad else 0)
