// Three.js scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x202020); // same as above
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Orbit controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

// Remove old axes helper
// scene.add(new THREE.AxesHelper(50));

// ✅ Add grid helper (for floor reference, covers negatives)
const gridHelper = new THREE.GridHelper(100, 20); // size, divisions
scene.add(gridHelper);


// keep a global list of label sprites so we can billboard them each frame
const axisLabelSprites = [];

// helper to create a sprite label from canvas
function createLabelSprite(text, colorNumber, position, scale = 6) {
    // canvas size (square)
    const size = Math.max(256, text.length * 32);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // background transparent
    ctx.clearRect(0, 0, size, size);

    // text style
    const fontSize = Math.min(64, 256 / text.length); // smaller font for long text
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const hex = colorNumber.toString(16).padStart(6, "0");
    ctx.fillStyle = "#" + hex;
    // shadow to improve readability
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10;
    ctx.fillText(text, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    // ensure label renders over thin geometry if needed:
    // material.depthTest = false; // uncomment if labels get occluded undesirably

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    // scale controls label apparent size in world units
    sprite.scale.set(scale, scale * (size / size), 1);

    // add to scene and keep reference
    scene.add(sprite);
    axisLabelSprites.push(sprite);
    return sprite;
}

// ✅ Add full axes helper (positive + negative directions)
function createFullAxes(size) {
    const axes = new THREE.Group();

    const materialX = new THREE.LineBasicMaterial({ color: 0xFF9EF2 }); // X - red
    const materialY = new THREE.LineBasicMaterial({ color: 0xFED0A8 }); // Y - green
    const materialZ = new THREE.LineBasicMaterial({ color: 0x5DA2E5 }); // Z - blue

    // X axis
    const pointsX = [new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0)];
    axes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsX), materialX));

    // Y axis
    const pointsY = [new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0)];
    axes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsY), materialY));

    // Z axis
    const pointsZ = [new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, size)];
    axes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsZ), materialZ));

    // Create sprite labels (+ and -)
    createLabelSprite("Tool in my hand", 0xFF9EF2, new THREE.Vector3(size + 3, 0, 0));
    createLabelSprite("Tool will be there...when needed", 0xFF9EF2, new THREE.Vector3(-size - 3, 0, 0));
    createLabelSprite("Because I believe it", 0xFED0A8, new THREE.Vector3(0, size + 3, 0));
    createLabelSprite("Because other people are doing it", 0xFED0A8, new THREE.Vector3(0, -size - 3, 0));
    createLabelSprite("Crystal clear", 0x5DA2E5, new THREE.Vector3(0, 0, size + 3));
    createLabelSprite("Blurry", 0x5DA2E5, new THREE.Vector3(0, 0, -size - 3));
    

    return axes;
}

scene.add(createFullAxes(50)); // same size as before


// Global considerations object
let considerations = {};

// Movable bubble
const movingBubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 32, 32),
    new THREE.MeshStandardMaterial({
        color: 0xC0C0C0,
        metalness: 2,       // full metal for shiny reflections
        roughness: 0.1,     // low roughness = sharp reflections
        emissive: 0xffffff, // soft glow
        emissiveIntensity: 0.3
    })
);
scene.add(movingBubble);
// Add effect to movable bubble



// Camera
camera.position.set(10, 10, 20);
camera.lookAt(0, 0, 0);

let activeBubble = null;
let pulseScale = 1;
let pulseDirection = 1;


// Raycaster for hover detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredSphere = null;

