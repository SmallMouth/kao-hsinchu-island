"""建築畫風「新竹地標」自我驗證：python3 game/tests/art.py [catalog|stadium|game|toggle|perf|click|feat|all]
catalog：圖鑑（市政府、四色站（照護＝醫療長照中心）、四色加成站、三種房子、棒球場整建 A 損壞／B 整修中／C 收尾／完工）
         1440×900 與 390×844 各截白天（工地三階段＋完工）＋傍晚＋結算夜景 → shots/hc-*.png
stadium：棒球場特寫 shots/hc-stadium-{desk,top}-{A,B,C,done}.png（desk＝1440×900 遊戲鏡頭；top＝同視窗把鏡頭俯角拉到 82° 的俯視判讀）、
         完工傍晚 hc-stadium-desk-dusk.png、結算夜景 hc-stadium-night.png、完工亮燈過程 hc-stadium-desk-lightup-{0,1,2}.png、
         醫療長照中心特寫 hc-care-{desk,top}.png
game   ：一局實際遊戲（×4 自動駕駛）中後段截圖
toggle ：除錯面板「建築畫風」新竹↔世紀帝國 真實點擊切換兩次（標題與局中），等 >3 秒確認沒退回 2D、沒有 console error
perf   ：同一盤面（圖鑑、同種子 1:50 局面）新舊兩組的 renderer.info（tris、calls）與每棟三角形數
click  ：高建築點擊路由：每種建築放在 (2,5)，真實點擊屋頂上緣、屋頂伸進的後排、後排深處，確認落在正確格子（兩種視窗）
feat   ：高處特徵點擊（模型座標 x,y,z → 螢幕）：市政府旗面／旗桿／主塔、棒球場四階段（燈塔燈頭、傾斜燈柱、吊車臂、吊著的燈頭、鷹架、記分板、側看台遮雨棚）、
         醫療長照中心（停機坪 H、女兒牆、入口雨遮、救護車警示燈、屋頂花園）、車站鐘面／尖頂、廟匾額／小吃攤，都要落在本格"""
import subprocess, sys, json, os
from playwright.sync_api import sync_playwright
import os; P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # game/
URL = 'file://' + P + '/index.html'
LA = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
what = sys.argv[1] if len(sys.argv) > 1 else 'all'
errs = []
VPS = [(1440, 900, False), (390, 844, True)]

def page(p, w, h, touch, hash_=''):
    br = p.chromium.launch(args=LA)
    ctx = br.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
    ctx.add_init_script("try{localStorage.setItem('cc_played','true')}catch(e){}")
    pg = ctx.new_page()
    pg.on('console', lambda m: (m.type == 'error' or (m.type == 'warning' and ('loseContext' in m.text or 'lose_context' in m.text))) and errs.append(f'{w}x{h} console: ' + m.text))
    pg.on('pageerror', lambda e: errs.append(f'{w}x{h} pageerror: ' + str(e)))
    pg.goto(URL + hash_); pg.wait_for_function('window.__game && __game.ready === true', timeout=20000)
    assert pg.evaluate('__game.renderer()') == '3d'
    return br, pg

# 圖鑑盤面（7 列 × 5 欄；HALL 是固定的市政府格）
LAYOUT = [['h0', 'h1', 'pk', 'h0', 'h1'], ['se', 'sr', 'sc', 'st', 'h0'], ['me', 'mr', 'mc', 'mt', 'site'], ['h1', 'se', 'HALL', 'sr', 'pk'],
          ['sc', 'st', 'me', 'mr', 'h0'], ['mc', 'mt', 'h1', 'pk', 'se'], ['h0', 'sr', 'sc', 'st', 'h1']]
