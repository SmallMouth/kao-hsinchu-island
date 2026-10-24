import './life-ui.css';
import { ROLES, DEFAULT_AVATAR } from './city-life.js';

const STORAGE_KEY = 'hsinchu-island-avatar:v1';
const HATS = { none: '無', cap: '便帽', helmet: '安全帽' };
const HAIR_STYLES = { short:'短髮', long:'長髮', bun:'丸子頭', bald:'光頭' };
const OUTFITS = { plain:'一般上衣', vest:'背心', coat:'外套' };
const FACES = { none:'無', glasses:'眼鏡', mask:'口罩' };
const ROLE_PRESETS = {worker:{hat:'helmet',outfit:'vest'},researcher:{outfit:'coat',face:'glasses'},child:{hat:'cap',accessory:'bag'},cyclist:{hat:'helmet'},elder:{face:'glasses'},parent:{outfit:'plain'},traveller:{accessory:'bag'}};
const ACCESSORIES = { none: '無', bag: '背包', umbrella: '雨傘' };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const stateLabel = value => ({ walking:'行走中', moving:'行走中', idle:'停留中', waiting:'停留中', arrived:'已抵達', stopped:'停留中' }[value] || '城市漫步');

function safeAvatar(value) {
  const clean = { ...DEFAULT_AVATAR };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return clean;
  if (typeof value.name === 'string') clean.name = value.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) || DEFAULT_AVATAR.name;
  if (Object.hasOwn(ROLES, value.role)) clean.role = value.role;
  if (Object.hasOwn(HATS, value.hat)) clean.hat = value.hat;
  if (Object.hasOwn(ACCESSORIES, value.accessory)) clean.accessory = value.accessory;
  for (const [key, values] of Object.entries({hairStyle:HAIR_STYLES,outfit:OUTFITS,face:FACES})) if(Object.hasOwn(values,value[key])) clean[key]=value[key];
  for(const key of ['height','width']) if(typeof value[key]==='number' && Number.isFinite(value[key])) clean[key]=Math.min(1.4,Math.max(0.7,value[key]));
  for (const key of ['skin', 'shirt', 'hair', 'pants']) if (typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key])) clean[key] = value[key].toLowerCase();
  return clean;
}

