// Three.js viewer: scenes (backyard, studio, dusk), lighting, interior cutaway and AR export.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as TX from './textures.js';
import { buildStudio, setLampsOn } from './building.js';

const CDN = window.WS_CDN;
const SCENES = {
  yard: { hdri: 'park', env: 'sky', exposure: 1.0, sun: [6, 9, 7], sunColor: 0xfff1dc, sunI: 2.8, envI: 0.75, blur: 0.25, lamps: false, ground: 'grass', fence: true },
  studio: { hdri: 'studio', exposure: 1.05, sun: [5, 10, 6], sunColor: 0xffffff, sunI: 1.6, envI: 1.0, bg: 0xe9e5de, lamps: false, ground: 'shadow' },
  // Blue hour: the clear-sky HDRI turned well down reads as a deep blue sky; a low warm rim from
  // behind; the interior lamps carry the shot.
  dusk: { hdri: 'sky', exposure: 1.0, bgI: 0.22, sun: [-8, 2.2, -9], sunColor: 0xffa66b, sunI: 0.45, envI: 0.22, blur: 0.1, lamps: true, ground: 'grass', fence: true }
};

// Ambient occlusion, skipping glass and decals (they would otherwise darken what is behind them).
class AOPass extends GTAOPass {
  overrideVisibility() {
    super.overrideVisibility();
    this.scene.traverse(o => { if (o.userData.noAO) o.visible = false; });
  }
}
// Off by default: it halos thin trims and costs frame rate on phones. ?ao=1 to try it.
const AO_ON = /[?&]ao=1/.test(location.search);

