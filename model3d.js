// Interactive 3D model viewer: <div class="model3d" data-model="models/bear.mesh"> becomes a
// drag-to-spin view (scroll to zoom, right-drag to pan). The mesh is a compact gzip file:
// header, varint deltas for quantized vertex positions and triangle indices, then one color index per triangle.
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const PALETTE = ['#C8805E', '#A0A0A0', '#4D2D20', '#391F19', '#F6C892'];

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
  return { pos, idx, col, n };
}

async function load(url) {
  const res = await fetch(url);
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  return decode(await new Response(stream).arrayBuffer());
}

function mount(el) {
  const { pos, idx, col, n } = el._mesh;
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo = geo.toNonIndexed();
  const colors = new Float32Array(n * 9);
  const pal = PALETTE.map(h => new THREE.Color(h));
  for (let t = 0; t < n; t++) { const c = pal[col[t]] || pal[0]; for (let v = 0; v < 3; v++) colors.set([c.r, c.g, c.b], t * 9 + v * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const box = geo.boundingBox, size = new THREE.Vector3(), center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  geo.translate(-center.x, -center.y, -center.z);
  const r = size.length() / 2;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, r / 50, r * 50);
  camera.position.set(r * 1.2, r * 0.6, r * 3.2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2a5a, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(r * 2, r * 3, r * 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xee8cff, 0.8); rim.position.set(-r * 3, r, -r * 3); scene.add(rim);
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 })));

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
