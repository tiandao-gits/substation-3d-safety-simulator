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
  sunLight: THREE.DirectionalLight;
  isSoftwareGl: boolean;
  charController: MixamoCharacterController;
  envHandles: SubstationSceneHandles;
  storyProps: Act1StoryProps;
  safetyLines: SafetyLineHandles;
  debugOverlay: StoryDebugOverlay | null;
  smoothCamPos: THREE.Vector3;
  smoothLookAt: THREE.Vector3;
  /** 首帧预热完成前 runtime 跳过绘制，把编译/贴图上传藏在加载遮罩之后。 */
  readiness: { renderEnabled: boolean };
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
  const fallbackEnvTarget = pmremGenerator.fromScene(
    new RoomEnvironment(),
    0.04
  );
  scene.environment = fallbackEnvTarget.texture;
  scene.environmentIntensity = 0.55;
  pmremGenerator.dispose();

  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const textures = createSubstationTextures(maxAnisotropy);
  scene.background = textures.skybox;

  let skyboxPanoramaTexture: THREE.Texture | null = null;
  let outdoorEnvRenderTarget: THREE.WebGLRenderTarget | null = null;
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

      // 用 skybox-8k.webp 生成真实的户外 PBR 环境反射贴图赋给 scene.environment，
      // 让高压瓷瓶釉面、主变散热器与 GIS 金属外壳呈现真实的蓝天日光反射。
      // 先降采样至 512x256 再送入 PMREMGenerator（PMREM 本身输出 256 级立方体贴图），避免 8K 像素卷积阻塞主线程。
      if (!isSoftwareGl && image?.width && image?.height) {
        try {
          const envCanvas = document.createElement('canvas');
          envCanvas.width = 512;
          envCanvas.height = 256;
          const envCtx = envCanvas.getContext('2d');
          if (envCtx) {
            envCtx.drawImage(image, 0, 0, 512, 256);
            const envSourceTex = new THREE.CanvasTexture(envCanvas);
            envSourceTex.mapping = THREE.EquirectangularReflectionMapping;
            envSourceTex.colorSpace = THREE.SRGBColorSpace;
            const skyPmrem = new THREE.PMREMGenerator(renderer);
            skyPmrem.compileEquirectangularShader();
            outdoorEnvRenderTarget = skyPmrem.fromEquirectangular(envSourceTex);
            skyPmrem.dispose();
            envSourceTex.dispose();
            scene.environment = outdoorEnvRenderTarget.texture;
            scene.environmentIntensity = 0.68;
          }
        } catch (envErr) {
          console.warn('[SceneSetup] PMREM 户外环境贴图生成回退:', envErr);
        }
      }

      // 8K 环境贴图在加载阶段先上传，避免它落在进场后的某一帧上。
      renderer.initTexture(displayTexture);
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
  sunLight.position.set(player.x - 28, 42, player.z + 24);
  sunLight.target.position.set(player.x, 0, player.z);
  scene.add(sunLight.target);
  sunLight.castShadow = !isSoftwareGl;
  if (!isSoftwareGl) {
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    // 将阴影正交相机半宽从 46m 收紧至玩家周围 22m，阴影清晰度直接提升 4 倍
    const d = 22;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 115;
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

  const readiness = { renderEnabled: false };
  let readySequenceStarted = false;
  const markSceneReady = () => {
    if (
      isSceneDisposed ||
      environmentFailed ||
      characterFailed ||
      !environmentReady ||
      !characterReady ||
      readySequenceStarted
    ) {
      return;
    }
    readySequenceStarted = true;
    onSceneLoadChange({
      status: 'loading',
      progress: 0.99,
      loadedMB: combinedLoadedBytes() / (1024 * 1024),
      stage: 'finalizing',
    });
    // 预热属于加载的一部分：进度停在 99%，预热结束才置为 ready。
    // 先确保加载条把「正在完成场景初始化」这一帧画出来，再开始阻塞式预热；
    // 后台标签页 rAF 不触发，用定时器兜底，避免场景永远不就绪。
    let warmupStarted = false;
    const startWarmup = () => {
      if (warmupStarted) return;
      warmupStarted = true;
      finishSceneInitialization();
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(startWarmup));
    window.setTimeout(startWarmup, 250);
  };

  /**
   * 首帧预热：把着色器编译、阴影深度材质与贴图上传放在加载遮罩之后完成。
   * 若留给第一次可见渲染，会一次性编译数十个程序、上传上百张贴图，
   * 表现为进入游戏后卡住数秒。预热期间 runtime 暂停绘制，加载条照常收尾。
   */
  function finishSceneInitialization() {
    if (isSceneDisposed) return;
    // 1) 预编译场景内全部材质（含视锥外的物体），换机位时不再触发程序编译。
    // 角色在标题阶段默认隐藏；预热时临时显形，否则它的蒙皮程序、阴影深度材质与贴图
    // 会留到玩家按下开始后才编译/上传，形成进入游戏后的那一下卡顿。
    const rigWasVisible = charController.root.visible;
    charController.root.visible = true;
    renderer.compile(scene, camera);
    // 2) 真实绘制一帧：补齐阴影深度程序与当前机位的贴图上传。
    renderer.render(scene, camera);
    // 3) 标题机位再补一帧，覆盖标题界面首屏用到的贴图。
    camera.position.set(26, 1.95, 31.5);
    camera.lookAt(3, 3.2, 2);
    renderer.render(scene, camera);
    charController.root.visible = rigWasVisible;
    const initRig = computeCameraRigTransform(player, initialThirdPersonDist);
    camera.position.set(initRig.camX, initRig.camY, initRig.camZ);
    camera.lookAt(initRig.lookX, initRig.lookY, initRig.lookZ);
    if (isSceneDisposed) return;
    readiness.renderEnabled = true;
    document.body.dataset.scene = 'ready';
    onSceneReady();
    onSceneLoadChange({
      status: 'ready',
      progress: 1,
      loadedMB: combinedLoadedBytes() / (1024 * 1024),
    });
  }

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

  const storyProps = createAct1StoryProps(textures.contactShadow);
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
    outdoorEnvRenderTarget?.dispose();
    fallbackEnvTarget.dispose();
    textures.dispose();
    renderer.dispose();
  };

  return {
    renderer,
    scene,
    camera,
    sunLight,
    isSoftwareGl,
    charController,
    envHandles,
    storyProps,
    safetyLines,
    debugOverlay,
    smoothCamPos,
    smoothLookAt,
    readiness,
    dispose,
  };
}
