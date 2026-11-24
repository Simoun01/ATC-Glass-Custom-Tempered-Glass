import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createGlassEdgeTintMaterial,
  createGlassPaneGeometry,
  createSoftContactShadowTexture,
  createStudioEnvironment,
  createTemperedGlassMaterial,
  detectSoftwareWebGL,
  EdgeProfileType,
  isWebGLAvailable,
  prefersReducedMotion,
} from './webglUtils';

interface AnnotationDef {
  id: string;
  en: string;
  zh: string;
  anchor: THREE.Vector3;
}

const ANNOTATIONS: AnnotationDef[] = [
  {
    id: 'face',
    en: 'Tempered Compression Face',
    zh: '钢化压缩应力表层',
    anchor: new THREE.Vector3(-0.42, 0.35, 0.08),
  },
  {
    id: 'edge',
    en: 'Machined Edge Profile',
    zh: '精磨边型剖面',
    anchor: new THREE.Vector3(0.92, 0.05, 0.02),
  },
  {
    id: 'tint',
    en: 'Float Blue-Green Tint',
    zh: '浮法原片淡青边色',
    anchor: new THREE.Vector3(0.75, -0.92, 0.03),
  },
  {
    id: 'bore',
    en: 'Pre-Temper CNC Bore',
    zh: '钢化前 CNC 精密开孔',
    anchor: new THREE.Vector3(0.56, 0.66, 0.08),
  },
];

const _projVec = new THREE.Vector3();
const _originTarget = new THREE.Vector3(0, 0, 0);

export function initGlassAnatomy3D(): () => void {
  const section = document.getElementById('anatomy');
  const container = document.getElementById('anatomy-3d-host');
  const fallbackEl = document.getElementById('anatomy-static-fallback');
  const pinsHost = document.getElementById('anatomy-pins-layer');
  if (!section || !container) return () => {};

  let cleanupScene: (() => void) | null = null;
  let initialized = false;

  const mountWhenNear = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !initialized) {
        initialized = true;
        mountWhenNear.disconnect();
        cleanupScene = mountAnatomyScene(container, fallbackEl, pinsHost);
      }
    },
    { rootMargin: '240px 0px' }
  );

  mountWhenNear.observe(section);

  return () => {
    mountWhenNear.disconnect();
    if (cleanupScene) cleanupScene();
  };
}

