/* StratIQ — 3D hero
   Same model, same camera path and scroll choreography as the original hero.
   New: wireframe "ignition" intro, switchable lighting rigs, lighting that reacts
   slightly to the cursor (camera and model stay still), colour swap as the head
   turns, and an aura backdrop that follows the rig. Palette: Signature Orange,
   Obsidian Black, Soft White, Graphite, Steel Grey. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const $ = id => document.getElementById(id);
const preloader = $('preloader'), preCount = $('pre-count'), preBar = $('pre-bar'), preLabel = $('pre-label');
const heroTrack = $('hero-track'), heroCopy = $('hero-copy'), pivot = $('hero-pivot'), lightLab = $('light-lab');
const pivotWords = [...document.querySelectorAll('.pivot-word')], pivotSub = document.querySelector('.pivot-sub');
const stage = $('stage');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(pointer: coarse)').matches;

const clamp01 = v => Math.max(0, Math.min(1, v));
const eio = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eout = t => 1 - Math.pow(1 - t, 3);

/* ═════ Renderer / camera (original framing) ═════ */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
const CAM_HOME_POS = new THREE.Vector3(0.585, 161.799, -6.533);
const CAM_HOME_TARGET = new THREE.Vector3(157.343, 186.021, -71.865);
const CAM_T2_POS = new THREE.Vector3(-36.79, 162.534, 35.43);
const CAM_T2_TARGET = new THREE.Vector3(250.391, 199.09, 31.503);
const CAM_UP_POS = new THREE.Vector3(-36.79, 600, 35.43);
const CAM_UP_TARGET = new THREE.Vector3(250.391, 700, 31.503);
camera.position.copy(CAM_HOME_POS);
camera.lookAt(CAM_HOME_TARGET);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
$('canvas-wrap').appendChild(renderer.domElement);

// Portrait / narrow screens: widen the lens and bias the aim toward the head so it stays in frame.
let headBias = 0;
const headPoint = new THREE.Vector3();
function resize() {
    const a = innerWidth / innerHeight;
    camera.aspect = a;
    camera.fov = a < 0.8 ? 80 : a < 1.2 ? 78 : 75;
    headBias = a < 0.8 ? 0.62 : a < 1.2 ? 0.35 : a < 1.45 ? 0.12 : 0;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    sizeAura();
}

/* ═════ Lighting rigs ═════ */
const RIGS = {
    signal: { // orange key, soft-white rim
        ambient: [0x1a1412, 0.3], key: [0xf15b29, 17], rim: [0xf5f6f1, 6], top: [0xa7a8ac, 3], cursor: [0xff7a45, 3.5],
        orbit: 1.0, aura: [[241, 91, 41], [90, 34, 16], [167, 168, 172], [53, 54, 58]]
    },
    noir: { // restrained black and white
        ambient: [0x111214, 0.12], key: [0xf5f6f1, 20], rim: [0x35363a, 5], top: [0xffffff, 1.5], cursor: [0xf5f6f1, 3],
        orbit: 0.55, aura: [[90, 91, 96], [53, 54, 58], [200, 201, 204], [17, 18, 20]]
    },
    ember: { // soft-white key, hot orange rim
        ambient: [0x140c08, 0.25], key: [0xf5f6f1, 14], rim: [0xf15b29, 14], top: [0xff8a50, 4], cursor: [0xf15b29, 3.5],
        orbit: 1.6, aura: [[241, 91, 41], [120, 40, 14], [245, 246, 241], [53, 54, 58]]
    }
};

const ambient = new THREE.AmbientLight(0xffffff, 0);
const key = new THREE.DirectionalLight(0xffffff, 0); key.position.set(499.347, 25.54, -500);
const rim = new THREE.DirectionalLight(0xffffff, 0); rim.position.set(-300, 80, 300);
const top = new THREE.DirectionalLight(0xffffff, 0); top.position.set(0, 400, 100);
const cursorLight = new THREE.PointLight(0xffffff, 0, 0, 0);
scene.add(ambient, key, rim, top, cursorLight);

// live (lerped) rig state
const live = {
    ambient: new THREE.Color(), key: new THREE.Color(), rim: new THREE.Color(), top: new THREE.Color(), cursor: new THREE.Color(),
    ambientI: 0, keyI: 0, rimI: 0, topI: 0, cursorI: 0, orbit: 1, aura: RIGS.signal.aura.map(c => c.slice())
};
let rig = RIGS.signal;
(function snapRig() {
    live.ambient.set(rig.ambient[0]); live.key.set(rig.key[0]); live.rim.set(rig.rim[0]);
    live.top.set(rig.top[0]); live.cursor.set(rig.cursor[0]);
})();

