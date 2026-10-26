"""棒球場整建主線的實局檢查：python3 tests/stadium_demo.py（RENDERER=2d 跑灰盒）
index.html#demo 讓 AI 示範從開局跑到結算（390×844 全程、1440×900 再跑一次），在城市階段 0／1／2、
藍圖啟動（97%）、完工瞬間（0.3／1.0 秒）、全城亮燈、煙火節、結算各截一張 → shots/stadium-demo-<renderer>-<WxH>-*.png；
同時記錄進度字、toast、log、AI 字幕中跟棒球場有關的文字，並斷言文案與進度序列。
另跑一局「完全不操作」的標準局（時間下限 30→60→97、啟動提示、自動完工 toast）。
python3 tests/stadium_demo.py aoe：世紀帝國組（#demo,aoe）只跑 390×844，斷言維持 97%→100% 與「藍圖／市政廳」文案。"""
import subprocess, sys, json, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _r import LA, R as RENDERER
import os; P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # game/
AOE = len(sys.argv) > 1 and sys.argv[1] == 'aoe'
URL = 'file://' + P + '/index.html#demo' + (',aoe' if AOE else '') + (',2d' if RENDERER == '2d' else '')

POLL = """() => { const s = __game.state(), site = G.cells.find(c => c.state === 'site'), el = site && cellEls[site.i].querySelector('.pct');
  return { t: +s.t.toFixed(1), stage: G.stage, score: Math.round(G.score), bp: s.blueprint, over: s.over, pct: el ? el.textContent : null,
           ws: wipStage(G), top: typeof R3 !== 'undefined' && R3 ? +R3.topOf(site).toFixed(2) : null }; }"""

def run(p, w, h):
    touch = w < 900
    br = p.chromium.launch(args=LA)
    ctx = br.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.goto(URL); pg.wait_for_function('window.__game && __game.ready === true', timeout=30000)
    assert pg.evaluate('__game.renderer()') == RENDERER
    pg.wait_for_function('__game.demoState().active', timeout=15000)
    pg.evaluate("""window.__toasts = []; new MutationObserver(() => { const t = document.getElementById('toast'); if (t && t.textContent) __toasts.push([+G.t.toFixed(1), t.textContent]); })
      .observe(document.getElementById('toast'), { childList: true, subtree: true, characterData: true });""")
    snap = lambda f: open(f, 'wb').write(pg.screenshot())   # 不走 _r 的改名包裝，檔名照寫
    tag = f'{RENDERER}{"-aoe" if AOE else ""}-{w}x{h}'; shots = []; seen = set(); pcts = []; t0 = time.time(); prev = None
    def shot(name, slow=True):
        if slow: pg.evaluate('__game.setSpeed(0.5)'); pg.wait_for_timeout(250)
        f = f'{P}/shots/stadium-demo-{tag}-{name}.png'; snap(f); shots.append([f, pg.evaluate(POLL)])
        if slow: pg.evaluate('__game.setSpeed(3)')
    pg.evaluate('__game.setSpeed(3)')
    while time.time() - t0 < 360:
        o = pg.evaluate(POLL)
        if o['pct'] and (not pcts or pcts[-1][1] != o['pct']): pcts.append([o['t'], o['pct'], o['stage'], o['ws']])
        if o['over']: break
        if 'a' not in seen and o['t'] > 6: shot('1-stageA'); seen.add('a')
        if 'b' not in seen and o['stage'] >= 1: pg.wait_for_timeout(500); shot('2-stageB'); seen.add('b')
        if 'c' not in seen and o['stage'] >= 2 and not o['bp']['active']: pg.wait_for_timeout(500); shot('3-stageC'); seen.add('c')
        if 'slow' not in seen and o['t'] > 128: pg.evaluate('__game.setSpeed(0.5)'); seen.add('slow')   # AI 一啟動就會點，放慢才拍得到 97%
        if 'act' not in seen and o['bp']['active']: f = f'{P}/shots/stadium-demo-{tag}-4-bp97.png'; snap(f); shots.append([f, pg.evaluate(POLL)]); seen.add('act')
        if 'done' not in seen and o['bp']['done']:
            pg.evaluate('__game.setSpeed(0.5)'); t1 = pg.evaluate('performance.now()')
            for j, ms in enumerate((300, 1000)):
                pg.wait_for_function(f'performance.now() - {t1} >= {ms}', timeout=10000)
                f = f'{P}/shots/stadium-demo-{tag}-5-done-{j}.png'; snap(f); shots.append([f, pg.evaluate(POLL)])
            pg.evaluate('__game.setSpeed(3)'); seen.add('done')
        if 'lit' not in seen and o['stage'] >= 3: pg.wait_for_timeout(1500); shot('6-lit'); seen.add('lit')
        if 'boss' not in seen and o['t'] > 150: shot('7-boss'); seen.add('boss')
        pg.wait_for_timeout(60)
    pg.wait_for_timeout(3500)
    f = f'{P}/shots/stadium-demo-{tag}-8-results.png'; snap(f); shots.append([f, None])
    d = pg.evaluate('__game.demoState()')
    out = {
        'pcts': pcts, 'toasts': [x for x in pg.evaluate('__toasts') if '棒球場' in x[1] or '藍圖' in x[1]],
        'log': [l['m'] for l in pg.evaluate('G.log') if '棒球場' in l['m'] or '藍圖' in l['m']],
        'captions': [c['text'] for c in d['captions'] if '棒球場' in c['text'] or '工地' in c['text'] or '藍圖' in c['text']],
        'resBrk': pg.evaluate("document.getElementById('rBrk').textContent"), 'resWall': pg.evaluate("document.getElementById('rWall').textContent"),
        'evName': pg.evaluate("EV.ev_blueprint.name"), 'cardName': pg.evaluate("CARD.bp_site.name"),
        'shots': shots, 'errors': errs,
    }
    br.close(); return out

