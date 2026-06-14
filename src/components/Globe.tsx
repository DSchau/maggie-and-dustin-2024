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
      const GlobeModule = await import("globe.gl");
      // globe.gl exports a factory function as default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GlobeGL = (GlobeModule as any).default ?? GlobeModule;

      const container = containerRef.current!;
      const width = container.offsetWidth || 500;
      const height = Math.min(width, 520);

      // globe.gl is called as a factory function: GlobeGL()(element)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globe = (GlobeGL as any)({ animateIn: true })(container);

      globe
        .width(width)
        .height(height)
        .backgroundColor("rgba(0,0,0,0)")
        .globeImageUrl(
          "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        )
        .atmosphereColor("#e0d9ce")
        .atmosphereAltitude(0.12)
        .pointsData(locations)
        .pointLat("lat")
        .pointLng("lng")
        .pointLabel("label")
        .pointColor(() => "#d97706")
        .pointAltitude(0.02)
        .pointRadius(0.5);

      // Set initial camera position
      globe.pointOfView({ lat: 20, lng: -100, altitude: 2.2 });

      // Enable auto-rotation
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.4;
      globe.controls().enableZoom = false;

      globeRef.current = globe;
    }

    initGlobe().catch(console.error);

    return () => {
      // Clean up canvas on unmount
      const canvas = containerRef.current?.querySelector("canvas");
      if (canvas) canvas.remove();
      globeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause/resume rotation on hover
  useEffect(() => {
    if (!globeRef.current) return;
    try {
      globeRef.current.controls().autoRotate = !isHovered;
    } catch {
      // ignore if controls not yet ready
    }
  }, [isHovered]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: "100%",
        maxWidth: "600px",
        margin: "0 auto",
        cursor: isHovered ? "grabbing" : "grab",
        aspectRatio: "1",
        borderRadius: "50%",
        overflow: "hidden",
      }}
      aria-label="Interactive globe showing visited locations"
    />
  );
}