// Update mouse coordinates
window.addEventListener("mousemove", (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Support both local dev and production in one file
const BACKEND_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://127.0.0.1:8000'   // dev backend
  : '';                       // production (same origin)


// Load considerations from backend CSV
async function loadConsiderations() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/brain-data`); // Backend endpoint serving CSV
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();

        // Parse CSV using PapaParse
        const data = Papa.parse(csvText, { header: true }).data;

        // Assign colors manually
        const colors = {
            "Value?": 0xFF9EF2,
            "Resource?": 0xFED0A8,
            "People?": 0x5DA2E5
        };

        data.forEach(row => {
            const key = row.Consideration;
            const x = parseFloat(row.x);
            const y = parseFloat(row.y);
            const z = parseFloat(row.z);

            // Create bigger sphere
            const geom = new THREE.SphereGeometry(0.6, 32, 32);
            const mat = new THREE.MeshStandardMaterial({ color: colors[key] || 0xffffff });
            const sphere = new THREE.Mesh(geom, mat);
            sphere.position.set(x, y, z);
            scene.add(sphere);

            // Create label above the sphere
            const labelPos = new THREE.Vector3(x, y + 0.8, z);
            createLabelSprite(key, colors[key] || 0xffffff, labelPos, 3);

            // Save in considerations object
            considerations[key] = {
                mesh: sphere,
                color: colors[key] || 0xffffff
            };
        });

        // Initialize bubble with starting position
        updateBubble(3, 5, 5);
    } catch (err) {
        console.error("Failed to load considerations:", err);
    }
}

// Predict consideration from backend
async function predictConsideration(x, y, z) {
    try {
        const response = await fetch(`${BACKEND_URL}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x, y, z })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Prediction response:", data);

        if (data.consideration && data.consideration.length > 0 && data.consideration[0].length > 0) {
            return data.consideration[0]; // <-- "Value?", "Resource?", etc.
        } else {
            return null;
        }
    } catch (err) {
        console.error("Error fetching prediction:", err);
        return null;
    }
}

// Button event listener — read slider values
document.getElementById("predictBtn").addEventListener("click", async () => {
    const x = parseFloat(document.querySelector("#sliderX").value);
    const y = parseFloat(document.querySelector("#sliderY").value);
    const z = parseFloat(document.querySelector("#sliderZ").value);

    const result = await predictConsideration(x, y, z);

    const outputEl = document.getElementById("output");
    if (result) {
        outputEl.textContent = `Prediction: ${result}`;
    } else {
        outputEl.textContent = "No prediction received.";
    }
});

// Update moving bubble and pulse
async function updateBubble(x, y, z) {
    movingBubble.position.set(x, y, z);
    const consideration = await predictConsideration(x, y, z);

    for (let key in considerations) {
        considerations[key].mesh.scale.set(1, 1, 1);
    }

    if (consideration && considerations[consideration]) {
        activeBubble = considerations[consideration].mesh;
        const output = document.getElementById("output");
        if (output) output.innerText = "Closest Consideration: " + consideration;
    } else {
        activeBubble = null;
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (controls) controls.update();

        // Raycasting for hover detection
    raycaster.setFromCamera(mouse, camera);
    const meshes = Object.values(considerations).map(c => c.mesh);
    const intersects = raycaster.intersectObjects(meshes);

    hoveredSphere = intersects.length > 0 ? intersects[0].object : null;

    // Animate spheres
    for (let key in considerations) {
        const mesh = considerations[key].mesh;

        // Pulse hovered sphere
        if (mesh === hoveredSphere) {
            const scale = 1 + Math.sin(Date.now() * 0.005) * 0.2;
            mesh.scale.set(scale, scale, scale);
        } else {
            mesh.scale.set(1, 1, 1);
        }

        // Optional: keep activeBubble pulse separate
        if (mesh === activeBubble && mesh !== hoveredSphere) {
            pulseScale += pulseDirection * 0.01;
            if (pulseScale > 1.2) pulseDirection = -1;
            if (pulseScale < 0.8) pulseDirection = 1;
            mesh.scale.set(pulseScale, pulseScale, pulseScale);
        }
    }
    



    renderer.render(scene, camera);
}
animate();

// Slider controls
["X", "Y", "Z"].forEach(axis => {
    const slider = document.querySelector("#slider" + axis);
    if (slider) {
        slider.addEventListener("input", () => {
            const x = parseFloat(document.querySelector("#sliderX").value);
            const y = parseFloat(document.querySelector("#sliderY").value);
            const z = parseFloat(document.querySelector("#sliderZ").value);
            updateBubble(x, y, z);
        });
    }
});

// Window resize
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Load considerations from CSV
loadConsiderations();
