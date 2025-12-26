import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = process.cwd();
const TARGET_DIRS = [path.join(ROOT, 'public', 'assets'), path.join(ROOT, 'public', 'games')];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  /** @type {string[]} */
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function getWebpPath(pngPath) {
  return pngPath.replace(/\.png$/i, '.webp');
}

async function main() {
  const startedAt = Date.now();

  // Configure Sharp for a conservative default: preserve pixels (lossless),
  // but still often much smaller than PNG sprite sheets.
  const webpOptions = {
    lossless: true,
    effort: 4,
  };

  /** @type {{input:string, output:string, inBytes:number, outBytes:number}[]} */
  const converted = [];
  /** @type {{input:string, reason:string}[]} */
  const skipped = [];

  for (const dir of TARGET_DIRS) {
    if (!(await exists(dir))) continue;
    const files = await walk(dir);

    for (const file of files) {
      if (!/\.png$/i.test(file)) continue;
      const output = getWebpPath(file);

      const inStat = await fs.stat(file);
      if (await exists(output)) {
        const outStat = await fs.stat(output);
        // Skip if output is newer or same age as input (assume already optimized).
        if (outStat.mtimeMs >= inStat.mtimeMs) {
          skipped.push({ input: file, reason: 'up-to-date' });
          continue;
        }
      }

      await sharp(file, { limitInputPixels: false })
        .webp(webpOptions)
        .toFile(output);

      const outStat = await fs.stat(output);
      converted.push({ input: file, output, inBytes: inStat.size, outBytes: outStat.size });
    }
  }

  const totalIn = converted.reduce((sum, x) => sum + x.inBytes, 0);
  const totalOut = converted.reduce((sum, x) => sum + x.outBytes, 0);
  const saved = totalIn - totalOut;
  const pct = totalIn > 0 ? ((saved / totalIn) * 100).toFixed(1) : '0.0';

  console.log(`Optimized ${converted.length} PNG files → WebP (lossless).`);
  console.log(`Input: ${formatBytes(totalIn)}  Output: ${formatBytes(totalOut)}  Saved: ${formatBytes(saved)} (${pct}%)`);
  console.log(`Skipped: ${skipped.length}  Time: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

