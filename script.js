const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight - 56);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 30, 120);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / (window.innerHeight - 56), 0.1, 200);

// Luzes
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffeecc, 1.1);
sun.position.set(40, 70, 50);
scene.add(sun);

// ====================== VARIÁVEIS DO JOGO ======================
const BLOCK_SIZE = 1;
const WORLD_RADIUS = 18;
let blocksMap = new Map();        // "x,y,z" → tipo
let blockMeshes = [];

const BLOCK_TYPES = {
    1: { name: 'grama', color: 0x4CAF50 },
    2: { name: 'terra', color: 0x8B4513 },
    3: { name: 'pedra', color: 0x777777 },
    4: { name: 'madeira', color: 0xA0522D },
    5: { name: 'folhas', color: 0x228B22 }
};

let selectedBlockType = 1;
let keys = {};
let pointerLocked = false;
let yaw = Math.PI;          // rotação horizontal
let pitch = 0;              // rotação vertical

// Personagem (com gravidade e colisão)
const player = {
    position: new THREE.Vector3(0, 20, 20),
    velocity: new THREE.Vector3(0, 0, 0),
    width: 0.6,
    height: 1.8,
    onGround: false,
    speed: 0.28
};

// Mesh do personagem (Steve simplificado)
let playerGroup;
function createPlayerMesh() {
    const group = new THREE.Group();
    
    // Corpo
    const bodyGeo = new THREE.BoxGeometry(0.6, 1.2, 0.3);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3B8CFF });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.9;
    group.add(body);
    
    // Cabeça
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xF4C29C });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.95;
    group.add(head);
    
    // Pernas
    const legGeo = new THREE.BoxGeometry(0.25, 0.9, 0.3);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.2, 0.35, 0);
    const legR = legL.clone();
    legR.position.x = 0.2;
    group.add(legL, legR);
    
    scene.add(group);
    return group;
}

// Destaque do bloco
const highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
    new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 4 })
);
scene.add(highlight);
highlight.visible = false;

// Raycaster
const raycaster = new THREE.Raycaster();

// ====================== MUNDO ======================
function generateWorld() {
    blockMeshes.forEach(m => scene.remove(m));
    blockMeshes = [];
    blocksMap.clear();

    for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
        for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z++) {
            const height = Math.floor(3 + Math.sin(x * 0.25) * 3 + Math.cos(z * 0.25) * 3);
            
            for (let y = 0; y <= height; y++) {
                let type = 3;
                if (y === height) type = 1;
                else if (y >= height - 3) type = 2;
                addBlock(x, y, z, type);
            }

            if (Math.random() > 0.87 && height > 3) {
                const treeH = 5 + Math.floor(Math.random() * 3);
                for (let h = 1; h <= treeH; h++) addBlock(x, height + h, z, 4);
                for (let lx = -2; lx <= 2; lx++) {
                    for (let ly = -2; ly <= 2; ly++) {
                        for (let lz = -2; lz <= 2; lz++) {
                            if (Math.abs(lx) + Math.abs(ly) + Math.abs(lz) < 5) {
                                const tx = x + lx, ty = height + treeH + ly, tz = z + lz;
                                if (!blocksMap.has(`${tx},${ty},${tz}`)) addBlock(tx, ty, tz, 5);
                            }
                        }
                    }
                }
            }
        }
    }

    // Posição inicial do personagem (acima do chão)
    player.position.set(0, 15, 20);
    player.velocity.set(0, 0, 0);
}

function addBlock(x, y, z, type) {
    const key = `${x},${y},${z}`;
    if (blocksMap.has(key)) return;

    const geo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    const mat = new THREE.MeshLambertMaterial({ color: BLOCK_TYPES[type].color, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    scene.add(mesh);

    blocksMap.set(key, type);
    blockMeshes.push(mesh);
}

function removeBlock(x, y, z) {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    if (!blocksMap.has(key)) return;

    const index = blockMeshes.findIndex(m => 
        Math.floor(m.position.x) === Math.floor(x) &&
        Math.floor(m.position.y) === Math.floor(y) &&
        Math.floor(m.position.z) === Math.floor(z)
    );
    if (index > -1) {
        scene.remove(blockMeshes[index]);
        blockMeshes.splice(index, 1);
    }
    blocksMap.delete(key);
}

// ====================== COLISÃO ======================
function checkCollision(pos) {
    const half = player.width / 2;
    const minX = Math.floor(pos.x - half);
    const maxX = Math.ceil(pos.x + half);
    const minY = Math.floor(pos.y);
    const maxY = Math.ceil(pos.y + player.height);
    const minZ = Math.floor(pos.z - half);
    const maxZ = Math.ceil(pos.z + half);

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                if (blocksMap.has(`${x},${y},${z}`)) return true;
            }
        }
    }
    return false;
}

