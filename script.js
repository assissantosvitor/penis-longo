const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 60, 280);

const sky = new THREE.Mesh(
    new THREE.SphereGeometry(280, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide })
);
scene.add(sky);

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const sunLight = new THREE.DirectionalLight(0xffeecc, 1.35);
sunLight.position.set(80, 120, 60);
scene.add(sunLight);

scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(8, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xFFEB3B })
).translateX(100).translateY(140).translateZ(80));

const BLOCK_SIZE = 1;
const WORLD_RADIUS = 50;
let blocksMap = new Map();
let blockMeshes = [];
let collectibles = [];

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
let yaw = Math.PI;
let pitch = 0;
let itemCount = 0;

const player = {
    position: new THREE.Vector3(0, 35, 30),
    velocity: new THREE.Vector3(),
    width: 0.6,
    height: 1.8,
    onGround: false,
    speed: 0.32
};

let playerGroup;
const highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
    new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 5 })
);
scene.add(highlight);
highlight.visible = false;

const raycaster = new THREE.Raycaster();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);

// ====================== MUNDO ======================
function generateWorld() {
    blockMeshes.forEach(m => scene.remove(m));
    collectibles.forEach(c => scene.remove(c.mesh));
    blockMeshes = []; collectibles = []; blocksMap.clear();

    for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
        for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z++) {
            const height = Math.floor(4 + Math.sin(x*0.08)*7 + Math.cos(z*0.09)*7 + Math.sin((x+z)*0.05)*4);
            for (let y = 0; y <= height; y++) {
                let type = y === height ? 1 : (y >= height-4 ? 2 : 3);
                addBlock(x, y, z, type);
            }
            if (Math.random() > 0.91 && height > 5) {
                const treeH = 6 + Math.floor(Math.random()*4);
                for (let h = 1; h <= treeH; h++) addBlock(x, height+h, z, 4);
                for (let lx=-2; lx<=2; lx++) for (let ly=-3; ly<=2; ly++) for (let lz=-2; lz<=2; lz++) {
                    if (Math.abs(lx)+Math.abs(lz)+Math.abs(ly) < 6) {
                        const tx=x+lx, ty=height+treeH+ly, tz=z+lz;
                        if (!blocksMap.has(`${tx},${ty},${tz}`)) addBlock(tx, ty, tz, 5);
                    }
                }
            }
        }
    }
    player.position.set(0, 35, 30);
}

function addBlock(x, y, z, type) {
    const key = `${x},${y},${z}`;
    if (blocksMap.has(key)) return;
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE),
        new THREE.MeshLambertMaterial({ color: BLOCK_TYPES[type].color, flatShading: true })
    );
    mesh.position.set(x+0.5, y+0.5, z+0.5);
    scene.add(mesh);
    blocksMap.set(key, type);
    blockMeshes.push(mesh);
}

function removeBlock(x, y, z) {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    const blockType = blocksMap.get(key) || 3;
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

    // Item coletável
    const itemMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshLambertMaterial({ color: BLOCK_TYPES[blockType].color })
    );
    itemMesh.position.set(x+0.5, y+0.8, z+0.5);
    scene.add(itemMesh);
    collectibles.push({ mesh: itemMesh, type: blockType, life: 420 });
}

// ====================== COLISÃO ======================
function checkCollision(pos) {
    const half = player.width/2;
    const minX = Math.floor(pos.x - half), maxX = Math.ceil(pos.x + half);
    const minY = Math.floor(pos.y), maxY = Math.ceil(pos.y + player.height);
    const minZ = Math.floor(pos.z - half), maxZ = Math.ceil(pos.z + half);

    for (let x=minX; x<=maxX; x++)
    for (let y=minY; y<=maxY; y++)
    for (let z=minZ; z<=maxZ; z++)
        if (blocksMap.has(`${x},${y},${z}`)) return true;
    return false;
}

// ====================== PERSONAGEM ======================
function createPlayerMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6,1.2,0.3), new THREE.MeshLambertMaterial({color:0x3B8CFF}));
    body.position.y = 0.9; group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), new THREE.MeshLambertMaterial({color:0xF4C29C}));
    head.position.y = 1.95; group.add(head);
    const legGeo = new THREE.BoxGeometry(0.25,0.9,0.3);
    const legMat = new THREE.MeshLambertMaterial({color:0x222222});
    const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.2,0.35,0);
    const legR = legL.clone(); legR.position.x = 0.2;
    group.add(legL, legR);
    scene.add(group);
    return group;
}

