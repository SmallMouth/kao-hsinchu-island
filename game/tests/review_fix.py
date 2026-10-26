"""審查修正的版面與規則檢查：大字標題／抽屜／庫存列、擺放模式、改色框、結算第一屏、齒輪隱藏、教學地點、固定牌不丟、教學點偏不扣錢"""
import subprocess, sys, json
from playwright.sync_api import sync_playwright
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _r import LA, goto, R as RENDERER
import os; P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # game/
URL = 'file://' + P + '/index.html'
LARGE = "(function(){ const f=()=>{document.documentElement.style.fontSize='150%'}; if (document.documentElement) f(); else new MutationObserver((m,o)=>{ if(document.documentElement){ f(); o.disconnect(); } }).observe(document,{childList:true}); })()"
out = {}; errs = []
def page(p, w, h, touch=True, large=False, played=False):
    br = p.chromium.launch(args=LA); ctx = br.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
    if large: ctx.add_init_script(LARGE)
    if played: ctx.add_init_script("try{localStorage.setItem('cc_played','true')}catch(e){}")
    pg = ctx.new_page()
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text)); pg.on('pageerror', lambda e: errs.append(str(e)))
    goto(pg, URL); pg.wait_for_timeout(350)
    return br, pg
def sh(pg, name): pg.screenshot(path=f'{P}/shots/fix_{name}.png')
with sync_playwright() as p:
    # 1. 大字標題 360x640
    br, pg = page(p, 360, 640, large=True)
    sh(pg, 'L360_title')
    out['L_title'] = pg.evaluate("""(() => { const h=document.querySelector('#title h1').getBoundingClientRect(); const a=document.getElementById('btnRelax'), b=document.getElementById('btnStd');
      return { h1Top: h.top, relaxOverflow: a.scrollHeight - a.clientHeight, stdOverflow: b.scrollHeight - b.clientHeight, defRelax: a.classList.contains('def'), sw: document.documentElement.scrollWidth - innerWidth }; })()""")
    # 大字抽屜（悠閒，1:35 點空地）
    pg.evaluate("__game.start('relax')"); pg.evaluate('__game.jump(95)')
    s = pg.evaluate('__game.state()'); pl = [c for c in s['cells'] if c['plot'] and not c['locked']]
    if pl:
        pg.evaluate("G.money = 300")
        pg.evaluate(f"__game.tapCell({pl[0]['c']},{pl[0]['r']})"); pg.wait_for_timeout(300); sh(pg, 'L360_drawer')
        out['L_drawer'] = pg.evaluate("""(() => { const d=document.getElementById('drawer'); const c=[...document.querySelectorAll('#dCards .card')];
          return { scrollOver: d.scrollHeight - d.clientHeight, cardsClipped: c.some(e => e.scrollHeight > e.clientHeight + 1), titleOneLine: document.getElementById('dTitle').getBoundingClientRect().height < 40, closeW: document.getElementById('dClose').getBoundingClientRect().width }; })()""")
        pg.evaluate('__game.closeDrawer()')
    # 大字 Boss：動員鈕與庫存列
    pg.evaluate('__game.jump(146)'); pg.wait_for_timeout(300)
    pg.evaluate("for (const c of stations()) c.bld.stock = 0; G.boss.mobilized=false"); pg.wait_for_timeout(200)
    sh(pg, 'L360_boss')
    out['L_boss'] = pg.evaluate("""(() => { const m=document.getElementById('btnMob').getBoundingClientRect(); const sk=[...document.querySelectorAll('.sk')].map(e=>e.getBoundingClientRect());
      const row=document.getElementById('hScore').parentNode;
      return { mobVisible: !document.getElementById('btnMob').hidden, mobIn: m.left>=0&&m.right<=innerWidth&&m.bottom<=innerHeight&&m.top>=0, overlap: sk.some(q => q.right>m.left+1&&q.left<m.right-1&&q.bottom>m.top+1&&q.top<m.bottom-1), skInView: sk.every(q=>q.right<=innerWidth), hudClip: row.scrollWidth>row.clientWidth+1, sw: document.documentElement.scrollWidth - innerWidth }; })()""")
    br.close()
    # 2. 標準（第二局）390x844：齒輪隱藏、擺放模式數字、改色框、抽屜避開泡泡、toast 位置
    br, pg = page(p, 390, 844, played=True)
    pg.evaluate("__game.start('std')"); pg.wait_for_timeout(200)
    out['gear_hidden'] = pg.evaluate("document.getElementById('btnGear').hidden")
    pg.evaluate('__game.jump(70)')
    pg.evaluate("""(() => { G.money = 500; const pl = G.cells.filter(isPlot); if (!pl.length) return; const k = stations()[0].bld.color;
      G.drawer = null; openDrawer(pl[0].i); G.drawer.cards[0] = { card: CARD['bo_' + k], cost: RULES.boosterCost, sug: false }; renderDrawer(); })()""")
    pg.wait_for_timeout(200); sh(pg, 'std390_drawer_booster')
    out['pick_booster'] = pg.evaluate('__game.pickCard(0)'); pg.wait_for_timeout(250); sh(pg, 'std390_placing')
    out['placing_badges'] = pg.evaluate("[...document.querySelectorAll('#lyPlace .pbadge')].map(e => e.textContent)")
    out['cancel_place'] = pg.evaluate('__game.cancelPlace()'); out['after_cancel_drawer_open'] = pg.evaluate('__game.state().drawer.open')
    pg.evaluate('__game.closeDrawer()')
    st = pg.evaluate("(() => { const c = stations().find(c => c.bld.buildLeft <= 0 && !G.bubbles.some(b => b.cell === c.i)); return c ? [c.c, c.r] : null; })()")
    if st:
        out['tap_station'] = pg.evaluate(f'__game.tapCell({st[0]},{st[1]})'); pg.wait_for_timeout(200); sh(pg, 'std390_recolor')
        out['recolor_ui'] = pg.evaluate("[!document.getElementById('tgt').hidden, document.getElementById('rcTitle').textContent]")
        pg.evaluate('__game.closeRecolor()')
    # toast 位置（Boss）
    pg.evaluate('__game.jump(144.6)'); pg.wait_for_timeout(900); sh(pg, 'std390_boss_toast')
    out['toast'] = pg.evaluate("""(() => { const t=document.querySelector('#toast .tst'); if(!t) return null; const cs=[0,1,2,3,4].map(i => document.querySelector(`.cell[data-i="${i}"]`).getBoundingClientRect()); const row1Top=Math.min(...cs.map(c => c.top)), cellH=Math.max(...cs.map(c => c.height)); const r=t.getBoundingClientRect(); return { n: document.querySelectorAll('#toast .tst').length, bottom: r.bottom, boardTop: row1Top, coversRow1: r.bottom > row1Top + 0.5 * cellH }; })()""")
    br.close()
    # 3. 結算第一屏：1440x900 與 360x640
    for (w, h, t) in [(1440, 900, False), (360, 640, True)]:
        br, pg = page(p, w, h, touch=t, played=True)
        pg.evaluate("__game.start('std')"); pg.evaluate('__game.jump(140)'); pg.evaluate('__game.finish()'); pg.wait_for_timeout(3000)
        sh(pg, f'results_{w}x{h}')
        bb = pg.locator('#btnAgain').bounding_box(); out[f'results_{w}'] = {'againBottom': bb['y'] + bb['height'], 'h': h}
        pg.locator('#btnCopy').scroll_into_view_if_needed(); pg.locator('#btnCopy').click(); pg.wait_for_timeout(300)
        out[f'copy_{w}'] = pg.evaluate("document.getElementById('btnCopy').textContent")
        pg.locator('#btnShareImg').click(); pg.wait_for_timeout(300); out[f'sharehint_{w}'] = pg.evaluate("document.getElementById('shareHint').textContent")
        br.close()
    # 4. 規則：教學地點、教學點偏、固定牌不丟、結算後煙火停、localStorage 封鎖仍記得第二局
    br, pg = page(p, 390, 844)
    pg.evaluate("__game.start('std')")
    out['tut_mistap'] = pg.evaluate("[__game.tapCell(1,1), __game.state().money]")
    pg.evaluate("__game.tapCell(2,1)"); pg.evaluate("for (let i=0;i<60*1.7;i++) step(1/60)")
    out['finger_plot'] = pg.evaluate("(() => { const f = fingerTarget(); return f ? +f.dataset.i : null; })()")
    out['open_plot'] = pg.evaluate("__game.tapCell(1,2)"); out['pick_free'] = pg.evaluate('__game.pickCard(0)')
    pg.evaluate("for (let i=0;i<60*9;i++) step(1/60)")
    out['tut_bubbles'] = pg.evaluate("G.bubbles.map(b => ({ev: b.ev, c: G.cells[b.cell].c, r: G.cells[b.cell].r, house: G.cells[b.cell].house, bld: !!G.cells[b.cell].bld}))")
    pg.evaluate("for (let i=0;i<60*5.5;i++) step(1/60)")
    out['tut_bubbles2'] = pg.evaluate("G.bubbles.map(b => ({ev: b.ev, c: G.cells[b.cell].c, r: G.cells[b.cell].r, house: G.cells[b.cell].house, plot: isPlot(G.cells[b.cell])}))")
    # 固定牌：場上補滿 + 延後佔滿時 fx_care 仍要冒
    pg.evaluate('__game.jump(59.4)')
    out['fixed_not_dropped'] = pg.evaluate("""(() => { const free = freeDevCells('').slice(0, 6); while (activeDemand().length < 4 && free.length) createBubble(free.shift().i, ['eng'], { cd: 30, kind: 'small', ev: 'ev_fire', name: 't' });
      if (!G.delayed.length) G.delayed.push({ id: 999, ev: 'ev_fire', at: G.t, lead: 1, cellRule: 'random', cells: null, chip: true, demand: [['rescue']], name: 'x' });
      for (let i=0;i<60;i++) step(1/60); return G.bubbles.some(b => b.ev === 'fx_care'); })()""")
    # 3D（SwiftShader）低幀率時每幀最多走 0.1 秒，2 秒遊戲時間可能要好幾秒牆鐘：等到結算再看煙火是否清掉（判準不變）
    pg.evaluate('__game.jump(178)'); pg.wait_for_function('__game.state().over', timeout=15000); pg.wait_for_timeout(400)
    out['fw_cleared_after_results'] = pg.evaluate("__game.state().over && fwState === null")
    br.close()
    br = p.chromium.launch(args=LA); ctx = br.new_context(viewport={'width': 390, 'height': 844})
    ctx.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } })")
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); goto(pg, URL); pg.wait_for_timeout(300)
    pg.evaluate("__game.start('std')"); pg.evaluate('__game.jump(140)'); pg.evaluate('__game.finish()')
    pg.evaluate("__game.start('std')"); out['ls_blocked_second_run_firstRun'] = pg.evaluate('__game.state().firstRun')
    br.close()
