import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// === КОНФИГУРАЦИЯ ===
const CONFIG = {
    // Никнейм Minecraft (измените на свой)
    username: 'OrpoPro',
    
    // Путь к базовой модели (без текстуры)
    modelPath: 'minecraft-base-model.glb',
    
    // Настройки камеры
    camera: {
        position: { x: 0, y: 1.8, z: -2.5 },
        target: { x: 0, y: 1.2, z: 0 },
        fov: 60,
        near: 0.1,
        far: 100
    },
    
    // Настройки модели
    model: {
        scale: 1.0,
        yPosition: -1
    }
};

// === ПЕРЕМЕННЫЕ ===
let scene, camera, renderer, model;
const loader = new GLTFLoader();

// === ИНИЦИАЛИЗАЦИЯ ===
function init() {
    // Сцена
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    
    // Камера
    camera = new THREE.PerspectiveCamera(
        CONFIG.camera.fov,
        window.innerWidth / window.innerHeight,
        CONFIG.camera.near,
        CONFIG.camera.far
    );
    camera.position.set(
        CONFIG.camera.position.x,
        CONFIG.camera.position.y,
        CONFIG.camera.position.z
    );
    
    const cameraTarget = new THREE.Vector3(
        CONFIG.camera.target.x,
        CONFIG.camera.target.y,
        CONFIG.camera.target.z
    );
    camera.lookAt(cameraTarget);
    
    // Рендерер
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    
    // Освещение
    setupLighting();
    
    // Запуск
    loadModel();
}

// === ОСВЕЩЕНИЕ ===
function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(2, 5, -3);
    mainLight.castShadow = true;
    mainLight.lookAt(0, 0, 0);
    scene.add(mainLight);
}

// === ЗАГРУЗКА МОДЕЛИ ===
function loadModel() {
    document.getElementById('loading').textContent = 'Loading model...';
    
    loader.load(
        CONFIG.modelPath,
        
        // Успешная загрузка
        async (gltf) => {
            model = gltf.scene;
            
            // Настраиваем модель
            model.scale.set(CONFIG.model.scale, CONFIG.model.scale, CONFIG.model.scale);
            model.position.y = CONFIG.model.yPosition;
            
            // Сначала показываем модель без текстуры
            scene.add(model);
            
            // Затем загружаем и применяем скин
            await applySkinToModel();
            
            document.getElementById('loading').style.display = 'none';
            console.log('✅ Модель загружена');
            
            // Запускаем анимации
            startAnimations();
        },
        
        // Прогресс загрузки
        (xhr) => {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            document.getElementById('loading').textContent = `Loading model... ${percent}%`;
        },
        
        // Ошибка загрузки модели
        (error) => {
            console.error('❌ Error loading model:', error);
            document.getElementById('loading').textContent = `Error loading model: ${error.message}`;
            document.getElementById('loading').style.color = '#ff5555';
        }
    );
}

// === ПРИМЕНЕНИЕ СКИНА К МОДЕЛИ ===
async function applySkinToModel() {
    document.getElementById('loading').textContent = `Loading skin for ${CONFIG.username}...`;
    
    try {
        // Получаем скин из Mojang API
        const skinTexture = await fetchSkinFromMojang(CONFIG.username);
        
        if (!skinTexture) {
            throw new Error('Failed to load skin texture');
        }
        
        // Применяем текстуру ко всем мешам модели
        model.traverse((child) => {
            if (child.isMesh) {
                // Создаем новый материал с текстурой скина
                const material = new THREE.MeshStandardMaterial({
                    map: skinTexture,
                    roughness: 0.8,
                    metalness: 0.2
                });
                
                // Если у меша были особые свойства (например, для глаз)
                if (child.name && child.name.toLowerCase().includes('eye')) {
                    material.emissive = new THREE.Color(0x00ffff);
                    material.emissiveIntensity = 3;
                }
                
                child.material = material;
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        console.log('✅ Скин успешно применен');
        
    } catch (error) {
        console.error('❌ Error applying skin:', error);
        document.getElementById('loading').textContent = `Skin error: ${error.message}`;
        document.getElementById('loading').style.color = '#ff5555';
        
        // Оставляем модель без текстуры (будет белая)
        // Или можно использовать простой цветной материал
        model.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x888888,
                    roughness: 0.8,
                    metalness: 0.2
                });
            }
        });
    }
}

