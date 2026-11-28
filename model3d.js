// Interactive 3D model viewer: <div class="model3d" data-model="models/bear.mesh"> becomes a
// drag-to-spin view (scroll to zoom, right-drag to pan). The mesh is a compact gzip file:
// header, varint deltas for quantized vertex positions and triangle indices, then one color index per triangle.
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

const PALETTE = ['#C8805E', '#A0A0A0', '#4D2D20', '#391F19', '#F6C892', '#2E2E33'];

export function decode(buf) {
  const dv = new DataView(buf);
  const k = dv.getUint32(0, true), n = dv.getUint32(4, true), B = dv.getUint32(8, true);
  const mn = [dv.getFloat32(12, true), dv.getFloat32(16, true), dv.getFloat32(20, true)];
  const sc = dv.getFloat32(24, true) / ((1 << B) - 1);
  const bytes = new Uint8Array(buf);
  let o = 28;
  const next = () => {
    let x = 0, s = 0, b;
    do { b = bytes[o++]; x += (b & 127) * 2 ** s; s += 7; } while (b & 128);
    return (x % 2) ? -(x + 1) / 2 : x / 2;
  };
  const pos = new Float32Array(k * 3);
  for (let c = 0; c < 3; c++) { let v = 0; for (let i = 0; i < k; i++) { v += next(); pos[i * 3 + c] = mn[c] + v * sc; } }
  const idx = new Uint32Array(n * 3);
  { let v = 0; for (let i = 0; i < n * 3; i++) { v += next(); idx[i] = v; } }
  const col = bytes.subarray(o, o + n);
  // Optional: one part number per triangle, for models with moving parts.
  const grp = bytes.length >= o + 2 * n ? bytes.subarray(o + n, o + 2 * n) : null;
  return { pos, idx, col, n, grp };
}

async function load(url) {
  const res = await fetch(url);
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  return decode(await new Response(stream).arrayBuffer());
}

// Moving parts. Each triangle belongs to a part (one byte per triangle after the colors), and data-rig
// says how the parts move as the slider under the viewer goes from 0 to 1. Two kinds:
// - Exploded view (the headphones): data-rig.explode gives each part [dx, dy, dz, t0, t1]; the part slides
//   out by that much during its own stretch [t0, t1] of the slider, so the parts come apart one after
//   another in the order you'd take it apart, and go back together in reverse.
// - Linkage (the claw): parts 0 fixed, 1 the sliding carriage, 2-4 the three finger
// arms, 5-7 the three side links. data-rig holds where the joints are (in model units, around the
// center axis O) and a table of [arm angle in degrees, carriage drop, link angle in degrees] from open to
// closed, worked out from the linkage in the CAD model. A slider under the viewer drives it.
// The bottom triangle (and the carriage and guide rods it's joined to) stays still; as the claw closes,
// the frame and side links rise relative to it.
function setupRig(el, geo, grp, n, rig, root, mat) {
  const parts = [];
  for (let g = 0; g < 8; g++) {
    const tris = [];
    for (let t = 0; t < n; t++) if (grp[t] === g) tris.push(t);
    if (!tris.length) continue;
    const sub = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'color']) {
      const src = geo.getAttribute(name).array, a = new Float32Array(tris.length * 9);
      tris.forEach((t, i) => a.set(src.subarray(t * 9, t * 9 + 9), i * 9));
      sub.setAttribute(name, new THREE.BufferAttribute(a, 3));
    }
    const m = new THREE.Mesh(sub, mat);
    m.matrixAutoUpdate = false; m.frustumCulled = false;
    root.add(m); parts.push([g, m]);
  }
  const rad = Math.PI / 180, tab = rig.table || [];
  const T = new THREE.Matrix4(), R = new THREE.Matrix4(), B = new THREE.Matrix4(), lift = new THREE.Matrix4(), axis = new THREE.Vector3();
  const linkage = s => {
    const x = s * (tab.length - 1), i = Math.min(tab.length - 2, Math.floor(x)), w = x - i;
    const [th, d, ph] = [0, 1, 2].map(j => tab[i][j] * (1 - w) + tab[i + 1][j] * w);
    lift.makeTranslation(0, 0, -d);
    for (const [g, m] of parts) {
      if (g === 0) m.matrix.identity();
      else if (g === 1) m.matrix.makeTranslation(0, 0, d);
      else {
        // Arms swing about their pin on the carriage (and ride down with it); links swing about their pin on the base.
        const arm = g < 5, a = rig.angles[(g - 2) % 3] * rad, ux = Math.cos(a), uy = Math.sin(a);
        const [pr, pz] = arm ? rig.p22 : rig.p26;
        const px = rig.O[0] + ux * pr, py = rig.O[1] + uy * pr;
        R.makeRotationAxis(axis.set(uy, -ux, 0), (arm ? th : ph) * rad);
        T.makeTranslation(px, py, pz + (arm ? d : 0)); B.makeTranslation(-px, -py, -pz);
        m.matrix.multiplyMatrices(T, R).multiply(B);
      }
      m.matrix.premultiply(lift);
      m.matrixWorldNeedsUpdate = true;
    }
  };
  const explode = s => {
    const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
    const [sx, sy, sz] = rig.shift || [0, 0, 0];
    for (const [g, m] of parts) {
      const [dx = 0, dy = 0, dz = 0, t0 = 0, t1 = 1] = rig.explode[g] || [];
      const k = ease((s - t0) / ((t1 - t0) || 1));
      // shift keeps the whole set centred in the view as it spreads out
      m.matrix.makeTranslation(dx * k + sx * s, dy * k + sy * s, dz * k + sz * s);
      m.matrixWorldNeedsUpdate = true;
    }
  };
  const pose = rig.explode ? explode : linkage;
  pose(0);

  // Slider plus a button that plays the motion to the other end.
  const [lo, hi] = rig.labels || ['Open', 'Closed'];
  const [toHi, toLo] = rig.actions || ['Close', 'Open'];
  const bar = document.createElement('div');
  bar.className = 'model3d-slider';
  bar.innerHTML = '<span></span><input type="range" min="0" max="1" step="0.005" value="0"><span></span><button type="button" class="btn model3d-play"></button>';
  const [loEl, input, hiEl, play] = bar.children;
  loEl.textContent = lo; hiEl.textContent = hi;
  input.setAttribute('aria-label', rig.aria || 'Open or close the claw');
  const sync = () => { play.textContent = +input.value < 0.5 ? toHi : toLo; };
  let anim = 0;
  input.addEventListener('input', () => { cancelAnimationFrame(anim); pose(+input.value); sync(); });
  play.addEventListener('click', () => {
    cancelAnimationFrame(anim);
    const from = +input.value, to = from < 0.5 ? 1 : 0, dur = (rig.explode ? 2600 : 1400) * Math.abs(to - from), t0 = performance.now();
    const step = now => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      input.value = from + (to - from) * k; pose(+input.value);
      if (k < 1) anim = requestAnimationFrame(step); else sync();
    };
    play.textContent = to ? toLo : toHi;
    anim = requestAnimationFrame(step);
  });
  sync();
  el.after(bar);
}

