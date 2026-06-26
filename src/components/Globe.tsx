import { useEffect, useRef, useState } from "react";

interface Location {
  lat: number;
  lng: number;
  label: string;
  href?: string;
}

interface Props {
  locations: Location[];
}

const SPHERE_R = 5;
const DEG = Math.PI / 180;

// Coarse grid for land lookup — 2° resolution, built with geoContains
const GRID_W = 180; // 2° per cell
const GRID_H = 90;

// Warm-gray line / dot palette tuned for a light (#fafaf9) page background,
// echoing anthropic.com's airy line-art globe.
const C_GRATICULE = "#cfc9bd";
const C_OUTLINE   = "#a8a094";
const C_LANDDOT   = "#d6cfc1";
const C_ACCENT    = "#d97706"; // --color-accent

/** lat/lng (degrees) → point on a sphere of radius r. Single convention used
 *  for every feature so dots, outlines, graticule and pins all stay aligned. */
function llToVec3(THREE: typeof import("three"), lat: number, lng: number, r: number) {
  const latR = lat * DEG;
  const lngR = lng * DEG;
  const cl = Math.cos(latR);
  return new THREE.Vector3(r * cl * Math.cos(lngR), r * Math.sin(latR), r * cl * Math.sin(lngR));
}

/** Flatten an array of polylines ([lng,lat] coords) into a flat
 *  position array of consecutive segment pairs for THREE.LineSegments. */
