export const rupicolaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <path d="M33 5c-7 2-12 8-14 16 5-3 10-4 16-3 4 1 8 3 11 7-1-10-6-17-13-20Z" fill="currentColor"/>
  <path d="M18 24c-6 4-9 10-9 17 0 8 6 14 15 16 11 2 22-4 27-15-9 4-18 3-26-2-6-4-8-9-7-16Z" fill="currentColor"/>
  <path d="M34 20c8 1 14 6 18 14l7-5c-5-5-12-8-20-9h-5Z" fill="currentColor"/>
  <path d="M27 25c4-2 9-1 12 2-3 4-9 5-14 2 .4-1.6 1-2.9 2-4Z" fill="#0F0B0A"/>
  <path d="M29 22c-2 1-4 3-5 6 2-1 5-1 8 1 5 3 11 3 16 1-4-5-11-9-19-8Z" fill="currentColor"/>
  <path d="M24 57h19" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
</svg>`;

export function getRupicolaDataUri() {
  const svg = rupicolaSvg.replaceAll('currentColor', '#E0531C');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