export class Viewer {
  constructor(host) {
    this.host = host;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 400);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 3, maxDistance: 32, maxPolarAngle: Math.PI * 0.49, screenSpacePanning: false });
    this.controls.addEventListener('change', () => this.dirty = true);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 50 });
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.props = new THREE.Group(); this.scene.add(this.props);
    this.lampLights = new THREE.Group(); this.scene.add(this.lampLights);
    this.hdris = {};
    this.view = 'out';
    if (AO_ON) {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.ao = new AOPass(this.scene, this.camera, 1, 1);
      this.ao.blendIntensity = 0.85;
      this.ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 16 });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      this.composer.addPass(this.ao);
      this.composer.addPass(new OutputPass());
    }
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    const loop = () => { requestAnimationFrame(loop); if (this.controls.update() || this.dirty) { this.dirty = false; this.draw(); } };
    loop();
  }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    this.dirty = true;
  }
  draw() { if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); }
  async hdri(name) {
    if (!this.hdris[name]) this.hdris[name] = (async () => {
      const mod = await import(`${CDN.hdri}/${name}.exr.js`);
      const tex = await new EXRLoader().loadAsync(mod.default);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      return tex;
    })();
    return this.hdris[name];
  }
  async setScene(key) {
    const s = SCENES[key] || SCENES.yard; this.sceneKey = key;
    const bgTex = await this.hdri(s.hdri).catch(() => null);
    const env = s.env ? await this.hdri(s.env).catch(() => bgTex) : bgTex;
    this.scene.environment = env; this.scene.environmentIntensity = s.envI;
    if (s.bg) { this.scene.background = new THREE.Color(s.bg); }
    else { this.scene.background = bgTex; this.scene.backgroundBlurriness = s.blur; this.scene.backgroundIntensity = s.bgI ?? 1; }
    this.renderer.toneMappingExposure = s.exposure;
    this.sun.position.set(...s.sun); this.sun.color.set(s.sunColor); this.sun.intensity = s.sunI;
    this.props.clear();
    if (s.ground === 'grass') this.props.add(this.grassGround(key === 'dusk'));
    else { const p = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.22 })); p.rotation.x = -Math.PI / 2; p.receiveShadow = true; this.props.add(p); }
    if (s.fence && this.meta) this.props.add(this.fence());
    this.lampsOn = s.lamps; this.applyLamps();
    this.dirty = true;
  }
  grassGround(dark) {
    const set = TX.grass();
    const geo = new THREE.CircleGeometry(30, 64); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 40, 128, 128, 128);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(1, '#000');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    const alpha = new THREE.CanvasTexture(c);
    geo.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(geo.attributes.uv.count * 2).map((_, i) => {
      const k = i >> 1; return (i & 1 ? p.getZ(k) : p.getX(k)) / 60 + 0.5; }), 2));
    alpha.channel = 1;
    const m = new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughness: 1, alphaMap: alpha, transparent: true, depthWrite: false,
      color: dark ? 0x8f9a86 : 0xd8e0cc });
    const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; mesh.position.y = -0.002; mesh.renderOrder = -1; mesh.name = 'ground';
    return mesh;
  }
  fence() {
    const set = TX.fenceBoards(), g = new THREE.Group(); g.name = 'fence';
    const mat = new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, color: 0xd9cfc4 });
    const z = -this.meta.D / 2 - 2.6, len = 16, hgt = 1.83;
    const panel = new THREE.BoxGeometry(len, hgt, 0.03).toNonIndexed();
    panel.translate(0, hgt / 2, z);
    const p = panel.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getY(i); uv[i * 2 + 1] = p.getX(i); } // boards stand vertical
    panel.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); panel.computeVertexNormals();
    const m = new THREE.Mesh(panel, mat); m.receiveShadow = m.castShadow = true; g.add(m);
    for (let x = -len / 2; x <= len / 2 + 0.01; x += 2.44) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, hgt + 0.08, 0.09), new THREE.MeshStandardMaterial({ color: 0x6f5a48, roughness: 0.9 })); post.position.set(x, (hgt + 0.08) / 2, z + 0.06); post.castShadow = true; g.add(post);
    }
    return g;
  }
  setBuilding(st) {
    if (this.building) { this.scene.remove(this.building); }
    const { group, meta } = buildStudio(st);
    this.building = group; this.meta = meta; this.scene.add(group);
    if (!this.framed) { this.home(); this.framed = true; }
    if (SCENES[this.sceneKey]?.fence) { const f = this.props.getObjectByName('fence'); if (f) this.props.remove(f); this.props.add(this.fence()); }
    this.applyView(this.view); this.applyLamps(); this.dirty = true;
    return meta;
  }
  applyLamps() {
    this.lampLights.clear();
    if (!this.meta) return;
    setLampsOn(this.building, this.lampsOn);
    if (!this.lampsOn) { this.dirty = true; return; }
    const indoor = this.meta.lamps.filter(l => l.indoor);
    const per = indoor.length ? 7 / indoor.length : 0;
    for (const l of this.meta.lamps) {
      const pl = new THREE.PointLight(0xffc98a, l.indoor ? 2.2 * per + 1.5 : 6, l.indoor ? 6 : 4, 1.6);
      pl.position.copy(l.pos); if (l.indoor) pl.position.y -= 0.25;
      this.lampLights.add(pl);
    }
    this.dirty = true;
  }
  applyView(v) {
    this.view = v;
    if (!this.building) return;
    this.building.traverse(o => { if (o.userData.roof || o.userData.ceiling || o.userData.cut) o.visible = v !== 'in'; });
    this.dirty = true;
  }
  home() {
    const m = this.meta, d = Math.max(m.W, m.D);
    // Eye level from the lawn, so you can see in through the slider (mini split included).
    this.controls.target.set(0, 1.3, 0);
    this.camera.position.set(d * 0.95 + 4.2, 1.85, d * 1.25 + 6.5);
    this.dirty = true;
  }
  look(kind) {
    const m = this.meta, t = this.controls.target, cam = this.camera;
    if (kind === 'home') return this.home();
    if (kind === 'front') { t.set(0, 1.4, 0); cam.position.set(0, 1.55, m.D / 2 + 9); }
    if (kind === 'side') { t.set(0, 1.4, 0); cam.position.set(m.W / 2 + 9, 1.55, 0); }
    if (kind === 'inside') { t.set(0, 0.6, -0.3); cam.position.set(m.W * 0.35 + 1.2, 6.4 + m.D * 0.2, m.D * 1.1 + 4.6); }
    this.dirty = true;
  }
  async exportGLB() {
    const clone = this.building.clone(true);
    clone.traverse(o => { if (o.userData.roof || o.userData.ceiling || o.userData.cut) o.visible = true; if (o.userData.noExport) o.visible = false; });
    const data = await new GLTFExporter().parseAsync(clone, { binary: true, maxTextureSize: 1024, onlyVisible: true });
    return new Blob([data], { type: 'model/gltf-binary' });
  }
  snapshot() { this.draw(); return this.renderer.domElement.toDataURL('image/jpeg', 0.85); }
}
