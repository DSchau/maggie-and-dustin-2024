/**
 * ImageLightbox — mounts on post pages (client:load).
 *
 * Wires medium-zoom on every .image-gallery__btn img so clicking
 * any gallery image gets the Medium-style expand animation.
 */
import { useEffect } from "react";
import mediumZoom from "medium-zoom";

export default function ImageLightbox() {
  useEffect(() => {
    const zoom = mediumZoom(".image-gallery__btn img", {
      margin: 48,
      background: "rgba(250,250,249,0.96)",
    });

    return () => {
      zoom.detach();
    };
  }, []);

  return null;
}
