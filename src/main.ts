import "./style.css";

import "leaflet/dist/leaflet.css";
import leaflet from "leaflet";
import "./leafletWorkaround.ts";

import luck from "./luck.ts";
import { Board } from "./board.ts";

/*================= Interfaces =================*/
/*  Configurations for leaflet  */
interface Config {
  zoomLevel: number;
  maxZoomLevel: number;
  minZoomLevel: number;
  tileDegrees: number;
  neighborhoodSize: number;
  cacheSpawnProbability: number;
}

/*  Coin  */
interface Coin {
  readonly serialNumber: number;
  position: Cell;
}

/*  Cell  */
interface Cell {
  readonly i: number;
  readonly j: number;
}

/*  Cache  */
interface Cache {
  coins: Coin[];
  cell: Cell;
  key: string;
  toMemento(): string;
  fromMemento(memento: string): void;
}

/*================= Setup =================*/
/*  Creating the title  */
const APP_NAME = "Geocoin Carrier";
document.title = APP_NAME;

/*  Lecture Hall/spawn location  */
const lectureHall = leaflet.latLng(36.98949379578401, -122.06277128548504);

const config: Config = {
  zoomLevel: 19,
  maxZoomLevel: 19,
  minZoomLevel: 16,
  tileDegrees: 0.0001,
  neighborhoodSize: 8,
  cacheSpawnProbability: 0.1,
};

const map = createMap(lectureHall);

const cacheLayer: leaflet.LayerGroup = leaflet.layerGroup().addTo(map);

/*  Player spawn point  */
const playerMarker: leaflet.Marker = createPlayerMarker(lectureHall);

/*  Player Inventory  */
const inventoryPanel = document.createElement("div");
document.body.appendChild(inventoryPanel);
inventoryPanel.innerHTML = "Stash: ";

/*================= Events =================*/
/*  Events used for updates similar to d2  */
const inventory_changed: Event = new Event("inventory changed");

const mementos: Map<string, string> = new Map<string, string>();

/*================= Buttons =================*/
/* Creates a button with given a string and callBack function */
function createButton(
  buttonText: string,
  eventHandler: () => void,
): HTMLButtonElement {
  const tmpButton = document.createElement("button");
  tmpButton.innerHTML = buttonText;
  tmpButton.style.color = "white";
  tmpButton.addEventListener("click", eventHandler);
  return tmpButton;
}

function createGeoLocationButton() {
  const geoLocationButton = createButton("🌐", () => {
    followLoc = !followLoc;
    if (followLoc) {
      alert("Geolocation tracking started");
    } else {
      alert("Geolocation tracking stopped");
    }
    navigator.geolocation.getCurrentPosition((position) => {
      anchor = leaflet.latLng(
        position.coords.latitude,
        position.coords.longitude,
      );
      dispatchEvent(playerMoved);
    });
  });
  movementEl.appendChild(geoLocationButton);
}

function createDirectionalMovementButton() {
  const upButton = createButton("⬆️", () => {
    anchor = leaflet.latLng(anchor.lat + config.tileDegrees, anchor.lng);
    dispatchEvent(playerMoved);
  });
  movementEl.appendChild(upButton);

  const downButton = createButton("⬇️", () => {
    anchor = leaflet.latLng(anchor.lat - config.tileDegrees, anchor.lng);
    dispatchEvent(playerMoved);
  });

  movementEl.appendChild(downButton);
  const leftButton = createButton("⬅️", () => {
    anchor = leaflet.latLng(anchor.lat, anchor.lng - config.tileDegrees);
    dispatchEvent(playerMoved);
  });
  movementEl.appendChild(leftButton);

  const rightButton = createButton("➡️", () => {
    anchor = leaflet.latLng(anchor.lat, anchor.lng + config.tileDegrees);
    dispatchEvent(playerMoved);
  });
  movementEl.appendChild(rightButton);
}

function createTrashDataButton() {
  const trashDataButton = createButton("🚮", () => {
    if (prompt("Are you sure you want to delete all data? (y/n)") === "y") {
      localStorage.clear();
      location.reload();
    }
  });
  movementEl.appendChild(trashDataButton);
}

function createControlButtons() {
  createGeoLocationButton();

  createDirectionalMovementButton();

  createTrashDataButton();
}

/*================= Cache/Coins =================*/
// Brace's suggestion's to split transportCoin into two functions making it easier to test/update
class CoinManager {
  static transferCoin(coin: Coin, from: Cache, to: Cache) {
    const fromIndex = from.coins.indexOf(coin);
    if (fromIndex !== -1) {
      from.coins.splice(fromIndex, 1);
      to.coins.push(coin);
    }
  }

