// CVP Monitor v3.0 — box 100 × 80 × 50 mm (PRD-CVP-v3.0)
const BLUE = '#14365C';
const INK = '#0B0B0B';
const W = 0.1, D = 0.08, H = 0.05, WALL = 0.003, Z0 = D / 2;  // wall 3.0 mm (rekomendasi)

const stages = {
  front: document.getElementById('s-front'),
  top: document.getElementById('s-top'),
  right: document.getElementById('s-right'),
  rear: document.getElementById('s-rear'),
};
const [{ THREE }] = await Promise.all(Object.values(stages).map((s) => s.ready));
await document.fonts.ready.catch(() => {});

// panel coords: front X from left / Y from top; right panel X from front edge; left panel X from rear edge
const fx = (X) => -W / 2 + X / 1000, fy = (Y) => H - Y / 1000;
const rz = (X) => Z0 - X / 1000, lzr = (X) => -Z0 + X / 1000;
// internal coords: X from inner left wall, Y from inner front wall, Z from floor
const IX = (X) => -W / 2 + WALL + X / 1000, IY = (Y) => Z0 - WALL - Y / 1000, IZ = (Z) => WALL + Z / 1000;
const P = (X, Y, Z) => [IX(X), IZ(Z), IY(Y)];

// ---------- helpers ----------
function rrPath(p, w, h, r, cx = 0, cy = 0) {
  const x = cx - w / 2, y = cy - h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y); p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x + w, y + h - r); p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  p.lineTo(x + r, y + h); p.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x, y + r); p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}
function canvasTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function makeCanvas(wMM, hMM, k) {
  const c = document.createElement('canvas');
  c.width = Math.round(wMM * k); c.height = Math.round(hMM * k);
  return c;
}
function txt(ctx, k, t, X, Y, size, weight, color, spacing = 0, family = 'Inter Variable, Inter, sans-serif', align = 'center') {
  ctx.font = `${weight} ${size * k}px "${family}"`;
  ctx.letterSpacing = `${spacing * k}px`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(t, X * k, Y * k);
}

function oledTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const G = '#62ff9e';
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256);
  g.shadowColor = G; g.shadowBlur = 10;
  g.fillStyle = G; g.strokeStyle = G;
  g.textBaseline = 'alphabetic';
  g.font = '600 28px "JetBrains Mono Variable, JetBrains Mono, monospace"'; g.fillText('CVP Monitor', 12, 32);
  g.lineWidth = 3; g.strokeRect(436, 12, 54, 24); g.fillRect(491, 18, 6, 12); g.fillRect(441, 17, 34, 14);
  g.fillRect(12, 44, 488, 3);
  g.font = '700 98px "JetBrains Mono Variable, JetBrains Mono, monospace"'; g.fillText('12.4', 10, 136);
  const w = g.measureText('12.4').width;
  g.font = '600 36px "JetBrains Mono Variable, JetBrains Mono, monospace"'; g.fillText('cmH₂O', 22 + w, 136);
  g.font = '600 40px "JetBrains Mono Variable, JetBrains Mono, monospace"'; g.fillText('9.1 mmHg', 12, 190);
  g.fillRect(12, 206, 252, 40);
  g.shadowBlur = 0; g.fillStyle = '#000';
  g.font = '700 30px "JetBrains Mono Variable, JetBrains Mono, monospace"'; g.fillText('PATENCY OK', 26, 237);
  const t = canvasTex(c);
  t.anisotropy = 4;
  return t;
}

function spriteLabel(text, h, opts = {}) {
  const lines = text.split('\n');
  const font = opts.font || '600 46px "JetBrains Mono Variable, JetBrains Mono, monospace"', font2 = '500 36px "JetBrains Mono Variable, JetBrains Mono, monospace"';
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  let tw = 0;
  lines.forEach((t, i) => { g.font = i ? font2 : font; tw = Math.max(tw, g.measureText(t).width); });
  c.width = Math.ceil(tw + 44); c.height = 76 + (lines.length - 1) * 44;
  const g2 = c.getContext('2d');
  g2.fillStyle = opts.bg || '#ffffff';
  g2.strokeStyle = opts.border || BLUE; g2.lineWidth = 3;
  g2.beginPath(); g2.roundRect(2, 2, c.width - 4, c.height - 4, 10); g2.fill(); g2.stroke();
  g2.textAlign = 'center'; g2.textBaseline = 'middle';
  lines.forEach((t, i) => {
    g2.font = i ? font2 : font;
    g2.fillStyle = i ? (opts.color2 || '#5b6775') : (opts.color || BLUE);
    g2.fillText(t, c.width / 2, 40 + i * 44);
  });
  const mat = new THREE.SpriteMaterial({ map: canvasTex(c), depthTest: false, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(h * c.width / 76, h * c.height / 76, 1);
  s.renderOrder = 20;
  return s;
}

let glowTex;
function glowSprite(color, size, opacity) {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}

function dimension(group, a, b, off, text, s) {
  const mat = new THREE.LineBasicMaterial({ color: BLUE, depthTest: false, transparent: true });
  const A = a.clone().add(off), B = b.clone().add(off);
  const n = off.clone().normalize();
  const pts = [
    a.clone().add(n.clone().multiplyScalar(s * 1.5)), A.clone().add(n.clone().multiplyScalar(s * 1.5)),
    b.clone().add(n.clone().multiplyScalar(s * 1.5)), B.clone().add(n.clone().multiplyScalar(s * 1.5)),
    A, B,
  ];
  const ls = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat);
  ls.renderOrder = 15;
  group.add(ls);
  const coneMat = new THREE.MeshBasicMaterial({ color: BLUE, depthTest: false });
  for (const [p, q] of [[A, B], [B, A]]) {
    const dir = p.clone().sub(q).normalize();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(s * 0.45, s * 2.2, 16), coneMat);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    cone.position.copy(p).sub(dir.clone().multiplyScalar(s * 1.1));
    cone.renderOrder = 15;
    group.add(cone);
  }
  const lab = spriteLabel(text, s * 4.2);
  lab.position.copy(A).add(B).multiplyScalar(0.5);
  group.add(lab);
}

function callout(group, text, a, p, h = 0.0075) {
  const lineMat = new THREE.LineBasicMaterial({ color: BLUE, depthTest: false, transparent: true });
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...p)]), lineMat);
  l.renderOrder = 15; group.add(l);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(h * 0.1, 12, 8), new THREE.MeshBasicMaterial({ color: BLUE, depthTest: false }));
  dot.position.set(...a); dot.renderOrder = 15; group.add(dot);
  const s = spriteLabel(text, h, { bg: '#ffffff', color: INK, font: '600 44px "JetBrains Mono Variable, JetBrains Mono, monospace"' });
  s.position.set(...p); group.add(s);
}

