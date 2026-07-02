import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, normalize, sep } from 'node:path';

export type FileToolProposal =
  | {
      id: string;
      kind: 'replace';
      path: string;
      find: string;
      replace: string;
      expectedHash: string;
      createdAt: string;
      diff: string;
    }
  | {
      id: string;
      kind: 'move';
      fromPath: string;
      toPath: string;
      expectedHash: string;
      createdAt: string;
      diff: string;
    }
  | {
      id: string;
      kind: 'append';
      path: string;
      appendText: string;
      expectedHash: string;
      createdAt: string;
      diff: string;
    };

export class FileToolError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const hashText = (value: string) => createHash('sha256').update(value).digest('hex');

export function normalizeVaultPath(path: string) {
  if (typeof path !== 'string' || !path.trim()) throw new FileToolError(400, 'Vault path is required');
  if (isAbsolute(path)) throw new FileToolError(403, 'Absolute paths are not allowed');
  const normalized = normalize(path).replace(/\\/g, '/');
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new FileToolError(403, 'Path escaped vault root');
  }
  return normalized.replace(/^\.\//, '');
}

export function isImmutableSourcePath(path: string) {
  return normalizeVaultPath(path).toLowerCase().startsWith('sources/');
}

export function vaultFullPath(vaultDir: string, path: string) {
  const normalizedPath = normalizeVaultPath(path);
  const fullPath = normalize(join(vaultDir, normalizedPath));
  const root = normalize(vaultDir.endsWith(sep) ? vaultDir : `${vaultDir}${sep}`);
  if (!fullPath.startsWith(root)) throw new FileToolError(403, 'Path escaped vault root');
  return { normalizedPath, fullPath };
}

function assertMutablePath(path: string) {
  if (isImmutableSourcePath(path)) throw new FileToolError(403, 'Sources/ is immutable by default');
}

async function readText(vaultDir: string, path: string) {
  const { normalizedPath, fullPath } = vaultFullPath(vaultDir, path);
  const content = await readFile(fullPath, 'utf8').catch((error) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new FileToolError(404, 'Vault file not found');
    throw error;
  });
  return { normalizedPath, fullPath, content };
}

function appendDiff(path: string, before: string, appendText: string) {
  const tail = before.split('\n').slice(-6).join('\n');
  return [`--- a/${path}`, `+++ b/${path}`, '@@ append @@', tail, appendText.trimEnd()].join('\n');
}

function replaceDiff(path: string, find: string, replace: string) {
  return [`--- a/${path}`, `+++ b/${path}`, '@@ replace @@', `-${find}`, `+${replace}`].join('\n');
}

function moveDiff(fromPath: string, toPath: string) {
  return [`--- a/${fromPath}`, `+++ b/${toPath}`, '@@ move @@', `rename from ${fromPath}`, `rename to ${toPath}`].join('\n');
}

function countMatches(content: string, find: string) {
  let count = 0;
  let index = content.indexOf(find);
  while (index !== -1) {
    count += 1;
    index = content.indexOf(find, index + find.length);
  }
  return count;
}

export async function findVaultFiles(vaultDir: string, query: string, limit = 25) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) throw new FileToolError(400, 'Find query is required');
  if (normalizedQuery === '..' || normalizedQuery.startsWith('../') || normalizedQuery.includes('/../')) {
    throw new FileToolError(403, 'Path escaped vault root');
  }
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const results: Array<{ path: string; size: number; modifiedAt: string }> = [];

  async function walk(relativeDir: string) {
    if (results.length >= limit) return;
    const fullPath = relativeDir ? vaultFullPath(vaultDir, relativeDir).fullPath : vaultDir;
    const entries = await readdir(fullPath, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= limit) return;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(relativePath);
        continue;
      }
      if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.md') continue;
      const haystack = relativePath.toLowerCase();
      if (!terms.every((term) => haystack.includes(term))) continue;
      const fileStat = await stat(join(vaultDir, relativePath));
      results.push({ path: relativePath, size: fileStat.size, modifiedAt: fileStat.mtime.toISOString() });
    }
  }

  await walk('');
  return results;
}

