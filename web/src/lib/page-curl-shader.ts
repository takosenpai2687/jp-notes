export const pageCurlFragment = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_page;
uniform vec2 u_size;
uniform float u_progress;
uniform float u_direction;

const float PI = 3.14159265359;

bool onPage(vec2 p) {
  return p.x >= 0. && p.y >= 0. && p.x <= u_size.x && p.y <= u_size.y;
}
vec3 paper(vec2 p) {
  vec2 uv = p / u_size;
  if (u_direction < 0.) uv.x = 1. - uv.x;
  vec4 pixel = texture2D(u_page, clamp(uv, vec2(.001), vec2(.999)));
  return mix(vec3(1.), pixel.rgb, pixel.a);
}
void main() {
  vec2 p = vec2(v_uv.x, 1. - v_uv.y) * u_size;
  if (u_direction < 0.) p.x = u_size.x - p.x;

  // An oblique rolling cylinder starts at the lower corner, not a rigid hinge.
  float t = u_progress * u_progress * (3. - 2. * u_progress);
  vec2 normal = normalize(vec2(1., mix(.58, .22, t)));
  float extent = dot(u_size, normal);
  float radius = min(u_size.x, u_size.y) * (.045 + .04 * sin(PI * t));
  float axis = mix(extent + radius * 2., -PI * radius - extent * .08, t);
  float d = dot(p, normal) - axis;
  vec2 base = p - normal * d;
  vec3 color = vec3(1.);
  float coverage = 0.;

  // Inverse cylindrical projection. Two intersections give a front and a back.
  // Beyond the cylinder the folded sheet lies flat, with mirrored original ink.
  if (d <= radius) {
    float backDistance;
    float backShade;
    if (d < 0.) {
      backDistance = PI * radius - d;
      backShade = 1.;
    } else {
      float angle = asin(clamp(d / radius, 0., 1.));
      backDistance = radius * (PI - angle);
      backShade = .94 + .06 * cos(angle);
    }
    vec2 back = base + normal * backDistance;
    if (onPage(back)) {
      color = paper(back) * backShade;
      coverage = 1.;
    }
  }
  if (coverage == 0. && d >= 0. && d <= radius) {
    float angle = asin(clamp(d / radius, 0., 1.));
    vec2 front = base + normal * radius * angle;
    if (onPage(front)) {
      color = paper(front) * (.76 + .24 * cos(angle));
      coverage = 1.;
    }
  }
  if (coverage == 0. && d < 0.) {
    color = paper(p);
    coverage = 1.;
  }

  if (coverage > 0.) {
    // Lighting follows curvature, never perspective scaling toward the viewer.
    float contact = exp(-abs(d) / max(1., radius * .12)) * .055;
    color *= 1. - contact;
    gl_FragColor = vec4(color, 1.);
  } else {
    // A restrained cast shadow reveals the live next page beneath the curl.
    float shadow = exp(-max(0., d - radius) / max(1., radius * .5));
    shadow *= .15 * sin(PI * u_progress);
    gl_FragColor = vec4(.12, .17, .2, shadow);
  }
}`;