function mount(el) {
  const { pos, idx, col, n, grp } = el._mesh;
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo = geo.toNonIndexed();
  const colors = new Float32Array(n * 9);
  const pal = (el.dataset.colors ? el.dataset.colors.split(',') : PALETTE).map(h => new THREE.Color(h.trim()));
  for (let t = 0; t < n; t++) { const c = pal[col[t]] || pal[0]; for (let v = 0; v < 3; v++) colors.set([c.r, c.g, c.b], t * 9 + v * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // The model is stored Z-up: turn it Y-up and center it.
  geo.computeBoundingBox();
  const box = geo.boundingBox, size = new THREE.Vector3(), center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  const r = size.length() / 2;
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  root.position.set(-center.x, -center.z, center.y);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, r / 50, r * 50);
  camera.position.set(r * 1.2, r * 0.6, r * 3.2);
  // Lighting: a soft studio environment for even, neutral fill, plus a key and a fill light that ride
  // along with the camera so the side facing you is always well lit as the model spins.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2ff, 0.35));
  scene.add(camera);
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(r * 1.5, r * 2, r * 0.5); camera.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-r * 2, -r * 0.5, r * 0.5); camera.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(-r * 3, r * 2, -r * 3); scene.add(rim);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, envMapIntensity: 0.6 });
  const rig = el.dataset.rig && grp ? JSON.parse(el.dataset.rig) : null;
  if (rig) setupRig(el, geo, grp, n, rig, root, mat); else root.add(new THREE.Mesh(geo, mat));
  scene.add(root);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.6;
  controls.minDistance = r * 1.2; controls.maxDistance = r * 8;
  controls.addEventListener('start', () => { controls.autoRotate = false; el.classList.add('touched'); });

  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(el); resize();
  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(el);
  renderer.setAnimationLoop(() => { if (!visible) return; controls.update(); renderer.render(scene, camera); });
  el.classList.add('ready');
}

document.querySelectorAll('.model3d[data-model]').forEach(el => {
  let started = false;
  const start = async () => {
    if (started) return; started = true;
    try { el._mesh = await load(el.dataset.model); mount(el); }
    catch (e) { el.classList.add('failed'); console.error(e); }
  };
  new IntersectionObserver(es => { if (es[0].isIntersecting) start(); }).observe(el);
});
