import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { pageCurlFragment } from "./page-curl-shader";
import { shockwaveFragment } from "./shockwave-shader";

export type VisibleArea = { x: number; y: number; width: number; height: number };
let fontCSS: Promise<string> | undefined;

const vertexSource = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * .5 + .5;
  gl_Position = vec4(a_position, 0., 1.);
}`;

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const result = gl.createShader(type);
  if (!result) throw new Error("Unable to allocate ripple shader.");
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(result);
    gl.deleteShader(result);
    throw new Error(`Ripple shader compilation failed: ${message}`);
  }
  return result;
}

export async function captureContent(source: HTMLElement, area: VisibleArea, signal: AbortSignal, nativeResolution = false) {
  const wrapper = document.createElement("div");
  wrapper.dataset.contentCapture = "";
  wrapper.style.cssText = `position:fixed;left:-100000px;top:0;width:${area.width}px;height:${area.height}px;overflow:hidden;pointer-events:none;`;
  wrapper.inert = true;
  wrapper.setAttribute("aria-hidden", "true");
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  const originals = [source, ...source.querySelectorAll<HTMLElement>("*")];
  const sourceBox = source.getBoundingClientRect();
  const background = getComputedStyle(source).backgroundColor;
  const borders = originals.map((node) => {
    const box = node.getBoundingClientRect(), style = getComputedStyle(node);
    return {
      x: box.left - sourceBox.left - area.x,
      y: box.top - sourceBox.top - area.y,
      width: box.width, height: box.height,
      sides: ["Top", "Right", "Bottom", "Left"].map((side) =>
        style.getPropertyValue(`border-${side.toLowerCase()}-style`) === "none" ||
        style.getPropertyValue(`border-${side.toLowerCase()}-color`) === "rgba(0, 0, 0, 0)" ? 0 :
          parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) || 0),
    };
  });
  [clone, ...clone.querySelectorAll<HTMLElement>("*")].forEach((node, index) => {
    const original = originals[index];
    const style = getComputedStyle(original);
    // Freeze styles before navigation can detach the source or change ancestor selectors.
    for (let property = 0; property < style.length; property++) {
      const name = style.item(property);
      node.style.setProperty(name, style.getPropertyValue(name));
    }
    node.style.animation = "none";
    node.style.transition = "none";
    node.style.contentVisibility = "visible";
    node.style.scrollbarWidth = "none";
    // Focus outlines and native scrollbars are UI chrome, not printed paper.
    node.style.outline = "none";
  });
  [clone, ...clone.querySelectorAll<HTMLElement>("*")].forEach((node, index) => {
    const top = originals[index].scrollTop, left = originals[index].scrollLeft;
    // foreignObject serialization does not preserve scroll offsets.
    if (top || left) {
      for (const child of node.children) {
        if (child instanceof HTMLElement || child instanceof SVGElement) {
          const transform = child.style.transform;
          child.style.transform = `translate(${-left}px, ${-top}px)${transform && transform !== "none" ? ` ${transform}` : ""}`;
        }
      }
    }
  });
  clone.style.width = `${sourceBox.width}px`;
  clone.style.height = `${sourceBox.height}px`;
  clone.style.transform = `translate(${-area.x}px, ${-area.y}px)`;
  clone.style.filter = "none";
  wrapper.append(clone);
  // Keep the frozen snapshot alive even when a route change unmounts its reader.
  document.body.append(wrapper);
  const cancelled = () => wrapper.remove();
  signal.addEventListener("abort", cancelled, { once: true });
  try {
    signal.throwIfAborted();
    fontCSS ??= getFontEmbedCSS(source).catch((error: unknown) => {
      fontCSS = undefined;
      throw error;
    });
    const css = await fontCSS;
    signal.throwIfAborted();
    const pixelRatio = nativeResolution ? devicePixelRatio || 1 :
      Math.min(devicePixelRatio || 1, 2, 1600 / Math.max(area.width, area.height));
    const page = await toCanvas(wrapper, {
      width: area.width, height: area.height,
      pixelRatio,
      canvasWidth: Math.ceil(area.width * pixelRatio) / pixelRatio,
      canvasHeight: Math.ceil(area.height * pixelRatio) / pixelRatio,
      skipAutoScale: nativeResolution,
      fontEmbedCSS: css, backgroundColor: background,
      // html-to-image copies logical insets too; resetting left alone leaves
      // inset-inline-start at -100000px and serializes a completely blank page.
      style: {
        position: "relative", inset: "auto", insetInline: "auto", insetBlock: "auto",
        left: "0", top: "0",
      },
      filter: (node) => !(node instanceof Element && node.matches("script, iframe, video")),
    });
    signal.throwIfAborted();
    const edges = document.createElement("canvas");
    edges.width = page.width; edges.height = page.height;
    const context = edges.getContext("2d");
    if (!context) throw new Error("Unable to capture border reflection mask.");
    context.fillStyle = "#000"; context.fillRect(0, 0, edges.width, edges.height);
    context.scale(edges.width / area.width, edges.height / area.height);
    context.strokeStyle = "#fff";
    for (const border of borders) {
      const { x, y, width, height, sides } = border;
      if (x + width < 0 || y + height < 0 || x > area.width || y > area.height) continue;
      const points = [[x,y,x+width,y], [x+width,y,x+width,y+height],
        [x,y+height,x+width,y+height], [x,y,x,y+height]];
      sides.forEach((value, index) => {
        if (!value) return;
        const [x1, y1, x2, y2] = points[index];
        context.lineWidth = Math.max(1, value);
        context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
      });
    }
    return { page, edges };
  } finally {
    signal.removeEventListener("abort", cancelled);
    wrapper.remove();
  }
}

export function createRippleRenderer(canvas: HTMLCanvasElement, snapshot: { page: HTMLCanvasElement; edges: HTMLCanvasElement }, width: number, height: number, dark: boolean, curlDirection: -1 | 0 | 1 = 0) {
  const gl = canvas.getContext("webgl", { alpha: !!curlDirection, premultipliedAlpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) return undefined;
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  const edgeTexture = gl.createTexture();
  let vertex: WebGLShader | undefined, fragment: WebGLShader | undefined;
  const dispose = () => {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    gl.deleteProgram(program); gl.deleteBuffer(buffer); gl.deleteTexture(texture); gl.deleteTexture(edgeTexture);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
  try {
    if (!program || !buffer || !texture || !edgeTexture) throw new Error("Unable to allocate ripple renderer.");
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (snapshot.page.width > maxTextureSize || snapshot.page.height > maxTextureSize) {
      throw new Error("Native-resolution snapshot exceeds GPU texture limits; transition skipped rather than blurred.");
    }
    vertex = shader(gl, gl.VERTEX_SHADER, vertexSource);
    fragment = shader(gl, gl.FRAGMENT_SHADER, curlDirection ? pageCurlFragment : shockwaveFragment);
    gl.attachShader(program, vertex); gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Ripple shader linking failed: ${gl.getProgramInfoLog(program)}`);
    canvas.width = snapshot.page.width; canvas.height = snapshot.page.height;
    if (gl.drawingBufferWidth !== canvas.width || gl.drawingBufferHeight !== canvas.height) {
      throw new Error("GPU cannot allocate the full-resolution transition surface.");
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (const [index, item] of [texture, edgeTexture].entries()) {
      gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, item);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, index === 0 ? snapshot.page : snapshot.edges);
    }
    gl.uniform1i(gl.getUniformLocation(program, "u_page"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "u_edges"), 1);
    gl.uniform2f(gl.getUniformLocation(program, "u_size"), width, height);
    gl.uniform1f(gl.getUniformLocation(program, "u_dark"), dark ? 1 : 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_direction"), curlDirection);
    const progress = gl.getUniformLocation(program, "u_progress");
    const backgroundUniform = gl.getUniformLocation(program, "u_background");
    return {
      draw(value: number, background: readonly number[] = [1, 1, 1]) {
        gl.uniform1f(progress, value);
        gl.uniform3f(backgroundUniform, background[0], background[1], background[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
