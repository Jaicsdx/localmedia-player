(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // Elements
  const els = {
    body: document.body,
    hamburger: $('#hamburger'),
    sidebar: $('#sidebar'),

    // mode & panes
    cloudMode: $('#cloudMode'),
    localMode: $('#localMode'),
    cloudControls: $('#cloudControls'),
    localControls: $('#localControls'),

    // inputs / buttons
    name: $('#movieName'),
    link: $('#movieLink'),
    addBtn: $('#addBtn'),
    updateBtn: $('#updateBtn'),
    cancelEditBtn: $('#cancelEditBtn'),
    exportBtn: $('#exportBtn'),
    importFile: $('#importFile'),
    clearBtn: $('#clearBtn'),
    search: $('#searchInput'),
    clearSearch: $('#clearSearchBtn'),
    status: $('#status'),
    grid: $('#movies'),

    // players
    cloudPlayer: $('#cloudPlayer'),
    localPlayer: $('#localPlayer'),
    stage: $('#stage'),
    nowPlaying: $('#nowPlaying'),
    fullscreenBtn: $('#fullscreenBtn'),
    stopBtn: $('#stopBtn'),
    playError: $('#playError'),

    // local files
    localPicker: $('#localPicker'),
    dropZone: $('#dropZone'),
    localList: $('#localList'),
  };

  // App state
  const storeKey = 'omp_movies_v1';
  const uiPrefsKey = 'omp_ui_prefs_v1';
  const state = {
    movies: [],
    mode: 'remote',         // 'remote' when movies.json is present, otherwise 'local-store'
    editingId: null,
    uiMode: 'cloud',        // 'cloud' | 'local'
    localFiles: [],
    prefs: { collapsed: false }
  };

  // ---- Sidebar hamburger (mobile overlay; desktop optional collapse) ----
  function applyCollapsed(){
    if (state.prefs.collapsed) document.body.classList.add('nav-collapsed');
    else document.body.classList.remove('nav-collapsed');
  }
  function loadPrefs(){
    try{
      const raw = localStorage.getItem(uiPrefsKey);
      if (raw) state.prefs = { ...state.prefs, ...JSON.parse(raw) };
    }catch{}
    applyCollapsed();
  }
  function savePrefs(){
    localStorage.setItem(uiPrefsKey, JSON.stringify(state.prefs));
  }

  els.hamburger.addEventListener('click', () => {
    // On mobile: toggle overlay; on desktop: toggle collapsed
    const isMobile = matchMedia('(max-width: 960px)').matches;
    if (isMobile) {
      const open = document.body.classList.toggle('nav-open');
      els.hamburger.setAttribute('aria-expanded', String(open));
    } else {
      state.prefs.collapsed = !state.prefs.collapsed;
      applyCollapsed();
      savePrefs();
    }
  });

  // Close sidebar overlay when clicking backdrop on mobile
  document.addEventListener('click', (e) => {
    const isMobile = matchMedia('(max-width: 960px)').matches;
    if (!isMobile) return;
    if (document.body.classList.contains('nav-open')) {
      const insideSidebar = e.target.closest('#sidebar') || e.target.closest('#hamburger');
      if (!insideSidebar) {
        document.body.classList.remove('nav-open');
        els.hamburger.setAttribute('aria-expanded', 'false');
      }
    }
  });

  // ---- Utils ----
  function escapeHtml(s){
    return String(s).replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // OneDrive link normalization
  function normalizeOneDriveLink(input){
    if(!input) throw new Error('Empty link');
    let link = input.trim();
    // Extract iframe src= if provided
    const m = link.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*><\/iframe>/i) || link.match(/src=["']([^"']+)["']/i);
    if(m && m[1]) link = m[1];
    try{
      const u = new URL(link);
      if(u.hostname.includes('onedrive.live.com')){
        if(u.pathname.includes('/embed')) return link;
        const resid = u.searchParams.get('resid');
        const auth = u.searchParams.get('authkey');
        if(resid){
          const embed = new URL('https://onedrive.live.com/embed');
          embed.searchParams.set('resid', resid);
          if(auth) embed.searchParams.set('authkey', auth);
          embed.searchParams.set('em','2');
          return embed.toString();
        }
      }
    }catch(e){}
    if(/(^|\.)1drv\.ms\b/.test(link)){
      throw new Error('Short 1drv.ms links cannot be auto-converted. In OneDrive use **Embed**.');
    }
    return link;
  }

  function saveLocal(){ localStorage.setItem(storeKey, JSON.stringify(state.movies)); }
  function loadLocal(){
    try{ const raw = localStorage.getItem(storeKey); return raw ? JSON.parse(raw) : []; }
    catch{ return []; }
  }

  async function loadRemoteJSON(){
    try{
      const res = await fetch('movies.json', {cache:'no-store'});
      if(!res.ok) throw new Error('no file');
      const arr = await res.json();
      if(!Array.isArray(arr)) throw new Error('bad format');
      state.mode = 'remote';
      return arr;
    }catch(e){
      state.mode = 'local-store';
      return null;
    }
  }

  function renderStatus(){
    if(els.status){
      els.status.innerHTML = state.mode === 'remote'
        ? 'Using shared <kbd>movies.json</kbd> from your site.'
        : 'Using local browser storage. Export JSON to make it permanent on GitHub.';
    }
  }

  function renderMovies(){
    const q = (els.search?.value || '').trim().toLowerCase();
    const list = state.movies.filter(m => m.name.toLowerCase().includes(q));
    els.grid.innerHTML = list.map(m => `
      <div class="movie" data-id="${m.id}">
        <div class="thumb">16:9</div>
        <div class="body">
          <div class="title">${escapeHtml(m.name)}</div>
          <div class="stack">
            <span class="tag">${new Date(m.addedAt||Date.now()).toLocaleDateString()}</span>
          </div>
          <div class="stack">
            <button class="btn small" data-action="play">Play</button>
            <button class="btn small secondary" data-action="edit">Edit</button>
            <button class="btn small red" data-action="remove">Delete</button>
          </div>
        </div>
      </div>`).join('') || `<div class="hint" style="padding:12px">No movies yet. Add one on the left.</div>`;
  }

  function playCloud(m){
    hideLocal();
    els.cloudPlayer.classList.remove('invisible');
    els.cloudPlayer.src = m.url;
    els.nowPlaying.textContent = 'Now Playing (Cloud): ' + m.name;
  }

  function stopPlayback(){
    els.cloudPlayer.src = 'about:blank';
    els.localPlayer.pause();
    els.localPlayer.removeAttribute('src');
    els.localPlayer.load();
    els.nowPlaying.textContent = 'Nothing playing';
    els.playError.textContent = '';
  }

  function startEdit(m){
    state.editingId = m.id;
    els.name.value = m.name;
    els.link.value = m.url;
    els.addBtn.disabled = true;
    els.updateBtn.disabled = false;
    els.cancelEditBtn.disabled = false;
    // On mobile, open sidebar if closed so user sees fields
    if (matchMedia('(max-width: 960px)').matches) {
      document.body.classList.add('nav-open');
      els.hamburger.setAttribute('aria-expanded','true');
    }
  }

  function clearEditor(){
    state.editingId = null;
    els.name.value = '';
    els.link.value = '';
    els.addBtn.disabled = false;
    els.updateBtn.disabled = true;
    els.cancelEditBtn.disabled = true;
  }

  // ---------- LOCAL PLAYBACK ----------
  function showLocal(){
    els.cloudControls.classList.add('invisible');
    els.localControls.classList.remove('invisible');
    els.cloudPlayer.classList.add('invisible');
    els.localPlayer.classList.remove('invisible');
    state.uiMode = 'local';
  }
  function hideLocal(){
    els.localPlayer.classList.add('invisible');
    els.cloudPlayer.classList.remove('invisible');
    els.localControls.classList.add('invisible');
    els.cloudControls.classList.remove('invisible');
    state.uiMode = 'cloud';
  }

  function listLocalFiles(files){
    state.localFiles = files;
    els.localList.innerHTML = files.map((f, i)=>`
      <div class="local-item" data-i="${i}">
        ${escapeHtml(f.name)}
      </div>
    `).join('') || `<div class="hint">No local files selected yet.</div>`;
  }

  function guessMime(file){
    if(file.type) return file.type;
    const ext = file.name.toLowerCase().split('.').pop();
    const map = {
      mp4:'video/mp4', m4v:'video/mp4', mov:'video/quicktime',
      webm:'video/webm', mkv:'video/x-matroska', avi:'video/x-msvideo'
    };
    return map[ext] || 'video/*';
  }

  function canBrowserPlay(mime){
    const v = document.createElement('video');
    return !!v.canPlayType(mime);
  }

  function playLocalFile(file){
    els.playError.textContent = '';
    const mime = guessMime(file);
    if(!canBrowserPlay(mime) && /\.mkv$/i.test(file.name)){
      els.playError.textContent = 'Heads up: Your browser might not support some MKV codecs. If playback fails, cast the tab or open in VLC.';
    }
    const url = URL.createObjectURL(file);
    els.localPlayer.src = url;
    els.localPlayer.play().catch(()=>{ /* gesture needed or unsupported */ });
    els.nowPlaying.textContent = 'Now Playing (Local): ' + file.name;

    els.localPlayer.onerror = () => {
      els.playError.textContent = 'Could not play this file. Likely unsupported codec. Try VLC or convert to MP4 (H.264/AAC).';
    };
  }

  // ---------- Event handlers ----------
  // Mode switch
  function focusPill(el){ $$('.pill').forEach(p=>p.style.outline=''); el.style.outline='2px solid #4f8cff' }
  els.cloudMode.addEventListener('click', () => { hideLocal(); focusPill(els.cloudMode); });
  els.localMode.addEventListener('click', () => { showLocal(); focusPill(els.localMode); els.localPicker?.focus(); });
  els.cloudMode.addEventListener('keydown', e => { if(e.key==='Enter' || e.key===' ') els.cloudMode.click(); });
  els.localMode.addEventListener('keydown', e => { if(e.key==='Enter' || e.key===' ') els.localMode.click(); });

  // Cloud CRUD
  els.addBtn.addEventListener('click', () => {
    const name = els.name.value.trim();
    const raw = els.link.value.trim();
    if(!name || !raw){ alert('Please enter a movie name and a OneDrive link.'); return; }
    let link;
    try{ link = normalizeOneDriveLink(raw); }
    catch(e){ alert(e.message); return; }
    const movie = { id: crypto.randomUUID(), name, url: link, addedAt: Date.now() };
    state.movies.unshift(movie);
    saveLocal();
    renderMovies();
    clearEditor();
  });

  els.updateBtn.addEventListener('click', () => {
    if(!state.editingId) return;
    const name = els.name.value.trim();
    const raw = els.link.value.trim();
    if(!name || !raw){ alert('Please enter a movie name and a OneDrive link.'); return; }
    let link;
    try{ link = normalizeOneDriveLink(raw); }
    catch(e){ alert(e.message); return; }
    const i = state.movies.findIndex(m => m.id === state.editingId);
    if(i>=0){ state.movies[i] = { ...state.movies[i], name, url: link }; }
    saveLocal();
    renderMovies();
    clearEditor();
  });

  els.cancelEditBtn.addEventListener('click', clearEditor);

  // Movie card actions
  els.grid.addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if(!btn) return;
    const card = e.target.closest('.movie');
    const id = card?.dataset.id;
    const m = state.movies.find(x => x.id === id);
    if(!m) return;

    const action = btn.dataset.action;
    if(action === 'play'){ hideLocal(); playCloud(m); }
    else if(action === 'edit') startEdit(m);
    else if(action === 'remove'){
      if(confirm('Delete this movie?')){
        const i = state.movies.findIndex(x => x.id === id);
        if(i>=0) state.movies.splice(i,1);
        saveLocal();
        renderMovies();
        if(els.nowPlaying.textContent.includes(m.name)) stopPlayback();
      }
    }
  });

  // Import/Export/Clear
  els.exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.movies, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'movies.json'; a.click();
    URL.revokeObjectURL(url);
  });

  els.importFile.addEventListener('change', async () => {
    const file = els.importFile.files[0]; if(!file) return;
    try{
      const text = await file.text();
      const arr = JSON.parse(text);
      if(!Array.isArray(arr)) throw new Error('Invalid JSON: expected an array');
      state.movies = arr.map(x => ({ id: x.id || crypto.randomUUID(), name: String(x.name||'Untitled'), url: String(x.url||''), addedAt: x.addedAt||Date.now() }));
      saveLocal();
      renderMovies();
      alert('Imported successfully!');
    }catch(err){ alert('Import failed: ' + err.message); }
    finally{ els.importFile.value = ''; }
  });

  els.clearBtn.addEventListener('click', () => {
    if(confirm('Clear all movies from this browser?')){
      state.movies = [];
      saveLocal();
      renderMovies();
      stopPlayback();
    }
  });

  // Search
  els.search?.addEventListener('input', renderMovies);
  els.clearSearch?.addEventListener('click', () => { els.search.value=''; renderMovies(); });

  // Player controls
  els.fullscreenBtn.addEventListener('click', () => {
    const el = els.stage;
    if(document.fullscreenElement){ document.exitFullscreen(); }
    else{ el.requestFullscreen?.(); }
  });

  els.stopBtn.addEventListener('click', stopPlayback);

  // Local file input + DnD
  els.localPicker?.addEventListener('change', (e)=>{
    const files = Array.from(e.target.files || []);
    listLocalFiles(files);
    showLocal();
  });
  if (els.dropZone){
    ['dragenter','dragover'].forEach(ev => els.dropZone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation(); els.dropZone.style.borderColor = '#4f8cff';
    }));
    ['dragleave','drop'].forEach(ev => els.dropZone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation(); els.dropZone.style.borderColor = '#2a3140';
    }));
    els.dropZone.addEventListener('drop', e => {
      const files = Array.from(e.dataTransfer.files || []).filter(f => /^video\//.test(f.type) || /\.(mkv|mp4|webm|mov|avi|m4v)$/i.test(f.name));
      listLocalFiles(files);
      showLocal();
    });
  }

  els.localList?.addEventListener('click', e => {
    const item = e.target.closest('.local-item');
    if(!item) return;
    const i = Number(item.dataset.i);
    const file = state.localFiles[i];
    if(file){ showLocal(); playLocalFile(file); }
  });

  // ---- Init ----
  (async function init(){
    loadPrefs();
    // Close mobile nav on load
    document.body.classList.remove('nav-open');
    els.hamburger.setAttribute('aria-expanded','false');

    const remote = await loadRemoteJSON();
    if(remote){ state.movies = remote; }
    else{ state.movies = loadLocal(); }
    renderStatus();
    renderMovies();
  })();
})();
