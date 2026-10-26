"""AI 自動示範的端到端檢查：python3 tests/demo.py（RENDERER=2d 跑灰盒）
(a) 標題點「看 AI 示範」、(b) index.html#demo 直接進入，各在 1440×900 與 390×844 跑完整一局（×4 加速）；
另跑一次 ×1 的前 40 秒（每 2 秒截圖看游標與字幕），以及連續 3 局的循環（三個種子）。
檢查：機制清單、分數燈數、console error、水平捲動、字幕空白／停滯、自動下一局、換我玩、結束、localStorage 不被寫。"""
import subprocess, sys, json, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _r import LA, R as RENDERER
import os; P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # game/
URL = 'file://' + P + '/index.html'
SHOTS = P + '/shots'
MECH = ['tutorial', 'repair', 'stations4', 'booster', 'partial', 'combo', 'rainAll', 'blueprint', 'boss3', 'mobilize', 'results']

def url(h):
    tags = [x for x in [h, '2d' if RENDERER == '2d' else ''] if x]
    return URL + ('#' + ','.join(tags) if tags else '')

def shot(pg, name):
    # 不走 _r 的改名包裝：檔名固定 demo-<renderer>-<WxH>-<name>.png
    vp = pg.viewport_size
    with open(f"{SHOTS}/demo-{RENDERER}-{vp['width']}x{vp['height']}-{name}.png", 'wb') as f: f.write(pg.screenshot())

def page(p, w, h, ls_seed=False):
    br = p.chromium.launch(args=LA)
    touch = w < 900
    ctx = br.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
    if ls_seed: ctx.add_init_script("try{ if(!sessionStorage.getItem('seeded')){ localStorage.setItem('cc_best_std','777'); sessionStorage.setItem('seeded','1'); } }catch(e){}")
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    return br, pg, errs

def wait_ready(pg):
    pg.wait_for_function('window.__game && window.__game.ready === true', timeout=30000)
    assert pg.evaluate('__game.renderer()') == RENDERER

POLL = """() => { const s = __game.state(), d = __game.demoState();
  const cap = document.getElementById('demoCapT'), m = document.getElementById('btnMob');
  return { t: s.t, over: s.over, screen: s.screen, pending: d.pending, active: d.active, round: d.round, nAct: d.nActions,
    big: s.bubbles.some(b => b.kind === 'big'), boss: s.boss, mob: s.mobilize, placing: s.drawer.open && s.drawer.placing != null,
    capText: cap ? cap.textContent : '', capVisible: !!cap && !document.getElementById('demoCap').hidden,
    curVisible: !document.getElementById('dcur').hidden, sw: document.documentElement.scrollWidth - innerWidth,
    capOp: cap ? +getComputedStyle(cap).opacity : 1, drawer: s.drawer.open,
    capOver: (() => { const c = document.getElementById('demoCap').getBoundingClientRect(), hit = el => { if (!el || el.hidden) return false; const r = el.getBoundingClientRect(); return r.width > 0 && c.left < r.right && r.left < c.right && c.top < r.bottom - 1 && r.top + 1 < c.bottom; };
      return s.drawer.open && (hit(document.getElementById('tgt')) || hit(document.getElementById('stockbar')) || hit(document.getElementById('drawer'))); })() }; }"""

def slow_shot(pg, name, spd):
    pg.evaluate('__game.setSpeed(0.5)'); pg.wait_for_timeout(450); shot(pg, name); pg.evaluate(f'__game.setSpeed({spd})')

