const state = {
  tiles: [],
  zoneById: new Map(),
  selectedId: null,
};

const statusEl = document.getElementById("status");
const manualWordsEl = document.getElementById("manualWords");
const fetchTodayBtn = document.getElementById("fetchTodayBtn");
const loadManualBtn = document.getElementById("loadManualBtn");
const resetBtn = document.getElementById("resetBtn");

const zones = Array.from(document.querySelectorAll(".dropzone"));
let dragId = null;

function setStatus(text) {
  statusEl.textContent = text;
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
  state.selectedId = null;

  for (const tile of state.tiles) {
    state.zoneById.set(tile.id, "pool");
  }

  render();
}

function moveTileToZone(tileId, zoneName) {
  if (!tileId || !state.zoneById.has(tileId)) return;
  state.zoneById.set(tileId, zoneName);
  state.selectedId = null;
  render();
}

function render() {
  for (const zone of zones) {
    zone.innerHTML = "";
  }

  for (const tileModel of state.tiles) {
    const zoneName = state.zoneById.get(tileModel.id) || "pool";
    const zoneEl = document.querySelector(`.dropzone[data-zone="${zoneName}"]`);
    if (!zoneEl) continue;

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
    });

    zoneEl.appendChild(tile);
  }
}

for (const zone of zones) {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("active");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("active");
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("active");

    const droppedId = dragId || event.dataTransfer.getData("text/plain");
    const zoneName = zone.dataset.zone;
    moveTileToZone(droppedId, zoneName);
  });

  // Mobile/touch fallback: tap a tile, then tap a zone to move it.
  zone.addEventListener("click", () => {
    if (!state.selectedId) return;
    moveTileToZone(state.selectedId, zone.dataset.zone);
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
    return;
  }

  setWords(words);
  setStatus("Loaded words from manual input.");
});

resetBtn.addEventListener("click", () => {
  if (!state.tiles.length) return;
  for (const tile of state.tiles) {
    state.zoneById.set(tile.id, "pool");
  }
  state.selectedId = null;
  render();
  setStatus("Layout reset. All words moved back to Word Pool.");
});

function formatDateUTC(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchTodayWords() {
  const today = new Date();
  const dateStr = formatDateUTC(today);

  // Official NYT connections endpoint pattern used by the game client.
  const url = `https://www.nytimes.com/svc/connections/v2/${dateStr}.json`;
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const candidates = [];

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

  const words = normalizeWords(candidates);
  if (words.length < 16) {
    throw new Error("Puzzle data did not include 16 words.");
  }

  return words.slice(0, 16);
}

fetchTodayBtn.addEventListener("click", async () => {
  setStatus("Loading today's words from NYT...");
  try {
    const words = await fetchTodayWords();
    setWords(words);
    setStatus("Loaded today's puzzle words from NYT.");
  } catch (err) {
    setStatus(`Auto-fetch failed (${err.message}). Paste words manually below.`);
  }
});

(async function init() {
  fetchTodayBtn.click();
})();
