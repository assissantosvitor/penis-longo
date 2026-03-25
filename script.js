const game = document.getElementById("game");
const scoreDisplay = document.getElementById("score");
let score = 0;

// posições das colunas
const keys = { "s":20, "d":120, "k":220, "l":320 };

// cria uma seta aleatória
function createArrow() {
  const letters = ["s","d","k","l"];
  const letter = letters[Math.floor(Math.random()*letters.length)];
  const arrow = document.createElement("div");
  arrow.classList.add("arrow");
  arrow.style.left = keys[letter] + "px";
  arrow.textContent = letter.toUpperCase();
  game.appendChild(arrow);

  let pos = -100;
  const interval = setInterval(() => {
    pos += 5;
    arrow.style.top = pos + "px";

    if(pos > 400) {
      if(game.contains(arrow)) game.removeChild(arrow);
      clearInterval(interval);
    }
  }, 50);
}

// gera setas a cada 1,5s
setInterval(createArrow, 1500);

// checa acertos
document.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  if(keys[key] !== undefined) {
    const arrows = document.querySelectorAll(".arrow");
    arrows.forEach(arrow => {
      const arrowTop = parseInt(arrow.style.top);
      const arrowLeft = parseInt(arrow.style.left);
      if(arrowLeft === keys[key] && arrowTop > 280 && arrowTop < 380) {
        score += 10;
        scoreDisplay.textContent = "Pontuação: " + score;
        if(game.contains(arrow)) game.removeChild(arrow);
      }
    });
  }
});
