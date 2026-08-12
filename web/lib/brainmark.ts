// The Cortex mark: a brain whose surface IS the tilted wireframe-globe mesh —
// same grid the logo has always used, now the texture of the brain, with no
// letter. Shared by the favicon (app/icon.tsx), the home-screen icon
// (app/apple-icon.tsx), and the standalone web/public/icon.svg. Pass bg=true to
// paint the opaque charcoal backing (standalone files); leave it off when a
// container already paints the background.
export const BRAIN_PATH =
  "M50 26 C45 22 38 23 35 28 C29 25 23 29 23 35 C17 37 15 44 19 49 " +
  "C15 53 16 60 22 62 C22 68 29 72 35 69 C39 73 46 73 50 69 " +
  "C54 73 61 73 65 69 C71 72 78 68 78 62 C84 60 85 53 81 49 " +
  "C85 44 83 37 77 35 C77 29 71 25 65 28 C62 23 55 22 50 26 Z";

const FISSURE = "M50 27 C47 38 52 47 50 57 C49 64 51 68 50 71";

export function brainSvg(bg = false): string {
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>` +
    (bg ? `<rect width='100' height='100' fill='#14130d'/>` : ``) +
    `<defs><clipPath id='cx-brain'><path d='${BRAIN_PATH}'/></clipPath></defs>` +
    // mesh grid, tilted 60°, clipped to the brain silhouette
    `<g clip-path='url(#cx-brain)'>` +
    `<g transform='rotate(60 50 50)' fill='none' stroke='#d8b15a' stroke-width='1.4' opacity='0.55'>` +
    `<circle cx='50' cy='50' r='15'/><circle cx='50' cy='50' r='26'/><circle cx='50' cy='50' r='37'/>` +
    `<ellipse cx='50' cy='50' rx='14' ry='37'/><ellipse cx='50' cy='50' rx='26' ry='37'/>` +
    `<ellipse cx='50' cy='50' rx='37' ry='14'/><ellipse cx='50' cy='50' rx='37' ry='26'/>` +
    `<line x1='13' y1='50' x2='87' y2='50'/><line x1='50' y1='13' x2='50' y2='87'/>` +
    `</g></g>` +
    // crisp brain outline + central fissure
    `<path d='${BRAIN_PATH}' fill='none' stroke='#d8b15a' stroke-width='2.4' stroke-linejoin='round'/>` +
    `<path d='${FISSURE}' fill='none' stroke='#d8b15a' stroke-width='1.8' stroke-linecap='round' opacity='0.8'/>` +
    `</svg>`
  );
}
