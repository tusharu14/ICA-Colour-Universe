
  (function() {
    const raw = JSON.parse(document.getElementById('shade-data').textContent);
    const state = {
      queryShadeCard: '',
      queryColorCode: '',
      queryColourName: '',
      family: 'All',
      sortBy: 'relevance',
      shown: 0,
      visible: [],
      currentIndex: -1,
      pageSize: 96,
      selected: null,
    };

    const families = ['All', ...new Set(raw.map(x => x.family))].sort((a,b) => a.localeCompare(b));
    const familyEl = document.getElementById('familyChips');
    const gridEl = document.getElementById('grid');
    const emptyState = document.getElementById('emptyState');
    const totalCount = document.getElementById('totalCount');
    const filteredCount = document.getElementById('filteredCount');
    const shownCount = document.getElementById('shownCount');
    const progressPill = document.getElementById('progressPill');
    const searchHint = document.getElementById('searchHint');
    const overlay = document.getElementById('overlay');
    const sheet = document.getElementById('sheet');
    const sheetInner = document.getElementById('sheetInner');
    const inspectorDesktop = document.getElementById('inspectorDesktop');
    const sentinel = document.getElementById('sentinel');
    const clearBtn = document.getElementById('clearBtn');
    const copyVisibleBtn = document.getElementById('copyVisibleBtn');
    const shadeCardFilter = document.getElementById('shadeCardFilter');
    const colorCodeFilter = document.getElementById('colorCodeFilter');
    const colourNameFilter = document.getElementById('colourNameFilter');
    const sortBy = document.getElementById('sortBy');
    const shadeCardsList = document.getElementById('shadeCardsList');

    totalCount.textContent = raw.length.toLocaleString();
    [...new Set(raw.map(r => r.shadeCard).filter(Boolean))].sort().forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      shadeCardsList.appendChild(opt);
    });

    function familyColor(label) {
      const map = {
        'All': '#171717',
        'Porcelain Whites': '#d7d2c6',
        'Pastel Tints': '#d4b8ae',
        'Soft Neutrals': '#b5a996',
        'Stone Greys': '#7d7a74',
        'Ink & Charcoal': '#2a2a2a',
        'Earth Browns': '#8a6345',
        'Terracotta & Clay': '#b55f43',
        'Coral & Reds': '#c25357',
        'Amber & Apricot': '#cf8a38',
        'Sunlit Yellows': '#d8b132',
        'Fresh Greens': '#5e8750',
        'Olive & Moss': '#6b7444',
        'Teal & Aqua': '#4c9ca1',
        'Sky & Blues': '#558ab5',
        'Ocean Blues': '#4067b0',
        'Violet & Indigo': '#7a68b2',
        'Plum & Orchid': '#9b5f9a',
      };
      return map[label] || '#8a6d47';
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function hexToRgb(hex) {
      const v = hex.replace('#','');
      return {
        r: parseInt(v.slice(0,2),16),
        g: parseInt(v.slice(2,4),16),
        b: parseInt(v.slice(4,6),16),
      };
    }

    function relativeLuminance(hex) {
      const {r,g,b} = hexToRgb(hex);
      const s = [r,g,b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v/12.92 : Math.pow((v + 0.055)/1.055, 2.4);
      });
      return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2];
    }

    function contrastText(hex) {
      return relativeLuminance(hex) > 0.36 ? '#161616' : '#ffffff';
    }

    function score(item, q1, q2, q3) {
      let s = 0;
      if (q1 && item.shadeCard.toLowerCase().includes(q1)) s += 5;
      if (q2 && item.colorCode.toLowerCase().includes(q2)) s += 5;
      if (q3 && item.colourName.toLowerCase().includes(q3)) s += 5;
      if (state.family !== 'All' && item.family === state.family) s += 1;
      return s;
    }

    function filterData() {
      const q1 = state.queryShadeCard.trim().toLowerCase();
      const q2 = state.queryColorCode.trim().toLowerCase();
      const q3 = state.queryColourName.trim().toLowerCase();
      let arr = raw.filter(item => {
        if (state.family !== 'All' && item.family !== state.family) return false;
        if (q1 && !item.shadeCard.toLowerCase().includes(q1)) return false;
        if (q2 && !item.colorCode.toLowerCase().includes(q2)) return false;
        if (q3 && !item.colourName.toLowerCase().includes(q3)) return false;
        return true;
      });

      const enriched = arr.map(item => {
        const h = item.hex;
        const {r, g, b} = hexToRgb(h);
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        const d = max - min;
        let hue = 0;
        if (d) {
          switch (max) {
            case r: hue = ((g - b) / d + (g < b ? 6 : 0)); break;
            case g: hue = ((b - r) / d + 2); break;
            default: hue = ((r - g) / d + 4); break;
          }
          hue *= 60;
        }
        return {...item, hue, l};
      });

      enriched.sort((a,b) => {
        if (state.sortBy === 'hue') return a.hue - b.hue || a.l - b.l;
        if (state.sortBy === 'lightness') return a.l - b.l || a.hue - b.hue;
        if (state.sortBy === 'shadeCard') return a.shadeCard.localeCompare(b.shadeCard) || a.colorCode.localeCompare(b.colorCode);
        if (state.sortBy === 'code') return a.colorCode.localeCompare(b.colorCode) || a.shadeCard.localeCompare(b.shadeCard);
        return score(b, q1, q2, q3) - score(a, q1, q2, q3) || a.shadeCard.localeCompare(b.shadeCard) || a.colorCode.localeCompare(b.colorCode);
      });
      return enriched;
    }

    function cardTemplate(item, index) {
      const familyBg = familyColor(item.family);
      const name = item.colourName ? escapeHtml(item.colourName) : '<span style="color:var(--muted)">No colour name</span>';
      return `
        <article class="card" tabindex="0" role="button" aria-label="${escapeHtml(item.shadeCard)} ${escapeHtml(item.colorCode)} ${escapeHtml(item.colourName || '')}"
          data-id="${item.id}" data-index="${index}" style="--swatch:${item.hex}; --hero:${item.hex};">
          <div class="swatch"></div>
          <div class="details">
            <div class="row1">
              <div>
                <div class="code">${escapeHtml(item.colorCode)}</div>
                <div class="hex">${escapeHtml(item.hex)}</div>
              </div>
              <div class="familytag" title="Family" style="--swatch:${familyBg};">
                <span class="familydot"></span>
                <span>${escapeHtml(item.family)}</span>
              </div>
            </div>
            <div class="name">${name}</div>
            <div class="smallmeta"><span>${escapeHtml(item.shadeCard)}</span><span>${item.id.toString().padStart(4,'0')}</span></div>
          </div>
        </article>`;
    }

    function renderFamilyChips() {
      familyEl.innerHTML = '';
      families.forEach(name => {
        const b = document.createElement('button');
        b.className = 'chip';
        b.textContent = name;
        b.setAttribute('aria-pressed', String(state.family === name));
        b.addEventListener('click', () => {
          state.family = name;
          updateChips();
          rerender(true);
        });
        familyEl.appendChild(b);
      });
    }

    function updateChips() {
      [...familyEl.querySelectorAll('.chip')].forEach((chip, i) => {
        chip.setAttribute('aria-pressed', String(families[i] === state.family));
      });
    }

    function updateStats(list) {
      filteredCount.textContent = list.length.toLocaleString();
      shownCount.textContent = Math.min(state.shown, list.length).toLocaleString();
      progressPill.textContent = `${Math.min(state.shown, list.length).toLocaleString()} / ${list.length.toLocaleString()} shades`;
      const hint = [];
      if (state.family !== 'All') hint.push(`Family: ${state.family}`);
      if (state.queryShadeCard.trim()) hint.push(`Shade Card: ${state.queryShadeCard.trim()}`);
      if (state.queryColorCode.trim()) hint.push(`Code: ${state.queryColorCode.trim()}`);
      if (state.queryColourName.trim()) hint.push(`Name: ${state.queryColourName.trim()}`);
      searchHint.innerHTML = hint.length ? hint.map(x => `<span class="stat">${escapeHtml(x)}</span>`).join('') : '';
    }

    function rerender(reset = false) {
      if (reset) {
        state.shown = 0;
        gridEl.innerHTML = '';
      }
      const list = filterData();
      state.visible = list;
      updateStats(list);
      emptyState.hidden = list.length !== 0;
      if (!list.length) {
        state.currentIndex = -1;
        selectItem(null);
        return;
      }
      if (state.currentIndex < 0) state.currentIndex = 0;
      if (reset) loadMore();
    }

    function loadMore() {
      const list = state.visible;
      const next = Math.min(state.shown + state.pageSize, list.length);
      if (next === state.shown) return;
      const frag = document.createDocumentFragment();
      for (let i = state.shown; i < next; i++) {
        const item = list[i];
        const temp = document.createElement('div');
        temp.innerHTML = cardTemplate(item, i);
        frag.appendChild(temp.firstElementChild);
      }
      gridEl.appendChild(frag);
      state.shown = next;
      updateStats(list);
      if (state.selected) highlightSelection(state.selected.id);
    }

    function highlightSelection(id) {
      gridEl.querySelectorAll('.card').forEach(card => {
        card.style.outline = card.dataset.id == String(id) ? '2px solid rgba(138,109,71,0.55)' : 'none';
      });
    }

    function itemIndexById(id) {
      return state.visible.findIndex(x => x.id === id);
    }

    function selectItem(item) {
      state.selected = item;
      if (!item) {
        const neutral = `
          <h2>Pick a shade</h2>
          <p class="lead">Tap any tile to inspect the shade card, code, name, family and HEX values. On mobile, the same detail view opens as a bottom sheet.</p>
          <div class="hero-swatch" style="--hero:#ddd"></div>
          <div class="inspector-grid">
            <div class="kv"><div>Shade Card</div><div>—</div></div>
            <div class="kv"><div>Color Code</div><div>—</div></div>
            <div class="kv"><div>Colour Name</div><div>—</div></div>
            <div class="kv"><div>Family</div><div>—</div></div>
            <div class="kv"><div>HEX</div><div>—</div></div>
          </div>`;
        inspectorDesktop.innerHTML = neutral;
        return;
      }
      const name = item.colourName ? escapeHtml(item.colourName) : '<span style="color:var(--muted)">No colour name</span>';
      const block = `
        <h2>${escapeHtml(item.colorCode)}</h2>
        <p class="lead">${name}</p>
        <div class="hero-swatch" style="--hero:${item.hex}"></div>
        <div class="inspector-grid">
          <div class="kv"><div>Shade Card</div><div>${escapeHtml(item.shadeCard)}</div></div>
          <div class="kv"><div>Color Code</div><div>${escapeHtml(item.colorCode)}</div></div>
          <div class="kv"><div>Colour Name</div><div>${item.colourName ? escapeHtml(item.colourName) : '—'}</div></div>
          <div class="kv"><div>Family</div><div>${escapeHtml(item.family)}</div></div>
          <div class="kv"><div>HEX</div><div>${escapeHtml(item.hex)}</div></div>
        </div>
        <div class="copyrow">
          <button class="copybtn" data-copy="${item.hex}">Copy HEX</button>
          <button class="copybtn" data-copy="${item.colorCode}">Copy code</button>
          <button class="copybtn" data-copy="${item.shadeCard}">Copy shade card</button>
        </div>
        <div class="navrow">
          <button class="button navbtn" data-nav="prev">Previous</button>
          <button class="button navbtn" data-nav="next">Next</button>
        </div>`;
      inspectorDesktop.innerHTML = block;
      inspectorDesktop.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.getAttribute('data-copy'));
          btn.textContent = 'Copied';
          setTimeout(() => btn.textContent = btn.getAttribute('data-copy') === item.hex ? 'Copy HEX' : btn.getAttribute('data-copy') === item.colorCode ? 'Copy code' : 'Copy shade card', 900);
        } catch (e) {
          btn.textContent = 'Copy failed';
        }
      }));
      inspectorDesktop.querySelectorAll('[data-nav]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.nav)));
    }

    function openSheet(item) {
      const name = item.colourName ? escapeHtml(item.colourName) : '<span style="color:var(--muted)">No colour name</span>';
      sheetInner.innerHTML = `
        <h2 style="font-family:Georgia,serif;font-weight:500;margin:0 0 8px;font-size:28px;">${escapeHtml(item.colorCode)}</h2>
        <p style="margin:0 0 12px;color:var(--muted);font-size:14px;line-height:1.6;">${name}</p>
        <div class="hero-swatch" style="--hero:${item.hex};height:220px"></div>
        <div class="inspector-grid" style="margin-top:14px;">
          <div class="kv"><div>Shade Card</div><div>${escapeHtml(item.shadeCard)}</div></div>
          <div class="kv"><div>Color Code</div><div>${escapeHtml(item.colorCode)}</div></div>
          <div class="kv"><div>Colour Name</div><div>${item.colourName ? escapeHtml(item.colourName) : '—'}</div></div>
          <div class="kv"><div>Family</div><div>${escapeHtml(item.family)}</div></div>
          <div class="kv"><div>HEX</div><div>${escapeHtml(item.hex)}</div></div>
        </div>
        <div class="copyrow">
          <button class="copybtn" data-copy="${item.hex}">Copy HEX</button>
          <button class="copybtn" data-copy="${item.colorCode}">Copy code</button>
          <button class="copybtn" data-copy="${item.shadeCard}">Copy shade card</button>
        </div>
        <div class="navrow">
          <button class="button navbtn" data-nav="prev">Previous</button>
          <button class="button navbtn" data-nav="next">Next</button>
        </div>`;
      sheetInner.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(btn.getAttribute('data-copy')); btn.textContent = 'Copied'; setTimeout(() => btn.textContent = btn.getAttribute('data-copy') === item.hex ? 'Copy HEX' : btn.getAttribute('data-copy') === item.colorCode ? 'Copy code' : 'Copy shade card', 900); } catch (e) { btn.textContent = 'Copy failed'; }
      }));
      sheetInner.querySelectorAll('[data-nav]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.nav)));
      overlay.classList.add('open');
      sheet.classList.add('open');
      sheet.setAttribute('aria-hidden', 'false');
    }

    function closeSheet() {
      overlay.classList.remove('open');
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
    }

    function navigate(direction) {
      if (!state.visible.length) return;
      let idx = state.selected ? itemIndexById(state.selected.id) : 0;
      if (idx < 0) idx = 0;
      idx = direction === 'next' ? Math.min(idx + 1, state.visible.length - 1) : Math.max(idx - 1, 0);
      const item = state.visible[idx];
      state.currentIndex = idx;
      selectItem(item);
      if (window.matchMedia('(max-width: 1280px)').matches) openSheet(item);
      highlightSelection(item.id);
    }

    function activateItem(index) {
      const item = state.visible[index];
      if (!item) return;
      state.currentIndex = index;
      selectItem(item);
      if (window.matchMedia('(max-width: 1280px)').matches) openSheet(item);
      highlightSelection(item.id);
    }

    gridEl.addEventListener('click', e => {
      const card = e.target.closest('.card');
      if (!card) return;
      activateItem(parseInt(card.dataset.index, 10));
    });
    gridEl.addEventListener('keydown', e => {
      const card = e.target.closest('.card');
      if (!card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateItem(parseInt(card.dataset.index, 10)); }
    });

    shadeCardFilter.addEventListener('input', e => { state.queryShadeCard = e.target.value; rerender(true); });
    colorCodeFilter.addEventListener('input', e => { state.queryColorCode = e.target.value; rerender(true); });
    colourNameFilter.addEventListener('input', e => { state.queryColourName = e.target.value; rerender(true); });
    sortBy.addEventListener('change', e => { state.sortBy = e.target.value; rerender(true); });
    clearBtn.addEventListener('click', () => {
      state.queryShadeCard = '';
      state.queryColorCode = '';
      state.queryColourName = '';
      state.family = 'All';
      state.sortBy = 'relevance';
      shadeCardFilter.value = '';
      colorCodeFilter.value = '';
      colourNameFilter.value = '';
      sortBy.value = 'relevance';
      updateChips();
      rerender(true);
    });

    copyVisibleBtn.addEventListener('click', async () => {
      const txt = state.visible.slice(0, 200).map(x => x.hex).join('\n');
      try { await navigator.clipboard.writeText(txt); copyVisibleBtn.textContent = 'Copied HEX list'; setTimeout(() => copyVisibleBtn.textContent = 'Copy visible HEX', 1000); } catch (e) { copyVisibleBtn.textContent = 'Copy failed'; }
    });

    overlay.addEventListener('click', closeSheet);
    sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) loadMore(); });
    }, { rootMargin: '500px' });
    io.observe(sentinel);

    renderFamilyChips();
    rerender(true);
    if (state.visible[0]) activateItem(0);
  })();
  