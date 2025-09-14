import WindowManager from './WindowManager.js'

const t = THREE;
let camera, scene, renderer, world;
let near, far;
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1;
let cubes = [];
let connections = []; // Store energy beams between cubes
let auraFields = []; // Store aura effects around cubes
let sceneOffsetTarget = {x: 0, y: 0};
let sceneOffset = {x: 0, y: 0};

let today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);
today = today.getTime();

let internalTime = getTime();
let windowManager;
let initialized = false;

// get time in seconds since beginning of the day (so that all windows use the same time)
function getTime ()
{
	return (new Date().getTime() - today) / 1000.0;
}

if (new URLSearchParams(window.location.search).get("clear"))
{
	localStorage.clear();
}
else
{	
	// this code is essential to circumvent that some browsers preload the content of some pages before you actually hit the url
	document.addEventListener("visibilitychange", () => 
	{
		if (document.visibilityState != 'hidden' && !initialized)
		{
			init();
		}
	});

	window.onload = () => {
		if (document.visibilityState != 'hidden')
		{
			init();
		}
	};

	function init ()
	{
		initialized = true;

		// add a short timeout because window.offsetX reports wrong values before a short period 
		setTimeout(() => {
			setupScene();
			setupWindowManager();
			resize();
			updateWindowShape(false);
			render();
			window.addEventListener('resize', resize);
		}, 500)	
	}

	function setupScene ()
	{
		camera = new t.OrthographicCamera(0, 0, window.innerWidth, window.innerHeight, -10000, 10000);
		
		camera.position.z = 2.5;
		near = camera.position.z - .5;
		far = camera.position.z + 0.5;

		scene = new t.Scene();
		scene.background = new t.Color(0x000011); // Deep space background
		scene.add( camera );

		renderer = new t.WebGLRenderer({antialias: true, depthBuffer: true});
		renderer.setPixelRatio(pixR);
		
		// Enhanced renderer settings
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = t.PCFSoftShadowMap;
		renderer.outputColorSpace = t.SRGBColorSpace;
		renderer.toneMapping = t.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.2;
	    
	  	world = new t.Object3D();
		scene.add(world);

		// Add dynamic lighting system
		setupLighting();
		
		// Add background particles
		createBackgroundParticles();

		renderer.domElement.setAttribute("id", "scene");
		document.body.appendChild( renderer.domElement );
	}

	function setupWindowManager ()
	{
		windowManager = new WindowManager();
		windowManager.setWinShapeChangeCallback(updateWindowShape);
		windowManager.setWinChangeCallback(windowsUpdated);

		// here you can add your custom metadata to each windows instance
		let metaData = {foo: "bar"};

		// this will init the windowmanager and add this window to the centralised pool of windows
		windowManager.init(metaData);

		// call update windows initially (it will later be called by the win change callback)
		windowsUpdated();
	}

	function windowsUpdated ()
	{
		updateNumberOfCubes();
	}

	function updateNumberOfCubes ()
	{
		let wins = windowManager.getWindows();

		// remove all cubes and connections
		cubes.forEach((c) => {
			world.remove(c.main);
			world.remove(c.wireframe);
			if (c.aura) world.remove(c.aura);
		})
		
		connections.forEach((conn) => {
			world.remove(conn);
		})
		
		auraFields.forEach((aura) => {
			world.remove(aura);
		})

		cubes = [];
		connections = [];
		auraFields = [];

		// add new enhanced cubes with amazing effects
		for (let i = 0; i < wins.length; i++)
		{
			let win = wins[i];

			// Create vibrant, animated colors
			let c = new t.Color();
			c.setHSL(i * .15, 1.0, .6);

			let s = 120 + i * 40;
			
			// Create multiple geometries for layered effects
			let geometry = new t.BoxGeometry(s, s, s);
			
			// Enhanced material with glow and transparency
			let material = new t.MeshPhongMaterial({
				color: c,
				transparent: true,
				opacity: 0.8,
				wireframe: false,
				emissive: c.clone().multiplyScalar(0.3),
				shininess: 100
			});

			let cube = new t.Mesh(geometry, material);
			cube.position.x = win.shape.x + (win.shape.w * .5);
			cube.position.y = win.shape.y + (win.shape.h * .5);
			cube.position.z = 0;

			// Add wireframe overlay for extra effect
			let wireframeMaterial = new t.MeshBasicMaterial({
				color: c.clone().offsetHSL(0, 0, 0.3),
				wireframe: true,
				transparent: true,
				opacity: 0.4
			});
			let wireframeCube = new t.Mesh(geometry, wireframeMaterial);
			wireframeCube.position.copy(cube.position);
			wireframeCube.scale.set(1.05, 1.05, 1.05);

			// Create magical aura around each cube
			let aura = createMagicalAura(cube, c, i);

			// Create particle trail effect around each cube
			createParticleTrail(cube, c, i);

			world.add(cube);
			world.add(wireframeCube);
			world.add(aura);
			
			cubes.push({
				main: cube, 
				wireframe: wireframeCube, 
				aura: aura,
				color: c,
				index: i
			});
		}
		
		// Create energy connections between all cubes
		createEnergyConnections();
	}

	function updateWindowShape (easing = true)
	{
		// storing the actual offset in a proxy that we update against in the render function
		sceneOffsetTarget = {x: -window.screenX, y: -window.screenY};
		if (!easing) sceneOffset = sceneOffsetTarget;
	}

	function render ()
	{
		let time = getTime();

		windowManager.update();

		// calculate the new position based on the delta between current offset and new offset times a falloff value (to create the nice smoothing effect)
		let falloff = .05;
		sceneOffset.x = sceneOffset.x + ((sceneOffsetTarget.x - sceneOffset.x) * falloff);
		sceneOffset.y = sceneOffset.y + ((sceneOffsetTarget.y - sceneOffset.y) * falloff);

		// set the world position to the offset
		world.position.x = sceneOffset.x;
		world.position.y = sceneOffset.y;

		let wins = windowManager.getWindows();

		// loop through all our cubes and update their positions with enhanced effects
		for (let i = 0; i < cubes.length; i++)
		{
			let cubeObj = cubes[i];
			let cube = cubeObj.main;
			let wireframe = cubeObj.wireframe;
			let aura = cubeObj.aura;
			let win = wins[i];

			let posTarget = {x: win.shape.x + (win.shape.w * .5), y: win.shape.y + (win.shape.h * .5)}

			// Smooth position interpolation
			cube.position.x = cube.position.x + (posTarget.x - cube.position.x) * falloff;
			cube.position.y = cube.position.y + (posTarget.y - cube.position.y) * falloff;
			
			// Enhanced rotation with multiple axes
			cube.rotation.x = time * 0.3 + i * 0.1;
			cube.rotation.y = time * 0.5 + i * 0.15;
			cube.rotation.z = time * 0.2 + i * 0.05;
			
			// Pulsing scale effect
			let pulseScale = 1 + Math.sin(time * 2 + i) * 0.1;
			cube.scale.set(pulseScale, pulseScale, pulseScale);
			
			// Update wireframe position and rotation
			wireframe.position.copy(cube.position);
			wireframe.rotation.copy(cube.rotation);
			wireframe.rotation.x += time * 0.1;
			wireframe.rotation.y -= time * 0.1;
			
			// Animate magical aura
			if (aura) {
				aura.position.copy(cube.position);
				aura.position.z = cube.position.z - 20; // Slightly behind cube
				aura.rotation.z = time * 0.3 + i * 0.2;
				
				// Pulsing aura scale
				let auraScale = 1 + Math.sin(time * 1.5 + i) * 0.3;
				aura.scale.set(auraScale, auraScale, 1);
				
				// Dynamic aura opacity
				aura.material.opacity = 0.2 + Math.sin(time * 2 + i) * 0.1;
			}
			
			// Animate particle trails
			if (cube.userData.particles) {
				let particles = cube.userData.particles;
				particles.position.copy(cube.position);
				particles.rotation.z = time * 0.5 + i;
				
				// Update particle positions for orbital motion
				let positions = particles.geometry.attributes.position.array;
				for (let j = 0; j < positions.length; j += 3) {
					let angle = (j / 3) / (positions.length / 3) * Math.PI * 2 + time + i;
					let radius = 60 + Math.sin(time * 2 + j) * 20;
					positions[j] = Math.cos(angle) * radius;
					positions[j + 1] = Math.sin(angle) * radius;
					positions[j + 2] = Math.sin(time * 3 + j) * 30;
				}
				particles.geometry.attributes.position.needsUpdate = true;
			}
			
			// Dynamic color shifting
			let hue = (time * 30 + i * 60) % 360;
			cube.material.color.setHSL(hue / 360, 1.0, 0.6);
			cube.material.emissive.setHSL(hue / 360, 1.0, 0.2);
			cubeObj.color.setHSL(hue / 360, 1.0, 0.6); // Update stored color
		}

		// Animate energy connections between cubes
		animateConnections(time);

		// Animate lights
		animateLights(time);
		
		// Animate background particles
		animateBackgroundParticles(time);

		renderer.render(scene, camera);
		requestAnimationFrame(render);
	}

	// Animate connections between cubes
	function animateConnections(time) {
		connections.forEach(connection => {
			if (connection.userData && connection.userData.cube1) {
				// This is an energy beam
				const cube1 = connection.userData.cube1;
				const cube2 = connection.userData.cube2;
				
				// Update beam position to midpoint between cubes
				const midpoint = new t.Vector3()
					.addVectors(cube1.main.position, cube2.main.position)
					.multiplyScalar(0.5);
				connection.position.copy(midpoint);
				
				// Update beam rotation to point between cubes
				connection.lookAt(cube2.main.position);
				connection.rotateZ(Math.PI / 2);
				
				// Update beam length based on distance
				const distance = cube1.main.position.distanceTo(cube2.main.position);
				connection.scale.y = distance / connection.userData.originalDistance;
				
				// Pulsing beam effect
				const pulse = 1 + Math.sin(time * 4) * 0.3;
				connection.scale.x = pulse;
				connection.scale.z = pulse;
				
				// Dynamic beam color mixing
				const mixedColor = cube1.color.clone().lerp(cube2.color, 0.5 + Math.sin(time * 2) * 0.2);
				connection.material.color.copy(mixedColor);
				connection.material.emissive.copy(mixedColor.clone().multiplyScalar(0.4));
				
				// Oscillating opacity
				connection.material.opacity = 0.4 + Math.sin(time * 3) * 0.2;
				
			} else if (connection.geometry && connection.geometry.attributes.position) {
				// This is connection particles
				const cube1 = connection.userData.cube1;
				const cube2 = connection.userData.cube2;
				
				const positions = connection.geometry.attributes.position.array;
				const colors = connection.geometry.attributes.color.array;
				const particleCount = positions.length / 3;
				
				// Update particle positions along the line between cubes
				for (let i = 0; i < particleCount; i++) {
					const i3 = i * 3;
					const t = i / (particleCount - 1); // 0 to 1 along the line
					
					// Add wave motion along the connection
					const waveOffset = Math.sin(time * 2 + t * Math.PI * 4) * 20;
					
					// Linear interpolation with wave motion
					positions[i3] = cube1.main.position.x + (cube2.main.position.x - cube1.main.position.x) * t;
					positions[i3 + 1] = cube1.main.position.y + (cube2.main.position.y - cube1.main.position.y) * t + waveOffset;
					positions[i3 + 2] = cube1.main.position.z + (cube2.main.position.z - cube1.main.position.z) * t + Math.sin(time * 3 + t * Math.PI * 2) * 10;
					
					// Dynamic color mixing with flow effect
					const flowPhase = (time * 2 + t) % 1;
					const mixedColor = cube1.color.clone().lerp(cube2.color, flowPhase);
					colors[i3] = mixedColor.r;
					colors[i3 + 1] = mixedColor.g;
					colors[i3 + 2] = mixedColor.b;
				}
				
				connection.geometry.attributes.position.needsUpdate = true;
				connection.geometry.attributes.color.needsUpdate = true;
			}
		});
	}

	// Animate the lighting system
	function animateLights(time) {
		scene.children.forEach(child => {
			if (child instanceof t.PointLight && child.userData.originalPos) {
				let data = child.userData;
				let angle = time * 0.5 + data.colorIndex;
				let radius = 300 + Math.sin(time + data.colorIndex) * 200;
				
				child.position.x = data.originalPos.x + Math.cos(angle) * radius;
				child.position.y = data.originalPos.y + Math.sin(angle) * radius;
				child.position.z = data.originalPos.z + Math.sin(time * 2 + data.colorIndex) * 100;
				
				// Pulsing intensity
				child.intensity = data.baseIntensity + Math.sin(time * 3 + data.colorIndex) * 0.5;
			}
		});
	}

	// Animate background particles
	function animateBackgroundParticles(time) {
		if (world.userData.backgroundParticles) {
			let particles = world.userData.backgroundParticles;
			particles.rotation.z = time * 0.05;
			
			// Subtle floating motion
			let positions = particles.geometry.attributes.position.array;
			for (let i = 0; i < positions.length; i += 3) {
				positions[i + 2] += Math.sin(time * 0.5 + i) * 0.1;
			}
			particles.geometry.attributes.position.needsUpdate = true;
		}
	}

	// Create magical aura around cubes
	function createMagicalAura(cube, color, index) {
		// Create expanding ring aura
		const auraGeometry = new t.RingGeometry(80, 120, 32);
		const auraMaterial = new t.MeshBasicMaterial({
			color: color,
			transparent: true,
			opacity: 0.3,
			side: t.DoubleSide,
			blending: t.AdditiveBlending
		});
		
		const aura = new t.Mesh(auraGeometry, auraMaterial);
		aura.position.copy(cube.position);
		aura.rotation.x = Math.PI / 2; // Lay flat
		
		return aura;
	}

	// Create energy connections between cubes
	function createEnergyConnections() {
		for (let i = 0; i < cubes.length; i++) {
			for (let j = i + 1; j < cubes.length; j++) {
				const cube1 = cubes[i];
				const cube2 = cubes[j];
				
				// Create energy beam between cubes
				const beam = createEnergyBeam(cube1, cube2);
				connections.push(beam);
				world.add(beam);
				
				// Create floating energy particles along the connection
				const connectionParticles = createConnectionParticles(cube1, cube2);
				connections.push(connectionParticles);
				world.add(connectionParticles);
			}
		}
	}

	// Create energy beam between two cubes
	function createEnergyBeam(cube1, cube2) {
		const distance = cube1.main.position.distanceTo(cube2.main.position);
		const geometry = new t.CylinderGeometry(2, 2, distance, 8);
		
		// Mix colors of both cubes
		const mixedColor = cube1.color.clone().lerp(cube2.color, 0.5);
		
		const material = new t.MeshBasicMaterial({
			color: mixedColor,
			transparent: true,
			opacity: 0.6,
			emissive: mixedColor.clone().multiplyScalar(0.3),
			blending: t.AdditiveBlending
		});
		
		const beam = new t.Mesh(geometry, material);
		
		// Position beam between cubes
		const midpoint = new t.Vector3()
			.addVectors(cube1.main.position, cube2.main.position)
			.multiplyScalar(0.5);
		beam.position.copy(midpoint);
		
		// Rotate beam to point from cube1 to cube2
		beam.lookAt(cube2.main.position);
		beam.rotateZ(Math.PI / 2);
		
		// Store references for animation
		beam.userData = { cube1: cube1, cube2: cube2, originalDistance: distance };
		
		return beam;
	}

	// Create floating particles along connections
	function createConnectionParticles(cube1, cube2) {
		const particleCount = 20;
		const geometry = new t.BufferGeometry();
		const positions = new Float32Array(particleCount * 3);
		const colors = new Float32Array(particleCount * 3);
		
		const mixedColor = cube1.color.clone().lerp(cube2.color, 0.5);
		
		for (let i = 0; i < particleCount; i++) {
			const i3 = i * 3;
			const t = i / (particleCount - 1);  // 0 to 1 along the line
			
			// Linear interpolation between cube positions
			positions[i3] = cube1.main.position.x + (cube2.main.position.x - cube1.main.position.x) * t;
			positions[i3 + 1] = cube1.main.position.y + (cube2.main.position.y - cube1.main.position.y) * t;
			positions[i3 + 2] = cube1.main.position.z + (cube2.main.position.z - cube1.main.position.z) * t;
			
			colors[i3] = mixedColor.r;
			colors[i3 + 1] = mixedColor.g;
			colors[i3 + 2] = mixedColor.b;
		}
		
		geometry.setAttribute('position', new t.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new t.BufferAttribute(colors, 3));
		
		const material = new t.PointsMaterial({
			size: 4,
			vertexColors: true,
			transparent: true,
			opacity: 0.8,
			blending: t.AdditiveBlending
		});
		
		const particles = new t.Points(geometry, material);
		particles.userData = { cube1: cube1, cube2: cube2 };
		
		return particles;
	}

	// Create particle trail around cubes
	function createParticleTrail(cube, color, index) {
		const particleCount = 50;
		const geometry = new t.BufferGeometry();
		const positions = new Float32Array(particleCount * 3);
		const colors = new Float32Array(particleCount * 3);
		
		for (let i = 0; i < particleCount; i++) {
			const i3 = i * 3;
			const radius = 60 + Math.random() * 40;
			const angle = (i / particleCount) * Math.PI * 2;
			
			positions[i3] = Math.cos(angle) * radius;
			positions[i3 + 1] = Math.sin(angle) * radius;
			positions[i3 + 2] = (Math.random() - 0.5) * 60;
			
			colors[i3] = color.r;
			colors[i3 + 1] = color.g;
			colors[i3 + 2] = color.b;
		}
		
		geometry.setAttribute('position', new t.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new t.BufferAttribute(colors, 3));
		
		const material = new t.PointsMaterial({
			size: 3,
			vertexColors: true,
			transparent: true,
			opacity: 0.7,
			blending: t.AdditiveBlending
		});
		
		const particles = new t.Points(geometry, material);
		particles.position.copy(cube.position);
		world.add(particles);
		
		// Store reference for animation
		cube.userData.particles = particles;
	}

	// Setup dynamic lighting
	function setupLighting() {
		// Ambient light
		const ambientLight = new t.AmbientLight(0x404040, 0.4);
		scene.add(ambientLight);
		
		// Multiple colored point lights
		const lightColors = [0xff0044, 0x00ff44, 0x4400ff, 0xff4400, 0x44ff00, 0xff0088];
		for (let i = 0; i < lightColors.length; i++) {
			const light = new t.PointLight(lightColors[i], 1.5, 2000);
			light.position.set(
				(Math.random() - 0.5) * 2000,
				(Math.random() - 0.5) * 2000,
				100 + Math.random() * 200
			);
			light.castShadow = true;
			scene.add(light);
			
			// Store for animation
			light.userData = { 
				originalPos: light.position.clone(),
				colorIndex: i,
				baseIntensity: 1.5
			};
		}
	}

	// Create background particle field
	function createBackgroundParticles() {
		const particleCount = 200;
		const geometry = new t.BufferGeometry();
		const positions = new Float32Array(particleCount * 3);
		const colors = new Float32Array(particleCount * 3);
		
		for (let i = 0; i < particleCount; i++) {
			const i3 = i * 3;
			positions[i3] = (Math.random() - 0.5) * 4000;
			positions[i3 + 1] = (Math.random() - 0.5) * 4000;
			positions[i3 + 2] = (Math.random() - 0.5) * 1000;
			
			const brightness = Math.random();
			colors[i3] = brightness;
			colors[i3 + 1] = brightness;
			colors[i3 + 2] = brightness;
		}
		
		geometry.setAttribute('position', new t.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new t.BufferAttribute(colors, 3));
		
		const material = new t.PointsMaterial({
			size: 2,
			vertexColors: true,
			transparent: true,
			opacity: 0.6
		});
		
		const backgroundParticles = new t.Points(geometry, material);
		world.add(backgroundParticles);
		
		// Store for animation
		world.userData.backgroundParticles = backgroundParticles;
	}

	// resize the renderer to fit the window size
	function resize ()
	{
		let width = window.innerWidth;
		let height = window.innerHeight
		
		camera = new t.OrthographicCamera(0, width, 0, height, -10000, 10000);
		camera.updateProjectionMatrix();
		renderer.setSize( width, height );
	}
}

