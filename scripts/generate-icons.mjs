/**
 * generate-icons.mjs
 * Generates all PWA icons and favicons from public/logo.png using Sharp.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'public', 'logo.png');
const OUT = resolve(ROOT, 'public');

const SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512];

async function generateIcons() {
  console.log('🎨 Gerando ícones PWA a partir de:', SRC);

  // Standard PNG icons
  for (const size of SIZES) {
    const outPath = resolve(OUT, `icon-${size}x${size}.png`);
    await sharp(SRC)
      .resize(size, size, { fit: 'contain', background: { r: 10, g: 14, b: 39, alpha: 1 } })
      .png()
      .toFile(outPath);
    console.log(`  ✅ icon-${size}x${size}.png`);
  }

  // Apple touch icon (180x180, no alpha background)
  await sharp(SRC)
    .resize(180, 180, { fit: 'contain', background: { r: 10, g: 14, b: 39, alpha: 1 } })
    .png()
    .toFile(resolve(OUT, 'apple-touch-icon.png'));
  console.log('  ✅ apple-touch-icon.png');

  // Maskable icon: logo centered at 80% with safe zone padding
  const maskableSize = 512;
  const logoSize = Math.round(maskableSize * 0.8);
  const offset = Math.round((maskableSize - logoSize) / 2);
  await sharp(SRC)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 10, g: 14, b: 39, alpha: 0 } })
    .extend({
      top: offset,
      bottom: offset,
      left: offset,
      right: offset,
      background: { r: 10, g: 14, b: 39, alpha: 1 }
    })
    .png()
    .toFile(resolve(OUT, 'icon-maskable-512x512.png'));
  console.log('  ✅ icon-maskable-512x512.png');

  // Favicon as PNG (32x32 as ICO replacement for modern browsers)
  await sharp(SRC)
    .resize(32, 32, { fit: 'contain', background: { r: 10, g: 14, b: 39, alpha: 1 } })
    .png()
    .toFile(resolve(OUT, 'favicon-32x32.png'));

  await sharp(SRC)
    .resize(16, 16, { fit: 'contain', background: { r: 10, g: 14, b: 39, alpha: 1 } })
    .png()
    .toFile(resolve(OUT, 'favicon-16x16.png'));
  console.log('  ✅ favicon-16x16.png e favicon-32x32.png');

  // OG Image (1200x630)
  await sharp(SRC)
    .resize(630, 630, { fit: 'contain', background: { r: 10, g: 14, b: 39, alpha: 1 } })
    .extend({ top: 0, bottom: 0, left: 285, right: 285, background: { r: 10, g: 14, b: 39, alpha: 1 } })
    .png()
    .toFile(resolve(OUT, 'og-image.png'));
  console.log('  ✅ og-image.png (1200x630)');

  console.log('\n🎉 Todos os ícones gerados com sucesso!');
}

generateIcons().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
