"""測試共用：選 renderer（RENDERER=3d 預設／2d），headless chromium 用 SwiftShader 跑 WebGL，
載入後等畫面決定好（__game.ready），並確認真的是要測的那種畫面（3D 沒有偷偷退回 2D）。"""
import os
R = os.environ.get('RENDERER', '3d').lower()
LA = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

ART = os.environ.get('ART', '').lower()   # ART=aoe：用世紀帝國建築組（預設新竹地標）

def url(u):
    tags = [t for t in ['2d' if R == '2d' else '', 'aoe' if ART == 'aoe' else ''] if t]
    if not tags: return u
    return u + (',' if '#' in u else '#') + ','.join(tags)

def goto(pg, u):
    pg.goto(url(u))
    pg.wait_for_function('window.__game && window.__game.ready === true', timeout=20000)
    got = pg.evaluate('__game.renderer()')
    assert got == R, f'renderer 應為 {R}，實際 {got}'
    if R == '3d':
        assert pg.evaluate("!!document.getElementById('gl') && !document.getElementById('gl').hidden"), '3D canvas 不在畫面上'

# 3D 跑的截圖加前綴 3d-t-，不覆蓋 2D 的基準截圖
from playwright.sync_api import Page, ElementHandle
def _wrap(cls):
    orig = cls.screenshot
    def shot(self, *a, **k):
        if R == '3d' and k.get('path'):
            d, b = os.path.split(k['path']); k['path'] = os.path.join(d, '3d-t-' + b)
        return orig(self, *a, **k)
    cls.screenshot = shot
_wrap(Page); _wrap(ElementHandle)