function setRig(name) {
    if (!RIGS[name]) return;
    rig = RIGS[name];
    flash = 1; // brief exposure kick when switching
    document.querySelectorAll('.ll-btn').forEach(b => {
        const on = b.dataset.mode === name;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', on);
    });
}
document.querySelectorAll('.ll-btn').forEach(b => b.addEventListener('click', () => setRig(b.dataset.mode)));

/* ═════ Model + wireframe ignition ═════ */
const clipReveal = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0); // keeps geometry below the scan height
const wireMat = new THREE.MeshBasicMaterial({
    color: 0xf15b29, wireframe: true, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: [clipReveal]
});
const solidMats = [];
let model = null, bboxMin = 0, bboxMax = 400;
const modelCenter = new THREE.Vector3();

let loadPct = 0, shownPct = 0, loaded = false, introAt = -1;

new GLTFLoader().load('./models/DarkHumanoidV3.glb', gltf => {
    model = gltf.scene;
    model.rotation.y = Math.PI;
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    bboxMin = box.min.y; bboxMax = box.max.y;
    box.getCenter(modelCenter);
    headPoint.set(modelCenter.x, bboxMin + (bboxMax - bboxMin) * 0.86, modelCenter.z);

    const wires = [];
    model.traverse(child => {
        if (!child.isMesh) return;
        const m = new THREE.MeshStandardMaterial({
            color: 0x17171b, metalness: 1.0, roughness: 0.26,
            emissive: 0x000000, transparent: false
        });
        child.material = m;
        solidMats.push(m);
        const w = new (child.isSkinnedMesh ? THREE.SkinnedMesh : THREE.Mesh)(child.geometry, wireMat);
        if (child.isSkinnedMesh) w.bind(child.skeleton, child.bindMatrix);
        w.position.copy(child.position); w.quaternion.copy(child.quaternion); w.scale.copy(child.scale);
        wires.push([child.parent, w]);
    });
    wires.forEach(([p, w]) => p.add(w));
    loaded = true; loadPct = 100;
}, xhr => {
    loadPct = xhr.total > 0 ? Math.min(96, (xhr.loaded / xhr.total) * 96) : Math.min(loadPct + 1.5, 90);
}, err => {
    console.error(err); loaded = true; loadPct = 100;
});

const LABELS = ['Calibrating light', 'Loading geometry', 'Tracing wireframe', 'Warming the rig', 'Ready'];
function tickPreloader() {
    shownPct += (loadPct - shownPct) * 0.08;
    if (loaded && shownPct > 99.4) shownPct = 100;
    preCount.textContent = String(Math.round(shownPct)).padStart(2, '0');
    preBar.style.width = shownPct + '%';
    preLabel.textContent = LABELS[Math.min(4, Math.floor(shownPct / 20.01))];
    if (shownPct >= 100) { setTimeout(startIntro, 250); return; }
    requestAnimationFrame(tickPreloader);
}
tickPreloader();