SETUP = """(L) => {
  startGame('std', 'art-catalog'); G.paused = true;
  G.bubbles = []; G.queue = []; G.units = []; if (G.repairQ) G.repairQ = []; G.repair = null; G.t = 30; G.stage = 1;
  const K = { e: 'eng', r: 'rescue', c: 'care', t: 'transit' };
  for (const cell of G.cells) {
    const code = L[cell.r][cell.c]; if (code === 'HALL') continue;
    Object.assign(cell, { reveal: null, repairing: false, tut: false, lockUntil: 0, house: false, bld: null });
    if (code === 'site') { cell.state = 'site'; continue; }
    cell.state = 'dev';
    if (code === '--') continue;
    if (code[0] === 'h' || code === 'pk') { cell.house = true; cell.houseV = code === 'pk' ? 2 : +code[1]; }
    else { const st = code[0] === 's', k = K[code[1]]; cell.bld = { type: st ? 'station' : 'booster', color: k, stock: 2, timer: 0, buildLeft: 0, halt: 0, card: (st ? 'st_' : 'bo_') + k }; }
  }
  G.blueprint.done = false; G.blueprint.active = false;
  markAll(); syncDom(true); return G.cells.filter(c => c.state === 'site').length;
}"""

# 棒球場階段：0 A 損壞（城市階段 0）／1 B 整修中（階段 1）／2 C 收尾（階段 2）／3 完工
STAGE = "(st) => { G.blueprint.done = st === 3; G.blueprint.active = false; G.stage = Math.min(st, 2); markAll(); syncDom(true); return __game.state().blueprint; }"
SN = ['A', 'B', 'C', 'done']

def catalog(p, art='hsinchu'):
    out = []
    for (w, h, touch) in VPS:
        tag = f'{w}x{h}'; br, pg = page(p, w, h, touch, '#aoe' if art == 'aoe' else '')
        pre = f'{P}/shots/hc-{art}-{tag}' if art != 'hsinchu' else f'{P}/shots/hc-{tag}'
        assert pg.evaluate(SETUP, LAYOUT) == 1
        for st in (0, 1, 2):
            pg.evaluate(STAGE, st); pg.wait_for_timeout(900); f = pre + f'-catalog-day-wip{SN[st]}.png'; pg.screenshot(path=f); out.append(f)
        pg.evaluate(STAGE, 3); pg.wait_for_timeout(1400)
        pg.screenshot(path=pre + '-catalog-day.png'); out.append(pre + '-catalog-day.png')
        # 夜景：傍晚（局內最暗）＋全部窗燈亮（stage 3）
        pg.evaluate('G.t = 160; G.stage = 3; markAll(); syncDom(true)'); pg.wait_for_timeout(1400)
        pg.screenshot(path=pre + '-catalog-dusk.png'); out.append(pre + '-catalog-dusk.png')
        pg.evaluate('G.paused = false; __game.finish()'); pg.wait_for_timeout(3600)
        pg.evaluate("document.getElementById('resPanel') && document.getElementById('resPanel').classList.add('hide')"); pg.wait_for_timeout(400)
        pg.screenshot(path=pre + '-catalog-night.png'); out.append(pre + '-catalog-night.png')
        br.close()
    return out

CLIP = """(i) => { const r = cellEls[i].getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }"""
def clip(pg, i, kx=0.12, up=0.75, dn=0.08):
    x, y, w, h = pg.evaluate(CLIP, i); vw = pg.viewport_size
    x0, y0 = max(0, x - w * kx), max(0, y - h * up); x1, y1 = min(vw['width'], x + w * (1 + kx)), min(vw['height'], y + h * (1 + dn))
    return {'x': x0, 'y': y0, 'width': x1 - x0, 'height': y1 - y0}

