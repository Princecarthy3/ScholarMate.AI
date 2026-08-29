const fs = require('fs');
const zlib = require('zlib');

function renderScholarMateLogoPng(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdr);

  const rowSize = size * 4 + 1;
  const rawData = Buffer.alloc(rowSize * size);

  // Helper point in polygon
  function inPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Scaling factor from 100x100 SVG to size
  const s = size / 100;

  // Polygon definitions in 100x100 coordinates
  const capDiamond = [[50*s, 22*s], [82*s, 37*s], [50*s, 52*s], [18*s, 37*s]];
  const tassel = [[79*s, 38*s], [82*s, 61*s], [76*s, 61*s]];
  const aiSparkle = [[50*s, 67*s], [53*s, 73*s], [59*s, 76*s], [53*s, 79*s], [50*s, 85*s], [47*s, 79*s], [41*s, 76*s], [47*s, 73*s]];

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Normalize coordinates to 100x100
      const nx = x / s;
      const ny = y / s;

      let r = 0, g = 0, b = 0, a = 0;

      // 1. Dark Rounded Rect Badge (x:6, y:6, w:88, h:88, rx:24)
      const cornerRadius = 24 * s;
      const badgeMin = 6 * s;
      const badgeMax = 94 * s;

      let insideBadge = false;
      if (x >= badgeMin && x <= badgeMax && y >= badgeMin && y <= badgeMax) {
        let inCorner = false;
        let cX = x, cY = y;
        if (x < badgeMin + cornerRadius && y < badgeMin + cornerRadius) {
          cX = badgeMin + cornerRadius; cY = badgeMin + cornerRadius; inCorner = true;
        } else if (x > badgeMax - cornerRadius && y < badgeMin + cornerRadius) {
          cX = badgeMax - cornerRadius; cY = badgeMin + cornerRadius; inCorner = true;
        } else if (x < badgeMin + cornerRadius && y > badgeMax - cornerRadius) {
          cX = badgeMin + cornerRadius; cY = badgeMax - cornerRadius; inCorner = true;
        } else if (x > badgeMax - cornerRadius && y > badgeMax - cornerRadius) {
          cX = badgeMax - cornerRadius; cY = badgeMax - cornerRadius; inCorner = true;
        }

        if (inCorner) {
          const d2 = (x - cX) * (x - cX) + (y - cY) * (y - cY);
          if (d2 <= cornerRadius * cornerRadius) insideBadge = true;
        } else {
          insideBadge = true;
        }
      }

      if (insideBadge) {
        // Base dark blue badge #09101d
        r = 9; g = 16; b = 29; a = 255;

        // Gradient Cyan to Purple border
        const t = (nx + ny) / 200;
        const brR = Math.round(0 * (1 - t) + 121 * t);
        const brG = Math.round(242 * (1 - t) + 40 * t);
        const brB = Math.round(254 * (1 - t) + 202 * t);

        // Border check (within 3px of edge)
        const isBorder = (nx <= 9.5 || nx >= 90.5 || ny <= 9.5 || ny >= 90.5);
        if (isBorder) {
          r = brR; g = brG; b = brB;
        }

        // 2. Graduation Scholar Cap Top (Diamond)
        if (inPoly(x, y, capDiamond)) {
          const capT = (nx - 18) / 64;
          r = Math.round(56 * (1 - capT) + 192 * capT);
          g = Math.round(189 * (1 - capT) + 132 * capT);
          b = Math.round(248 * (1 - capT) + 252 * capT);
        }

        // 3. Cap Skullcap arc (M32 45 V57 C32 65 68 65 68 57 V45)
        if (nx >= 30 && nx <= 70 && ny >= 45 && ny <= 64) {
          const dyArc = ny - 57;
          const dxArc = (nx - 50) / 18;
          if (Math.abs(dyArc - (dxArc * dxArc * 6)) < 3.5) {
            r = 56; g = 189; b = 248;
          }
        }

        // 4. Tassel Cord & Drop (#F59E0B)
        if (inPoly(x, y, tassel)) {
          r = 245; g = 158; b = 11;
        }

        // 5. AI Sparkle Core (#00F2FE)
        if (inPoly(x, y, aiSparkle)) {
          r = 0; g = 242; b = 254;
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4);
  data.copy(buf, 8);
  const crc = crc32(buf.slice(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate PNG icons from ScholarMate SVG logo
fs.writeFileSync('./assets/icon-192.png', renderScholarMateLogoPng(192));
console.log('✓ Rendered ./assets/icon-192.png with ScholarMate Logo');

fs.writeFileSync('./assets/icon-512.png', renderScholarMateLogoPng(512));
console.log('✓ Rendered ./assets/icon-512.png with ScholarMate Logo');
