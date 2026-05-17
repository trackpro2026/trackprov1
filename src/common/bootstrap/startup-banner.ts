import { API_PREFIX, SWAGGER_PATH } from '../constants/api.constants';

/** Chrome offline game palette (ANSI 256). */
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  bg: '\x1b[48;5;255m',
  ink: '\x1b[38;5;240m',
  inkDark: '\x1b[38;5;238m',
  dino: '\x1b[38;5;240m',
  cactus: '\x1b[38;5;245m',
  ground: '\x1b[38;5;250m',
  accent: '\x1b[38;5;34m',
  warn: '\x1b[38;5;214m',
  line: '\x1b[38;5;252m',
};

function row(text: string): string {
  return `${C.bg}${text}${C.reset}`;
}

/**
 * Pixel-style banner inspired by Chrome's offline dinosaur game.
 * Printed once after the server is listening.
 */
export function printStartupBanner(port: number, swaggerEnabled: boolean): void {
  const base = `http://localhost:${port}`;
  const apiBase = `${base}/${API_PREFIX}`;

  const art = [
    row('                                                                                    '),
    row(`  ${C.dino}██╗${C.reset}${C.bg}     ${C.cactus}▐█${C.reset}${C.bg}   ${C.dino}▄█████████▄${C.reset}${C.bg}                              `),
    row(`  ${C.dino}██║${C.reset}${C.bg}     ${C.cactus}▐█${C.reset}${C.bg}  ${C.dino}██${C.inkDark}▓▓▓▓▓▓${C.dino}██${C.reset}${C.bg}   ${C.dim}NO INTERNET?${C.reset}${C.bg}  ${C.accent}TRACKPRO ONLINE!${C.reset}${C.bg}     `),
    row(`  ${C.dino}██║${C.reset}${C.bg}     ${C.cactus}██${C.reset}${C.bg}  ${C.dino}██${C.inkDark}▓▓${C.dino}██${C.inkDark}▓▓${C.dino}██${C.reset}${C.bg}   ${C.dim}─────────────${C.reset}${C.bg}  ${C.dim}──────────────${C.reset}${C.bg}  `),
    row(`  ${C.dino}╚═╝${C.reset}${C.bg}        ${C.cactus}▀${C.reset}${C.bg}  ${C.dino}██${C.inkDark}▓▓${C.dino}██████${C.reset}${C.bg}   ${C.ink}Livestock API · Farmers · Vets · Animals${C.reset}${C.bg}      `),
    row(`  ${C.dino}▄▄${C.reset}${C.bg}           ${C.dino}██${C.inkDark}▓▓▓▓${C.dino}██${C.reset}${C.bg}                                          `),
    row(`     ${C.dino}▀▀${C.reset}${C.bg}           ${C.dino}██${C.inkDark}▓▓${C.dino}██${C.reset}${C.bg}     ${C.ground}▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄${C.reset}${C.bg}  `),
    row(`                    ${C.dino}▀▀${C.reset}${C.bg}     ${C.ground}▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀${C.reset}${C.bg}  `),
    row('                                                                                    '),
  ];

  const lines = [
    '',
    ...art,
    `  ${C.bold}${C.ink}▸${C.reset} ${C.bold}API${C.reset}      ${C.accent}${apiBase}${C.reset}`,
    `  ${C.bold}${C.ink}▸${C.reset} ${C.bold}Health${C.reset}   ${base}/health`,
  ];

  if (swaggerEnabled) {
    lines.push(
      `  ${C.bold}${C.ink}▸${C.reset} ${C.bold}Swagger${C.reset}  ${C.accent}${base}/${SWAGGER_PATH}${C.reset}`,
    );
  }

  lines.push(
    `  ${C.dim}Press SPACE to jump… (just kidding — you're connected.)${C.reset}`,
    '',
  );

  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}
