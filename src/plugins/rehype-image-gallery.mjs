/**
 * Rehype plugin: wraps consecutive image-only paragraphs in a gallery.
 *
 * Markdown image alt text becomes the <figcaption>.
 * Title attribute (![alt](url "title")) is also supported for caption.
 *
 * Output for 3+ images:
 *   <div class="image-gallery image-gallery--grid" id="gallery-0">
 *     <figure class="image-gallery__item" data-index="0" data-gallery="gallery-0">
 *       <img src="..." alt="...">
 *       <figcaption>Caption from alt or title</figcaption>
 *     </figure>
 *     ...
 *   </div>
 *
 * Single image with caption:
 *   <figure class="image-gallery image-gallery--single">
 *     <img src="..." alt="...">
 *     <figcaption>Caption</figcaption>
 *   </figure>
 */

export function rehypeImageGallery() {
  return (tree) => {
    let galleryCount = 0;
    processNode(tree);

    function processNode(node) {
      if (!node.children || node.children.length === 0) return;

      const next = [];
      let i = 0;

      while (i < node.children.length) {
        const child = node.children[i];

        if (isImgParagraph(child)) {
          // Collect all consecutive image-only <p> nodes
          const imgs = [];
          while (i < node.children.length && isImgParagraph(node.children[i])) {
            imgs.push(extractImg(node.children[i]));
            i++;
          }

          const count = imgs.length;
          const variant = count === 1 ? "single" : count === 2 ? "pair" : "grid";
          const id = `gallery-${galleryCount++}`;

          const items = imgs.map((img, idx) => makeItem(img, idx, id));

          if (count === 1) {
            // Single image: use <figure> directly (no wrapper div needed)
            const item = items[0];
            item.properties.className = ["image-gallery", "image-gallery--single"];
            delete item.properties["data-index"];
            delete item.properties["data-gallery"];
            next.push(item);
          } else {
            next.push({
              type: "element",
              tagName: "div",
              properties: {
                className: ["image-gallery", `image-gallery--${variant}`],
                id,
              },
              children: items,
            });
          }
        } else {
          processNode(child);
          next.push(child);
          i++;
        }
      }

      node.children = next;
    }
  };
}

/** Build a <figure class="image-gallery__item"> with optional <figcaption> */
function makeItem(img, idx, galleryId) {
  const caption = getCaption(img);

  const children = [img];
  if (caption) {
    children.push({
      type: "element",
      tagName: "figcaption",
      properties: { className: ["image-gallery__caption"] },
      children: [{ type: "text", value: caption }],
    });
  }

  return {
    type: "element",
    tagName: "figure",
    properties: {
      className: ["image-gallery__item"],
      "data-index": String(idx),
      "data-gallery": galleryId,
      // Accessibility: make it keyboard-operable
      tabIndex: "0",
      role: "button",
      "aria-label": caption ? `View: ${caption}` : `View image ${idx + 1}`,
    },
    children,
  };
}

/** Caption = title attribute first, then alt text (if non-empty and not generic) */
function getCaption(img) {
  const title = img.properties?.title;
  if (title && title.trim()) return title.trim();
  const alt = img.properties?.alt;
  if (alt && alt.trim()) return alt.trim();
  return null;
}

function isImgParagraph(node) {
  if (!node || node.type !== "element" || node.tagName !== "p") return false;
  const kids = (node.children || []).filter(
    (c) => !(c.type === "text" && !c.value.trim())
  );
  return (
    kids.length === 1 &&
    kids[0].type === "element" &&
    kids[0].tagName === "img"
  );
}

function extractImg(pNode) {
  return pNode.children.find(
    (c) => c.type === "element" && c.tagName === "img"
  );
}