/** Attach controls without changing the content index or its source records. */
export function setupLifeUI({ scene, categories, onCategory }) {
  if (!scene?.getLifeSnapshot) return { dispose() {} };
  const originalCaption = document.querySelector('.scene-caption small')?.textContent;
  const categoryNames = new Map(categories.map(c => [c.id, c.title]));
  const categoryName = id => categoryNames.get(id) || '城市廣場';
  const options = map => Object.entries(map).map(([value,label]) => `<option value="${escape(value)}">${escape(label)}</option>`).join('');
  const destinations = categories.map(category => `<option value="${escape(category.id)}">${escape(category.title)}</option>`).join('');
  let saved;
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw && raw.length < 4096) saved = JSON.parse(raw); } catch { /* Invalid or unavailable local storage falls back to defaults. */ }
  let look = safeAvatar(saved || scene.getLifeSnapshot().avatar?.config);
  let disposed = false, following = null, selectedFlow = null, flowVisible = false, carryVisible = true, logSignature = '';
  scene.setAvatar(look);
  const toolbar = document.createElement('nav');
  toolbar.className = 'life-toolbar';
  toolbar.setAttribute('aria-label', '角色與城市互動');
  toolbar.innerHTML = '<button id="life-character" aria-haspopup="dialog">☺ 角色</button><button id="life-flows" aria-haspopup="dialog">⌁ 協作線</button><button id="life-journal" aria-haspopup="dialog">▤ 日誌</button><button id="life-stop-follow" hidden>結束跟隨 ×</button><button id="life-exit-photo" hidden>離開拍照 ×</button><button id="life-cancel-pick" hidden>取消選點 ×</button>';
  document.querySelector('.city').append(toolbar);
  const q = selector => document.querySelector(selector);
  const dialogs = [];
  const openers = new Map();
  function makeDialog(id, title, eyebrow, content) {
    const dialog = document.createElement('dialog');
    dialog.id = id;
    dialog.className = 'life-dialog';
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.innerHTML = `<button type="button" class="life-close" aria-label="關閉${title}">✕</button><div class="eyebrow">${eyebrow}</div><h2 id="${id}-title">${title}</h2>${content}`;
    document.body.append(dialog);
    dialogs.push(dialog);
    dialog.querySelector('.life-close').onclick = () => dialog.close();
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => { const opener = openers.get(dialog); if (opener?.isConnected) opener.focus(); });
    return dialog;
  }
  function open(dialog) {
    openers.set(dialog, document.activeElement);
    for (const other of dialogs) if (other !== dialog && other.open) other.close();
    if (!dialog.open) dialog.showModal();
    refresh();
  }
  const characterDialog = makeDialog('life-avatar-dialog', '我的城市角色', 'MY CITY CHARACTER', `
    <div class="life-tabs" role="group" aria-label="角色設定頁面"><button data-life-tab="look" aria-pressed="true">外觀</button><button data-life-tab="trip" aria-pressed="false">行程</button><button data-life-tab="photo" aria-pressed="false">拍照</button></div>
    <section id="life-look-panel" aria-label="角色外觀">
      <div class="life-preview" aria-label="角色造型示意"><div class="life-figure"><i class="life-figure-head"></i><i class="life-figure-hair"></i><i class="life-figure-hat"></i><i class="life-figure-body"></i><i class="life-figure-arm left"></i><i class="life-figure-arm right"></i><i class="life-figure-leg left"></i><i class="life-figure-leg right"></i><i class="life-figure-accessory"></i></div><div><strong id="life-preview-name"></strong><small id="life-preview-role"></small><span>造型示意 · 城市角色同步更新</span></div></div>
      <div class="life-form-grid"><label class="life-wide">角色名字<input id="life-name" maxlength="24" autocomplete="off" placeholder="替角色取個名字"></label><label>身分<select id="life-role">${options(ROLES)}</select></label><label>帽子<select id="life-hat">${options(HATS)}</select></label><label>髮型<select id="life-hairStyle">${options(HAIR_STYLES)}</select></label><label>衣款<select id="life-outfit">${options(OUTFITS)}</select></label><label>臉部配件<select id="life-face">${options(FACES)}</select></label><label>隨身配件<select id="life-accessory">${options(ACCESSORIES)}</select></label><div class="life-colors"><label>膚色<input id="life-skin" type="color" aria-label="角色膚色"></label><label>衣色<input id="life-shirt" type="color" aria-label="角色衣色"></label><label>髮色<input id="life-hair" type="color" aria-label="角色髮色"></label><label>褲色<input id="life-pants" type="color" aria-label="角色褲色"></label></div><label>身高<input id="life-height" type="range" min="0.7" max="1.4" step="0.05" aria-label="角色身高"></label><label>體型<input id="life-width" type="range" min="0.7" max="1.4" step="0.05" aria-label="角色體型"></label></div>
      <p class="life-small">切換身分會套用配件預設，之後可自由修改。造型只儲存在這個瀏覽器，不會上傳。</p><div class="life-actions"><button id="life-random">⚄ 隨機造型</button><button id="life-reset-look">重設</button><button class="life-primary" id="life-look-done">完成</button></div>
    </section>
    <section id="life-trip-panel" aria-label="角色行程" hidden>
      <p class="life-description">沿著城市步道走向另一座島，或開啟自動漫遊。角色與路線都是城市探索示意。</p><label class="life-field">前往的主題<select id="life-destination">${destinations}</select></label><div class="life-actions"><button class="life-primary" id="life-depart">出發並跟隨 →</button><button id="life-auto" aria-pressed="false">自動漫遊</button><button id="life-pick">點地圖選目的地</button></div><div class="life-trip-status" role="status" id="life-trip-status"></div><div class="life-actions"><button id="life-follow-avatar" aria-pressed="false">跟隨我的角色</button><button id="life-view-topic">閱讀目的地主題 ↗</button></div><p class="life-small">若全域動畫已暫停，按畫面下方「播放」後角色才會移動。拖曳城市可結束鏡頭跟隨。</p>
    </section><section id="life-photo-panel" aria-label="角色拍照" hidden><p class="life-description">選擇一座島，角色會沿步道走到定點，抵達後擺出指定姿態。拍照模式可收起城市名牌與搬運標籤。</p><label class="life-field">拍照地點<select id="life-photo-destination">${destinations}</select></label><div class="life-form-grid life-photo-options"><label>姿態<select id="life-pose"><option value="stand">站立</option><option value="wave">揮手</option><option value="sit">坐姿</option></select></label><label>面向角度 <output id="life-yaw-output">0°</output><input id="life-yaw" type="range" min="0" max="360" step="15" value="0" aria-label="拍照面向角度"></label></div><div class="life-actions"><button class="life-primary" id="life-pose-go">走到定點並跟隨 →</button><button id="life-photo-clean" aria-pressed="false">收起標記拍照</button></div><p class="life-small">可使用裝置截圖保存畫面；離開拍照後可從行程繼續漫遊。</p></section><div class="life-save-status" id="life-save-status" role="status"></div>`);
  const flowDialog = makeDialog('life-flow-dialog', '把城市連起來', 'CITY CONNECTIONS', `
    <p class="life-description">協作線呈現跨島走訪與搬運動線，點選路線可在城市中高亮查看。</p><div class="life-disclaimer"><b>視覺示意</b>以下路線是互動設計，不代表已查證的政策合作、資源流向或因果關係。</div><div class="life-switches"><button id="life-flow-visible" aria-pressed="false">顯示協作線</button><button id="life-carry-visible" aria-pressed="true">顯示搬運標籤</button></div><div id="life-flow-list" class="life-flow-list"></div><section id="life-flow-detail" hidden></section><button id="life-flow-clear" class="life-clear">清除路線選取</button>`);
  const journalDialog = makeDialog('life-journal-dialog', '城市正在發生的事', 'CITY JOURNAL', `
    <p class="life-description">這是模型中的即時行動紀錄，不是市政事件或真實人流資料。</p><div class="life-tabs" role="group" aria-label="城市日誌頁面"><button data-journal-tab="overview" aria-pressed="true">城市概況</button><button data-journal-tab="log" aria-pressed="false">行動日誌</button></div><section id="life-overview-panel"><div class="life-stats"><div><b id="life-stat-people">0</b><span>城市角色</span></div><div><b id="life-stat-walking">0</b><span>正在行走</span></div><div><b id="life-stat-arrivals">0</b><span>抵達次數</span></div></div><label class="life-field">選擇一位居民<select id="life-person"></select></label><p id="life-person-status" class="life-trip-status"></p><div class="life-actions"><button id="life-follow-person" class="life-primary">跟隨這位居民 →</button><button id="life-release-person">結束跟隨</button></div></section><section id="life-log-panel" hidden><ol id="life-log-list" class="life-log-list"></ol></section>`);

  function showTab(buttons, value, attr, panels) {
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset[attr] === value));
    for (const [key, panel] of Object.entries(panels)) { panel.hidden = key !== value; panel.inert = key !== value; }
  }
  characterDialog.querySelectorAll('[data-life-tab]').forEach(button => button.onclick = () => showTab(characterDialog.querySelectorAll('[data-life-tab]'), button.dataset.lifeTab, 'lifeTab', {look:q('#life-look-panel'),trip:q('#life-trip-panel'),photo:q('#life-photo-panel')}));
  journalDialog.querySelectorAll('[data-journal-tab]').forEach(button => button.onclick = () => { showTab(journalDialog.querySelectorAll('[data-journal-tab]'), button.dataset.journalTab, 'journalTab', {overview:q('#life-overview-panel'),log:q('#life-log-panel')}); refresh(); });
  q('#life-trip-panel').inert = true;
  q('#life-photo-panel').inert = true;
  q('#life-log-panel').inert = true;
  function syncPreview() {
    const preview = q('.life-preview');
    preview.style.setProperty('--avatar-skin', look.skin);
    preview.style.setProperty('--avatar-shirt', look.shirt);
    preview.style.setProperty('--avatar-hair', look.hair);
    preview.style.setProperty('--avatar-pants', look.pants || '#45595a');
    preview.style.setProperty('--avatar-height', look.height || 1);
    preview.style.setProperty('--avatar-width', look.width || 1);
    preview.dataset.hairStyle=look.hairStyle;
    preview.dataset.outfit=look.outfit;
    preview.dataset.face=look.face;
    preview.dataset.hat = look.hat;
    preview.dataset.accessory = look.accessory;
    q('#life-preview-name').textContent = look.name;
    q('#life-preview-role').textContent = ROLES[look.role];
  }
  function syncInputs() { for (const key of Object.keys(DEFAULT_AVATAR)) { const input = q(`#life-${key}`); if(input) input.value = look[key]; } syncPreview(); }
  function applyLook(next) {
    look = safeAvatar(next);
    scene.setAvatar(look);
    syncPreview();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(look)); q('#life-save-status').textContent = '造型已儲存在此瀏覽器'; } catch { q('#life-save-status').textContent = '造型已更新；此瀏覽器目前無法儲存設定。'; }
  }
  for (const key of Object.keys(DEFAULT_AVATAR)) {
    const input = q(`#life-${key}`);
    if (input && key !== 'role') input.addEventListener(key === 'name' || ['skin','shirt','hair','pants','height','width'].includes(key) ? 'input' : 'change', event => applyLook({ ...look, [key]:['height','width'].includes(key)?Number(event.target.value):event.target.value }));
  }
  q('#life-role').onchange=event=>{applyLook({...look,hat:'none',accessory:'none',outfit:'plain',face:'none',role:event.target.value,...ROLE_PRESETS[event.target.value]});syncInputs();};
  q('#life-random').onclick = () => {
    const pick = list => list[Math.floor(Math.random() * list.length)];
    applyLook({...look, skin:pick(['#dfb18b','#f0c9aa','#bd895f','#865b42']), shirt:pick(['#52755e','#ad7058','#7094ad','#caa65a','#a391b0']), hair:pick(['#4d4039','#24272a','#856b4b','#b7b6ac']), hat:pick(Object.keys(HATS)),accessory:pick(Object.keys(ACCESSORIES)),hairStyle:pick(Object.keys(HAIR_STYLES)),outfit:pick(Object.keys(OUTFITS)),face:pick(Object.keys(FACES)),pants:pick(['#45595a','#535568','#9d8970'])});
    syncInputs();
  };
  q('#life-reset-look').onclick = () => { applyLook(DEFAULT_AVATAR); syncInputs(); };
  q('#life-look-done').onclick = () => characterDialog.close();
  const avatarId = () => scene.getLifeSnapshot().people.find(person => person.isAvatar)?.id || 'avatar';
  function follow(id) { following = id; scene.followPerson(id); refresh(); }
  q('#life-depart').onclick = () => { scene.setAvatarAuto(false); scene.moveAvatar(q('#life-destination').value); follow(avatarId()); characterDialog.close(); };
  q('#life-auto').onclick = () => { const enabled = !scene.getLifeSnapshot().avatar?.auto; scene.setAvatarAuto(enabled); if (enabled) { follow(avatarId()); characterDialog.close(); } refresh(); };
  q('#life-follow-avatar').onclick = () => { if(following===avatarId()) follow(null); else {follow(avatarId());characterDialog.close();} };
  q('#life-view-topic').onclick = () => { const id=scene.getLifeSnapshot().avatar?.target || q('#life-destination').value; characterDialog.close(); onCategory?.(id); };
  q('#life-stop-follow').onclick = () => follow(null);
  q('#life-pick').onclick = () => { scene.setPickMode(true); characterDialog.close(); refresh(); };
  q('#life-cancel-pick').onclick = () => { scene.setPickMode(false); refresh(); };
  q('#life-yaw').oninput=event=>q('#life-yaw-output').textContent=`${event.target.value}°`;
  q('#life-pose-go').onclick=()=>{scene.poseAvatar({categoryId:q('#life-photo-destination').value,yaw:Number(q('#life-yaw').value)*Math.PI/180,pose:q('#life-pose').value});follow(avatarId());characterDialog.close();};
  q('#life-photo-clean').onclick=()=>{scene.setPhotoMode(!Boolean(scene.getLifeSnapshot().photoMode));characterDialog.close();refresh();};
  q('#life-exit-photo').onclick=()=>{scene.setPhotoMode(false);refresh();};
  q('#life-follow-person').onclick = () => { follow(q('#life-person').value); journalDialog.close(); };
  q('#life-release-person').onclick = () => follow(null);
  q('#life-person').onchange = refresh;
  const flows = scene.getLifeSnapshot().flows || [];
  q('#life-flow-list').innerHTML = flows.map((flow,index)=>`<button data-life-flow="${escape(flow.id)}" aria-pressed="false"><span>${String(index+1).padStart(2,'0')}</span><b>${escape(flow.title)}</b><small>↗</small></button>`).join('');
  function displayFlow(flow, applyToScene = true) {
    selectedFlow = flow?.id || null;
    if(applyToScene) scene.selectFlow(selectedFlow);
    q('#life-flow-detail').hidden = !flow;
    q('#life-flow-list').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lifeFlow===selectedFlow)));
    if (!flow) return;
    if(applyToScene) { flowVisible = true; scene.setFlowVisible(true); q('#life-flow-visible').setAttribute('aria-pressed','true'); }
    q('#life-flow-detail').innerHTML = `<div class="eyebrow">ROUTE / 示意路線</div><h3>${escape(flow.title)}</h3><p class="life-route">${escape(categoryName(flow.from))}<span>↓</span>${escape(categoryName(flow.to))}</p><p>${escape(flow.description)}</p><p class="life-small">${escape(ROLES[flow.role] || flow.role)} · 搬運：${escape(flow.carry || '城市物資')}</p><p class="life-disclaimer">${escape(flow.basis)}</p><button class="life-primary" id="life-route-view">到城市查看這條線 →</button>`;
    q('#life-route-view').onclick = () => flowDialog.close();
  }
  q('#life-flow-list').querySelectorAll('button').forEach(button=>button.onclick=()=>displayFlow(flows.find(flow=>flow.id===button.dataset.lifeFlow)));
  q('#life-flow-clear').onclick = () => displayFlow(null);
  const onFlowSelect=event=>displayFlow(flows.find(flow=>flow.id===event.detail?.id) || null, false);
  const stage=q('#stage');
  stage.addEventListener('city-flow',onFlowSelect);
  q('#life-flow-visible').onclick = () => {flowVisible=!flowVisible;scene.setFlowVisible(flowVisible);q('#life-flow-visible').setAttribute('aria-pressed',String(flowVisible));};
  q('#life-carry-visible').onclick = () => {carryVisible=!carryVisible;scene.setCarryVisible(carryVisible);q('#life-carry-visible').setAttribute('aria-pressed',String(carryVisible));};
  q('#life-character').onclick = () => { syncInputs(); open(characterDialog); };
  q('#life-flows').onclick = () => open(flowDialog);
  q('#life-journal').onclick = () => open(journalDialog);
  function refresh() {
    if (disposed) return;
    const snapshot = scene.getLifeSnapshot();
    if(Object.hasOwn(snapshot,'flowVisible')) flowVisible=Boolean(snapshot.flowVisible);
    if(Object.hasOwn(snapshot,'carryVisible')) carryVisible=Boolean(snapshot.carryVisible);
    if(Object.hasOwn(snapshot,'selectedFlow') && snapshot.selectedFlow!==selectedFlow) displayFlow(flows.find(flow=>flow.id===snapshot.selectedFlow) || null,false);
    if(q('.scene-caption small')) q('.scene-caption small').textContent = flowVisible ? '協作線為視覺示意，非經查證政策關係' : originalCaption;
    q('#life-flow-visible').setAttribute('aria-pressed',String(flowVisible));
    q('#life-carry-visible').setAttribute('aria-pressed',String(carryVisible));
    if (Object.hasOwn(snapshot,'following')) following = snapshot.following;
    q('#life-stop-follow').hidden = !following;
    q('#life-exit-photo').hidden=!snapshot.photoMode;
    q('#life-cancel-pick').hidden=!snapshot.pickMode;
    q('#life-photo-clean').setAttribute('aria-pressed',String(Boolean(snapshot.photoMode)));
    q('#life-follow-avatar').setAttribute('aria-pressed',String(following===avatarId()));
    q('#life-auto').setAttribute('aria-pressed',String(Boolean(snapshot.avatar?.auto)));
    const target = snapshot.avatar?.target;
    q('#life-trip-status').textContent = `${snapshot.paused ? '動畫已暫停 · ' : ''}${stateLabel(snapshot.avatar?.state)}${target ? ` · 目的地：${categoryName(target)}` : ''}${snapshot.avatar?.auto ? ' · 自動漫遊開啟' : ''}`;
    if (journalDialog.open) {
      q('#life-stat-people').textContent = snapshot.stats?.people ?? snapshot.people.length;
      q('#life-stat-walking').textContent = snapshot.stats?.walking ?? 0;
      q('#life-stat-arrivals').textContent = snapshot.stats?.arrivals ?? 0;
      const select = q('#life-person');
      const ids = snapshot.people.map(person=>person.id).join('|');
      if (select.dataset.ids !== ids) { select.innerHTML=snapshot.people.map(person=>`<option value="${escape(person.id)}">${escape(person.name)} · ${escape(ROLES[person.role] || person.role)}</option>`).join('');select.dataset.ids=ids; }
      for (const option of select.options) { const person=snapshot.people.find(person=>person.id===option.value);option.textContent=`${person.name} · ${ROLES[person.role] || person.role}`; }
      const person=snapshot.people.find(person=>person.id===select.value);
      q('#life-person-status').textContent=person?`${stateLabel(person.state)} · ${categoryName(person.from)} → ${categoryName(person.to)}${person.carry ? ` · 搬運：${person.carry}` : ''}`:'尚無居民資料';
      const logs=snapshot.logs || [];
      const signature=logs.map(log=>log.id).join('|');
      if (logSignature!==signature || !q('#life-log-list').children.length) { logSignature=signature; q('#life-log-list').innerHTML=logs.length ? [...logs].reverse().map(log=>`<li><span>${escape(typeof log.time==='number' ? `${Math.floor(log.time)}s` : log.time)}</span><p>${escape(log.text)}</p></li>`).join('') : '<li class="life-small">角色抵達另一座島時，這裡會留下紀錄。播放動畫後開始觀察。</li>'; }
    }
  }
  syncInputs();
  refresh();
  const interval=setInterval(refresh,500);
  return { dispose() { disposed=true;clearInterval(interval);stage.removeEventListener('city-flow',onFlowSelect);dialogs.forEach(dialog=>dialog.remove());toolbar.remove(); } };
}
