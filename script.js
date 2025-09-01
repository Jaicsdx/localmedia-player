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
    poster: $('#posterUrl'),
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
  const storeKey = 'omp_movies_v2'; // bumped for poster field
  const uiPrefsKey = 'omp_ui_prefs_v1';
  const state = {
    movies: [],
    mode: 'remote',
    editingId: null,
    uiMode: 'cloud',
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

  els.hamburger?.addEventListener('click', () => {
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
        els.hamburger?.setAttribute('aria-expanded', 'false');
      }
    }
  });

  // ---- Utils ----
  function escapeHtml(s){
    return String(s).replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // slug for asset filenames
  function slugify(name){
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'')
      .replace(/-+/g,'-');
  }

  // build poster candidate list for a movie
  function posterCandidates(m){
    const list = [];
    if (m.poster) list.push(m.poster.trim());
    const base = 'assets/' + slugify(m.name);
    list.push(base + '.jpg', base + '.png', 'assets/poster-fallback.svg');
    return list;
  }

  // For <img> fallback chaining
  function wireImgFallback(img){
    const candidates = (img.dataset.candidates || '').split('|').filter(Boolean);
    let i = 0;
    function tryNext(){
      if (i >= candidates.length) return;
      img.src = candidates[i++];
    }
    img.addEventListener('error', tryNext);
    // kick-off: if no src yet, set the first candidate
    if (!img.src || img.src === window.location.href) tryNext();
  }

  // OneDrive link normalization (iframe src → embed URL)
  function normalizeOneDriveLink(input){
    if(!input) throw new Error('Empty link');
    let link = input.trim();
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

  function saveLocal(){
    localStorage.setItem(storeKey, JSON.stringify(state.movies));
  }
  function loadLocal(){
    try{
      const raw = localStorage.getItem(storeKey);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch{ return []; }
  }

  async function loadRemoteJSON(){
    try{
      const res = await fetch('m
