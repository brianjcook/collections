const state = {
  tiles: [],
  zoneById: new Map(),
  zoneOrder: {
    pool: [],
    yellow: [],
    green: [],
    blue: [],
    purple: [],
  },
  selectedId: null,
};

const statusEl = document.getElementById("status");
const manualWordsEl = document.getElementById("manualWords");
const manualPanelEl = document.getElementById("manualPanel");
const fetchTodayBtn = document.getElementById("fetchTodayBtn");
const loadManualBtn = document.getElementById("loadManualBtn");
const resetBtn = document.getElementById("resetBtn");

const zones = Array.from(document.querySelectorAll(".dropzone"));
let dragId = null;
let dropHint = null;

function trackEvent(name, params = {}) {
  if (typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function openManualPanel() {
  if (manualPanelEl) {
    manualPanelEl.open = true;
  }
}

function closeManualPanel() {
  if (manualPanelEl) {
    manualPanelEl.open = false;
  }
}

function clearDropIndicators() {
  for (const zone of zones) {
    zone.classList.remove("active");
  }
  for (const tile of document.querySelectorAll(".tile.insert-before, .tile.insert-after")) {
    tile.classList.remove("insert-before", "insert-after");
  }
  dropHint = null;
}

function normalizeWords(words) {
  return words
    .map((w) => String(w).trim())
    .filter(Boolean)
    .map((w) => w.toUpperCase());
}

function setWords(words) {
  const normalized = normalizeWords(words).slice(0, 16);
  state.tiles = normalized.map((text, index) => ({ id: `w${index + 1}`, text }));
  state.zoneById.clear();
  state.zoneOrder.pool = [];
  state.zoneOrder.yellow = [];
  state.zoneOrder.green = [];
  state.zoneOrder.blue = [];
  state.zoneOrder.purple = [];
  state.selectedId = null;

  for (const tile of state.tiles) {
    state.zoneById.set(tile.id, "pool");
    state.zoneOrder.pool.push(tile.id);
  }

  render();
}

function removeFromCurrentZone(tileId) {
  const currentZone = state.zoneById.get(tileId);
  if (!currentZone || !state.zoneOrder[currentZone]) return;
  state.zoneOrder[currentZone] = state.zoneOrder[currentZone].filter((id) => id !== tileId);
}

function getTileText(tileId) {
  return state.tiles.find((tile) => tile.id === tileId)?.text || "";
}

function moveTileToZone(tileId, zoneName, targetId = null, placeAfter = false, inputMode = "unknown") {
  if (!tileId || !state.zoneById.has(tileId)) return;
  if (!state.zoneOrder[zoneName]) return;

  const fromZone = state.zoneById.get(tileId);
  const fromIndex = state.zoneOrder[fromZone]?.indexOf(tileId) ?? -1;
  removeFromCurrentZone(tileId);
  const targetOrder = state.zoneOrder[zoneName];

  if (targetId && targetOrder.includes(targetId)) {
    let insertIndex = targetOrder.indexOf(targetId);
    if (placeAfter) insertIndex += 1;
    targetOrder.splice(insertIndex, 0, tileId);
  } else {
    targetOrder.push(tileId);
  }

  state.zoneById.set(tileId, zoneName);
  const toIndex = targetOrder.indexOf(tileId);
  const didChange = fromZone !== zoneName || fromIndex !== toIndex;
  state.selectedId = null;
  render();

  if (didChange) {
    trackEvent("tile_move", {
      from_zone: fromZone,
      to_zone: zoneName,
      is_reorder: fromZone === zoneName,
      input_mode: inputMode,
      word_text: getTileText(tileId),
    });
  }
}

function render() {
  for (const zone of zones) {
    zone.innerHTML = "";
  }

  const tilesById = new Map(state.tiles.map((tile) => [tile.id, tile]));

  for (const zone of zones) {
    const zoneName = zone.dataset.zone;
    const orderedIds = state.zoneOrder[zoneName] || [];

    for (const tileId of orderedIds) {
      const tileModel = tilesById.get(tileId);
      if (!tileModel) continue;

      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.textContent = tileModel.text;
      tile.draggable = true;
      tile.dataset.id = tileModel.id;

      if (state.selectedId === tileModel.id) {
        tile.classList.add("selected");
      }

      tile.addEventListener("click", () => {
        state.selectedId = state.selectedId === tileModel.id ? null : tileModel.id;
        render();
      });

      tile.addEventListener("dragstart", (event) => {
        dragId = tileModel.id;
        tile.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", tileModel.id);
      });

      tile.addEventListener("dragend", () => {
        dragId = null;
        tile.classList.remove("dragging");
        clearDropIndicators();
      });

      zone.appendChild(tile);
    }
  }
}

for (const zone of zones) {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("active");

    if (!dragId) return;

    for (const tile of zone.querySelectorAll(".tile.insert-before, .tile.insert-after")) {
      tile.classList.remove("insert-before", "insert-after");
    }

    const targetTile = event.target.closest(".tile");
    if (!targetTile || !targetTile.dataset.id || targetTile.dataset.id === dragId) {
      dropHint = { zoneName: zone.dataset.zone, targetId: null, placeAfter: false };
      return;
    }

    const rect = targetTile.getBoundingClientRect();
    const placeAfter = event.clientX > rect.left + rect.width / 2;
    targetTile.classList.add(placeAfter ? "insert-after" : "insert-before");
    dropHint = { zoneName: zone.dataset.zone, targetId: targetTile.dataset.id, placeAfter };
  });

  zone.addEventListener("dragleave", (event) => {
    if (event.relatedTarget && zone.contains(event.relatedTarget)) return;
    zone.classList.remove("active");
    for (const tile of zone.querySelectorAll(".tile.insert-before, .tile.insert-after")) {
      tile.classList.remove("insert-before", "insert-after");
    }
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    const droppedId = dragId || event.dataTransfer.getData("text/plain");
    const hintedZone = dropHint?.zoneName || zone.dataset.zone;
    const hintedTarget = dropHint?.targetId || null;
    const hintedAfter = Boolean(dropHint?.placeAfter);
    clearDropIndicators();

    if (hintedTarget && hintedTarget !== droppedId) {
      moveTileToZone(droppedId, hintedZone, hintedTarget, hintedAfter, "drag");
      return;
    }

    moveTileToZone(droppedId, hintedZone, null, false, "drag");
  });

  // Mobile/touch fallback: tap a tile, then tap a zone to move it.
  zone.addEventListener("click", () => {
    if (!state.selectedId) return;
    moveTileToZone(state.selectedId, zone.dataset.zone, null, false, "tap");
  });
}