// === ПОЛУЧЕНИЕ СКИНА ИЗ MOJANG API ===
async function fetchSkinFromMojang(username) {
    console.log(`Fetching skin for ${username}...`);
    
    try {
        // Шаг 1: Получаем UUID игрока
        const uuidResponse = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        
        if (!uuidResponse.ok) {
            throw new Error(`Player "${username}" not found`);
        }
        
        const uuidData = await uuidResponse.json();
        const uuid = uuidData.id;
        console.log(`Found UUID: ${uuid}`);
        
        // Шаг 2: Получаем данные профиля
        const profileResponse = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
        
        if (!profileResponse.ok) {
            throw new Error(`Profile data not found for ${username}`);
        }
        
        const profileData = await profileResponse.json();
        console.log('Profile data received');
        
        // Шаг 3: Декодируем base64 текстур
        const textureProperty = profileData.properties.find(p => p.name === 'textures');
        
        if (!textureProperty) {
            throw new Error('No texture data found');
        }
        
        const textures = JSON.parse(atob(textureProperty.value));
        
        if (!textures.textures || !textures.textures.SKIN) {
            throw new Error('No skin texture found');
        }
        
        const skinURL = textures.textures.SKIN.url;
        console.log(`Skin URL: ${skinURL}`);
        
        // Шаг 4: Загружаем текстуру
        return await loadTexture(skinURL);
        
    } catch (error) {
        console.error('Error in fetchSkinFromMojang:', error);
        throw error; // Пробрасываем ошибку дальше
    }
}

// === ЗАГРУЗКА ТЕКСТУРЫ ===
function loadTexture(url) {
    return new Promise((resolve, reject) => {
        const textureLoader = new THREE.TextureLoader();
        
        textureLoader.load(
            url,
            (texture) => {
                // Настройки для Minecraft скина
                texture.magFilter = THREE.NearestFilter; // Сохраняем пиксельный вид
                texture.minFilter = THREE.NearestFilter;
                texture.flipY = false; // Важно! Minecraft текстуры не перевернуты
                
                console.log('✅ Текстура загружена');
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error('❌ Error loading texture:', error);
                reject(new Error(`Failed to load texture: ${error.message}`));
            }
        );
    });
}

// === АНИМАЦИИ ===
function startAnimations() {
    if (!model) return;
    
    let time = 0;
    const breathingSpeed = 0.001;
    const breathingAmount = 0.02;
    
    function animate() {
        requestAnimationFrame(animate);
        
        if (model) {
            // Легкое дыхание
            time += breathingSpeed;
            model.position.y = CONFIG.model.yPosition + Math.sin(time) * breathingAmount;
            
            // Очень легкое покачивание
            model.rotation.y = Math.sin(time * 0.5) * 0.01;
        }
        
        renderer.render(scene, camera);
    }
    
    animate();
}

// === ОБРАБОТЧИКИ СОБЫТИЙ ===
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// === УТИЛИТЫ ДЛЯ ОТЛАДКИ ===
// Добавьте в консоль браузера для проверки
window.debug = {
    reloadSkin: async () => {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('loading').textContent = 'Reloading skin...';
        await applySkinToModel();
        document.getElementById('loading').style.display = 'none';
    },
    
    showModelInfo: () => {
        if (!model) {
            console.log('Model not loaded');
            return;
        }
        
        let meshCount = 0;
        model.traverse((child) => {
            if (child.isMesh) {
                meshCount++;
                console.log(`Mesh ${meshCount}:`, child.name || 'unnamed');
                console.log('  Material:', child.material);
            }
        });
        
        console.log(`Total meshes: ${meshCount}`);
    },
    
    testSkinURL: async (username) => {
        try {
            console.log(`Testing skin fetch for ${username}...`);
            const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
            
            if (!response.ok) {
                console.log(`❌ User "${username}" not found`);
                return;
            }
            
            const data = await response.json();
            console.log(`✅ User found: ${data.name} (UUID: ${data.id})`);
            
            const profileResponse = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${data.id}`);
            const profileData = await profileResponse.json();
            console.log('Profile data:', profileData);
            
        } catch (error) {
            console.error('Test failed:', error);
        }
    }
};

// === ЗАПУСК ===
init();