function polylinesToSegments(
  THREE: typeof import("three"),
  lines: [number, number][][],
  r: number,
): number[] {
  const out: number[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = llToVec3(THREE, line[i][1], line[i][0], r);
      const b = llToVec3(THREE, line[i + 1][1], line[i + 1][0], r);
      out.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  return out;
}

export default function Globe({ locations }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef   = useRef(true);
  const disposeRef   = useRef<(() => void) | undefined>(undefined);
  const isHoveredRef = useRef(false);
  const [isHovered, setIsHovered]  = useState(false);

  useEffect(() => { isHoveredRef.current = isHovered; }, [isHovered]);

  useEffect(() => {
    mountedRef.current = true;
    const container = containerRef.current!;

    async function init() {
      // ── 1. Load three + a countries topology (borders + coastlines) ────────
      const [THREE, topoData, topojsonClient, d3geo] = await Promise.all([
        import("three"),
        fetch("https://unpkg.com/world-atlas@2/countries-110m.json").then(r => r.json()),
        import("topojson-client"),
        import("d3-geo"),
      ]);

      if (!mountedRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const countries = (topoData as any).objects.countries;
      const landFC = topojsonClient.feature(topoData, countries); // FeatureCollection
      // Borders + coastlines as a single MultiLineString
      const borders = topojsonClient.mesh(topoData, countries);

      // ── 2. Pre-compute a 2° land grid for the faint dot stipple ────────────
      const grid = new Uint8Array(GRID_W * GRID_H);
      for (let row = 0; row < GRID_H; row++) {
        for (let col = 0; col < GRID_W; col++) {
          const lat = 90 - row * 2 - 1; // centre of 2° cell
          const lng = -180 + col * 2 + 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (d3geo.geoContains(landFC as any, [lng, lat])) {
            grid[row * GRID_W + col] = 1;
          }
        }
      }

      if (!mountedRef.current) return;

      // ── 3. Three.js scene ──────────────────────────────────────────────────
      const w = Math.min(container.offsetWidth || 500, window.innerWidth - 32);

      const scene    = new THREE.Scene();
      const camera   = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
      camera.position.z = 14.5;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, w);
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      if (!mountedRef.current) {
        renderer.dispose();
        container.removeChild(renderer.domElement);
        return;
      }

      const globe = new THREE.Group();
      // Bring the Americas roughly to the front on first paint.
      globe.rotation.y = THREE.MathUtils.degToRad(170);
      scene.add(globe);

      // Track every disposable so cleanup is exhaustive.
      const geos: { dispose(): void }[] = [];
      const mats: { dispose(): void }[] = [];
      const textures: { dispose(): void }[] = [];

      // ── 4. Depth-only occluder sphere ──────────────────────────────────────
      // Writes depth but no color, so the page background shows through the
      // globe's "fill" while features on the far hemisphere are hidden — giving
      // the clean front-only line-art look without color-matching the page.
      const occGeo = new THREE.SphereGeometry(SPHERE_R, 64, 64);
      const occMat = new THREE.MeshBasicMaterial({ colorWrite: false });
      const occluder = new THREE.Mesh(occGeo, occMat);
      occluder.renderOrder = -1; // lay down depth before the transparent lines
      globe.add(occluder);
      geos.push(occGeo); mats.push(occMat);

      // ── 5. Graticule (lat/lng grid) ────────────────────────────────────────
      const gratLines: [number, number][][] = [];
      for (let lat = -75; lat <= 75; lat += 15) {
        const ring: [number, number][] = [];
        for (let lng = -180; lng <= 180; lng += 3) ring.push([lng, lat]);
        gratLines.push(ring);
      }
      for (let lng = -180; lng < 180; lng += 15) {
        const meridian: [number, number][] = [];
        for (let lat = -90; lat <= 90; lat += 3) meridian.push([lng, lat]);
        gratLines.push(meridian);
      }
      const gratGeo = new THREE.BufferGeometry();
      gratGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(polylinesToSegments(THREE, gratLines, SPHERE_R * 1.001), 3),
      );
      const gratMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(C_GRATICULE), transparent: true, opacity: 0.55,
      });
      globe.add(new THREE.LineSegments(gratGeo, gratMat));
      geos.push(gratGeo); mats.push(gratMat);

      // ── 6. Country / coastline outlines ────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const borderLines = (borders.coordinates as [number, number][][]);
      const outlineGeo = new THREE.BufferGeometry();
      outlineGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(polylinesToSegments(THREE, borderLines, SPHERE_R * 1.002), 3),
      );
      const outlineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(C_OUTLINE), transparent: true, opacity: 0.85,
      });
      globe.add(new THREE.LineSegments(outlineGeo, outlineMat));
      geos.push(outlineGeo); mats.push(outlineMat);

      // ── 7. Faint land-dot stipple ──────────────────────────────────────────
      const landPos: number[] = [];
      for (let row = 0; row < GRID_H; row++) {
        for (let col = 0; col < GRID_W; col++) {
          if (!grid[row * GRID_W + col]) continue;
          const lat = 90 - row * 2 - 1;
          const lng = -180 + col * 2 + 1;
          const p = llToVec3(THREE, lat, lng, SPHERE_R * 1.0015);
          landPos.push(p.x, p.y, p.z);
        }
      }
      const landGeo = new THREE.BufferGeometry();
      landGeo.setAttribute("position", new THREE.Float32BufferAttribute(landPos, 3));
      const landMat = new THREE.PointsMaterial({
        color: new THREE.Color(C_LANDDOT),
        size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.55,
      });
      globe.add(new THREE.Points(landGeo, landMat));
      geos.push(landGeo); mats.push(landMat);

      // ── 8. Visited-location amber clusters ─────────────────────────────────
      // Soft radial glow texture reused by every location sprite.
      const glowCanvas = document.createElement("canvas");
      glowCanvas.width = glowCanvas.height = 64;
      const gctx = glowCanvas.getContext("2d")!;
      const grad = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0,   "rgba(217,119,6,0.9)");
      grad.addColorStop(0.4, "rgba(217,119,6,0.35)");
      grad.addColorStop(1,   "rgba(217,119,6,0)");
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 64, 64);
      const glowTex = new THREE.CanvasTexture(glowCanvas);
      textures.push(glowTex);

      const dotGeo = new THREE.SphereGeometry(0.07, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: C_ACCENT });
      // Halo disc — laid tangent on the surface so it follows curvature and is
      // never clipped by the occluder sphere the way a flat billboard would be.
      const haloGeo = new THREE.CircleGeometry(0.45, 32);
      geos.push(dotGeo, haloGeo); mats.push(dotMat);

      // Meshes a click/hover can land on, each tagged with its post URL.
      const pickables: import("three").Object3D[] = [];

      for (const loc of locations) {
        const dir = llToVec3(THREE, loc.lat, loc.lng, 1); // unit direction

        // Bright centre dot
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(dir.clone().multiplyScalar(SPHERE_R * 1.012));
        dot.userData.href = loc.href;
        globe.add(dot);
        if (loc.href) pickables.push(dot);

        // Soft amber halo, tangent to the surface
        const glowMat = new THREE.MeshBasicMaterial({
          map: glowTex, transparent: true, opacity: 0.8, depthWrite: false,
        });
        const halo = new THREE.Mesh(haloGeo, glowMat);
        halo.position.copy(dir.clone().multiplyScalar(SPHERE_R * 1.004));
        halo.lookAt(dir.clone().multiplyScalar(SPHERE_R * 2));
        halo.userData.href = loc.href;
        globe.add(halo);
        mats.push(glowMat);
        if (loc.href) pickables.push(halo);
      }

      // ── 9. Controls ────────────────────────────────────────────────────────
      const { OrbitControls } = await import(
        // @ts-expect-error — three examples types
        "three/examples/jsm/controls/OrbitControls.js"
      );
      if (!mountedRef.current) { renderer.dispose(); return; }

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableZoom      = false;
      controls.enablePan       = false;
      controls.autoRotate      = true;
      controls.autoRotateSpeed = 0.5;
      controls.enableDamping   = true;
      controls.dampingFactor   = 0.05;
      controls.minPolarAngle   = Math.PI * 0.15;
      controls.maxPolarAngle   = Math.PI * 0.85;

      // ── 10. Resize ─────────────────────────────────────────────────────────
      function onResize() {
        const sz = Math.min(container.offsetWidth || 500, window.innerWidth - 32);
        renderer.setSize(sz, sz);
      }
      window.addEventListener("resize", onResize);

      // ── 11. Click / hover a location → navigate to its post ────────────────
      const raycaster = new THREE.Raycaster();
      const pointer   = new THREE.Vector2();
      const canvas    = renderer.domElement;
      let downX = 0, downY = 0;

      function setPointer(e: PointerEvent | MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      }
      function pick(): string | undefined {
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(pickables, false);
        return hits.length ? (hits[0].object.userData.href as string) : undefined;
      }
      function onPointerDown(e: PointerEvent) { downX = e.clientX; downY = e.clientY; }
      function onClick(e: MouseEvent) {
        // Ignore clicks that were really drag-to-rotate gestures.
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
        setPointer(e);
        const href = pick();
        if (href) window.location.href = href;
      }
      function onPointerMove(e: PointerEvent) {
        setPointer(e);
        canvas.style.cursor = pick() ? "pointer" : "";
      }
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("pointermove", onPointerMove);

      // ── 12. Render loop ────────────────────────────────────────────────────
      let rafId = 0;
      function animate() {
        rafId = requestAnimationFrame(animate);
        controls.autoRotate = !isHoveredRef.current;
        controls.update();
        renderer.render(scene, camera);
      }
      animate();

      disposeRef.current = () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", onResize);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("click", onClick);
        canvas.removeEventListener("pointermove", onPointerMove);
        controls.dispose();
        geos.forEach(g => g.dispose());
        mats.forEach(m => m.dispose());
        textures.forEach(t => t.dispose());
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    }

    // Defer past first paint so the page doesn't freeze on load
    const timerId = setTimeout(() => {
      init().catch(console.error);
    }, 0);

    return () => {
      clearTimeout(timerId);
      mountedRef.current = false;
      disposeRef.current?.();
      disposeRef.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width:     "100%",
        maxWidth:  "520px",
        margin:    "0 auto",
        cursor:    isHovered ? "grabbing" : "grab",
        overflow:  "hidden",
      }}
      aria-label="Interactive globe showing visited locations"
    />
  );
}