def stadium(p):
    """棒球場（與醫療長照中心）特寫：只放這一棟在 (2,3) 右邊的 (3,3)，其他格空地；desk＝一般遊戲鏡頭，top＝俯角 82°"""
    out = []
    L = [['--'] * 5 for _ in range(7)]; L[3][3] = 'site'; L[5][2] = 'sc'
    for view in ('desk', 'top'):
        br = p.chromium.launch(args=LA)
        ctx = br.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=3)
        ctx.add_init_script("try{localStorage.setItem('cc_played','true')}catch(e){}")
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errs.append('stadium console: ' + m.text)); pg.on('pageerror', lambda e: errs.append('stadium pageerror: ' + str(e)))
        pg.goto(URL); pg.wait_for_function('window.__game && __game.ready === true', timeout=20000); assert pg.evaluate('__game.renderer()') == '3d'
        pg.evaluate(SETUP, L)
        if view == 'top': pg.evaluate('CAM.pitch = 82; layout(); markAll(); syncDom(true)')
        si = 3 * 5 + 3
        for st in range(4):
            pg.evaluate(STAGE, st); pg.wait_for_timeout(1800 if st == 3 else 1300)
            f = f'{P}/shots/hc-stadium-{view}-{SN[st]}.png'; pg.screenshot(path=f, clip=clip(pg, si)); out.append(f)
        f = f'{P}/shots/hc-care-{view}.png'; pg.screenshot(path=f, clip=clip(pg, 5 * 5 + 2)); out.append(f)
        if view == 'desk':
            # 完工亮燈過程：從收尾切到完工，0.35／0.8／1.6 秒各一張
            pg.evaluate(STAGE, 2); pg.wait_for_timeout(600)
            pg.evaluate(STAGE, 3); t0 = pg.evaluate('performance.now()')
            for j, ms in enumerate((350, 800, 1600)):
                pg.wait_for_function(f'performance.now() - {t0} >= {ms}', timeout=10000)
                f = f'{P}/shots/hc-stadium-desk-lightup-{j}.png'; pg.screenshot(path=f, clip=clip(pg, si)); out.append(f)
            pg.evaluate('G.t = 160; G.stage = 3; markAll(); syncDom(true)'); pg.wait_for_timeout(1400)
            f = f'{P}/shots/hc-stadium-desk-dusk.png'; pg.screenshot(path=f, clip=clip(pg, si)); out.append(f)
            pg.evaluate('G.paused = false; __game.finish()'); pg.wait_for_timeout(3600)
            pg.evaluate("document.getElementById('resPanel') && document.getElementById('resPanel').classList.add('hide')"); pg.wait_for_timeout(400)
            f = f'{P}/shots/hc-stadium-night.png'; pg.screenshot(path=f); out.append(f)
        br.close()
    return out

def game(p):
    out = []
    for (w, h, touch) in VPS:
        tag = f'{w}x{h}'; br, pg = page(p, w, h, touch)
        pg.evaluate("startGame('std', 'art-game'); __game.setSpeed(4); window.__ap = setInterval(() => { if (G && G.running && !G.paused) autopilot(); }, 120)")
        pg.wait_for_timeout(16000)
        s = pg.evaluate('__game.state()'); pg.screenshot(path=f'{P}/shots/hc-{tag}-game-mid.png'); out.append([f'{P}/shots/hc-{tag}-game-mid.png', round(s['t'], 1), s['score']])
        pg.evaluate('__game.jump(152)'); pg.wait_for_timeout(1500)
        s = pg.evaluate('__game.state()'); pg.screenshot(path=f'{P}/shots/hc-{tag}-game-late.png'); out.append([f'{P}/shots/hc-{tag}-game-late.png', round(s['t'], 1), s['score']])
        br.close()
    return out

