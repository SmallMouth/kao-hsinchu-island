import subprocess, sys, json
from playwright.sync_api import sync_playwright
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _r import LA, goto, R as RENDERER
import os; P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # game/
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=LA)
    pg = b.new_page(viewport={'width': 390, 'height': 844})
    pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    goto(pg, 'file://' + P + '/index.html#debug')
    pg.wait_for_timeout(500)
    print('title state', pg.evaluate('__game.state()'))
    print('jump on title ->', pg.evaluate('__game.jump(30)'))
    pg.evaluate("__game.start('std')")
    pg.wait_for_timeout(800)
    s = pg.evaluate('__game.state()')
    print('t', s['t'], 'money', s['money'], 'bubbles', len(s['bubbles']))
    print('jump ->', pg.evaluate('__game.jump(100)'))
    s = pg.evaluate('__game.state()')
    print('t', s['t'], 'score', s['score'], 'stations', s['stations'], 'bubbles', s['bubbles'], 'catches', s['catches'], 'misses', s['misses'])
    pg.screenshot(path=P + '/shots/smoke_100.png')
    print('jump ->', pg.evaluate('__game.jump(178)'))
    pg.wait_for_timeout(3000)
    s = pg.evaluate('__game.state()')
    print('over', s['over'], s['result'])
    pg.screenshot(path=P + '/shots/smoke_end.png')
    b.close()
print('ERRORS:', errs)
