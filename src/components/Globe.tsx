import { useEffect, useRef, useState } from "react";

interface Location {
  lat: number;
  lng: number;
  label: string;
}

interface Props {
  locations: Location[];
}

const SPHERE_R   = 5;
const DOT_COUNT  = 50000;
// Coarse grid for land lookup — 2° resolution, built with geoContains
const GRID_W = 180; // 2° per cell
const GRID_H = 90;

/** Golden-angle Fibonacci distribution — evenly spaced points on unit sphere. */
function fibonacciSphere(n: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return pts;
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
      // ── 1. Build a 2° land-lookup grid with geoContains ──────────────────
      // This is ~16 k point-in-polygon tests — fast enough to do at init.
      const [THREE, topoData, topojsonClient, d3geo] = await Promise.all([
        import("three"),
        fetch("https://unpkg.com/world-atlas@2/land-110m.json").then(r => r.json()),
        import("topojson-client"),
        import("d3-geo"),
      ]);

      if (!mountedRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const landFeature = topojsonClient.feature(topoData, (topoData as any).objects.land);

      // Pre-compute a flat Uint8Array: 1 = land, 0 = ocean
      const grid = new Uint8Array(GRID_W * GRID_H);
      for (let row = 0; row < GRID_H; row++) {
        for (let col = 0; col < GRID_W; col++) {
          const lat = 90  - row * 2 - 1; // centre of 2° cell
          const lng = -180 + col * 2 + 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (d3geo.geoContains(landFeature as any, [lng, lat])) {
            grid[row * GRID_W + col] = 1;
          }
        }
      }

      function isLand(lat: number, lng: number): boolean {
        const row = Math.min(GRID_H - 1, Math.floor((90  - lat) / 2));
        const col = Math.min(GRID_W - 1, Math.floor((lng + 180) / 2));
        return grid[row * GRID_W + col] === 1;
      }

      if (!mountedRef.current) return;

      // ── 2. Three.js scene setup ───────────────────────────────────────────
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
      // Rotate so the Americas face the camera on first load
      // (camera sits at +Z; without rotation, lng=90° faces front)
      globe.rotation.y = Math.PI;
      scene.add(globe);

      // ── 3. Dark globe sphere ──────────────────────────────────────────────
      const sphereGeo = new THREE.SphereGeometry(SPHERE_R, 64, 64);
      const sphereMat = new THREE.MeshPhongMaterial({
        color:    new THREE.Color("#1c1917"),
        shininess: 2,
        specular:  new THREE.Color("#333"),
      });
      globe.add(new THREE.Mesh(sphereGeo, sphereMat));

      // ── 4. Land dots ──────────────────────────────────────────────────────
      const allPts  = fibonacciSphere(DOT_COUNT);
      const landPos: number[] = [];

      for (const [x, y, z] of allPts) {
        const lat = Math.asin(Math.max(-1, Math.min(1, y))) * (180 / Math.PI);
        const lng = Math.atan2(z, x) * (180 / Math.PI);
        if (isLand(lat, lng)) {
          // Place slightly above sphere surface so dots are visible
          landPos.push(x * SPHERE_R * 1.005, y * SPHERE_R * 1.005, z * SPHERE_R * 1.005);
        }
      }

      const landGeo = new THREE.BufferGeometry();
      landGeo.setAttribute("position", new THREE.Float32BufferAttribute(landPos, 3));

      const landMat = new THREE.PointsMaterial({
        color:           new THREE.Color("#c8b9a5"), // warm cream dots
        size:            0.09,
        sizeAttenuation: true,
        transparent:     true,
        opacity:         0.85,
      });

      globe.add(new THREE.Points(landGeo, landMat));

      // ── 5. Amber atmosphere ───────────────────────────────────────────────
      const atmosGeo = new THREE.SphereGeometry(SPHERE_R * 1.08, 64, 64);
      const atmosMat = new THREE.MeshPhongMaterial({
        color:       new THREE.Color("#d97706"),
        side:        THREE.BackSide,
        transparent: true,
        opacity:     0.06,
      });
      globe.add(new THREE.Mesh(atmosGeo, atmosMat));

      // ── 6. Visited location pins ──────────────────────────────────────────
      for (const loc of locations) {
        const phi   = (90 - loc.lat)   * (Math.PI / 180);
        const theta = (loc.lng + 180) * (Math.PI / 180);
        const x = -SPHERE_R * Math.sin(phi) * Math.cos(theta);
        const y =  SPHERE_R * Math.cos(phi);
        const z =  SPHERE_R * Math.sin(phi) * Math.sin(theta);
        const pos = new THREE.Vector3(x, y, z);

        // Raised glowing dot
        const dotGeo = new THREE.SphereGeometry(0.14, 12, 12);
        const dotMat = new THREE.MeshBasicMaterial({ color: "#d97706" });
        const dot    = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(pos.clone().multiplyScalar(1.03));
        globe.add(dot);

        // Outer ring
        const ringGeo = new THREE.RingGeometry(0.2, 0.28, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color:       "#d97706",
          side:        THREE.DoubleSide,
          transparent: true,
          opacity:     0.5,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos.clone().multiplyScalar(1.032));
        ring.lookAt(pos.clone().multiplyScalar(2));
        globe.add(ring);
      }

      // ── 7. Lighting ───────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const key = new THREE.DirectionalLight(0xfff8f0, 1.2);
      key.position.set(8, 5, 8);
      scene.add(key);

      // ── 8. Controls ───────────────────────────────────────────────────────
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

      // ── 9. Resize ─────────────────────────────────────────────────────────
      function onResize() {
        const sz = Math.min(container.offsetWidth || 500, window.innerWidth - 32);
        renderer.setSize(sz, sz);
      }
      window.addEventListener("resize", onResize);

      // ── 10. Render loop ───────────────────────────────────────────────────
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
        controls.dispose();
        landGeo.dispose();
        landMat.dispose();
        sphereGeo.dispose();
        sphereMat.dispose();
        atmosGeo.dispose();
        atmosMat.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    }

    init().catch(console.error);

    return () => {
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
