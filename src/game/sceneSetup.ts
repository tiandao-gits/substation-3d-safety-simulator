import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GAME_TEXT, MESSAGES } from '../config/gameText';
import { getAct1Point } from './act1';
import {
  createMixamoInspectorRig,
  type MixamoCharacterController,
} from './characterRig';
import { createStoryDebugOverlay, type StoryDebugOverlay } from './debugOverlay';
import {
  computeCameraRigTransform,
  type GameState,
  type PlayerState,
  type RenderDetailMode,
} from './rules';
import { createSafetyLines, type SafetyLineHandles } from './safetyLines';
import { createAct1StoryProps, type Act1StoryProps } from './storyProps';
import {
  buildSubstationEnvironment,
  type SubstationSceneHandles,
} from './substationBuilder';
import { createSubstationTextures } from './textures';

const SKYBOX_PANORAMA_URL = `${import.meta.env?.BASE_URL ?? '/'}assets/skybox-8k.webp`;

export interface SceneLoadState {
  status: 'loading' | 'ready' | 'error';
  progress: number;
  loadedMB: number;
  stage?: 'character' | 'finalizing';
  error?: string;
}

export interface CreateSubstationSceneOptions {
  container: HTMLElement;
  initialGameState: GameState;
  initialDetailMode: RenderDetailMode;
  initialThirdPersonDist: number;
  player: PlayerState;
  storyDebug: boolean;
  onSceneLoadChange: (state: SceneLoadState) => void;
  onSceneReady: () => void;
}

export interface SubstationSceneInstance {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  isSoftwareGl: boolean;
  charController: MixamoCharacterController;
  envHandles: SubstationSceneHandles;
  storyProps: Act1StoryProps;
  safetyLines: SafetyLineHandles;
  debugOverlay: StoryDebugOverlay | null;
  smoothCamPos: THREE.Vector3;
  smoothLookAt: THREE.Vector3;
  dispose: () => void;
}

