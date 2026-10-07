(function () {
  "use strict";

  const S = window.VoidStorage;
  const G = window.VoidGame;
  const UI = window.VoidUI;

  const state = {
    settings: S.load("settings"),
    active: S.load("activeBroadcast"),
    callers: S.load("callers"),
    history: S.load("history"),
    view: S.load("activeBroadcast") ? "home" : "home",
    detail: null
  };

  const main = document.getElementById("app-main");
  const modalRoot = document.getElementById("modal-root");
  const toastRoot = document.getElementById("toast-root");
  const saveIndicator = document.getElementById("save-indicator");
  let saveTimer = null;

  function setReducedMotion() {
    document.body.classList.toggle("reduce-motion", Boolean(state.settings.reducedMotion));
  }

  function render() {
    if (state.view === "broadcast" && !state.active) state.view = "home";
    const views = {
      home: () => UI.renderHome(state),
      broadcast: () => UI.renderBroadcast(state),
      archive: () => UI.renderArchive(state),
      callerDetail: () => UI.renderCallerDetail(state, state.detail),
      history: () => UI.renderHistory(state),
      historyDetail: () => UI.renderHistoryDetail(state, state.detail),
      settings: () => UI.renderSettings(state)
    };
    main.innerHTML = (views[state.view] || views.home)();
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: state.settings.reducedMotion ? "auto" : "smooth" });
  }

  function markSaved(label = "SAVED LOCALLY") {
    clearTimeout(saveTimer);
    saveIndicator.textContent = label;
    saveTimer = setTimeout(() => { saveIndicator.textContent = "STANDBY"; }, 1800);
  }

  function persistActive() {
    S.save("activeBroadcast", state.active);
    markSaved();
  }

  function persistCallers() {
    S.save("callers", state.callers);
    markSaved();
  }

  function persistSettings() {
    S.save("settings", state.settings);
    markSaved();
  }

  function persistHistory() {
    S.save("history", state.history);
    markSaved();
  }

  function toast(message, type = "info") {
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    toastRoot.appendChild(item);
    setTimeout(() => item.remove(), 3200);
  }

  function showModal(html) {
    modalRoot.innerHTML = html;
    const focusTarget = modalRoot.querySelector("button");
    if (focusTarget) focusTarget.focus();
  }

  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function beginBroadcast() {
    state.active = G.createBroadcast(state.settings.expansionEnabled ? "voidVoices" : "standard");
    persistActive();
    state.view = "broadcast";
    render();
  }

  function currentSegment() {
    return state.active.segments[state.active.segmentIndex];
  }

  function updateSongField(target) {
    const song = currentSegment().songs.find((item) => item.id === target.dataset.songId);
    if (!song) return;
    song[target.dataset.songField] = target.value;
    if (song.confirmed) song.confirmed = false;
    G.syncPlaylist(state.active);
    persistActive();
  }

  function confirmSong(songId) {
    const song = currentSegment().songs.find((item) => item.id === songId);
    if (!song) return;
    if (!song.title.trim() || !song.artist.trim()) {
      toast("请填写歌曲名和艺术家后再确认。", "error");
      return;
    }
    song.title = song.title.trim();
    song.artist = song.artist.trim();
    song.note = song.note.trim();
    song.confirmed = true;
    G.syncPlaylist(state.active);
    persistActive();
    render();
  }

  function requestReadyForSave(call) {
    if (call.relation === "currentSong" && !call.linkedSongId) {
      toast("当前版块中没有可用于自动关联的数字歌曲牌。", "error");
      return false;
    }
    if (call.relation === "request" && call.requestAccepted === null) {
      toast("请先决定是否接受这次点歌。", "error");
      return false;
    }
    return true;
  }

  function syncPendingRequest() {
    const call = currentSegment().caller;
    if (call && call.relation === "request" && call.requestAccepted) {
      state.active.pendingRequest = {
        cardId: call.cardId,
        targetSuit: G.nextSuit(state.active),
        roll: call.requestRoll,
        prompt: call.requestPrompt
      };
    }
  }

  function handleAction(action, target) {
    switch (action) {
      case "go-home":
        state.view = "home";
        render();
        break;
      case "continue-broadcast":
        if (state.active) { state.view = "broadcast"; render(); }
        break;
      case "start-broadcast":
        if (state.active) {
          showModal(UI.modal(
            "当前有一场未完成的广播",
            "开始新广播将结束并覆盖当前进度。人物卡和已完成的广播历史不会被删除。",
            '<button class="button secondary" data-action="dismiss-modal">取消</button><button class="button danger" data-action="confirm-new-broadcast">放弃当前广播</button>'
          ));
        } else beginBroadcast();
        break;
      case "confirm-new-broadcast":
        closeModal();
        beginBroadcast();
        break;
      case "show-archive":
        state.view = "archive";
        render();
        break;
      case "show-history":
        state.view = "history";
        render();
        break;
      case "show-settings":
        state.view = "settings";
        render();
        break;
      case "show-caller":
        state.detail = target.dataset.cardId;
        state.view = "callerDetail";
        render();
        break;
      case "show-history-detail":
        state.detail = Number(target.dataset.historyIndex);
        state.view = "historyDetail";
        render();
        break;
      case "draw-songs":
        G.drawSongs(state.active);
        persistActive();
        render();
        break;
      case "move-song":
        G.moveSong(state.active, Number(target.dataset.index), Number(target.dataset.direction));
        persistActive();
        render();
        break;
      case "confirm-song":
        confirmSong(target.dataset.songId);
        break;
      case "songs-complete":
        if (!currentSegment().songs.every((song) => song.confirmed)) {
          toast("请确认本版块的每一首歌曲。", "error");
          return;
        }
        state.active.phase = "callerReady";
        persistActive();
        render();
        break;
      case "draw-caller":
        G.drawCaller(state.active, state.callers);
        persistActive();
        render();
        break;
      case "decide-request":
        G.decideRequest(state.active, target.dataset.value === "true");
        persistActive();
        render();
        break;
      case "reroll":
        G.rerollCallTable(currentSegment().caller, target.dataset.table, state.active.mode);
        syncPendingRequest();
        persistActive();
        render();
        break;
      case "save-call": { 
        const call = currentSegment().caller;
        if (!requestReadyForSave(call)) return;
        const noteField = document.getElementById("caller-note");
        try {
          G.saveCallerNote(state.active, state.callers, noteField ? noteField.value : "");
          persistCallers();
          persistActive();
          render();
        } catch (error) {
          toast(error.message, "error");
        }
        break;
      }
      case "advance-segment": { 
        const review = document.getElementById("segment-review");
        currentSegment().review = review ? review.value.trim() : "";
        G.advanceSegment(state.active);
        persistActive();
        render();
        break;
      }
      case "finalize-broadcast":
        G.finalizeBroadcast(state.active, state.history);
        persistHistory();
        state.active = null;
        S.save("activeBroadcast", null);
        state.view = "home";
        markSaved("TRANSMISSION ARCHIVED");
        render();
        toast("广播已写入历史。");
        break;
      case "reset-caller":
        showModal(UI.modal(
          `清除 ${target.dataset.cardId} 当前来电者`,
          "这会清除该人物的当前跨局记录，但不会删除已经完成的广播历史。",
          `<button class="button secondary" data-action="dismiss-modal">取消</button><button class="button danger" data-action="confirm-reset-caller" data-card-id="${target.dataset.cardId}">确认清除</button>`
        ));
        break;
      case "confirm-reset-caller":
        G.resetCaller(state.callers, target.dataset.cardId);
        persistCallers();
        closeModal();
        state.view = "archive";
        render();
        toast("人物卡已清零；广播历史保持不变。");
        break;
      case "delete-history": { 
        const historyIndex = Number(target.dataset.historyIndex);
        const item = state.history[historyIndex];
        if (!item) return;
        showModal(UI.modal(
          `清除 BROADCAST ${String(item.number || 1).padStart(3, "0")}`,
          "这会删除该场广播，并仅移除由该场广播产生的来电者人物记录。其他广播中的记录会保留。",
          `<button class="button secondary" data-action="dismiss-modal">取消</button><button class="button danger" data-action="confirm-delete-history" data-history-index="${historyIndex}">确认清除</button>`
        ));
        break;
      }
      case "confirm-delete-history":
        G.removeHistoryRecord(state.history, state.callers, Number(target.dataset.historyIndex));
        persistHistory();
        persistCallers();
        closeModal();
        state.view = "history";
        state.detail = null;
        render();
        toast("广播记录及该场广播产生的来电者记录已清除。");
        break;
      case "clear-data":
        showModal(UI.modal(
          "清空所有浏览器存档",
          "当前广播、人物卡、广播历史和设置都将永久删除。此操作无法撤销。",
          '<button class="button secondary" data-action="dismiss-modal">取消</button><button class="button danger" data-action="confirm-clear-data">永久清空</button>'
        ));
        break;
      case "confirm-clear-data":
        S.clearAll();
        state.settings = { expansionEnabled: false, reducedMotion: false, version: 1 };
        state.active = null;
        state.callers = { cards: {}, closedStories: [], version: 1 };
        state.history = [];
        setReducedMotion();
        closeModal();
        state.view = "home";
        render();
        toast("本地存档已清空。" );
        break;
      case "dismiss-modal":
        closeModal();
        break;
      default:
        break;
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "dismiss-modal" && target.classList.contains("modal-backdrop") && event.target.closest(".modal")) return;
    if (["toggle-expansion", "toggle-motion", "manual-roll"].includes(action)) return;
    handleAction(action, target);
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-song-field]")) updateSongField(event.target);
    if (event.target.id === "caller-note" && state.active) {
      currentSegment().caller.note = event.target.value;
      persistActive();
    }
    if (event.target.id === "segment-review" && state.active) {
      currentSegment().review = event.target.value;
      persistActive();
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    const action = target.dataset.action;
    if (action === "toggle-expansion") {
      if (state.active) {
        target.checked = state.settings.expansionEnabled;
        toast("广播进行中不能切换扩展模式。", "error");
        return;
      }
      state.settings.expansionEnabled = target.checked;
      persistSettings();
    } else if (action === "toggle-motion") {
      state.settings.reducedMotion = target.checked;
      setReducedMotion();
      persistSettings();
    } else if (action === "manual-roll") {
      G.selectCallTable(currentSegment().caller, target.dataset.table, target.value, state.active.mode);
      syncPendingRequest();
      persistActive();
      render();
    }
  });

  window.addEventListener("void1680:storage-error", () => {
    toast("浏览器拒绝写入本地存档。请检查隐私设置或存储空间。", "error");
  });

  window.addEventListener("storage", (event) => {
    if (Object.values(S.KEYS).includes(event.key)) {
      toast("另一窗口更新了存档；刷新页面可载入最新数据。" );
    }
  });

  setReducedMotion();
  render();
})();
