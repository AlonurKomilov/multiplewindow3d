// Three.js Multi-Window Scene
// This script creates a 3D rotating cube that synchronizes across multiple browser windows

// Constants
const WINDOWS_STATE_KEY = 'multiwindow3d_state';

// Generate unique ID for this window
const windowId = crypto.randomUUID();

// Three.js objects
let scene, camera, renderer, sphere;
let ghostContainer; // Container for ghost window planes
let particles, particleSystem;
let time = 0; // For animation timing

// Create floating particle system for wow effect
function createParticleSystem() {
    const particleCount = 1000;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i += 3) {
        // Random positions around the sphere
        const radius = 3 + Math.random() * 5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        positions[i] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i + 2] = radius * Math.cos(phi);
        
        // Random velocities
        velocities[i] = (Math.random() - 0.5) * 0.02;
        velocities[i + 1] = (Math.random() - 0.5) * 0.02;
        velocities[i + 2] = (Math.random() - 0.5) * 0.02;
        
        // Rainbow colors
        colors[i] = Math.random();
        colors[i + 1] = Math.random();
        colors[i + 2] = Math.random();
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);
}

// Setup advanced lighting system
function setupAdvancedLighting() {
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);
    
    // Primary directional light with shadows
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(5, 5, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);
    
    // Colored point lights for dynamic effects
    const colors = [0xff0040, 0x0040ff, 0x40ff00, 0xff4000, 0x4000ff];
    for (let i = 0; i < 5; i++) {
        const light = new THREE.PointLight(colors[i], 0.5, 10);
        const angle = (i / 5) * Math.PI * 2;
        light.position.set(
            Math.cos(angle) * 3,
            Math.sin(angle) * 2,
            Math.sin(angle * 2) * 3
        );
        scene.add(light);
    }
}

// Initialize the 3D scene
function initThreeJS() {
    // Get canvas element
    const canvas = document.getElementById('webgl');
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    
    // Create camera with perspective
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(0, 0, 5);
    
    // Create high-performance renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Enhanced rendering settings
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    // Create main animated sphere with dynamic material
    const geometry = new THREE.SphereGeometry(1, 64, 32);
    const material = new THREE.MeshPhongMaterial({
        color: 0x00ff88,
        shininess: 100,
        transparent: true,
        opacity: 0.9,
        wireframe: false
    });
    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    
    // Create container for ghost windows (other browser windows)
    ghostContainer = new THREE.Group();
    scene.add(ghostContainer);
    
    // Create amazing particle system
    createParticleSystem();
    
    // Enhanced lighting system with multiple colored lights
    setupAdvancedLighting();
    
    // Enable shadows for better realism
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

// Window synchronization functions
function updateWindowState() {
    // Get current state from localStorage
    let state = {};
    try {
        const storedState = localStorage.getItem(WINDOWS_STATE_KEY);
        if (storedState) {
            state = JSON.parse(storedState);
        }
    } catch (error) {
        console.warn('Error reading localStorage:', error);
        state = {};
    }
    
    // Update current window's data
    state[windowId] = {
        id: windowId,
        screenX: window.screenX || window.screenLeft || 0,
        screenY: window.screenY || window.screenTop || 0,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        timestamp: Date.now()
    };
    
    // Clean up old windows (older than 5 seconds)
    const currentTime = Date.now();
    Object.keys(state).forEach(id => {
        if (currentTime - state[id].timestamp > 5000) {
            delete state[id];
        }
    });
    
    // Save updated state back to localStorage
    try {
        localStorage.setItem(WINDOWS_STATE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('Error writing to localStorage:', error);
    }
}

function updateGhostWindows() {
    // Clear existing ghost windows
    while (ghostContainer.children.length > 0) {
        ghostContainer.remove(ghostContainer.children[0]);
    }
    
    // Get current state from localStorage
    let state = {};
    try {
        const storedState = localStorage.getItem(WINDOWS_STATE_KEY);
        if (storedState) {
            state = JSON.parse(storedState);
        }
    } catch (error) {
        console.warn('Error reading localStorage:', error);
        return;
    }
    
    // Get current window's position for reference
    const currentWindow = state[windowId];
    if (!currentWindow) return;
    
    // Create ghost planes for other windows
    Object.values(state).forEach(windowData => {
        if (windowData.id === windowId) return; // Skip current window
        
        // Calculate relative position and size
        const relativeX = (windowData.screenX - currentWindow.screenX) / 200; // Scale down
        const relativeY = -(windowData.screenY - currentWindow.screenY) / 200; // Invert Y and scale down
        const scaleX = windowData.innerWidth / 800; // Scale based on window size
        const scaleY = windowData.innerHeight / 600;
        
        // Create plane geometry to represent the other window
        const planeGeometry = new THREE.PlaneGeometry(scaleX, scaleY);
        const planeMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        });
        
        const ghostPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        ghostPlane.position.set(relativeX, relativeY, -2);
        
        ghostContainer.add(ghostPlane);
    });
}