function detectSoftwareWebGL(): boolean {
  const probeCanvas = document.createElement('canvas');
  const gl = probeCanvas.getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

/**
 * 创建并组装变电站 3D 场景、灯光、天空盒、角色控制器与环境资产加载器。
 */
export function createSubstationScene({
  container,
  initialGameState,
  initialDetailMode,
  initialThirdPersonDist,
  player,
  storyDebug,
  onSceneLoadChange,
  onSceneReady,
}: CreateSubstationSceneOptions): SubstationSceneInstance {
  const isSoftwareGl = detectSoftwareWebGL();

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86;
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  );
  renderer.setSize(
    container.clientWidth || window.innerWidth,
    container.clientHeight || window.innerHeight
  );
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb3d4f4, 0.0021);

  const camera = new THREE.PerspectiveCamera(
    58,
    (container.clientWidth || window.innerWidth) /
      Math.max(1, container.clientHeight || window.innerHeight),
    0.15,
    1300
  );

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(
    new RoomEnvironment(),
    0.04
  ).texture;
  scene.environmentIntensity = 0.5;
  pmremGenerator.dispose();

  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const textures = createSubstationTextures(maxAnisotropy);
  scene.background = textures.skybox;

  let skyboxPanoramaTexture: THREE.Texture | null = null;
  let isSceneDisposed = false;

  new THREE.TextureLoader().load(
    SKYBOX_PANORAMA_URL,
    (texture) => {
      if (isSceneDisposed) {
        texture.dispose();
        return;
      }

      const image = texture.image;
      const maxTextureSize = renderer.capabilities.maxTextureSize;
      let displayTexture: THREE.Texture = texture;
      if (
        image?.width &&
        image?.height &&
        (image.width > maxTextureSize || image.height > maxTextureSize)
      ) {
        const scale = Math.min(
          maxTextureSize / image.width,
          maxTextureSize / image.height
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(image.width * scale));
        canvas.height = Math.max(1, Math.floor(image.height * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          displayTexture = new THREE.Texture(canvas);
        }
      }

      displayTexture.mapping = THREE.EquirectangularReflectionMapping;
      displayTexture.colorSpace = THREE.SRGBColorSpace;
      displayTexture.wrapS = THREE.RepeatWrapping;
      displayTexture.wrapT = THREE.ClampToEdgeWrapping;
      displayTexture.anisotropy = maxAnisotropy;
      displayTexture.generateMipmaps = true;
      displayTexture.minFilter = THREE.LinearMipmapLinearFilter;
      displayTexture.magFilter = THREE.LinearFilter;
      displayTexture.needsUpdate = true;

      skyboxPanoramaTexture = displayTexture;
      scene.background = displayTexture;
    },
    undefined,
    (error) => {
      console.error(MESSAGES.skyboxLoadFailed, error);
    }
  );

  const hemiLight = new THREE.HemisphereLight(0x8ec5fc, 0x59605c, 0.55);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff2dc, 1.55);
  sunLight.position.set(-28, 42, 24);
  sunLight.castShadow = !isSoftwareGl;
  if (!isSoftwareGl) {
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    const d = 46;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 135;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
  }
  scene.add(sunLight);

  const rimLight = new THREE.DirectionalLight(0xc7d2fe, 0.32);
  rimLight.position.set(25, 22, -30);
  scene.add(rimLight);

  const charController = createMixamoInspectorRig(
    textures.contactShadow,
    !isSoftwareGl,
    { autoLoadAssets: false }
  );
  charController.root.position.set(player.x, player.y, player.z);
  charController.root.rotation.y = player.yaw;
  charController.root.visible = initialGameState !== 'title';
  scene.add(charController.root);

  let environmentReady = false;
  let environmentFailed = false;
  let characterReady = false;
  let characterFailed = false;
  let glbLoadedBytes = 0;
  let glbTotalBytes = 0;
  let characterLoadedBytes = 0;
  let characterTotalBytes = 0;

  const combinedLoadedBytes = () => glbLoadedBytes + characterLoadedBytes;

  const reportLoadProgress = () => {
    if (
      isSceneDisposed ||
      environmentFailed ||
      characterFailed ||
      (environmentReady && characterReady)
    ) {
      return;
    }
    const loadedBytes = combinedLoadedBytes();
    const totalBytes = glbTotalBytes + characterTotalBytes;
    const downloadsDone =
      glbTotalBytes > 0 &&
      characterTotalBytes > 0 &&
      glbLoadedBytes >= glbTotalBytes &&
      characterLoadedBytes >= characterTotalBytes;
    const stage = !environmentReady
      ? downloadsDone
        ? 'finalizing'
        : undefined
      : !characterReady
        ? 'character'
        : undefined;
    const progress =
      glbTotalBytes > 0 && totalBytes > 0
        ? Math.min(0.99, loadedBytes / totalBytes)
        : 0;
    onSceneLoadChange({
      status: 'loading',
      progress,
      loadedMB: loadedBytes / (1024 * 1024),
      stage,
    });
  };

  const markSceneReady = () => {
    if (
      isSceneDisposed ||
      environmentFailed ||
      characterFailed ||
      !environmentReady ||
      !characterReady
    ) {
      return;
    }
    document.body.dataset.scene = 'ready';
    onSceneReady();
    onSceneLoadChange({
      status: 'ready',
      progress: 1,
      loadedMB: combinedLoadedBytes() / (1024 * 1024),
    });
  };

  const markCharacterFailed = () => {
    if (isSceneDisposed || characterFailed) return;
    characterFailed = true;
    document.body.dataset.scene = 'error';
    onSceneLoadChange({
      status: 'error',
      progress: 0,
      loadedMB: combinedLoadedBytes() / (1024 * 1024),
      error: GAME_TEXT.sceneLoad.characterLoadFailed,
    });
  };

  void charController
    .loadDefaultMixamoRoleAssets((loadedBytes, totalBytes) => {
      characterLoadedBytes = loadedBytes;
      characterTotalBytes = totalBytes;
      if (characterReady || characterFailed) return;
      reportLoadProgress();
    })
    .then(
      () => {
        if (isSceneDisposed) return;
        if (!charController.customModelLoaded) {
          markCharacterFailed();
          return;
        }
        characterReady = true;
        markSceneReady();
      },
      () => markCharacterFailed()
    );

  const envHandles = buildSubstationEnvironment(
    scene,
    textures,
    !isSoftwareGl,
    {
      onProgress: (loadedBytes, totalBytes) => {
        glbLoadedBytes = loadedBytes;
        if (totalBytes > 0) glbTotalBytes = totalBytes;
        if (isSceneDisposed || environmentReady || environmentFailed) return;
        reportLoadProgress();
      },
      onLoaded: () => {
        if (isSceneDisposed) return;
        environmentReady = true;
        const aisle = getAct1Point('aisle');
        envHandles.cloneSceneNode('Planks', {
          x: aisle.x,
          z: aisle.z,
          rotationY: -0.35,
          scale: { x: 0.5, y: 0.55, z: 0.32 },
          name: 'clue-wood-pile-aisle',
        });
        if (characterFailed) return;
        if (characterReady) {
          markSceneReady();
          return;
        }
        reportLoadProgress();
      },
      onError: (message) => {
        if (isSceneDisposed) return;
        environmentFailed = true;
        document.body.dataset.scene = 'error';
        onSceneLoadChange({
          status: 'error',
          progress: 0,
          loadedMB: 0,
          error: message,
        });
      },
    },
    Math.min(8, maxAnisotropy)
  );
  envHandles.setRenderDetailMode(initialDetailMode);

  const storyProps = createAct1StoryProps();
  scene.add(storyProps.group);

  const safetyLines = createSafetyLines();
  scene.add(safetyLines.group);

  let debugOverlay: StoryDebugOverlay | null = null;
  if (storyDebug) {
    debugOverlay = createStoryDebugOverlay();
    scene.add(debugOverlay.group);
  }

  const initRig = computeCameraRigTransform(player, initialThirdPersonDist);
  const smoothCamPos = new THREE.Vector3(
    initRig.camX,
    initRig.camY,
    initRig.camZ
  );
  const smoothLookAt = new THREE.Vector3(
    initRig.lookX,
    initRig.lookY,
    initRig.lookZ
  );
  camera.position.copy(smoothCamPos);
  camera.lookAt(smoothLookAt);

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  const dispose = () => {
    isSceneDisposed = true;
    storyProps.dispose();
    safetyLines.dispose();
    debugOverlay?.dispose();
    skyboxPanoramaTexture?.dispose();
    textures.dispose();
    renderer.dispose();
  };

  return {
    renderer,
    scene,
    camera,
    isSoftwareGl,
    charController,
    envHandles,
    storyProps,
    safetyLines,
    debugOverlay,
    smoothCamPos,
    smoothLookAt,
    dispose,
  };
}
