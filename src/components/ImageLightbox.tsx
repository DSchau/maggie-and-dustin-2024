/**
 * ImageLightbox — mounts on post pages (client:load).
 *
 * Uses PhotoSwipe v5 for gallery zoom with origin animation,
 * chevron navigation, captions, and touch/keyboard support.
 */
import { useEffect } from "react";

export default function ImageLightbox() {
  useEffect(() => {
    let destroyed = false;
    let destroy: (() => void) | undefined;

    async function init() {
      const [{ default: PhotoSwipe }, { default: PhotoSwipeLightbox }] = await Promise.all([
        import("photoswipe"),
        import("photoswipe/lightbox"),
      ]);
      if (destroyed) return;

      const lightbox = new PhotoSwipeLightbox({
        gallery: ".image-gallery",
        children: ".image-gallery__btn",
        pswpModule: () => Promise.resolve(PhotoSwipe),
        showHideAnimationType: "zoom",
        bgOpacity: 0.94,
        padding: { top: 48, bottom: 48, left: 32, right: 32 },
        arrowPrevSVG: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
        arrowNextSVG: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
        closeSVG: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      });

      // Provide image src + dimensions from the <img> element itself
      lightbox.addFilter("itemData", (itemData) => {
        const btn = itemData.element as HTMLElement | undefined;
        const img = btn?.querySelector<HTMLImageElement>("img");
        if (img) {
          itemData.src  = img.currentSrc || img.src;
          itemData.msrc = img.currentSrc || img.src; // show already-loaded thumb instantly
          itemData.w    = parseInt(img.getAttribute("width")  ?? "0") || img.naturalWidth  || 1200;
          itemData.h    = parseInt(img.getAttribute("height") ?? "0") || img.naturalHeight || 900;
          itemData.alt  = img.getAttribute("alt") ?? "";
        }
        return itemData;
      });

      // Caption below the zoomed image
      lightbox.on("uiRegister", () => {
        lightbox.pswp?.ui?.registerElement({
          name: "caption",
          order: 9,
          isButton: false,
          appendTo: "root",
          html: "",
          onInit(el, ps) {
            ps.on("change", () => {
              const btn = ps.currSlide?.data.element as HTMLElement | undefined;
              const caption = btn
                ?.closest("figure")
                ?.querySelector(".image-gallery__caption")
                ?.textContent
                ?.trim() ?? "";
              el.innerHTML = caption
                ? `<p class="pswp-caption">${caption}</p>`
                : "";
            });
          },
        });
      });

      lightbox.init();
      destroy = () => lightbox.destroy();
    }

    init().catch(console.error);

    return () => {
      destroyed = true;
      destroy?.();
    };
  }, []);

  return null;
}
