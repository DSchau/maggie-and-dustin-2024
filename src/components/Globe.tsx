import { useEffect, useRef, useState } from "react";

interface Location {
  lat: number;
  lng: number;
  label: string;
}

interface Props {
  locations: Location[];
}

const SPHERE_R = 5;
const DOT_COUNT = 60000; // more = denser continents

/** Evenly distribute N points on a unit sphere using the golden angle. */
function fibonacciSphere(n: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle ≈ 2.399 rad
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
  const mountedRef = useRef(true);
  const disposeRef = useRef<(() => void) | undefined>(undefined);
  const isHoveredRef = useRef(false);
  const [isHovered, setIsHovered] = useState(false);

  // Sync hover state into ref so animation loop can read it without closure stale-ness
  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  useEffect(() => {
    mountedRef.current = true;
    const container = containerRef.current!;

    async function init() {
      // --- 1. Build a world land mask on an offscreen canvas via d3-geo ---
      const MAP_W = 2048;
      const MAP_H = 1024;

      const [THREE, topoData, topojsonClient, d3geo] = await Promise.all([
        import("three"),
        fetch("https://unpkg.com/world-atlas@2/land-110m.json").then((r) => r.json()),
        import("topojson-client"),
        import("d3-geo"),
      ]);

      if (!mountedRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const land = topojsonClient.feature(topoData, (topoData as any).objects.land);

      const offscreen = document.createElement("canvas");
      offscreen.width = MAP_W;
      offscreen.height = MAP_H;
      const ctx = offscreen.getContext("2d")!;

      // Equirectangular projection fills the canvas
      const proj = d3geo
        .geoEquirectangular()
        .scale(MAP_W / (2 * Math.PI))
        .translate([MAP_W / 2, MAP_H / 2]);
      const path = d3geo.geoPath(proj, ctx);

      ctx.fillStyle = "#000"; // ocean = black
      ctx.fillRect(0, 0, MAP_W, MAP_H);
      ctx.fillStyle = "#fff"; // land = white
      ctx.beginPath();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      path(land as any);
      ctx.fill();

      const { data: pixels } = ctx.getImageData(0, 0, MAP_W, MAP_H);

      function isLand(lat: number, lng: number): boolean {
        const px = Math.min(MAP_W - 1, Math.floor(((lng + 180) / 360) * MAP_W));
        const py = Math.min(MAP_H - 1, Math.floor(((90 - lat) / 180) * MAP_H));
        return pixels[(py * MAP_W + px) * 4] > 128; // R channel: white = land
      }

      // --- 2. Three.js scene ---
      // Cap to viewport width to prevent mobile overflow
      const w = Math.min(container.offsetWidth || 500, window.innerWidth - 32);

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
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

      // Globe group — everything rotates together
      const globe = new THREE.Group();
      // Rotate so Americas face the camera initially.
      // Camera sits at +Z; prime meridian faces +X; rotating by π brings
      // lng≈-90° (Americas) to the front (+Z side).
      globe.rotation.y = Math.PI;
      scene.add(globe);

      // --- 3. Land dots ---
      const allPts = fibonacciSphere(DOT_COUNT);
      const landPos: number[] = [];

      for (const [x, y, z] of allPts) {
        const lat = Math.asin(Math.max(-1, Math.min(1, y))) * (180 / Math.PI);
        const lng = Math.atan2(z, x) * (180 / Math.PI);
        if (isLand(lat, lng)) {
          landPos.push(x * SPHERE_R, y * SPHERE_R, z * SPHERE_R);
        }
      }

      const landGeo = new THREE.BufferGeometry();
      landGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(landPos, 3)
      );

      const landMat = new THREE.PointsMaterial({
        color: new THREE.Color("#8c7b6b"), // warm muted brown
        size: 0.052,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
      });

      globe.add(new THREE.Points(landGeo, landMat));

      // --- 4. Visited location markers ---
      for (const loc of locations) {
        const phi = (90 - loc.lat) * (Math.PI / 180);
        const theta = (loc.lng + 180) * (Math.PI / 180);
        const x = -SPHERE_R * Math.sin(phi) * Math.cos(theta);
        const y = SPHERE_R * Math.cos(phi);
        const z = SPHERE_R * Math.sin(phi) * Math.sin(theta);
        const pos = new THREE.Vector3(x, y, z);

        // Glowing amber dot, slightly raised off surface
        const dotGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const dotMat = new THREE.MeshBasicMaterial({ color: "#d97706" });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(pos.clone().multiplyScalar(1.02));
        globe.add(dot);

        // Outer ring, facing outward
        const ringGeo = new THREE.RingGeometry(0.18, 0.24, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: "#d97706",
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos.clone().multiplyScalar(1.022));
        // Orient ring to face outward from sphere center
        ring.lookAt(pos.clone().multiplyScalar(2));
        globe.add(ring);
      }

      // Soft ambient + directional light so the dots catch a little shading
      scene.add(new THREE.AmbientLight(0xffffff, 1.2));
      const dirLight = new THREE.DirectionalLight(0xfff8f0, 0.6);
      dirLight.position.set(5, 3, 5);
      scene.add(dirLight);

      // --- 5. Auto-rotation + drag ---
      const { OrbitControls } = await import(
        // @ts-expect-error - three examples types may not resolve cleanly
        "three/examples/jsm/controls/OrbitControls.js"
      );
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      controls.minPolarAngle = Math.PI * 0.15;
      controls.maxPolarAngle = Math.PI * 0.85;

      // --- 6. Resize ---
      function onResize() {
        const sz = Math.min(container.offsetWidth || 500, window.innerWidth - 32);
        renderer.setSize(sz, sz);
      }
      window.addEventListener("resize", onResize);

      // --- 7. Render loop ---
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
        width: "100%",
        maxWidth: "520px",
        margin: "0 auto",
        cursor: isHovered ? "grabbing" : "grab",
        aspectRatio: "1 / 1",
        overflow: "hidden",
      }}
      aria-label="Interactive globe showing visited locations"
    />
  );
}
