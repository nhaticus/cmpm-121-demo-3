import "./style.css";
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

/* Helper function to create a title */
function createAppTitle(title: string): HTMLElement {
  const tmpTitle = document.createElement("h1");
  tmpTitle.innerHTML = title;
  app.appendChild(tmpTitle);
  return tmpTitle;
}

/*  Creating the title  */
const app = document.querySelector<HTMLDivElement>("#app")!;
const APP_NAME = "Geocoin Carrier";
document.title = APP_NAME;
createAppTitle(APP_NAME);

/* Helper function to create a button */
function createButton(
  buttonText: string,
  eventHandler: () => void,
): HTMLButtonElement {
  const tmpButton = document.createElement("button");
  tmpButton.innerHTML = buttonText;
  tmpButton.style.color = "white";
  tmpButton.addEventListener("click", eventHandler);
  app.appendChild(tmpButton);
  return tmpButton;
}

createButton("click me!", () => {
  alert("you've clicked a button");
});

/*  Game settings  */
interface GameSettings {
  zoomLevel: number;
  tileDegrees: number;
  neighborhoodSize: number;
  cacheSpawnProbability: number;
}
const gameSetting: GameSettings = {
  zoomLevel: 19,
  tileDegrees: 0.0001,
  neighborhoodSize: 8,
  cacheSpawnProbability: 0.1,
};

/*  Creating the map  */
const lectureHall = { lat: 36.98949379578401, lng: -122.06277128548504 };

const map = leaflet.map(document.getElementById("map")!, {
  center: lectureHall,
  zoom: gameSetting.zoomLevel,
  minZoom: gameSetting.zoomLevel,
  maxZoom: gameSetting.zoomLevel,
  zoomControl: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: gameSetting.zoomLevel,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

/*  Player spawn point  */
const playerMarker = leaflet.marker(lectureHall);
playerMarker.bindTooltip("You are here!");
playerMarker.addTo(map);

/*  Player points  */
let points = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

/*  Generates a rectangular cache at (i,j)  */
function spawnCache(i: number, j: number) {
  const origin = lectureHall;
  const bounds = leaflet.latLngBounds([
    [
      origin.lat + i * gameSetting.tileDegrees,
      origin.lng + j * gameSetting.tileDegrees,
    ],
    [
      origin.lat + (i + 1) * gameSetting.tileDegrees,
      origin.lng + (j + 1) * gameSetting.tileDegrees,
    ],
  ]);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  rect.bindPopup(() => {
    let pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);

    const popupText = document.createElement("div");
    popupText.innerHTML =
      ` <div>There is a cache here at "${i},${j}". It has value <span id="value">${pointValue}</span>.</div>
                <button id="poke">collect</button>`;

    popupText.querySelector("#poke")!.addEventListener("click", () => {
      if (pointValue > 0) {
        pointValue--;
        popupText.querySelector("#value")!.innerHTML = pointValue.toString();
        points++;
        statusPanel.innerHTML = `You have ${points} points!`;
      }
    });
    return popupText;
  });
}

/*  Populate the cache in an area given certain condition  */
for (
  let i = -gameSetting.neighborhoodSize;
  i < gameSetting.neighborhoodSize;
  i++
) {
  for (
    let j = -gameSetting.neighborhoodSize;
    j < gameSetting.neighborhoodSize;
    j++
  ) {
    if (luck([i, j].toString()) < gameSetting.cacheSpawnProbability) {
      spawnCache(i, j);
    }
  }
}