// ---------- model ----------
function build({ lid = true, stopcock = false, mount = false, split = 0 } = {}) {
  const g = new THREE.Group(); g.name = 'cvp_monitor_v3';
  const glows = [];
  const M = (name, color, o = {}) => new THREE.MeshStandardMaterial({ name, color, roughness: 0.8, metalness: 0, ...o });
  const mat = {
    shell: M('abs_shell', 0xe7eaed, { roughness: 0.9 }),
    black: M('oled_bezel_black', 0x15171a, { roughness: 0.6 }),
    glass: M('oled_glass', 0x050607, { roughness: 0.3 }),
    dark: M('port_dark', 0x0c0d0f, { roughness: 0.7 }),
    btnBody: M('button_body', 0x3a3f45, { roughness: 0.7 }),
    btnCap: M('button_cap', 0xf4f5f6, { roughness: 0.65 }),
    metal: M('metal', 0xc3c8cd, { roughness: 0.4, metalness: 0.3 }),
    luer: M('luer_medical', 0xeef5f8, { roughness: 0.3, transparent: true, opacity: 0.86 }),
    ledHolder: M('led_holder', 0x2c3035, { roughness: 0.6 }),
    ledG: M('led_green', 0x2fe36f, { emissive: 0x22ff66, emissiveIntensity: 1.6, roughness: 0.3 }),
    ledY: M('led_yellow', 0xffc21a, { emissive: 0xffb000, emissiveIntensity: 0.5, roughness: 0.3 }),
    ledR: M('led_red', 0xd93a2b, { emissive: 0xff2a10, emissiveIntensity: 0.35, roughness: 0.3 }),
    pcbBlack: M('pcb_black', 0x1d2024, { roughness: 0.55 }),
    pcbBlue: M('pcb_blue', 0x1f4fa8, { roughness: 0.55 }),
    pcbGreen: M('pcb_green', 0x2c6e46, { roughness: 0.55 }),
    perf: M('perfboard_fr4', 0x3f7d55, { roughness: 0.75 }),
    chip: M('ic_black', 0x101113, { roughness: 0.5 }),
    trim: M('trimmer_blue', 0x2f6fe0, { roughness: 0.5 }),
    brass: M('brass', 0xd2b06a, { roughness: 0.4, metalness: 0.3 }),
    cell: M('cell_wrap_blue', 0x2f62c0, { roughness: 0.45 }),
    print: M('print_white', 0xffffff, { roughness: 0.6 }),
    foam: M('eva_foam', 0x4a4f57, { roughness: 1 }),
    cutEdge: M('cut_edge', 0xb3b9bf, { roughness: 0.9 }),
    fpc: M('fpc_flex', 0xd8901e, { roughness: 0.5 }),
    smdTan: M('smd_cap', 0xb89a6a, { roughness: 0.6 }),
    smdRed: M('smd_led_red', 0xff3b2b, { emissive: 0xff2010, emissiveIntensity: 0.8 }),
    wireR: M('wire_red', 0xc8302a, { roughness: 0.55 }),
    wireK: M('wire_black', 0x202226, { roughness: 0.55 }),
    wireY: M('wire_yellow', 0xe6b422, { roughness: 0.55 }),
    wireB: M('wire_blue', 0x2A7FE0, { roughness: 0.55 }),
    silicone: M('silicone_tube', 0xdfeef2, { roughness: 0.25, transparent: true, opacity: 0.7 }),
    filter: M('ptfe_filter_housing', 0xf3f6f8, { roughness: 0.3, transparent: true, opacity: 0.8 }),
    membrane: M('ptfe_membrane', 0xffffff, { roughness: 0.9 }),
    stopcock: M('stopcock_white', 0xf7f8f8, { roughness: 0.45 }),
    clamp: M('clamp_body', 0x33373d, { roughness: 0.7 }),
    rubber: M('clamp_rubber', 0x18191b, { roughness: 0.95 }),
    pole: M('pole_stainless', 0xd3d8dd, { roughness: 0.28, metalness: 0.35 }),
    laserLens: M('laser_lens', 0x5a0e0a, { roughness: 0.15, emissive: 0x500a05, emissiveIntensity: 1 }),
    laserDot: M('laser_emitter', 0xff3020, { emissive: 0xff2010, emissiveIntensity: 2.5 }),
    resistor: M('resistor_body', 0xd9c49a, { roughness: 0.6 }),
    bandBrown: M('band_brown', 0x6b3d1e, { roughness: 0.6 }),
    bandOrange: M('band_orange', 0xe07a1f, { roughness: 0.6 }),
  };
  const add = (geo, m, name, x, y, z, parent = g) => {
    const o = new THREE.Mesh(geo, m); o.name = name; o.position.set(x, y, z); parent.add(o); return o;
  };
  const addP = (geo, m, name, p, parent = g) => add(geo, m, name, p[0], p[1], p[2], parent);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cylZ = (r, len, seg = 40) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
  const cylX = (r, len, seg = 40) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
  const cylY = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg);
  const wire = (m, name, pts, rad = 0.0006, parent = g) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(curve, 48, rad, 8, false), m, name, 0, 0, 0, parent);
  };
  const resistorY = (name, p, bands, parent = g) => {
    addP(cylZ(0.0009, 0.0062, 20), mat.resistor, name, p, parent);
    bands.forEach((m, i) => add(cylZ(0.00095, 0.0005, 20), m, name + '_band', p[0], p[1], p[2] + 0.0018 - i * 0.0009, parent));
    for (const sg of [-1, 1]) add(cylZ(0.0002, 0.003, 6), mat.metal, name + '_lead', p[0], p[1] - 0.0002, p[2] + sg * 0.0045, parent);
  };

  // ---- shell ----
  const wallH = H - WALL, RC = 0.003, T = WALL;
  const u = new THREE.Shape();
  u.moveTo(W / 2 - RC, -Z0);
  u.absarc(W / 2 - RC, -Z0 + RC, RC, -Math.PI / 2, 0, false);
  u.lineTo(W / 2, Z0 - RC); u.absarc(W / 2 - RC, Z0 - RC, RC, 0, Math.PI / 2, false);
  u.lineTo(-W / 2 + RC, Z0); u.absarc(-W / 2 + RC, Z0 - RC, RC, Math.PI / 2, Math.PI, false);
  u.lineTo(-W / 2, -Z0 + RC); u.absarc(-W / 2 + RC, -Z0 + RC, RC, Math.PI, Math.PI * 1.5, false);
  u.lineTo(-W / 2 + RC, -Z0 + T);
  u.lineTo(-W / 2 + T, Z0 - T); u.lineTo(W / 2 - T, Z0 - T); u.lineTo(W / 2 - T, -Z0 + T); u.lineTo(W / 2 - RC, -Z0 + T);
  u.closePath();
  add(new THREE.ExtrudeGeometry(u, { depth: wallH, bevelEnabled: false, curveSegments: 12 }).rotateX(-Math.PI / 2), mat.shell, 'enclosure_walls', 0, 0, 0);
  const fw = new THREE.Shape();
  fw.moveTo(-W / 2 + RC, 0); fw.lineTo(W / 2 - RC, 0); fw.lineTo(W / 2 - RC, wallH); fw.lineTo(-W / 2 + RC, wallH); fw.closePath();
  const OH = 0.0265, ocx = fx(22), ocy = fy(25);   // OLED opening 26.5 × 26.5 (26.00 + 0.50 FDM)
  const oh = new THREE.Path();
  oh.moveTo(ocx - OH / 2, ocy - OH / 2); oh.lineTo(ocx - OH / 2, ocy + OH / 2); oh.lineTo(ocx + OH / 2, ocy + OH / 2); oh.lineTo(ocx + OH / 2, ocy - OH / 2); oh.closePath();
  fw.holes.push(oh);
  add(new THREE.ExtrudeGeometry(fw, { depth: T, bevelEnabled: false }), mat.shell, 'enclosure_front_wall', 0, 0, Z0 - T);
  add(new THREE.ExtrudeGeometry(rrPath(new THREE.Shape(), W - 2 * WALL, D - 2 * WALL, 0.0005), { depth: WALL, bevelEnabled: false }).rotateX(-Math.PI / 2), mat.shell, 'enclosure_floor', 0, 0, 0);
  if (lid) {
    const bv = 0.0006;
    const ls = rrPath(new THREE.Shape(), W - 0.0006 - 2 * bv, D - 0.0006 - 2 * bv, 0.003 - bv);
    add(new THREE.ExtrudeGeometry(ls, { depth: WALL - 2 * bv, bevelEnabled: true, bevelSize: bv, bevelThickness: bv, bevelSegments: 3, curveSegments: 12 }).rotateX(-Math.PI / 2), mat.shell, 'enclosure_lid', 0, wallH + bv, 0);
    const tc = makeCanvas(100, 80, 16), t = tc.getContext('2d'), tk = 16;
    txt(t, tk, 'CVP', 50, 37, 14, 700, BLUE, 0.2);
    txt(t, tk, 'MONITOR', 50, 44.5, 4.4, 700, INK, 0.9);
    t.fillStyle = BLUE; t.fillRect(32 * tk, 47.4 * tk, 36 * tk, 0.4 * tk);
    txt(t, tk, 'ESP32 Based · Low Cost CVP Kit', 50, 52.4, 2.4, 500, '#3d4957', 0.05);
    txt(t, tk, 'v3.0 · PROTOTYPE ONLY', 50, 70, 1.9, 600, BLUE, 0.15, 'JetBrains Mono Variable, JetBrains Mono, monospace');
    add(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ name: 'lid_print', map: canvasTex(tc), transparent: true, roughness: 0.9 }), 'lid_labels', 0, H + 0.0002, 0);
  }

  // ---- front panel (100 × 50) ----
  // OLED 0.96" press-fit in 26.5 × 26.5 opening (centre X22 Y25). Module PCB 26 × 26; glass front flush with panel face.
  const ox = fx(22), oy = fy(25), mTop = oy + 0.013;
  const zG = Z0 - 0.0014;                    // glass back / PCB front
  add(box(0.026, 0.026, 0.0016), mat.pcbBlue, 'oled_module_pcb', ox, oy, zG - 0.0008);
  add(box(0.0247, 0.0166, 0.0014), mat.glass, 'oled_glass', ox, mTop - 0.0045 - 0.0083, zG + 0.0007);
  const screenMat = new THREE.MeshStandardMaterial({ name: 'oled_screen', color: 0x000000, emissive: 0xffffff, emissiveMap: oledTexture(), emissiveIntensity: 1.15, roughness: 0.35 });
  add(new THREE.PlaneGeometry(0.02174, 0.01118), screenMat, 'oled_screen', ox, mTop - 0.00571 - 0.00559, Z0 + 0.00003);
  add(box(0.0084, 0.0049, 0.0002), mat.fpc, 'oled_fpc', ox, mTop - 0.0211 - 0.00245, zG + 0.0001);
  for (const [dx, dy] of [[-0.0112, 0.013 - 0.0022], [0.0112, 0.013 - 0.0022], [-0.0112, -0.013 + 0.0019], [0.0112, -0.013 + 0.0019]]) {
    add(new THREE.TorusGeometry(0.00125, 0.00035, 8, 24), mat.brass, 'oled_mount_hole_ring', ox + dx, oy + dy, zG + 0.0001);
    add(cylZ(0.00115, 0.0002, 20), mat.dark, 'oled_mount_hole', ox + dx, oy + dy, zG + 0.00005);
  }
  for (let i = -3; i <= 3; i++) {
    add(cylZ(0.0007, 0.0002, 16), mat.brass, 'oled_pin_pad', ox + i * 0.00254, mTop - 0.0021, zG + 0.0001);
    add(cylZ(0.0003, 0.007, 8), mat.brass, 'oled_header_pin', ox + i * 0.00254, mTop - 0.0021, zG - 0.0016 - 0.0035);
  }
  add(box(0.0178, 0.0025, 0.0025), mat.chip, 'oled_header_7pin', ox, mTop - 0.0021, zG - 0.0016 - 0.00125);
  glows.push({ pos: [ox, mTop - 0.0113, Z0 + 0.003], color: 0x44ff88, opacity: 0.16, size: 0.032 });

  const leds = [[60, mat.ledG, 'green', 0x33ff77, 0.9], [72, mat.ledY, 'yellow', 0xffb400, 0.28], [84, mat.ledR, 'red', 0xff3020, 0.22]];
  for (const [X, m, nm, gc, go] of leds) {
    const x = fx(X), y = fy(12);
    add(cylZ(0.0034, 0.0012), mat.ledHolder, `led_${nm}_holder`, x, y, Z0 + 0.0006);
    add(cylZ(0.0029, 0.0008), m, `led_${nm}_flange`, x, y, Z0 + 0.0016);
    add(cylZ(0.0025, 0.0022), m, `led_${nm}_body`, x, y, Z0 + 0.0031);
    add(new THREE.SphereGeometry(0.0025, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), m, `led_${nm}_dome`, x, y, Z0 + 0.0042);
    add(cylZ(0.0025, 0.005), m, `led_${nm}_rear`, x, y, Z0 - WALL - 0.0025);
    glows.push({ pos: [x, y, Z0 + 0.0055], color: gc, opacity: go, size: 0.016 });
  }
  for (const [X, nm] of [[55, 'zero'], [73, 'lock']]) {
    const x = fx(X), y = fy(35);
    add(box(0.012, 0.012, 0.0025), mat.btnBody, `button_${nm}_body`, x, y, Z0 + 0.00125);
    add(cylZ(0.0046, 0.0008, 48), mat.btnBody, `button_${nm}_collar`, x, y, Z0 + 0.0029);
    add(cylZ(0.0041, 0.0028, 48), mat.btnCap, `button_${nm}_cap`, x, y, Z0 + 0.0039);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(cylZ(0.0006, 0.0003, 12), mat.metal, `button_${nm}_rivet`, x + dx * 0.0045, y + dy * 0.0045, Z0 + 0.0026);
    add(box(0.012, 0.012, 0.0045), mat.btnBody, `button_${nm}_switch`, x, y, Z0 - WALL - 0.00225);
  }
  const k = 24, fc = makeCanvas(100, 50, k), f = fc.getContext('2d');
  f.fillStyle = 'rgba(27,36,48,.14)'; f.fillRect(41 * k, 6 * k, 0.25 * k, 38 * k);
  txt(f, k, 'PATENCY', 60, 19.4, 1.9, 700, BLUE, 0.12);
  txt(f, k, 'WARN', 72, 19.4, 1.9, 700, BLUE, 0.12);
  txt(f, k, 'ALERT', 84, 19.4, 1.9, 700, BLUE, 0.12);
  txt(f, k, 'ZERO', 55, 46, 2.3, 700, BLUE, 0.15);
  txt(f, k, 'LOCK', 73, 46, 2.3, 700, BLUE, 0.15);
  txt(f, k, 'CVP', 90, 33.6, 7.6, 700, BLUE, 0.08);
  txt(f, k, 'MONITOR', 90, 37.6, 2.2, 700, INK, 0.28);
  f.fillStyle = BLUE; f.fillRect(82.5 * k, 39.3 * k, 15 * k, 0.3 * k);
  txt(f, k, 'ESP32 Based', 90, 42, 1.45, 500, '#3d4957', 0.04);
  txt(f, k, 'Low Cost CVP Kit', 90, 44.2, 1.45, 500, '#3d4957', 0.04);
  add(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ name: 'front_print', map: canvasTex(fc), transparent: true, roughness: 0.9 }), 'front_labels', 0, H / 2, Z0 + 0.0003);

  // ---- right panel: USB X=20 Y=25, switch X=50 Y=30 ----
  const RX = W / 2;
  const sw = new THREE.Group(); sw.name = 'power_switch'; sw.position.set(RX, fy(30), rz(50)); g.add(sw);
  add(box(0.0015, 0.008, 0.013), mat.black, 'switch_frame', 0.00075, 0, 0, sw);
  const rock = add(box(0.0022, 0.0062, 0.0112), mat.btnBody, 'switch_rocker', 0.0018, 0, 0, sw);
  rock.rotation.y = 0.12;
  add(box(0.0003, 0.0028, 0.0006), mat.print, 'switch_mark_on', 0.0012, 0, 0.0033, rock);
  add(new THREE.TorusGeometry(0.0011, 0.00025, 8, 24).rotateY(Math.PI / 2), mat.print, 'switch_mark_off', 0.0012, 0, -0.0033, rock);
  add(box(0.02, 0.008, 0.013), mat.black, 'switch_body', RX - WALL - 0.01, fy(30), rz(50));
  for (const dz of [-0.004, 0, 0.004]) add(box(0.003, 0.003, 0.0008), mat.metal, 'switch_terminal', RX - WALL - 0.0215, fy(30), rz(50) + dz);
  const ux = rz(20), uy = fy(25);
  add(box(0.0004, 0.006, 0.009), mat.dark, 'usb_recess', RX + 0.0002, uy, ux);
  add(box(0.0006, 0.0026, 0.0076), mat.metal, 'usb_receptacle', RX + 0.0007, uy, ux);
  add(box(0.0003, 0.0016, 0.0064), mat.dark, 'usb_opening', RX + 0.00092, uy, ux);
  add(box(0.0002, 0.0005, 0.0046), mat.chip, 'usb_tongue', RX + 0.00106, uy, ux);
  add(box(0.011, 0.0012, 0.013), mat.pcbBlack, 'usb_breakout_pcb', RX - WALL - 0.0055, uy - 0.002, ux);
  add(box(0.006, 0.0028, 0.0076), mat.metal, 'usb_breakout_receptacle', RX - WALL - 0.003, uy, ux);
  const rc = makeCanvas(80, 50, k), r = rc.getContext('2d');
  txt(r, k, 'CHARGE', 20, 18.6, 2.1, 700, BLUE, 0.15);
  txt(r, k, '5V ⎓', 20, 31.6, 1.6, 600, '#3d4957', 0.05, 'JetBrains Mono Variable, JetBrains Mono, monospace');
  txt(r, k, 'POWER', 50, 23.4, 2.1, 700, BLUE, 0.15);
  add(new THREE.PlaneGeometry(D, H).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ name: 'right_print', map: canvasTex(rc), transparent: true, roughness: 0.9 }), 'right_labels', RX + 0.0003, H / 2, 0);

  // ---- left panel: laser X=15 Y=25 Ø12, Luer X=55 Y=25 Ø10 ----
  const LX = -W / 2, ly = fy(25), LZ = lzr(55), LZL = lzr(15);
  const luer = new THREE.Group(); luer.name = 'luer_lock_port'; luer.position.set(LX, ly, LZ); g.add(luer);
  add(new THREE.CylinderGeometry(0.0068, 0.0068, 0.0018, 6).rotateZ(Math.PI / 2), mat.luer, 'luer_hex_nut', -0.0009, 0, 0, luer);
  add(cylX(0.005, 0.0012), mat.luer, 'luer_collar', -0.0024, 0, 0, luer);
  add(cylX(0.0045, 0.0068, 48), mat.luer, 'luer_barrel', -0.0064, 0, 0, luer);
  for (const xo of [-0.0045, -0.0062]) add(new THREE.TorusGeometry(0.0046, 0.00022, 8, 40).rotateY(Math.PI / 2), mat.luer, 'luer_grip_rib', xo, 0, 0, luer);
  for (const s of [-1, 1]) add(box(0.0014, 0.0016, 0.0036), mat.luer, 'luer_thread_lug', -0.0091, s * 0.0052, 0, luer);
  add(cylX(0.0023, 0.0002, 32), mat.dark, 'luer_bore', -0.00985, 0, 0, luer);
  add(cylX(0.0016, 0.004, 24), mat.luer, 'luer_inner_barb', 0.0045, 0, 0, luer);
  const lz = new THREE.Group(); lz.name = 'laser_aperture'; lz.position.set(LX, ly, LZL); g.add(lz);
  add(cylX(0.006, 0.0008, 48), mat.black, 'laser_bezel', -0.0004, 0, 0, lz);
  add(cylX(0.0042, 0.0006, 40), mat.metal, 'laser_lens_ring', -0.0011, 0, 0, lz);
  add(cylX(0.0032, 0.0003, 40), mat.laserLens, 'laser_lens', -0.00145, 0, 0, lz);
  add(cylX(0.0009, 0.0002, 24), mat.laserDot, 'laser_emitter', -0.0016, 0, 0, lz);
  glows.push({ pos: [LX - 0.003, ly, LZL], color: 0xff2010, opacity: 0.75, size: 0.013 });
  const lc = makeCanvas(80, 50, k), l = lc.getContext('2d');
  txt(l, k, 'Laser 650nm', 15, 37.6, 2.0, 700, BLUE, 0.08);
  txt(l, k, 'PRESSURE IN', 55, 38.4, 2.1, 700, BLUE, 0.15);
  add(new THREE.PlaneGeometry(D, H).rotateY(-Math.PI / 2), new THREE.MeshStandardMaterial({ name: 'left_print', map: canvasTex(lc), transparent: true, roughness: 0.9 }), 'left_labels', LX - 0.0003, H / 2, 0);

  // ---- LAYER 1 · floor (Z 0–22) ----
  for (const [X, Y] of [[5, 6.5], [90, 6.5], [5, 71.5], [90, 71.5]]) {
    addP(cylY(0.0018, 0.029, 16), mat.brass, 'perfboard_standoff', P(X, Y, 14.5));
  }
  // Zone A — 18650 holder, long axis along Y (width)
  const hX = 35;
  addP(box(0.022, 0.0015, 0.073), mat.black, 'holder_18650_base', P(hX, 37.5, 0.75));
  for (const sg of [-1, 1]) addP(box(0.001, 0.011, 0.073), mat.black, 'holder_18650_rail', P(hX + sg * 10.5, 37.5, 5.5));
  for (const Y of [2.25, 72.75]) addP(box(0.022, 0.022, 0.0025), mat.black, 'holder_18650_end', P(hX, Y, 11));
  for (const Y of [0.5, 74.5]) addP(box(0.02, 0.018, 0.001), mat.foam, 'eva_foam_pad', P(hX, Y, 10));
  addP(cylZ(0.009, 0.065, 48), mat.cell, 'cell_18650', P(hX, 37.5, 11));
  for (const sg of [-1, 1]) addP(cylZ(0.0086, 0.0008, 40), mat.metal, 'cell_18650_cap', P(hX, 37.5 + sg * 32.4, 11));
  addP(cylZ(0.0035, 0.001, 24), mat.metal, 'cell_18650_nub', P(hX, 4.6, 11));
  addP(new THREE.TorusGeometry(0.00905, 0.0003, 8, 48), mat.print, 'cell_18650_band', P(hX, 52, 11));
  // Zone D — Luer → PTFE filter → MPS20N0040D; laser module
  addP(box(0.018, 0.002, 0.01), mat.shell, 'filter_saddle', P(12, 42, 1));
  addP(cylZ(0.0125, 0.006, 48), mat.filter, 'ptfe_filter_body', P(12, 42, 13));
  addP(cylZ(0.011, 0.0008, 48), mat.membrane, 'ptfe_membrane', P(12, 42, 13));
  for (const sg of [-1, 1]) {
    addP(cylZ(0.0128, 0.001, 48), mat.filter, 'ptfe_filter_rim', P(12, 42 + sg * 3, 13));
    addP(cylZ(0.0025, 0.004, 24), mat.filter, 'ptfe_filter_luer', P(12, 42 + sg * 5, 13));
  }
  addP(box(0.02, 0.0016, 0.015), mat.pcbGreen, 'mps20n0040d_pcb', P(12, 63, 2.8));
  for (const [dx, dy] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) addP(cylY(0.0012, 0.002, 12), mat.brass, 'mps20n0040d_spacer', P(12 + dx, 63 + dy, 1));
  addP(box(0.014, 0.008, 0.011), mat.chip, 'mps20n0040d_body', P(12, 63, 7.6));
  addP(cylZ(0.0015, 0.004, 20), mat.chip, 'mps20n0040d_port', P(12, 55.5, 7.6));
  for (const dx of [-3.8, -1.3, 1.3, 3.8]) addP(box(0.0006, 0.003, 0.0006), mat.metal, 'mps20n0040d_pin', P(12 + dx, 69.5, 2.5));
  addP(cylX(0.0075, 0.005, 40), mat.shell, 'laser_wall_boss', P(2.5, 62.5, 22.5));
  addP(cylX(0.006, 0.0225, 40), mat.brass, 'laser_module_body', P(8.75, 62.5, 22.5));
  addP(cylX(0.0045, 0.002, 32), mat.chip, 'laser_module_cap', P(21, 62.5, 22.5));
  wire(mat.silicone, 'tube_luer_filter', [P(4, 22.5, 22.5), P(9, 25, 21), P(12, 30, 15), P(12, 35, 13)], 0.0014);
  wire(mat.silicone, 'tube_filter_sensor', [P(12, 49, 13), P(12, 51.5, 10), P(12, 53.5, 7.6)], 0.0014);
  wire(mat.wireR, 'wire_laser_anode', [P(22, 62, 23.3), P(25, 58, 25), P(27, 56, 28.5)]);
  wire(mat.wireK, 'wire_laser_cathode', [P(22, 63, 21.7), P(26, 60, 24), P(28, 57, 28.5)]);
  wire(mat.wireY, 'wire_sensor_hx710b', [P(12, 70, 3), P(16, 72, 12), P(20, 70, 28.5)], 0.0009);
  // Zone B — MT3608, TP4056, AMS1117, switch, USB breakout
  addP(box(0.036, 0.0016, 0.017), mat.pcbBlue, 'mt3608_pcb', P(75, 17.5, 2.8));
  for (const dx of [-15, 15]) addP(cylY(0.0012, 0.002, 12), mat.brass, 'mt3608_spacer', P(75 + dx, 17.5, 1));
  addP(box(0.0065, 0.003, 0.0065), mat.chip, 'mt3608_inductor', P(68, 15.5, 5.1));
  addP(box(0.003, 0.0012, 0.0016), mat.chip, 'mt3608_ic', P(76, 14, 4.2));
  addP(box(0.0095, 0.0065, 0.0048), mat.trim, 'mt3608_trimmer', P(84, 21.5, 6.9));
  addP(cylY(0.0011, 0.0008, 16), mat.brass, 'mt3608_trimmer_screw', P(87.5, 21.5, 10.5));
  for (const X of [62, 86]) addP(box(0.0032, 0.0016, 0.0016), mat.smdTan, 'mt3608_cap', P(X, 12.5, 4.4));
  addP(box(0.026, 0.0016, 0.017), mat.pcbBlue, 'tp4056_pcb', P(80, 37.5, 2.8));
  for (const dx of [-11, 11]) addP(cylY(0.0012, 0.002, 12), mat.brass, 'tp4056_spacer', P(80 + dx, 37.5, 1));
  addP(box(0.006, 0.0028, 0.0076), mat.metal, 'tp4056_usb', P(91, 37.5, 5));
  addP(box(0.005, 0.0015, 0.004), mat.chip, 'tp4056_ic', P(78, 37.5, 4.3));
  addP(box(0.003, 0.0012, 0.003), mat.chip, 'tp4056_protect_ic', P(72, 41, 4.2));
  addP(box(0.0016, 0.0008, 0.0009), mat.smdRed, 'tp4056_led_charge', P(85, 32.5, 3.9));
  addP(box(0.0016, 0.0008, 0.0009), mat.wireB, 'tp4056_led_full', P(85, 42.5, 3.9));
  addP(box(0.01, 0.0016, 0.008), mat.pcbBlack, 'ams1117_pcb', P(63, 52, 2.8));
  addP(box(0.0065, 0.0016, 0.0035), mat.chip, 'ams1117_sot223', P(63, 51, 4.4));
  addP(box(0.003, 0.0006, 0.0018), mat.metal, 'ams1117_tab', P(63, 54, 3.9));
  wire(mat.wireR, 'wire_bat_pos', [P(hX, 2.5, 15), P(47, 6, 16), P(62, 30, 9), P(69, 33, 4)]);
  wire(mat.wireK, 'wire_bat_neg', [P(hX, 72.5, 15), P(49, 66, 13), P(64, 46, 8), P(69, 42, 4)]);
  wire(mat.wireR, 'wire_usb_tp4056', [P(86, 17.5, 21), P(90, 26, 14), P(93, 34, 6)]);
  wire(mat.wireR, 'wire_tp4056_switch', [P(70, 40, 4), P(70, 47, 12), P(74.4, 47.5, 17.5)]);
  wire(mat.wireR, 'wire_switch_mt3608', [P(74.4, 43.5, 17.5), P(62, 34, 15), P(58.5, 20, 5)]);
  wire(mat.wireR, 'wire_mt3608_ams1117', [P(92, 13, 4), P(94, 30, 10), P(88, 50, 9), P(68, 52, 4)]);
  wire(mat.wireR, 'wire_5v_perfboard', [P(59, 51, 4), P(55, 56, 16), P(55, 58, 28.5)]);

  // ---- LAYER 2 · perfboard 90 × 70 (Z 29) ----
  const pb = new THREE.Group(); pb.name = 'perfboard_assembly'; g.add(pb);
  if (split) pb.position.set(split, -IZ(29), 0);
  const pP = (X, Y, Z) => P(X, Y, Z);
  addP(box(0.09, 0.002, 0.07), mat.perf, 'perfboard', pP(47.5, 39, 30), pb);
  const pk = 20, pc = makeCanvas(90, 70, pk), p = pc.getContext('2d');
  p.fillStyle = '#3f7d55'; p.fillRect(0, 0, pc.width, pc.height);
  for (let X = 1.5; X < 90; X += 2.54) for (let Y = 1.5; Y < 70; Y += 2.54) {
    p.fillStyle = '#c9a25a'; p.beginPath(); p.arc(X * pk, Y * pk, 0.8 * pk, 0, Math.PI * 2); p.fill();
    p.fillStyle = '#2a3a2c'; p.beginPath(); p.arc(X * pk, Y * pk, 0.36 * pk, 0, Math.PI * 2); p.fill();
  }
  const cxy = (X, Y) => [X - 2.5, 74 - Y];
  const plab = (t, X, Y, sz, w = 600, c = '#ffffff') => { const [x, y] = cxy(X, Y); txt(p, pk, t, x, y, sz, w, c, 0, 'JetBrains Mono Variable, JetBrains Mono, monospace', 'left'); };
  const [bx0, by0] = cxy(4, 72); p.fillStyle = 'rgba(15,28,20,.88)'; p.fillRect(bx0 * pk, by0 * pk, 47 * pk, 24.5 * pk);
  plab('ZONA C · PERFBOARD 90×70', 5.5, 68.2, 1.9, 700, '#7fb6ff');
  ['I2C shared: OLED 0x3C + MPU-6050 0x68', 'GPIO2 → R1 1kΩ → BC547 Base', 'MPU-6050 INT → GPIO34', 'HX710B DT / SCK → GPIO4 / GPIO5', 'Buzzer → GPIO32']
    .forEach((s, i) => plab(s, 5.5, 64.2 - i * 3.1, 1.45));
  for (const [X, Y] of [[5, 6.5], [90, 6.5], [5, 71.5], [90, 71.5]]) { const [x, y] = cxy(X, Y); p.fillStyle = '#c9a25a'; p.beginPath(); p.arc(x * pk, y * pk, 2.4 * pk, 0, Math.PI * 2); p.fill(); p.fillStyle = '#1a1a1a'; p.beginPath(); p.arc(x * pk, y * pk, 1.6 * pk, 0, Math.PI * 2); p.fill(); }
  addP(new THREE.PlaneGeometry(0.09, 0.07).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ name: 'perfboard_print', map: canvasTex(pc), roughness: 0.8 }), 'perfboard_print', pP(47.5, 39, 31.02), pb);
  // ESP32 DevKit V1 52 × 28 on 8 mm low-profile headers
  const eX = 29, eY = 27;
  for (const sg of [-1, 1]) addP(box(0.048, 0.008, 0.0025), mat.chip, 'esp32_female_header', pP(eX, eY + sg * 11.5, 35), pb);
  addP(box(0.052, 0.0016, 0.028), mat.pcbBlack, 'esp32_pcb', pP(eX, eY, 39.8), pb);
  addP(box(0.018, 0.0032, 0.0175), mat.metal, 'esp32_wroom_shield', pP(42, eY, 42.2), pb);
  addP(box(0.0065, 0.0009, 0.018), mat.pcbBlack, 'esp32_antenna', pP(52.5, eY, 41), pb);
  addP(box(0.005, 0.0026, 0.0075), mat.metal, 'esp32_usb', pP(5, eY, 42), pb);
  addP(box(0.0065, 0.0016, 0.0035), mat.chip, 'esp32_ldo', pP(13, eY + 5, 41.4), pb);
  addP(box(0.004, 0.0012, 0.004), mat.chip, 'esp32_usb_uart', pP(20, eY - 2, 41.2), pb);
  for (const sg of [-1, 1]) addP(box(0.0035, 0.0016, 0.003), mat.chip, 'esp32_button', pP(9, eY + sg * 8, 41.4), pb);
  // HX710B 35 × 20
  addP(box(0.035, 0.0016, 0.02), mat.pcbGreen, 'hx710b_pcb', pP(74.5, 23, 36.8), pb);
  for (const X of [58.5, 90.5]) addP(box(0.0025, 0.005, 0.01), mat.chip, 'hx710b_header', pP(X, 23, 33.5), pb);
  addP(box(0.01, 0.0015, 0.004), mat.chip, 'hx710b_ic_sop16', pP(73, 23, 38.35), pb);
  for (const dx of [-1, 1]) addP(box(0.0032, 0.0016, 0.0016), mat.smdTan, 'hx710b_cap', pP(73 + dx * 9, 28, 38.4), pb);
  // MPU-6050 20 × 20
  addP(box(0.02, 0.0025, 0.0025), mat.chip, 'mpu6050_header', pP(67, 37.5, 32.25), pb);
  addP(box(0.02, 0.0016, 0.02), mat.pcbBlue, 'mpu6050_pcb', pP(67, 46, 34.3), pb);
  addP(box(0.004, 0.0009, 0.004), mat.chip, 'mpu6050_ic_qfn', pP(67.5, 47, 35.55), pb);
  addP(box(0.003, 0.0012, 0.0016), mat.chip, 'mpu6050_ldo', pP(61.5, 50, 35.7), pb);
  addP(box(0.0016, 0.0008, 0.0009), mat.smdRed, 'mpu6050_led', pP(61.5, 44, 35.5), pb);
  for (const sg of [-1, 1]) addP(cylY(0.0015, 0.0002, 20), mat.metal, 'mpu6050_mount_hole', pP(67 + sg * 7.5, 53.5, 35.2), pb);
  // BC547 TO-92 + R1 1kΩ
  const [bcx, , bcz] = pP(81, 40, 0);
  const dsh = new THREE.Shape(); dsh.absarc(0, 0, 0.0024, 0, Math.PI, false); dsh.lineTo(0.0024, 0);
  add(new THREE.ExtrudeGeometry(dsh, { depth: 0.0046, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2), mat.chip, 'bc547_to92', bcx, IZ(34), bcz + 0.0012, pb);
  for (const dx of [-0.00127, 0, 0.00127]) add(cylY(0.00022, 0.003, 8), mat.metal, 'bc547_leg', bcx + dx, IZ(32.5), bcz, pb);
  resistorY('r1_1k_base', pP(87, 40, 32), [mat.bandBrown, mat.wireK, mat.wireR, mat.brass], pb);
  resistorY('r2_4k7_sda', pP(81, 50, 32), [mat.wireY, mat.metal, mat.wireR, mat.brass], pb);
  resistorY('r3_4k7_scl', pP(85, 50, 32), [mat.wireY, mat.metal, mat.wireR, mat.brass], pb);
  // Buzzer Ø12 × 9
  addP(cylY(0.006, 0.009, 40), mat.chip, 'buzzer_body', pP(84, 64, 35.5), pb);
  addP(cylY(0.0012, 0.0002, 16), mat.dark, 'buzzer_port', pP(84, 64, 40.05), pb);
  addP(box(0.0014, 0.0002, 0.0004), mat.print, 'buzzer_plus', pP(80, 64, 40.05), pb);
  // header strips to front panel I/O
  addP(box(0.015, 0.0085, 0.0025), mat.chip, 'io_header', pP(65, 9, 35.25), pb);
  addP(box(0.0075, 0.0085, 0.0025), mat.chip, 'oled_header', pP(20, 9, 35.25), pb);

  // ---- stopcock ----
  if (stopcock) {
    const tipX = LX - 0.0099;
    add(cylX(0.005, 0.004, 32), mat.stopcock, 'male_luer_collar', tipX - 0.0012, ly, LZ);
    add(cylX(0.003, 0.006, 24), mat.stopcock, 'male_luer_body', tipX - 0.0062, ly, LZ);
    const C = [LX - 0.055, 0.0105, LZ + 0.016];
    const sc = new THREE.Group(); sc.name = 'stopcock_3way'; sc.position.set(...C); g.add(sc);
    add(cylY(0.0055, 0.011, 40), mat.stopcock, 'stopcock_body', 0, 0, 0, sc);
    add(cylZ(0.0032, 0.012, 32), mat.stopcock, 'stopcock_port_front', 0, 0, 0.0115, sc);
    add(cylZ(0.0048, 0.006, 32), mat.stopcock, 'stopcock_male_lock', 0, 0, 0.0185, sc);
    add(cylZ(0.002, 0.003, 20), mat.stopcock, 'stopcock_male_tip', 0, 0, 0.0225, sc);
    add(cylZ(0.0036, 0.012, 32), mat.stopcock, 'stopcock_port_back', 0, 0, -0.0115, sc);
    for (const sg of [-1, 1]) add(box(0.0016, 0.0014, 0.0028), mat.stopcock, 'stopcock_back_lug', sg * 0.0043, 0, -0.0162, sc);
    add(cylZ(0.0018, 0.0002, 20), mat.dark, 'stopcock_back_bore', 0, 0, -0.0176, sc);
    add(cylX(0.0032, 0.009, 32), mat.stopcock, 'stopcock_port_side', 0.0095, 0, 0, sc);
    add(cylX(0.0022, 0.003, 20), mat.stopcock, 'stopcock_side_barb', 0.0152, 0, 0, sc);
    add(cylY(0.0062, 0.0025, 40), mat.stopcock, 'stopcock_cap', 0, 0.00675, 0, sc);
    add(box(0.0042, 0.0038, 0.013), mat.stopcock, 'stopcock_lever_a', 0, 0.0099, 0.0062, sc);
    add(box(0.0042, 0.0038, 0.013), mat.stopcock, 'stopcock_lever_b', 0, 0.0099, -0.0062, sc);
    add(box(0.013, 0.0038, 0.0042), mat.stopcock, 'stopcock_lever_c', 0.0062, 0.0099, 0, sc);
    add(box(0.0012, 0.0004, 0.006), mat.wireB, 'stopcock_lever_arrow', 0, 0.0119, 0.007, sc);
    wire(mat.silicone, 'tube_luer_stopcock', [[tipX - 0.0092, ly, LZ], [LX - 0.023, ly - 0.004, LZ], [LX - 0.030, 0.011, LZ + 0.004], [LX - 0.034, 0.008, LZ + 0.012], [LX - 0.0385, C[1], C[2]], [C[0] + 0.0165, C[1], C[2]]], 0.0019);
  }

  // ---- rear panel M6 boss (X=50, Y=25 from top) — wall ≥3 mm locally ----
  const bY = fy(25);
  add(cylZ(0.009, 0.0015, 48), mat.shell, 'rear_m6_boss_external', 0, bY, -Z0 - 0.00075);
  add(cylZ(0.007, 0.001, 40), mat.shell, 'rear_m6_boss_internal', 0, bY, -Z0 + WALL + 0.0005);
  add(new THREE.CylinderGeometry(0.0058, 0.0058, 0.005, 6).rotateX(Math.PI / 2), mat.metal, 'm6_insert_nut', 0, bY, -Z0 + WALL + 0.0005);
  if (!mount) add(cylZ(0.0032, 0.0003, 32), mat.dark, 'm6_hole', 0, bY, -Z0 - 0.00155);

  // ---- EELIC PET-TYPEC C-clamp on rear panel ----
  if (mount) {
    const zp = -Z0 - 0.0015;                 // face of external boss
    const plate = rrPath(new THREE.Shape(), 0.05, 0.036, 0.004);
    add(new THREE.ExtrudeGeometry(plate, { depth: 0.004, bevelEnabled: false, curveSegments: 10 }), mat.shell, 'adapter_plate_rear', 0, bY, zp - 0.004);
    for (const sg of [-1, 1]) add(box(0.004, 0.036, 0.003), mat.shell, 'adapter_plate_rail', sg * 0.021, bY, zp - 0.0055);
    add(new THREE.CylinderGeometry(0.0052, 0.0052, 0.004, 6).rotateX(Math.PI / 2), mat.metal, 'm6_bolt_head', 0, bY + 0.011, zp - 0.006);
    const zh0 = zp - 0.004;                  // -0.0455
    add(box(0.03, 0.026, 0.0105), mat.clamp, 'clamp_head', 0, bY, zh0 - 0.00525);
    const zf = zh0 - 0.0105, bar = 0.006, gap = 0.047;
    const zIn0 = zf - bar, zIn1 = zIn0 - gap, zOut1 = zIn1 - bar;
    const zMid = (zf + zOut1) / 2;
    const cs = rrPath(new THREE.Shape(), 0.046, zf - zOut1, 0.006, 0, -zMid);
    cs.holes.push(rrPath(new THREE.Path(), 0.032, gap, 0.003, 0, -zMid));
    add(new THREE.ExtrudeGeometry(cs, { depth: 0.02, bevelEnabled: false, curveSegments: 12 }).rotateX(-Math.PI / 2), mat.clamp, 'clamp_c_frame', 0, bY - 0.01, 0);
    const R = 0.014, zc = zIn0 - 0.0016 - R;
    add(box(0.022, 0.016, 0.0016), mat.rubber, 'clamp_front_pad', 0, bY, zIn0 - 0.0008);
    add(cylY(R, 0.2, 64), mat.pole, 'iv_pole', 0, bY + 0.025, zc);
    const zs = zc - R - 0.0019;
    add(cylZ(0.0065, 0.0018, 32), mat.rubber, 'clamp_screw_pad', 0, bY, zs);
    add(cylZ(0.003, (zs - 0.0009) - (zOut1 - 0.008), 24), mat.metal, 'clamp_screw', 0, bY, ((zs - 0.0009) + (zOut1 - 0.008)) / 2);
    add(cylZ(0.009, 0.007, 14), mat.clamp, 'clamp_knob', 0, bY, zOut1 - 0.0115);
    g.userData.clamp = { zIn0, zIn1, zOut1, zc, R, bY };
  }

  return { group: g, glows };
}