def play_round(pg, res, spd=4, shots=True, limit=420):
    """跟著一局示範跑到結算，沿路截關鍵畫面、量水平捲動與字幕"""
    taken = set(); max_sw = 0; blank = 0; t0 = time.time(); last = None; min_op = 1; over_n = 0; drawer_n = 0
    while time.time() - t0 < limit:
        o = pg.evaluate(POLL)
        if o['over']: break
        last = o; max_sw = max(max_sw, o['sw'])
        if o['t'] > 1 and o['capVisible'] and not o['capText'].strip(): blank += 1
        if o['capVisible']: min_op = min(min_op, o['capOp'])
        if o['drawer']: drawer_n += 1; over_n += 1 if o['capOver'] else 0
        if shots:
            if 'open' not in taken and o['t'] >= 1.2: shot(pg, '1open'); taken.add('open')
            if 'card' not in taken and o['pending'] == 'card' and o['t'] > 30: slow_shot(pg, '2card', spd); taken.add('card')
            if 'place' not in taken and (o['pending'] == 'place' or o['placing']): slow_shot(pg, '3booster', spd); taken.add('place')
            if 'rain' not in taken and o['big'] and o['t'] > 101.5: slow_shot(pg, '4rain', spd); taken.add('rain')
            if 'mob' not in taken and o['pending'] == 'mobilize': slow_shot(pg, '5mobilize', spd); taken.add('mob')
            if 'rc' not in taken and o['pending'] == 'recolor': slow_shot(pg, '5recolor', spd); taken.add('rc')
            if 'boss' not in taken and o['boss']['active'] and o['boss']['wave'] >= 0 and o['t'] > 147: shot(pg, '5boss'); taken.add('boss')
        pg.wait_for_timeout(40)
    s = pg.evaluate('__game.state()'); d = pg.evaluate('__game.demoState()'); tele = pg.evaluate('__game.telemetry()')
    caps = d['captions']
    gaps = [caps[i + 1]['c'] - caps[i]['c'] for i in range(len(caps) - 1)] + ([d['capClock'] - caps[-1]['c']] if caps else [])
    ending = [c['text'] for c in caps if c['text'] != '再看一局？'][-1:] 
    res.update({'over': s['over'], 'result': s['result'] and {k: s['result'][k] for k in ['score', 'lamps', 'missRate', 'catches', 'misses', 'maxCombo', 'wavesCaught']},
                'mech': d['mech'], 'nActions': d['nActions'], 'max_sw': max_sw, 'blank_polls': blank, 'caption_max_gap': round(max(gaps), 2) if gaps else None,
                'n_captions': len(caps), 'shots': sorted(taken), 'cap_min_opacity': round(min_op, 2), 'drawer_polls': drawer_n, 'cap_over_drawer_polls': over_n, 'ending_caption': ending, 'tele_demo': tele.get('demo'), 'seed': tele.get('seed'), 'mobilize': tele.get('mobilize')})
    return s, d

