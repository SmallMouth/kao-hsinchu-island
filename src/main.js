import './style.css';
import data from './data.json';
import { createIslandScene } from './scene.js';
import { setupLifeUI } from './life-ui.js';

const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortNames = ['財政與民生','育兒與家庭','敬老與健康','教育與校園','青年與勞工','交通與道路','數位與便民','環境與休閒','產業與市場','警消與防災','文化與觀光','持續推動中'];
const icons = ['▥','♡','✚','▤','✦','⇄','▦','♧','⌂','◇','◉','◷'];
let activeCategory = null;
let filter = 'all';
let scene;
let lifeUI;
let lastFocus;
const mobile = matchMedia('(max-width: 760px)');
function setIndexOpen(open) {
  $('#sidebar').classList.toggle('open', open);
  $('#sidebar').inert = mobile.matches && !open;
  $('#open-index').setAttribute('aria-expanded', String(open));
}
mobile.addEventListener('change', () => setIndexOpen(false));
setIndexOpen(false);
$('.skip-link').onclick = () => { if(mobile.matches) setIndexOpen(true); };
const matches = (item, category) => (filter === 'all' || item.status === filter) && `${category.title}${item.title}${item.description}`.toLocaleLowerCase().includes($('#search').value.trim().toLocaleLowerCase());

