import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

// Browser-tab / favicon. Centered "A.C." in PT Serif over a faint tilted globe,
// matching the home-screen icon and the header wordmark.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const GLOBE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='#d8b15a' stroke-width='2.6'><circle cx='50' cy='50' r='40'/><ellipse cx='50' cy='50' rx='14' ry='40'/><ellipse cx='50' cy='50' rx='28' ry='40'/><ellipse cx='50' cy='50' rx='40' ry='14'/><ellipse cx='50' cy='50' rx='40' ry='28'/><line x1='10' y1='50' x2='90' y2='50'/><line x1='50' y1='10' x2='50' y2='90'/></g></svg>`;
const GLOBE_URI = `data:image/svg+xml,${encodeURIComponent(GLOBE)}`;

export default async function Icon() {
  const serif = await readFile(join(process.cwd(), "assets/PTSerif-Bold.ttf"));
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#14130d",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={GLOBE_URI}
          width={64}
          height={64}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0.16,
            transform: "rotate(60deg)",
          }}
        />
        <div
          style={{
            fontFamily: "Serif",
            fontWeight: 700,
            fontSize: 32,
            lineHeight: 1,
            color: "#d8b15a",
          }}
        >
          A
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Serif", data: serif, weight: 700, style: "normal" }],
    },
  );
}
