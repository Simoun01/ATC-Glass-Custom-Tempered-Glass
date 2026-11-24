import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  createGlassEdgeTintMaterial,
  createGlassPaneGeometry,
  createSoftContactShadowTexture,
  createStudioEnvironment,
  createTemperedGlassMaterial,
  detectSoftwareWebGL,
  isWebGLAvailable,
  prefersReducedMotion,
} from './webglUtils';

export function initHeroGlass3D(): () => void {
  const container = document.getElementById('hero-3d-canvas-host');
  const fallbackEl = document.getElementById('hero-static-fallback');
  if (!container) return () => {};

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
  canvas.setAttribute('aria-label', 'Interactive 3D Tempered Glass Showcase — Drag to rotate');
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const envTexture = createStudioEnvironment(renderer);
  scene.environment = envTexture;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
  camera.position.set(0, 0.18, 4.9);

  // 3-point studio lighting + sweeping softbox
  const hemiLight = new THREE.HemisphereLight('#bce7ff', '#091826', 0.85);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#fff8ed', 2.4);
  keyLight.position.set(3.2, 4.0, 3.6);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight('#7fd1ff', 2.1);
  rimLight.position.set(-3.6, 1.5, -2.5);
  scene.add(rimLight);

  const sweepLight = new THREE.DirectionalLight('#ffffff', 2.8);
  sweepLight.position.set(-3, 2, 3.5);
  scene.add(sweepLight);

  let rectLight: THREE.RectAreaLight | null = null;
  if (!isSoftwareGl) {
    RectAreaLightUniformsLib.init();
    rectLight = new THREE.RectAreaLight('#e6f7ff', 4.5, 1.4, 3.6);
    rectLight.position.set(-2.5, 0.4, 2.6);
    rectLight.lookAt(0, 0, 0);
    scene.add(rectLight);
  }

  // Backdrop translucent geometric architectural planes so transmission refracts real depth
  const refractionBackdrop = new THREE.Group();
  const barMatA = new THREE.MeshStandardMaterial({
    color: '#0e3a56',
    roughness: 0.45,
    metalness: 0.25,
    emissive: '#072236',
    emissiveIntensity: 0.7,
  });
  const barMatB = new THREE.MeshStandardMaterial({
    color: '#7fd1ff',
    roughness: 0.2,
    metalness: 0.6,
    emissive: '#3ca3dc',
    emissiveIntensity: 0.6,
  });
  const backStrip1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.2, 0.08), barMatA);
  backStrip1.position.set(-0.75, 0.1, -1.45);
  backStrip1.rotation.z = -0.32;
  const backStrip2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.8, 0.06), barMatB);
  backStrip2.position.set(0.65, -0.05, -1.35);
  backStrip2.rotation.z = -0.32;
  const backRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.02, 16, 48), barMatB);
  backRing.position.set(0.05, 0.05, -1.6);
  refractionBackdrop.add(backStrip1, backStrip2, backRing);
  scene.add(refractionBackdrop);

  // Main Hero Glass Assembly
  const heroGroup = new THREE.Group();

  const mainGlassMat = createTemperedGlassMaterial(isSoftwareGl, {
    thickness: 0.5,
    roughness: 0.05,
    edgeTintHex: '#70dcc8',
    tintHex: '#f1fbff',
  });
  const edgeTintMat = createGlassEdgeTintMaterial();

  const mainGeo = createGlassPaneGeometry(1.72, 2.28, 0.11, 'bevel', true);
  const mainPane = new THREE.Mesh(mainGeo, mainGlassMat);
  heroGroup.add(mainPane);

  const edgeGeo = createGlassPaneGeometry(1.73, 2.29, 0.102, 'flat', false);
  const edgeRim = new THREE.Mesh(edgeGeo, edgeTintMat);
  edgeRim.renderOrder = 1;
  heroGroup.add(edgeRim);

  // Brushed stainless steel CNC standoff pins + bore collar
  const steelMat = new THREE.MeshStandardMaterial({
    color: '#d8e4ee',
    metalness: 0.92,
    roughness: 0.18,
  });
  const brassAccentMat = new THREE.MeshStandardMaterial({
    color: '#ff9642',
    metalness: 0.78,
    roughness: 0.25,
  });

  const hw = 1.72 / 2;
  const hh = 2.28 / 2;
  const boreX = hw * 0.62;
  const boreY = hh * 0.62;
  const boreRadius = Math.min(1.72, 2.28) * 0.055;

  const collarGeo = new THREE.TorusGeometry(boreRadius + 0.012, 0.014, 14, 28);
  const collarFront = new THREE.Mesh(collarGeo, steelMat);
  collarFront.position.set(boreX, boreY, 0.058);
  const collarBack = new THREE.Mesh(collarGeo, steelMat);
  collarBack.position.set(boreX, boreY, -0.058);
  heroGroup.add(collarFront, collarBack);

  const clampGeo = new THREE.BoxGeometry(0.24, 0.16, 0.15);
  const clamp = new THREE.Mesh(clampGeo, steelMat);
  clamp.position.set(-hw + 0.24, -hh + 0.12, 0);
  const clampBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.17, 16), brassAccentMat);
  clampBolt.rotation.x = Math.PI / 2;
  clampBolt.position.set(-hw + 0.24, -hh + 0.12, 0);
  heroGroup.add(clamp, clampBolt);

  // Specular streak highlight card
  const streakMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const streakGeo = new THREE.PlaneGeometry(0.28, 3.0);
  const streakMesh = new THREE.Mesh(streakGeo, streakMat);
  streakMesh.position.set(-1.3, 0, 0.068);
  streakMesh.rotation.z = -0.36;
  heroGroup.add(streakMesh);

  scene.add(heroGroup);

  // 3 Smaller Orbiting Thickness Panes
  const orbitGroup = new THREE.Group();
  const miniConfigs = [
    { w: 0.56, h: 0.74, d: 0.045, radius: 1.55, angle: 0.6, y: 0.65, z: -0.75, speed: 0.35 },
    { w: 0.64, h: 0.84, d: 0.075, radius: 1.65, angle: 2.7, y: -0.55, z: -0.95, speed: -0.28 },
    { w: 0.48, h: 0.64, d: 0.095, radius: 1.38, angle: 4.5, y: 0.15, z: -1.15, speed: 0.24 },
  ];

  const miniPanes: Array<{
    mesh: THREE.Mesh;
    cfg: (typeof miniConfigs)[number];
  }> = [];

  miniConfigs.forEach((cfg) => {
    const g = createGlassPaneGeometry(cfg.w, cfg.h, cfg.d, 'bevel', false);
    const m = createTemperedGlassMaterial(isSoftwareGl, {
      thickness: cfg.d * 6,
      roughness: 0.07,
      edgeTintHex: '#7fd1ff',
      tintHex: '#e4f6ff',
    });
    const mesh = new THREE.Mesh(g, m);
    orbitGroup.add(mesh);
    miniPanes.push({ mesh, cfg });
  });
  scene.add(orbitGroup);

  // Soft Contact Shadow beneath Hero Glass
  const shadowTexture = createSoftContactShadowTexture();
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.35),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0, -1.48, 0);
  scene.add(shadowPlane);

  // Resize handling
  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize();

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // Loop & interaction state
  let isVisible = true;
  let isLoopRunning = false;
  let disposed = false;
  let contextLost = false;
  let rafId = 0;
  let elapsed = 0;
  const clock = new THREE.Clock();

  // Drag-to-rotate + non-fighting hover parallax state
  let isDragging = false;
  let activePointerId: number | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let dragYaw = 0;
  let dragPitch = 0;
  let dragVelYaw = 0;
  let dragVelPitch = 0;
  let hoverTiltX = 0;
  let hoverTiltY = 0;

  const updateScene = (dt: number) => {
    elapsed += dt;

    // Gentle momentum decay after pointer release
    if (!isDragging) {
      dragYaw += dragVelYaw * dt * 60;
      dragPitch = THREE.MathUtils.clamp(dragPitch + dragVelPitch * dt * 60, -0.85, 0.85);
      dragVelYaw *= Math.pow(0.9, dt * 60);
      dragVelPitch *= Math.pow(0.9, dt * 60);
    }

    // Auto float & sway blend cleanly; hover parallax is suppressed while dragging so it never fights user input
    const autoYaw = reducedMotion ? -0.26 : Math.sin(elapsed * 0.45) * 0.2 - 0.12;
    const autoPitch = reducedMotion ? 0.06 : Math.cos(elapsed * 0.35) * 0.05 + 0.04;
    const bobY = reducedMotion ? 0 : Math.sin(elapsed * 1.15) * 0.065;

    const parallaxScale = isDragging || reducedMotion ? 0 : 1;
    const desiredYaw = dragYaw + autoYaw + hoverTiltY * parallaxScale;
    const desiredPitch = THREE.MathUtils.clamp(
      dragPitch + autoPitch + hoverTiltX * parallaxScale,
      -0.95,
      0.95
    );

    heroGroup.position.y = bobY;
    const dampSpeed = isDragging ? 18 : 6;
    heroGroup.rotation.y = THREE.MathUtils.damp(heroGroup.rotation.y, desiredYaw, dampSpeed, dt);
    heroGroup.rotation.x = THREE.MathUtils.damp(heroGroup.rotation.x, desiredPitch, dampSpeed, dt);

    shadowPlane.scale.setScalar(1 - bobY * 0.35);

    if (!reducedMotion) {
      const cycle = (elapsed % 4.5) / 4.5;
      const sweepActive = cycle < 0.42;
      const tSweep = sweepActive ? cycle / 0.42 : 0;
      const sweepX = THREE.MathUtils.lerp(-1.55, 1.55, tSweep);
      streakMesh.position.x = sweepX;
      streakMat.opacity = sweepActive ? Math.sin(tSweep * Math.PI) * 0.16 : 0;
      sweepLight.position.x = THREE.MathUtils.lerp(-3.5, 3.5, (elapsed % 6) / 6);
      if (rectLight) {
        rectLight.position.x = Math.sin(elapsed * 0.7) * 2.6;
        rectLight.lookAt(0, 0, 0);
      }
    }

    miniPanes.forEach(({ mesh, cfg }, idx) => {
      const a = cfg.angle + (reducedMotion ? 0 : elapsed * cfg.speed);
      mesh.position.set(
        Math.cos(a) * cfg.radius * 0.85,
        cfg.y + Math.sin(elapsed * 0.9 + idx) * 0.06,
        cfg.z + Math.sin(a) * 0.35
      );
      mesh.rotation.y = a * 0.6 + 0.3;
      mesh.rotation.x = Math.sin(elapsed * 0.5 + idx) * 0.14;
    });

    if (fallbackEl && !fallbackEl.classList.contains('hidden')) {
      fallbackEl.classList.add('hidden');
    }
    renderer.render(scene, camera);
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
    updateScene(dt);

    const hasMotion =
      !reducedMotion ||
      isDragging ||
      Math.abs(dragVelYaw) > 0.0004 ||
      Math.abs(dragVelPitch) > 0.0004;

    if (hasMotion) {
      rafId = requestAnimationFrame(tick);
    } else {
      isLoopRunning = false;
    }
  };

  const startLoop = () => {
    if (isLoopRunning || disposed || !isVisible || document.hidden || contextLost) return;
    if (reducedMotion && !isDragging && Math.abs(dragVelYaw) <= 0.0004 && Math.abs(dragVelPitch) <= 0.0004) {
      return;
    }
    isLoopRunning = true;
    clock.getDelta();
    rafId = requestAnimationFrame(tick);
  };

  // Pointer drag handlers with setPointerCapture
  const onCanvasPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isDragging = true;
    activePointerId = e.pointerId;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    dragVelYaw = 0;
    dragVelPitch = 0;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported
    }
    startLoop();
  };

  const onCanvasPointerMove = (e: PointerEvent) => {
    if (!isDragging || e.pointerId !== activePointerId) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;

    const deltaYaw = dx * 0.01;
    const deltaPitch = dy * 0.008;
    dragYaw += deltaYaw;
    dragPitch = THREE.MathUtils.clamp(dragPitch + deltaPitch, -0.85, 0.85);
    dragVelYaw = deltaYaw * 0.45;
    dragVelPitch = deltaPitch * 0.45;
  };

  const endDrag = (e: PointerEvent) => {
    if (!isDragging || e.pointerId !== activePointerId) return;
    isDragging = false;
    activePointerId = null;
    try {
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  // Window hover parallax (ignored while dragging so it never fights drag rotation)
  const onWindowPointerMove = (e: PointerEvent) => {
    if (isDragging) return;
    const rect = container.getBoundingClientRect();
    const nx = THREE.MathUtils.clamp(((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1, -1.5, 1.5);
    const ny = THREE.MathUtils.clamp(((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1, -1.5, 1.5);
    hoverTiltY = nx * 0.22;
    hoverTiltX = ny * 0.14;
  };

  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('pointermove', onWindowPointerMove, { passive: true });

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
    updateScene(0.016);
    startLoop();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  updateScene(0.016);
  startLoop();

  return () => {
    disposed = true;
    stopLoop();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    canvas.removeEventListener('pointerdown', onCanvasPointerDown);
    canvas.removeEventListener('pointermove', onCanvasPointerMove);
    canvas.removeEventListener('pointerup', endDrag);
    canvas.removeEventListener('pointercancel', endDrag);
    window.removeEventListener('pointermove', onWindowPointerMove);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);

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
