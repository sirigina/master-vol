"""Site-wide sanity sweep: every lesson page at desktop and mobile.
Reports console/page errors, horizontal overflow, and figures that rendered empty.
Usage: python3 scripts/sweep.py <port>"""
import sys, re, pathlib
from playwright.sync_api import sync_playwright
port = sys.argv[1]
ids = sorted(p.stem for p in pathlib.Path('src/content/docs/vol').glob('*.mdx') if p.stem != 'index')
paths = ['/', '/vol/', '/about/', '/glossary/'] + [f'/vol/{i}/' for i in ids]
problems = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, scheme in ((1280, 'light'), (390, 'dark')):
        pg = b.new_page(viewport={'width': w, 'height': 900}, color_scheme=scheme)
        for path in paths:
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:120]))
            pg.goto(f'http://localhost:{port}{path}', wait_until='networkidle')
            # scroll through to hydrate client:visible islands
            h = pg.evaluate('document.body.scrollHeight')
            for y in range(0, h, 700):
                pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(60)
            pg.wait_for_timeout(600)
            info = pg.evaluate('''() => {
              const cards=[...document.querySelectorAll('.viz-card')];
              const empty=cards.filter(c=>{const r=c.getBoundingClientRect(); const hasSvg=c.querySelector('svg:not([aria-hidden]),canvas,table,input,button'); return r.height<60 || !hasSvg}).length;
              const hosts=[...document.querySelectorAll('.plot-host')].filter(h=>!h.firstElementChild).length;
              const over=document.documentElement.scrollWidth - window.innerWidth;
              return {cards:cards.length, empty, hosts, over};
            }''')
            pg.remove_listener('pageerror', pg.listeners('pageerror')[0]) if hasattr(pg,'listeners') else None
            bad = errs or info['empty'] or info['hosts'] or info['over'] > 2
            if bad:
                problems += 1
                print(f'{w} {path} cards={info["cards"]} empty={info["empty"]} emptyPlots={info["hosts"]} overflow={info["over"]} errors={errs[:2]}')
        pg.close()
    b.close()
print('pages with problems:', problems, 'of', len(paths) * 2)
