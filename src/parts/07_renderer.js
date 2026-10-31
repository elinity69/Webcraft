// ============================================================================
// Part 07: WebGL2 renderer — chunks, entities, particles, sky, viewmodel
// ============================================================================
const VSH = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUV;
layout(location=2) in vec4 aLight;
uniform mat4 uProj, uView;
uniform vec3 uChunkOffset;
uniform float uTime;
out vec2 vUV; out float vSky; out float vBlock; out float vShade; out float vDist;
void main(){
  vec3 p = aPos + uChunkOffset;
  int flag = int(aLight.w + 0.5);
  if (flag == 1) { p.y += sin(uTime*1.7 + p.x*0.9 + p.z*0.8)*0.04 - 0.02; }
  vec4 vp = uView * vec4(p, 1.0);
  vDist = length(vp.xyz);
  gl_Position = uProj * vp;
  vUV = aUV; vSky = aLight.x; vBlock = aLight.y; vShade = aLight.z;
}`;

const FSH = `#version 300 es
precision highp float;
in vec2 vUV; in float vSky; in float vBlock; in float vShade; in float vDist;
uniform sampler2D uTex;
uniform float uDayLight;
uniform vec3 uFogColor;
uniform float uFogStart, uFogEnd;
uniform float uAlpha;
out vec4 fragColor;
void main(){
  vec4 tex = texture(uTex, vUV);
  if (tex.a < 0.08) discard;
  float sky = vSky * uDayLight;
  float l = max(sky, vBlock * 0.92);
  l = 0.045 + 0.955 * l;
  vec3 col = tex.rgb * l * vShade;
  col = mix(col, col * vec3(1.16, 1.06, 0.86), clamp(vBlock - sky, 0.0, 1.0) * 0.55);
  float fog = clamp((vDist - uFogStart) / (uFogEnd - uFogStart), 0.0, 1.0);
  fog = fog * fog;
  col = mix(col, uFogColor, fog);
  fragColor = vec4(col, tex.a * uAlpha);
}`;

const EVSH = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aColor;
uniform mat4 uProj, uView, uModel;
out vec4 vColor; out float vDist;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vec4 vp = uView * wp;
  vDist = length(vp.xyz);
  gl_Position = uProj * vp;
  vColor = aColor;
}`;

const EFSH = `#version 300 es
precision highp float;
in vec4 vColor; in float vDist;
uniform float uLight;
uniform float uHurt;
uniform vec3 uFogColor;
uniform float uFogStart, uFogEnd;
out vec4 fragColor;
void main(){
  vec3 col = vColor.rgb * (0.08 + 0.92 * uLight);
  col = mix(col, vec3(0.9, 0.15, 0.1), uHurt * 0.6);
  float fog = clamp((vDist - uFogStart) / (uFogEnd - uFogStart), 0.0, 1.0);
  fog = fog * fog;
  col = mix(col, uFogColor, min(fog, 0.9));
  fragColor = vec4(col, vColor.a);
}`;

const SVSH = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uInvVP;
out vec3 vRay;
void main(){
  gl_Position = vec4(aPos, 1.0);
  vec4 t = uInvVP * vec4(aPos, 1.0);
  vRay = t.xyz / t.w;
}`;

const SFSH = `#version 300 es
precision highp float;
in vec3 vRay;
uniform vec3 uSunDir;
uniform vec3 uSkyTop, uSkyHorizon;
uniform float uStarVis;
uniform float uRain;
out vec4 fragColor;
float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  vec3 dir = normalize(vRay);
  float t = clamp(dir.y*1.4+0.28, 0.0, 1.0);
  vec3 col = mix(uSkyHorizon, uSkyTop, t);
  // sun & moon discs
  float sd = dot(dir, uSunDir);
  float sun = smoothstep(0.9993, 0.9997, sd);
  float moon = smoothstep(0.9995, 0.9998, -sd);
  col = mix(col, vec3(1.0,0.97,0.85)*1.05, sun*(1.0-uRain*0.8));
  col = mix(col, vec3(0.95,0.95,0.9), moon*(1.0-uRain*0.8));
  // glow around sun
  col += vec3(1.0,0.8,0.5) * pow(max(sd,0.0), 40.0) * 0.22 * (1.0-uRain*0.7);
  col += vec3(0.9,0.9,1.0) * pow(max(-sd,0.0), 40.0) * 0.14 * (1.0-uRain*0.7);
  // stars
  if (uStarVis > 0.01 && dir.y > -0.1) {
    vec3 sp = floor(dir * 160.0);
    float h = hash(sp);
    float star = step(0.9975, h) * uStarVis * (0.5 + 0.5*sin(h*100.0));
    col += vec3(star);
  }
  fragColor = vec4(col, 1.0);
}`;

const CVSH = `#version 300 es
layout(location=0) in vec2 aPos;
uniform mat4 uProj, uView;
uniform vec3 uCenter;
uniform float uScale;
out vec2 vUV;
void main(){
  vec3 p = uCenter + vec3(aPos.x * uScale, 0.0, aPos.y * uScale);
  gl_Position = uProj * uView * vec4(p, 1.0);
  vUV = aPos + 0.5;
}`;

const CFSH = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uOffset;
uniform vec3 uCloudColor;
uniform float uTime;
out vec4 fragColor;
void main(){
  vec2 uv = vUV * 8.0 + uOffset;
  float c = texture(uTex, fract(uv)).a;
  float alpha = c * 0.72;
  fragColor = vec4(uCloudColor, alpha);
}`;

