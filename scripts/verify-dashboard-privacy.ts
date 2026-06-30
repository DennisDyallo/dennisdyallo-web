import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

type DashboardData = {
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    excerpt: string;
    path: string;
  }>;
};

const root = process.cwd();
const distDir = join(root, 'dist');
const dataPath = join(root, 'src/data/vault-dashboard.json');

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function outsideDashboard(file: string): boolean {
  const rel = relative(distDir, file);
  return !rel.startsWith(`dashboard${sep}`) && rel !== 'dashboard.html';
}

function tokensFor(data: DashboardData): string[] {
  const tokens = new Set<string>();
  for (const item of data.items) {
    for (const value of [item.id, item.title, item.subtitle, item.excerpt, item.path]) {
      const clean = value.replace(/\s+/g, ' ').trim();
      if (clean.length >= 24) {
        const token = clean.slice(0, 90);
        tokens.add(token);
        tokens.add(token.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        tokens.add(encodeURIComponent(token));
        tokens.add(token.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'));
        tokens.add(JSON.stringify(token).slice(1, -1));
      }
    }
  }
  tokens.add('Rupicola OS');
  tokens.add('Vault Quest Log');
  return [...tokens];
}

async function main() {
  if (!existsSync(distDir)) throw new Error('dist/ does not exist. Run astro build first.');
  if (!existsSync(dataPath)) throw new Error('Dashboard data does not exist. Run dashboard:generate first.');

  const data = JSON.parse(await readFile(dataPath, 'utf8')) as DashboardData;
  const files = (await walkFiles(distDir)).filter(outsideDashboard);
  const tokens = tokensFor(data);
  const leaks: string[] = [];

  for (const file of files) {
    const info = await stat(file);
    if (info.size > 8_000_000) continue;
    let content = '';
    try {
      content = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    const hit = tokens.find((token) => content.includes(token));
    if (hit) leaks.push(`${relative(root, file)} contains a private/dashboard token (${hit.length} chars)`);
  }

  if (leaks.length > 0) {
    console.error(leaks.join('\n'));
    process.exit(1);
  }
  console.log(`Dashboard privacy scan passed: ${files.length} non-dashboard files checked.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