export async function readVaultFile(vaultDir: string, path: string, maxChars = 12000) {
  const { normalizedPath, content } = await readText(vaultDir, path);
  return { path: normalizedPath, content: content.slice(0, maxChars), truncated: content.length > maxChars, hash: hashText(content) };
}

export async function proposeAppend(vaultDir: string, path: string, appendText: string): Promise<FileToolProposal> {
  const { normalizedPath, content } = await readText(vaultDir, path);
  assertMutablePath(normalizedPath);
  if (!appendText.trim()) throw new FileToolError(400, 'Append text is required');
  return {
    id: randomUUID(),
    kind: 'append',
    path: normalizedPath,
    appendText,
    expectedHash: hashText(content),
    createdAt: new Date().toISOString(),
    diff: appendDiff(normalizedPath, content, appendText),
  };
}

export async function proposeReplace(vaultDir: string, path: string, find: string, replace: string): Promise<FileToolProposal> {
  const { normalizedPath, content } = await readText(vaultDir, path);
  assertMutablePath(normalizedPath);
  if (!find) throw new FileToolError(400, 'Find text is required');
  const matches = countMatches(content, find);
  if (matches === 0) throw new FileToolError(404, 'Find text was not found in the file');
  if (matches > 1) throw new FileToolError(409, 'Find text matches multiple locations; use a more specific selection');
  return {
    id: randomUUID(),
    kind: 'replace',
    path: normalizedPath,
    find,
    replace,
    expectedHash: hashText(content),
    createdAt: new Date().toISOString(),
    diff: replaceDiff(normalizedPath, find, replace),
  };
}

export async function proposeMove(vaultDir: string, fromPath: string, toPath: string): Promise<FileToolProposal> {
  const from = await readText(vaultDir, fromPath);
  const to = vaultFullPath(vaultDir, toPath);
  assertMutablePath(from.normalizedPath);
  assertMutablePath(to.normalizedPath);
  if (existsSync(to.fullPath)) throw new FileToolError(409, 'Destination already exists');
  return {
    id: randomUUID(),
    kind: 'move',
    fromPath: from.normalizedPath,
    toPath: to.normalizedPath,
    expectedHash: hashText(from.content),
    createdAt: new Date().toISOString(),
    diff: moveDiff(from.normalizedPath, to.normalizedPath),
  };
}

export async function applyFileToolProposal(vaultDir: string, proposal: FileToolProposal) {
  if (proposal.kind === 'move') {
    const from = await readText(vaultDir, proposal.fromPath);
    const to = vaultFullPath(vaultDir, proposal.toPath);
    assertMutablePath(from.normalizedPath);
    assertMutablePath(to.normalizedPath);
    if (hashText(from.content) !== proposal.expectedHash) throw new FileToolError(409, 'File changed since proposal was created');
    if (existsSync(to.fullPath)) throw new FileToolError(409, 'Destination already exists');
    await mkdir(dirname(to.fullPath), { recursive: true });
    await rename(from.fullPath, to.fullPath);
    return { status: 'applied' as const, changedFiles: [proposal.fromPath, proposal.toPath], renderState: 'stale' as const };
  }

  const current = await readText(vaultDir, proposal.path);
  assertMutablePath(current.normalizedPath);
  if (hashText(current.content) !== proposal.expectedHash) throw new FileToolError(409, 'File changed since proposal was created');
  const next = proposal.kind === 'append'
    ? current.content + proposal.appendText
    : current.content.replace(proposal.find, () => proposal.replace);
  await writeFile(current.fullPath, next, 'utf8');
  return { status: 'applied' as const, changedFiles: [proposal.path], renderState: 'stale' as const };
}
