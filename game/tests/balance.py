"""數值試算：用 JS 內建的貪婪 AI（同 play.py 策略，反應間隔可調）同步跑多個種子，看各時段需求／產能比、錢、站數、分數。
用法：python3 tests/balance.py [react_sec] [json_overrides]"""
import subprocess, sys, json
from playwright.sync_api import sync_playwright
import os; P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # game/
react = float(sys.argv[1]) if len(sys.argv) > 1 else 0.6
over = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
JS = r"""
([react, over, seeds, mode, lazy]) => {
  const deep = (o, v) => { for (const k in v) { if (typeof v[k] === 'object' && !Array.isArray(v[k])) deep(o[k], v[k]); else o[k] = v[k]; } };
  const base = JSON.parse(JSON.stringify(RULES)); deep(RULES, over);
  const out = [];
  for (const sd of seeds) {
    try { localStorage.setItem('cc_played', 'true'); } catch (e) {}
    startGame(mode, sd); G.fast = true;
    const snaps = {};
    let acc = 0;
    while (G.running) {
      acc += STEP;
      if (acc >= react) { acc = 0; ai(lazy); }
      step(STEP);
      for (const T of [30, 60, 90, 140]) if (!snaps[T] && G.t >= T) snaps[T] = { money: Math.round(G.money), st: stations().length, dev: devCount(), bo: boosters().length };
    }
    const ph = {}; for (const k in G.tele.phase) ph[k] = [G.tele.phase[k].ratio, G.tele.phase[k].missRate];
    out.push({ fw: G.tele.fwStart, bw: G.tele.bossWaves.map(w => [w.n, w.end != null ? +(w.end - w.start).toFixed(1) : null, w.all]), seed: sd, score: G.result.score, missRate: G.result.missRate, catches: G.result.catches, waves: G.result.wavesCaught, ph, snaps });
  }
  deep(RULES, base);
  return out;
  function ai(lazy) {
    if (G.drawer) {
      if (G.drawer.placing != null) { const o = placeOptions(G.drawer.cards[G.drawer.placing].card.color)[0]; if (o) placeAt(o.i); else cancelPlacement(); return; }
      const lack = mostLacking(), fc = forecastColors(); let best = -1, bs = 0;
      G.drawer.cards.forEach((x, i) => { if (G.money < x.cost) return; let sc = 0; const mine = stations(x.card.color).length;
        if (x.card.type === 'station') { sc = x.card.color === lack ? 3 : fc.includes(x.card.color) ? 2 : 1; if (!mine) sc += 1.5; }
        else if (x.card.type === 'booster' && mine >= 2) sc = 1.5;
        if (sc > bs) { bs = sc; best = i; } });
      if (best >= 0) pickCard(best); else closeDrawer(false); return;
    }
    if (G.recolor) { closeRecolor(); return; }
    for (const b of G.bubbles.slice().sort((a, z) => a.left - z.left)) if (b.positive || canServeAny(b)) tapBubble(b.id);
    if (G.blueprint.active) cellTap(G.cells.find(c => c.state === 'site').i);
    if (G.boss.active && !G.boss.mobilized && capTotal() && (prodStock() <= capTotal() / 3)) mobilize(false);
    const plots = G.cells.filter(c => isPlot(c) && G.t >= c.lockUntil);
    const stLimit = lazy ? 99 : 99;
    if (plots.length && G.money >= stationPrice() && G.t < 150 && stations().length < stLimit) { cellTap(plots[0].i); return; }
    if (!G.repair || !G.repairQ.length) {
      if (G.t < 140 && devCount() < (lazy ? 20 : 20)) {
        const rc = G.cells.filter(c => repairable(c) && !isQueued(c)).sort((a, b) => repairCost(a) - repairCost(b) || man(a, G.cells[17]) - man(b, G.cells[17]));
        const reserve = plots.length ? 25 : 20;
        if (rc[0] && G.money >= repairCost(rc[0]) + (repairCost(rc[0]) ? reserve : 0)) cellTap(rc[0].i);
      }
    }
  }
}
"""
seeds = ['s1', 's2', 's3', 's4', 's5', 's6']
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto('file://' + P + '/index.html'); pg.wait_for_timeout(300)
    for mode in (sys.argv[3].split(',') if len(sys.argv) > 3 else ['std']):
        res = pg.evaluate(JS, [react, over, seeds, mode, False])
        avg = lambda f: round(sum(f(r) for r in res) / len(res), 2)
        print(mode, 'react', react, 'over', over)
        print('  fwStart', avg(lambda r: r['fw'] or 0), 'bossWaves(n,dur,all)', [r['bw'] for r in res][:4])
        print('  score', avg(lambda r: r['score']), [r['score'] for r in res], 'catches', avg(lambda r: r['catches']), 'miss', avg(lambda r: r['missRate']), 'waves', avg(lambda r: r['waves']))
        for k in ['p1', 'p2', 'p3', 'boss']:
            print('  ', k, 'ratio', avg(lambda r: r['ph'].get(k, [0, 0])[0] or 0), 'miss', avg(lambda r: r['ph'].get(k, [0, 0])[1] or 0))
        for T in ['30', '60', '90', '140']:
            print('   t', T, 'money', avg(lambda r: r['snaps'][T]['money']), 'st', avg(lambda r: r['snaps'][T]['st']), 'dev', avg(lambda r: r['snaps'][T]['dev']), 'bo', avg(lambda r: r['snaps'][T]['bo']))
    b.close()
