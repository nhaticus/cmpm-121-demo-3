import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

const APP_NAME = "Geocoin";
document.title = APP_NAME;

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
  alert("WOW! you've clicked a button");
});
app.append(button);