function wordsFromText(text) {
  const commaOrLine = text
    .split(/[\r\n,]+/)
    .map((v) => v.trim())
    .filter(Boolean);

  if (commaOrLine.length === 16) {
    return normalizeWords(commaOrLine);
  }

  const whitespace = text
    .replace(/[\t\r\n]+/g, " ")
    .split(/\s+/)
    .map((v) => v.trim())
    .filter(Boolean);

  return normalizeWords(whitespace);
}

loadManualBtn.addEventListener("click", () => {
  const words = wordsFromText(manualWordsEl.value);
  if (words.length !== 16) {
    setStatus(`Manual input has ${words.length} words. Please provide exactly 16.`);
    openManualPanel();
    trackEvent("manual_import_submitted", {
      result: "invalid_count",
      word_count: words.length,
    });
    return;
  }

  setWords(words);
  setStatus("Loaded words from manual input.");
  trackEvent("manual_import_submitted", {
    result: "success",
    word_count: words.length,
  });
  trackEvent("puzzle_loaded", {
    load_method: "manual_paste",
    word_count: words.length,
  });
  closeManualPanel();
});

resetBtn.addEventListener("click", () => {
  if (!state.tiles.length) return;
  state.zoneOrder.pool = state.tiles.map((tile) => tile.id);
  state.zoneOrder.yellow = [];
  state.zoneOrder.green = [];
  state.zoneOrder.blue = [];
  state.zoneOrder.purple = [];
  for (const tile of state.tiles) state.zoneById.set(tile.id, "pool");
  state.selectedId = null;
  render();
  setStatus("Layout reset. All words moved back to Word Pool.");
  trackEvent("layout_reset", {
    had_words_loaded: state.tiles.length > 0,
    word_count: state.tiles.length,
  });
});

function formatDateUTC(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractWordsFromPayload(data) {
  const candidates = [];
  const positionedCandidates = [];

  if (Array.isArray(data)) {
    candidates.push(...data);
  }

  if (Array.isArray(data?.words)) {
    candidates.push(...data.words);
  }

  if (Array.isArray(data?.cards)) {
    for (const card of data.cards) {
      if (Array.isArray(card?.members)) {
        candidates.push(...card.members);
      }
    }
  }

  if (Array.isArray(data?.categories)) {
    for (const category of data.categories) {
      if (!Array.isArray(category?.cards)) continue;
      for (const card of category.cards) {
        const content = card?.content;
        if (!content) continue;
        if (Number.isInteger(card?.position)) {
          positionedCandidates.push([card.position, content]);
        } else {
          candidates.push(content);
        }
      }
    }
  }

  if (positionedCandidates.length) {
    positionedCandidates.sort((a, b) => a[0] - b[0]);
    candidates.push(...positionedCandidates.map((item) => item[1]));
  }

  const words = normalizeWords(candidates);
  if (words.length < 16) {
    throw new Error("Puzzle data did not include 16 words.");
  }

  return words.slice(0, 16);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchTodayWords() {
  const today = new Date();
  const dateStr = formatDateUTC(today);
  const cacheBust = Date.now();
  const datedUrl = `data/connections-${dateStr}.json?v=${cacheBust}`;
  const latestUrl = `data/connections-latest.json?v=${cacheBust}`;

  try {
    const datedData = await fetchJson(datedUrl);
    return extractWordsFromPayload(datedData);
  } catch (_) {
    const latestData = await fetchJson(latestUrl);
    return extractWordsFromPayload(latestData);
  }
}

async function loadToday(trigger = "user_click") {
  const requestedDate = formatDateUTC(new Date());
  setStatus("Loading today's words...");
  trackEvent("puzzle_autoload_attempt", {
    trigger,
    date_requested: requestedDate,
  });

  try {
    const words = await fetchTodayWords();
    setWords(words);
    setStatus("Loaded today's puzzle words.");
    trackEvent("puzzle_autoload_attempt", {
      trigger,
      date_requested: requestedDate,
      result: "success",
    });
    trackEvent("puzzle_loaded", {
      load_method: trigger === "auto_init" ? "auto_today" : "reload",
      word_count: words.length,
    });
    closeManualPanel();
  } catch (err) {
    setStatus(`Auto-fetch failed (${err.message}). Open Puzzle Tools below.`);
    trackEvent("puzzle_autoload_attempt", {
      trigger,
      date_requested: requestedDate,
      result: "failure",
      failure_reason: String(err.message || "unknown_error"),
    });
    trackEvent("manual_import_opened", { trigger: "auto_fetch_failed" });
    openManualPanel();
  }
}

fetchTodayBtn.addEventListener("click", async () => {
  await loadToday("user_click");
});

(async function init() {
  await loadToday("auto_init");
})();
