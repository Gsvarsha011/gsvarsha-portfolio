// GLSL shared by the paper background (paper.js) and the glass (glass.js).
// The glass refracts the same paper the background draws, so both shaders
// evaluate one function with the same uniforms: what you see through the
// glass is the paper behind it, bent.

export const PAPER_GLSL = /* glsl */ `
uniform vec2 uCss;       // frame size in CSS px
uniform float uTime;     // seconds, drives the slow drift
uniform float uGrainTick;// integer-ish tick, re-seeds the grain ~10 times a second
uniform float uFlow;     // hero scroll progress 0..1

const vec3 PAPER = vec3(0.953, 0.937, 0.906); // #F3EFE7
const vec3 SAND  = vec3(0.847, 0.784, 0.706); // #D8C8B4
const vec3 TERRA = vec3(0.714, 0.416, 0.294); // #B66A4B
const vec3 INK   = vec3(0.141, 0.133, 0.122); // #24221F

vec3 permute3(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

// Ashima simplex noise, 2D
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Warm light flowing down from the top edge: a soft terracotta haze at the
// top left that settles into sand and paper, brushed into streaks that lean
// down and to the right, with a pale bloom drifting on the right.
// uv: 0..1, y up.
vec3 paperField(vec2 uv) {
  float aspect = uCss.x / uCss.y;
  float y = 1.0 - uv.y;            // 0 at the top edge
  float x = uv.x;
  float t = uTime;
  vec2 p = vec2(x * aspect, y);

  // big slow folds
  vec2 q = p * vec2(0.85, 1.1);
  vec2 warp = vec2(snoise(q * 0.9 + vec2(0.0, -t * 0.018)),
                   snoise(q * 0.9 + vec2(5.2, 1.3 - t * 0.018)));
  vec2 pw = p + warp * 0.17;
  // brushed streaks: noise stretched along a shallow diagonal, drifting
  float streak = 0.65 * snoise(vec2(pw.x * 0.8 - pw.y * 0.6, pw.y * 6.5 + pw.x * 1.4) + vec2(t * 0.025, 0.0))
               + 0.35 * snoise(vec2(pw.x * 1.7 - pw.y * 1.1, pw.y * 13.0 + pw.x * 3.0) - vec2(t * 0.02, 0.0));

  float s = y * 0.95 + (x - 0.5) * 0.30 + warp.x * 0.10 + streak * 0.045 - uFlow * 0.03;
  // light: a soft terracotta haze at the top that settles into sand and paper
  vec3 c = mix(SAND, TERRA, 0.42);
  c = mix(c, mix(SAND, TERRA, 0.16), smoothstep(-0.08, 0.30, s));
  c = mix(c, mix(SAND, PAPER, 0.45), smoothstep(0.22, 0.62, s));
  c = mix(c, PAPER, smoothstep(0.55, 1.0, s));

  // pale bloom on the right, as if the light comes through there
  float glow = smoothstep(0.42, 1.05, x + warp.y * 0.14 + streak * 0.06)
             * (0.65 + 0.35 * snoise(pw * 1.3 + vec2(t * 0.01, 2.0)));
  c = mix(c, PAPER, glow * 0.4);

  // pigment mottling, like dye soaked into paper
  float mottle = 0.6 * snoise(pw * 4.0 + 11.0) + 0.4 * snoise(pw * 9.5 - 3.0);
  c *= 1.0 + mottle * 0.02 + streak * 0.012;
  return c;
}

// grain, one value per CSS pixel: a fixed tooth (the paper) plus a lighter
// layer that re-seeds ~10 times a second (the light on it)
float paperGrain(vec2 uv) {
  vec2 px = floor(uv * uCss);
  float still = hash12(px) + hash12(px.yx * 1.37 + 19.0) - 1.0;
  float live = hash12(px + uGrainTick * vec2(37.0, 17.0)) - 0.5;
  float tooth = snoise(px * 0.32) * 0.5;
  return still * 0.5 + live * 0.95 + tooth * 0.3;
}

vec3 paperAt(vec2 uv) {
  vec3 c = paperField(uv);
  return c + paperGrain(uv) * 0.05;
}
`;
