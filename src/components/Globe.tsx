import { useEffect, useRef, useState } from "react";

interface Location {
  lat: number;
  lng: number;
  label: string;
}

interface Props {
  locations: Location[];
}

export default function Globe({ locations }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    async function initGlobe() {
      const [GlobeModule, THREE, countries] = await Promise.all([
        import("globe.gl"),
        import("three"),
        fetch("https://unpkg.com/world-atlas@2/countries-110m.json")
          .then((r) => r.json())
          .then(async (topo) => {
            const { feature } = await import("topojson-client");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (feature(topo, (topo as any).objects.countries) as any).features;
          }),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GlobeGL = (GlobeModule as any).default ?? GlobeModule;

      const container = containerRef.current!;
      const size = container.offsetWidth || 500;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globe = (GlobeGL as any)({ animateIn: true })(container);

      // Warm cream sphere — no texture, just a clean matte surface
      const globeMaterial = new THREE.MeshPhongMaterial({
        color: new THREE.Color("#f0ebe4"),
        shininess: 4,
        specular: new THREE.Color("#e8e0d8"),
      });

      globe
        .width(size)
        .height(size)
        .backgroundColor("rgba(0,0,0,0)")
        .globeImageUrl("")
        .globeMaterial(globeMaterial)
        .showAtmosphere(true)
        .atmosphereColor("#e8d5b0")
        .atmosphereAltitude(0.12)
        // Country outlines — stroke only, no fill
        .polygonsData(countries)
        .polygonCapColor(() => "rgba(0,0,0,0)")
        .polygonSideColor(() => "rgba(0,0,0,0)")
        .polygonStrokeColor(() => "#b5a898")
        .polygonAltitude(0.002)
        // Animated pulse rings at visited locations
        .ringsData(locations)
        .ringLat("lat")
        .ringLng("lng")
        .ringLabel("label")
        .ringColor(() => (t: number) => `rgba(217,119,6,${1 - t})`)
        .ringMaxRadius(4)
        .ringPropagationSpeed(1.2)
        .ringRepeatPeriod(1800);

      globe.pointOfView({ lat: 20, lng: -40, altitude: 2.0 });
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.4;
      globe.controls().enableZoom = false;

      globeRef.current = globe;
    }

    initGlobe().catch(console.error);

    return () => {
      const canvas = containerRef.current?.querySelector("canvas");
      if (canvas) canvas.remove();
      globeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;
    try {
      globeRef.current.controls().autoRotate = !isHovered;
    } catch {
      // ignore
    }
  }, [isHovered]);

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
      }}
      aria-label="Interactive globe showing visited locations"
    />
  );
}