// Event listeners
function setupEventListeners() {
    // Button to open new window
    const newWindowBtn = document.getElementById('newWindowBtn');
    newWindowBtn.addEventListener('click', () => {
        window.open(window.location.href, '_blank');
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        // Update camera aspect ratio
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        
        // Update renderer size
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
    
    // Clean up when window is closing
    window.addEventListener('beforeunload', () => {
        try {
            const storedState = localStorage.getItem(WINDOWS_STATE_KEY);
            if (storedState) {
                const state = JSON.parse(storedState);
                delete state[windowId];
                localStorage.setItem(WINDOWS_STATE_KEY, JSON.stringify(state));
            }
        } catch (error) {
            console.warn('Error cleaning up localStorage:', error);
        }
    });
    
    // Listen for localStorage changes from other windows
    window.addEventListener('storage', (event) => {
        if (event.key === WINDOWS_STATE_KEY) {
            updateGhostWindows();
        }
    });
}

// Enhanced animation loop with wow effects
function animate() {
    requestAnimationFrame(animate);
    
    time += 0.016; // Approximate 60fps timing
    
    // Animate the main sphere with morphing effects
    sphere.rotation.x += 0.005;
    sphere.rotation.y += 0.01;
    sphere.rotation.z += 0.003;
    
    // Pulsing effect on the sphere
    const scale = 1 + Math.sin(time * 2) * 0.1;
    sphere.scale.set(scale, scale, scale);
    
    // Dynamic color changing
    const hue = (time * 50) % 360;
    sphere.material.color.setHSL(hue / 360, 0.7, 0.6);
    
    // Animate particles
    animateParticles();
    
    // Animate point lights
    animateLights();
    
    // Update window state in localStorage
    updateWindowState();
    
    // Update ghost windows visualization
    updateGhostWindows();
    
    // Render the scene
    renderer.render(scene, camera);
}

// Animate particle system
function animateParticles() {
    const positions = particleSystem.geometry.attributes.position.array;
    const velocities = particleSystem.geometry.attributes.velocity.array;
    
    for (let i = 0; i < positions.length; i += 3) {
        // Update positions with velocities
        positions[i] += velocities[i];
        positions[i + 1] += velocities[i + 1];
        positions[i + 2] += velocities[i + 2];
        
        // Create orbital motion around the sphere
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        const distance = Math.sqrt(x * x + y * y + z * z);
        
        // Apply gentle orbital force
        if (distance > 0) {
            const force = 0.0001;
            velocities[i] += -y * force;
            velocities[i + 1] += x * force;
            velocities[i + 2] += Math.sin(time + i) * 0.0001;
        }
        
        // Reset particles that drift too far
        if (distance > 10) {
            const radius = 3 + Math.random() * 2;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            positions[i] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = radius * Math.cos(phi);
        }
    }
    
    particleSystem.geometry.attributes.position.needsUpdate = true;
}

// Animate colored lights for dynamic effects
function animateLights() {
    const lights = scene.children.filter(child => child instanceof THREE.PointLight);
    
    lights.forEach((light, index) => {
        const angle = time + (index / lights.length) * Math.PI * 2;
        light.position.set(
            Math.cos(angle) * 4,
            Math.sin(angle * 1.5) * 3,
            Math.sin(angle * 0.7) * 3
        );
        
        // Pulsing intensity
        light.intensity = 0.3 + Math.sin(time * 3 + index) * 0.2;
    });
}

// Initialize everything
function init() {
    console.log('Initializing Multi-Window 3D Scene...');
    console.log('Window ID:', windowId);
    
    // Initialize Three.js
    initThreeJS();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initial state update
    updateWindowState();
    
    // Start animation loop
    animate();
    
    console.log('Multi-Window 3D Scene initialized successfully!');
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}