// ====================== HOTBAR ======================
function createHotbar() {
    const el = document.getElementById('hotbar');
    el.innerHTML = '';
    Object.keys(BLOCK_TYPES).forEach((t,i) => {
        const type = parseInt(t);
        const slot = document.createElement('div');
        slot.className = `slot ${i===0?'selected':''}`;
        slot.innerHTML = `<div style="width:100%;height:100%;background:#${BLOCK_TYPES[type].color.toString(16)};display:flex;align-items:center;justify-content:center;font-size:36px;">${type===1?'🌱':type===2?'🟫':type===3?'🪨':type===4?'🪵':'🌳'}</div>`;
        slot.onclick = () => {
            selectedBlockType = type;
            document.querySelectorAll('.slot').forEach(s=>s.classList.remove('selected'));
            slot.classList.add('selected');
        };
        el.appendChild(slot);
    });
}

// ====================== CONTROLES ======================
canvas.addEventListener('click', () => canvas.requestPointerLock());
document.addEventListener('pointerlockchange', () => pointerLocked = document.pointerLockElement === canvas);

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
        document.querySelectorAll('.slot').forEach((s,i)=>s.classList.toggle('selected', i===selectedBlockType-1));
    }
    if (e.key.toLowerCase() === 'r') generateWorld();
});

window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener('mousedown', e => {
    if (!pointerLocked) return;
    e.preventDefault();
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const hits = raycaster.intersectObjects(blockMeshes);
    if (hits.length === 0) return;
    const i = hits[0];
    const n = i.face.normal;
    const p = i.point;
    const bx = Math.floor(p.x - n.x*0.001);
    const by = Math.floor(p.y - n.y*0.001);
    const bz = Math.floor(p.z - n.z*0.001);

    if (e.button === 0) removeBlock(bx, by, bz);
    else if (e.button === 2) {
        const px = bx + n.x, py = by + n.y, pz = bz + n.z;
        if (player.position.distanceTo(new THREE.Vector3(px+0.5, py+0.5, pz+0.5)) > 2)
            addBlock(px, py, pz, selectedBlockType);
    }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ====================== LOOP ======================
playerGroup = createPlayerMesh();
generateWorld();
createHotbar();

function animate() {
    requestAnimationFrame(animate);

    // Gravidade
    player.velocity.y -= 0.032;

    // Movimento
    let move = new THREE.Vector3();
    if (keys['w']) move.z -= 1;
    if (keys['s']) move.z += 1;
    if (keys['a']) move.x -= 1;
    if (keys['d']) move.x += 1;
    if (move.length() > 0) {
        move.normalize().applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
        player.velocity.x = move.x * player.speed;
        player.velocity.z = move.z * player.speed;
    } else player.velocity.x = player.velocity.z = 0;

    if (keys[' '] && player.onGround) { player.velocity.y = 0.48; player.onGround = false; }

    // Colisão
    let next = player.position.clone();
    next.x += player.velocity.x;
    if (!checkCollision(next)) player.position.x = next.x; else player.velocity.x = 0;

    next = player.position.clone();
    next.z += player.velocity.z;
    if (!checkCollision(next)) player.position.z = next.z; else player.velocity.z = 0;

    next = player.position.clone();
    next.y += player.velocity.y;
    if (!checkCollision(next)) {
        player.position.y = next.y;
        player.onGround = false;
    } else {
        if (player.velocity.y < 0) player.onGround = true;
        player.velocity.y = 0;
    }

    playerGroup.position.copy(player.position);
    playerGroup.rotation.y = yaw;

    // Câmera 3ª pessoa
    const dist = 10;
    const camX = player.position.x - Math.sin(yaw) * dist;
    const camZ = player.position.z - Math.cos(yaw) * dist;
    const camY = player.position.y + 5 + Math.sin(pitch) * 3;
    camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.18);
    camera.lookAt(player.position.x, player.position.y + 1.4, player.position.z);

    // Destaque
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const hits = raycaster.intersectObjects(blockMeshes);
    highlight.visible = hits.length > 0;
    if (hits.length > 0) {
        const pos = hits[0].point.clone().add(hits[0].face.normal.clone().multiplyScalar(0.001));
        highlight.position.set(Math.floor(pos.x)+0.5, Math.floor(pos.y)+0.5, Math.floor(pos.z)+0.5);
    }

    // Coleta de itens
    for (let i = collectibles.length-1; i >= 0; i--) {
        const c = collectibles[i];
        c.mesh.position.y -= 0.015; // leve queda
        c.mesh.rotation.y += 0.05;   // gira
        if (c.mesh.position.distanceTo(player.position) < 2) {
            itemCount++;
            document.getElementById('item-count').textContent = itemCount;
            scene.remove(c.mesh);
            collectibles.splice(i,1);
        } else if (c.life-- <= 0) {
            scene.remove(c.mesh);
            collectibles.splice(i,1);
        }
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
