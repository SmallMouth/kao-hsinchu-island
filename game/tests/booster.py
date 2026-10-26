"""加成站與改色的端到端檢查：產速 ×0.67、光環內雙需求 −1（撐住了！）、改色清庫存停產"""
import subprocess, sys, json
from playwright.sync_api import sync_playwright
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _r import LA, goto, R as RENDERER
import os; P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # game/
out = {}
with sync_playwright() as p:
    br = p.chromium.launch(args=LA); pg = br.new_page(viewport={'width': 390, 'height': 844})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    goto(pg, 'file://' + P + '/index.html'); pg.wait_for_timeout(300)
    pg.evaluate("__game.start('std')"); pg.wait_for_timeout(100)
    pg.evaluate('__game.jump(50)')
    # 準備：一座工程站 S 與它旁邊一塊空地 N（測試直接整理格子，其餘走正常 API）
    setup = pg.evaluate("""(() => {
      G.money = 1000;
      const S = G.cells[idx(1,1)], N = G.cells[idx(2,1)];
      for (const c of [S, N]) { c.state = 'dev'; c.house = false; c.bld = null; c.repairing = false; c.reveal = null; c.dirty = true; c.lockUntil = 0; }
      makeBuilding(S, CARD.st_eng, true);
      G.bubbles = G.bubbles.filter(b => b.cell !== N.i && b.cell !== S.i);
      return {S: [S.c, S.r], N: [N.c, N.r]};
    })()""")
    r = pg.evaluate('__game.tapCell(2,1)')
    has = pg.evaluate("__game.state().drawer.cards.map(c=>c.id)")
    if 'bo_eng' not in has:
        pg.evaluate("G.drawer.cards[0] = {card: CARD.bo_eng, cost: RULES.boosterCost, sug: false}; renderDrawer()")
    pv = pg.evaluate("boosterPreview(G.drawer.cell, 'eng')")
    k = pg.evaluate("G.drawer.cards.findIndex(x => x.card.id === 'bo_eng')")
    out['drawer_opened'] = r; out['booster_offered_naturally'] = 'bo_eng' in has; out['preview'] = pv
    out['pick_enters_placing'] = pg.evaluate(f'__game.pickCard({k})')
    out['placing_state'] = pg.evaluate("__game.state().drawer")
    pg.wait_for_timeout(150)
    pg.screenshot(path=P + '/shots/booster_placing.png')
    out['badges'] = pg.evaluate("document.querySelectorAll('#lyPlace .pbadge').length")
    out['place_on_house'] = pg.evaluate('__game.tapCell(1,3)')
    out['pick'] = pg.evaluate('__game.tapCell(2,1)')
    pg.evaluate("for (let i = 0; i < 60 * 3.1; i++) step(1/60)")
    out['aura_mul'] = pg.evaluate("auraMul(G.cells[idx(1,1)])")
    # 產速：清空庫存後計時，6.6 秒應還沒產、6.8 秒應產出 1
    pg.evaluate("(() => { const b = G.cells[idx(1,1)].bld; b.stock = 0; b.timer = 0; })()")
    pg.evaluate("for (let i = 0; i < Math.round(60 * 6.6); i++) step(1/60)")
    s66 = pg.evaluate("G.cells[idx(1,1)].bld.stock")
    pg.evaluate("for (let i = 0; i < Math.round(60 * 0.2); i++) step(1/60)")
    s68 = pg.evaluate("G.cells[idx(1,1)].bld.stock")
    out['produce_6_6s'] = s66; out['produce_6_8s'] = s68
    # 光環內冒雙需求工程泡泡 → 需求 −1
    cell_in = pg.evaluate("""(() => { const bo = G.cells[idx(2,1)]; const c = G.cells.find(c => isDev(c) && cheb(c, bo) <= 1 && c !== bo && !G.bubbles.some(b => b.cell === c.i)); return c ? [c.c, c.r, c.i] : null; })()""")
    out['aura_cell'] = cell_in
    if cell_in:
        pg.evaluate("G.bubbles = []; G.delayed = []")
        pg.evaluate(f"addItem('ev_outage', G.t + 0.05, {{cells: [{cell_in[2]}], lead: 1}})")
        pg.evaluate("for (let i = 0; i < 10; i++) step(1/60)")
        pg.evaluate("syncDom(true)")
        b = pg.evaluate(f"(() => {{ const b = G.bubbles.find(b => b.cell === {cell_in[2]}); return b ? {{needs: b.needs, orig: b.orig, auraBy: b.auraBy}} : null; }})()")
        out['aura_bubble'] = b
        pg.wait_for_timeout(150)
        pg.screenshot(path=P + '/shots/booster_hold.png')
    # 改色：點站 → 選單 → 改成救援
    pg.evaluate("G.cells[idx(1,1)].bld.stock = 2; G.bubbles = G.bubbles.filter(b => b.cell !== idx(1,1))")
    out['tap_station'] = pg.evaluate('__game.tapCell(1,1)')
    out['recolor'] = pg.evaluate("__game.recolor(1,1,'rescue')")
    st = pg.evaluate("__game.state().cells.find(c => c.c === 1 && c.r === 1).bld")
    out['after_recolor'] = st
    pg.evaluate("for (let i = 0; i < 60 * 6.1; i++) step(1/60)")
    out['halt_after_6_1s'] = pg.evaluate("__game.state().cells.find(c => c.c === 1 && c.r === 1).bld.halt")
    out['errors'] = errs
    br.close()
checks = {
  'booster_enters_placing_mode': out['pick_enters_placing'] == 'placing' and out['placing_state']['placing'] is not None and out['badges'] >= 1,
  'placing_rejects_non_plot': out['place_on_house'] == 'not_plot',
  'booster_built': out['pick'] == 'built',
  'aura_mul_0.67': abs(out['aura_mul'] - 0.67) < 1e-9,
  'produce_interval_6.7s': out['produce_6_6s'] == 0 and out['produce_6_8s'] == 1,
  'aura_demand_minus_1': bool(out.get('aura_bubble')) and len(out['aura_bubble']['needs']) == 1 and out['aura_bubble']['orig'] == 2 and out['aura_bubble']['auraBy'] is not None,
  'recolor_clears_and_halts': out['recolor'] == 'recolored' and out['after_recolor']['stock'] == 0 and out['after_recolor']['halt'] and out['after_recolor']['color'] == 'rescue',
  'halt_ends_after_6s': out['halt_after_6_1s'] is False,
  'no_errors': not out['errors'],
}
print(json.dumps({'checks': checks, 'detail': out}, ensure_ascii=False, indent=1))
