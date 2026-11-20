import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Self-hosted fonts (public/fonts, from Fontsource, SIL Open Font License) so rendering
 * never depends on Google Fonts being reachable. staticFile() resolves to /fonts/... in
 * the app's Player and to the bundle's copy of public/ when the worker renders.
 */
export const baloo = "Baloo2";
export const inter = "Inter";

const FACES: [family: string, file: string, weight: string][] = [
  [baloo, "baloo-2-latin-600-normal.woff2", "600"],
  [baloo, "baloo-2-latin-700-normal.woff2", "700"],
  [baloo, "baloo-2-latin-800-normal.woff2", "800"],
  [inter, "inter-latin-500-normal.woff2", "500"],
  [inter, "inter-latin-600-normal.woff2", "600"],
  [inter, "inter-latin-700-normal.woff2", "700"],
];

if (typeof document !== "undefined") {
  const handle = delayRender("Loading fonts");
  Promise.all(
    FACES.map(([family, file, weight]) => {
      const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, { weight, style: "normal" });
      document.fonts.add(face);
      return face.load();
    }),
  )
    .catch((e) => console.error("Font load failed", e))
    .finally(() => continueRender(handle));
}