def toggle(p):
    res = {}
    br, pg = page(p, 1440, 900, False, '#debug')
    def click_art(a):
        pg.locator(f'#dbgArt button[data-a="{a}"]').click()
        pg.wait_for_function(f"__game.art() === '{a}' && __game.renderer() === '3d' && !!__game.renderInfo()", timeout=20000)
        pg.wait_for_timeout(600)
        return pg.evaluate("""() => ({ art: __game.art(), rend: __game.renderer(), canvases: document.querySelectorAll('canvas#gl').length,
          visible: !document.getElementById('gl').hidden, defArt: __game.renderInfo().defTris.art, on: document.querySelector('#dbgArt button.on').dataset.a })""")
    seq = []
    seq.append(['title->aoe', click_art('aoe')]); seq.append(['title->hsinchu', click_art('hsinchu')])
    pg.evaluate("startGame('std', 'art-toggle')"); pg.wait_for_timeout(800)
    pg.evaluate('__game.jump(60)'); pg.wait_for_timeout(300)
    seq.append(['game->aoe', click_art('aoe')]); pg.screenshot(path=f'{P}/shots/hc-toggle-aoe.png')
    seq.append(['game->hsinchu', click_art('hsinchu')]); pg.screenshot(path=f'{P}/shots/hc-toggle-hsinchu.png')
    pg.wait_for_timeout(3500)   # context 被丟掉的舊 renderer 若誤觸「掉 context→2D」會在 3 秒後發生
    after = pg.evaluate("({ rend: __game.renderer(), art: __game.art(), paused: G.paused, pauseShown: !document.getElementById('pause').hidden, canvases: document.querySelectorAll('canvas').length, running: G.running })")
    # 2D 下切畫風，再回 3D 要用新畫風
    pg.evaluate("__game.setRenderer('2d')"); pg.wait_for_timeout(300)
    pg.evaluate("__game.setArt('aoe')"); pg.wait_for_timeout(300)
    pg.evaluate("__game.setRenderer('3d')"); pg.wait_for_function("__game.renderer() === '3d' && !!__game.renderInfo()", timeout=20000)
    via2d = pg.evaluate("__game.renderInfo().defTris.art")
    pg.evaluate("__game.setArt('hsinchu')"); pg.wait_for_function("__game.renderInfo() && __game.renderInfo().defTris.art === 'hsinchu'", timeout=20000)
    # 同一 tick 連呼叫兩次（API 重入）：要排隊，最後只剩一個 canvas#gl、畫風是最後那個
    pg.evaluate("__game.setArt('aoe'); window.__ra = __game.setArt('hsinchu')"); pg.evaluate("window.__ra"); pg.wait_for_timeout(2500)
    reent = pg.evaluate("({ gl: document.querySelectorAll('canvas#gl').length, art: __game.art(), def: __game.renderInfo() && __game.renderInfo().defTris.art })")
    br.close()
    ok = all(s[1]['rend'] == '3d' and s[1]['canvases'] == 1 and s[1]['visible'] and s[1]['art'] == s[1]['defArt'] == s[1]['on'] for s in seq) and after['rend'] == '3d' and not after['pauseShown'] and via2d == 'aoe' and reent == {'gl': 1, 'art': 'hsinchu', 'def': 'hsinchu'}
    res = {'seq': seq, 'after3_5s': after, 'switchIn2d_then3d': via2d, 'reentrant': reent, 'ok': ok}
    return res

def info(pg):
    pg.wait_for_timeout(700)
    i = pg.evaluate('__game.renderInfo()')
    return {'tris': i['triangles'], 'calls': i['calls'], 'geometries': i['geometries'], 'defTris': i['defTris']}

def perf(p):
    res = {}
    for (w, h, touch) in VPS:
        tag = f'{w}x{h}'; row = {}
        for art in ('hsinchu', 'aoe'):
            br, pg = page(p, w, h, touch, '#aoe' if art == 'aoe' else '')
            pg.evaluate(SETUP, LAYOUT); pg.evaluate(STAGE, 3)
            r = {'catalog': info(pg)}
            pg.wait_for_timeout(3000); r['catalog_steady'] = info(pg)   # 完工演出（煙火、亮燈光暈）結束後的常態
            pg.evaluate("startGame('std', 'art-perf'); __game.jump(40)"); r['game_0_40'] = info(pg)
            pg.evaluate("__game.jump(110)"); r['game_1_50'] = info(pg)
            row[art] = r; br.close()
        res[tag] = row
    return res

CLICK = """([code, touch]) => {
  const L = []; for (let r = 0; r < 7; r++) L.push(['--', '--', '--', '--', '--']);
  if (code !== 'HALL') L[5][2] = code;
  return L;
}"""
PTS = """([ci, bi]) => {
  const cell = G.cells[ci], top = R3.topOf(cell), br = board.getBoundingClientRect(), up = upNeeded(top);
  const P = (c, r, h) => [br.left + gx(c, r), br.top + gy(c, r, h)];
  const back = G.cells[bi];
  return { top: +top.toFixed(2), up, pts: [
    ['roofTop', P(cell.c, cell.r - 0.1, top * 0.92), ci],
    ['ground', P(cell.c, cell.r + 0.2, CAM.hit), ci],
    // 屋頂伸進後排的那一段：高建築（upNeeded）要算這一格；矮建築這裡是後排地面
    ['backNear', up ? P(cell.c, cell.r - 0.25 - 0.5 * (top - CAM.hit) * AF.hy / AF.by, CAM.hit) : P(cell.c, cell.r - 0.62, CAM.hit), up ? ci : bi],
    ['backFar', P(back.c + 0.25, back.r - 0.35, CAM.hit), bi],
  ] };
}"""

