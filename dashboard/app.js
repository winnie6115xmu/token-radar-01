// Token Launch Radar dashboard: renders window.RADAR (written by main.ts as data.js).
// No network, no framework. Filter, sort, detail view and live-token view run in the page.
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) {
    document.getElementById('rows').innerHTML = '<tr><td colspan="8">No data loaded. Run main.ts first to write data.js.</td></tr>';
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var rowsEl = $('rows'), liveRowsEl = $('live-rows'), detailEl = $('detail');
  var boardSection = $('board-section'), liveSection = $('live-section');
  var qEl = $('q'), catEl = $('category'), chainEl = $('chain'), sortEl = $('sort');
  var countEl = $('count');

  function usd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function pct(n) {
    // change_7d is already in per cent (e.g. 26.3 means +26.3%), not a fraction.
    if (n === null || n === undefined) return '—';
    var v = n.toFixed(1) + '%';
    return n > 0 ? '+' + v : v;
  }
  function pctClass(n) {
    if (n === null || n === undefined) return '';
    return n > 0 ? 'pos' : n < 0 ? 'neg' : '';
  }
  function age(n) {
    if (n === null || n === undefined) return '—';
    if (n < 30) return n + 'd';
    if (n < 365) return Math.floor(n / 30) + 'mo';
    return (n / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function chips(list, max) {
    var shown = list.slice(0, max || 3).map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('');
    if (list.length > (max || 3)) shown += '<span class="chip">+' + (list.length - (max || 3)) + '</span>';
    return shown || '—';
  }

  // Header meta and stats.
  $('meta').textContent = 'Snapshot ' + R.as_of + ' · Model ' + R.model_version + ' · ' + R.source;
  $('stats').innerHTML =
    '<span class="stat"><b>' + R.watchlist_size + '</b>watchlist</span>' +
    '<span class="stat"><b>' + R.board_size + '</b>board rows</span>' +
    '<span class="stat"><b>' + R.early_size + '</b>early finds</span>' +
    '<span class="stat"><b>' + R.live_size + '</b>live tokens</span>';

  // Dropdown options from the data.
  var cats = {}, chains = {};
  R.rows.forEach(function (r) {
    if (r.category) cats[r.category] = true;
    r.chains.forEach(function (c) { chains[c] = true; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; catEl.appendChild(o);
  });
  Object.keys(chains).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; chainEl.appendChild(o);
  });

  // State from the URL, so a filtered view or a detail is a link.
  var params = new URLSearchParams(window.location.search);
  var state = {
    q: params.get('q') || '',
    category: params.get('category') || '',
    chain: params.get('chain') || '',
    sort: params.get('sort') || 'rank',
    view: 'board',
    detail: (window.location.hash.match(/detail=([^&]+)/) || [])[1] || ''
  };
  qEl.value = state.q; catEl.value = state.category; chainEl.value = state.chain; sortEl.value = state.sort;

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category) p.set('category', state.category);
    if (state.chain) p.set('chain', state.chain);
    if (state.sort !== 'rank') p.set('sort', state.sort);
    var qs = p.toString();
    var hash = state.detail ? '#detail=' + state.detail : '';
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + hash);
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = R.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (state.category && r.category !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      return true;
    });
    var s = state.sort;
    list.sort(function (a, b) {
      if (s === 'implied') return b.implied_value_usd - a.implied_value_usd;
      if (s === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (s === 'growth') return (b.change_7d || 0) - (a.change_7d || 0);
      if (s === 'age') return (b.age_days || 0) - (a.age_days || 0);
      if (s === 'name') return a.name.localeCompare(b.name);
      return a.rank - b.rank;
    });
    return list;
  }

  function renderBoard() {
    var list = filtered();
    countEl.textContent = 'Showing ' + list.length + ' of ' + R.rows.length + ' board rows.';
    rowsEl.innerHTML = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.detail === r.slug ? ' class="selected"' : '') + '>' +
        '<td class="num rank">' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b><br><span style="color:var(--muted);font-size:12px">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + chips(r.chains) + '</td>' +
        '<td class="num">' + usd(r.tvl_usd) + '</td>' +
        '<td class="num ' + pctClass(r.change_7d) + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num"><b>' + usd(r.implied_value_usd) + '</b></td>' +
        '</tr>';
    }).join('');
  }

  function renderDetail() {
    if (!state.detail) { detailEl.hidden = true; detailEl.innerHTML = ''; return; }
    var r = null;
    for (var i = 0; i < R.rows.length; i++) if (R.rows[i].slug === state.detail) { r = R.rows[i]; break; }
    if (!r) { detailEl.hidden = true; detailEl.innerHTML = ''; return; }
    var steps = r.farm_steps.map(function (s) {
      var m = s.match(/^(.*?) Cost: (.*?)\. Time: (.*?)\.?$/);
      if (!m) return '<li>' + esc(s) + '</li>';
      return '<li>' + esc(m[1]) + '<br><span class="cost-time">Cost: ' + esc(m[2]) + ' · Time: ' + esc(m[3]) + '</span></li>';
    }).join('');
    detailEl.innerHTML =
      '<button class="close-btn" id="close-detail" type="button">Close</button>' +
      '<h2>#' + r.rank + ' ' + esc(r.name) + '</h2>' +
      '<p class="sub">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || '—') + ' · records no token</p>' +
      '<div class="detail-grid"><div><h3>Protocol</h3><dl class="kv">' +
      '<div><dt>TVL</dt><dd>' + usd(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7-day change</dt><dd>' + pct(r.change_7d) + '</dd></div>' +
      '<div><dt>Tracked since</dt><dd>' + esc(r.listed_at || '—') + ' (' + age(r.age_days) + ')</dd></div>' +
      '<div><dt>Implied value</dt><dd><b>' + usd(r.implied_value_usd) + '</b></dd></div>' +
      '</dl></div><div><h3>Model breakdown</h3><dl class="kv">' +
      '<div><dt>Sector multiple</dt><dd>×' + r.sector_multiple.toFixed(2) + '</dd></div>' +
      '<div><dt>Chain multiplier</dt><dd>×' + r.chain_multiplier.toFixed(2) + '</dd></div>' +
      '<div><dt>Growth multiplier</dt><dd>×' + r.growth_multiplier.toFixed(2) + '</dd></div>' +
      '<div><dt>Maturity multiplier</dt><dd>×' + r.maturity_multiplier.toFixed(2) + '</dd></div>' +
      '</dl></div></div>' +
      '<h3>Farm plan</h3><ol class="steps">' + steps + '</ol>';
    detailEl.hidden = false;
    $('close-detail').addEventListener('click', function () {
      state.detail = ''; renderDetail(); renderBoard(); syncUrl();
    });
  }

  function renderLive() {
    liveRowsEl.innerHTML = R.live.map(function (r) {
      return '<tr>' +
        '<td><b>' + esc(r.name) + '</b><br><span style="color:var(--muted);font-size:12px">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + chips(r.chains) + '</td>' +
        '<td class="num">' + usd(r.tvl_usd) + '</td>' +
        '<td class="num">' + usd(r.mcap_usd) + '</td>' +
        '<td class="num ' + pctClass(r.change_7d) + '">' + pct(r.change_7d) + '</td>' +
        '</tr>';
    }).join('');
  }

  function setView(view) {
    state.view = view;
    $('view-board').classList.toggle('active', view === 'board');
    $('view-live').classList.toggle('active', view === 'live');
    boardSection.hidden = view !== 'board';
    detailEl.hidden = view !== 'board' || !state.detail;
    liveSection.hidden = view !== 'live';
    if (view === 'live') renderLive();
  }

  rowsEl.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.detail = tr.getAttribute('data-slug');
    renderDetail(); renderBoard(); syncUrl();
    detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  var debounce = null;
  qEl.addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () { state.q = qEl.value; renderBoard(); syncUrl(); }, 150);
  });
  catEl.addEventListener('change', function () { state.category = catEl.value; renderBoard(); syncUrl(); });
  chainEl.addEventListener('change', function () { state.chain = chainEl.value; renderBoard(); syncUrl(); });
  sortEl.addEventListener('change', function () { state.sort = sortEl.value; renderBoard(); syncUrl(); });
  $('view-board').addEventListener('click', function () { setView('board'); });
  $('view-live').addEventListener('click', function () { setView('live'); });

  renderBoard();
  renderDetail();
})();