// Create floating particle system with enhanced texture
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
    
    // Generate programmatic circular particle texture for better rendering
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    
    // Create circular gradient for smooth particles
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.03,
        map: texture,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
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
    
    // Lighting that will adapt to window color (green vs red)
    const colors = [0x00ff44, 0xff0033, 0x44ff00, 0xff3300, 0x88ff44, 0xff4488];
    for (let i = 0; i < 6; i++) {
        const light = new THREE.PointLight(colors[i], 0.8, 12);
        const angle = (i / 6) * Math.PI * 2;
        light.position.set(
            Math.cos(angle) * 4,
            Math.sin(angle) * 3,
            Math.sin(angle * 1.5) * 4
        );
        light.userData = { originalColor: colors[i] }; // Store original color
        scene.add(light);
    }
}

// Initialize the 3D scene
function initThreeJS() {
    // Get canvas element
    const canvas = document.getElementById('webgl');
    
    // Create scene with cosmic dark background
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
    
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
    
    // Enhanced rendering settings for Three.js 0.160+
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    // Create amazing flowing torus knot shape - color will be determined by window position
    const geometry = new THREE.TorusKnotGeometry(1, 0.4, 128, 16, 2, 3);
    const material = new THREE.MeshStandardMaterial({
        color: 0x00ff88, // Default green, will change
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x002211,
        emissiveIntensity: 0.2
    });
    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    
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
            // Portal effect will be handled in animate loop
        }
    });
}