def click(p):
    res = {}; bad = []
    codes = ['h0', 'h1', 'pk', 'se', 'sr', 'sc', 'st', 'me', 'mr', 'mc', 'mt', 'siteA', 'siteB', 'siteC', 'sitedone', 'HALL']
    for (w, h, touch) in VPS:
        tag = f'{w}x{h}'; br, pg = page(p, w, h, touch)
        pg.evaluate("window.__hit = []; document.addEventListener('pointerdown', e => { const el = e.target.closest('.cell,.uphit'); __hit.push(el ? +el.dataset.i : -1); }, { capture: true })")
        rows = {}
        for code in codes:
            L = pg.evaluate(CLICK, ['site' if code.startswith('site') else code, touch])
            pg.evaluate(SETUP, L)
            if code.startswith('site'): pg.evaluate(STAGE, 3 if code == 'sitedone' else SN.index(code[4:]))
            pg.evaluate('G.bubbles = []; markAll(); syncDom(true)'); pg.wait_for_timeout(250)
            ci = 3 * 5 + 2 if code == 'HALL' else 5 * 5 + 2
            g = pg.evaluate(PTS, [ci, ci - 5])
            out = []
            for name, (x, y), exp in g['pts']:
                pg.evaluate('__hit.length = 0')
                if touch: pg.touchscreen.tap(x, y)
                else: pg.mouse.click(x, y)
                got = pg.evaluate('__hit[0] ?? null'); ca = pg.evaluate(f'cellAt({x}, {y})')
                out.append([name, exp, got, ca])
                if got != exp or ca != exp: bad.append([tag, code, name, exp, got, ca])
            rows[code] = {'top': g['top'], 'up': g['up'], 'pts': out}
        res[tag] = rows; br.close()
    return {'rows': res, 'bad': bad, 'ok': not bad}

FEAT = {'HALL': [['flagMid', 0.45, 0.6, 0.1], ['flagLow', 0.45, 0.52, 0.1], ['pole', 0.3, 0.7, 0.1], ['mainTower', 0, 0.85, -0.09], ['sideTower', 0.175, 0.6, 0]],
        # 棒球場四階段（燈頭 box 底 y=0.50、頂蓋到 0.607 → 探 0.55 與 0.60；燈塔 x=±0.27、後排 z=-0.16、前排 z=0.38）
        'siteA': [['tiltPoleTop', -0.18, 0.39, 0.38], ['barePoleTop', 0.27, 0.45, 0.38], ['brokenBoard', 0, 0.14, 0.4], ['cone', 0.065, 0.04, -0.352], ['fence', 0.3, 0.06, 0.458], ['oldBase', 0.184, 0.035, -0.076]],
        'siteB': [['craneTip', 0.27, 0.65, 0.37], ['hangingHead', 0.27, 0.56, 0.37], ['headBL', -0.27, 0.55, -0.16], ['headBLTop', -0.27, 0.6, -0.16], ['headBR', 0.27, 0.55, -0.16], ['headBRTop', 0.27, 0.6, -0.16], ['scaffold', 0.12, 0.2, -0.355], ['craneCab', -0.01, 0.06, 0.2], ['worker', 0.21, 0.09, 0.0]],
        'siteC': [['headBL', -0.27, 0.55, -0.16], ['headBLTop', -0.27, 0.6, -0.16], ['headBR', 0.27, 0.55, -0.16], ['headBRTop', 0.27, 0.6, -0.16], ['headFL', -0.27, 0.55, 0.38], ['headFLTop', -0.27, 0.6, 0.38], ['headFR', 0.27, 0.55, 0.38], ['headFRTop', 0.27, 0.6, 0.38], ['scoreboard', 0, 0.14, 0.4], ['scaffold', 0.25, 0.2, -0.2], ['roller', 0.16, 0.05, 0.1]],
        'sitedone': [['headBL', -0.27, 0.55, -0.16], ['headBLTop', -0.27, 0.6, -0.16], ['headBR', 0.27, 0.55, -0.16], ['headBRTop', 0.27, 0.6, -0.16], ['headFL', -0.27, 0.55, 0.38], ['headFLTop', -0.27, 0.6, 0.38], ['headFR', 0.27, 0.55, 0.38], ['headFRTop', 0.27, 0.6, 0.38], ['scoreboardLED', 0, 0.14, 0.41], ['sideCanopyL', -0.297, 0.16, -0.25], ['sideCanopyR', 0.297, 0.16, -0.25], ['dugout', -0.13, 0.05, -0.26],
                     ['flagBall', -0.12, 0.51, 0.4], ['flagPole', -0.12, 0.45, 0.4], ['flagCloth', -0.01, 0.38, 0.4], ['flagClothTop', -0.01, 0.49, 0.4]],
        # 醫療長照中心
        'sc': [['helipadH', -0.08, 0.435, -0.14], ['parapetFront', 0.1, 0.44, -0.003], ['canopy', -0.12, 0.14, 0.05], ['ambulanceLight', -0.25, 0.1, 0.27], ['roofGarden', 0.27, 0.24, 0.02]],
        'st': [['clock', 0, 0.37, 0.09], ['spire', 0, 0.6, 0], ['canopy', 0.3, 0.18, -0.2]],
        'sr': [['plaque', 0, 0.22, 0.01], ['stall', -0.3, 0.09, 0.27], ['ridge', 0, 0.47, -0.12]],
        'h0': [['gable', 0, 0.62, 0.175]], 'pk': [['pavilion', -0.13, 0.15, -0.03]]}
