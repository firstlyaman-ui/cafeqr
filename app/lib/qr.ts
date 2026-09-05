import QRCode from "qrcode";

const DEFAULT_DARK = "#111111";
const DEFAULT_LIGHT = "#ffffff";

export type QrOptions = {
  color?: string;
  width?: number;
  margin?: number;
};

/**
 * Reliable PNG data-URL for RN/Web <Image>.
 * Avoids SVG data-URIs (RN Web often leaves them blank / double-encodes).
 */
export async function qrDataUriAsync(
  text: string,
  colorOrOpts: string | QrOptions = DEFAULT_DARK,
): Promise<string> {
  const opts: QrOptions = typeof colorOrOpts === "string" ? { color: colorOrOpts } : colorOrOpts;
  const dark = opts.color || DEFAULT_DARK;
  const width = opts.width ?? 280;
  const margin = opts.margin ?? 2;
  const value = String(text || "").trim() || " ";
  const uri = await QRCode.toDataURL(value, {
    type: "image/png",
    errorCorrectionLevel: "M",
    margin,
    width,
    color: { dark, light: DEFAULT_LIGHT },
  });
  if (!uri || !uri.startsWith("data:image/png")) {
    throw new Error("QR PNG generation returned empty result");
  }
  return uri;
}

/** @deprecated Prefer qrDataUriAsync — sync SVG path removed (blank on RN Web). */
export async function qrDataUri(text: string, color = DEFAULT_DARK): Promise<string> {
  return qrDataUriAsync(text, color);
}

/** Sync SVG string for debugging / non-Image embeds only. */
export function qrSvg(text: string, moduleSize = 6, color = DEFAULT_DARK): string {
  // Best-effort sync path via create(); used only if callers need raw SVG markup.
  const value = String(text || "").trim() || " ";
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const quiet = 2;
  const dim = (size + quiet * 2) * moduleSize;
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.get(x, y)) {
        const px = (x + quiet) * moduleSize;
        const py = (y + quiet) * moduleSize;
        path += `M${px} ${py}h${moduleSize}v${moduleSize}h${-moduleSize}z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="${color}" d="${path}"/></svg>`;
}
