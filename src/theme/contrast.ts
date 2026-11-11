const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function expandHex(hex: string): string {
  if (!HEX_PATTERN.test(hex)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  const body = hex.slice(1);
  return body.length === 3 ? body.split('').map((ch) => ch + ch).join('') : body;
}

function channelToLinear(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of an sRGB hex colour. */
export function relativeLuminance(hex: string): number {
  const body = expandHex(hex);
  const [r, g, b] = [0, 2, 4].map((i) => channelToLinear(parseInt(body.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours (1 – 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}
