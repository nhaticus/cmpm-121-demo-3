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
  readonly serialNumber: string;
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
  toMomento(): string;
  fromMomento(momento: string): void;
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
const cache_changed: Event = new Event("cache changed");
const inventory_changed: Event = new Event("inventory changed");

const momentos: Map<string, string> = new Map<string, string>();

/*================= Helper Functions =================*/
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

function transportCoin(coin: Coin, from: Cache, to: Cache) {
  const fromIndex = from.coins.indexOf(coin);
  if (fromIndex !== -1) {
    from.coins.splice(fromIndex, 1);
    to.coins.push(coin);
    momentos.set(to.key, to.toMomento());
    momentos.set(from.key, from.toMomento());
  }
}

function PopupText(cache: Cache, event: Event): HTMLElement {
  console.log(event);
  const popupText = document.createElement("div");
  popupText.innerHTML =
    `<div>This is cache: (${cache.cell.i}:${cache.cell.j})</div>`;
  const coinsContainer: HTMLElement = document.createElement("div");
  for (const coin of cache.coins) {
    const coinElement: HTMLElement = document.createElement("li");

    coinElement.innerHTML = coin.serialNumber;
    coinsContainer.appendChild(coinElement);
  }
  popupText.appendChild(coinsContainer);

  const collectButton = createButton("Collect", () => {
    if (cache.coins.length > 0) {
      const coin = cache.coins[0];
      transportCoin(coin, cache, playerInventory);
      popupText.dispatchEvent(cache_changed);
      dispatchEvent(inventory_changed);
      // Update the coins container after collecting a coin
      coinsContainer.innerHTML = "";
      for (const remainingCoin of cache.coins) {
        const coinElement: HTMLElement = document.createElement("li");
        coinElement.innerHTML = remainingCoin.serialNumber;
        coinsContainer.appendChild(coinElement);
      }
    }
  });

  const depositButton = createButton("Deposit", () => {
    if (playerInventory.coins.length > 0) {
      const coin = playerInventory.coins[playerInventory.coins.length - 1];
      transportCoin(coin, playerInventory, cache);
      popupText.dispatchEvent(cache_changed);
      dispatchEvent(inventory_changed);

      // Update the coins container after depositing a coin
      coinsContainer.innerHTML = "";
      for (const remainingCoin of cache.coins) {
        const coinElement: HTMLElement = document.createElement("li");
        coinElement.innerHTML = remainingCoin.serialNumber;
        coinsContainer.appendChild(coinElement);
      }
    }
  });

  popupText.appendChild(depositButton);
  popupText.appendChild(collectButton);
  return popupText;
}

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

function createMovementButtons() {
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

/*  Generates a rectangular cache at (i,j)  */
function initCache(i: number, j: number): Cache {
  const cache: Cache = {
    cell: { i: i, j: j },
    coins: [],
    toMomento() {
      return JSON.stringify(this.coins);
    },
    fromMomento(momento: string) {
      this.coins = JSON.parse(momento);
    },
    key: `${i}-${j}`,
  };

  if (i === 0 && j === 0) {
    return cache;
  }

  let numCoins = Math.floor(luck([i + j].toString()) * 5);
  if (numCoins === 0) {
    numCoins = 1;
  }

  for (let k = 0; k < numCoins; k++) {
    cache.coins.push({
      serialNumber: `coin-${i}:${j}:#${k}`,
      position: cache.cell,
    });
  }

  momentos.set(cache.key, cache.toMomento());

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
  const uniqueCacheEvent = new Event(
    `cache-changed-${cache.cell.i}-${cache.cell.j}`,
  );
  addEventListener(`cache-changed-${cache.cell.i}-${cache.cell.j}`, () => {
    rect.setPopupContent(PopupText(cache, uniqueCacheEvent));
  });
  rect.addEventListener("click", () => {
    rect.bindPopup(PopupText(cache, uniqueCacheEvent)).openPopup();
  });
}

function inventoryUpdated() {
  inventoryPanel.innerHTML = "Stash: ";
  const coinsContainer: HTMLElement = document.createElement("div");
  for (const coin of playerInventory.coins) {
    const coinText: HTMLElement = document.createElement("li");
    coinText.innerHTML = `${coin.serialNumber}`;
    coinsContainer.appendChild(coinText);
  }
  inventoryPanel.appendChild(coinsContainer);
}

/*  Refreshes the cache in area around position  */
function refreshCache(position: leaflet.LatLng) {
  const cells = board.getCellsNearPoint(position);

  for (const cell of cells) {
    const cacheKey = `${cell.i}-${cell.j}`;
    if (luck([cell.i, cell.j].toString()) < config.cacheSpawnProbability) {
      if (!momentos.has(cacheKey)) {
        console.log(`does not have ${cacheKey}`);
        showCache(initCache(cell.i, cell.j));
      }
    } else {
      const momento = momentos.get(cacheKey);
      if (momento !== undefined) {
        console.log("momento", momento);
        const cache = initCache(cell.i, cell.j);
        cache.fromMomento(momento);
        showCache(cache);
      }
    }
  }
}

const playerInventory: Cache = initCache(0, 0);

addEventListener("inventory changed", () => {
  inventoryUpdated();
});

/*  Populate the cache in an area given certain condition  */
const board: Board = new Board(config.tileDegrees, config.neighborhoodSize);
refreshCache(playerMarker.getLatLng());

/*================= Player Movement =================*/
const playerMoved = new Event("player moved");

let anchor: leaflet.LatLng = lectureHall;
const movementEl = document.querySelector("#movementControl")!;
createMovementButtons();

addEventListener("player moved", () => {
  playerMarker.setLatLng(anchor);
  map.setView(anchor, config.zoomLevel);

  cacheLayer.clearLayers();
  refreshCache(playerMarker.getLatLng());
});
