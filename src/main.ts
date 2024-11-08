import "./style.css";

function createAppTitle(title: string): HTMLElement {
  const tmpTitle = document.createElement("h1");
  tmpTitle.innerHTML = title;
  app.appendChild(tmpTitle);
  return tmpTitle;
}
const app = document.querySelector<HTMLDivElement>("#app")!;

const APP_NAME = "Geocoin Carrier";
document.title = APP_NAME;

createAppTitle(APP_NAME);

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

const button = createButton("click me!", () => {
  alert("you've clicked a button");
});
app.append(button);
