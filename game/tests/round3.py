"""第 3 輪審查回歸：倒數環可見、建議卡、Boss 只算完工站、Boss HUD/晶片、空地被泡泡蓋住、Boss 基準旋鈕"""
import subprocess, sys, json
from playwright.sync_api import sync_playwright
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _r import LA, goto, R as RENDERER
import os; P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # game/
URL = 'file://' + P + '/index.html'
out = {}; errs = []
def page(p, w=390, h=844, touch=True):
    br = p.chromium.launch(args=LA); ctx = br.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
    pg = ctx.new_page()
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text)); pg.on('pageerror', lambda e: errs.append(str(e)))
    goto(pg, URL); pg.wait_for_timeout(300)
    return br, pg
def step(pg, sec):  # 決定性前進
    pg.evaluate(f"__game.jump(G.t + {sec})")
with sync_playwright() as p:
    # 1 倒數環
    br, pg = page(p)
    pg.evaluate("__game.start('std')"); pg.evaluate('__game.jump(62)'); pg.wait_for_timeout(300)
    out['ring'] = pg.evaluate("""(() => { const b=document.querySelector('.bubble:not(.positive)'); if(!b) return 'no bubble';
      const r=b.querySelector('.ring').getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2, r.top+2.5);
      return { top: e && (e.getAttribute('class')||e.tagName), ringZ: getComputedStyle(b.querySelector('.ring')).zIndex }; })()""")
    b = pg.query_selector('.bubble:not(.positive)')
    if b: b.screenshot(path=f'{P}/shots/r3_bubble_ring.png')
    # Boss 畫面：HUD、晶片、金框
    pg.evaluate('__game.jump(146)'); pg.wait_for_timeout(400)
    out['bossHud'] = pg.evaluate("""({ time: document.getElementById('hTime').textContent, chip: document.querySelector('#forecast .chip.boss') ? document.querySelector('#forecast .chip.boss').textContent : null,
      bossBubble: !!document.querySelector('.bubble.boss'), sw: document.documentElement.scrollWidth - innerWidth })""")
    pg.screenshot(path=f'{P}/shots/r3_boss_390.png')
    pg.evaluate('__game.finish()'); br.close()
    # 2 建議卡（悠閒）：重建審查者描述的狀態（2 座救援站、救援庫存 3、工程 0 且無工程站）
    br, pg = page(p)
    pg.evaluate("__game.start('relax')"); pg.evaluate('__game.jump(26)')
    out['suggest'] = pg.evaluate("""(() => {
      const st = stations(); st.forEach((c, j) => { if (j < 2) { c.bld.color = 'rescue'; c.bld.card = 'st_rescue'; c.bld.stock = j ? 1 : 2; } else { c.bld = null; } c.dirty = true; });
      const h = G.cells.find(c => c.hall); for (const k of COLORS) h.hall[k] = 0;
      const plot = G.cells.find(c => isPlot(c));
      const before = { stations: stations().map(c => c.bld.color), stock: stockTotals(), demand: demandColors(), unlocked: unlockedColors() };
      const cards = genCards(plot.i).map(x => [x.card.id, !!x.sug]);
      return { before, suggest: suggestColor(), cards };
    })()""")
    # 再驗：庫存已足時不建議已經很多的色（工程 0 站 → 建議工程）
    br.close()
    # 3 Boss S 只算完工站：第 1 波進行中下單一座站，直接開第 2 波
    br, pg = page(p)
    pg.evaluate("RULES.bossBaseCap = 0"); pg.evaluate("__game.start('std')"); pg.evaluate('__game.jump(146)')
    out['bossS'] = pg.evaluate("""(() => {
      G.money = 999; let plot = G.cells.find(c => isPlot(c));
      if (!plot) { plot = G.cells.find(c => c.house && !G.bubbles.some(b => b.cell === c.i)); plot.house = false; }
      plot.lockUntil = 0; openDrawer(plot.i); const k = G.drawer.cards.findIndex(x => x.card.type === 'station'); pickCard(k);
      const all = stations().length, built = builtStations().length;
      G.boss.gid = null; endWave(0, false);
      return { all, built, n1: G.tele.bossWaves[1].n, expect: Math.max(2, Math.round(built * RULES.bossMul[1])) };
    })()""")
    br.close()
    # 4 空地被泡泡蓋住：真實點擊
    br, pg = page(p)
    pg.evaluate("__game.start('std')"); pg.evaluate('__game.jump(40)')
    res = pg.evaluate("""(() => { let plot=G.cells.find(c=>isPlot(c)&&G.t>=c.lockUntil&&!G.bubbles.some(b=>b.cell===c.i)); if(!plot){ plot=G.cells.find(c=>c.bld&&c.state==='dev'&&!G.bubbles.some(b=>b.cell===c.i)); plot.bld=null; plot.lockUntil=0; plot.dirty=true; }
      for (const c of G.cells) { if (isStation(c)) c.bld.stock=0; if (c.hall) for (const k of COLORS) c.hall[k]=0; }
      const b=createBubble(plot.i, ['care'], { cd: 30, kind:'small', ev:'fx_fire', name:'test' }); G.money=500; return { id: b.id, cell: plot.i }; })()""")
    pg.wait_for_timeout(300)
    el = pg.query_selector(f'.bubble[data-id="{res["id"]}"]'); bb = el.bounding_box()
    pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(300)
    out['plotUnderBubble'] = pg.evaluate("({ drawer: !!G.drawer, drawerCell: G.drawer && G.drawer.cell, zeroTaps: G.tele.zeroStockTaps })")
    out['plotUnderBubble']['expectCell'] = res['cell']
    pg.screenshot(path=f'{P}/shots/r3_plot_under_bubble.png')
    br.close()
    # 5 Boss 基準旋鈕
    br, pg = page(p)
    pg.evaluate("RULES.bossBaseCap = 1"); pg.evaluate("__game.start('std')"); pg.evaluate('__game.jump(146)')
    out['capBase'] = pg.evaluate("({ cap: capTotal(), n0: G.tele.bossWaves[0].n, blueprint: G.blueprint.done })")
    br.close()
print(json.dumps(out, ensure_ascii=False, indent=1)); print('ERRORS', errs)
