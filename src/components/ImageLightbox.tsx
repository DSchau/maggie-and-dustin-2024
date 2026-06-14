import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface LightboxImage {
  src: string;
  alt: string;
  caption: string | null;
}

interface LightboxState {
  images: LightboxImage[];
  index: number;
}

export default function ImageLightbox() {
  const [state, setState] = useState<LightboxState | null>(null);

  const close = useCallback(() => {
    setState(null);
    document.body.style.overflow = "";
  }, []);

  const go = useCallback((dir: 1 | -1) => {
    setState((s) =>
      s ? { ...s, index: (s.index + dir + s.images.length) % s.images.length } : s
    );
  }, []);

  // Wire click + keyboard activation on gallery items
  useEffect(() => {
    function handleActivate(e: MouseEvent | KeyboardEvent) {
      if (e.type === "keydown") {
        const key = (e as KeyboardEvent).key;
        if (key !== "Enter" && key !== " ") return;
        e.preventDefault();
      }

      const item = e.currentTarget as HTMLElement;
      const galleryId = item.dataset.gallery;
      const idx = parseInt(item.dataset.index ?? "0", 10);
      if (!galleryId) return;

      const gallery = document.getElementById(galleryId);
      if (!gallery) return;

      const figureEls = Array.from(
        gallery.querySelectorAll<HTMLElement>(".image-gallery__item")
      );
      const images: LightboxImage[] = figureEls.map((fig) => {
        const img = fig.querySelector<HTMLImageElement>("img")!;
        const caption = fig.querySelector<HTMLElement>(".image-gallery__caption")?.textContent ?? null;
        return { src: img.src, alt: img.alt, caption };
      });

      setState({ images, index: idx });
      document.body.style.overflow = "hidden";
    }

    const items = document.querySelectorAll<HTMLElement>(".image-gallery__item");
    items.forEach((el) => {
      el.addEventListener("click", handleActivate);
      el.addEventListener("keydown", handleActivate);
    });
    return () => {
      items.forEach((el) => {
        el.removeEventListener("click", handleActivate);
        el.removeEventListener("keydown", handleActivate);
      });
    };
  }, []);

  // Keyboard navigation while lightbox is open
  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")      close();
      if (e.key === "ArrowLeft")   go(-1);
      if (e.key === "ArrowRight")  go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close, go]);

  if (!state) return null;

  const { images, index } = state;
  const { src, alt, caption } = images[index];
  const multi = images.length > 1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.93)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "3rem 1rem 2rem",
      }}
    >
      {/* Image */}
      <img
        key={src}
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: caption ? "78vh" : "84vh",
          objectFit: "contain",
          borderRadius: "4px",
          boxShadow: "0 8px 60px rgba(0,0,0,0.6)",
          animation: "lb-in 0.16s ease",
          cursor: "default",
          flexShrink: 0,
        }}
      />

      {/* Caption */}
      {caption && (
        <p
          onClick={(e) => e.stopPropagation()}
          style={{
            color: "rgba(255,255,255,0.75)",
            fontSize: "0.875rem",
            textAlign: "center",
            margin: 0,
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            maxWidth: "56ch",
            lineHeight: 1.5,
            flexShrink: 0,
          }}
        >
          {caption}
        </p>
      )}

      {/* Close */}
      <button
        onClick={close}
        aria-label="Close"
        style={ctrl({ top: 14, right: 18, fontSize: "1.625rem", padding: "0.2rem 0.6rem" })}
      >
        ×
      </button>

      {/* Prev */}
      {multi && (
        <button
          onClick={(e) => { e.stopPropagation(); go(-1); }}
          aria-label="Previous image"
          style={ctrl({ top: "50%", left: 12, transform: "translateY(-50%)", fontSize: "2rem", padding: "0.5rem 0.8rem" })}
        >
          ‹
        </button>
      )}

      {/* Next */}
      {multi && (
        <button
          onClick={(e) => { e.stopPropagation(); go(1); }}
          aria-label="Next image"
          style={ctrl({ top: "50%", right: 18, transform: "translateY(-50%)", fontSize: "2rem", padding: "0.5rem 0.8rem" })}
        >
          ›
        </button>
      )}

      {/* Counter */}
      {multi && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.45)",
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            userSelect: "none",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {index + 1} / {images.length}
        </div>
      )}

      <style>{`
        @keyframes lb-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}

function ctrl(pos: Record<string, string | number>): React.CSSProperties {
  return {
    position: "absolute",
    background: "rgba(255,255,255,0.08)",
    border: "none",
    color: "rgba(255,255,255,0.8)",
    cursor: "pointer",
    borderRadius: "6px",
    lineHeight: 1,
    transition: "background 0.15s",
    backdropFilter: "blur(4px)",
    fontFamily: "system-ui, sans-serif",
    ...pos,
  };
}
