(function () {
  "use strict";

  const KEYS = {
    settings: "void1680_settings",
    activeBroadcast: "void1680_activeBroadcast",
    callers: "void1680_callers",
    history: "void1680_history"
  };

  const defaults = {
    settings: { expansionEnabled: false, reducedMotion: false, version: 1 },
    activeBroadcast: null,
    callers: { cards: {}, closedStories: [], version: 1 },
    history: []
  };

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function load(name) {
    try {
      const raw = localStorage.getItem(KEYS[name]);
      if (raw === null) return clone(defaults[name]);
      const value = JSON.parse(raw);
      if (name === "settings") return Object.assign(clone(defaults.settings), value);
      if (name === "callers") return Object.assign(clone(defaults.callers), value);
      return value;
    } catch (error) {
      console.warn(`无法读取 ${KEYS[name]}`, error);
      return clone(defaults[name]);
    }
  }

  function save(name, value) {
    try {
      localStorage.setItem(KEYS[name], JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`无法保存 ${KEYS[name]}`, error);
      window.dispatchEvent(new CustomEvent("void1680:storage-error"));
      return false;
    }
  }

  function clearAll() {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  }

  window.VoidStorage = { KEYS, load, save, clearAll };
})();