  static saveCaches(from: Cache, to: Cache) {
    mementos.set(to.key, to.toMemento());
    mementos.set(from.key, from.toMemento());
    saveGame();
  }
}

function transportCoin(coin: Coin, from: Cache, to: Cache) {
  CoinManager.transferCoin(coin, from, to);
  CoinManager.saveCaches(from, to);
}

/*================= Popup Text =================*/
function PopupText(cache: Cache): HTMLElement {
  const popupText = document.createElement("div");
  popupText.innerHTML =
    `<div>This is cache: (${cache.cell.i}:${cache.cell.j})</div>`;
  const coinsContainer: HTMLElement = document.createElement("div");
  for (const coin of cache.coins) {
    const coinElement: HTMLElement = document.createElement("li");

    coinElement.innerHTML =
      `Coin at ${coin.position.i}, ${coin.position.j}: #${coin.serialNumber}`;
    coinsContainer.appendChild(coinElement);
  }
  popupText.appendChild(coinsContainer);

  const collectButton = createButton("Collect", () => {
    if (cache.coins.length > 0) {
      const coin = cache.coins[0];
      transportCoin(coin, cache, playerInventory);
      dispatchEvent(inventory_changed);
      // Update the coins container after collecting a coin
      coinsContainer.innerHTML = "";
      for (const coin of cache.coins) {
        const coinElement: HTMLElement = document.createElement("li");
        coinElement.innerHTML =
          `Coin at ${coin.position.i}, ${coin.position.j}: #${coin.serialNumber}`;
        coinsContainer.appendChild(coinElement);
      }
    }
  });

  const depositButton = createButton("Deposit", () => {
    if (playerInventory.coins.length > 0) {
      const coin = playerInventory.coins[playerInventory.coins.length - 1];
      transportCoin(coin, playerInventory, cache);
      dispatchEvent(inventory_changed);

      // Update the coins container after depositing a coin
      coinsContainer.innerHTML = "";
      for (const coin of cache.coins) {
        const coinElement: HTMLElement = document.createElement("li");
        coinElement.innerHTML =
          `Coin at ${coin.position.i}, ${coin.position.j}: #${coin.serialNumber}`;
        coinsContainer.appendChild(coinElement);
      }
    }
  });

  popupText.appendChild(depositButton);
  popupText.appendChild(collectButton);
  return popupText;
}

function inventoryUpdated() {
  inventoryPanel.innerHTML = "Stash: ";
  const coinsContainer: HTMLElement = document.createElement("div");
  for (const coin of playerInventory.coins) {
    const coinText: HTMLElement = document.createElement("li");
    coinText.innerHTML =
      `Coin at ${coin.position.i}, ${coin.position.j}: #${coin.serialNumber}`;
    coinText.addEventListener("click", () => {
      console.log(coin.position.i, coin.position.j);
      moveTo(coin.position.i, coin.position.j);
    });
    coinsContainer.appendChild(coinText);
  }
  inventoryPanel.appendChild(coinsContainer);
}

/*  Generates a rectangular cache at (i,j)  */
function initCache(i: number, j: number, exist?: boolean): Cache {
  const cache: Cache = {
    cell: { i: i, j: j },
    coins: [],
    toMemento() {
      return JSON.stringify(this.coins);
    },
    fromMemento(memento: string) {
      this.coins = JSON.parse(memento);
    },
    key: [i, j].toString(),
  };
  if (exist) {
    return cache;
  }
  if (i === 0 && j === 0) {
    return cache; // anchor/player
  }
  let numCoins = Math.floor(luck([i + j].toString()) * 5);
  if (numCoins === 0) {
    numCoins = 1;
  }
  for (let k = 0; k < numCoins; k++) {
    cache.coins.push({
      serialNumber: k,
      position: cache.cell,
    });
  }
  mementos.set(cache.key, cache.toMemento());
  return cache;
}

/*  populates the cache on the map  */
function showCache(cache: Cache) {
  const rect = leaflet.rectangle([
    [cache.cell.i * config.tileDegrees, cache.cell.j * config.tileDegrees],
    [
      (cache.cell.i + 1) * config.tileDegrees,
      (cache.cell.j + 1) * config.tileDegrees,
    ],
  ]);
  rect.addTo(map);
  cacheLayer.addLayer(rect);

  /*  Creating unique events per cache to update cache individually */
  const _uniqueCacheEvent = new Event(
    `cache-changed-${cache.cell.i}-${cache.cell.j}`,
  );
  addEventListener(`cache-changed-${cache.cell.i}-${cache.cell.j}`, () => {
    rect.setPopupContent(PopupText(cache));
  });
  rect.addEventListener("click", () => {
    rect.bindPopup(PopupText(cache)).openPopup();
  });
}

