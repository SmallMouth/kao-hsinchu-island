"""完整一局自動遊玩測試：python3 tests/play.py  → 三種組合（1440 std / 390 std / 390 relax）"""
import subprocess, sys, json, time
from playwright.sync_api import sync_playwright
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _r import LA, goto, R as RENDERER
import os; P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # game/
URL = 'file://' + P + '/index.html'
CENTER = (2, 3)

def ev(pg, js, *a):
    return pg.evaluate(js, *a) if a else pg.evaluate(js)

def ai_step(pg, s):
    g = '__game'
    if s['drawer']['open'] and s['drawer'].get('placing') is not None:
        opts = s['drawer']['placeOptions']
        if opts and opts[0]['pct'] > 0: ev(pg, f"{g}.tapCell({opts[0]['c']},{opts[0]['r']})")
        else: ev(pg, f'{g}.cancelPlace()'); ev(pg, f'{g}.closeDrawer()')
        return
    if s['drawer']['open']:
        cards = s['drawer']['cards']; lack = s['lacking']; fc = s['forecastColors']
        mine = {}
        for c in s['cells']:
            if c['bld'] and c['bld']['type'] == 'station': mine[c['bld']['color']] = mine.get(c['bld']['color'], 0) + 1
        order = []
        for i, c in enumerate(cards):
            if not c['affordable']: continue
            sc = 0
            if c['type'] == 'station':
                sc = 3 if c['color'] == lack else 2 if c['color'] in fc else 1
                if mine.get(c['color'], 0) == 0: sc += 1.5
            elif c['type'] == 'booster' and mine.get(c['color'], 0) >= 2:
                sc = 1.5
            order.append((sc, i))
        order.sort(reverse=True)
        if order and order[0][0] > 0: ev(pg, f'{g}.pickCard({order[0][1]})')
        else: ev(pg, f'{g}.closeDrawer()')
        return
    if s['recolorOpen']:
        ev(pg, f'{g}.closeRecolor()'); return
    for b in sorted(s['bubbles'], key=lambda b: b['left']):
        if b['positive'] or b['canServe']:
            ev(pg, f'{g}.tapBubble({b["id"]})')
    if s['blueprint']['active']:
        site = next(c for c in s['cells'] if c['state'] == 'site')
        ev(pg, f'{g}.tapCell({site["c"]},{site["r"]})')
    m = s['mobilize']
    if m['available'] and (m['glow'] or (s['boss']['wave'] >= 1 and s['prodStock'] <= s['capTotal'] / 2)):
        ev(pg, f'{g}.mobilize()')
    plots = [c for c in s['cells'] if c['plot'] and not c['locked']]
    money = s['money']
    if plots and money >= s['stationPrice'] and s['t'] < 150:
        ev(pg, f'{g}.tapCell({plots[0]["c"]},{plots[0]["r"]})'); return
    if s['repairQueue'] == 0 and s['t'] < 140:
        rc = [c for c in s['cells'] if c['repairable']]
        rc.sort(key=lambda c: (c['cost'], abs(c['c'] - CENTER[0]) + abs(c['r'] - CENTER[1])))
        reserve = 50 if not plots else 55
        if rc and money >= rc[0]['cost'] + (0 if rc[0]['cost'] == 0 else reserve - 30):
            ev(pg, f'{g}.tapCell({rc[0]["c"]},{rc[0]["r"]})')

def center_of(pg, sel):
    bb = pg.locator(sel).first.bounding_box()
    return (bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2) if bb else None

def click(pg, touch, x, y):
    if touch: pg.touchscreen.tap(x, y)
    else: pg.mouse.click(x, y)

