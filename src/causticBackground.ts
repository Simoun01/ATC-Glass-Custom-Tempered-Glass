import * as THREE from 'three';
import {
  detectSoftwareWebGL,
  isWebGLAvailable,
  prefersReducedMotion,
} from './webglUtils';

export function initHeroCausticBackground(): () => void {
  const container = document.getElementById('hero-caustic-bg');
  if (!container) return () => {};

  if (!isWebGLAvailable()) {
    return () => {};
  }

  const isSoftwareGl = detectSoftwareWebGL();
  const reducedMotion = prefersReducedMotion();

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
    });
  } catch {
    return () => {};
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
  renderer.domElement.className = 'w-full h-full block pointer-events-none';
  renderer.domElement.style.pointerEvents = 'none';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    depthWrite: false,
    depthTest: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uPointer;

      float causticPattern(vec2 uv, float t) {
        vec2 p = mod(uv * 6.2831853, 6.2831853) - 250.0;
        vec2 i = p;
        float c = 1.0;
        float inten = 0.005;
        for (int n = 0; n < 4; n++) {
          float time = t * (1.0 - (3.5 / float(n + 1)));
          i = p + vec2(
            cos(time - i.x) + sin(time + i.y),
            sin(time - i.y) + cos(time + i.x)
          );
          c += 1.0 / length(vec2(
            p.x / (sin(i.x + time) / inten),
            p.y / (cos(i.y + time) / inten)
          ));
        }
        c /= 4.0;
        c = 1.17 - pow(c, 1.4);
        return clamp(pow(abs(c), 7.5), 0.0, 1.0);
      }

      void main() {
        vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
        vec2 uv = vUv;
        float t = uTime * 0.22;

        vec3 deepNavy = vec3(0.027, 0.071, 0.118);   // #07121E
        vec3 baseNavy = vec3(0.043, 0.106, 0.169);   // #0B1B2B
        vec3 tealGlow = vec3(0.060, 0.230, 0.310);   // #0F3B4F
        vec3 glassCyan = vec3(0.498, 0.820, 1.000);  // #7FD1FF

        float waveA = sin(uv.x * 2.4 + t * 0.7) * cos(uv.y * 1.9 - t * 0.5);
        float waveB = cos((uv.x - uv.y) * 2.1 + t * 0.4);
        vec3 col = mix(deepNavy, baseNavy, smoothstep(-0.6, 0.8, waveA));
        col = mix(col, tealGlow, clamp(waveB * 0.35 + 0.35, 0.0, 1.0) * 0.55);

        vec2 cUv = (uv - 0.5) * aspect * 0.48 + vec2(t * 0.03, -t * 0.02);
        float c1 = causticPattern(cUv, t * 0.65);
        float c2 = causticPattern(cUv * 1.35 + vec2(0.4, 0.2), -t * 0.45);
        float caustic = (c1 * 0.65 + c2 * 0.45);

        float rightGlow = exp(-length((uv - vec2(0.74, 0.46)) * aspect) * 1.9);
        float pointerGlow = exp(-length((uv - uPointer) * aspect) * 2.8) * 0.35;

        col += glassCyan * caustic * (0.13 + rightGlow * 0.14);
        col += glassCyan * (rightGlow * 0.12 + pointerGlow * 0.16);

        float vig = smoothstep(1.35, 0.25, length((uv - 0.5) * vec2(1.15, 1.0)));
        col *= mix(0.68, 1.0, vig);

        gl_FragColor = vec4(col, 0.96);
      }
    `,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(w, h);
  };
  resize();

  const onPointerMove = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    uniforms.uPointer.value.set(
      THREE.MathUtils.clamp((e.clientX - rect.left) / rect.width, 0, 1),
      THREE.MathUtils.clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1)
    );
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  let isVisible = true;
  let isLoopRunning = false;
  let rafId = 0;
  let disposed = false;
  let contextLost = false;
  const clock = new THREE.Clock();

  const renderFrame = () => {
    if (disposed || contextLost) return;
    uniforms.uTime.value += Math.min(clock.getDelta(), 0.05);
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
    if (disposed || !isVisible || document.hidden || contextLost || reducedMotion) {
      isLoopRunning = false;
      return;
    }
    renderFrame();
    rafId = requestAnimationFrame(tick);
  };

  const startLoop = () => {
    if (isLoopRunning || disposed || !isVisible || document.hidden || contextLost || reducedMotion) {
      return;
    }
    isLoopRunning = true;
    clock.getDelta();
    rafId = requestAnimationFrame(tick);
  };

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
    { threshold: 0.01 }
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
  };
  const onContextRestored = () => {
    contextLost = false;
    renderFrame();
    startLoop();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

  renderFrame();
  startLoop();

  return () => {
    disposed = true;
    stopLoop();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
    quad.geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
