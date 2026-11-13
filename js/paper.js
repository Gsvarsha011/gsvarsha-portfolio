// The warm paper behind the name: a top-down drape of light with fine grain.
// One full-screen triangle; rendered at 1 CSS px per pixel (the grain is
// defined per CSS px) and at ~30 fps, because nothing in it moves quickly.
import * as THREE from "three";
import { PAPER_GLSL } from "./shaders.js";

export function createPaper(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(1);

  const uniforms = {
    uCss: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uGrainTick: { value: 0 },
    uFlow: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      ${PAPER_GLSL}
      void main() {
        vec2 uv = gl_FragCoord.xy / uCss;
        gl_FragColor = vec4(paperAt(uv), 1.0);
      }
    `,
  });

  // one triangle that covers the screen
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.Camera();

  let last = -1;
  return {
    uniforms,
    resize(w, h) {
      renderer.setSize(w, h, false);
      uniforms.uCss.value.set(w, h);
      last = -1;
    },
    // force: draw even if the 30 fps budget says not yet
    render(time, force = false) {
      if (!force && last >= 0 && time - last < 1 / 30) return;
      last = time;
      renderer.render(scene, camera);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
