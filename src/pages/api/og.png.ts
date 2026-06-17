import { type APIRoute } from "astro";
import { ImageResponse } from "@cloudflare/pages-plugin-vercel-og/api";

import { Og } from "../../components/og/Og";

// Rendered on demand (Cloudflare Function), never prerendered.
export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim() || "maggie & dustin";
  const subtitle = params.get("subtitle")?.trim() || undefined;

  const [interRegular, interSemiBold, loraRegular, loraSemiBold] =
    await Promise.all([
      import("../../assets/fonts/Inter-Regular.ttf").then((m) => m.default),
      import("../../assets/fonts/Inter-SemiBold.ttf").then((m) => m.default),
      import("../../assets/fonts/Lora-Regular.ttf").then((m) => m.default),
      import("../../assets/fonts/Lora-SemiBold.ttf").then((m) => m.default),
    ]);

  const response = new ImageResponse(Og({ title, subtitle }), {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Inter", data: interRegular, weight: 400, style: "normal" },
      { name: "Inter", data: interSemiBold, weight: 600, style: "normal" },
      { name: "Lora", data: loraRegular, weight: 400, style: "normal" },
      { name: "Lora", data: loraSemiBold, weight: 600, style: "normal" },
    ],
  });

  response.headers.set("Content-Type", "image/png");
  response.headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return response;
};
