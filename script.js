(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // Elements
  const els = {
    body: document.body,
    hamburger: $('#hamburger'),
    sidebar: $('#sidebar'),

    cloudMode: $('#cloudMode'),
    localMode: $('#localMode'),
    cloudControls: $('#cloudControls'),
    localControls: $('#localControls'),

    name: $('#movieName'),
    link: $('#movieLink'),
    addBtn: $('#addBtn'),
    updateBtn: $('#updateBtn'),
    cancelEditBtn: $('#cancelEditBtn'),

    exportBtn: $('#exportBtn'),
    importFile: $('#importFile'),
    clearBtn: $('#clearBtn'),
    status: $('#status'),
    search: $('#searchInput'),
    clearSearch: $('#clearSearchBtn'),

    grid: $('#movies'),
    cloudPlayer: $('#cloudPlayer'),
    localPlayer: $('#localPlayer'),
    stage: $('#stage'),
    nowPlaying: $('#nowPlaying'),
    fullscreenBtn: $('#fullscreenBtn'),
    stopBtn: $('#stopBtn'),
    playError: $('#playError'),

    localPicker: $('#localPicker'),
    dropZone: $('#dropZone'),
    localList: $('#localList'),
  };

  // State
  const storeKey = 'omp_movies_v1';
  const state = {
    movies: [],
    editingId: null,
    ui: 'cloud', // 'cloud' | 'local'
    localFiles: []
  };

  // =============== HAMBURGER ===============
  function toggleSidebarMobile() {
    const open = !document.body.classList.contains('nav-open');
    document.body.classList.toggle('nav-open', open);
    els.hamburger.setAttribute('aria-expanded', String(open));
  }

  els.hamburger.addEventListener('click', toggleSidebarMobile);

  // Close when clicking backdrop (mobile)
  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('nav-open')) return;
    const inside = e.target.closest('#sidebar') || e.target.closest('#hamburger');
    if (!inside) {
      document.body.classList.remove('nav-open');
      els.hamburger.setAttribute('aria-expanded', 'false');
    }
  });

  // =============== MODE SWITCH ===============
  function setMode(mode){
    state.ui = mode;
    if (mode === 'cloud') {
      els.cloudControls.classList.remove('hidden');
      els.localControls.classList.add('hidden');
      els.cloudMode.classList.add('active');
      els.localMode.classList.remove('active');
      // show cloud player, hide local player
      els.localPlayer.classList.add('hidden');
      els.cloudPlayer.classList.remove('hidden');
    } else {
      els.cloudControls.classList.add('hidden');
      els.localControls.classList.remove('hidden');
      els.cloudMode.classList.remove('active');
      els.localMode.classList.add('active');
      // show local player, hide cloud player
      els.cloudPlayer.classList.add('hidden');
      els.localPlayer.classList.remove('hidden');
    }
  }

  els.cloudMode.addEventListener('click', () => setMode('cloud'));
  els.localMode.addEventListener('click', () => setMode('local'));

  // =============== MOVIE LIST ===============
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

  function renderMovies(){
    const q = (els.search.value || '').trim().toLowerCase();
    const list = state.movies.filter(m => (m.name||'').toLowerCase().includes(q));
    els.grid.innerHTML = list.map(m => `
      <div class="movie" data-id="${m.id}">
        <div class="thumb">🎬</div>
        <div class="body">
          <div class="title">${escapeHtml(m.name)}</div>
          <div class="stack">
            <button class="btn small" data-act="play">Play</button>
            <button class="btn small secondary" data-act="edit">Edit</button>
            <button class="btn small red" data-act="del">Delete</button>
          </div>
        </div>
      </div>
    `).join('') || `<div class="hint" style="padding:12px">No movies yet. Add one on the left.</div>`;
  }

  // =============== CLOUD PLAYBACK ===============
  function normalizeOneDriveLink(input){
    if(!input) throw new Error('Empty link');
    let link = input.trim();
    const m = link.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i) || link.match(/src=["']([^"']+)["']/i);
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
    return link;
  }

  function playCloud(movie){
    setMode('cloud');
    els.cloudPlayer.src = movie.url;
    els.nowPlaying.textContent = 'Now Playing (Cloud): ' + movie.name;
  }

  function stopPlayback(){
    els.cloudPlayer.src = 'about:blank';
    els.localPlayer.pause();
    els.localPlayer.removeAttribute('src');
    els.localPlayer.load();
    els.nowPlaying.textContent = 'Nothing playing';
    els.playError.textContent = '';
  }

  // =============== LOCAL PLAYBACK ===============
  function listLocalFiles(files){
    state.localFiles = files;
    els.localList.innerHTML = files.map((f,i)=>`<div class="local-item" data-i="${i}">${escapeHtml(f.name)}</div>`).join('') || `<div class="hint">No local files selected yet.</div>`;
  }

  function guessMime(file){
    if(file.type) return file.type;
    const ext = file.name.toLowerCase().split('.').pop();
    const map = { mp4:'video/mp4', m4v:'video/mp4', mov:'video/quicktime', webm:'video/webm', mkv:'video/x-matroska', avi:'video/x-msvideo' };
    return map[ext] || 'video/*';
  }

  function canPlay(mime){
    const v = document.createElement('video');
    return !!v.canPlayType(mime);
  }

  function playLocalFile(file){
    setMode('local');
    els.playError.textContent = '';
    const mime = guessMime(file);
    if(!canPlay(mime) && /\.mkv$/i.test(file.name)){
      els.playError.textContent = 'Browser may not support some MKV codecs.';
    }
    const url = URL.createObjectURL(file);
    els.localPlayer.src = url;
    els.localPlayer.play().catch(()=>{});
    els.nowPlaying.textContent = 'Now Playing (Local): ' + file.name;
    els.localPlayer.onerror = () => {
      els.playError.textContent = 'Could not play this file (codec). Try VLC or convert to MP4 (H.264/AAC).';
    };
  }

  // =============== CRUD + EVENTS ===============
  function saveLocal(){ localStorage.setItem(storeKey, JSON.stringify(state.movies)); }
  function loadLocal(){ try{ return JSON.parse(localStorage.getItem(storeKey)) || []; }catch{ return []; } }

  async function loadRemoteJSON(){
    try{
      const res = await fetch('movies.json', {cache:'no-store'});
      if(!res.ok) throw 0;
      const arr = await res.json();
      if(!Array.isArray(arr)) throw 0;
      els.status.textContent = 'Using shared movies.json from your site.';
      return arr;
    }catch{
      els.status.textContent = 'Using local browser storage. Export JSON to make it permanent on GitHub.';
      return null;
    }
  }

  // Add
  els.addBtn.addEventListener('click', () => {
    const name = (els.name.value||'').trim();
    const raw = (els.link.value||'').trim();
    if(!name || !raw){ alert('Please enter a movie name and a OneDrive link.'); return; }
    let url; try{ url = normalizeOneDriveLink(raw); }catch(e){ alert(e.message); return; }
    state.movies.unshift({ id: crypto.randomUUID(), name, url, addedAt: Date.now() });
    saveLocal(); renderMovies();
    els.name.value = ''; els.link.value = '';
  });

  // Edit / Delete / Play
  els.grid.addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if(!btn) return;
    const card = e.target.closest('.movie'); const id = card?.dataset.id;
    const m = state.movies.find(x => x.id === id); if(!m) return;
    const act = btn.dataset.act;
    if (act === 'play') playCloud(m);
    else if (act === 'edit') {
      state.editingId = m.id;
      els.name.value = m.name; els.link.value = m.url;
      els.updateBtn.disabled = false; els.cancelEditBtn.disabled = false; els.addBtn.disabled = true;
      // open sidebar on mobile so user sees fields
      if (matchMedia('(max-width: 960px)').matches) {
        document.body.classList.add('nav-open'); els.hamburger.setAttribute('aria-expanded','true');
      }
    } else if (act === 'del') {
      if(confirm('Delete this movie?')){
        state.movies = state.movies.filter(x => x.id !== id);
        saveLocal(); renderMovies();
        if(els.nowPlaying.textContent.includes(m.name)) stopPlayback();
      }
    }
  });

  els.updateBtn.addEventListener('click', () => {
    if(!state.editingId) return;
    const name = (els.name.value||'').trim();
    const raw  = (els.link.value||'').trim();
    if(!name || !raw){ alert('Please enter a movie name and a OneDrive link.'); return; }
    let url; try{ url = normalizeOneDriveLink(raw); }catch(e){ alert(e.message); return; }
    const i = state.movies.findIndex(x => x.id === state.editingId);
    if(i>=0){ state.movies[i] = { ...state.movies[i], name, url }; }
    state.editingId = null;
    els.updateBtn.disabled = true; els.cancelEditBtn.disabled = true; els.addBtn.disabled = false;
    els.name.value = ''; els.link.value = '';
    saveLocal(); renderMovies();
  });

  els.cancelEditBtn.addEventListener('click', () => {
    state.editingId = null;
    els.updateBtn.disabled = true; els.cancelEditBtn.disabled = true; els.addBtn.disabled = false;
    els.name.value = ''; els.link.value = '';
  });

  // Search & data
  els.search.addEventListener('input', renderMovies);
  els.clearSearch.addEventListener('click', () => { els.search.value=''; renderMovies(); });

  els.exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.movies, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'movies.json'; a.click();
    URL.revokeObjectURL(url);
  });

  els.importFile.addEventListener('change', async () => {
    const f = els.importFile.files[0]; if(!f) return;
    try{
      const arr = JSON.parse(await f.text());
      if(!Array.isArray(arr)) throw new Error('Invalid JSON (expected array).');
      state.movies = arr.map(x => ({ id: x.id || crypto.randomUUID(), name: String(x.name||'Untitled'), url: String(x.url||''), addedAt: x.addedAt || Date.now() }));
      saveLocal(); renderMovies(); alert('Imported successfully!');
    }catch(err){ alert('Import failed: ' + err.message); }
    finally{ els.importFile.value = ''; }
  });

  els.clearBtn.addEventListener('click', () => {
    if(confirm('Clear all movies from this browser?')){
      state.movies = []; saveLocal(); renderMovies(); stopPlayback();
    }
  });

  // Fullscreen / Stop
  els.fullscreenBtn.addEventListener('click', () => {
    const el = els.stage; if(document.fullscreenElement){ document.exitFullscreen(); } else { el.requestFullscreen?.(); }
  });
  els.stopBtn.addEventListener('click', stopPlayback);

  // Local files
  els.localPicker.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    setMode('local'); listLocalFiles(files);
  });

  ['dragenter','dragover'].forEach(ev => els.dropZone.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); els.dropZone.style.borderColor = '#4f8cff';
  }));
  ['dragleave','drop'].forEach(ev => els.dropZone.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); els.dropZone.style.borderColor = '#2a3140';
  }));
  els.dropZone.addEventListener('drop', e => {
    const files = Array.from(e.dataTransfer.files || []).filter(f => /^video\//.test(f.type) || /\.(mkv|mp4|webm|mov|avi|m4v)$/i.test(f.name));
    setMode('local'); listLocalFiles(files);
  });

  els.localList.addEventListener('click', (e) => {
    const item = e.target.closest('.local-item'); if(!item) return;
    const i = Number(item.dataset.i); const file = state.localFiles[i]; if(file) playLocalFile(file);
  });

  // =============== INIT ===============
  (async function init(){
    // start in cloud mode
    setMode('cloud');

    // try shared movies.json (your repo), else local storage
    const remote = await loadRemoteJSON();
    if(remote){ state.movies = remote; }
    else { state.movies = loadLocal(); }

    renderMovies();
  })();
})();
