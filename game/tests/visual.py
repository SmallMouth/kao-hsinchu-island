"""版面細節截圖：360 寬 HUD、底部空地開抽屜（應改停靠上方）、加成卡預覽"""
import subprocess, sys
from playwright.sync_api import sync_playwright
import os; P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # game/
with sync_playwright() as p:
    for (w, h) in [(360, 640), (390, 844)]:
        br = p.chromium.launch(); ctx = br.new_context(viewport={'width': w, 'height': h}, has_touch=True, is_mobile=True, device_scale_factor=2)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + P + '/index.html'); pg.wait_for_timeout(300)
        pg.evaluate("__game.start('std')"); pg.wait_for_timeout(200)
        pg.evaluate('__game.jump(0.5)')
        # 找最下方的空地（沒有就修一格最下方的壞格再找）
        s = pg.evaluate('__game.state()')
        plots = sorted([c for c in s['cells'] if c['plot'] and not c['locked']], key=lambda c: -c['r'])
        print(w, 'plots', [(c['c'], c['r']) for c in plots], 'money', s['money'])
        pg.evaluate('(()=>{const g=__game; return 1})()')
        if plots:
            pg.evaluate(f"__game.tapCell({plots[0]['c']},{plots[0]['r']})"); pg.wait_for_timeout(400)
            pg.screenshot(path=f'{P}/shots/visual_{w}x{h}_drawer.png')
            tops = pg.evaluate("[document.getElementById('drawer').className, document.getElementById('drawer').getBoundingClientRect().top]")
            print(w, 'drawer', tops)
        print(w, 'errors', errs, 'gear right', pg.evaluate("document.getElementById('btnGear').getBoundingClientRect().right"), 'innerWidth', w)
        br.close()