def run_full(p, entry, w, h):
    res = {'tag': f'{entry}_{w}x{h}', 'checks': {}}
    br, pg, errs = page(p, w, h, ls_seed=(entry == 'title'))
    ls0 = None
    if entry == 'title':
        pg.goto(url('')); wait_ready(pg); pg.wait_for_timeout(400)
        ls0 = pg.evaluate("[localStorage.getItem('cc_best_std'), localStorage.getItem('cc_played')]")
        shot(pg, '0title')
        bb = pg.locator('#btnDemo').bounding_box()
        res['checks']['demo_btn_in_view'] = bb is not None and bb['y'] + bb['height'] <= h and bb['x'] >= 0
        pg.locator('#btnDemo').click()
        pg.wait_for_function('__game.demoState().active', timeout=5000)
    else:
        pg.goto(url('demo')); wait_ready(pg)
        pg.wait_for_function('__game.demoState().active', timeout=15000)
        ls0 = pg.evaluate("[localStorage.getItem('cc_best_std'), localStorage.getItem('cc_played')]")
        res['checks']['hash_no_audio_before_gesture'] = pg.evaluate('Sfx.ctx === null')
    s = pg.evaluate('__game.state()')
    res['checks']['entered_std_game'] = s['screen'] == 'game' and s['mode'] == 'std'
    res['checks']['demo_ui_visible'] = pg.evaluate("!document.getElementById('demoBar').hidden && !document.getElementById('demoCap').hidden && !document.getElementById('dcur').hidden && document.getElementById('finger').hidden")
    pg.evaluate('__game.setSpeed(4)')
    # 路人亂點棋盤：不會接手、不會傳到棋盤（棋盤上的監聽器收不到），但會開聲音
    pg.wait_for_function('__game.state().t > 8', timeout=60000)
    pg.evaluate("window.__boardHits = 0; document.getElementById('board').addEventListener('pointerdown', () => window.__boardHits++)")
    bb = pg.locator('#boardWrap').bounding_box()
    for fx, fy in [(0.5, 0.5), (0.3, 0.7), (0.7, 0.3)]:
        x, y = bb['x'] + bb['width'] * fx, bb['y'] + bb['height'] * fy
        (pg.touchscreen.tap(x, y) if w < 900 else pg.mouse.click(x, y)); pg.wait_for_timeout(60)
    res['checks']['board_taps_blocked'] = pg.evaluate('window.__boardHits') == 0 and pg.evaluate('__game.demoState().active')
    if entry == 'hash': res['checks']['audio_after_first_tap'] = pg.evaluate('Sfx.ctx !== null')
    s, d = play_round(pg, res)
    res['checks']['reached_results'] = bool(s['over'])
    res['checks']['all_mechanisms'] = all(d['mech'].get(k) for k in MECH)
    res['checks']['caption_never_blank'] = res['blank_polls'] == 0
    res['checks']['caption_gap_le_8s'] = res['caption_max_gap'] is not None and res['caption_max_gap'] <= 8
    res['checks']['caption_never_faded_out'] = res['cap_min_opacity'] >= 0.3
    res['checks']['caption_clear_of_drawer_tgt_stock'] = res['cap_over_drawer_polls'] == 0
    # 最後一句是煙火節收尾（帶結果），不是「沒接完／沒趕上」
    res['checks']['ending_caption_not_failure'] = bool(res['ending_caption']) and res['ending_caption'][0].startswith('煙火節') and not any(x in res['ending_caption'][0] for x in ('沒接完', '沒趕上'))
    res['checks']['tele_demo_true'] = res['tele_demo'] is True
    # 結算：停在夜景＋分數＋「再看一局？」，按鈕改成「換我玩一局」
    pg.wait_for_timeout(3300)
    o = pg.evaluate("""({ next: !document.getElementById('demoNext').hidden, nextTxt: document.getElementById('demoNext').textContent, again: document.getElementById('btnAgain').textContent,
        best: document.getElementById('rBest').textContent, panel: !document.getElementById('resPanel').classList.contains('hide'), cap: __game.demoState().lastCaption,
        share: document.getElementById('rShare').hidden })""")
    shot(pg, '6results')
    res['checks']['results_again_caption'] = o['next'] and '再看一局' in o['nextTxt'] and o['cap'] == '再看一局？' and o['panel']
    res['checks']['results_btn_play_me'] = o['again'] == '換我玩一局' and '示範' in o['best']
    res['checks']['results_share_hidden'] = o['share'] is True
    ls1 = pg.evaluate("[localStorage.getItem('cc_best_std'), localStorage.getItem('cc_played')]")
    res['checks']['localstorage_untouched'] = ls1 == ls0
    res['ls'] = {'before': ls0, 'after': ls1}
    # 循環：約 10 秒後自動開下一局（新種子）
    t_over = time.time()
    try:
        pg.wait_for_function('__game.demoState().round === 2 && __game.state().screen === "game" && __game.state().t < 6', timeout=16000)
        res['checks']['loop_next_round'] = True; res['loop_wait_s'] = round(time.time() - t_over + 3.3, 1)
        res['round2_seed'] = pg.evaluate('__game.telemetry().seed')
        res['checks']['loop_new_seed'] = res['round2_seed'] != res['seed']
    except Exception:
        res['checks']['loop_next_round'] = False
    if entry == 'title':
        # 換我玩：從當下接手，AI 不再出手，之後真的由玩家操作
        pg.evaluate('__game.setSpeed(4)')
        pg.wait_for_function('__game.state().t > 12', timeout=60000)
        pg.locator('#dTake').click(); pg.wait_for_timeout(150)
        n0 = pg.evaluate('__game.demoState().nActions')
        o = pg.evaluate("""({ active: __game.demoState().active, demo: G.demo, take: G.tele.takeover, bar: document.getElementById('demoBar').hidden, cap: document.getElementById('demoCap').hidden,
            cur: document.getElementById('dcur').hidden, spd: __game.state().speed, running: __game.state().running })""")
        pg.evaluate('__game.setSpeed(4)'); pg.wait_for_timeout(2500)
        n1 = pg.evaluate('__game.demoState().nActions')
        shot(pg, '7takeover')
        # 玩家真的點得到：點一格可修的瓦礫（或空地）
        s = pg.evaluate('__game.state()')
        tgt = next((i for i, c in enumerate(s['cells']) if c['repairable'] and c['cost'] <= s['money']), None)
        acted = None
        if tgt is not None:
            pg.evaluate('__game.setSpeed(1)')
            bb = pg.locator(f'.cell[data-i="{tgt}"]').bounding_box(); x, y = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
            pg.mouse.click(x, y) if w >= 900 else pg.touchscreen.tap(x, y); pg.wait_for_timeout(120)
            c = pg.evaluate('__game.state()')['cells'][tgt]
            acted = c['repairing'] or c['state'] == 'dev'
        res['checks']['takeover_stops_ai'] = (not o['active']) and o['demo'] is False and o['take'] is not None and o['bar'] and o['cap'] and o['cur'] and o['running'] and n1 == n0
        res['checks']['takeover_player_controls'] = acted is not False
        res['takeover'] = {'n0': n0, 'n1': n1, 'acted': acted}
        ls2 = pg.evaluate("[localStorage.getItem('cc_best_std'), localStorage.getItem('cc_played')]")
        res['checks']['localstorage_untouched_after_takeover'] = ls2 == ls0
    else:
        # 結束：回標題
        pg.wait_for_timeout(800)
        pg.locator('#dEnd').click(); pg.wait_for_timeout(300)
        o = pg.evaluate("({ screen: __game.state().screen, title: !document.getElementById('title').hidden, active: __game.demoState().active, bar: document.getElementById('demoBar').hidden, cur: document.getElementById('dcur').hidden, dr: document.getElementById('drawer').hidden, mob: document.getElementById('btnMob').hidden })")
        res['checks']['end_returns_title'] = o['screen'] == 'title' and o['title'] and not o['active'] and o['bar'] and o['cur'] and o['dr'] and o['mob']
        ls2 = pg.evaluate("[localStorage.getItem('cc_best_std'), localStorage.getItem('cc_played')]")
        res['checks']['localstorage_untouched_after_end'] = ls2 == ls0
    res['errors'] = errs
    res['checks']['no_console_errors'] = not errs
    res['checks']['no_horizontal_scroll'] = res['max_sw'] <= 0
    br.close()
    return res

