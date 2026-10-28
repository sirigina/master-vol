"""
Visual check: screenshot every .viz-card on a page (after it hydrates).
Usage: python3 scripts/shoot-cards.py <port> <path> <out-dir> [width] [light|dark]
Example: python3 scripts/shoot-cards.py 4401 /vol/b4/ /tmp/shots 1280 light
Prints the number of cards and any page/console errors.
"""
import sys, os
from playwright.sync_api import sync_playwright

port, path, out = sys.argv[1], sys.argv[2], sys.argv[3]
width = int(sys.argv[4]) if len(sys.argv) > 4 else 1280
scheme = sys.argv[5] if len(sys.argv) > 5 else 'light'
os.makedirs(out, exist_ok=True)
tag = path.strip('/').replace('/', '_') or 'home'

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': width, 'height': 900}, color_scheme=scheme)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(f'http://localhost:{port}{path}', wait_until='networkidle')
    cards = pg.locator('.viz-card')
    n = cards.count()
    for i in range(n):
        cards.nth(i).scroll_into_view_if_needed()
        pg.wait_for_timeout(700)
        cards.nth(i).screenshot(path=f'{out}/{tag}_{width}_{scheme}_card{i}.png')
    print(f'{n} cards -> {out}/{tag}_{width}_{scheme}_card*.png')
    print('ERRORS:', errs)
    b.close()
