(function () {
  "use strict";

  const R = window.VoidRules;

  function shuffle(values, random = Math.random) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function rollD6(random = Math.random) {
    return Math.floor(random() * 6) + 1;
  }

  function makeId(prefix) {
    const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `${prefix}-${stamp}-${random}`;
  }

  function buildSongDecks(random = Math.random) {
    return R.SUIT_ORDER.reduce((decks, suit) => {
      decks[suit] = shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10], random);
      return decks;
    }, {});
  }

  function buildCallerDeck(random = Math.random) {
    const cards = [];
    R.SUIT_ORDER.forEach((suit) => {
      ["J", "Q", "K", "A"].forEach((rank) => cards.push({
        id: `${rank}${suit[0].toUpperCase()}`,
        rank,
        suit
      }));
    });
    return shuffle(cards, random);
  }

  function createBroadcast(mode, random = Math.random) {
    return {
      id: makeId("broadcast"),
      number: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      mode,
      segmentIndex: 0,
      phase: "segmentIntro",
      songDecks: buildSongDecks(random),
      callerDeck: buildCallerDeck(random),
      segments: R.SUIT_ORDER.map((suit) => ({ suit, songs: [], caller: null, review: "" })),
      playlist: [],
      pendingRequest: null,
      completed: false,
      version: 1
    };
  }

  function currentSuit(broadcast) {
    return R.SUIT_ORDER[broadcast.segmentIndex];
  }

  function nextSuit(broadcast) {
    return R.SUIT_ORDER[broadcast.segmentIndex + 1] || null;
  }

  function classifyCaller(callerSuit, broadcast) {
    if (callerSuit === currentSuit(broadcast)) return "currentSong";
    if (nextSuit(broadcast) && callerSuit === nextSuit(broadcast)) return "request";
    return "conversation";
  }

  function drawSongs(broadcast) {
    const suit = currentSuit(broadcast);
    const pending = broadcast.pendingRequest && broadcast.pendingRequest.targetSuit === suit
      ? broadcast.pendingRequest
      : null;
    const count = pending ? 2 : 3;
    const drawn = broadcast.songDecks[suit].splice(0, count).map((rank) => ({
      id: makeId("song"),
      segment: suit,
      sourceType: "card",
      card: `${rank}${R.SUITS[suit].symbol}`,
      rank,
      prompt: R.SONG_PROMPTS[suit][rank],
      title: "",
      artist: "",
      note: "",
      confirmed: false
    }));

    if (pending) {
      drawn.push({
        id: makeId("song"),
        segment: suit,
        sourceType: "request",
        card: "REQUEST",
        rank: null,
        prompt: pending.prompt,
        segmentTheme: R.SEGMENTS[suit].description,
        title: "",
        artist: "",
        note: "",
        confirmed: false,
        requestedBy: pending.cardId
      });
      broadcast.pendingRequest = null;
    }

    broadcast.segments[broadcast.segmentIndex].songs = drawn;
    broadcast.phase = "songEntry";
    return drawn;
  }

  function syncPlaylist(broadcast) {
    const completed = broadcast.segments
      .slice(0, broadcast.segmentIndex)
      .flatMap((segment) => segment.songs);
    const current = broadcast.segments[broadcast.segmentIndex]
      ? broadcast.segments[broadcast.segmentIndex].songs.filter((song) => song.confirmed)
      : [];
    broadcast.playlist = completed.concat(current).map((song) => ({ ...song }));
  }

  function moveSong(broadcast, index, direction) {
    const songs = broadcast.segments[broadcast.segmentIndex].songs;
    const target = index + direction;
    if (target < 0 || target >= songs.length) return false;
    [songs[index], songs[target]] = [songs[target], songs[index]];
    syncPlaylist(broadcast);
    return true;
  }

  function closestSongForCaller(broadcast, rank) {
    const faceValues = { A: 1, J: 11, Q: 12, K: 13 };
    const target = faceValues[rank];
    const songs = broadcast.segments[broadcast.segmentIndex].songs
      .filter((song) => song.sourceType === "card" && Number.isFinite(song.rank));
    if (!songs.length || !target) return null;
    return songs.slice().sort((left, right) => {
      const distance = Math.abs(left.rank - target) - Math.abs(right.rank - target);
      return distance || left.rank - right.rank;
    })[0];
  }

  function drawCaller(broadcast, callerStore, random = Math.random) {
    const card = broadcast.callerDeck.shift();
    if (!card) throw new Error("来电者牌组已空");
    const existing = callerStore.cards[card.id] || null;
    const appearance = existing && existing.active ? existing.appearanceCount + 1 : 1;
    const storyId = existing && existing.active ? existing.currentStoryId : makeId(card.id);
    const mode = broadcast.mode;
    const topicRoll = rollD6(random);
    const relation = classifyCaller(card.suit, broadcast);
    const call = {
      id: makeId("call"),
      cardId: card.id,
      rank: card.rank,
      suit: card.suit,
      storyId,
      appearance,
      relation,
      topicRoll,
      topic: R.CALLER_TOPICS[mode][card.suit].prompts[topicRoll - 1],
      mood: R.CALLER_TOPICS[mode][card.suit].mood,
      followupRoll: null,
      followup: null,
      requestAccepted: null,
      requestRoll: null,
      requestPrompt: null,
      linkedSongId: null,
      linkedSongCard: null,
      linkedSongTitle: null,
      previousNotes: existing && existing.active ? existing.notes.slice() : [],
      note: "",
      saved: false,
      closedStory: false
    };
    if (appearance >= 2) {
      call.followupRoll = rollD6(random);
      call.followup = R.FOLLOWUPS[mode][appearance][call.followupRoll - 1];
    }
    if (relation === "currentSong") {
      const linkedSong = closestSongForCaller(broadcast, card.rank);
      if (linkedSong) {
        call.linkedSongId = linkedSong.id;
        call.linkedSongCard = linkedSong.card;
        call.linkedSongTitle = linkedSong.title;
      }
    }
    broadcast.segments[broadcast.segmentIndex].caller = call;
    broadcast.phase = "callerActive";
    return call;
  }

  function rerollCallTable(call, table, mode, random = Math.random) {
    const result = rollD6(random);
    if (table === "topic") {
      call.topicRoll = result;
      call.topic = R.CALLER_TOPICS[mode][call.suit].prompts[result - 1];
    } else if (table === "followup" && call.appearance >= 2) {
      call.followupRoll = result;
      call.followup = R.FOLLOWUPS[mode][call.appearance][result - 1];
    } else if (table === "request") {
      call.requestRoll = result;
      call.requestPrompt = R.REQUEST_TABLES[mode][result - 1];
    }
    return result;
  }

  function selectCallTable(call, table, value, mode) {
    const result = Math.max(1, Math.min(6, Number(value) || 1));
    if (table === "topic") {
      call.topicRoll = result;
      call.topic = R.CALLER_TOPICS[mode][call.suit].prompts[result - 1];
    } else if (table === "followup" && call.appearance >= 2) {
      call.followupRoll = result;
      call.followup = R.FOLLOWUPS[mode][call.appearance][result - 1];
    } else if (table === "request") {
      call.requestRoll = result;
      call.requestPrompt = R.REQUEST_TABLES[mode][result - 1];
    }
  }

  function decideRequest(broadcast, accepted, random = Math.random) {
    const call = broadcast.segments[broadcast.segmentIndex].caller;
    call.requestAccepted = accepted;
    if (accepted) {
      rerollCallTable(call, "request", broadcast.mode, random);
      broadcast.pendingRequest = {
        cardId: call.cardId,
        targetSuit: nextSuit(broadcast),
        roll: call.requestRoll,
        prompt: call.requestPrompt
      };
    } else {
      broadcast.pendingRequest = null;
      call.requestRoll = null;
      call.requestPrompt = null;
    }
  }

  function saveCallerNote(broadcast, callerStore, text) {
    const call = broadcast.segments[broadcast.segmentIndex].caller;
    const noteText = text.trim();
    if (!noteText) throw new Error("请先为这次来电留下一个词或一句简短记录。");
    const prior = callerStore.cards[call.cardId];
    const notes = prior && prior.active ? prior.notes.slice() : [];
    const note = {
      appearance: call.appearance,
      text: noteText,
      date: new Date().toISOString(),
      broadcastId: broadcast.id,
      topicRoll: call.topicRoll,
      topic: call.topic,
      followupRoll: call.followupRoll,
      followup: call.followup
    };
    notes.push(note);
    call.note = noteText;
    call.saved = true;

    if (call.appearance >= 4) {
      callerStore.closedStories.unshift({
        storyId: call.storyId,
        cardId: call.cardId,
        rank: call.rank,
        suit: call.suit,
        notes,
        closedAt: new Date().toISOString(),
        reason: "fourthCall"
      });
      callerStore.cards[call.cardId] = {
        cardId: call.cardId,
        rank: call.rank,
        suit: call.suit,
        active: false,
        currentStoryId: null,
        appearanceCount: 0,
        notes: []
      };
      call.closedStory = true;
    } else {
      callerStore.cards[call.cardId] = {
        cardId: call.cardId,
        rank: call.rank,
        suit: call.suit,
        active: true,
        currentStoryId: call.storyId,
        appearanceCount: call.appearance,
        notes
      };
    }
    broadcast.phase = "segmentReview";
    return note;
  }

  function resetCaller(callerStore, cardId) {
    const card = callerStore.cards[cardId];
    if (!card) return;
    callerStore.cards[cardId] = {
      cardId,
      rank: card.rank,
      suit: card.suit,
      active: false,
      currentStoryId: null,
      appearanceCount: 0,
      notes: []
    };
  }

  function removeHistoryRecord(history, callerStore, index) {
    const removed = history[index];
    if (!removed) return null;
    history.splice(index, 1);

    Object.keys(callerStore.cards).forEach((cardId) => {
      const card = callerStore.cards[cardId];
      const notes = (card.notes || []).filter((note) => note.broadcastId !== removed.id);
      if (notes.length === (card.notes || []).length) return;
      if (!notes.length) {
        resetCaller(callerStore, cardId);
        return;
      }
      card.notes = notes.map((note, noteIndex) => ({ ...note, appearance: noteIndex + 1 }));
      card.appearanceCount = card.notes.length;
      card.active = true;
    });

    callerStore.closedStories = (callerStore.closedStories || []).map((story) => ({
      ...story,
      notes: (story.notes || []).filter((note) => note.broadcastId !== removed.id)
    })).filter((story) => story.notes.length > 0);
    return removed;
  }

  function advanceSegment(broadcast) {
    syncPlaylist(broadcast);
    if (broadcast.segmentIndex >= R.SUIT_ORDER.length - 1) {
      broadcast.phase = "transmissionEnd";
      return false;
    }
    broadcast.segmentIndex += 1;
    broadcast.phase = "segmentIntro";
    return true;
  }

  function finalizeBroadcast(broadcast, history) {
    broadcast.completed = true;
    broadcast.endedAt = new Date().toISOString();
    broadcast.number = history.length + 1;
    syncPlaylist(broadcast);
    const snapshot = JSON.parse(JSON.stringify(broadcast));
    history.unshift(snapshot);
    return snapshot;
  }

  window.VoidGame = {
    shuffle,
    rollD6,
    buildSongDecks,
    buildCallerDeck,
    createBroadcast,
    currentSuit,
    nextSuit,
    classifyCaller,
    closestSongForCaller,
    drawSongs,
    syncPlaylist,
    moveSong,
    drawCaller,
    rerollCallTable,
    selectCallTable,
    decideRequest,
    saveCallerNote,
    resetCaller,
    removeHistoryRecord,
    advanceSegment,
    finalizeBroadcast
  };
})();