function selectCategory(id) {
  activeCategory = activeCategory === id ? null : id;
  scene?.select(activeCategory);
  render();
  if (activeCategory) {
    setIndexOpen(true);
    requestAnimationFrame(() => document.getElementById(`category-${id}`)?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  }
}
function render() {
  const query = $('#search').value.trim();
  let count = 0;
  const html = data.categories.map((category,index) => {
    const items = category.items.filter(item => matches(item, category));
    if (!items.length) return '';
    count += items.length;
    const expanded = activeCategory === category.id || !!query || filter !== 'all';
    return `<section class="category ${expanded?'expanded':''}" id="category-${category.id}"><button class="category-toggle" data-category="${category.id}" aria-expanded="${expanded}" aria-controls="items-${category.id}"><span class="category-no">${String(index+1).padStart(2,'0')}</span><span class="category-name">${shortNames[index]}<small>${escape(category.title)}</small></span><span class="category-count">${items.length}</span><span class="category-arrow">${expanded?'−':'↗'}</span></button><div class="items" id="items-${category.id}" ${expanded?'':'hidden'}>${items.map(item=>`<button class="item" data-item="${item.id}"><span class="item-dot ${item.status}"></span><span>${escape(item.title)}${item.note?'<small class="review-note">資料待核對</small>':''}</span><span class="item-arrow">↗</span></button>`).join('')}</div></section>`;
  }).join('');
  $('#category-list').innerHTML = html || '<div class="empty"><span>⌕</span><h3>沒有符合的項目</h3><p>試試其他關鍵字，或切換狀態篩選。</p><button id="clear-search">清除搜尋與篩選</button></div>';
  $('#list-summary').textContent = query || filter !== 'all' ? `找到 ${count} 項紀錄` : '12 個主題 · 選一座島，閱讀城市紀錄';
  document.querySelectorAll('#category-list [data-category]').forEach(button => button.onclick = () => selectCategory(button.dataset.category));
  document.querySelectorAll('[data-item]').forEach(button => button.onclick = () => showItem(Number(button.dataset.item)));
  if ($('#clear-search')) $('#clear-search').onclick=()=>{ $('#search').value=''; setFilter('all'); };
}
function setFilter(value) {
  filter = value;
  document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===filter)));
  render();
}
function openDialog(dialog) { lastFocus = document.activeElement; dialog.showModal(); }
function showItem(id) {
  const category=data.categories.find(c=>c.items.some(i=>i.id===id));
  const item=category.items.find(i=>i.id===id);
  const index=data.categories.indexOf(category);
  $('#detail-content').innerHTML = `<div class="detail-art" aria-hidden="true"><span>${icons[index]}</span><small>HSINCHU CITY / ${String(id).padStart(2,'0')}</small></div><div class="detail-body"><div class="eyebrow">${escape(shortNames[index])} / ${String(id).padStart(2,'0')}</div><h2 id="detail-title">${escape(item.title)}</h2><span class="status ${item.status}">${item.status==='pending'?'推動中／尚未實施':'資料所列成果'}</span><p class="detail-description">${escape(item.description)}</p>${item.note?`<div class="notice"><b>資料待核對</b><p>${escape(item.note)}</p></div>`:''}<div class="detail-source"><span>資料來源</span><b>施政成果整理.md · 第 ${id} 項</b><p>保留提供檔案原文；推動中項目進度截至 ${data.asOf}，尚未逐項完成外部查證。</p></div></div>`;
  openDialog($('#detail'));
}
$('#search').addEventListener('input',render);
document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>setFilter(button.dataset.filter));
$('#open-index').onclick=()=>{ setIndexOpen(true); $('#search').focus(); };
$('#close-index').onclick=()=>{ setIndexOpen(false); $('#open-index').focus(); };
$('#reset').onclick=()=>{ activeCategory=null; scene?.reset(); render(); };
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>lastFocus?.focus());
}
function info(title,body) { $('#info-content').innerHTML=`<div class="eyebrow">HSINCHU CITY GUIDE</div><h2 id="info-title">${title}</h2>${body}`; openDialog($('#info')); }
$('#help').onclick=()=>info('從一座島，認識一件事。','<p>點選島上的名牌，或右側主題清單，展開施政紀錄；再點選細項閱讀完整原文。</p><ol><li>拖曳畫面旋轉城市，滾輪或雙指縮放。</li><li>使用搜尋與狀態篩選，找到關心的項目。</li><li>切換名牌、鳥瞰、動畫暫停、日照及示意天氣。</li></ol><p>所有文字內容均可從清單以鍵盤操作。城市位置及日照僅為視覺示意。</p>');
$('#sources').onclick=()=>info('資料來源與閱讀說明','<p>本站依使用者提供的「高虹安任內施政成果分類整理」（施政成果整理.md）製作，其中推動中項目進度截至 <b>2026 年 10 月 23 日</b>，其餘保留原文日期。</p><p>共 12 類、90 項。第 1–82 項標為「資料所列成果」，不代表每個子項均已完成；第 83–90 項為「推動中／尚未實施」。空白第 91 項未收錄。</p><p>棒球場賽事（第 3、84 項）、國中乳品補助（第 22、86 項）的敘述有待核對，詳細頁保留提醒。</p><p>原文未附逐項來源連結，本版尚未逐項完成外部查證。模型不是實際地圖，亦不表示工程位置或政策因果關係。</p>');
function toggle(id,callback) { $(id).onclick=()=>{const next=$(id).getAttribute('aria-pressed')!=='true';$(id).setAttribute('aria-pressed',String(next));callback(next);}; }
toggle('#labels',value=>scene?.setLabels(value));
toggle('#topview',value=>scene?.setTopView(value));
toggle('#pause',value=>{scene?.setPaused(value);$('#pause').innerHTML=value?'<span>▷</span>播放':'<span>Ⅱ</span>暫停';});
const weatherModes = [['changing', '晴時多雲'], ['sunny', '晴天'], ['overcast', '陰天']];
let weatherIndex = 0;
$('#weather').onclick = () => {
  weatherIndex = (weatherIndex + 1) % weatherModes.length;
  const [mode, label] = weatherModes[weatherIndex];
  scene?.setWeather(mode);
  $('#weather').textContent = `☁ ${label}`;
  $('#weather').setAttribute('aria-label', `切換示意天氣，目前${label}`);
};
$('#daylight').oninput=event=>{const hour=Number(event.target.value);$('#time-label').textContent=`${String(hour).padStart(2,'0')}:00`;scene?.setTime(hour);};
render();
try {
  scene=createIslandScene($('#stage'),data.categories,selectCategory);
  $('.loading')?.remove();
  lifeUI = setupLifeUI({ scene, categories: data.categories, onCategory: selectCategory });
  if(import.meta.env.DEV) window.__city = scene;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){scene.setPaused(true);$('#pause').setAttribute('aria-pressed','true');$('#pause').innerHTML='<span>▷</span>播放';}
} catch(error) {
  console.error('City rendering unavailable:',error);
  $('#stage').innerHTML='<div class="fallback"><span>竹</span><h2>從清單，探索新竹。</h2><p>此裝置無法顯示 3D 城市，全部 90 項內容仍可使用清單閱讀。</p><button id="fallback-list">開啟成果清單</button></div>';
  $('#fallback-list').onclick=()=>$('#open-index').click();
}
window.addEventListener('pagehide',event=>{ if(!event.persisted) { lifeUI?.dispose(); scene?.dispose(); } });
