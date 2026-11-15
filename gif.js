'use strict';

// GIF89a with a single RGB palette shared by every frame.
function createGifEncoder(size) {
  const chunks = [];
  const bytes = (...values) => chunks.push(Uint8Array.from(values));
  const word = value => bytes(value & 255, value >> 8);
  const ascii = value => bytes(...Array.from(value, char => char.charCodeAt(0)));
  ascii('GIF89a');
  word(size);
  word(size);
  bytes(0xf7, 0, 0);
  const palette = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    palette[i * 3] = Math.round((i >> 5) * 255 / 7);
    palette[i * 3 + 1] = Math.round(((i >> 2) & 7) * 255 / 7);
    palette[i * 3 + 2] = (i & 3) * 85;
  }
  chunks.push(palette);
  bytes(0x21, 0xff, 11);
  ascii('NETSCAPE2.0');
  bytes(3, 1, 0, 0, 0);

  return {
    addFrame(rgba) {
      bytes(0x21, 0xf9, 4, 4, 10, 0, 0, 0);
      bytes(0x2c, 0, 0, 0, 0);
      word(size);
      word(size);
      bytes(0, 8);
      // Reset before the LZW dictionary grows past nine-bit codes.
      const packed = new Uint8Array(Math.ceil((size * size + Math.ceil(size * size / 250) + 1) * 9 / 8));
      let offset = 0, bits = 0, bitCount = 0;
      function write(code) {
        bits |= code << bitCount;
        bitCount += 9;
        while (bitCount >= 8) {
          packed[offset++] = bits & 255;
          bits >>= 8;
          bitCount -= 8;
        }
      }
      const pattern = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let i = 0; i < size * size; i++) {
        if (i % 250 === 0) write(256);
        const dither = (pattern[((Math.floor(i / size) & 3) << 2) | ((i % size) & 3)] + 0.5) / 16 - 0.5;
        const r = Math.max(0, Math.min(7, Math.round(rgba[i * 4] * 7 / 255 + dither)));
        const g = Math.max(0, Math.min(7, Math.round(rgba[i * 4 + 1] * 7 / 255 + dither)));
        const b = Math.max(0, Math.min(3, Math.round(rgba[i * 4 + 2] * 3 / 255 + dither)));
        write((r << 5) | (g << 2) | b);
      }
      write(257);
      if (bitCount) packed[offset++] = bits;
      for (let i = 0; i < offset; i += 255) {
        const block = packed.subarray(i, Math.min(i + 255, offset));
        bytes(block.length);
        chunks.push(block);
      }
      bytes(0);
    },
    finish() {
      bytes(0x3b);
      return new Blob(chunks, {type: 'image/gif'});
    }
  };
}