function startIntro() {
    preloader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    introAt = performance.now();
    setTimeout(() => {
        document.body.classList.add('is-ready');
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, reduced ? 0 : 900);
}

// Ignition timeline (seconds from intro start)
const SCAN_DUR = 1.5, IGNITE_AT = 1.1, IGNITE_DUR = 1.8;
function flicker(t) {
    // fluorescent-tube style strike: two stutters, then settle
    if (t <= 0) return 0;
    if (t < 0.08) return 0.7;
    if (t < 0.16) return 0.05;
    if (t < 0.22) return 0.9;
    if (t < 0.34) return 0.15;
    return eout(clamp01((t - 0.34) / (IGNITE_DUR - 0.34)));
}

/* ═════ Input ═════ */
const mouse = new THREE.Vector2(0, 0), mouseS = new THREE.Vector2(0, 0);
window.addEventListener('pointermove', e => {
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
}, { passive: true });

/* ═════ Aura backdrop (2D) ═════ */
const aura = $('aura'), actx = aura.getContext('2d');
let AW = 0, AH = 0;
function sizeAura() {
    const s = 0.5; // half-res is plenty for soft light
    AW = aura.width = Math.round(innerWidth * s); AH = aura.height = Math.round(innerHeight * s);
}
const BEAMS = [
    { px: 0.78, py: 0.30, vx: -0.00004, vy: 0.00003, angle: 0.5, width: 0.55, c: 0, peak: 1.2 },
    { px: 0.95, py: 0.75, vx: -0.00003, vy: -0.00002, angle: 0.3, width: 0.40, c: 1, peak: 1.3 },
    { px: 0.60, py: 0.10, vx: 0.00003, vy: 0.00004, angle: 0.7, width: 0.30, c: 2, peak: 0.55 },
    { px: 0.15, py: 0.60, vx: 0.00004, vy: -0.00003, angle: 0.4, width: 0.60, c: 3, peak: 1.4 }
];
function drawAura(t, strength) {
    actx.globalCompositeOperation = 'source-over';
    actx.fillStyle = '#111214'; actx.fillRect(0, 0, AW, AH);
    actx.globalCompositeOperation = 'screen';
    BEAMS.forEach((b, i) => {
        b.px += b.vx; b.py += b.vy;
        if (b.px < -0.3 || b.px > 1.3) b.vx *= -1;
        if (b.py < -0.3 || b.py > 1.3) b.vy *= -1;
        const br = b.peak * strength * (0.55 + 0.45 * Math.sin(t * 0.3 + i * 1.7));
        const [r, g, bl] = live.aura[b.c].map(Math.round);
        const bw = b.width * Math.max(AW, AH), bh = Math.hypot(AW, AH);
        actx.save(); actx.translate(b.px * AW, b.py * AH); actx.rotate(b.angle);
        const gr = actx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
        gr.addColorStop(0, `rgba(${r},${g},${bl},0)`);
        gr.addColorStop(0.5, `rgba(${r},${g},${bl},${(br * 0.42).toFixed(3)})`);
        gr.addColorStop(1, `rgba(${r},${g},${bl},0)`);
        actx.fillStyle = gr; actx.fillRect(-bw / 2, -bh / 2, bw, bh); actx.restore();
    });
}

/* ═════ Loop ═════ */
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), tmp = new THREE.Vector3(), tmpC = new THREE.Color();
let elapsed = 0, flash = 0, heroVisible = true;

function heroProgress() {
    const dist = heroTrack.offsetHeight - innerHeight;
    return dist > 0 ? clamp01(window.scrollY / dist) : 0;
}

function lerpColor(c, hex, k) { tmpC.set(hex); c.lerp(tmpC, k); }

