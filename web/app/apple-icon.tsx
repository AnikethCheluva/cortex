import { ImageResponse } from "next/og";
import { brainSvg } from "@/lib/brainmark";

// iOS home-screen icon (apple-touch-icon). Full-bleed + opaque, no self-applied
// rounded corners/transparency, so iOS applies its own treatment cleanly. The
// Cortex brain mark (mesh-grid brain, no letter) on the app's charcoal.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const URI = `data:image/svg+xml,${encodeURIComponent(brainSvg())}`;

export default function AppleIcon() {
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
        <img src={URI} width={180} height={180} alt="" style={{ width: "100%", height: "100%" }} />
      </div>
    ),
    { ...size },
  );
}