def run_x1(p, w, h, secs=40):
    """×1 實速跑前 40 秒，每 2 秒截圖：游標位置、字幕內容"""
    res = {'tag': f'x1_{w}x{h}', 'checks': {}, 'frames': []}
    br, pg, errs = page(p, w, h)
    pg.goto(url('demo')); wait_ready(pg); pg.wait_for_function('__game.demoState().active', timeout=15000)
    # 固定種子重開（日種子每天不同，前 40 秒的動作數會隨種子變；固定後判準才可重現）
    pg.evaluate("__game.demo(true, 1, 'x1-fixed')"); pg.wait_for_function('__game.demoState().active && __game.state().t < 1', timeout=15000)
    res['seed'] = pg.evaluate('__game.telemetry().seed')
    # 「前 40 秒」以示範時鐘計（低幀率的 3D 每幀最多走 0.1 秒，牆鐘 40 秒不一定等於遊戲 40 秒）；截圖仍每 2 秒（牆鐘）一張
    t0 = time.time(); k = 0; curs = set()
    while pg.evaluate('__game.demoState().clock') < secs and time.time() - t0 < secs * 3:
        if time.time() - t0 >= k * 2:
            o = pg.evaluate("""(() => { const c = document.getElementById('dcur'); return { t: __game.state().t, cap: document.getElementById('demoCapT').textContent, cur: c.style.transform, curShown: !c.hidden, pend: __game.demoState().pending, speed: __game.state().speed }; })()""")
            shot(pg, f'x1-{k * 2:02d}s'); res['frames'].append(o); curs.add(o['cur']); k += 1
        pg.wait_for_timeout(50)
    d = pg.evaluate('__game.demoState()')
    acts = d['actions']; ts = [a['t'] for a in acts]
    res['n_actions_40s'] = len(acts)
    res['checks']['speed_x1'] = all(f['speed'] == 1 for f in res['frames'])
    res['checks']['cursor_moves'] = len(curs) >= 5 and all(f['curShown'] for f in res['frames'])
    res['checks']['caption_always_text'] = all(f['cap'].strip() for f in res['frames'])
    res['checks']['captions_change'] = len(set(f['cap'] for f in res['frames'])) >= 6
    res['checks']['ai_acts'] = len(acts) >= 15
    res['errors'] = errs; res['checks']['no_console_errors'] = not errs
    br.close()
    return res

