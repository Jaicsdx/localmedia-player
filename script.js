(() => {
  const $ = s => document.querySelector(s);
  const storeKey = 'omp_movies_v1';
  const state = { movies: [], editingId:null, localFiles:[] };

  const els = {
    cloudMode: $('#cloudMode'), localMode: $('#localMode'),
    cloudControls: $('#cloudControls'), localControls: $('#localControls'),
    name: $('#movieName'), link: $('#movieLink'),
    addBtn: $('#addBtn'), updateBtn: $('#updateBtn'), cancelEditBtn: $('#cancelEditBtn'),
    exportBtn: $('#exportBtn'), importFile: $('#importFile'), clearBtn: $('#clearBtn'),
    search: $('#searchInput'), clearSearch: $('#clearSearchBtn'),
    status: $('#status'), grid: $('#movies'),
    cloudPlayer: $('#cloudPlayer'), localPlayer: $('#localPlayer'),
    nowPlaying: $('#nowPlaying'), fullscreenBtn: $('#fullscreenBtn'), stopBtn: $('#stopBtn'),
    playError: $('#playError'), localPicker: $('#localPicker'), dropZone: $('#dropZone'), localList: $('#localList')
  };

  function escapeHtml(s){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
  function save(){localStorage.setItem(storeKey,JSON.stringify(state.movies));}
  function load(){try{return JSON.parse(localStorage.getItem(storeKey))||[]}catch{return []}}
  function render(){
    const list=state.movies.filter(m=>m.name.toLowerCase().includes((els.search.value||"").toLowerCase()));
    els.grid.innerHTML=list.map(m=>`
      <div class="movie" data-id="${m.id}">
        <div class="thumb">🎬</div>
        <div class="body"><div class="title">${escapeHtml(m.name)}</div>
          <button class="btn small" data-act="play">Play</button>
          <button class="btn small secondary" data-act="edit">Edit</button>
          <button class="btn small red" data-act="del">Delete</button>
        </div>
      </div>`).join('')||"No movies yet.";
  }
  function play(m){els.cloudPlayer.classList.remove("invisible");els.localPlayer.classList.add("invisible");els.cloudPlayer.src=m.url;els.nowPlaying.textContent="Now: "+m.name;}
  function stop(){els.cloudPlayer.src="";els.localPlayer.src="";els.nowPlaying.textContent="Nothing playing";}
  els.addBtn.onclick=()=>{if(!els.name.value||!els.link.value)return;state.movies.unshift({id:crypto.randomUUID(),name:els.name.value,url:els.link.value,addedAt:Date.now()});save();render();}
  els.grid.onclick=e=>{const id=e.target.closest(".movie")?.dataset.id,m=state.movies.find(x=>x.id===id);if(!m)return;const act=e.target.dataset.act;if(act==="play")play(m);if(act==="del"){state.movies=state.movies.filter(x=>x.id!==id);save();render();}}
  els.exportBtn.onclick=()=>{const b=new Blob([JSON.stringify(state.movies,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="movies.json";a.click();}
  els.importFile.onchange=async()=>{const f=els.importFile.files[0];if(!f)return;const arr=JSON.parse(await f.text());state.movies=arr;save();render();}
  els.clearBtn.onclick=()=>{if(confirm("Clear?")){state.movies=[];save();render();stop();}}
  els.search.oninput=render;els.clearSearch.onclick=()=>{els.search.value="";render();}
  els.stopBtn.onclick=stop;els.fullscreenBtn.onclick=()=>els.stage?.requestFullscreen();
  state.movies=load();render();
})();
