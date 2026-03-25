const keyMap = ["s","d","k","l"];
const laneCount = 4;
const laneWidth = 420; // deve bater com CSS
const columnWidth = laneWidth / laneCount;

const arrowLane = document.getElementById("arrow-lane");
const targets = document.querySelectorAll("#targets .target");
const scoreEl = document.getElementById("scoreVal");
const comboEl = document.getElementById("comboVal");
const playerHealthEl = document.getElementById("playerHealth");
const enemyHealthEl = document.getElementById("enemyHealth");
const playerSprite = document.getElementById("playerSprite");
const enemySprite = document.getElementById("enemySprite");
const music = document.getElementById("music");

let score = 0;
let combo = 0;
let playerHP = 100;
let enemyHP = 100;
let arrows = [];
let spawnInterval = 900;
let arrowSpeed = 3.2;
let gameRunning = true;

function updateHUD(){
  scoreEl.textContent = score;
  comboEl.textContent = combo;
  playerHealthEl.style.width = playerHP + "%";
  enemyHealthEl.style.width = enemyHP + "%";
}
updateHUD();

function columnLeft(colIndex){
  // left relativo dentro do #arrow-lane
  return colIndex * columnWidth;
}

function spawnArrow(letter){
  const col = keyMap.indexOf(letter);
  const el = document.createElement("div");
  el.className = "arrow";
  el.textContent = letter.toUpperCase();
  el.style.left = (columnLeft(col) + 10) + "px";
  el.style.top = "-120px";
  arrowLane.appendChild(el);

  arrows.push({ el, letter, x: columnLeft(col) + 10, y: -120, speed: arrowSpeed });
}

function spawnRandom(){
  const letter = keyMap[Math.floor(Math.random()*keyMap.length)];
  spawnArrow(letter);
}

function gameLoop(){
  if(!gameRunning) return;
  for(let i = arrows.length - 1; i >= 0; i--){
    const a = arrows[i];
    a.y += a.speed;
    a.el.style.top = a.y + "px";
    if(a.y > arrowLane.clientHeight - 40){
      a.el.remove();
      arrows.splice(i,1);
      combo = 0;
      playerHP = Math.max(0, playerHP - 6);
      flashSprite(playerSprite);
      updateHUD();
      checkEnd();
    }
  }
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

let spawnTimer = setInterval(spawnRandom, spawnInterval);

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if(!keyMap.includes(key)) return;
  const idx = keyMap.indexOf(key);
  targets[idx].classList.add("active");
  setTimeout(()=>targets[idx].classList.remove("active"), 120);

  let bestIndex = -1;
  let bestDist = Infinity;
  const targetY = arrowLane.clientHeight - 120;
  for(let i=0;i<arrows.length;i++){
    const a = arrows[i];
    if(a.letter !== key) continue;
    const dist = Math.abs(a.y - targetY);
    if(dist < bestDist){ bestDist = dist; bestIndex = i; }
  }

  const perfectWindow = 18;
  const goodWindow = 40;

  if(bestIndex !== -1){
    const a = arrows[bestIndex];
    const dist = Math.abs(a.y - targetY);
    if(dist <= perfectWindow){
      hit(true); removeArrowAt(bestIndex);
    } else if(dist <= goodWindow){
      hit(false); removeArrowAt(bestIndex);
    } else { miss(); }
  } else { miss(); }
});

function removeArrowAt(i){
  if(!arrows[i]) return;
  arrows[i].el.remove();
  arrows.splice(i,1);
}

function hit(perfect){
  combo++;
  const points = perfect ? 30 : 12;
  score += points * Math.max(1, Math.floor(combo/5));
  enemyHP = Math.max(0, enemyHP - (perfect ? 6 : 2));
  flashSprite(enemySprite);
  updateHUD();
  checkEnd();
}

function miss(){
  combo = 0;
  playerHP = Math.max(0, playerHP - 8);
  flashSprite(playerSprite);
  updateHUD();
  checkEnd();
}

function flashSprite(el){
  el.classList.add('hit');
  setTimeout(()=> el.classList.remove('hit'), 180);
}

function checkEnd(){
  if(enemyHP <= 0 || playerHP <= 0){
    gameRunning = false;
    clearInterval(spawnTimer);
    arrows.forEach(a=>a.el.remove());
    arrows = [];
    if(!music.paused) music.pause();
    setTimeout(()=> {
      const msg = enemyHP <= 0 ? "Você venceu!" : "Você perdeu!";
      alert(msg + " Pontuação final: " + score);
      location.reload();
    }, 600);
  }
}

document.addEventListener('click', () => {
  if(music && music.paused){
    music.currentTime = 0;
    music.play().catch(()=>{});
  }
});