def run_loop3(p, w, h):
    """連續三局（日種子＋輪次）：每局分數、燈數、漏接率、機制覆蓋"""
    res = {'tag': f'loop3_{w}x{h}', 'checks': {}, 'rounds': []}
    br, pg, errs = page(p, w, h)
    pg.goto(url('')); wait_ready(pg)
    day = pg.evaluate('todayStr()')
    sims = {f'{day}-demo{k}': pg.evaluate('s => __game.demoSim(s)', f'{day}-demo{k}') for k in (1, 2, 3)}
    pg.evaluate('__game.demo(true, 4)')
    for rnd in range(1, 4):
        pg.wait_for_function(f'__game.demoState().round === {rnd} && __game.state().screen === "game"', timeout=30000)
        pg.evaluate('__game.setSpeed(4)')
        r = {}; play_round(pg, r, shots=False)
        sm = sims.get(r['seed'], {})
        res['rounds'].append({'round': rnd, 'seed': r['seed'], **(r['result'] or {}), 'missing_mech': [k for k in MECH if not r['mech'].get(k)], 'nActions': r['nActions'], 'caption_max_gap': r['caption_max_gap'],
                              'sim_score': sm.get('score'), 'bossWaves': [w['all'] for w in (sm.get('bossWaves') or [])], 'ending': r['ending_caption']})
    res['checks']['three_rounds_done'] = len(res['rounds']) == 3 and len(set(x['seed'] for x in res['rounds'])) == 3
    res['checks']['mechanisms_every_round'] = all(not x['missing_mech'] for x in res['rounds'])
    res['checks']['live_equals_sim'] = all(x['score'] == x['sim_score'] for x in res['rounds'])
    res['checks']['three_lamps_every_round'] = all(x.get('lamps') == 3 for x in res['rounds'])
    res['ls'] = pg.evaluate("[localStorage.getItem('cc_best_std'), localStorage.getItem('cc_played')]")
    res['checks']['localstorage_untouched'] = res['ls'] == [None, None]
    res['errors'] = errs; res['checks']['no_console_errors'] = not errs
    br.close()
    return res

SIM_SEEDS = [f'2026-10-25-demo{i}' if i <= 3 else f'2026-10-{(i % 28) + 1:02d}-demo{i % 3 + 1}' for i in range(1, 21)] + ['2026-10-26-demo1', '2026-10-26-demo2', '2026-10-26-demo3']

def run_sim(p):
    """不開畫面跑 23 個固定種子：分數、燈數、煙火節接住幾波、最後一波接住率"""
    res = {'tag': 'sim23', 'checks': {}, 'rows': []}
    br, pg, errs = page(p, 1440, 900)
    pg.goto(url('')); wait_ready(pg)
    for sd in SIM_SEEDS:
        x = pg.evaluate('s => __game.demoSim(s)', sd); bw = x['bossWaves'] or []
        res['rows'].append({'seed': sd, 'score': x['score'], 'lamps': x['lamps'], 'missRate': x['missRate'], 'wavesCaught': x['waves'],
                            'finalWaveCaught': bool(len(bw) >= 3 and bw[-1]['all']), 'mobWave': (x['mobilize'] or {}).get('wave'), 'mech_missing': [k for k, v in x['mech'].items() if not v],
                            'ending': [c for c in x['captions'] if '再看' not in c][-1:]})
    rows = res['rows']; n = len(rows)
    res['summary'] = {'avg_score': round(sum(r['score'] for r in rows) / n), 'min_score': min(r['score'] for r in rows), 'three_lamps': sum(r['lamps'] == 3 for r in rows),
                      'final_wave_caught': sum(r['finalWaveCaught'] for r in rows), 'avg_waves': round(sum(r['wavesCaught'] for r in rows) / n, 2), 'n': n}
    res['checks']['final_wave_caught_ge_70pct'] = res['summary']['final_wave_caught'] >= 0.7 * n
    res['checks']['three_lamps_ge_90pct'] = res['summary']['three_lamps'] >= 0.9 * n
    res['checks']['mobilize_on_final_wave'] = all(r['mobWave'] == 2 for r in rows)
    res['errors'] = errs; res['checks']['no_console_errors'] = not errs
    br.close()
    return res

if __name__ == '__main__':
    which = sys.argv[1:] or ['sim', 'full', 'x1', 'loop3']
    out = []
    with sync_playwright() as p:
        if 'sim' in which:
            out.append(run_sim(p))
        if 'full' in which:
            out.append(run_full(p, 'title', 1440, 900))
            out.append(run_full(p, 'hash', 390, 844))
            out.append(run_full(p, 'hash', 1440, 900))
            out.append(run_full(p, 'title', 390, 844))
        if 'x1' in which:
            out.append(run_x1(p, 390, 844))
        if 'loop3' in which:
            out.append(run_loop3(p, 390, 844))
    print(json.dumps(out, ensure_ascii=False, indent=1))
    bad = [f"{r['tag']}.{k}" for r in out for k, v in r['checks'].items() if v is not True]
    print('RENDERER', RENDERER, 'FAILED:', bad or 'none')