function mountAnatomyScene(
  container: HTMLElement,
  fallbackEl: HTMLElement | null,
  pinsHost: HTMLElement | null
): () => void {
  const showFallback = () => {
    if (fallbackEl) fallbackEl.classList.remove('hidden');
  };

  if (!isWebGLAvailable()) {
    showFallback();
    return () => {};
  }

  const isSoftwareGl = detectSoftwareWebGL();
  const reducedMotion = prefersReducedMotion();

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    showFallback();
    return () => {};
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));

  const canvas = renderer.domElement;
  canvas.className = 'w-full h-full block cursor-grab active:cursor-grabbing select-none';
  canvas.style.touchAction = 'none';
  canvas.style.pointerEvents = 'auto';
  canvas.setAttribute('aria-label', 'Interactive 3D Glass Anatomy Inspector — Drag to rotate');
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const envTexture = createStudioEnvironment(renderer);
  scene.environment = envTexture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
  const defaultCamPos = new THREE.Vector3(1.65, 0.65, 3.85);
  camera.position.copy(defaultCamPos);

  const controls = new OrbitControls(camera, canvas);
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.2;
  controls.maxDistance = 5.8;
  controls.target.set(0, 0, 0);

  // Studio Lighting
  scene.add(new THREE.HemisphereLight('#c8ebff', '#07121e', 0.9));
  const keyLight = new THREE.DirectionalLight('#fffaf0', 2.4);
  keyLight.position.set(3.5, 4.0, 4.0);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight('#7fd1ff', 2.2);
  rimLight.position.set(-3.5, 1.5, -3.0);
  scene.add(rimLight);

  // Subtle architectural calibration bar behind pane
  const backdropMat = new THREE.MeshStandardMaterial({
    color: '#133a55',
    roughness: 0.4,
    metalness: 0.3,
  });
  const backdropLine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.7, 0.06), backdropMat);
  backdropLine.position.set(-0.3, 0, -1.1);
  backdropLine.rotation.z = 0.35;
  scene.add(backdropLine);

  // Interactive Glass Group
  const paneGroup = new THREE.Group();
  scene.add(paneGroup);

  const glassMat = createTemperedGlassMaterial(isSoftwareGl, {
    thickness: 0.6,
    roughness: 0.04,
    edgeTintHex: '#68dac5',
    tintHex: '#f2fcff',
  });
  const edgeTintMat = createGlassEdgeTintMaterial();
  const steelMat = new THREE.MeshStandardMaterial({
    color: '#dce7f0',
    metalness: 0.92,
    roughness: 0.18,
  });

  const baseDepth = 0.12;
  let currentProfile: EdgeProfileType = 'bevel';
  let currentThicknessMm = 10;
  let targetZScale = 1.0;
  let currentZScale = 1.0;
  let showAnnotations = true;
  let resettingCamera = false;
  let isInteracting = false;

  const paneMesh = new THREE.Mesh(
    createGlassPaneGeometry(1.78, 2.15, baseDepth, currentProfile, true),
    glassMat
  );
  const edgeRimMesh = new THREE.Mesh(
    createGlassPaneGeometry(1.79, 2.16, baseDepth * 0.92, currentProfile, false),
    edgeTintMat
  );
  edgeRimMesh.renderOrder = 1;
  paneGroup.add(paneMesh, edgeRimMesh);

  const boreRadius = Math.min(1.78, 2.15) * 0.055;
  const sleeveMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(boreRadius + 0.01, boreRadius + 0.01, baseDepth * 1.15, 24, 1, true),
    steelMat
  );
  sleeveMesh.rotation.x = Math.PI / 2;
  sleeveMesh.position.set((1.78 / 2) * 0.62, (2.15 / 2) * 0.62, 0);
  paneGroup.add(sleeveMesh);

  const shadowTexture = createSoftContactShadowTexture();
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.3),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0, -1.35, 0);
  scene.add(shadowPlane);

  // Floating Annotation DOM Pins (pointer-events-none + no backdrop-blur over WebGL)
  const pinElements = new Map<string, HTMLDivElement>();
  const getLang = (): 'en' | 'zh' =>
    document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';

  if (pinsHost) {
    pinsHost.innerHTML = '';
    ANNOTATIONS.forEach((ann) => {
      const el = document.createElement('div');
      el.className =
        'absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none rounded-md border border-glassblue/40 bg-[#0B1B2B]/90 px-2.5 py-1 text-[11px] font-medium text-white shadow-md whitespace-nowrap transition-opacity duration-200';
      el.innerHTML = `<span class="inline-block h-1.5 w-1.5 rounded-full bg-safety mr-1.5 align-middle"></span><span data-pin-label="${ann.id}">${getLang() === 'zh' ? ann.zh : ann.en}</span>`;
      pinsHost.appendChild(el);
      pinElements.set(ann.id, el);
    });
  }

  const updateAnnotationLabels = () => {
    const lang = getLang();
    ANNOTATIONS.forEach((ann) => {
      const el = pinElements.get(ann.id);
      const label = el?.querySelector(`[data-pin-label="${ann.id}"]`);
      if (label) label.textContent = lang === 'zh' ? ann.zh : ann.en;
    });
  };

  const updateAnnotationPositions = () => {
    if (!pinsHost) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;

    ANNOTATIONS.forEach((ann) => {
      const el = pinElements.get(ann.id);
      if (!el) return;
      if (!showAnnotations) {
        el.style.opacity = '0';
        return;
      }
      _projVec.copy(ann.anchor);
      _projVec.z *= currentZScale;
      paneGroup.localToWorld(_projVec);
      _projVec.project(camera);

      if (_projVec.z > 1) {
        el.style.opacity = '0';
        return;
      }
      const x = (_projVec.x * 0.5 + 0.5) * w;
      const y = (-_projVec.y * 0.5 + 0.5) * h;
      el.style.left = `${THREE.MathUtils.clamp(x, 60, w - 60)}px`;
      el.style.top = `${THREE.MathUtils.clamp(y, 24, h - 24)}px`;
      el.style.opacity = '1';
    });
  };

  // Loop state (single running flag, requestAnimationFrame-only)
  let isVisible = true;
  let isLoopRunning = false;
  let disposed = false;
  let contextLost = false;
  let rafId = 0;
  let elapsed = 0;
  const clock = new THREE.Clock();

  const renderFrame = (dt: number) => {
    if (disposed || contextLost) return;
    elapsed += dt;

    currentZScale = THREE.MathUtils.damp(currentZScale, targetZScale, 9, dt);
    paneMesh.scale.z = currentZScale;
    edgeRimMesh.scale.z = currentZScale;
    sleeveMesh.scale.y = currentZScale;

    if (resettingCamera) {
      camera.position.lerp(defaultCamPos, 1 - Math.exp(-7 * dt));
      controls.target.lerp(_originTarget, 1 - Math.exp(-7 * dt));
      if (camera.position.distanceTo(defaultCamPos) < 0.02) {
        camera.position.copy(defaultCamPos);
        controls.target.copy(_originTarget);
        resettingCamera = false;
      }
    }

    if (!reducedMotion && !isInteracting) {
      paneGroup.rotation.y = THREE.MathUtils.damp(
        paneGroup.rotation.y,
        Math.sin(elapsed * 0.4) * 0.08,
        3,
        dt
      );
    }

    // Call controls.update() once per animation frame (never from a 'change' listener)
    controls.update();

    if (fallbackEl && !fallbackEl.classList.contains('hidden')) {
      fallbackEl.classList.add('hidden');
    }
    renderer.render(scene, camera);
    updateAnnotationPositions();
  };

  const stopLoop = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    isLoopRunning = false;
  };

  const tick = () => {
    rafId = 0;
    if (disposed || !isVisible || document.hidden || contextLost) {
      isLoopRunning = false;
      return;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    renderFrame(dt);

    const settling =
      Math.abs(currentZScale - targetZScale) > 0.002 || resettingCamera || isInteracting;
    if (!reducedMotion || settling) {
      rafId = requestAnimationFrame(tick);
    } else {
      isLoopRunning = false;
    }
  };

  const startLoop = () => {
    if (isLoopRunning || disposed || !isVisible || document.hidden || contextLost) return;
    isLoopRunning = true;
    clock.getDelta();
    rafId = requestAnimationFrame(tick);
  };

  // Edge Profile Rebuild
  const rebuildEdgeProfile = (profile: EdgeProfileType) => {
    if (profile === currentProfile) return;
    currentProfile = profile;

    const newPaneGeo = createGlassPaneGeometry(1.78, 2.15, baseDepth, profile, true);
    const newRimGeo = createGlassPaneGeometry(1.79, 2.16, baseDepth * 0.92, profile, false);

    paneMesh.geometry.dispose();
    edgeRimMesh.geometry.dispose();
    paneMesh.geometry = newPaneGeo;
    edgeRimMesh.geometry = newRimGeo;
    startLoop();
  };

  // Thickness Setter (5 / 6 / 8 / 10 / 12 mm)
  const setThicknessMm = (mm: number) => {
    currentThicknessMm = mm;
    targetZScale = 0.5 + ((mm - 5) / 7) * 1.15;
    glassMat.thickness = 0.25 + (mm / 12) * 0.55;
    const readout = document.getElementById('anatomy-thickness-readout');
    if (readout) readout.textContent = `${mm}.0 mm`;
    startLoop();
  };

  // UI Control Bindings
  const thicknessBtns = document.querySelectorAll<HTMLButtonElement>('[data-anatomy-thickness]');
  const edgeBtns = document.querySelectorAll<HTMLButtonElement>('[data-anatomy-edge]');
  const resetBtn = document.getElementById('anatomy-reset-view');
  const togglePinsBtn = document.getElementById('anatomy-toggle-pins');

  const syncControlButtons = () => {
    thicknessBtns.forEach((btn) => {
      const active = Number(btn.dataset.anatomyThickness) === currentThicknessMm;
      btn.setAttribute('aria-pressed', String(active));
      btn.className = active
        ? 'rounded-lg border border-glassblue bg-glassblue px-3 py-2 font-mono text-xs font-bold text-navy-950 transition-colors'
        : 'rounded-lg border border-white/15 bg-navy-800/70 px-3 py-2 font-mono text-xs font-medium text-slate-200 hover:border-glassblue/60 transition-colors';
    });
    edgeBtns.forEach((btn) => {
      const active = btn.dataset.anatomyEdge === currentProfile;
      btn.setAttribute('aria-pressed', String(active));
      btn.className = active
        ? 'rounded-lg border border-safety bg-safety px-3.5 py-2 text-xs font-semibold text-white transition-colors'
        : 'rounded-lg border border-white/15 bg-navy-800/70 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-glassblue/60 transition-colors';
    });
  };

  thicknessBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mm = Number(btn.dataset.anatomyThickness || 10);
      setThicknessMm(mm);
      syncControlButtons();
    });
  });

  edgeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const prof = (btn.dataset.anatomyEdge as EdgeProfileType) || 'bevel';
      rebuildEdgeProfile(prof);
      syncControlButtons();
    });
  });

  resetBtn?.addEventListener('click', () => {
    resettingCamera = true;
    startLoop();
  });

  togglePinsBtn?.addEventListener('click', () => {
    showAnnotations = !showAnnotations;
    togglePinsBtn.setAttribute('aria-pressed', String(showAnnotations));
    updateAnnotationPositions();
  });

  controls.addEventListener('start', () => {
    isInteracting = true;
    resettingCamera = false;
    startLoop();
  });
  controls.addEventListener('end', () => {
    isInteracting = false;
  });
  // Important: in reducedMotion, schedule an async rAF tick rather than calling renderFrame/controls.update synchronously!
  controls.addEventListener('change', () => {
    if (reducedMotion && !isLoopRunning) {
      startLoop();
    }
  });

  const onLangChange = () => updateAnnotationLabels();
  window.addEventListener('atc:langchange', onLangChange);

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    updateAnnotationPositions();
    startLoop();
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleNow = entries[0]?.isIntersecting ?? true;
      isVisible = visibleNow;
      if (visibleNow) {
        startLoop();
      } else {
        stopLoop();
      }
    },
    { threshold: 0.02 }
  );
  intersectionObserver.observe(container);

  const onVisibilityChange = () => {
    if (document.hidden) {
      stopLoop();
    } else {
      startLoop();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const onContextLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    stopLoop();
    showFallback();
  };
  const onContextRestored = () => {
    contextLost = false;
    if (fallbackEl) fallbackEl.classList.add('hidden');
    renderFrame(0.016);
    startLoop();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  setThicknessMm(10);
  syncControlButtons();
  renderFrame(0.016);
  if (!reducedMotion) {
    startLoop();
  }

  return () => {
    disposed = true;
    stopLoop();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    window.removeEventListener('atc:langchange', onLangChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    controls.dispose();

    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material?.dispose();
      }
    });
    envTexture.dispose();
    shadowTexture.dispose();
    renderer.dispose();
    canvas.remove();
  };
}