const LVSH = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uProj, uView;
uniform vec3 uOffset;
uniform float uExpand;
void main(){
  vec3 p = uOffset + (aPos - 0.5) * uExpand + 0.5;
  gl_Position = uProj * uView * vec4(p, 1.0);
}`;

const LFSH = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
void main(){ fragColor = uColor; }`;

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: true, stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false,
    });
    if (!gl) throw new Error('WebGL2 not supported — please use a modern browser (Chrome/Edge/Firefox).');
    this.gl = gl;
    this.progChunk = this.mkProg(VSH, FSH);
    this.progEntity = this.mkProg(EVSH, EFSH);
    this.progSky = this.mkProg(SVSH, SFSH);
    this.progCloud = this.mkProg(CVSH, CFSH);
    this.progLine = this.mkProg(LVSH, LFSH);

    // atlas texture (flip Y: painters draw top-down, GL textures are bottom-up)
    this.atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, TEX.canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // cloud noise texture
    this.cloudTex = gl.createTexture();
    {
      const cc = document.createElement('canvas');
      cc.width = 128; cc.height = 128;
      const cx2 = cc.getContext('2d');
      const img = cx2.createImageData(128, 128);
      const n2 = new Noise2D(1337);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        let v = n2.fbm(x / 18, y / 18, 3, 2, .55) * .5 + .5;
        v = smoothstep(clamp((v - 0.52) * 3.2, 0, 1));
        const i = (y * 128 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = (v * 255) | 0;
      }
      cx2.putImageData(img, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, this.cloudTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cc);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    }

    // fullscreen quad for sky
    this.skyVAO = gl.createVertexArray();
    gl.bindVertexArray(this.skyVAO);
    const sq = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sq);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // cloud quad
    this.cloudVAO = gl.createVertexArray();
    gl.bindVertexArray(this.cloudVAO);
    const cq = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cq);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, -.5, .5, -.5, .5, .5, -.5, -.5, .5, .5, -.5, .5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // cube line vertices for selection
    this.cubeLines = new Float32Array([
      0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0,
      0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0,
      0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1,
    ]);
    this.lineVAO = gl.createVertexArray();
    gl.bindVertexArray(this.lineVAO);
    const lb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lb);
    gl.bufferData(gl.ARRAY_BUFFER, this.cubeLines, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // dynamic entity buffer
    this.entVAO = gl.createVertexArray();
    this.entBuf = gl.createBuffer();
    gl.bindVertexArray(this.entVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.entBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);

    // dynamic particle buffer: pos(3) + color(4), same layout as the entity VAO
    this.partVAO = gl.createVertexArray();
    this.partBuf = gl.createBuffer();
    gl.bindVertexArray(this.partVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);

    // crack mesh (built on demand per frame)
    this.crackVAO = gl.createVertexArray();
    this.crackBuf = gl.createBuffer();
    gl.bindVertexArray(this.crackVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.crackBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
    gl.bindVertexArray(null);

    // viewmodel item texture cache
    this.vmTexCache = new Map();

    this.proj = M4.identity(); this.view = M4.identity();
    this.invVP = M4.identity();
    this._tmp = M4.identity(); this._tmp2 = M4.identity();
    this.chunksGL = new Map(); // key -> {vao, vbo, ibo, count} x2
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, G.settings.resolution ? G.settings.resolution : 1);
    const w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    this.aspect = w / Math.max(1, h);
  }

  mkProg(vs, fs) {
    const gl = this.gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
    return p;
  }
  U(prog, name) { return this.gl.getUniformLocation(prog, name); }

  uploadChunkMesh(key, mesh, which) {
    const gl = this.gl;
    let entry = this.chunksGL.get(key);
    if (!entry) { entry = { opaque: null, trans: null }; this.chunksGL.set(key, entry); }
    let slot = entry[which];
    if (!mesh || mesh.count === 0) {
      if (slot) { gl.deleteVertexArray(slot.vao); gl.deleteBuffer(slot.vbo); gl.deleteBuffer(slot.ibo); }
      entry[which] = null;
      return;
    }
    if (!slot) {
      slot = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), ibo: gl.createBuffer() };
      entry[which] = slot;
      gl.bindVertexArray(slot.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, slot.vbo);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slot.ibo);
      gl.bindVertexArray(null);
    }
    gl.bindVertexArray(slot.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.v, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slot.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.DYNAMIC_DRAW);
    slot.count = mesh.count;
    gl.bindVertexArray(null);
  }

  removeChunkGL(key) {
    const entry = this.chunksGL.get(key);
    if (!entry) return;
    for (const which of ['opaque', 'trans']) {
      const s = entry[which];
      if (s) { this.gl.deleteVertexArray(s.vao); this.gl.deleteBuffer(s.vbo); this.gl.deleteBuffer(s.ibo); }
    }
    this.chunksGL.delete(key);
  }

  // frustum planes from proj*view
  extractFrustum(m) {
    const p = [];
    p.push([m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]]);
    p.push([m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]]);
    p.push([m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]]);
    p.push([m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]]);
    p.push([m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]]);
    p.push([m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]]);
    for (const pl of p) {
      const l = Math.hypot(pl[0], pl[1], pl[2]) || 1;
      pl[0] /= l; pl[1] /= l; pl[2] /= l; pl[3] /= l;
    }
    return p;
  }
  aabbVisible(planes, x0, y0, z0, x1, y1, z1) {
    for (const p of planes) {
      const px = p[0] > 0 ? x1 : x0, py = p[1] > 0 ? y1 : y0, pz = p[2] > 0 ? z1 : z0;
      if (p[0] * px + p[1] * py + p[2] * pz + p[3] < -2.0) return false;
    }
    return true;
  }

  render(cam, world, alpha) {
    const gl = this.gl;
    this.resize();
    const w = this.canvas.width, h = this.canvas.height;
    gl.clearColor(0.5, 0.7, 1.0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    const t = performance.now() / 1000;
    const dayFrac = ((world.time % DAY_TICKS) + DAY_TICKS) % DAY_TICKS / DAY_TICKS; // 0=dawn
    const sunAngle = (dayFrac * Math.PI * 2) - Math.PI / 2;
    const sunY = Math.sin(dayFrac * Math.PI * 2 - Math.PI / 2 + Math.PI / 2); // approx
    const sunElev = Math.sin((dayFrac - 0.25) * Math.PI * 2 + Math.PI/2) * -1;
    let dayLight = clamp(Math.sin(dayFrac * Math.PI * 2) * 1.6 + 0.5, G.dimension === 1 ? 0.06 : 0.08, 1);
    if (G.player && G.player.effects && G.player.effects.night_vision) dayLight = Math.max(dayLight, 0.85);
    const skyBright = clamp(dayLight, 0.05, 1);
    this.dayLight = dayLight;

    // camera matrices
    const fovRad = rad(G.settings.fov + (cam.sprintBoost || 0));
    M4.perspective(this.proj, fovRad, this.aspect, 0.06, G.settings.renderDist * CH * 1.8);
    M4.view(this.view, cam.x, cam.y, cam.z, cam.yaw, cam.pitch, cam.roll || 0);
    M4.mul(this._tmp, this.proj, this.view);
    const inv = invertM4(this.invVP, this._tmp);
    const planes = this.extractFrustum(this._tmp);

    // fog + sky colors by time & weather & dimension
    const rainD = G.rain || 0;
    let fogColor, skyTop, skyHorizon, fogEnd;
    if (G.dimension === 1) {
      fogColor = [0.32, 0.08, 0.06]; skyTop = [0.22, 0.04, 0.04]; skyHorizon = [0.45, 0.12, 0.08];
      fogEnd = G.settings.renderDist * CH * 0.9;
    } else if (G.dimension === 2) {
      fogColor = [0.08, 0.06, 0.12]; skyTop = [0.02, 0.01, 0.04]; skyHorizon = [0.12, 0.08, 0.18];
      fogEnd = G.settings.renderDist * CH * 1.4;
    } else {
      const dawn = Math.exp(-Math.pow((dayFrac - 0.02) * 10, 2)) + Math.exp(-Math.pow((dayFrac - 0.48) * 10, 2));
      const l1 = clamp(dayLight, 0, 1);
      skyTop = [lerp(0.02, 0.36, l1), lerp(0.02, 0.58, l1), lerp(0.06, 0.92, l1)];
      skyHorizon = [
        clamp(lerp(0.05, 0.68, l1) + dawn * 0.55, 0, 1),
        clamp(lerp(0.05, 0.78, l1) + dawn * 0.22, 0, 1),
        clamp(lerp(0.10, 0.92, l1), 0, 1),
      ];
      fogColor = [skyHorizon[0] * .96, skyHorizon[1] * .96, skyHorizon[2] * .98];
      fogEnd = (G.settings.renderDist * CH) * (1 - rainD * 0.45);
    }
    // underwater fog
    const headBlock = world.getBlock(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z));
    const underwater = headBlock === B.water;
    if (underwater) { fogColor = [0.08, 0.2, 0.45]; fogEnd = 24; }
    const inLava = headBlock === B.lava;
    if (inLava) { fogColor = [0.6, 0.2, 0.05]; fogEnd = 2.5; }
    const fogStart = fogEnd * 0.86; // MC-style: clear until near the render edge
    this.fogColor = fogColor; this.fogEnd = fogEnd;

    // ---- SKY ----
    if (!underwater && !inLava) {
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(this.progSky);
      gl.bindVertexArray(this.skyVAO);
      gl.uniformMatrix4fv(this.U(this.progSky, 'uInvVP'), false, this.invVP);
      const sa = dayFrac * Math.PI * 2;
      const sunDir = [Math.cos(sa) * 0.4, Math.sin(sa), Math.cos(sa) * 0.9];
      const sl = Math.hypot(...sunDir); sunDir[0] /= sl; sunDir[1] /= sl; sunDir[2] /= sl;
      gl.uniform3fv(this.U(this.progSky, 'uSunDir'), sunDir);
      gl.uniform3fv(this.U(this.progSky, 'uSkyTop'), skyTop);
      gl.uniform3fv(this.U(this.progSky, 'uSkyHorizon'), skyHorizon);
      gl.uniform1f(this.U(this.progSky, 'uStarVis'), clamp(1 - dayLight * 1.8, 0, 1) * (1 - rainD));
      gl.uniform1f(this.U(this.progSky, 'uRain'), rainD);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      gl.enable(gl.DEPTH_TEST);
    }

    // ---- CHUNKS ----
    gl.useProgram(this.progChunk);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform1i(this.U(this.progChunk, 'uTex'), 0);
    gl.uniformMatrix4fv(this.U(this.progChunk, 'uProj'), false, this.proj);
    gl.uniformMatrix4fv(this.U(this.progChunk, 'uView'), false, this.view);
    gl.uniform1f(this.U(this.progChunk, 'uTime'), t);
    gl.uniform1f(this.U(this.progChunk, 'uDayLight'), G.dimension === 1 ? 0.12 : (G.dimension === 2 ? 0.35 : clamp(dayLight, 0.03, 1)));
    gl.uniform3fv(this.U(this.progChunk, 'uFogColor'), fogColor);
    gl.uniform1f(this.U(this.progChunk, 'uFogStart'), fogStart);
    gl.uniform1f(this.U(this.progChunk, 'uFogEnd'), fogEnd);
    gl.uniform1f(this.U(this.progChunk, 'uAlpha'), 1);

    const visible = [];
    for (const [key, entry] of world.chunks) {
      const c = world.chunks.get(key);
      if (!c || !c.generated) continue;
      const x0 = c.cx * CH, z0 = c.cz * CH;
      if (dist2d(x0 + 8, z0 + 8, cam.x, cam.z) > (G.settings.renderDist + 1.5) * CH) continue;
      if (!this.aabbVisible(planes, x0, 0, z0, x0 + CH, WORLD_H, z0 + CH)) continue;
      visible.push([dist2d(x0 + 8, z0 + 8, cam.x, cam.z), key, c]);
    }
    visible.sort((a, b) => a[0] - b[0]);

    gl.uniform1f(this.U(this.progChunk, 'uAlpha'), 1);
    const uChunkOff = this.U(this.progChunk, 'uChunkOffset');
    for (const [, key, c] of visible) {
      const slot = this.chunksGL.get(key + ':' + G.dimension);
      if (!slot || !slot.opaque) continue;
      gl.uniform3f(uChunkOff, c.cx * CH, 0, c.cz * CH);
      gl.bindVertexArray(slot.opaque.vao);
      gl.drawElements(gl.TRIANGLES, slot.opaque.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);

    // ---- ENTITIES & PARTICLES ----
    this.renderEntities(cam, world, alpha, fogColor, fogStart, fogEnd);

    // ---- CLOUDS ----
    if (G.settings.clouds && G.dimension === 0 && !underwater) {
      gl.useProgram(this.progCloud);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.cloudTex);
      gl.uniform1i(this.U(this.progCloud, 'uTex'), 0);
      gl.uniformMatrix4fv(this.U(this.progCloud, 'uProj'), false, this.proj);
      gl.uniformMatrix4fv(this.U(this.progCloud, 'uView'), false, this.view);
      const cl = clamp(dayLight, 0.05, 1);
      gl.uniform3f(this.U(this.progCloud, 'uCloudColor'), lerp(0.12, 1, cl), lerp(0.13, 1, cl), lerp(0.18, 1, cl));
      gl.uniform1f(this.U(this.progCloud, 'uTime'), t);
      gl.uniform2f(this.U(this.progCloud, 'uOffset'), t * 0.004 + cam.x / 2048, cam.z / 2048);
      gl.uniform3f(this.U(this.progCloud, 'uCenter'), cam.x, 148, cam.z);
      gl.uniform1f(this.U(this.progCloud, 'uScale'), 700);
      gl.bindVertexArray(this.cloudVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
    }

    // ---- TRANSPARENT CHUNKS (water etc, far to near, depthMask false to prevent wave Z-fighting) ----
    gl.useProgram(this.progChunk);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform3f(this.U(this.progChunk, 'uChunkOffset'), 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    for (let i = visible.length - 1; i >= 0; i--) {
      const [, key, c] = visible[i];
      const slot = this.chunksGL.get(key + ':' + G.dimension);
      if (!slot || !slot.trans) continue;
      gl.uniform3f(uChunkOff, c.cx * CH, 0, c.cz * CH);
      gl.bindVertexArray(slot.trans.vao);
      gl.drawElements(gl.TRIANGLES, slot.trans.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    // ---- SIGN TEXTS (dynamic per-sign canvas textures) ----
    this.renderSignTexts(cam);

    // ---- SELECTION & CRACK (only when actively playing, never on title screen) ----
    if (cam.targetBlock && G.state === 'playing') {
      const [bx, by, bz] = cam.targetBlock;
      gl.useProgram(this.progLine);
      gl.uniformMatrix4fv(this.U(this.progLine, 'uProj'), false, this.proj);
      gl.uniformMatrix4fv(this.U(this.progLine, 'uView'), false, this.view);
      gl.uniform3f(this.U(this.progLine, 'uOffset'), bx, by, bz);
      gl.uniform1f(this.U(this.progLine, 'uExpand'), 1.004);
      gl.uniform4f(this.U(this.progLine, 'uColor'), 0, 0, 0, 0.75);
      gl.bindVertexArray(this.lineVAO);
      gl.drawArrays(gl.LINES, 0, 24);
      gl.bindVertexArray(null);

      if (cam.breakProgress > 0) {
        const stage = clamp(Math.floor(cam.breakProgress * 10), 0, 9);
        this.renderCrack(bx, by, bz, stage, fogColor, fogStart, fogEnd);
      }
    }

    // ---- PARTICLES (rendered in world depth BEFORE viewmodel clears depth buffer!) ----
    this.renderParticles(cam, world);

    // ---- VIEWMODEL (clears depth buffer to render first-person hand/item on top) ----
    this.renderViewmodel(cam, t, dayLight);
  }

  uploadAtlas() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, TEX.canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  renderSignTexts(cam) {
    const gl = this.gl;
    if (!this.signTexCache) this.signTexCache = new Map();
    let any = false;
    const verts = [];
    for (const [key, te] of G.tileEntities) {
      if (te.type !== 'sign' || !te.lines || (!te.lines[0] && !te.lines[1])) continue;
      const [x, y, z] = key.split(',').map(Number);
      const dist = Math.hypot(x + .5 - cam.x, y - cam.y, z + .5 - cam.z);
      if (dist > 48) continue;
      // texture (cached by content)
      const sig = te.lines.join('|');
      let tex = this.signTexCache.get(key);
      if (!tex || tex.__sig !== sig) {
        if (!tex) { tex = gl.createTexture(); this.signTexCache.set(key, tex); }
        tex.__sig = sig;
        const c2 = document.createElement('canvas');
        c2.width = 64; c2.height = 32;
        const cx2 = c2.getContext('2d');
        cx2.clearRect(0, 0, 64, 32);
        cx2.fillStyle = '#1a1208';
        cx2.font = 'bold 11px monospace';
        cx2.textAlign = 'center';
        te.lines.forEach((ln, i) => { if (ln) cx2.fillText(ln.slice(0, 20), 32, 13 + i * 13); });
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c2);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      // quad in front of the board (facing = meta&3: 0=+z,1=-x,2=-z,3=+x)
      const m = G.world.getMeta(x, y, z);
      const f = m & 3;
      let p0, p1, p2, p3;
      const y0 = y + 8.4 / 16, y1 = y + 14.6 / 16;
      if (f === 0) { p0 = [x + 1 / 16, y0, z + 14.2 / 16]; p1 = [x + 15 / 16, y0, z + 14.2 / 16]; p2 = [x + 15 / 16, y1, z + 14.2 / 16]; p3 = [x + 1 / 16, y1, z + 14.2 / 16]; }
      else if (f === 2) { p0 = [x + 15 / 16, y0, z + 1.8 / 16]; p1 = [x + 1 / 16, y0, z + 1.8 / 16]; p2 = [x + 1 / 16, y1, z + 1.8 / 16]; p3 = [x + 15 / 16, y1, z + 1.8 / 16]; }
      else if (f === 1) { p0 = [x + 1.8 / 16, y0, z + 1 / 16]; p1 = [x + 1.8 / 16, y0, z + 15 / 16]; p2 = [x + 1.8 / 16, y1, z + 15 / 16]; p3 = [x + 1.8 / 16, y1, z + 1 / 16]; }
      else { p0 = [x + 14.2 / 16, y0, z + 15 / 16]; p1 = [x + 14.2 / 16, y0, z + 1 / 16]; p2 = [x + 14.2 / 16, y1, z + 1 / 16]; p3 = [x + 14.2 / 16, y1, z + 15 / 16]; }
      const uvq = [[0, 0], [1, 0], [1, 1], [0, 1]]; // bottom vertices → canvas bottom (text upright)
      const Q = [p0, p1, p2, p3];
      for (const i of [0, 1, 2, 2, 3, 0]) verts.push(Q[i][0], Q[i][1], Q[i][2], uvq[i][0], uvq[i][1], 1, 1, 1, 0);
      any = true;
    }
    if (!any || !verts.length) return;
    gl.useProgram(this.progChunk);
    gl.uniform3f(this.U(this.progChunk, 'uChunkOffset'), 0, 0, 0);
    gl.uniformMatrix4fv(this.U(this.progChunk, 'uProj'), false, this.proj);
    gl.uniformMatrix4fv(this.U(this.progChunk, 'uView'), false, this.view);
    gl.uniform1f(this.U(this.progChunk, 'uDayLight'), Math.max(0.55, this.dayLight || 1));
    gl.uniform3f(this.U(this.progChunk, 'uFogColor'), 0, 0, 0);
    gl.uniform1f(this.U(this.progChunk, 'uFogStart'), 1e5);
    gl.uniform1f(this.U(this.progChunk, 'uFogEnd'), 1e6);
    gl.uniform1f(this.U(this.progChunk, 'uTime'), 0);
    gl.uniform1f(this.U(this.progChunk, 'uAlpha'), 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    if (!this.signVAO) {
      this.signVAO = gl.createVertexArray();
      this.signBuf = gl.createBuffer();
      gl.bindVertexArray(this.signVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.signBuf);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
      gl.bindVertexArray(null);
    }
    gl.bindVertexArray(this.signVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.signBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    // one texture per sign → draw sequentially with binds
    const stride = 9 * 6; // 6 verts per sign (2 tris)
    const signs = Math.floor(verts.length / stride);
    let idx = 0;
    for (const [key, te] of G.tileEntities) {
      if (idx >= signs) break;
      if (te.type !== 'sign' || !te.lines || (!te.lines[0] && !te.lines[1])) continue;
      const tex = this.signTexCache.get(key);
      if (!tex) continue;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawArrays(gl.TRIANGLES, idx * 6, 6);
      idx++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  }

  renderCrack(bx, by, bz, stage, fogColor, fogStart, fogEnd) {
    const gl = this.gl;
    const bid = G.world ? G.world.getBlock(bx, by, bz) : 0;
    const bl = BLOCKS[bid] || {};
    let x0 = 0, y0 = 0, z0 = 0, x1 = 1, y1 = 1, z1 = 1;
    if (bl.shape === 'slab') y1 = 0.5;
    else if (bl.shape === 'farmland') y1 = 15 / 16;
    else if (bl.shape === 'snow') y1 = 2 / 16;
    else if (bl.shape === 'chestbox') { x0 = 1 / 16; z0 = 1 / 16; x1 = 15 / 16; z1 = 15 / 16; y1 = 14 / 16; }
    else if (bl.shape === 'enchant') y1 = 12 / 16;
    else if (bl.shape === 'carpet') y1 = 1 / 16;

    const tile = TEX.tileIndex('destroy_stage_' + stage);
    const u0 = (tile % ATLAS_COLS) / ATLAS_COLS, v0 = 1 - (Math.floor(tile / ATLAS_COLS) + 1) / ATLAS_COLS;
    const s = 1 / ATLAS_COLS;
    const E = 0.0015;
    const pad = 0.002;
    const X0 = x0 - pad, Y0 = y0 - pad, Z0 = z0 - pad, X1 = x1 + pad, Y1 = y1 + pad, Z1 = z1 + pad;
    const verts = [];
    const faces = [
      [[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y1, Z0], [X0, Y1, Z0]],
      [[X1, Y0, Z1], [X0, Y0, Z1], [X0, Y1, Z1], [X1, Y1, Z1]],
      [[X0, Y0, Z1], [X0, Y0, Z0], [X0, Y1, Z0], [X0, Y1, Z1]],
      [[X1, Y0, Z0], [X1, Y0, Z1], [X1, Y1, Z1], [X1, Y1, Z0]],
      [[X0, Y1, Z0], [X1, Y1, Z0], [X1, Y1, Z1], [X0, Y1, Z1]],
      [[X0, Y0, Z1], [X1, Y0, Z1], [X1, Y0, Z0], [X0, Y0, Z0]],
    ];
    for (const f of faces) {
      const [a, b, c, d] = f;
      const uvq = [[u0 + E, v0 + E], [u0 + s - E, v0 + E], [u0 + s - E, v0 + s - E], [u0 + E, v0 + s - E]];
      const corners = [a, b, c, d];
      const idxs = [0, 1, 2, 2, 3, 0];
      for (const i of idxs) {
        verts.push(bx + corners[i][0], by + corners[i][1], bz + corners[i][2],
          uvq[i][0], uvq[i][1], 1, 1, 0.25, 0);
      }
    }
    gl.useProgram(this.progChunk);
    gl.uniform3f(this.U(this.progChunk, 'uChunkOffset'), 0, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.bindVertexArray(this.crackVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.crackBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    gl.uniformMatrix4fv(this.U(this.progChunk, 'uProj'), false, this.proj);
    gl.uniformMatrix4fv(this.U(this.progChunk, 'uView'), false, this.view);
    gl.uniform1f(this.U(this.progChunk, 'uDayLight'), 1);
    gl.uniform3fv(this.U(this.progChunk, 'uFogColor'), fogColor);
    gl.uniform1f(this.U(this.progChunk, 'uFogStart'), 1e6);
    gl.uniform1f(this.U(this.progChunk, 'uFogEnd'), 1e7);
    gl.uniform1f(this.U(this.progChunk, 'uTime'), 0);
    gl.uniform1f(this.U(this.progChunk, 'uAlpha'), 0.88);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-2, -4);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 9);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  renderEntities(cam, world, alpha, fogColor, fogStart, fogEnd) {
    const gl = this.gl;
    // 1. Render untextured box entities (mobs, boats, carts, arrows, XP orbs, crystals)
    const verts = [];
    for (const e of G.entities) {
      if (!e.renderParts || (e.dead && e.deathTime > 20)) continue;
      if (!Number.isFinite(e.rx) || !Number.isFinite(e.ry) || !Number.isFinite(e.rz)) continue;
      const dist = Math.hypot(e.rx - cam.x, e.ry - cam.y, e.rz - cam.z);
      if (dist > G.settings.renderDist * CH * 1.2) continue;
      const startLen = verts.length;
      e.drawBoxes(verts, cam, alpha, this._tmp);
      const added = verts.length - startLen;
      // Enterprise vertex stream invariant: 7 floats/vertex * 3 vertices/triangle = 21 floats/triangle
      if (added % 21 !== 0) {
        verts.length = startLen;
        continue;
      }
      let valid = true;
      for (let vi = startLen; vi < verts.length; vi += 7) {
        const vx = verts[vi], vy = verts[vi + 1], vz = verts[vi + 2];
        if (!Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz) ||
            Math.abs(vx - e.rx) > 16 || Math.abs(vy - e.ry) > 16 || Math.abs(vz - e.rz) > 16) {
          valid = false;
          break;
        }
      }
      if (!valid) verts.length = startLen;
    }
    if (verts.length > 0) {
      gl.useProgram(this.progEntity);
      gl.uniformMatrix4fv(this.U(this.progEntity, 'uProj'), false, this.proj);
      gl.uniformMatrix4fv(this.U(this.progEntity, 'uView'), false, this.view);
      gl.uniformMatrix4fv(this.U(this.progEntity, 'uModel'), false, M4.identity());
      const skyBr = G.dimension === 1 ? 0.12 : (G.dimension === 2 ? 0.4 : this.dayLight);
      gl.uniform1f(this.U(this.progEntity, 'uLight'), 0.25 + 0.75 * Math.max(skyBr, 0.12));
      gl.uniform1f(this.U(this.progEntity, 'uHurt'), 0);
      gl.uniform3fv(this.U(this.progEntity, 'uFogColor'), fogColor);
      gl.uniform1f(this.U(this.progEntity, 'uFogStart'), fogStart);
      gl.uniform1f(this.U(this.progEntity, 'uFogEnd'), fogEnd);
      gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(this.entVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.entBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, verts.length / 7);
      gl.enable(gl.CULL_FACE);
      gl.bindVertexArray(null);
    }

    // 2. Render 1:1 textured 3D item drops, falling blocks, and primed TNT (ItemEntityRenderer.java)
    this.renderTexturedEntities(cam, world, alpha, fogColor, fogStart, fogEnd);
  }

  getOrCreateItemTex(itemId) {
    const gl = this.gl;
    let tex = this.vmTexCache.get(itemId);
    if (!tex) {
      const img = new Image();
      img.src = TEX.itemURL(itemId);
      tex = gl.createTexture();
      tex.__loaded = false;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      img.onload = () => {
        const ic = document.createElement('canvas');
        ic.width = img.width || 16;
        ic.height = img.height || 16;
        const ictx = ic.getContext('2d');
        ictx.imageSmoothingEnabled = false;
        ictx.clearRect(0, 0, ic.width, ic.height);
        ictx.drawImage(img, 0, 0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ic);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        tex.__loaded = true;
      };
      this.vmTexCache.set(itemId, tex);
    }
    return tex;
  }

  renderTexturedEntities(cam, world, alpha, fogColor, fogStart, fogEnd) {
    const gl = this.gl;
    const atlasVerts = [];
    const spriteItems = [];

    const uvsForTile = (tile) => {
      const u0 = (tile % ATLAS_COLS) / ATLAS_COLS;
      const v0 = 1 - (Math.floor(tile / ATLAS_COLS) + 1) / ATLAS_COLS;
      const s = 1 / ATLAS_COLS;
      return [u0 + 0.0015, v0 + 0.0015, u0 + s - 0.0015, v0 + s - 0.0015];
    };

    const pushTexturedCube = (cx, cy, cz, scaleX, scaleY, scaleZ, rotY, bl, light, shadeMul = 1.0) => {
      const tiles = {
        top: TEX.tileIndex(TEX.faceTile(bl.id, 'top', 0)),
        bottom: TEX.tileIndex(TEX.faceTile(bl.id, 'bottom', 0)),
        side: TEX.tileIndex(TEX.faceTile(bl.id, 'side', 0)),
        front: TEX.tileIndex(TEX.faceTile(bl.id, 'front', 0)),
      };
      const cs = Math.cos(rotY), sn = Math.sin(rotY);
      const tf = (x, y, z) => {
        const sx = x * scaleX, sy = y * scaleY, sz = z * scaleZ;
        return [cx + sx * cs + sz * sn, cy + sy, cz - sx * sn + sz * cs];
      };
      const quads = [
        { f: 'top', pts: [[-.5, .5, -.5], [.5, .5, -.5], [.5, .5, .5], [-.5, .5, .5]], sh: 1.0 * shadeMul },
        { f: 'bottom', pts: [[-.5, -.5, .5], [.5, -.5, .5], [.5, -.5, -.5], [-.5, -.5, -.5]], sh: 0.58 * shadeMul },
        { f: 'front', pts: [[.5, -.5, .5], [-.5, -.5, .5], [-.5, .5, .5], [.5, .5, .5]], sh: 0.85 * shadeMul },
        { f: 'side', pts: [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, .5, -.5], [-.5, .5, -.5]], sh: 0.80 * shadeMul },
        { f: 'side', pts: [[.5, -.5, -.5], [.5, -.5, .5], [.5, .5, .5], [.5, .5, -.5]], sh: 0.68 * shadeMul },
        { f: 'side', pts: [[-.5, -.5, .5], [-.5, -.5, -.5], [-.5, .5, -.5], [-.5, .5, .5]], sh: 0.68 * shadeMul },
      ];
      for (const q of quads) {
        const tIdx = tiles[q.f] !== undefined ? tiles[q.f] : tiles.side;
        const [u0, v0, u1, v1] = uvsForTile(tIdx);
        const P = [tf(...q.pts[0]), tf(...q.pts[1]), tf(...q.pts[2]), tf(...q.pts[3])];
        const uvq = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
        for (const i of [0, 1, 2, 2, 3, 0]) {
          atlasVerts.push(P[i][0], P[i][1], P[i][2], uvq[i][0], uvq[i][1], light, light, q.sh, 0);
        }
      }
    };

    for (const e of G.entities) {
      if (e.dead) continue;
      if (e.type !== 'item' && e.type !== 'falling' && e.type !== 'tnt') continue;
      const dist = Math.hypot(e.rx - cam.x, e.ry - cam.y, e.rz - cam.z);
      if (dist > G.settings.renderDist * CH * 1.2) continue;
      const light = e.lightAt ? e.lightAt() : 0.9;

      if (e.type === 'falling') {
        const bl = BLOCKS[e.blockId || B.sand] || BLOCKS[B.sand];
        pushTexturedCube(e.rx, e.ry + 0.5, e.rz, 0.98, 0.98, 0.98, 0, bl, light, 1.0);
      } else if (e.type === 'tnt') {
        const bl = BLOCKS[B.tnt];
        const flash = Math.floor(e.age / 5) % 2 === 0;
        pushTexturedCube(e.rx, e.ry + 0.5, e.rz, 0.98, 0.98, 0.98, 0, bl, flash ? 1.0 : light, flash ? 1.45 : 1.0);
      } else if (e.type === 'item' && e.itemStack) {
        const def = ITEMS[e.itemStack.id];
        if (!def) continue;
        const ageA = e.age + alpha;
        const rotY = ageA * 0.05;
        const bob = Math.sin(ageA * 0.1) * 0.06 + 0.06;
        const cy = e.ry + 0.22 + bob;
        const cnt = e.itemStack.count || 1;
        // ItemEntityRenderer.getRenderedAmount: 1 for 1, 2 for 2..15, 3 for 16..31, 4 for 32+
        const copies = cnt > 31 ? 4 : (cnt > 15 ? 3 : (cnt > 1 ? 2 : 1));
        const offsets = [[0, 0, 0], [0.09, 0.03, 0.07], [-0.08, -0.02, 0.08], [0.06, 0.05, -0.08]];

        if (def.placeBlock != null) {
          const bl = BLOCKS[def.placeBlock];
          const isFlatBlock = bl.shape === 'cross' || bl.shape === 'reed' || bl.shape === 'crop' || bl.shape === 'torch' || bl.shape === 'door' || bl.shape === 'ladder' || bl.shape === 'rail_flat' || bl.shape === 'wire';
          if (!isFlatBlock) {
            const sy = bl.shape === 'slab' ? 0.14 : (bl.shape === 'carpet' || bl.shape === 'plate' ? 0.04 : 0.28);
            for (let c = 0; c < copies; c++) {
              const [ox, oy, oz] = offsets[c];
              pushTexturedCube(e.rx + ox, cy + oy, e.rz + oz, 0.28, sy, 0.28, rotY, bl, light, 1.0);
            }
            continue;
          }
        }
        spriteItems.push({ e, def, cy, rotY, light, copies, offsets });
      }
    }

    // Setup chunk shader for 3D textured entity rendering
    if (atlasVerts.length > 0 || spriteItems.length > 0) {
      gl.useProgram(this.progChunk);
      gl.uniform3f(this.U(this.progChunk, 'uChunkOffset'), 0, 0, 0);
      gl.uniformMatrix4fv(this.U(this.progChunk, 'uProj'), false, this.proj);
      gl.uniformMatrix4fv(this.U(this.progChunk, 'uView'), false, this.view);
      gl.uniform1f(this.U(this.progChunk, 'uDayLight'), 1);
      gl.uniform3fv(this.U(this.progChunk, 'uFogColor'), fogColor);
      gl.uniform1f(this.U(this.progChunk, 'uFogStart'), fogStart);
      gl.uniform1f(this.U(this.progChunk, 'uFogEnd'), fogEnd);
      gl.uniform1f(this.U(this.progChunk, 'uTime'), 0);
      gl.uniform1f(this.U(this.progChunk, 'uAlpha'), 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindVertexArray(this.crackVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.crackBuf);
      gl.disable(gl.CULL_FACE);

      if (atlasVerts.length > 0) {
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(atlasVerts), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, atlasVerts.length / 9);
      }

      for (const sp of spriteItems) {
        const tex = this.getOrCreateItemTex(sp.def.id);
        if (!tex || !tex.__loaded) continue;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        const s = 0.20;
        const cs = Math.cos(sp.rotY), sn = Math.sin(sp.rotY);
        const sVerts = [];
        const slices = [-0.012, 0, 0.012];
        for (let c = 0; c < sp.copies; c++) {
          const [ox, oy, oz] = sp.offsets[c];
          const bx = sp.e.rx + ox, by = sp.cy + oy, bz = sp.e.rz + oz;
          for (let si = 0; si < slices.length; si++) {
            const dz = slices[si];
            const sh = si === 1 ? 0.85 : 1.0;
            const tf = (lx, ly) => [bx + lx * cs + dz * sn, by + ly, bz - lx * sn + dz * cs];
            const p0 = tf(-s, -s), p1 = tf(s, -s), p2 = tf(s, s), p3 = tf(-s, s);
            const Q = [p0, p1, p2, p3];
            const uvq = [[0, 0], [1, 0], [1, 1], [0, 1]];
            for (const i of [0, 1, 2, 2, 3, 0]) {
              sVerts.push(Q[i][0], Q[i][1], Q[i][2], uvq[i][0], uvq[i][1], sp.light, sp.light, sh, 0);
            }
          }
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sVerts), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, sVerts.length / 9);
      }

      gl.enable(gl.CULL_FACE);
      gl.bindVertexArray(null);
    }
  }

  renderParticles(cam, world) {
    const gl = this.gl;
    if (!G.particles.length) return;
    const verts = [];
    // camera-facing billboard basis
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const up = [0, 1, 0];
    for (const p of G.particles) {
      if (p.dead) continue;
      const size = p.size;
      const corners = [[-1, -1], [1, -1], [1, 1], [1, 1], [-1, 1], [-1, -1]];
      for (const c of corners) {
        // final billboard position computed on the CPU: base + right/up offsets
        verts.push(
          p.x + right[0] * c[0] * size + up[0] * c[1] * size,
          p.y + right[1] * c[0] * size + up[1] * c[1] * size,
          p.z + right[2] * c[0] * size + up[2] * c[1] * size,
          p.r, p.g, p.b, p.a,
        );
      }
    }
    if (!verts.length) return;
    gl.useProgram(this.progEntity);
    const model = M4.identity();
    gl.uniformMatrix4fv(this.U(this.progEntity, 'uProj'), false, this.proj);
    gl.uniformMatrix4fv(this.U(this.progEntity, 'uView'), false, this.view);
    gl.uniformMatrix4fv(this.U(this.progEntity, 'uModel'), false, model);
    gl.uniform1f(this.U(this.progEntity, 'uLight'), 1);
    gl.uniform1f(this.U(this.progEntity, 'uHurt'), 0);
    gl.uniform3fv(this.U(this.progEntity, 'uFogColor'), this.fogColor);
    gl.uniform1f(this.U(this.progEntity, 'uFogStart'), this.fogEnd * .5);
    gl.uniform1f(this.U(this.progEntity, 'uFogEnd'), this.fogEnd);
    gl.bindVertexArray(this.partVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 7);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  renderViewmodel(cam, t, dayLight) {
    const gl = this.gl;
    if (G.state !== 'playing' || G.playerDead) return;
    const item = G.player && G.player.getHeldItem();
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.progEntity);
    const proj = M4.perspective(M4.identity(), rad(62), this.aspect, 0.05, 10);
    gl.uniformMatrix4fv(this.U(this.progEntity, 'uProj'), false, proj);
    gl.uniformMatrix4fv(this.U(this.progEntity, 'uView'), false, M4.identity());
    gl.uniform1f(this.U(this.progEntity, 'uLight'), Math.max(0.5, 0.35 + 0.65 * clamp(dayLight, 0.15, 1)));
    gl.uniform1f(this.U(this.progEntity, 'uHurt'), 0);
    gl.uniform3fv(this.U(this.progEntity, 'uFogColor'), [0, 0, 0]);
    gl.uniform1f(this.U(this.progEntity, 'uFogStart'), 1e6);
    gl.uniform1f(this.U(this.progEntity, 'uFogEnd'), 1e7);

    // 1:1 ItemInHandRenderer.java swing curves: f1 = sin(f^2 * PI), f2 = sin(sqrt(f) * PI)
    const swingProg = cam.swingT > 0 ? clamp(1 - cam.swingT, 0, 1) : 0;
    const f1 = swingProg > 0 ? Math.sin(swingProg * swingProg * Math.PI) : 0;
    const f2 = swingProg > 0 ? Math.sin(Math.sqrt(swingProg) * Math.PI) : 0;
    const swing = f2;
    const bobX = cam.bobPhase ? Math.sin(cam.bobPhase) * 0.018 * (cam.bobAmp || 1) : 0;
    const bobY = cam.bobPhase ? -Math.abs(Math.cos(cam.bobPhase)) * 0.018 * (cam.bobAmp || 1) : 0;
    const eqDown = cam.equipT > 0 ? Math.sin(cam.equipT * Math.PI) * -0.35 : 0;

    const verts = [];
    const model = M4.identity();

    if (item && ITEMS[item.id].placeBlock != null && !ITEMS[item.id].tool && !ITEMS[item.id].bow) {
      // block in hand: textured mini-cube rendered via chunk shader (ItemInHandRenderer.java)
      const bl = BLOCKS[ITEMS[item.id].placeBlock];
      const scale = 0.34;
      const ox = 0.54 + bobX - f2 * 0.18, oy = -0.44 + bobY + eqDown + f2 * 0.08 - f1 * 0.14, oz = -0.72 - f2 * 0.14;
      const rotY = 0.78 + f1 * 0.45, rotX = 0.18 - f2 * 0.75;
      this.drawBlockCube(bl, ox, oy, oz, scale, rotY, rotX, proj, dayLight);
      return;
    } else if (item) {
      // Any held non-block item (tools, weapons, food, ingots, buckets, bow, etc.)
      this.drawItemQuad(item, f1, f2, bobX, bobY, eqDown, proj, dayLight);
      return;
    } else {
      // bare arm: skin-colored box entering from bottom-right, chopping forward/downward on swing
      const V = (x, y, z, r, g, b, a) => verts.push(x, y, z, r, g, b, a);
      const skin = [0.87, 0.68, 0.52];
      const o = {
        x: 0.54 + bobX - f2 * 0.22,
        y: -0.22 + bobY + eqDown + f2 * 0.12 - f1 * 0.16,
        z: -0.70 - f2 * 0.18,
      };
      const w2 = 0.068;
      const rotX = -0.58 - f2 * 0.95; // tilts forward into screen (-Z), chops down on swing
      const rotZ = 0.18 + f2 * 0.35;  // angles inward toward crosshair
      const cx = Math.cos(rotX), sx = Math.sin(rotX);
      const cz = Math.cos(rotZ), sz = Math.sin(rotZ);
      const rp = (x, y, z) => {
        const x1 = x * cz - y * sz;
        const y1 = x * sz + y * cz;
        const y2 = y1 * cx - z * sx;
        const z2 = y1 * sx + z * cx;
        return [o.x + x1, o.y + y2, o.z + z2];
      };
      const corners = [];
      for (const X of [-w2, w2]) for (const Y of [0, -0.6]) for (const Z of [-w2, w2]) corners.push(rp(X, Y, Z));
      const cIdx = (i, j, k) => corners[(i ? 1 : 0) * 4 + (j ? 1 : 0) * 2 + (k ? 1 : 0)];
      const quad = (a, b, c, d, sh) => {
        const arr = [a, b, c, a, c, d];
        for (const p of arr) V(p[0], p[1], p[2], skin[0] * sh, skin[1] * sh, skin[2] * sh, 1);
      };
      quad(cIdx(0, 0, 0), cIdx(1, 0, 0), cIdx(1, 1, 0), cIdx(0, 1, 0), .9);
      quad(cIdx(1, 0, 1), cIdx(0, 0, 1), cIdx(0, 1, 1), cIdx(1, 1, 1), .9);
      quad(cIdx(0, 0, 1), cIdx(0, 0, 0), cIdx(0, 1, 0), cIdx(0, 1, 1), .75);
      quad(cIdx(1, 0, 0), cIdx(1, 0, 1), cIdx(1, 1, 1), cIdx(1, 1, 0), .75);
      quad(cIdx(0, 1, 0), cIdx(1, 1, 0), cIdx(1, 1, 1), cIdx(0, 1, 1), 1);
      quad(cIdx(0, 0, 1), cIdx(1, 0, 1), cIdx(1, 0, 0), cIdx(0, 0, 0), .6);
      gl.uniformMatrix4fv(this.U(this.progEntity, 'uModel'), false, model);
      gl.bindVertexArray(this.entVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.entBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
      gl.disable(gl.CULL_FACE);
      gl.drawArrays(gl.TRIANGLES, 0, verts.length / 7);
      gl.enable(gl.CULL_FACE);
      gl.bindVertexArray(null);
    }
  }

  drawBlockCube(bl, ox, oy, oz, scale, rotY, rotX, proj, dayLight) {
    const gl = this.gl;
    // build cube verts in chunk-shader format, transform on CPU
    const verts = [];
    const tiles = {
      top: TEX.tileIndex(TEX.faceTile(bl.id, 'top', 0)),
      bottom: TEX.tileIndex(TEX.faceTile(bl.id, 'bottom', 0)),
      side: TEX.tileIndex(TEX.faceTile(bl.id, 'side', 0)),
      front: TEX.tileIndex(TEX.faceTile(bl.id, 'front', 0)),
    };
    const uvs = (tile) => {
      const u0 = (tile % ATLAS_COLS) / ATLAS_COLS, v0 = 1 - (Math.floor(tile / ATLAS_COLS) + 1) / ATLAS_COLS;
      const s = 1 / ATLAS_COLS;
      return [u0 + .002, v0 + .002, u0 + s - .002, v0 + s - .002];
    };
    const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    const tf = (x, y, z) => {
      let X = x * cy + z * sy, Z = -x * sy + z * cy;
      let Y = y * cx - Z * sx; Z = y * sx + Z * cx;
      return [ox + X * scale, oy + Y * scale, oz + Z * scale];
    };
    const quads = [
      { f: 'top', pts: [[-.5, .5, -.5], [.5, .5, -.5], [.5, .5, .5], [-.5, .5, .5]], sh: 1 },
      { f: 'bottom', pts: [[-.5, -.5, .5], [.5, -.5, .5], [.5, -.5, -.5], [-.5, -.5, -.5]], sh: .6 },
      { f: 'side', pts: [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, .5, -.5], [-.5, .5, -.5]], sh: .8 },
      { f: 'side', pts: [[.5, -.5, .5], [-.5, -.5, .5], [-.5, .5, .5], [.5, .5, .5]], sh: .8 },
      { f: 'side', pts: [[.5, -.5, -.5], [.5, -.5, .5], [.5, .5, .5], [.5, .5, -.5]], sh: .68 },
      { f: 'side', pts: [[-.5, -.5, .5], [-.5, -.5, -.5], [-.5, .5, -.5], [-.5, .5, .5]], sh: .68 },
    ];
    const light = Math.max(0.5, 0.25 + 0.75 * clamp(dayLight, 0.15, 1));
    for (const q of quads) {
      const [u0, v0, u1, v1] = uvs(tiles[q.f] !== undefined ? tiles[q.f] : tiles.side);
      const P = q.pts.map(p => tf(p[0], p[1], p[2]));
      const uvq = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      const idxs = [0, 1, 2, 2, 3, 0];
      for (const i of idxs) verts.push(P[i][0], P[i][1], P[i][2], uvq[i][0], uvq[i][1], light, light, q.sh, 0);
    }
    gl.useProgram(this.progChunk);
    gl.uniform3f(this.U(this.progChunk, 'uChunkOffset'), 0, 0, 0);
    gl.uniformMatrix4fv(this.U(this.progChunk, 'uProj'), false, proj);
    gl.uniformMatrix4fv(this.U(this.progChunk, 'uView'), false, M4.identity());
    gl.uniform1f(this.U(this.progChunk, 'uDayLight'), 1);
    gl.uniform3f(this.U(this.progChunk, 'uFogColor'), 0, 0, 0);
    gl.uniform1f(this.U(this.progChunk, 'uFogStart'), 1e6);
    gl.uniform1f(this.U(this.progChunk, 'uFogEnd'), 1e7);
    gl.uniform1f(this.U(this.progChunk, 'uTime'), 0);
    gl.uniform1f(this.U(this.progChunk, 'uAlpha'), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.bindVertexArray(this.crackVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.crackBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 9);
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  }

  drawItemQuad(item, f1, f2, bobX, bobY, eqDown, proj, dayLight) {
    const gl = this.gl;
    let tex = this.vmTexCache.get(item.id);
    if (!tex || !tex.__loaded) {
      if (!tex) {
        const img = new Image();
        img.src = TEX.itemURL(item.id);
        tex = gl.createTexture();
        tex.__loaded = false;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
        img.onload = () => {
          // Convert indexed-color PNGs (color_type=3 with tRNS chunk) through a 2D canvas
          // so WebGL2 receives true 32-bit RGBA with alpha=0 on transparent background pixels!
          const ic = document.createElement('canvas');
          ic.width = img.width || 16;
          ic.height = img.height || 16;
          const ictx = ic.getContext('2d');
          ictx.imageSmoothingEnabled = false;
          ictx.clearRect(0, 0, ic.width, ic.height);
          ictx.drawImage(img, 0, 0);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ic);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          tex.__loaded = true;
        };
        this.vmTexCache.set(item.id, tex);
      }
      return;
    }
    gl.useProgram(this.progChunk);
    gl.uniform3f(this.U(this.progChunk, 'uChunkOffset'), 0, 0, 0);
    gl.uniformMatrix4fv(this.U(this.progChunk, 'uProj'), false, proj);
    gl.uniformMatrix4fv(this.U(this.progChunk, 'uView'), false, M4.identity());
    gl.uniform1f(this.U(this.progChunk, 'uDayLight'), 1);
    gl.uniform3f(this.U(this.progChunk, 'uFogColor'), 0, 0, 0);
    gl.uniform1f(this.U(this.progChunk, 'uFogStart'), 1e6);
    gl.uniform1f(this.U(this.progChunk, 'uFogEnd'), 1e7);
    gl.uniform1f(this.U(this.progChunk, 'uTime'), 0);
    gl.uniform1f(this.U(this.progChunk, 'uAlpha'), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);

    // 1:1 ItemInHandRenderer orientation:
    // Tool icons have handle at bottom-left (u=0,v=0) and head at top-right (u=1,v=1).
    // Mirror horizontally (u0=1, u1=0) so in the right hand the handle sits at bottom-right
    // and the tool blade/head points forward & top-left toward the crosshair, chopping down/forward on swing!
    const s = 0.42;
    const ox = 0.56 + bobX - f2 * 0.14;
    const oy = -0.45 + bobY + eqDown + f2 * 0.08 - f1 * 0.14;
    const oz = -0.72 - f2 * 0.12;
    const rotZ = 0.25 + f2 * 0.78;   // chops downward toward center-left on swing
    const rotY = -0.32 - f1 * 0.35;  // angled into depth (-Z)
    const rotX = -f2 * 0.45;         // pitches forward into target block
    const cz = Math.cos(rotZ), sz = Math.sin(rotZ);
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    const cx = Math.cos(rotX), sx = Math.sin(rotX);
    const tf = (lx, ly, lz) => {
      const x1 = lx * cz - ly * sz;
      const y1 = lx * sz + ly * cz;
      const x2 = x1 * cy + lz * sy;
      const z2 = -x1 * sy + lz * cy;
      const y3 = y1 * cx - z2 * sx;
      const z3 = y1 * sx + z2 * cx;
      return [ox + x2, oy + y3, oz + z3];
    };
    const light = Math.max(0.55, 0.28 + 0.72 * clamp(dayLight, 0.15, 1));
    const verts = [];
    // Render 5 thin depth slices (-0.018..+0.018) to give 3D extruded voxel thickness in hand
    const slices = [-0.016, -0.008, 0, 0.008, 0.016];
    for (let si = 0; si < slices.length; si++) {
      const dz = slices[si];
      const sh = (si === 0 || si === slices.length - 1) ? 1.0 : 0.82;
      const p0 = tf(-s / 2, -s / 2, dz);
      const p1 = tf(s / 2, -s / 2, dz);
      const p2 = tf(s / 2, s / 2, dz);
      const p3 = tf(-s / 2, s / 2, dz);
      const quad = [p0, p1, p2, p3];
      // Mirrored U: [1,0] -> [0,0] -> [0,1] -> [1,1] so handle is at bottom-right and tip points up-left
      const uvq = [[1, 0], [0, 0], [0, 1], [1, 1]];
      const idxs = [0, 1, 2, 2, 3, 0];
      for (const i of idxs) {
        verts.push(quad[i][0], quad[i][1], quad[i][2], uvq[i][0], uvq[i][1], light, light, sh, 0);
      }
    }
    gl.bindVertexArray(this.crackVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.crackBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 9);
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  }
}

// mat4 inverse (for sky ray computation — zero-allocation scratch buffer)
const _INV_M4_SCRATCH = new Float32Array(16);
function invertM4(out, m) {
  const inv = _INV_M4_SCRATCH;
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
  let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  if (det === 0) return out;
  det = 1.0 / det;
  for (let i = 0; i < 16; i++) out[i] = inv[i] * det;
  return out;
}
