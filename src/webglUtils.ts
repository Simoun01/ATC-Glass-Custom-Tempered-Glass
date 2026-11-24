import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type EdgeProfileType = 'flat' | 'pencil' | 'bevel';

let cachedSoftwareGl: boolean | null = null;
let cachedWebGLSupported: boolean | null = null;

export function isWebGLAvailable(): boolean {
  if (cachedWebGLSupported !== null) return cachedWebGLSupported;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    cachedWebGLSupported = Boolean(gl);
    if (gl && 'getExtension' in gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    cachedWebGLSupported = false;
  }
  return cachedWebGLSupported;
}

export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    cachedSoftwareGl = true;
  }
  return cachedSoftwareGl;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envScene = new RoomEnvironment();
  const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
  envScene.dispose();
  pmremGenerator.dispose();
  return renderTarget.texture;
}

export function createTemperedGlassMaterial(
  isSoftwareGl: boolean,
  options?: {
    thickness?: number;
    roughness?: number;
    edgeTintHex?: string;
    tintHex?: string;
  }
): THREE.MeshPhysicalMaterial {
  const thickness = options?.thickness ?? 0.5;
  const roughness = options?.roughness ?? 0.05;
  const edgeTintHex = options?.edgeTintHex ?? '#78dcc9';
  const tintHex = options?.tintHex ?? '#eef9ff';

  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tintHex),
    metalness: 0.0,
    roughness,
    transmission: isSoftwareGl ? 0 : 1.0,
    transparent: true,
    opacity: isSoftwareGl ? 0.36 : 1.0,
    thickness,
    ior: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    attenuationColor: new THREE.Color(edgeTintHex),
    attenuationDistance: 1.25,
    specularIntensity: 1.0,
    specularColor: new THREE.Color('#ffffff'),
    envMapIntensity: 1.45,
    reflectivity: 0.95,
  });
}

export function createGlassEdgeTintMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#5dc2b6'),
    metalness: 0.05,
    roughness: 0.14,
    transparent: true,
    opacity: 0.42,
    clearcoat: 0.85,
    ior: 1.5,
    depthWrite: false,
  });
}

/**
 * Builds an extruded glass pane geometry centered at origin with a precision
 * CNC cutout hole and selectable edge profile ('flat' | 'pencil' | 'bevel').
 */
export function createGlassPaneGeometry(
  width: number,
  height: number,
  depth: number,
  edgeProfile: EdgeProfileType = 'bevel',
  withHole = true
): THREE.ExtrudeGeometry {
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(width, height) * 0.035;

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  if (withHole) {
    const hole = new THREE.Path();
    const holeRadius = Math.min(width, height) * 0.055;
    const holeX = hw * 0.62;
    const holeY = hh * 0.62;
    hole.absarc(holeX, holeY, holeRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  let bevelThickness = 0.012;
  let bevelSize = 0.012;
  let bevelSegments = 2;

  if (edgeProfile === 'flat') {
    bevelThickness = Math.min(depth * 0.12, 0.009);
    bevelSize = 0.008;
    bevelSegments = 1;
  } else if (edgeProfile === 'bevel') {
    bevelThickness = Math.max(0.025, depth * 0.36);
    bevelSize = Math.max(0.028, depth * 0.45);
    bevelSegments = 1;
  } else if (edgeProfile === 'pencil') {
    bevelThickness = Math.max(0.02, depth * 0.46);
    bevelSize = Math.max(0.02, depth * 0.42);
    bevelSegments = 7;
  }

  const extrudeDepth = Math.max(0.012, depth - bevelThickness * 1.4);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments: 18,
  });

  geo.center();
  geo.computeVertexNormals();
  return geo;
}

export function createSoftContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.05,
      size / 2,
      size / 2,
      size * 0.48
    );
    grad.addColorStop(0, 'rgba(4, 12, 22, 0.72)');
    grad.addColorStop(0.45, 'rgba(10, 34, 52, 0.36)');
    grad.addColorStop(0.75, 'rgba(127, 209, 255, 0.10)');
    grad.addColorStop(1, 'rgba(7, 18, 30, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
