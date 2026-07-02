import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';

type DashboardData = {
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    excerpt: string;
    content?: string;
    html?: string;
    path: string;
    type?: string;
  }>;
};

type ProjectRegistry = {
  projects?: Array<{
    id?: string;
    name?: string;
    description?: string;
    paths?: Record<string, string>;
    domains?: string[];
    matrixRooms?: Array<{ name?: string; roomId?: string; purpose?: string }>;
    daemons?: Array<{ name?: string; label?: string }>;
    semanticIdentityProbes?: Array<{ type?: string; value?: string }>;
  }>;
};

const root = process.cwd();
const distDir = join(root, 'dist');
const dataPath = join(root, 'src/data/vault-dashboard.json');
const summaryDirPath = join(root, 'src/data/vault-dashboard-summaries');
const registryPath = join(process.env.VAULT_DASHBOARD_VAULT ?? join(homedir(), 'Documents/Sunthings_AppStorage_EU_e2e'), '_System/PAI/Identity/project-registry.json');

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
    for (const value of [item.id, item.title, item.subtitle, item.excerpt, item.path, item.content ?? '', item.html ?? '']) {
      const clean = value.replace(/\s+/g, ' ').trim();
      if (clean.length >= 24) {
        addTokenVariants(tokens, clean.slice(0, 90));
      }
    }
  }
  tokens.add('Rupicola OS');
  tokens.add('Vault Quest Log');
  return [...tokens];
}

function addTokenVariants(tokens: Set<string>, token: string): void {
  tokens.add(token);
  tokens.add(token.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  tokens.add(encodeURIComponent(token));
  tokens.add(token.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'));
  tokens.add(JSON.stringify(token).slice(1, -1));
}

const PUBLIC_REGISTRY_TOKENS = new Set([
  'dyallo.se',
  'dyallose',
  'Speaksheet',
  'speaksheet',
  'speaksheet.app',
  'sias-lens',
  'Skattata',
  'skattata',
  'services',
]);

function isHighSignalRegistryToken(token: string, force = false): boolean {
  if (PUBLIC_REGISTRY_TOKENS.has(token)) return false;
  return (
    force ||
    token.length >= 24 ||
    token.startsWith('/Users/') ||
    token.startsWith('com.pai.') ||
    token.startsWith('!') ||
    token.includes('/_System/') ||
    token.includes('/Code/') ||
    token.includes('/services/')
  );
}

async function registryPrivateTokens(required: boolean): Promise<string[]> {
  if (!existsSync(registryPath)) {
    if (required) throw new Error(`Registry-derived dashboard items exist, but registry file is missing: ${registryPath}`);
    return [];
  }
  const registry = JSON.parse(await readFile(registryPath, 'utf8')) as ProjectRegistry;
  const projectCount = registry.projects?.length ?? 0;
  const tokens = new Set<string>();
  const forcedTokens = new Set<string>();
  const addRegistryToken = (value: string | undefined, force = false) => {
    if (!value) return;
    tokens.add(value);
    if (force) forcedTokens.add(value);
  };
  for (const project of registry.projects ?? []) {
    addRegistryToken(project.id, true);
    addRegistryToken(project.name, true);
    addRegistryToken(project.description);
    for (const value of Object.values(project.paths ?? {})) addRegistryToken(value, true);
    for (const value of project.domains ?? []) addRegistryToken(value, true);
    for (const room of project.matrixRooms ?? []) addRegistryToken(room.roomId, true);
    for (const room of project.matrixRooms ?? []) addRegistryToken(room.name, true);
    for (const room of project.matrixRooms ?? []) addRegistryToken(room.purpose);
    for (const daemon of project.daemons ?? []) addRegistryToken(daemon.label, true);
    for (const daemon of project.daemons ?? []) addRegistryToken(daemon.name, true);
    for (const probe of project.semanticIdentityProbes ?? []) addRegistryToken(probe.value, true);
  }
  const expanded = new Set<string>();
  for (const token of tokens) {
    if (isHighSignalRegistryToken(token, forcedTokens.has(token))) addTokenVariants(expanded, token);
  }
  if (required && projectCount > 0 && expanded.size === 0) throw new Error('Registry-derived dashboard items exist, but registry privacy token set is empty.');
  return [...expanded];
}

function assertGeneratedDataGitHygiene(): void {
  const generatedPaths = ['src/data/vault-dashboard.json', 'src/data/vault-dashboard-summaries'];
  for (const generatedPath of generatedPaths) {
    try {
      execFileSync('git', ['check-ignore', '-q', generatedPath], { cwd: root, stdio: 'ignore', timeout: 10_000 });
    } catch {
      throw new Error(`${generatedPath} must be gitignored because it can contain private generated dashboard data.`);
    }
  }

  try {
    const tracked = execFileSync('git', ['ls-files', '--', 'src/data/vault-dashboard.json', 'src/data/vault-dashboard-summaries'], { cwd: root, encoding: 'utf8', timeout: 10_000 })
      .trim()
      .split('\n')
      .filter(Boolean);
    if (tracked.length > 0) throw new Error(`${tracked.join(', ')} tracked by git but must remain untracked/private.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('tracked by git')) throw error;
    if (error instanceof Error && error.message.includes('untracked/private')) throw error;
  }
}

async function main() {
  if (!existsSync(distDir)) throw new Error('dist/ does not exist. Run astro build first.');
  if (!existsSync(dataPath)) throw new Error('Dashboard data does not exist. Run dashboard:generate first.');
  if (!existsSync(summaryDirPath)) throw new Error('Dashboard summaries do not exist. Run dashboard:generate first.');

  const data = JSON.parse(await readFile(dataPath, 'utf8')) as DashboardData;
  assertGeneratedDataGitHygiene();
  const hasRegistryItems = data.items.some((item) => item.type === 'registry-project' || item.type === 'registry-service' || item.type === 'repo-activity');
  const registryTokens = await registryPrivateTokens(hasRegistryItems);
  const files = (await walkFiles(distDir)).filter(outsideDashboard);
  const tokens = [...tokensFor(data), ...registryTokens];
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
