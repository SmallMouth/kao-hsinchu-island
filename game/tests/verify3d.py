"""3D 換皮自我驗證：python3 tests/verify3d.py [shots|perf|mem|all] [gpu]
shots：1440×900（滑鼠）、390×844、360×640（觸控）各截 標題／開場／修補中／1:40 豪雨／Boss／結算夜景／分享圖 → shots/3d-*.png
perf ：CPU 降速 4 倍、390×844，開局 30 秒與 Boss 30 秒的平均／p95 幀時間＋renderer.info
mem  ：連跑 3 局，記錄 renderer.info.memory、DOM 節點數、JS heap
gpu  ：加上就用 Metal（實機 GPU）跑，否則 SwiftShader（軟體 WebGL）"""
import subprocess, sys, json, base64, os
from playwright.sync_api import sync_playwright
import os; P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # game/
URL = 'file://' + P + '/index.html' + ('#aoe' if os.environ.get('ART', '').lower() == 'aoe' else '')   # ART=aoe：世紀帝國建築組
GPU = 'gpu' in sys.argv
ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] if GPU else ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
what = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ('shots', 'perf', 'mem', 'all') else 'all'
errs = []

def page(p, w, h, touch, played=False):
    br = p.chromium.launch(args=ARGS)
    ctx = br.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
    if played: ctx.add_init_script("try{localStorage.setItem('cc_played','true')}catch(e){}")
    pg = ctx.new_page()
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text)); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_function('window.__game && __game.ready === true', timeout=20000)
    assert pg.evaluate('__game.renderer()') == '3d'
    return br, pg

def tap(pg, touch, x, y):
    if touch: pg.touchscreen.tap(x, y)
    else: pg.mouse.click(x, y)

def shots(p):
    out = {}
    for (w, h, touch) in [(1440, 900, False), (390, 844, True), (360, 640, True)]:
        tag = f'{w}x{h}'; br, pg = page(p, w, h, touch)
        pre = f'{P}/shots/3d-' + ('aoe-' if os.environ.get('ART', '').lower() == 'aoe' else '') + tag   # ART=aoe 不覆蓋預設（新竹）基準截圖
        sh = lambda n: pg.screenshot(path=f'{pre}-{n}.png')
        pg.wait_for_timeout(900); sh('1title')
        bb = pg.locator('#btnStd').bounding_box(); tap(pg, touch, bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
        pg.wait_for_timeout(700); sh('2open')
        # 修補中：真實點擊教學格，再到 0:40 修一格、派出村民
        bb = pg.locator('.cell[data-i="7"]').bounding_box(); tap(pg, touch, bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
        pg.wait_for_timeout(500); sh('3repair_tut')
        pg.evaluate('__game.jump(40)'); pg.evaluate('G.money = 400')
        pg.evaluate("(() => { const c = G.cells.find(c => repairable(c) && !isQueued(c)); if (c) cellTap(c.i); for (const b of G.bubbles.slice()) if (b.positive || canServeAny(b)) tapBubble(b.id); })()")
        pg.wait_for_timeout(450); sh('3repair')
        info = pg.evaluate('__game.renderInfo()')
        # 每格點擊區：DOM 量測（內接正方形邊長由仿射推得；bbox 為外接）
        cellm = pg.evaluate("""(() => { const r = document.querySelector('.cell[data-i="17"]').getBoundingClientRect(); return { side: AF.side, bboxW: r.width, bboxH: r.height }; })()""")
        pg.evaluate('__game.jump(100.4)'); pg.wait_for_timeout(1600); sh('4rain')
        pg.evaluate('__game.jump(147)'); pg.wait_for_timeout(1300); sh('5boss')
        pg.evaluate('__game.finish()'); pg.wait_for_timeout(3300); sh('6results')
        pg.evaluate("document.getElementById('resPanel').classList.remove('hide')")
        pg.locator('#btnShareImg').scroll_into_view_if_needed(); pg.locator('#btnShareImg').click(); pg.wait_for_timeout(500)
        src = pg.evaluate("document.getElementById('shareImg').src")
        open(f'{pre}-7share.png', 'wb').write(base64.b64decode(src.split(',')[1]))
        hs = pg.evaluate('[document.documentElement.scrollWidth - innerWidth]')[0]
        out[tag] = {'renderInfo': info, 'cell': cellm, 'hscroll': hs}
        br.close()
    return out

def frames(pg, sec):
    return pg.evaluate("""sec => new Promise(res => { const ts = []; let last = performance.now(); const t0 = last, info = { calls: 0, tris: 0 };
      const f = now => { ts.push(now - last); last = now; const i = __game.renderInfo(); if (i) { info.calls = Math.max(info.calls, i.calls); info.tris = Math.max(info.tris, i.triangles); }
        if (now - t0 < sec * 1000) requestAnimationFrame(f); else { ts.shift(); ts.sort((a, b) => a - b); const avg = ts.reduce((a, b) => a + b, 0) / ts.length;
          res({ n: ts.length, avg: +avg.toFixed(2), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(2), fps: +(1000 / avg).toFixed(1), maxCalls: info.calls, maxTris: info.tris, last: __game.renderInfo() }); } };
      requestAnimationFrame(f); })""", sec)

def perf(p):
    br, pg = page(p, 390, 844, True, played=True)
    cdp = pg.context.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    pg.evaluate("__game.start('std'); window.__ap = setInterval(() => { if (G && G.running) autopilot(); }, 250)")
    pg.wait_for_timeout(500)
    early = frames(pg, 30)
    pg.evaluate('__game.jump(143)')
    boss = frames(pg, 30)
    br.close()
    return {'early_0_30s': early, 'boss_143_173s': boss}

def mem(p):
    br, pg = page(p, 390, 844, True, played=True)
    rows = []
    for k in range(3):
        pg.evaluate("__game.start('std'); __game.setSpeed(16); clearInterval(window.__ap); window.__ap = setInterval(() => { if (G && G.running) autopilot(); }, 100)")
        pg.wait_for_function('__game.state().over', timeout=120000, polling=500)
        pg.wait_for_timeout(1500)
        rows.append(pg.evaluate("""(() => { const i = __game.renderInfo(); return { game: 0, geometries: i.geometries, textures: i.textures, programs: i.programs, dom: document.getElementsByTagName('*').length, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, score: __game.state().result.score }; })()"""))
        rows[-1]['game'] = k + 1
    br.close()
    return rows

with sync_playwright() as p:
    res = {'gpu': GPU}
    if what in ('shots', 'all'): res['shots'] = shots(p)
    if what in ('perf', 'all'): res['perf'] = perf(p)
    if what in ('mem', 'all'): res['mem'] = mem(p)
    res['errors'] = errs
print(json.dumps(res, ensure_ascii=False, indent=1))