/*  Refreshes the cache in area around position  */
function refreshCache(position: leaflet.LatLng) {
  const cells = board.getCellsNearPoint(position);

  for (const cell of cells) {
    if (luck([cell.i, cell.j].toString()) < config.cacheSpawnProbability) {
      if (!mementos.has([cell.i, cell.j].toString())) {
        showCache(initCache(cell.i, cell.j));
      } else {
        const cache = initCache(cell.i, cell.j, true);
        cache.fromMemento(mementos.get([cell.i, cell.j].toString())!);
        showCache(cache);
      }
    }
  }
}

/*================= Geolocation =================*/
function followLocation() {
  if (followLoc) {
    navigator.geolocation.getCurrentPosition((position) => {
      const geoPos = leaflet.latLng(
        position.coords.latitude,
        position.coords.longitude,
      );
      const distance = geoPos.distanceTo(anchor);
      if (distance > config.tileDegrees) {
        anchor = geoPos;
        dispatchEvent(playerMoved);
      }
    });
  } else {
    return;
  }
}

/* ================== Location Tracking ================== */
function locationTracking() {
  if (trackedLocations.length === 0) {
    trackedLocations.push([anchor]);
  } else {
    const lastLocation = trackedLocations[trackedLocations.length - 1];
    console.log(anchor.distanceTo(lastLocation[lastLocation.length - 1]));
    if (anchor.distanceTo(lastLocation[lastLocation.length - 1])) {
      lastLocation.push(anchor);
    } else {
      trackedLocations.push([anchor]);
    }
  }
}

/*================= Map =================*/
/*  Creating the map  */
function createMap(center: leaflet.LatLng) {
  const map = leaflet.map(document.getElementById("map")!, {
    center: center,
    zoom: config.zoomLevel,
    minZoom: config.minZoomLevel,
    maxZoom: config.maxZoomLevel,
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: false,
    doubleClickZoom: false,
  });

  leaflet
    .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: config.maxZoomLevel,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
    .addTo(map);

  return map;
}

/*  Creating player/user marker */
function createPlayerMarker(location: leaflet.LatLng): leaflet.Marker {
  const playerMarker = leaflet.marker(location);
  playerMarker.bindTooltip("You are here!");
  playerMarker.addTo(map);
  return playerMarker;
}

/*================= Inventory =================*/
const playerInventory: Cache = initCache(0, 0);

addEventListener("inventory changed", () => {
  inventoryUpdated();
});

/*================= Cache =================*/
/*  Populate the cache in an area given certain condition  */
const board: Board = new Board(config.tileDegrees, config.neighborhoodSize);

refreshCache(playerMarker.getLatLng());

/*================= Player Movement =================*/
function moveTo(i: number, j: number) {
  anchor = leaflet.latLng(i * config.tileDegrees, j * config.tileDegrees);
  dispatchEvent(playerMoved);
}

const movementEl = document.querySelector("#movementControl")!;
createControlButtons();

const playerMoved = new Event("player moved");

let anchor: leaflet.LatLng = lectureHall;

addEventListener("player moved", () => {
  cacheLayer.clearLayers();
  playerMarker.setLatLng(anchor);
  map.setView(anchor, config.zoomLevel);
  refreshCache(playerMarker.getLatLng());
  locationTracking();
  const polyline = leaflet.polyline(trackedLocations, { color: "red" }).addTo(
    map,
  );
  cacheLayer.addLayer(polyline);
  saveGame();
});

/*================= Local Save =================*/
function saveGame() {
  localStorage.setItem(
    "playerPosition",
    JSON.stringify(playerMarker.getLatLng()),
  );
  localStorage.setItem(
    "mementos",
    JSON.stringify(Array.from(mementos.entries())),
  );
  localStorage.setItem("playerInventory", JSON.stringify(playerInventory));
}

function loadGame() {
  if (localStorage.getItem("playerPosition")) {
    const playerPosition = JSON.parse(localStorage.getItem("playerPosition")!);
    anchor = leaflet.latLng(playerPosition.lat, playerPosition.lng);
    playerMarker.setLatLng(anchor);
    map.setView(anchor, config.zoomLevel);
  }

  if (localStorage.getItem("playerInventory")) {
    const playerInventoryData = JSON.parse(
      localStorage.getItem("playerInventory")!,
    );
    playerInventory.coins = playerInventoryData.coins;
    inventoryUpdated();
  }

  if (localStorage.getItem("mementos")) {
    const mementosData = JSON.parse(localStorage.getItem("mementos")!);
    for (const [key, value] of mementosData) {
      mementos.set(key, value);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadGame();

  locationTracking();
  refreshCache(playerMarker.getLatLng());
});

/*================= Main =================*/
let followLoc: boolean = false;
const trackedLocations: leaflet.LatLng[][] = [];
setInterval(followLocation, 1000);