// ---------- views ----------
const views = new Map();
function keepFramed(stage, fn) {
  views.set(stage, fn);
  let last = '';
  const run = (force) => {
    const w = stage.clientWidth, h = stage.clientHeight;
    const key = w + 'x' + h;
    if (!force && (key === last || w < 50 || h < 50)) return;
    last = key;
    fn();
  };
  run(true);
  new ResizeObserver(() => setTimeout(() => run(false), 0)).observe(stage);
  for (const t of [60, 300, 1000]) setTimeout(() => run(true), t);
}
// Fit camera so the object AND all annotation sprites/lines project inside the viewport (reserving top for the title tag).
function fitAll(stage, dir, groups, fov = 24, margin = 1.07, botPx = 0) {
  const cam = stage._camera;
  cam.fov = fov;
  const t = Math.tan((fov * Math.PI) / 360);
  const w = stage.clientWidth || 1, h = stage.clientHeight || 1, aspect = w / h;
  const topR = Math.min(0.35, 84 / h), botR = Math.min(0.3, botPx / h);
  const fwd = new THREE.Vector3(...dir).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
  const up = fwd.clone().cross(right).normalize();
  const pts = [];
  const addBox = (b) => { if (b.isEmpty()) return; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z)); };
  addBox(new THREE.Box3().setFromObject(stage._object));
  for (const g of groups) g.traverse((o) => {
    if (o.isSprite) {
      const p = o.getWorldPosition(new THREE.Vector3());
      for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) pts.push(p.clone().addScaledVector(right, sx * o.scale.x).addScaledVector(up, sy * o.scale.y));
    } else if (o.isMesh || o.isLine) addBox(new THREE.Box3().setFromObject(o));
  });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pts) { const x = p.dot(right), y = p.dot(up), z = p.dot(fwd); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const c = right.clone().multiplyScalar((x0 + x1) / 2).addScaledVector(up, (y0 + y1) / 2).addScaledVector(fwd, (z0 + z1) / 2);
  // shift target up so content sits below the reserved title band
  let d = 0;
  for (let iter = 0; iter < 2; iter++) {
    d = 0;
    for (const p of pts) {
      const q = p.clone().sub(c), x = q.dot(right) * margin, y = q.dot(up) * margin, z = q.dot(fwd);
      const needX = Math.abs(x) / (t * aspect);
      const needY = y > 0 ? y / (t * (1 - 2 * topR)) : -y / (t * (1 - 2 * botR));
      d = Math.max(d, z + Math.max(needX, needY));
    }
    if (iter === 0) c.addScaledVector(up, t * (topR - botR) * d * 0.5);
  }
  place(stage, dir, c, d);
}
function setView(stage, dir, scale, fov = 24) {
  const cam = stage._camera, ctr = stage._controls;
  cam.fov = fov;
  const bx = new THREE.Box3().setFromObject(stage._object);
  const sph = bx.getBoundingSphere(new THREE.Sphere());
  const aspect = (stage.clientWidth || 1) / (stage.clientHeight || 1);
  const dist = (sph.radius / Math.tan((fov * Math.PI) / 360)) * scale * Math.max(1, 1.45 / aspect);
  place(stage, dir, sph.center, dist);
}
function frame(stage, dir, center, halfW, halfH, fov = 24) {
  stage._camera.fov = fov;
  const t = Math.tan((fov * Math.PI) / 360);
  const aspect = (stage.clientWidth || 1) / (stage.clientHeight || 1);
  place(stage, dir, new THREE.Vector3(...center), Math.max(halfH / t, halfW / (t * aspect)));
}
function place(stage, dir, c, dist) {
  const cam = stage._camera, ctr = stage._controls;
  cam.position.copy(c).add(new THREE.Vector3(...dir).normalize().multiplyScalar(dist));
  cam.near = dist / 50; cam.far = dist * 50;
  cam.updateProjectionMatrix();
  ctr.target.copy(c);
  ctr.update();
}
function addGlows(stage, glows) {
  for (const gl of glows) {
    const s = glowSprite(gl.color, gl.size, gl.opacity);
    s.position.set(...gl.pos);
    stage._scene.add(s);
  }
}
function hideChrome(stage) {
  const r = stage.shadowRoot;
  r.querySelector('.toolbar') && (r.querySelector('.toolbar').style.display = 'none');
  r.querySelector('.note') && (r.querySelector('.note').style.display = 'none');
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const S = 0.0015;

{
  const st = stages.front;
  const { group, glows } = build({ lid: true, stopcock: true });
  st.setObject(group);
  addGlows(st, glows);
  const ann = new THREE.Group(); ann.name = 'dimensions';
  dimension(ann, V(-W / 2, 0.0004, Z0), V(W / 2, 0.0004, Z0), V(0, 0, 0.016), '100 mm', S);
  dimension(ann, V(-W / 2, 0.0004, Z0), V(-W / 2, 0.0004, -Z0), V(-0.024, 0, 0), '80 mm', S);
  dimension(ann, V(W / 2, 0, Z0), V(W / 2, H, Z0), V(0.014, 0, 0), '50 mm', S);
  const sx = -W / 2 - 0.055, sz = lzr(55) + 0.016;
  callout(ann, '3-WAY STOPCOCK', [sx, 0.024, sz], [sx - 0.004, 0.06, sz + 0.012], 0.0058);
  callout(ann, 'Laser 650nm', [-W / 2 - 0.0016, fy(25), lzr(15)], [-W / 2 - 0.04, 0.072, lzr(15) - 0.01], 0.0058);
  st._scene.add(ann);
  keepFramed(st, () => fitAll(st, [-0.62, 0.55, 1], [ann], 24, 1.05, 78));
}
{
  const st = stages.top;
  const SX = 0.135;
  const { group } = build({ lid: false, split: SX });
  st.setObject(group);
  st._ground.visible = false;
  const ann = new THREE.Group(); ann.name = 'annotations';
  const Q = (X, Y, Z) => [IX(X) + SX, IZ(Z) - IZ(29), IY(Y)];
  const fr = Z0 + 0.014, rr = -Z0 - 0.014, hy = 0.03, h = 0.0068;
  callout(ann, 'PTFE 0.22µm', P(12, 38, 26), [-0.058, hy, fr], h);
  callout(ann, '18650 · 3500mAh', P(35, 28, 20), [-0.012, hy, fr], h);
  callout(ann, 'MT3608', P(72, 17, 8), [0.032, hy, fr], h);
  callout(ann, 'MPS20N0040D', P(12, 64, 12), [-0.058, hy, rr], h);
  callout(ann, 'Laser 650nm', P(16, 62.5, 28.5), [-0.016, hy, rr], h);
  callout(ann, 'AMS1117', P(63, 52, 5.5), [0.024, hy, rr], h);
  callout(ann, 'TP4056', P(80, 37.5, 4), [0.071, hy, IY(37.5)], h);
  callout(ann, 'USB IN', P(91, 17.5, 25.5), [0.071, hy, IY(13)], h);
  callout(ann, 'ON/OFF', P(80, 47.5, 21.5), [0.071, hy, IY(60)], h);
  callout(ann, 'ESP32 DevKit V1', Q(29, 27, 44), [IX(29) + SX, hy, fr], h);
  callout(ann, 'HX710B', Q(76, 23, 38), [IX(80) + SX, hy, fr], h);
  callout(ann, 'MPU-6050\nIMU 6-axis', Q(67, 46, 36), [IX(56) + SX, hy, rr], h);
  callout(ann, 'BC547\nLaser Driver', Q(81, 40, 36.4), [IX(84) + SX, hy, rr], h);
  callout(ann, 'BUZZER', Q(84, 64, 40.2), [W / 2 + SX + 0.02, hy, IY(64)], h);
  const tag = (t, x) => { const s = spriteLabel(t, 0.0064, { bg: BLUE, border: BLUE, color: '#ffffff', font: '700 44px "JetBrains Mono Variable, JetBrains Mono, monospace"' }); s.position.set(x, hy, Z0 + 0.03); ann.add(s); };
  tag('LAYER 1 · LANTAI  Z 0–22', 0);
  tag('LAYER 2 · PERFBOARD  Z 29', IX(47.5) + SX);
  st._scene.add(ann);
  keepFramed(st, () => fitAll(st, [0, 1, 0.3], [ann], 24, 1.03));
  hideChrome(st);
}
{
  const st = stages.right;
  const { group, glows } = build({ lid: true });
  st.setObject(group);
  addGlows(st, glows);
  const dims = new THREE.Group();
  dimension(dims, V(W / 2, 0.0004, Z0), V(W / 2, 0.0004, -Z0), V(0.016, 0, 0), '80 mm', S);
  dimension(dims, V(W / 2, 0, -Z0), V(W / 2, H, -Z0), V(0, 0, -0.014), '50 mm', S);
  st._scene.add(dims);
  keepFramed(st, () => fitAll(st, [1, 0.36, 0.22], [dims]));
  hideChrome(st);
}
{
  const st = stages.rear;
  const { group } = build({ lid: true, stopcock: false, mount: true });
  st.setObject(group);
  st._ground.visible = false;
  const ann = new THREE.Group(); ann.name = 'annotations';
  const { zIn0, zIn1, zc, R, bY } = group.userData.clamp, h = 0.0105;
  callout(ann, 'IV POLE Ø28', [0.0, 0.11, zc - R], [0.0, 0.122, zc - R], h);
  callout(ann, 'ADAPTER PLATE\nBOSS M6 · X50 Y25', [0.022, bY - 0.016, -Z0 - 0.004], [0.0, -0.022, zc - R], h);
  callout(ann, 'EELIC PET-TYPEC\nC-clamp', [0.023, bY - 0.01, (zIn0 + zIn1) / 2], [0.0, -0.05, zc - R], h);
  dimension(ann, V(0.016, bY + 0.0105, zIn0), V(0.016, bY + 0.0105, zIn1), V(0, 0.012, 0), 'celah 47 mm', 0.0014);
  st._scene.add(ann);
  keepFramed(st, () => fitAll(st, [0.5, 0.28, -1], [ann], 24, 1.05));
  hideChrome(st);
}