function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    const p = heroProgress();
    const trackEnd = heroTrack.offsetTop + heroTrack.offsetHeight;
    const nowVisible = window.scrollY < trackEnd + 50;
    if (nowVisible !== heroVisible) { heroVisible = nowVisible; stage.style.visibility = nowVisible ? 'visible' : 'hidden'; }
    if (!heroVisible) return; // nothing to draw under solid sections

    // scroll phases (same choreography as before: orbit, then rise)
    const raw01 = clamp01((p - 0.04) / 0.36), t01 = eio(raw01);
    const raw12 = clamp01((p - 0.55) / 0.45), t12 = eio(raw12);

    if (raw12 === 0) { camPos.lerpVectors(CAM_HOME_POS, CAM_T2_POS, t01); camTgt.lerpVectors(CAM_HOME_TARGET, CAM_T2_TARGET, t01); }
    else { camPos.lerpVectors(CAM_T2_POS, CAM_UP_POS, t12); camTgt.lerpVectors(CAM_T2_TARGET, CAM_UP_TARGET, t12); }

    // the cursor only moves the light; camera and model stay on their scroll path
    mouseS.lerp(mouse, isTouch ? 0 : 0.04);
    camera.position.copy(camPos);
    camera.lookAt(model ? tmp.copy(camTgt).lerp(headPoint, headBias * (1 - t12) * (1 - t01 * 0.4)) : camTgt);

    if (model) {
        model.rotation.y = THREE.MathUtils.lerp(Math.PI, Math.PI / 2, t01);
    }

    // ── Intro ignition ──
    let introK = 1, scanK = 1;
    if (introAt > 0 && !reduced) {
        const it = (performance.now() - introAt) / 1000;
        scanK = eio(clamp01(it / SCAN_DUR));
        introK = flicker(it - IGNITE_AT);
        const wireFade = clamp01((it - IGNITE_AT - 0.4) / 1.4);
        wireMat.opacity = (it < IGNITE_AT + 1.8 ? 0.55 : 0) * (1 - wireFade) * Math.min(1, it * 3);
        clipReveal.constant = THREE.MathUtils.lerp(bboxMin - 5, bboxMax + 5, scanK);
        solidMats.forEach(m => { m.visible = it > IGNITE_AT - 0.05; });
    } else if (introAt < 0) {
        introK = 0; wireMat.opacity = 0;
    } else { wireMat.opacity = 0; }

    // ── Rig blending ──
    const k = 1 - Math.pow(0.0015, dt); // ~frame-rate independent lerp
    // the key light drifts toward the rim colour as the head turns: a slow colour swap
    tmpC.set(rig.key[0]).lerp(new THREE.Color(rig.rim[0]), t01 * 0.55);
    live.key.lerp(tmpC, k);
    lerpColor(live.ambient, rig.ambient[0], k); lerpColor(live.rim, rig.rim[0], k);
    lerpColor(live.top, rig.top[0], k); lerpColor(live.cursor, rig.cursor[0], k);
    live.ambientI += (rig.ambient[1] - live.ambientI) * k;
    live.keyI += (rig.key[1] - live.keyI) * k;
    live.rimI += (rig.rim[1] - live.rimI) * k;
    live.topI += (rig.top[1] - live.topI) * k;
    live.cursorI += ((isTouch ? 0 : rig.cursor[1]) - live.cursorI) * k;
    live.orbit += (rig.orbit - live.orbit) * k;
    live.aura.forEach((c, i) => c.forEach((v, j) => { c[j] = v + (rig.aura[i][j] - v) * k; }));
    flash *= Math.pow(0.02, dt);

    const boost = 1 + flash * 0.9;
    ambient.color.copy(live.ambient); ambient.intensity = live.ambientI * introK;
    key.color.copy(live.key); key.intensity = live.keyI * introK * boost;
    rim.color.copy(live.rim); rim.intensity = live.rimI * clamp01(introK * 1.3 - 0.3) * boost;
    top.color.copy(live.top); top.intensity = live.topI * introK;

    // orbiting lights (same paths as the original, speed set by the rig)
    const s = elapsed * live.orbit;
    // the key light leans gently toward the cursor (a slight nudge, not a takeover)
    key.position.set(Math.sin(s * 0.7) * 600 + mouseS.x * 140, Math.cos(s * 0.5) * 400 + 100 + mouseS.y * 110, THREE.MathUtils.lerp(-500, 0, t01));
    rim.position.set(Math.cos(s * 0.6 + Math.PI) * 500, Math.sin(s * 0.4 + 1.2) * 300 + 80, 300 + Math.sin(elapsed * 0.3) * 100);
    top.position.set(Math.sin(s * 0.35) * 200, 350 + Math.cos(s * 0.28) * 120, 100 + Math.sin(s * 0.22) * 80);

    // cursor light: a soft glow between camera and head that tracks the pointer
    cursorLight.color.copy(live.cursor);
    cursorLight.intensity = live.cursorI * introK * (1 - raw12);
    tmp.set(mouseS.x, mouseS.y, 0.5).unproject(camera).sub(camera.position).normalize();
    const d = camera.position.distanceTo(modelCenter) * 0.55;
    cursorLight.position.copy(camera.position).addScaledVector(tmp, d);

    // ── DOM choreography ──
    const copyOut = clamp01(raw01 * 2.6);
    heroCopy.style.opacity = 1 - copyOut;
    heroCopy.style.transform = `translate3d(0, ${copyOut * -60}px, 0)`;
    heroCopy.style.pointerEvents = copyOut > 0.5 ? 'none' : '';
    pivotWords.forEach((w, i) => {
        const a = clamp01((raw01 - 0.32 - i * 0.16) / 0.22);
        const out = clamp01(raw12 * 3 - i * 0.25);
        const v = eout(a) * (1 - out);
        w.style.opacity = v;
        w.style.filter = `blur(${(1 - eout(a)) * 14 + out * 10}px)`;
        w.style.transform = `translate3d(${(1 - eout(a)) * -40 + out * -30}px, ${out * -40}px, 0)`;
    });
    if (pivotSub) pivotSub.style.opacity = clamp01((raw01 - 0.85) / 0.15) * (1 - clamp01(raw12 * 3));
    lightLab.style.opacity = document.body.classList.contains('is-ready') ? String(1 - clamp01((raw12 - 0.2) / 0.3)) : '';
    stage.style.opacity = String(1 - clamp01((raw12 - 0.75) / 0.25));

    drawAura(elapsed, (0.35 + 0.65 * introK) * (1 - raw12 * 0.6));
    renderer.render(scene, camera);
}

resize();
window.addEventListener('resize', resize);
loop();
