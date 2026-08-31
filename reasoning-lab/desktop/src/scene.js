import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CATEGORIES, MODEL_CATALOG, RELATIONS } from "./catalog.js";
import { buildDiffusionGrid, buildWaveform } from "./simulations.js";

const TAU = Math.PI * 2;

function colorFor(category) {
  return new THREE.Color(CATEGORIES[category]?.color ?? 0x9eaaa1);
}

function seededAngle(id) {
  let hash = 2166136261;
  for (const char of id) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967295) * TAU;
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false })
      || canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    if (!gl) return { supported: false, mode: "none" };
    const isWebGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
    return { supported: true, mode: isWebGL2 ? "WebGL2" : "WebGL1" };
  } catch {
    return { supported: false, mode: "none" };
  }
}

function disposeTree(root) {
  root.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

export class SceneController {
  constructor({ canvas, onSelect, onFallback, onMode }) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.onFallback = onFallback;
    this.onMode = onMode;
    this.nodes = new Map();
    this.nodePositions = new Map();
    this.visibleCategories = new Set(Object.keys(CATEGORIES));
    this.selectedId = null;
    this.motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.startedAt = performance.now();
    this.exhibit = null;
    this.disposed = false;

    const capability = supportsWebGL();
    if (!capability.supported) {
      this.onFallback?.("این دستگاه WebGL در دسترس ندارد؛ نقشهٔ دوبعدی فعال شد.");
      return;
    }

    try {
      this.initialize(capability.mode);
    } catch (error) {
      this.onFallback?.(`راه‌اندازی نمای سه‌بعدی شکست خورد: ${error.message}`);
    }
  }

  initialize(mode) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: mode === "WebGL2",
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mode === "WebGL2" ? 1.7 : 1.2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06100d, 0.0082);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);
    this.camera.position.set(0, 34, 86);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 145;
    this.controls.maxPolarAngle = Math.PI * 0.83;
    this.controls.autoRotate = this.motion;
    this.controls.autoRotateSpeed = 0.17;

    this.world = new THREE.Group();
    this.orbits = new THREE.Group();
    this.edgeLayer = new THREE.Group();
    this.nodeLayer = new THREE.Group();
    this.exhibitLayer = new THREE.Group();
    this.scene.add(this.world, this.orbits, this.edgeLayer, this.nodeLayer, this.exhibitLayer);

    this.scene.add(new THREE.AmbientLight(0x91a59c, 0.72));
    const key = new THREE.DirectionalLight(0xcaff66, 2.6);
    key.position.set(18, 44, 35);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x45dacc, 42, 140, 1.7);
    rim.position.set(-22, -9, -18);
    this.scene.add(rim);

    this.buildStars();
    this.buildCore();
    this.buildGraph();
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement);
    this.resize();
    this.onMode?.(mode);
    this.animate();
  }

  buildStars() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = 85 + ((index * 47) % 150);
      const angle = seededAngle(`star-${index}`);
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = (((index * 71) % 170) - 85) * 0.84;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x709083, size: 0.28, transparent: true, opacity: 0.48 });
    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);
  }

  buildCore() {
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(6.2, 2),
      new THREE.MeshStandardMaterial({
        color: 0x0c2018,
        emissive: 0x8ed528,
        emissiveIntensity: 1.35,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      }),
    );
    shell.name = "checkpoint-core";
    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(4.35, 3),
      new THREE.MeshPhysicalMaterial({
        color: 0x18281d,
        emissive: 0xb8f12b,
        emissiveIntensity: 0.85,
        roughness: 0.34,
        metalness: 0.62,
      }),
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(8.4, 0.07, 8, 160),
      new THREE.MeshBasicMaterial({ color: 0x7cead8, transparent: true, opacity: 0.6 }),
    );
    halo.rotation.x = Math.PI * 0.5;
    this.core = new THREE.Group();
    this.core.add(shell, inner, halo);
    this.world.add(this.core);
  }

  buildGraph() {
    const categoryCounts = {};
    MODEL_CATALOG.forEach((item) => {
      categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
    });
    const indices = {};

    Object.entries(CATEGORIES).forEach(([key, category], categoryIndex) => {
      const points = [];
      for (let segment = 0; segment <= 128; segment += 1) {
        const angle = (segment / 128) * TAU;
        points.push(new THREE.Vector3(
          Math.cos(angle) * category.orbit,
          Math.sin(angle * 2 + categoryIndex) * 0.55 + (categoryIndex - 3.5) * 0.6,
          Math.sin(angle) * category.orbit,
        ));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: category.color, transparent: true, opacity: 0.17 });
      const orbit = new THREE.Line(geometry, material);
      orbit.userData.category = key;
      this.orbits.add(orbit);
    });

    MODEL_CATALOG.forEach((item) => {
      const index = indices[item.category] ?? 0;
      indices[item.category] = index + 1;
      const count = categoryCounts[item.category];
      const category = CATEGORIES[item.category];
      const angle = (index / count) * TAU + seededAngle(item.id) * 0.08;
      const position = new THREE.Vector3(
        Math.cos(angle) * category.orbit,
        (index % 3 - 1) * 1.8 + Math.sin(angle * 3) * 1.2,
        Math.sin(angle) * category.orbit,
      );
      this.nodePositions.set(item.id, position);

      const group = new THREE.Group();
      group.position.copy(position);
      group.userData = { id: item.id, category: item.category, selectable: true };
      const baseColor = colorFor(item.category);
      const geometry = item.status === "source-backed"
        ? new THREE.OctahedronGeometry(item.params?.includes("671B") ? 1.5 : 1.02, 0)
        : new THREE.SphereGeometry(1, 10, 8);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        color: baseColor.clone().multiplyScalar(0.55),
        emissive: baseColor,
        emissiveIntensity: 0.34,
        roughness: 0.44,
        metalness: 0.68,
        wireframe: item.exhibit === "graph",
      }));
      mesh.userData = group.userData;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.52, 0.045, 5, 32),
        new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.55 }),
      );
      ring.rotation.x = Math.PI * 0.5;
      ring.visible = false;
      ring.userData.isSelectionRing = true;
      group.add(mesh, ring);
      this.nodes.set(item.id, group);
      this.nodeLayer.add(group);
    });

    for (const relation of RELATIONS) {
      const from = this.nodePositions.get(relation.from);
      const to = this.nodePositions.get(relation.to);
      if (!from || !to) continue;
      const midpoint = from.clone().lerp(to, 0.5);
      midpoint.y += Math.min(7, from.distanceTo(to) * 0.1);
      const curve = new THREE.QuadraticBezierCurve3(from, midpoint, to);
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(18));
      const material = new THREE.LineBasicMaterial({ color: 0x4e6b61, transparent: true, opacity: 0.13 });
      const line = new THREE.Line(geometry, material);
      line.userData = { from: relation.from, to: relation.to };
      this.edgeLayer.add(line);
    }
  }

  bindEvents() {
    this.handlePointer = (event) => {
      const bounds = this.canvas.getBoundingClientRect();
      this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.nodeLayer.children, true);
      const hit = hits.find((candidate) => candidate.object.userData?.id);
      if (hit) {
        this.select(hit.object.userData.id);
        this.onSelect?.(hit.object.userData.id, "pointer");
      }
    };
    this.canvas.addEventListener("pointerup", this.handlePointer);
    this.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.onFallback?.("بافت WebGL از دست رفت؛ نقشهٔ دوبعدی با همان انتخاب فعال شد.");
      this.dispose();
    }, { once: true });
  }

  select(id) {
    this.selectedId = id;
    for (const [nodeId, group] of this.nodes) {
      const selected = nodeId === id;
      group.scale.setScalar(selected ? 1.7 : 1);
      const ring = group.children.find((child) => child.userData.isSelectionRing);
      if (ring) ring.visible = selected;
    }
    this.edgeLayer.children.forEach((line) => {
      const related = line.userData.from === id || line.userData.to === id;
      line.material.opacity = related ? 0.72 : 0.07;
      line.material.color.setHex(related ? 0xb9f227 : 0x4e6b61);
    });
  }

  focus(id, immediate = false) {
    const target = this.nodePositions.get(id);
    if (!target || !this.camera) return;
    this.select(id);
    const destination = target.clone().add(new THREE.Vector3(0, 7, 17));
    if (immediate || !this.motion) {
      this.camera.position.copy(destination);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }
    this.cameraFlight = {
      started: performance.now(),
      duration: 850,
      fromPosition: this.camera.position.clone(),
      toPosition: destination,
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
    };
  }

  filter(category) {
    this.visibleCategories = category === "all"
      ? new Set(Object.keys(CATEGORIES))
      : new Set([category]);
    for (const group of this.nodes.values()) group.visible = this.visibleCategories.has(group.userData.category);
    this.orbits.children.forEach((orbit) => { orbit.visible = this.visibleCategories.has(orbit.userData.category); });
    this.edgeLayer.children.forEach((line) => {
      const from = this.nodes.get(line.userData.from);
      const to = this.nodes.get(line.userData.to);
      line.visible = Boolean(from?.visible && to?.visible);
    });
  }

  setMotion(enabled) {
    this.motion = Boolean(enabled);
    if (this.controls) this.controls.autoRotate = this.motion;
    if (this.stars) this.stars.visible = this.motion;
  }

  setExhibit(type = "graph") {
    if (!this.exhibitLayer) return;
    disposeTree(this.exhibitLayer);
    this.exhibitLayer.clear();
    this.agenticParts = null;
    this.researchParts = null;
    this.nodeLayer.visible = type === "graph";
    this.edgeLayer.visible = type === "graph";
    this.orbits.visible = type === "graph";
    this.core.visible = type === "graph";
    this.exhibit = type;
    if (type === "graph") return;
    const builders = {
      cpu: () => this.buildCpuExhibit(),
      moe: () => this.buildMoeExhibit(),
      diffusion: () => this.buildDiffusionExhibit(),
      video: () => this.buildVideoExhibit(),
      audio: () => this.buildAudioExhibit(),
      code: () => this.buildCodeExhibit(),
      agentic: () => this.buildAgenticExhibit(),
      research: () => this.buildResearchExhibit(),
      multimodal: () => this.buildMultimodalExhibit(),
    };
    (builders[type] ?? builders.multimodal)();
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 19, 48);
    this.controls.update();
  }

  buildCpuExhibit() {
    const weights = new THREE.Group();
    for (let index = 0; index < 96; index += 1) {
      const active = index % 17 === 0 || index % 23 === 0;
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.1, 1.1),
        new THREE.MeshStandardMaterial({
          color: active ? 0xb9f227 : 0x294037,
          emissive: active ? 0x7aa80f : 0x07100d,
          emissiveIntensity: active ? 0.7 : 0.05,
          metalness: 0.7,
          roughness: 0.45,
        }),
      );
      cube.position.set((index % 12 - 5.5) * 1.45, (Math.floor(index / 12) - 3.5) * 1.45, -8);
      cube.userData.pulse = active;
      weights.add(cube);
    }
    const cores = new THREE.Group();
    for (let index = 0; index < 16; index += 1) {
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.72, 1.9, 12),
        new THREE.MeshStandardMaterial({ color: 0x225c55, emissive: 0x32c6b6, emissiveIntensity: 0.28, metalness: 0.75 }),
      );
      cylinder.rotation.z = Math.PI * 0.5;
      cylinder.position.set((index % 8 - 3.5) * 2.1, (Math.floor(index / 8) - 0.5) * 2.3, 8);
      cores.add(cylinder);
    }
    const bus = new THREE.Mesh(
      new THREE.BoxGeometry(35, 0.18, 0.35),
      new THREE.MeshBasicMaterial({ color: 0x65e6d4 }),
    );
    this.exhibitLayer.add(weights, cores, bus);
  }

  buildMoeExhibit() {
    const router = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.4, 0),
      new THREE.MeshStandardMaterial({ color: 0xb9f227, emissive: 0x759500, emissiveIntensity: 0.7 }),
    );
    this.exhibitLayer.add(router);
    for (let index = 0; index < 24; index += 1) {
      const angle = (index / 24) * TAU;
      const selected = index === 3 || index === 11;
      const expert = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 4.2, 1.1),
        new THREE.MeshStandardMaterial({
          color: selected ? 0xb9f227 : 0x26382f,
          emissive: selected ? 0x759500 : 0x000000,
          emissiveIntensity: selected ? 0.7 : 0,
        }),
      );
      expert.position.set(Math.cos(angle) * 17, Math.sin(angle * 2) * 3, Math.sin(angle) * 17);
      expert.lookAt(0, 0, 0);
      expert.userData.pulse = selected;
      this.exhibitLayer.add(expert);
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), expert.position]);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: selected ? 0xc9ff36 : 0x29443b, transparent: true, opacity: selected ? 0.9 : 0.2 }));
      this.exhibitLayer.add(line);
    }
  }

  buildDiffusionExhibit() {
    for (let step = 0; step < 9; step += 1) {
      const grid = buildDiffusionGrid(step / 8, 20, 73);
      const data = new Uint8Array(grid.cells.length * 4);
      grid.cells.forEach((value, index) => {
        data[index * 4] = Math.round(value * 164);
        data[index * 4 + 1] = Math.round(value * 237);
        data[index * 4 + 2] = Math.round(34 + value * 75);
        data[index * 4 + 3] = 255;
      });
      const texture = new THREE.DataTexture(data, grid.size, grid.size, THREE.RGBAFormat);
      texture.needsUpdate = true;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(7, 7),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }),
      );
      plane.position.set((step - 4) * 5.1, Math.sin(step * 0.8) * 2, 0);
      plane.rotation.y = -0.18;
      this.exhibitLayer.add(plane);
    }
  }

  buildVideoExhibit() {
    for (let frame = 0; frame < 14; frame += 1) {
      const color = new THREE.Color().setHSL(0.47 + frame * 0.006, 0.72, 0.28 + frame * 0.018);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(12, 6.75, 12, 7),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.16, wireframe: frame % 3 !== 0, side: THREE.DoubleSide }),
      );
      plane.position.set((frame - 6.5) * 2.4, Math.sin(frame * 0.55) * 2, (frame - 6.5) * -0.8);
      plane.rotation.y = -0.38;
      this.exhibitLayer.add(plane);
    }
  }

  buildAudioExhibit() {
    const wave = buildWaveform(360, 5.2, 19).values;
    const points = wave.map((value, index) => {
      const x = (index / (wave.length - 1) - 0.5) * 42;
      const angle = (index / wave.length) * TAU * 4;
      return new THREE.Vector3(x, value * 6 + Math.sin(angle) * 0.5, Math.cos(angle) * 2);
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xd6a6ff }));
    this.exhibitLayer.add(line);
    for (let band = 0; band < 48; band += 1) {
      const height = 1 + Math.abs(wave[band * 7] ?? 0) * 10;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, height, 0.45),
        new THREE.MeshBasicMaterial({ color: band % 3 === 0 ? 0x8ff5e8 : 0x6d438d }),
      );
      bar.position.set((band - 23.5) * 0.85, -10 + height / 2, 3);
      this.exhibitLayer.add(bar);
    }
  }

  buildCodeExhibit() {
    const stages = [0x72a7ff, 0x72a7ff, 0x62d9ce, 0xb9f227, 0xb9f227];
    for (let stage = 0; stage < stages.length; stage += 1) {
      const gate = new THREE.Group();
      for (let row = 0; row < 5; row += 1) {
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(5.2 - row * 0.42, 0.56, 1.4),
          new THREE.MeshStandardMaterial({ color: stages[stage], emissive: stages[stage], emissiveIntensity: 0.16, metalness: 0.6 }),
        );
        block.position.y = (row - 2) * 1.15;
        gate.add(block);
      }
      gate.position.x = (stage - 2) * 9;
      gate.position.z = Math.sin(stage) * 2;
      this.exhibitLayer.add(gate);
    }
  }

  buildAgenticExhibit() {
    const harness = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(12.8, 0.32, 8, 96),
      new THREE.MeshStandardMaterial({ color: 0x27483c, emissive: 0x62d9ce, emissiveIntensity: 0.25, metalness: 0.7, roughness: 0.35 }),
    );
    outer.rotation.x = Math.PI * 0.5;
    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(4.1, 1),
      new THREE.MeshPhysicalMaterial({ color: 0x152419, emissive: 0xb9f227, emissiveIntensity: 0.48, wireframe: true, transparent: true, opacity: 0.9 }),
    );
    inner.userData.pulse = true;
    harness.add(outer, inner);

    const stations = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * TAU;
      const station = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.25, 0),
        new THREE.MeshStandardMaterial({ color: 0x254039, emissive: 0x18382f, emissiveIntensity: 0.18, metalness: 0.72 }),
      );
      station.position.set(Math.cos(angle) * 12.8, Math.sin(angle * 2) * 1.4, Math.sin(angle) * 12.8);
      harness.add(station);
      stations.push(station);
    }

    const contextRing = new THREE.Group();
    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * TAU;
      const trusted = index < 5;
      const cartridge = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.7, 0.7),
        new THREE.MeshStandardMaterial({ color: trusted ? 0xb9f227 : index < 12 ? 0x72a7ff : 0xf39a53, emissiveIntensity: 0.2, metalness: 0.55 }),
      );
      cartridge.position.set(Math.cos(angle) * 17.2, -5.4, Math.sin(angle) * 17.2);
      cartridge.lookAt(0, -5.4, 0);
      contextRing.add(cartridge);
    }

    const workers = [];
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * TAU + Math.PI * 0.25;
      const worker = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.35, 3.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x20433d, emissive: 0x62d9ce, emissiveIntensity: 0.2, metalness: 0.7 }),
      );
      worker.position.set(Math.cos(angle) * 22.5, 4.6, Math.sin(angle) * 22.5);
      workers.push(worker);
      this.exhibitLayer.add(worker);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), worker.position.clone()]),
        new THREE.LineBasicMaterial({ color: 0x3a6155, transparent: true, opacity: 0.34 }),
      );
      this.exhibitLayer.add(line);
    }

    const policyGate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 11, 12),
      new THREE.MeshStandardMaterial({ color: 0x665325, emissive: 0xffd166, emissiveIntensity: 0.35, transparent: true, opacity: 0.78, metalness: 0.5 }),
    );
    policyGate.position.set(20, 0, 0);
    const tool = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 5.6, 5.6),
      new THREE.MeshStandardMaterial({ color: 0x282f2d, emissive: 0x72a7ff, emissiveIntensity: 0.18, wireframe: true }),
    );
    tool.position.set(29, 0, 0);
    this.exhibitLayer.add(harness, contextRing, policyGate, tool);
    this.agenticParts = { harness, outer, inner, stations, contextRing, workers, policyGate, tool };
  }

  buildResearchExhibit() {
    const forge = new THREE.Group();
    const stageColors = [0x62d9ce, 0x72a7ff, 0xb9f227, 0xffd166, 0xf39a53, 0xd6a6ff, 0xff6b58];

    for (let index = 0; index < stageColors.length; index += 1) {
      const y = (index - 3) * 3.15;
      const radius = 5.1 + index * 0.34;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.18, 8, 72),
        new THREE.MeshStandardMaterial({
          color: stageColors[index],
          emissive: stageColors[index],
          emissiveIntensity: index === 2 ? 0.7 : 0.24,
          metalness: 0.72,
          roughness: 0.32,
        }),
      );
      ring.rotation.x = Math.PI * 0.5;
      ring.position.y = y;
      ring.rotation.z = index * 0.22;
      ring.userData.pulse = index === 2 || index === 5;
      forge.add(ring);

      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2 + index * 0.06, 2.2 + index * 0.06, 1.05, 10),
        new THREE.MeshStandardMaterial({
          color: 0x11231b,
          emissive: stageColors[index],
          emissiveIntensity: 0.12,
          metalness: 0.65,
        }),
      );
      core.position.y = y;
      forge.add(core);
    }

    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 23, 12),
      new THREE.MeshBasicMaterial({ color: 0xcafc4d, transparent: true, opacity: 0.72 }),
    );
    forge.add(spine);

    const assuranceColors = [0xb9f227, 0x62d9ce, 0xffd166, 0xd6a6ff];
    const assuranceRail = new THREE.Group();
    assuranceColors.forEach((color, index) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 22, 0.38),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.42, metalness: 0.62 }),
      );
      const angle = (index / assuranceColors.length) * TAU + Math.PI * 0.25;
      rail.position.set(Math.cos(angle) * 10.5, 0, Math.sin(angle) * 10.5);
      assuranceRail.add(rail);

      for (let checkpoint = 0; checkpoint < 4; checkpoint += 1) {
        const marker = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.72, 0),
          new THREE.MeshStandardMaterial({ color: 0x14251e, emissive: color, emissiveIntensity: checkpoint < 2 ? 0.65 : 0.16 }),
        );
        marker.position.set(Math.cos(angle) * 10.5, (checkpoint - 1.5) * 6.4, Math.sin(angle) * 10.5);
        marker.userData.pulse = checkpoint === index;
        assuranceRail.add(marker);
      }
    });

    const sourceStream = new THREE.Group();
    for (let index = 0; index < 48; index += 1) {
      const angle = index * 0.61;
      const radius = 15.5 - index * 0.16;
      const datum = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.45, 0.45),
        new THREE.MeshBasicMaterial({ color: index % 5 === 0 ? 0xb9f227 : 0x46786a }),
      );
      datum.position.set(Math.cos(angle) * radius, -11 + index * 0.46, Math.sin(angle) * radius);
      sourceStream.add(datum);
    }

    this.exhibitLayer.add(forge, assuranceRail, sourceStream);
    this.researchParts = { forge, assuranceRail, sourceStream };
  }

  applyAgenticFrame(frame = {}) {
    if (this.exhibit !== "agentic" || !this.agenticParts) return;
    const { stations, workers, policyGate, tool, contextRing } = this.agenticParts;
    const phases = ["lifecycle", "context", "model", "orchestration", "approval", "tool", "evaluation", "reliability"];
    const activeIndex = Math.max(0, phases.indexOf(frame.phase));
    stations.forEach((station, index) => {
      const active = index === activeIndex;
      station.material.color.setHex(active ? 0xb9f227 : 0x254039);
      station.material.emissive.setHex(active ? 0x789f18 : 0x18382f);
      station.material.emissiveIntensity = active ? 0.9 : 0.18;
      station.scale.setScalar(active ? 1.45 : 1);
    });
    workers.forEach((worker, index) => {
      const active = index < (frame.activeWorkers ?? 0) && frame.phase === "orchestration";
      worker.material.color.setHex(active ? 0xb9f227 : 0x20433d);
      worker.material.emissiveIntensity = active ? 0.85 : 0.2;
      worker.userData.pulse = active;
    });
    const gateColor = frame.blocked ? 0xff6b58 : frame.phase === "approval" ? 0xffd166 : 0x665325;
    policyGate.material.color.setHex(gateColor);
    policyGate.material.emissive.setHex(gateColor);
    policyGate.material.emissiveIntensity = frame.blocked || frame.phase === "approval" ? 0.75 : 0.2;
    tool.material.emissiveIntensity = frame.phase === "tool" ? 0.9 : 0.18;
    contextRing.rotation.y = (frame.progress ?? 0) * TAU;
  }

  buildMultimodalExhibit() {
    const forms = [
      new THREE.BoxGeometry(4, 4, 4),
      new THREE.SphereGeometry(2.5, 18, 12),
      new THREE.ConeGeometry(2.7, 5, 12),
      new THREE.TorusKnotGeometry(1.7, 0.48, 80, 10),
    ];
    forms.forEach((geometry, index) => {
      const angle = (index / forms.length) * TAU;
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: [0xf39a53, 0xd6a6ff, 0x72a7ff, 0xffd166][index], metalness: 0.5 }));
      mesh.position.set(Math.cos(angle) * 15, 0, Math.sin(angle) * 15);
      mesh.userData.pulse = true;
      this.exhibitLayer.add(mesh);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([mesh.position, new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
      );
      this.exhibitLayer.add(line);
    });
    const bridge = new THREE.Mesh(new THREE.IcosahedronGeometry(4.4, 1), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x806720, emissiveIntensity: 0.55, wireframe: true }));
    this.exhibitLayer.add(bridge);
  }

  showGraph() {
    this.setExhibit("graph");
    this.camera.position.set(0, 34, 86);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent.clientWidth);
    const height = Math.max(1, parent.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  animate = () => {
    if (this.disposed || !this.renderer) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const elapsed = (performance.now() - this.startedAt) / 1000;
    if (this.motion) {
      if (this.core?.visible) {
        this.core.rotation.y = elapsed * 0.12;
        this.core.rotation.x = Math.sin(elapsed * 0.2) * 0.08;
      }
      this.exhibitLayer?.children.forEach((child, index) => {
        if (child.userData.pulse) {
          const scale = 1 + Math.sin(elapsed * 2.2 + index) * 0.08;
          child.scale.setScalar(scale);
        }
      });
    }
    if (this.cameraFlight) {
      const t = Math.min(1, (performance.now() - this.cameraFlight.started) / this.cameraFlight.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(this.cameraFlight.fromPosition, this.cameraFlight.toPosition, eased);
      this.controls.target.lerpVectors(this.cameraFlight.fromTarget, this.cameraFlight.toTarget, eased);
      if (t >= 1) this.cameraFlight = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.canvas?.removeEventListener("pointerup", this.handlePointer);
    this.controls?.dispose();
    if (this.scene) disposeTree(this.scene);
    this.renderer?.dispose();
  }
}