// Enhanced animation loop with wow effects
function animate() {
    requestAnimationFrame(animate);
    
    time += 0.016; // Approximate 60fps timing
    
    // Animate the flowing torus knot with complex rotations
    sphere.rotation.x += 0.008;
    sphere.rotation.y += 0.012;
    sphere.rotation.z += 0.006;
    
    // Enhanced pulsing effect that reacts to window position
    let windowInfluence = 0;
    try {
        const storedState = localStorage.getItem(WINDOWS_STATE_KEY);
        if (storedState) {
            const state = JSON.parse(storedState);
            const currentWindow = state[windowId];
            if (currentWindow) {
                // Use window position to influence sphere behavior
                windowInfluence = (Math.abs(currentWindow.screenX) + Math.abs(currentWindow.screenY)) * 0.0001;
            }
        }
    } catch (error) {
        // Silent fail
    }
    
    // Dynamic morphing and scaling for flowing effect
    const scaleX = 1 + Math.sin(time * 1.5 + windowInfluence * 8) * (0.15 + windowInfluence);
    const scaleY = 1 + Math.sin(time * 2.2 + windowInfluence * 12) * (0.12 + windowInfluence);
    const scaleZ = 1 + Math.sin(time * 1.8 + windowInfluence * 10) * (0.13 + windowInfluence);
    sphere.scale.set(scaleX, scaleY, scaleZ);
    
    // Determine window color based on screen position - like your image!
    let currentWindow = null;
    try {
        const storedState = localStorage.getItem(WINDOWS_STATE_KEY);
        if (storedState) {
            const state = JSON.parse(storedState);
            currentWindow = state[windowId];
        }
    } catch (error) {
        // Silent fail
    }
    
    if (currentWindow) {
        // Left side of screen = GREEN, Right side = RED
        const screenMidpoint = 1920 / 2; // Approximate screen width midpoint
        if (currentWindow.screenX < screenMidpoint) {
            // GREEN torus knot for left windows
            windowColor = 'green';
            sphere.material.color.setRGB(0, 1, 0.3);
            sphere.material.emissive.setRGB(0, 0.3, 0.1);
        } else {
            // RED torus knot for right windows  
            windowColor = 'red';
            sphere.material.color.setRGB(1, 0.2, 0.3);
            sphere.material.emissive.setRGB(0.3, 0.05, 0.1);
        }
        
        // Add subtle pulsing effect
        const pulse = Math.sin(time * 3) * 0.1 + 0.9;
        sphere.material.emissiveIntensity = 0.3 * pulse;
    }
    
    // Animate particles
    animateParticles();
    
    // Animate point lights
    animateLights();
    
    // Update window state in localStorage
    updateWindowState();
    
    // Enhanced Portal Camera Effect - Dramatic 3D transformation between windows
    try {
        const storedState = localStorage.getItem(WINDOWS_STATE_KEY);
        if (storedState) {
            const state = JSON.parse(storedState);
            const currentWindow = state[windowId];
            if (currentWindow) {
                // Calculate dramatic camera offset based on window position
                // Use larger multipliers for more noticeable effect
                const baseX = currentWindow.screenX * 0.01;  // Increased from 0.005
                const baseY = -currentWindow.screenY * 0.01; // Increased from 0.005
                
                // Add orbital movement around the sphere
                const orbitRadius = 3 + Math.abs(baseX) * 0.1 + Math.abs(baseY) * 0.1;
                const orbitAngle = time * 0.1 + (baseX + baseY) * 0.01;
                
                camera.position.x = baseX + Math.cos(orbitAngle) * 0.5;
                camera.position.y = baseY + Math.sin(orbitAngle * 0.7) * 0.3;
                camera.position.z = 5 + Math.sin(orbitAngle * 0.5) * 1;
                
                // Dynamic lookAt point with slight offset for more interesting view
                const lookAtTarget = new THREE.Vector3(
                    Math.sin(time * 0.05) * 0.2,
                    Math.cos(time * 0.03) * 0.1,
                    0
                );
                camera.lookAt(lookAtTarget);
                
                // Update on-screen display
                const windowPosEl = document.getElementById('windowPos');
                const cameraPosEl = document.getElementById('cameraPos');
                if (windowPosEl && cameraPosEl) {
                    const screenMidpoint = 1920 / 2;
                    const colorSide = currentWindow.screenX < screenMidpoint ? 'GREEN' : 'RED';
                    windowPosEl.textContent = `Position: ${currentWindow.screenX}, ${currentWindow.screenY} (${colorSide})`;
                    cameraPosEl.textContent = `Camera: ${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`;
                }
                
                // Log for debugging
                if (Math.floor(time * 10) % 60 === 0) { // Log every ~6 seconds
                    console.log(`Portal Effect - Window: ${currentWindow.screenX}, ${currentWindow.screenY} -> Camera: ${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}`);
                }
            }
        }
    } catch (error) {
        console.warn('Error reading window state for portal effect:', error);
    }
    
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
    
    let windowOffset = 0;
    let currentWindow = null;
    try {
        const storedState = localStorage.getItem(WINDOWS_STATE_KEY);
        if (storedState) {
            const state = JSON.parse(storedState);
            currentWindow = state[windowId];
            if (currentWindow) {
                windowOffset = (currentWindow.screenX + currentWindow.screenY) * 0.001;
            }
        }
    } catch (error) {
        // Silent fail
    }
    
    lights.forEach((light, index) => {
        const angle = time + (index / lights.length) * Math.PI * 2 + windowOffset;
        light.position.set(
            Math.cos(angle) * (4 + Math.sin(windowOffset) * 0.5),
            Math.sin(angle * 1.5) * (3 + Math.cos(windowOffset) * 0.3),
            Math.sin(angle * 0.7) * (3 + windowOffset * 0.1)
        );
        
        // Adjust light colors based on window position (green vs red theme)
        if (currentWindow) {
            const screenMidpoint = 1920 / 2;
            if (currentWindow.screenX < screenMidpoint) {
                // Green-tinted lights for left windows
                light.color.setRGB(0, 1, 0.3 + Math.sin(time + index) * 0.2);
            } else {
                // Red-tinted lights for right windows  
                light.color.setRGB(1, 0.2 + Math.sin(time + index) * 0.2, 0.3);
            }
        }
        
        // Pulsing intensity
        light.intensity = 0.4 + Math.sin(time * 3 + index + windowOffset) * 0.3;
    });
}

// Initialize everything
function init() {
    console.log('Initializing Multi-Window Portal Scene...');
    console.log('Window ID:', windowId);
    console.log('Three.js Version:', THREE.REVISION);
    
    try {
        // Initialize Three.js
        initThreeJS();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initial state update
        updateWindowState();
        
        // Start animation loop
        animate();
        
        console.log('Multi-Window Portal Scene initialized successfully!');
        console.log('Sphere material:', sphere.material.type);
        console.log('Particle count:', particleSystem.geometry.attributes.position.count);
    } catch (error) {
        console.error('Error initializing scene:', error);
    }
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}