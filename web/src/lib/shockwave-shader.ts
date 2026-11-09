// Adapted from hennysky/tactile-shockwave-halo's MIT-licensed optical specification.
// https://github.com/hennysky/tactile-shockwave-halo
/*
MIT License — Copyright (c) hennysky

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
export const shockwaveFragment = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_page;
uniform sampler2D u_edges;
uniform vec2 u_size;
uniform float u_progress;
uniform float u_dark;
uniform vec3 u_background;

vec2 uv(vec2 p) {
  return clamp(p / u_size, vec2(.0001), vec2(.9999));
}
vec3 samplePage(vec2 p) {
  vec4 pixel = texture2D(u_page, uv(p));
  return mix(u_background, pixel.rgb, pixel.a);
}
vec3 palette(int i) {
  vec3 lightColor = i == 0 ? vec3(110.,150.,255.) :
    i == 1 ? vec3(180.,130.,255.) :
    i == 2 ? vec3(255.,130.,190.) : vec3(255.,180.,120.);
  vec3 darkColor = i == 0 ? vec3(80.,140.,255.) :
    i == 1 ? vec3(160.,110.,255.) :
    i == 2 ? vec3(255.,110.,180.) : vec3(255.,190.,140.);
  return mix(lightColor, darkColor, u_dark) / 255.;
}
void main() {
  vec2 p = vec2(v_uv.x, 1. - v_uv.y) * u_size;
  vec2 origin = u_size * vec2(.5, .75);
  vec2 delta = p - origin;
  float distance = max(length(delta), .001);
  vec2 direction = delta / distance;
  float reach = length(max(origin, u_size - origin));
  float factor = (1. - pow(2., -9. * u_progress)) / (1. - pow(2., -9.));
  float radius = mix(30., reach + 220., factor);
  float strength = min(1., u_progress / .03) * (1. - pow(u_progress, 2.2));
  float x = (distance - radius) / 110.;
  float z = x * .75;

  vec2 edgeDistance = min(p, u_size - p);
  float frameHold = smoothstep(0., 56., min(edgeDistance.x, edgeDistance.y));
  float push = 7. * 2.33 * z * exp(-z * z) * strength * frameHold;
  vec2 lens = -direction * push;

  // The frame stays still; only content inside the side/bottom glass bevel stretches.
  float arrival = strength * exp(-1.1 * pow(x / 2., 2.));
  vec2 bevel = vec2(
    22. * (pow(max(0., 1. - p.x / 60.), 2.) -
           pow(max(0., 1. - (u_size.x - p.x) / 60.), 2.)),
    -22. * pow(max(0., 1. - (u_size.y - p.y) / 60.), 2.)
  ) * arrival;
  vec2 bent = p + lens + bevel;
  vec3 page = vec3(
    samplePage(p + lens * 1.08 + bevel).r,
    samplePage(bent).g,
    samplePage(p + lens * .92 + bevel).b
  );

  vec3 ring = vec3(0.);
  float total = 0.;
  for (int i = 0; i < 4; i++) {
    float center = float(i) - 1.5;
    float weight = exp(-pow((x - center) / .8, 2.));
    ring += palette(i) * weight;
    total += weight;
  }
  ring /= max(total, .00001);
  vec3 light = mix(page, ring, arrival * .24) + ring * arrival * .24 * .2;
  vec3 dark = 1. - (1. - page) * (1. - ring * arrival * .3 * 1.5);
  vec3 color = mix(light, dark, u_dark);

  float mask = texture2D(u_edges, uv(bent)).r;
  float glint = mask * strength * exp(-1.4 * pow(x / 2., 2.)) * mix(.3, .14, u_dark);
  color = mix(color, mix(ring, vec3(1.), .2), glint);
  float bevelDistance = min(edgeDistance.x, u_size.y - p.y);
  float edgeLight = exp(-bevelDistance / 7.) * arrival * mix(.3, .14, u_dark);
  color = mix(color, mix(ring, vec3(1.), .45), edgeLight);
  gl_FragColor = vec4(clamp(color, 0., 1.), 1.);
}`;