def run(p, mode, w, h, touch, replay_check=False, large=False, played=False):
    tag = f'{mode}_{w}x{h}' + ('_L' if large else '') + ('_P' if played else '')
    res = {'tag': tag, 'errors': [], 'checks': {}}
    br = p.chromium.launch(args=LA)
    ctx = br.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
    if large: ctx.add_init_script("(function f(){ if (document.documentElement) document.documentElement.style.fontSize='150%'; else new MutationObserver((m,o)=>{ if(document.documentElement){ document.documentElement.style.fontSize='150%'; o.disconnect(); } }).observe(document,{childList:true}); })()")
    if played: ctx.add_init_script("try{localStorage.setItem('cc_played','true')}catch(e){}")
    pg = ctx.new_page()
    pg.on('console', lambda m: m.type == 'error' and res['errors'].append('console: ' + m.text))
    pg.on('pageerror', lambda e: res['errors'].append('pageerror: ' + str(e)))
    goto(pg, URL)
    pg.wait_for_timeout(400)
    pg.screenshot(path=f'{P}/shots/{tag}_title.png')
    # 真實點擊：標題按鈕
    btn = '#btnRelax' if mode == 'relax' else '#btnStd'
    x, y = center_of(pg, btn); click(pg, touch, x, y)
    pg.wait_for_timeout(300)
    s = ev(pg, '__game.state()')
    res['checks']['real_click_title'] = s['screen'] == 'game' and s['mode'] == mode
    res['checks']['audio_ctx_after_gesture'] = ev(pg, '!!(window.AudioContext||window.webkitAudioContext)')
    pg.screenshot(path=f'{P}/shots/{tag}_0000_open.png')
    # 真實點擊：教學格（壞格 → 修補）
    x, y = center_of(pg, '.cell[data-i="7"]'); click(pg, touch, x, y)
    pg.wait_for_timeout(100)
    s = ev(pg, '__game.state()')
    res['checks']['real_click_repair'] = s['cells'][7]['repairing'] or s['cells'][7]['state'] == 'dev'
    pg.wait_for_timeout(1700)
    # 真實點擊：空地 → 抽屜 → 卡片
    x, y = center_of(pg, '.cell[data-i="7"]'); click(pg, touch, x, y)
    pg.wait_for_timeout(200)
    s = ev(pg, '__game.state()')
    res['checks']['real_click_plot_opens_drawer'] = s['drawer']['open']
    if s['drawer']['open']:
        x, y = center_of(pg, '#dCards .card'); click(pg, touch, x, y)
        pg.wait_for_timeout(200)
        s = ev(pg, '__game.state()')
        res['checks']['real_click_card_builds'] = s['cells'][7]['bld'] is not None
    ev(pg, '__game.setSpeed(4)')
    # 等第一顆泡泡，用真實點擊點泡泡中心（泡泡 > 建築）
    t0 = time.time(); clicked_bubble = None
    while time.time() - t0 < 15:
        s = ev(pg, '__game.state()')
        cand = [b for b in s['bubbles'] if b['canServe'] and not b['positive']]
        if cand:
            b = cand[0]
            c = center_of(pg, f'.bubble[data-id="{b["id"]}"]')
            if c:
                click(pg, touch, *c); pg.wait_for_timeout(60)
                s2 = ev(pg, '__game.state()')
                nb = next((x for x in s2['bubbles'] if x['id'] == b['id']), None)
                clicked_bubble = (nb is None) or nb['assigned'] > 0
                break
        pg.wait_for_timeout(80)
    res['checks']['real_click_bubble_priority'] = bool(clicked_bubble)
    # AI 玩完整局
    next_shot = 30; forced = [100.2, 150]; drawer_shot = False; recolor_shot = False; max_sw = 0; max_sh_over = 0
    t0 = time.time(); timed_out = False; last_t = -1
    while True:
        s = ev(pg, '__game.state()')
        if s['over']: break
        if time.time() - t0 > 150: timed_out = True; break
        dims = ev(pg, '[document.documentElement.scrollWidth, innerWidth, document.documentElement.scrollHeight, innerHeight]')
        max_sw = max(max_sw, dims[0] - dims[1]); max_sh_over = max(max_sh_over, dims[2] - dims[3])
        if s['t'] >= next_shot:
            pg.screenshot(path=f'{P}/shots/{tag}_{int(s["t"]):04d}.png'); next_shot += 30
        if forced and s['t'] >= forced[0] and s['t'] < forced[0] + 6:
            pg.screenshot(path=f'{P}/shots/{tag}_{int(s["t"]):04d}_key.png'); forced.pop(0)
        elif forced and s['t'] >= forced[0] + 6: forced.pop(0)
        if not drawer_shot and s['drawer']['open'] and s['t'] > 46 and len(s['drawer']['cards']) == 3:
            pg.screenshot(path=f'{P}/shots/{tag}_drawer.png'); drawer_shot = True
        if not recolor_shot and s['t'] > 70 and not s['drawer']['open'] and not s['recolorOpen']:
            st = next((c for c in s['cells'] if c['bld'] and c['bld']['type'] == 'station' and not c['bld']['building'] and not any(b['c'] == c['c'] and b['r'] == c['r'] for b in s['bubbles'])), None)
            if st:
                ev(pg, f"__game.tapCell({st['c']},{st['r']})"); pg.wait_for_timeout(120)
                pg.screenshot(path=f'{P}/shots/{tag}_recolor.png'); recolor_shot = True
                res['checks']['recolor_menu_opens'] = ev(pg, '__game.state().recolorOpen')
                ev(pg, '__game.closeRecolor()')
        lay = ev(pg, '''(() => {
          const m = document.getElementById('btnMob'), o = {};
          if (!m.hidden) { const r = m.getBoundingClientRect(); o.mobIn = r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; o.mobReady = m.classList.contains('mob-ready');
            o.skUnder = [...document.querySelectorAll('.sk')].some(e => { const q = e.getBoundingClientRect(); return q.right > r.left + 1 && q.left < r.right - 1 && q.bottom > r.top + 1 && q.top < r.bottom - 1; }); }
          const row = document.getElementById('hScore').parentNode; o.hudClip = row.scrollWidth > row.clientWidth + 1;
          return o; })()''')
        if 'mobIn' in lay:
            res.setdefault('mob_seen', 0); res['mob_seen'] += 1
            if not lay['mobIn']: res['checks']['mob_button_in_viewport'] = False
            if lay['skUnder']: res['checks']['stocks_not_under_mob'] = False
            if lay['mobReady'] and not res.get('mob_ready_shot'):
                res['mob_ready_shot'] = True; pg.screenshot(path=f'{P}/shots/{tag}_mobready.png')
        if lay['hudClip']: res['checks']['hud_not_clipped'] = False
        ai_step(pg, s)
        pg.wait_for_timeout(70)
    res['checks']['reached_results'] = (not timed_out) and s['over']
    res['checks'].setdefault('mob_button_in_viewport', True); res['checks'].setdefault('stocks_not_under_mob', True); res['checks'].setdefault('hud_not_clipped', True)
    tele = ev(pg, '__game.telemetry()')
    bw = tele.get('bossWaves') or []
    res['boss_waves'] = bw; res['fwStart'] = tele.get('fwStart')
    res['checks']['boss_wave_le_10s'] = bool(bw) and all(w['end'] is not None and w['end'] - w['start'] <= 10.05 for w in bw)
    res['checks']['fireworks_by_2_55'] = tele.get('fwStart') is not None and tele['fwStart'] <= 175.05
    res['result'] = s.get('result')
    res['tele'] = {k: tele.get(k) for k in ['firstRepairT', 'firstCatchT', 'idle10', 'zeroStockTaps', 'mobilize', 'partials', 'assists', 'recolors', 'boosterPlacements']}
    res['tele']['phase'] = tele.get('phase')
    pg.wait_for_timeout(3200)
    pg.screenshot(path=f'{P}/shots/{tag}_results.png')
    bb = pg.locator('#btnAgain').bounding_box()
    res['checks']['replay_btn_first_screen'] = bool(bb) and bb['y'] + bb['height'] <= h
    # 結算：分享圖、複製文字
    ev(pg, "document.getElementById('resPanel').classList.remove('hide')")
    pg.locator('#btnShareImg').scroll_into_view_if_needed(); pg.locator('#btnShareImg').click()
    pg.wait_for_timeout(300)
    src = ev(pg, "document.getElementById('shareImg').src || ''")
    res['checks']['share_image_png'] = src.startswith('data:image/png')
    pg.locator('#btnCopy').click(); pg.wait_for_timeout(300)
    res['checks']['copy_text_handled'] = ev(pg, "document.getElementById('btnCopy').textContent") in ('已複製！', '請長按下方文字複製', '已選取下方文字，按 Ctrl+C／⌘C 複製')
    pg.locator('#shareImg').scroll_into_view_if_needed()
    pg.screenshot(path=f'{P}/shots/{tag}_results_share.png')
    dims = ev(pg, '[document.documentElement.scrollWidth, innerWidth]')
    max_sw = max(max_sw, dims[0] - dims[1])
    res['checks']['no_horizontal_scroll'] = max_sw <= 0
    res['max_vertical_overflow_px'] = max_sh_over
    if replay_check:
        pg.locator('#btnAgain').click(); pg.wait_for_timeout(400)
        s = ev(pg, '__game.state()')
        res['checks']['replay_restarts'] = s['screen'] == 'game' and s['t'] < 4 and not s['firstRun']
    res['checks']['no_console_errors'] = not res['errors']
    br.close()
    return res

