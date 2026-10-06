// Welcome banner written into the terminal on connect. Built from a 5x7 bitmap
// font (each row is generated, not typed, so alignment is guaranteed) and coloured
// with a real 24-bit ANSI gradient across the rows, brand emerald to lime.
const FONT = {
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  A: ['..#..', '.#.#.', '#...#', '#####', '#...#', '#...#', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
};

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

function buildAsciiBanner(word) {
  const height = 7;
  const letters = word.split('').map((ch) => (ch === ' ' ? Array(height).fill('...') : FONT[ch]));
  const from = [52, 211, 153];
  const to = [163, 230, 53];
  const lines = [];
  for (let r = 0; r < height; r++) {
    const raw = letters.map((l) => l[r]).join(' ').replace(/\./g, ' ').replace(/#/g, '█');
    const t = r / (height - 1);
    lines.push(`\x1b[38;2;${lerp(from[0], to[0], t)};${lerp(from[1], to[1], t)};${lerp(from[2], to[2], t)}m${raw}\x1b[0m`);
  }
  return lines.join('\r\n');
}

module.exports = { buildAsciiBanner, ASCII_BANNER: buildAsciiBanner('DEBO LABS') };
