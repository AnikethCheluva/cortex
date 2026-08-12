import { ImageResponse } from "next/og";
import { brainSvg } from "@/lib/brainmark";

// Browser-tab / favicon: the Cortex brain mark (mesh-grid brain, no letter) on
// the app's charcoal.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const URI = `data:image/svg+xml,${encodeURIComponent(brainSvg())}`;

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#14130d",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={URI} width={64} height={64} alt="" style={{ width: "100%", height: "100%" }} />
      </div>
    ),
    { ...size },
  );
}