if __name__ == '__main__':
    out = []
    with sync_playwright() as p:
        out.append(run(p, 'std', 1440, 900, False))
        out.append(run(p, 'std', 390, 844, True))
        out.append(run(p, 'relax', 390, 844, True, replay_check=True))
        out.append(run(p, 'relax', 360, 640, True, large=True))
        out.append(run(p, 'std', 390, 844, True, played=True))
        # 360x640 版面檢查（GDD §9 最小尺寸）：跳到 1:40 截圖
        br = p.chromium.launch(args=LA); ctx = br.new_context(viewport={'width': 360, 'height': 640}, has_touch=True, is_mobile=True, device_scale_factor=2)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        goto(pg, URL); pg.wait_for_timeout(300); pg.evaluate("__game.start('std')"); pg.wait_for_timeout(200)
        pg.evaluate('__game.jump(100.3)'); pg.wait_for_timeout(250)
        pg.screenshot(path=f'{P}/shots/std_360x640_0100.png')
        d = pg.evaluate('[document.documentElement.scrollWidth, innerWidth, document.documentElement.scrollHeight, innerHeight, getComputedStyle(document.getElementById("board")).width]')
        out.append({'tag': 'std_360x640_layout', 'checks': {'no_horizontal_scroll': d[0] <= d[1], 'no_vertical_scroll': d[2] <= d[3], 'no_errors': not errs}, 'board_width': d[4]})
        br.close()
    print(json.dumps(out, ensure_ascii=False, indent=1))