chk = {
 'L_title_not_clipped': out['L_title']['h1Top'] >= 0 and out['L_title']['relaxOverflow'] <= 0 and out['L_title']['stdOverflow'] <= 0,
 'L_drawer_fits': out.get('L_drawer', {}).get('scrollOver', 1) <= 0 and not out['L_drawer']['cardsClipped'] and out['L_drawer']['titleOneLine'],
 'L_boss_mob_ok': out['L_boss']['mobVisible'] and out['L_boss']['mobIn'] and not out['L_boss']['overlap'] and out['L_boss']['skInView'] and out['L_boss']['sw'] <= 0,
 'L_hud_not_clipped': not out['L_boss']['hudClip'],
 'gear_hidden_by_default': out['gear_hidden'],
 'booster_placing_numbers': out['pick_booster'] == 'placing' and len(out['placing_badges']) >= 1 and '%' in out['placing_badges'][0],
 'cancel_place_back_to_cards': out['cancel_place'] and out['after_cancel_drawer_open'],
 'recolor_shows_target': bool(out.get('recolor_ui')) and out['recolor_ui'][0] and '庫存' in out['recolor_ui'][1],
 'toast_single_not_over_board': out['toast'] is not None and out['toast']['n'] == 1 and not out['toast']['coversRow1'],
 'results_cta_first_screen_1440': out['results_1440']['againBottom'] <= 900,
 'results_cta_first_screen_360': out['results_360']['againBottom'] <= 640,
 'tut_mistap_no_charge': out['tut_mistap'][0] == 'tut_first' and out['tut_mistap'][1] >= 60,
 'finger_points_original_plot': out['finger_plot'] == 11,
 'tut_fire_on_house_not_station': any(b['ev'] == 'fx_fire' and b['house'] and not b['bld'] for b in out['tut_bubbles']),
 'tut_pothole_not_on_plot': all(not b['plot'] for b in out['tut_bubbles2'] if b['ev'] == 'fx_pothole') and any(b['ev'] == 'fx_pothole' for b in out['tut_bubbles2']),
 'fixed_card_not_dropped': out['fixed_not_dropped'],
 'fireworks_stop_after_results': out['fw_cleared_after_results'],
 'ls_blocked_remembers_played': out['ls_blocked_second_run_firstRun'] is False,
 'no_errors': not errs,
}
print(json.dumps({'checks': chk, 'detail': out, 'errors': errs}, ensure_ascii=False, indent=1))
