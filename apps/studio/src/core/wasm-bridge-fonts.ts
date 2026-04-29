import { resolveFont, fontFamilyWithFallback } from './font-substitution';
import { REGISTERED_FONTS } from './font-loader';

export function substituteCssFontFamily(cssFont: string): string {
  const pxIdx = cssFont.indexOf('px ');
  if (pxIdx < 0) return cssFont;

  const prefix = cssFont.substring(0, pxIdx + 3);
  const familyPart = cssFont.substring(pxIdx + 3);
  const match = familyPart.match(/^"([^"]+)"/);
  if (!match) return cssFont;

  const fontName = match[1];
  if (REGISTERED_FONTS.has(fontName)) return cssFont;

  const resolved = resolveFont(fontName, 0, 0);
  if (resolved === fontName) return cssFont;

  return prefix + fontFamilyWithFallback(resolved);
}
