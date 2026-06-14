/**
 * ImageLightbox — mounts on post pages (client:load).
 *
 * On mount it:
 *  1. Scans `.prose` for consecutive <p><img></p> sequences and wraps them
 *     in .image-gallery--{single|pair|grid} containers with <figure> items.
 *  2. Wires click / keyboard handlers on those figures to open a lightbox.
 */
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface LightboxImage {
  src: string;
  caption: string | null;
}

interface LightboxState {
  images: LightboxImage[];
  index: number;
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

function isImgParagraph(el: Element): boolean {
  if (el.tagName !== "P") return false;
  const real = Array.from(el.childNodes).filter(
    (n) => !(n.nodeType === Node.TEXT_NODE && !n.textContent?.trim())
  );
  return real.length === 1 && (real[0] as Element).tagName === "IMG";
}

function buildGalleries(prose: Element) {
  const kids = Array.from(prose.children); // snapshot
  let galleryCount = 0;
  let i = 0;

  while (i < kids.length) {
    const el = kids[i];

    if (!isImgParagraph(el)) { i++; continue; }

    // Collect a consecutive run of image-only paragraphs
    const group: Element[] = [];
    while (i < kids.length && isImgParagraph(kids[i])) {
      group.push(kids[i]);
      i++;
    }

    const count   = group.length;
    const variant = count === 1 ? "single" : count === 2 ? "pair" : "grid";
    const id      = `gallery-${galleryCount++}`;

    const wrapper = document.createElement("div");
    wrapper.className = `image-gallery image-gallery--${variant}`;
    wrapper.id = id;

    group.forEach((p, idx) => {
      const img = p.querySelector("img")!;
      const rawAlt = img.getAttribute("alt") ?? "";
      const caption = rawAlt.trim() || null;

      const figure = document.createElement("figure");
      figure.className  = "image-gallery__item";
      figure.dataset.index   = String(idx);
      figure.dataset.gallery = id;
      figure.tabIndex = 0;
      figure.setAttribute("role", "button");
      figure.setAttribute("aria-label", caption ? `View: ${caption}` : `View image ${idx + 1}`);

      img.removeAttribute("alt"); // caption element handles this
      figure.appendChild(img);

      if (caption) {
        const fc = document.createElement("figcaption");
        fc.className   = "image-gallery__caption";
        fc.textContent = caption;
        figure.appendChild(fc);
      }

      wrapper.appendChild(figure);
      p.remove(); // remove original paragraph from DOM
    });

    // Insert the wrapper where the group started
    const anchor = kids[i]; // first element after the group (may be undefined)
    if (anchor && anchor.parentNode === prose) {
      prose.insertBefore(wrapper, anchor);
    } else {
      prose.appendChild(wrapper);
    }
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ImageLightbox() {
  const [lb, setLb] = useState<LightboxState | null>(null);

  const close = useCallback(() => {
    setLb(null);
    document.body.style.overflow = "";
  }, []);

  const go = useCallback((dir: 1 | -1) => {
    setLb((s) =>
      s ? { ...s, index: (s.index + dir + s.images.length) % s.images.length } : s
    );
  }, []);

  useEffect(() => {
    // 1. Build galleries from consecutive image paragraphs
    const prose = document.querySelector(".prose");
    if (prose) buildGalleries(prose);

    // 2. Wire up click / keyboard on every gallery item
    function open(e: MouseEvent | KeyboardEvent) {
      if (e.type === "keydown") {
        const k = (e as KeyboardEvent).key;
        if (k !== "Enter" && k !== " ") return;
        e.preventDefault();
      }

      const figure = e.currentTarget as HTMLElement;
      const galleryId = figure.dataset.gallery;
      const idx = parseInt(figure.dataset.index ?? "0", 10);
      if (!galleryId) return;

      const gallery = document.getElementById(galleryId);
      if (!gallery) return;

      const images: LightboxImage[] = Array.from(
        gallery.querySelectorAll<HTMLElement>(".image-gallery__item")
      ).map((fig) => ({
        src:     fig.querySelector<HTMLImageElement>("img")!.src,
        caption: fig.querySelector<HTMLElement>(".image-gallery__caption")?.textContent ?? null,
      }));

      setLb({ images, index: idx });
      document.body.style.overflow = "hidden";
    }

    const items = document.querySelectorAll<HTMLElement>(".image-gallery__item");
    items.forEach((el) => {
      el.addEventListener("click",   open);
      el.addEventListener("keydown", open);
    });
    return () => {
      items.forEach((el) => {
        el.removeEventListener("click",   open);
        el.removeEventListener("keydown", open);
      });
    };
  }, []);

  // Keyboard nav while open
  useEffect(() => {
    if (!lb) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")      close();
      if (e.key === "ArrowLeft")   go(-1);
      if (e.key === "ArrowRight")  go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lb, close, go]);

  if (!lb) return null;

  const { images, index } = lb;
  const { src, caption } = images[index];
  const multi = images.length > 1;

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label="Image viewer"
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.93)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "1rem", padding: "3rem 1rem 2.5rem",
      }}
    >
      <img
        key={src} src={src} alt={caption ?? ""}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw", maxHeight: caption ? "78vh" : "84vh",
          objectFit: "contain", borderRadius: "4px",
          boxShadow: "0 8px 60px rgba(0,0,0,0.6)",
          animation: "lb-in 0.16s ease", cursor: "default", flexShrink: 0,
        }}
      />

      {caption && (
        <p
          onClick={(e) => e.stopPropagation()}
          style={{
            color: "rgba(255,255,255,0.72)", fontSize: "0.875rem",
            textAlign: "center", margin: 0,
            fontFamily: "Georgia,serif", fontStyle: "italic",
            maxWidth: "52ch", lineHeight: 1.55, flexShrink: 0,
          }}
        >
          {caption}
        </p>
      )}

      <button onClick={close} aria-label="Close"
        style={ctrl({ top: 14, right: 18, fontSize: "1.625rem", padding: "0.2rem 0.6rem" })}>
        ×
      </button>

      {multi && (
        <button onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous"
          style={ctrl({ top: "50%", left: 12, transform: "translateY(-50%)", fontSize: "2rem", padding: "0.5rem 0.8rem" })}>
          ‹
        </button>
      )}
      {multi && (
        <button onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next"
          style={ctrl({ top: "50%", right: 18, transform: "translateY(-50%)", fontSize: "2rem", padding: "0.5rem 0.8rem" })}>
          ›
        </button>
      )}

      {multi && (
        <div onClick={(e) => e.stopPropagation()} style={{
          position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.4)", fontSize: "0.75rem",
          letterSpacing: "0.08em", userSelect: "none", fontFamily: "system-ui,sans-serif",
        }}>
          {index + 1} / {images.length}
        </div>
      )}

      <style>{`
        @keyframes lb-in {
          from { opacity:0; transform:scale(0.97); }
          to   { opacity:1; transform:scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}

function ctrl(pos: Record<string, string | number>): React.CSSProperties {
  return {
    position: "absolute", background: "rgba(255,255,255,0.08)",
    border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer",
    borderRadius: "6px", lineHeight: 1, transition: "background 0.15s",
    backdropFilter: "blur(4px)", fontFamily: "system-ui,sans-serif", ...pos,
  };
}
