(function () {
  "use strict";

  const R = window.VoidRules;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value, withTime = false) {
    if (!value) return "—";
    const date = new Date(value);
    const options = withTime
      ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "2-digit", day: "2-digit" };
    return new Intl.DateTimeFormat("zh-CN", options).format(date);
  }

  function suitMark(suit, rank = "") {
    const data = R.SUITS[suit];
    return `<span class="suit-mark suit-${suit}" aria-label="${data.name}${rank ? ` ${rank}` : ""}"><b>${escapeHtml(rank)}</b>${data.symbol}<small>${data.name}</small></span>`;
  }

  function modeName(mode) {
    return mode === "voidVoices" ? "《虚空之声》" : "标准模式";
  }

  function renderHome(state) {
    const activeCount = Object.values(state.callers.cards).filter((card) => card.active).length;
    const last = state.history[0];
    return `
      <section class="home-view view-pad">
        <div class="hero-grid">
          <div class="hero-copy">
            <p class="eyebrow">INDEPENDENT AM BROADCAST SYSTEM</p>
            <h1>虚空电台<br><span>1680 AM</span></h1>
            <p class="hero-intro">构建今晚的播放列表，接听黑暗中的陌生声音，并让他们的故事穿过一次又一次广播。</p>
            <div class="hero-actions">
              ${state.active ? '<button class="button primary" data-action="continue-broadcast">继续广播</button>' : ""}
              <button class="button ${state.active ? "secondary" : "primary"}" data-action="start-broadcast">开始广播</button>
            </div>
          </div>
          <div class="tuner-panel" aria-label="模拟调谐器装饰">
            <div class="tuner-scale"><span>550</span><span>900</span><span>1200</span><span>1680</span></div>
            <div class="tuner-track"><i></i></div>
            <div class="scope"><svg viewBox="0 0 600 140" role="img" aria-label="无线电信号波形"><path d="M0 72 C20 72 22 72 38 72 S56 72 70 72 84 15 100 15 116 128 134 128 151 72 168 72 186 72 199 45 214 45 231 98 248 98 266 72 286 72 304 72 322 28 340 28 359 116 378 116 398 72 421 72 444 72 460 58 476 58 493 84 510 84 528 72 550 72 600 72"/></svg></div>
            <div class="console-readout">
              <span>CHANNEL</span><strong>1680</strong><small>kHz / NIGHT SERVICE</small>
            </div>
          </div>
        </div>
        <div class="home-lower">
          <section class="status-strip" aria-label="存档状态">
            <div><span>LAST BROADCAST</span><strong>${last ? formatDate(last.endedAt) : "NO SIGNAL"}</strong></div>
            <div><span>ACTIVE CALLERS</span><strong>${String(activeCount).padStart(2, "0")} / 16</strong></div>
            <div><span>ARCHIVED SHOWS</span><strong>${String(state.history.length).padStart(2, "0")}</strong></div>
          </section>
          <nav class="menu-grid" aria-label="主菜单">
            <button class="menu-card" data-action="show-archive"><span>01</span><strong>人物档案</strong><small>CALLER ARCHIVE</small></button>
            <button class="menu-card" data-action="show-history"><span>02</span><strong>广播历史</strong><small>BROADCAST LOG</small></button>
            <button class="menu-card" data-action="show-settings"><span>03</span><strong>设置与关于</strong><small>SYSTEM PANEL</small></button>
          </nav>
          <section class="mode-switch-panel">
            <div><span class="panel-index">MODE SELECT</span><h2>《虚空之声》扩展</h2><p>替换来电主题、点歌以及后续来电表。</p></div>
            <label class="toggle ${state.active ? "disabled" : ""}">
              <input type="checkbox" data-action="toggle-expansion" ${state.settings.expansionEnabled ? "checked" : ""} ${state.active ? "disabled" : ""}>
              <span><b>OFF</b><b>ON</b></span>
            </label>
          </section>
        </div>
      </section>`;
  }

  function renderProgress(broadcast) {
    return R.SUIT_ORDER.map((suit, index) => {
      const state = index < broadcast.segmentIndex ? "done" : index === broadcast.segmentIndex ? "current" : "future";
      return `<li class="${state}"><span>${R.SUITS[suit].symbol}</span><small>${R.SUITS[suit].name}</small><i></i></li>`;
    }).join("");
  }

  function renderPlaylist(broadcast, compact = false) {
    const entries = broadcast.playlist || [];
    if (!entries.length) return '<p class="empty-copy">等待第一首歌曲进入信号链。</p>';
    let number = 0;
    return R.SUIT_ORDER.map((suit) => {
      const songs = entries.filter((song) => song.segment === suit);
      if (!songs.length) return "";
      return `<section class="playlist-group"><h3>${R.SUITS[suit].symbol} ${R.SUITS[suit].label}</h3>${songs.map((song) => {
        number += 1;
        return `<article class="playlist-item"><span>${String(number).padStart(2, "0")}</span><div><strong>${escapeHtml(song.title || "未命名歌曲")}</strong><small>${escapeHtml(song.artist || "未知艺术家")}</small></div><em>${song.sourceType === "request" ? "REQUEST" : escapeHtml(song.card)}</em></article>`;
      }).join("")}</section>`;
    }).join("");
  }

  function renderSongCards(broadcast) {
    const segment = broadcast.segments[broadcast.segmentIndex];
    return `<div class="song-card-grid">${segment.songs.map((song, index) => `
      <article class="song-card ${song.confirmed ? "confirmed" : ""}" data-song-id="${song.id}">
        <div class="song-card-head">
          ${song.sourceType === "request" ? '<span class="request-badge">REQUEST</span>' : suitMark(song.segment, song.rank)}
          <div class="order-controls" aria-label="调整播放顺序">
            <button class="icon-button" data-action="move-song" data-index="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="上移">↑</button>
            <button class="icon-button" data-action="move-song" data-index="${index}" data-direction="1" ${index === segment.songs.length - 1 ? "disabled" : ""} aria-label="下移">↓</button>
          </div>
        </div>
        ${song.sourceType === "request"
          ? `<div class="request-prompts"><p><strong>点歌者要求</strong>${escapeHtml(song.prompt)}</p><p><strong>${R.SUITS[song.segment].name}版块主题</strong>${escapeHtml(song.segmentTheme || R.SEGMENTS[song.segment].description)}</p></div>`
          : `<p class="rule-prompt">${escapeHtml(song.prompt)}</p>`}
        <label>歌曲名<input type="text" data-song-field="title" data-song-id="${song.id}" value="${escapeHtml(song.title)}" autocomplete="off"></label>
        <label>艺术家<input type="text" data-song-field="artist" data-song-id="${song.id}" value="${escapeHtml(song.artist)}" autocomplete="off"></label>
        <label>备注 <small>可选</small><textarea rows="2" data-song-field="note" data-song-id="${song.id}">${escapeHtml(song.note)}</textarea></label>
        <button class="button small ${song.confirmed ? "secondary" : "primary"}" data-action="confirm-song" data-song-id="${song.id}">${song.confirmed ? "已确认 · 修改" : "确认歌曲"}</button>
      </article>`).join("")}</div>`;
  }

  function dieControl(call, table, label, value, text) {
    return `<section class="die-result">
      <div class="die-face" aria-label="骰子结果 ${value}">${value}</div>
      <div><span>${label}</span><p>${escapeHtml(text)}</p><div class="inline-actions"><button class="text-button" data-action="reroll" data-table="${table}">重新掷骰</button><label class="manual-roll">手动选择<select data-action="manual-roll" data-table="${table}">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === value ? "selected" : ""}>${n}</option>`).join("")}</select></label></div></div>
    </section>`;
  }

  function renderCaller(broadcast) {
    const segment = broadcast.segments[broadcast.segmentIndex];
    const call = segment.caller;
    const suit = R.SUITS[call.suit];
    const relationText = {
      currentSong: "这名来电者因为你当前播放的歌曲而打来电话。",
      request: "这名来电者打来电话点歌。",
      conversation: "这名来电者与音乐没有特别关系。对方只是想和人聊天。"
    }[call.relation];
    const relationAction = call.relation === "currentSong"
      ? `<section class="relation-action"><h3>关联歌曲</h3><p>按照牌面数值，这名来电者正在谈论下面这首歌曲。</p><article class="linked-song"><span>${escapeHtml(call.linkedSongCard || "—")}</span><div><strong>${escapeHtml(call.linkedSongTitle || "未命名歌曲")}</strong><small>${escapeHtml(segment.songs.find((song) => song.id === call.linkedSongId)?.artist || "未知艺术家")}</small></div></article></section>`
      : call.relation === "request"
        ? `<section class="relation-action"><h3>点歌请求</h3><p>这名来电者正在点歌。是否满足这个请求？</p><div class="inline-actions"><button class="button small primary" data-action="decide-request" data-value="true">接受</button><button class="button small secondary" data-action="decide-request" data-value="false">拒绝</button></div>${call.requestAccepted === true ? dieControl(call, "request", "点歌表", call.requestRoll, call.requestPrompt) : call.requestAccepted === false ? '<p class="decision-note">请求已拒绝，不产生后续歌曲。</p>' : ""}</section>`
        : "";

    return `<div class="caller-layout">
      <section class="caller-id-panel">
        <p class="eyebrow">CALLER INCOMING / CALL ${call.appearance} OF 4</p>
        <div class="caller-card">${suitMark(call.suit, call.rank)}<div class="caller-card-art" aria-hidden="true"><svg viewBox="0 0 240 100"><path d="M8 55 H48 L58 30 L72 78 L88 42 L101 55 H132 C139 38 151 29 166 29 C184 29 198 42 202 60 M151 60 C155 51 162 47 170 47 C180 47 188 54 190 65 M171 68 H171.5"/><circle cx="171" cy="68" r="3"/></svg><b>1680</b><small>AM SIGNAL / LINE ${call.appearance}</small></div><span>${escapeHtml(call.cardId)}</span></div>
        <h2>${call.rank} ${suit.symbol}</h2>
        <p>${escapeHtml(R.CALLER_RANKS[call.rank])}</p>
        <dl><div><dt>来电次数</dt><dd>${call.appearance} / 4</dd></div><div><dt>情绪</dt><dd>${escapeHtml(call.mood)}</dd></div></dl>
      </section>
      <div class="caller-workspace">
        <section class="relation-banner"><span>CALL TYPE</span><p>${relationText}</p></section>
        ${call.previousNotes.length ? `<section class="previous-calls"><h3>PREVIOUS CALLS</h3>${call.previousNotes.map((note, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><p>“${escapeHtml(note.text)}”</p></article>`).join("")}</section>` : ""}
        ${dieControl(call, "topic", `${suit.name}：${call.mood}`, call.topicRoll, call.topic)}
        ${call.followup ? dieControl(call, "followup", `第${["", "一", "二", "三", "四"][call.appearance]}次来电`, call.followupRoll, call.followup) : ""}
        ${relationAction}
        <section class="call-note"><label for="caller-note">为这次来电留下一个词或一句简短记录</label><textarea id="caller-note" rows="3" maxlength="240">${escapeHtml(call.note)}</textarea><button class="button primary" data-action="save-call">保存并结束通话</button></section>
      </div>
    </div>`;
  }

  function renderBroadcastMain(broadcast) {
    const suit = R.SUIT_ORDER[broadcast.segmentIndex];
    const segmentRule = R.SEGMENTS[suit];
    const segment = broadcast.segments[broadcast.segmentIndex];
    if (broadcast.phase === "segmentIntro") return `
      <section class="phase-panel intro-phase"><p class="eyebrow">SONG SEGMENT ${broadcast.segmentIndex + 1}</p>${suitMark(suit)}<h1>${segmentRule.title}</h1><p class="large-rule">${escapeHtml(segmentRule.description)}</p>${broadcast.pendingRequest && broadcast.pendingRequest.targetSuit === suit ? `<p class="pending-request"><strong>点歌进入本版块</strong>${escapeHtml(broadcast.pendingRequest.prompt)}<br>本版块将抽取 2 张普通歌曲牌。</p>` : ""}<button class="button primary" data-action="draw-songs">抽取歌曲牌</button></section>`;
    if (broadcast.phase === "songEntry") return `
      <section class="phase-panel"><div class="section-heading"><div><p class="eyebrow">PLAYLIST ASSEMBLY</p><h1>选择并排列歌曲</h1></div><p>填写歌曲名和艺术家，逐张确认，再按你的喜好调整播放顺序。</p></div>${renderSongCards(broadcast)}<div class="phase-actions"><button class="button primary" data-action="songs-complete" ${segment.songs.every((song) => song.confirmed) ? "" : "disabled"}>歌单已就绪 · 接听来电</button></div></section>`;
    if (broadcast.phase === "callerReady") return `<section class="phase-panel intro-phase"><p class="eyebrow">PHONE LINE / STANDBY</p><div class="phone-glyph" aria-hidden="true">☎</div><h1>CALLER INCOMING</h1><p class="large-rule">在歌曲播放过程中，抽取一张来电者牌，勾勒出对方的身份以及你与对方的对话。</p><button class="button primary" data-action="draw-caller">接听来电</button></section>`;
    if (broadcast.phase === "callerActive") return renderCaller(broadcast);
    if (broadcast.phase === "segmentReview") return `<section class="phase-panel intro-phase"><p class="eyebrow">SEGMENT REVIEW</p><h1>回顾歌曲与来电</h1><p class="large-rule">歌曲结束后，你可以回顾这些歌曲，并按照你的喜好谈论与来电者的对话。</p>${segment.caller && segment.caller.closedStory ? '<p class="signal-lost"><strong>STORY CLOSED / SIGNAL LOST</strong>这是该人物的第四次来电。完整故事已写入档案，人物卡现已清零。</p>' : ""}<label class="review-field">本版块备注 <small>可选</small><textarea id="segment-review" rows="4" placeholder="这段内容会随广播历史保存。">${escapeHtml(segment.review)}</textarea></label><button class="button primary" data-action="advance-segment">${broadcast.segmentIndex === 3 ? "结束最后版块" : "进入下一个版块"}</button></section>`;
    return `<section class="phase-panel intro-phase"><p class="eyebrow">END OF TRANSMISSION</p><h1>广播结束</h1><p class="large-rule">最后一个歌曲版块已经完成。确认后，播放列表和本次来电将写入广播历史。</p><div class="summary-columns"><div><h2>TONIGHT'S PLAYLIST</h2>${renderPlaylist(broadcast, true)}</div><div><h2>CALLERS TONIGHT</h2>${broadcast.segments.map((item) => item.caller ? `<p class="summary-caller">${suitMark(item.caller.suit, item.caller.rank)} <span>CALL ${item.caller.appearance} / 4</span></p>` : "").join("")}</div></div><button class="button primary" data-action="finalize-broadcast">结束广播并保存</button></section>`;
  }

  function renderBroadcast(state) {
    const b = state.active;
    const suit = R.SUIT_ORDER[b.segmentIndex];
    return `<section class="broadcast-view">
      <aside class="broadcast-rail"><p class="eyebrow">BROADCAST ${String(state.history.length + 1).padStart(2, "0")}</p><h2>SEGMENT ${b.segmentIndex + 1} / 4</h2><strong>${R.SUITS[suit].label}</strong><ol class="segment-progress">${renderProgress(b)}</ol><dl class="broadcast-meta"><div><dt>MODE</dt><dd>${modeName(b.mode)}</dd></div><div><dt>STARTED</dt><dd>${formatDate(b.startedAt, true)}</dd></div></dl><button class="text-button" data-action="go-home">返回主界面并保留进度</button></aside>
      <main class="broadcast-main">${renderBroadcastMain(b)}</main>
      <aside class="playlist-rail"><div class="rail-heading"><span>LIVE LOG</span><h2>TONIGHT'S PLAYLIST</h2></div><div class="playlist-scroll">${renderPlaylist(b)}</div></aside>
    </section>`;
  }

  function allCallerCards(state) {
    const cards = [];
    R.SUIT_ORDER.forEach((suit) => ["J", "Q", "K", "A"].forEach((rank) => {
      const id = `${rank}${suit[0].toUpperCase()}`;
      cards.push(state.callers.cards[id] || { cardId: id, rank, suit, active: false, appearanceCount: 0, notes: [] });
    }));
    return cards;
  }

  function renderArchive(state) {
    return `<section class="archive-view view-pad"><div class="page-heading"><div><p class="eyebrow">PERSISTENT SIGNAL RECORD</p><h1>人物档案</h1></div><button class="button secondary" data-action="go-home">返回主界面</button></div><p class="page-intro">每张人头牌承载一名当前来电者。第四次通话结束后，故事归档，卡牌重新等待下一个声音。</p><div class="archive-grid">${allCallerCards(state).map((card) => `<button class="archive-card ${card.active ? "active" : "empty"}" data-action="show-caller" data-card-id="${card.cardId}">${suitMark(card.suit, card.rank)}<span>${card.appearanceCount} / 4</span><p>${card.active && card.notes.length ? `“${escapeHtml(card.notes[card.notes.length - 1].text)}”` : "NO ACTIVE SIGNAL"}</p></button>`).join("")}</div>${state.callers.closedStories.length ? `<section class="closed-stories"><h2>已结束的故事</h2><div class="log-list">${state.callers.closedStories.map((story) => `<article><strong>${story.rank}${R.SUITS[story.suit].symbol}</strong><span>${formatDate(story.closedAt)}</span><p>${story.notes.map((note) => escapeHtml(note.text)).join(" / ")}</p></article>`).join("")}</div></section>` : ""}</section>`;
  }

  function renderCallerDetail(state, cardId) {
    const card = allCallerCards(state).find((item) => item.cardId === cardId);
    return `<section class="detail-view view-pad"><div class="page-heading"><div><p class="eyebrow">CALLER FILE ${escapeHtml(card.cardId)}</p><h1>${card.rank} ${R.SUITS[card.suit].symbol}</h1></div><button class="button secondary" data-action="show-archive">返回档案</button></div><div class="detail-grid"><section class="identity-sheet">${suitMark(card.suit, card.rank)}<h2>身份提示</h2><p>${escapeHtml(R.CALLER_RANKS[card.rank])}</p><dl><div><dt>来电次数</dt><dd>${card.appearanceCount} / 4</dd></div><div><dt>当前状态</dt><dd>${card.active ? "ACTIVE" : "NO SIGNAL"}</dd></div></dl>${card.active ? `<button class="button danger" data-action="reset-caller" data-card-id="${card.cardId}">RESET CALLER</button>` : ""}</section><section class="call-log"><h2>CALL HISTORY</h2>${card.notes.length ? card.notes.map((note) => `<article><span>CALL ${String(note.appearance).padStart(2, "0")}</span><time>${formatDate(note.date, true)}</time><p>“${escapeHtml(note.text)}”</p>${note.followup ? `<small>${escapeHtml(note.followup)}</small>` : ""}</article>`).join("") : '<p class="empty-copy">这张牌尚未承载当前人物。</p>'}</section></div></section>`;
  }

  function renderHistory(state) {
    return `<section class="history-view view-pad"><div class="page-heading"><div><p class="eyebrow">TRANSMISSION ARCHIVE</p><h1>广播历史</h1></div><button class="button secondary" data-action="go-home">返回主界面</button></div>${state.history.length ? `<div class="history-list">${state.history.map((item, index) => `<button class="history-row" data-action="show-history-detail" data-history-index="${index}"><span>BROADCAST ${String(item.number || state.history.length - index).padStart(3, "0")}</span><strong>${formatDate(item.endedAt)}</strong><small>${item.playlist.length} TRACKS / ${item.segments.filter((s) => s.caller).length} CALLERS / ${modeName(item.mode)}</small><em>查看 →</em></button>`).join("")}</div>` : '<p class="empty-page">还没有完成的广播。电波会在你结束第一场节目后留下记录。</p>'}</section>`;
  }

  function renderHistoryDetail(state, index) {
    const item = state.history[index];
    if (!item) return renderHistory(state);
    return `<section class="detail-view view-pad"><div class="page-heading"><div><p class="eyebrow">TRANSMISSION RECORD</p><h1>BROADCAST ${String(item.number || 1).padStart(3, "0")}</h1><p>${formatDate(item.startedAt, true)} — ${formatDate(item.endedAt, true)} / ${modeName(item.mode)}</p></div><div class="page-actions"><button class="button secondary" data-action="show-history">返回历史</button><button class="button danger" data-action="delete-history" data-history-index="${index}">清除此记录</button></div></div><div class="history-detail-grid"><section><h2>完整播放列表</h2>${renderPlaylist(item, true)}</section><section><h2>来电记录</h2>${item.segments.map((segment) => segment.caller ? `<article class="history-call"><header>${suitMark(segment.caller.suit, segment.caller.rank)}<span>CALL ${segment.caller.appearance} / 4</span></header><p><strong>主题 ${segment.caller.topicRoll}</strong> ${escapeHtml(segment.caller.topic)}</p>${segment.caller.followup ? `<p><strong>后续 ${segment.caller.followupRoll}</strong> ${escapeHtml(segment.caller.followup)}</p>` : ""}${segment.caller.requestPrompt ? `<p><strong>点歌 ${segment.caller.requestRoll}</strong> ${escapeHtml(segment.caller.requestPrompt)}</p>` : ""}<blockquote>“${escapeHtml(segment.caller.note)}”</blockquote>${segment.review ? `<small>版块备注：${escapeHtml(segment.review)}</small>` : ""}</article>` : "").join("")}</section></div></section>`;
  }

  function renderSettings(state) {
    return `<section class="settings-view view-pad"><div class="page-heading"><div><p class="eyebrow">SYSTEM PANEL</p><h1>设置与关于</h1></div><button class="button secondary" data-action="go-home">返回主界面</button></div><div class="settings-grid"><section><h2>游戏模式</h2><div class="setting-row"><div><strong>《虚空之声》扩展</strong><p>替换所有来电者相关表格。广播进行中不可切换。</p></div><label class="toggle ${state.active ? "disabled" : ""}"><input type="checkbox" data-action="toggle-expansion" ${state.settings.expansionEnabled ? "checked" : ""} ${state.active ? "disabled" : ""}><span><b>OFF</b><b>ON</b></span></label></div><div class="setting-row"><div><strong>减少动态效果</strong><p>关闭波形、指示灯等氛围动画。</p></div><label class="toggle"><input type="checkbox" data-action="toggle-motion" ${state.settings.reducedMotion ? "checked" : ""}><span><b>OFF</b><b>ON</b></span></label></div></section><section><h2>本地数据</h2><p>所有设置、当前广播、人物卡和广播历史都只保存在当前浏览器的 localStorage 中。</p><button class="button danger" data-action="clear-data">清空所有浏览器存档</button></section><section><h2>关于本工具</h2><p>这是《虚空电台 VOID 1680 AM》的离线电子辅助工具。它负责洗牌、掷骰、查表和保存记录，不会替玩家创作歌曲、来电者或对话。</p><p>规则提示文字来自用户提供的中文版《虚空电台》主播指导手册。</p></section></div></section>`;
  }

  function modal(title, body, actions) {
    return `<div class="modal-backdrop" data-action="dismiss-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><p class="eyebrow">CONFIRM OPERATION</p><h2 id="modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p><div class="modal-actions">${actions}</div></section></div>`;
  }

  window.VoidUI = { escapeHtml, formatDate, renderHome, renderBroadcast, renderArchive, renderCallerDetail, renderHistory, renderHistoryDetail, renderSettings, modal };
})();
