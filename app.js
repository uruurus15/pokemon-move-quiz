(() => {
  const { moves: MOVES, pokemon: MONS } = window.POKE_DATA;
  const $ = (id) => document.getElementById(id);
  const TYPE_JA = { normal: 'ノーマル', fire: 'ほのお', water: 'みず', electric: 'でんき', grass: 'くさ', ice: 'こおり', fighting: 'かくとう', poison: 'どく', ground: 'じめん', flying: 'ひこう', psychic: 'エスパー', bug: 'むし', rock: 'いわ', ghost: 'ゴースト', dragon: 'ドラゴン', dark: 'あく', steel: 'はがね', fairy: 'フェアリー', stellar: 'ステラ' };
  // ひらがな→カタカナに寄せて部分一致検索する
  const kata = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).replace(/\s+/g, '');
  const moveKey = MOVES.map((m) => kata(m.n));
  const monKey = MONS.map((p) => kata(p.name));
  // all=true(ドーブル)は全わざを覚える扱い
  const moveSets = MONS.map((p) => (p.all ? null : new Set(p.mv)));
  const learns = (i, mv) => moveSets[i] === null || moveSets[i].has(mv);

  let target, asked, misses, over;

  function newGame() {
    const pool = MONS.map((p, i) => i).filter((i) => !MONS[i].all);
    target = pool[Math.floor(Math.random() * pool.length)];
    asked = []; misses = 0; over = false; $('aImg').hidden = true;
    $('moveInput').value = ''; $('monInput').value = '';
    $('cands').hidden = true;
    setMsg('', '');
    render();
  }

  // ドーブルは常に候補に残る
  function candidates() {
    const out = [];
    MONS.forEach((p, i) => {
      if (moveSets[i] === null || asked.every((q) => learns(i, q.mv) === q.yes)) out.push(i);
    });
    return out;
  }
  function setMsg(t, cls) { const m = $('msg'); m.textContent = t; m.className = 'msg ' + cls; }

  function render() {
    $('qCount').textContent = asked.length;
    $('missCount').textContent = misses;
    $('candCount').textContent = candidates().length;
    const h = $('history'); h.innerHTML = '';
    [...asked].reverse().forEach((q) => {
      const li = document.createElement('li');
      const mark = document.createElement('span');
      mark.className = q.yes ? 'yes' : 'no'; mark.textContent = q.yes ? '○' : '×';
      const name = document.createElement('span');
      name.textContent = `${MOVES[q.mv].n}(${TYPE_JA[MOVES[q.mv].t] || MOVES[q.mv].t})`;
      li.append(mark, name);
      h.appendChild(li);
    });
    if (!$('cands').hidden) showCands();
  }

  function showCands() {
    const ul = $('cands'); ul.innerHTML = ''; ul.hidden = false;
    candidates().forEach((i) => { const li = document.createElement('li'); li.textContent = MONS[i].name; ul.appendChild(li); });
  }

  function combo(input, list, search, onPick) {
    let items = [], cur = -1;
    const close = () => { list.hidden = true; cur = -1; };
    const draw = () => {
      list.innerHTML = '';
      items.forEach((it, n) => {
        const li = document.createElement('li');
        if (it.used) li.className = 'used';
        if (n === cur) li.classList.add('on');
        const a = document.createElement('span'); a.textContent = it.label;
        const b = document.createElement('small'); b.textContent = it.sub || '';
        li.append(a, b);
        li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(n); });
        list.appendChild(li);
      });
      list.hidden = !items.length;
    };
    const pick = (n) => { const it = items[n]; if (!it || it.used) return; close(); input.value = ''; onPick(it.value); };
    input.addEventListener('input', () => { items = search(kata(input.value)); cur = items.length ? 0 : -1; draw(); });
    input.addEventListener('blur', close);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { cur = Math.min(items.length - 1, cur + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter') pick(cur);
      else if (e.key === 'Escape') close();
    });
  }

  const find = (keys, q) => {
    const hit = [];
    keys.forEach((k, i) => { const p = k.indexOf(q); if (p >= 0) hit.push([p, i]); });
    return hit.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 40).map((h) => h[1]);
  };

  combo($('moveInput'), $('moveList'), (q) => {
    if (!q) return [];
    const used = new Set(asked.map((a) => a.mv));
    return find(moveKey, q).map((i) => ({ value: i, label: MOVES[i].n, sub: TYPE_JA[MOVES[i].t] || MOVES[i].t, used: used.has(i) }));
  }, (mv) => {
    if (over) return setMsg('このゲームは終了しています。「新しいゲーム」を押してください。', 'ng');
    asked.push({ mv, yes: learns(target, mv) });
    setMsg('', ''); render();
  });

  combo($('monInput'), $('monList'), (q) => {
    if (!q) return [];
    return find(monKey, q).map((i) => ({ value: i, label: MONS[i].name, sub: '#' + MONS[i].dex }));
  }, (i) => {
    if (over) return setMsg('このゲームは終了しています。「新しいゲーム」を押してください。', 'ng');
    const t = MONS[target], g = MONS[i];
    if (g.fam === t.fam) {
      over = true;
      const note = i === target ? '' : `(正解は${t.name}。同じ進化系統なので正解扱い)`;
      setImg($('aImg'), target);
      setMsg(`正解! ${g.name} ― 質問${asked.length}回・はずれ${misses}回 ${note}`, 'ok');
    } else {
      misses++; setMsg(`${g.name}ではありません…`, 'ng'); render();
    }
  });

  $('candBtn').addEventListener('click', () => { if ($('cands').hidden) showCands(); else $('cands').hidden = true; });
  $('giveUp').addEventListener('click', () => {
    if (over) return; over = true;
    setMsg(`正解は ${MONS[target].name} でした`, 'ng');
  });
  $('restart').addEventListener('click', newGame);
  newGame();

  // ===== モードB: わざの組み合わせで特定 =====
  let bt, bMoves, bDone, bMin, bHintMove;
  const accepted = (i) => MONS[i].all || MONS[i].fam === MONS[bt].fam;
  const bResults = () => MONS.map((p, i) => i).filter((i) => bMoves.every((m) => learns(i, m)));
  const bSolved = (res) => bMoves.length > 0 && res.every(accepted) && res.includes(bt);

  // 最小個数のわざの組み合わせを総当たりで求める(ビット集合のAND)
  const W = Math.ceil(MONS.length / 32);
  const bitsOf = (m) => { const b = new Uint32Array(W); MONS.forEach((p, i) => { if (learns(i, m)) b[i >> 5] |= 1 << (i & 31); }); return b; };
  function bOptimal() {
    const bad = new Uint32Array(W);
    MONS.forEach((p, i) => { if (!accepted(i)) bad[i >> 5] |= 1 << (i & 31); });
    const cand = MONS[bt].mv, bits = cand.map(bitsOf);
    const hit = (cur) => { for (let w = 0; w < W; w++) if (cur[w] & bad[w]) return true; return false; };
    const all = new Uint32Array(W).fill(0xffffffff);
    for (let k = 1; k <= 6; k++) {
      const pick = [];
      const rec = (start, cur) => {
        if (pick.length === k) return !hit(cur);
        for (let j = start; j < cand.length; j++) {
          const nx = new Uint32Array(W); for (let w = 0; w < W; w++) nx[w] = cur[w] & bits[j][w];
          pick.push(cand[j]);
          if (rec(j + 1, nx)) return true;
          pick.pop();
        }
        return false;
      };
      if (rec(0, all)) return pick.slice();
    }
    return [];
  }
  const imgUrl = (n) => 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + n + '.png';
  // 公式アートワーク(PokeAPI/sprites経由)。フォルム画像が無ければ図鑑番号の画像、それも無ければ非表示
  const IMG_KEY = 'pokeMoveQuiz.img';
  let showImg = true;
  try { showImg = localStorage.getItem(IMG_KEY) !== 'off'; } catch (e) { /* 既定はオン */ }
  function setImg(img, i) {
    if (!showImg) { img.hidden = true; img.removeAttribute('src'); return; }
    img.hidden = false; img.src = imgUrl(MONS[i].id);
    img.onerror = () => { img.onerror = () => { img.hidden = true; }; img.src = imgUrl(MONS[i].dex); };
    img.alt = MONS[i].name;
  }

  // pick を渡すとそのポケモンをお題にする。省略時はランダム
  function bNew(pick) {
    if (pick !== undefined) { bt = pick; bMin = bOptimal().length; }
    else {
      const pool = MONS.map((p, i) => i).filter((i) => !MONS[i].all);
      // 「覚えるわざ」のAND検索だけでは特定できないポケモン(コイキング等)はランダム出題しない
      do { bt = pool[Math.floor(Math.random() * pool.length)]; bMin = bOptimal().length; } while (!bMin);
    }
    bMoves = []; bDone = false; bHintMove = null; $('bInput').value = '';
    $('bHintBtn').disabled = bMin < 2;
    $('bHintBtn').title = bMin < 2 ? '最小1個の問題ではヒントはありません' : '';
    $('bMin').textContent = bMin || '特定不能';
    setImg($('bImg'), bt);
    $('bTarget').innerHTML = '';
    const s = document.createElement('small'); s.textContent = ' #' + MONS[bt].dex;
    $('bTarget').append(MONS[bt].name, s);
    $('bMsg').textContent = ''; $('bMsg').className = 'msg';
    bRender();
  }

  function bRender() {
    const res = bResults();
    const chips = $('bChips'); chips.innerHTML = '';
    bMoves.forEach((m, k) => {
      const d = document.createElement('span'); d.className = 'chip';
      const x = document.createElement('button'); x.textContent = '×';
      x.addEventListener('click', () => { bMoves.splice(k, 1); bDone = false; bMsg('', ''); bRender(); });
      d.append(MOVES[m].n, x); chips.appendChild(d);
    });
    bGrid();
    $('bCount').textContent = bMoves.length ? `${res.length}匹` : '(わざ未選択)';
    const ul = $('bResult'); ul.innerHTML = '';
    if (bMoves.length) res.forEach((i) => {
      const li = document.createElement('li'); li.textContent = MONS[i].name;
      li.className = i === bt ? 'me' : accepted(i) ? 'ok' : '';
      ul.appendChild(li);
    });
    if (bMoves.length && !res.includes(bt) && !MONS[bt].all) bMsg('お題のポケモンが覚えないわざが含まれています', 'ng');
    else if (bSolved(res)) {
      bDone = true;
      bMsg(`成功! ${bMoves.length}個のわざで特定(最小は${bMin}個${bMoves.length <= bMin ? ' — 最小達成!' : ''})`, 'ok');
    } else if (!bDone) bMsg('', '');
  }
  const bMsg = (t, c) => { $('bMsg').textContent = t; $('bMsg').className = 'msg ' + c; };

  // お題が覚えるわざの一覧から選ぶ(入力欄は絞り込み用)
  function bGrid() {
    const q = kata($('bInput').value), grid = $('bGrid'); grid.innerHTML = '';
    const list = MONS[bt].mv.filter((m) => moveKey[m].includes(q))
      .sort((x, y) => MOVES[x].t.localeCompare(MOVES[y].t) || x - y);
    list.forEach((m) => {
      const b = document.createElement('button');
      b.className = 'mv' + (bMoves.includes(m) ? ' sel' : '');
      b.textContent = MOVES[m].n; b.title = TYPE_JA[MOVES[m].t] || MOVES[m].t;
      b.addEventListener('click', () => {
        const k = bMoves.indexOf(m);
        if (k >= 0) bMoves.splice(k, 1); else bMoves.push(m);
        bDone = false; bRender();
      });
      grid.appendChild(b);
    });
    if (!list.length) grid.textContent = '該当するわざがありません';
  }
  $('bInput').addEventListener('input', bGrid);

  // ヒント: 最小解に含まれるわざを1個だけ教える(問題ごとに固定)
  $('bHintBtn').addEventListener('click', () => {
    if (bHintMove === null) { const sol = bOptimal(); bHintMove = sol[Math.floor(Math.random() * sol.length)]; }
    bMsg(MOVES[bHintMove].n, '');
  });
  $('bNext').addEventListener('click', () => bNew());
  $('bClear').addEventListener('click', () => { bMoves = []; bDone = false; bMsg('', ''); bRender(); });
  $('bHint').addEventListener('click', () => bMin ? bMsg('答え: ' + bOptimal().map((m) => MOVES[m].n).join(' + '), '') : bMsg('このポケモンは「覚えるわざ」の組み合わせだけでは特定できません', 'ng'));
  $('imgToggle').checked = showImg;
  $('imgToggle').addEventListener('change', () => {
    showImg = $('imgToggle').checked;
    try { localStorage.setItem(IMG_KEY, showImg ? 'on' : 'off'); } catch (e) { /* 保存不可でも動作 */ }
    setImg($('bImg'), bt);
    if (over) setImg($('aImg'), target); else $('aImg').hidden = true;
  });
  const MODE_KEY = 'pokeMoveQuiz.mode';
  const setMode = (b) => {
    try { localStorage.setItem(MODE_KEY, b ? 'combo' : 'ask'); } catch (e) { /* 保存できなくても動作に影響なし */ }
    $('modeA').hidden = b; $('modeB').hidden = !b;
    $('tabA').classList.toggle('on', !b); $('tabB').classList.toggle('on', b);
  };
  $('tabA').addEventListener('click', () => setMode(false));
  $('tabB').addEventListener('click', () => setMode(true));
  bNew();
  let saved = null;
  try { saved = localStorage.getItem(MODE_KEY); } catch (e) { /* 未保存扱い */ }
  setMode(saved !== 'ask');
})();