IDLE_URL = 'file://' + P + '/index.html' + ('#2d' if RENDERER == '2d' else '')
def idle(p):
    """標準局完全不操作：進度字靠時間下限一步步走；t=132 出啟動提示；沒點 → t=140 自動完工，toast 要寫到棒球場"""
    br = p.chromium.launch(args=LA); pg = br.new_page(viewport={'width': 390, 'height': 844}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(IDLE_URL); pg.wait_for_function('window.__game && __game.ready === true', timeout=30000)
    pg.evaluate("__game.start('std')"); pg.wait_for_timeout(300)
    pct = lambda: pg.evaluate("(() => { const s = G.cells.find(c => c.state === 'site'), el = cellEls[s.i].querySelector('.pct'); return [+G.t.toFixed(1), el ? el.textContent : null, G.stage]; })()")
    pg.evaluate("""window.__toasts = []; new MutationObserver(() => { const t = document.getElementById('toast'); if (t && t.textContent) __toasts.push([+G.t.toFixed(1), t.textContent]); })
      .observe(document.getElementById('toast'), { childList: true, subtree: true, characterData: true }); __game.setSpeed(8);""")
    seq = []; t0 = time.time()
    while time.time() - t0 < 120:
        o = pct()
        if o[1] and (not seq or seq[-1][1] != o[1]): seq.append(o)
        if o[0] > 141.5: break
        pg.wait_for_timeout(50)
    out = {'seq': seq, 'score': pg.evaluate('Math.round(G.score)'), 'stage_at_end': pg.evaluate('G.stage'), 'toasts': pg.evaluate('__toasts'),
           'log': [l['m'] for l in pg.evaluate('G.log') if '棒球場' in l['m']], 'errors': errs}
    br.close(); return out

with sync_playwright() as p:
    res = {f'{w}x{h}': run(p, w, h) for (w, h) in ([(390, 844)] if AOE else [(390, 844), (1440, 900)])}
    if not AOE: res['idle'] = idle(p)
print(json.dumps(res, ensure_ascii=False, indent=1))

fails = []
def check(name, ok):
    if not ok: fails.append(name)
for k, r in res.items():
    if k == 'idle': continue
    seq = [x[1] for x in r['pcts']]; ts = [x[1] for x in r['toasts']]; cap = r['captions']
    check(f'{k} no errors', not r['errors'])
    if AOE:
        check(f'{k} pcts 97→100', seq == ['97%', '100%'])
        check(f'{k} toast 藍圖完工', '藍圖完工！煙火節第 1 波 −2' in ts)
        check(f'{k} no 棒球場 text', not any('棒球場' in x for x in ts + r['log'] + cap))
        check(f'{k} log 藍圖完工', '藍圖完工' in r['log'])
        check(f'{k} caption', '點工地補完最後 3% → 煙火節少 2 件' in cap)
        check(f'{k} names', r['evName'] == '藍圖最後 3%' and r['cardName'] == '建設工地')
        check(f'{k} results', '藍圖' in r['resBrk'] and '市政廳 ×' in r['resWall'])
    else:
        check(f'{k} pcts 30→60→97→100', seq == ['30%', '60%', '97%', '100%'])
        check(f'{k} toast 完工', '棒球場整建完工！煙火節第 1 波 −2' in ts)
        check(f'{k} stage toasts name stadium', any(x.endswith('・棒球場 60%') for x in ts) and any(x.endswith('・棒球場 97%') for x in ts))
        check(f'{k} log', '棒球場整建完工' in r['log'])   # 換階段的 log（棒球場整建 60%／97%）在結算時已被 60 筆上限擠掉，改在 idle 局檢查
        check(f'{k} caption', '點棒球場補完最後 3% → 煙火節少 2 件' in cap)
        check(f'{k} names', r['evName'] == '棒球場最後 3%' and r['cardName'] == '棒球場整建')
        check(f'{k} results', '棒球場整建' in r['resBrk'] and '市政府 ×' in r['resWall'] and '藍圖' not in r['resBrk'])
if 'idle' in res:
    r = res['idle']; ts = [x[1] for x in r['toasts']]
    check('idle no errors', not r['errors'])
    sq = r['seq']; check('idle stays stage 0', r['stage_at_end'] == 3 and all(x[2] == 0 for x in sq[:-1]))
    check('idle pct floor', [x[1] for x in sq] == ['30%', '60%', '97%', '100%'] and 74 <= sq[1][0] <= 77 and 111 <= sq[2][0] <= 114 and 139.9 <= sq[3][0] <= 141)
    check('idle start prompt', '棒球場最後 3%！點一下完工' in ts)
    check('idle auto toast', '棒球場整建完工！全城亮燈' in ts)
    check('idle log', r['log'] == ['棒球場整建 60%', '棒球場整建 97%', '棒球場整建完工（自動）'])
    check('idle stage toasts', '棒球場整建進度 60%' in ts and '棒球場整建進度 97%' in ts)
print('FAILED:', fails or 'none')
sys.exit(1 if fails else 0)