PROBE = """([ci, feats]) => {
  const cell = G.cells[ci], br = board.getBoundingClientRect();
  return feats.map(([n, x, y, z]) => [n, br.left + gx(cell.c + x, cell.r + z), br.top + gy(cell.c + x, cell.r + z, 0.09 + y)]);
}"""

def feat(p):
    res = {}; bad = []
    for (w, h, touch) in VPS:
        tag = f'{w}x{h}'; br, pg = page(p, w, h, touch)
        pg.evaluate("window.__hit = []; document.addEventListener('pointerdown', e => { const el = e.target.closest('.cell,.uphit'); __hit.push(el ? +el.dataset.i : -1); }, { capture: true })")
        for code, fs in FEAT.items():
            L = pg.evaluate(CLICK, ['site' if code.startswith('site') else code, touch]); pg.evaluate(SETUP, L)
            if code.startswith('site'): pg.evaluate(STAGE, 3 if code == 'sitedone' else SN.index(code[4:]))
            pg.evaluate('G.bubbles = []; markAll(); syncDom(true)'); pg.wait_for_timeout(250)
            ci = 3 * 5 + 2 if code == 'HALL' else 5 * 5 + 2
            for name, x, y in pg.evaluate(PROBE, [ci, fs]):
                pg.evaluate('__hit.length = 0')
                (pg.touchscreen.tap if touch else pg.mouse.click)(x, y); pg.wait_for_timeout(40)
                got = pg.evaluate('__hit[0] ?? null')
                res[f'{tag}-{code}-{name}'] = got
                if got != ci: bad.append([tag, code, name, ci, got])
                pg.evaluate('if (G.recolor && window.closeRecolor) closeRecolor(); if (G.drawer && window.closeDrawer) closeDrawer(false);')
        br.close()
    return {'hits': res, 'bad': bad, 'ok': not bad}

with sync_playwright() as p:
    res = {}
    if what in ('catalog', 'all'): res['catalog'] = catalog(p)
    if what in ('catalog_aoe',): res['catalog_aoe'] = catalog(p, 'aoe')
    if what in ('stadium', 'all'): res['stadium'] = stadium(p)
    if what in ('game', 'all'): res['game'] = game(p)
    if what in ('toggle', 'all'): res['toggle'] = toggle(p)
    if what in ('perf', 'all'): res['perf'] = perf(p)
    if what in ('click', 'all'): res['click'] = click(p)
    if what in ('feat', 'all'): res['feat'] = feat(p)
    res['errors'] = errs
print(json.dumps(res, ensure_ascii=False, indent=1))