// ====================== HOTBAR ======================
function createHotbar() {
    const hotbarEl = document.getElementById('hotbar');
    hotbarEl.innerHTML = '';
    Object.keys(BLOCK_TYPES).forEach((t, i) => {
        const type = parseInt(t);
        const slot = document.createElement('div');
        slot.className = `slot ${i === 0 ? 'selected' : ''}`;
        slot.innerHTML = `<div style="width:100%;height:100%;background:#${BLOCK_TYPES[type].color.toString(16)};display:flex;align-items:center;justify-content:center;font-size:36px;">${type===1?'🌱':type===2?'🟫':type===3?'🪨':type===4?'🪵':'🌳'}</div>`;
        slot.onclick = () => {
            selectedBlockType = type;
            document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
            slot.classList.add('selected');
        };
        hotbarEl.appendChild(slot);
    });
}

// ====================== CONTROLES ======================
canvas.addEventListener('click', () => canvas.requestPointerLock());

document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
});

document.addEventListener('mousemove', e => {
    if (!pointerLocked) return;
    yaw -= e.movementX * 0.0025;
    pitch -= e.movementY * 0.0025;
    pitch = Math.max(-1.4, Math.min(1.4, pitch));
});

window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key >= '1' && e.key <= '5') {
        selectedBlockType = parseInt(e.key);
        document.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('selected', i === selectedBlockType - 1));
    }
    if (e.key.toLowerCase() === 'r') generateWorld();
});

window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener('mousedown', e => {
    if (!pointerLocked) return;
    e.preventDefault();

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(blockMeshes);
    if (intersects.length === 0) return;

    const i = intersects[0];
    const n = i.face.normal;
    const p = i.point;

    const bx = Math.floor(p.x - n.x * 0.001);
    const by = Math.floor(p.y - n.y * 0.001);
    const bz = Math.floor(p.z - n.z * 0.001);

    if (e.button === 0) { // quebrar
        removeBlock(bx, by, bz);
    } else if (e.button === 2) { // colocar
        const px = bx + n.x;
        const py = by + n.y;
        const pz = bz + n.z;

        // evita colocar dentro do personagem
        const dist = player.position.distanceTo(new THREE.Vector3(px + 0.5, py + 0.5, pz + 0.5));
        if (dist > 2) addBlock(px, py, pz, selectedBlockType);
    }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ====================== LOOP ======================
function animate() {
    requestAnimationFrame(animate);

    // === GRAVIDADE ===
    player.velocity.y -= 0.032;

    // === MOVIMENTO HORIZONTAL (relativo à câmera) ===
    let move = new THREE.Vector3();
    if (keys['w']) move.z -= 1;
    if (keys['s']) move.z += 1;
    if (keys['a']) move.x -= 1;
    if (keys['d']) move.x += 1;

    if (move.length() > 0) {
        move.normalize();
        move.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        player.velocity.x = move.x * player.speed;
        player.velocity.z = move.z * player.speed;
    } else {
        player.velocity.x = player.velocity.z = 0;
    }

    // === PULO ===
    if (keys[' '] && player.onGround) {
        player.velocity.y = 0.48;
        player.onGround = false;
    }

    // === COLISÃO E MOVIMENTO (eixo por eixo) ===
    let next = player.position.clone();

    // X
    next.x += player.velocity.x;
    if (!checkCollision(next)) player.position.x = next.x;
    else player.velocity.x = 0;

    // Z
    next = player.position.clone();
    next.z += player.velocity.z;
    if (!checkCollision(next)) player.position.z = next.z;
    else player.velocity.z = 0;

    // Y (gravidade)
    next = player.position.clone();
    next.y += player.velocity.y;
    if (!checkCollision(next)) {
        player.position.y = next.y;
        player.onGround = false;
    } else {
        if (player.velocity.y < 0) player.onGround = true;
        player.velocity.y = 0;
    }

    // === ATUALIZA MESH DO PERSONAGEM ===
    playerGroup.position.copy(player.position);
    playerGroup.rotation.y = yaw;

    // === CÂMERA 3ª PESSOA (menos imersiva) ===
    const dist = 9;
    const height = 4.5;
    const camX = player.position.x - Math.sin(yaw) * dist;
    const camZ = player.position.z - Math.cos(yaw) * dist;
    const camY = player.position.y + height + Math.sin(pitch) * 3;

    const idealCam = new THREE.Vector3(camX, camY, camZ);
    camera.position.lerp(idealCam, 0.15);
    camera.lookAt(player.position.x, player.position.y + 1.4, player.position.z);

    // === DESTAQUE DO BLOCO ===
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(blockMeshes);
    if (hits.length > 0) {
        const hit = hits[0];
        const pos = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(0.001));
        highlight.position.set(Math.floor(pos.x) + 0.5, Math.floor(pos.y) + 0.5, Math.floor(pos.z) + 0.5);
        highlight.visible = true;
    } else {
        highlight.visible = false;
    }

    renderer.render(scene, camera);
}

// ====================== INICIALIZAÇÃO ======================
function init() {
    playerGroup = createPlayerMesh();
    generateWorld();
    createHotbar();
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / (window.innerHeight - 56);
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight - 56);
    });

    console.log('%c✅ MiniCraft 3D com personagem, gravidade e colisão carregado!', 'color:#4caf50; font-size:16px');
}

window.onload = init;
