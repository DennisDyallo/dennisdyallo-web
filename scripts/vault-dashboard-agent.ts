import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { isAbsolute, join, normalize, sep } from 'node:path';

type DashboardItem = {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  excerpt: string;
  tags?: string[];
  summary?: { summary?: string; key_points?: string[]; action_items?: string[] };
};

type Proposal = {
  id: string;
  itemId: string;
  path: string;
  normalizedPath: string;
  fullPath: string;
  appendText: string;
  expectedHash: string;
  createdAt: string;
};

const ROOT = process.cwd();
const PORT = Number(process.env.VAULT_DASHBOARD_AGENT_PORT || 3104);
const HOST = process.env.VAULT_DASHBOARD_AGENT_HOST || '127.0.0.1';
const VAULT_DIR = process.env.VAULT_DASHBOARD_VAULT || `${process.env.HOME}/Documents/Sunthings_AppStorage_EU_e2e`;
const DASHBOARD_DATA_PATH = process.env.VAULT_DASHBOARD_DATA_PATH || join(ROOT, 'src/data/vault-dashboard.json');
const AGENT_READONLY = process.env.VAULT_DASHBOARD_AGENT_READONLY === 'true';
const ALLOWED_ORIGINS = new Set(['https://vault.dyallo.se', 'http://localhost:4321', 'http://127.0.0.1:4321']);
const proposals = new Map<string, Proposal>();

class HttpError extends Error {
  constructor(public status: number, public payload: Record<string, unknown>) {
    super(String(payload.error || 'Agent request failed'));
  }
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function loadDashboardItems(): Promise<Map<string, DashboardItem>> {
  const data = JSON.parse(await Bun.file(DASHBOARD_DATA_PATH).text()) as { items: DashboardItem[] };
  return new Map(data.items.map((item) => [item.id, item]));
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method !== 'POST') throw new HttpError(405, { error: 'Method not allowed' });
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) throw new HttpError(415, { error: 'Content-Type must be application/json' });
  assertAllowedOrigin(req);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new HttpError(400, { error: 'Invalid JSON body' });
  return body as Record<string, unknown>;
}

function assertAllowedOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) throw new HttpError(403, { error: 'Origin is not allowed' });

  const referer = req.headers.get('referer');
  if (!referer) return;
  try {
    const refererOrigin = new URL(referer).origin;
    if (!ALLOWED_ORIGINS.has(refererOrigin)) throw new HttpError(403, { error: 'Referer is not allowed' });
  } catch {
    throw new HttpError(403, { error: 'Referer is not allowed' });
  }
}

function normalizeVaultPath(path: string) {
  if (isAbsolute(path)) throw new HttpError(403, { error: 'Indexed path failed safety validation' });
  const normalized = normalize(path).replace(/\\/g, '/');
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new HttpError(403, { error: 'Indexed path failed safety validation' });
  }
  return normalized.replace(/^\.\//, '');
}

function isImmutableSourcePath(path: string) {
  return path.toLowerCase().startsWith('sources/');
}

async function resolveItem(itemId: unknown) {
  if (typeof itemId !== 'string' || !/^[a-z0-9-]+$/.test(itemId)) throw new HttpError(404, { error: 'Unknown dashboard item id' });
  const items = await loadDashboardItems();
  const item = items.get(itemId);
  if (!item) throw new HttpError(404, { error: 'Unknown dashboard item id' });
  const normalizedPath = normalizeVaultPath(item.path);

  const fullPath = normalize(join(VAULT_DIR, normalizedPath));
  const root = normalize(VAULT_DIR.endsWith(sep) ? VAULT_DIR : `${VAULT_DIR}${sep}`);
  if (!fullPath.startsWith(root)) throw new HttpError(403, { error: 'Indexed path escaped vault root' });
  return { item, fullPath, normalizedPath };
}

function contextFor(item: DashboardItem) {
  return { id: item.id, title: item.title, path: item.path, subtitle: item.subtitle, tags: item.tags || [] };
}

function labelsFor(state: string, readOnly = AGENT_READONLY) {
  const labels = [readOnly ? 'READONLY' : state];
  if (state === 'DIFF READY') labels.push('APPLY REQUIRED');
  if (state === 'APPLIED') labels.push('STALE RENDER');
  labels.push('COMMIT LOCALLY');
  return labels;
}

function answerFromItem(item: DashboardItem, message: string, selection: string) {
  const points = item.summary?.key_points?.slice(0, 4) || [];
  const actions = item.summary?.action_items?.slice(0, 3) || [];
  const selected = selection ? ` Selection noted (${selection.length} chars).` : '';
  const basis = item.summary?.summary || item.excerpt || item.subtitle;
  return [
    `Context loaded for "${item.title}".${selected}`,
    basis ? `Summary: ${basis}` : '',
    points.length ? `Key points: ${points.join(' | ')}` : '',
    actions.length ? `Action items: ${actions.join(' | ')}` : '',
    /commit|deploy/i.test(message) ? 'Commit/deploy is intentionally blocked from the browser terminal; do that locally after review.' : '',
  ].filter(Boolean).join('\n');
}

function wantsWrite(message: string) {
  return /\b(append|add|edit|change|update|write|fix)\b/i.test(message) && !/\b(summarize|explain|what|why|how)\b/i.test(message);
}

function patchTextFor(message: string) {
  const direct = message.match(/(?:append|add note|write note|note):\s*([\s\S]+)/i)?.[1]?.trim();
  const text = direct || message.trim();
  return `\n\n## Agent Terminal Note - ${new Date().toISOString()}\n\n${text}\n`;
}

function makeAppendDiff(path: string, before: string, appendText: string) {
  const tail = before.split('\n').slice(-6).join('\n');
  return [`--- a/${path}`, `+++ b/${path}`, '@@ append @@', tail, appendText.trimEnd()].join('\n');
}

async function handleContext(req: Request) {
  const body = await readBody(req);
  const { item } = await resolveItem(body.itemId);
  return json({ context: contextFor(item), labels: labelsFor('READONLY'), renderState: 'fresh' });
}

async function handleChat(req: Request) {
  const body = await readBody(req);
  const message = typeof body.message === 'string' ? body.message.slice(0, 4000) : '';
  const selection = typeof body.selection === 'string' ? body.selection.slice(0, 1200) : '';
  if (!message.trim()) return json({ error: 'Message is required' }, 400);
  const { item, fullPath, normalizedPath } = await resolveItem(body.itemId);

  if (/\b(commit|deploy|push)\b/i.test(message)) {
    return json({
      context: contextFor(item),
      labels: labelsFor('READONLY'),
      renderState: 'fresh',
      reply: 'Commit, push, and deploy are blocked in v1. Review/apply diffs here, then commit/deploy locally.',
    });
  }

  if (!wantsWrite(message)) {
    return json({ context: contextFor(item), labels: labelsFor('READONLY'), renderState: 'fresh', reply: answerFromItem(item, message, selection) });
  }

  if (AGENT_READONLY) {
    return json({
      context: contextFor(item),
      labels: labelsFor('READONLY', true),
      renderState: 'fresh',
      reply: 'Write kill switch is enabled; read-only context chat is available, but diff/apply is disabled.',
    });
  }

  if (isImmutableSourcePath(normalizedPath)) {
    return json({
      context: contextFor(item),
      labels: labelsFor('READONLY'),
      renderState: 'fresh',
      reply: 'Sources/ is immutable by default. Refusing to propose or apply a write to this source document.',
    }, 403);
  }

  const before = await Bun.file(fullPath).text();
  const appendText = patchTextFor(message);
  const proposal: Proposal = { id: randomUUID(), itemId: item.id, path: item.path, normalizedPath, fullPath, appendText, expectedHash: hash(before), createdAt: new Date().toISOString() };
  proposals.set(proposal.id, proposal);
  return json({
    context: contextFor(item),
    labels: labelsFor('DIFF READY', false),
    renderState: 'fresh',
    reply: 'Diff ready. Type apply to append this bounded note. No commit or deploy will run from the browser.',
    proposal: { id: proposal.id, createdAt: proposal.createdAt, diff: makeAppendDiff(item.path, before, appendText) },
  });
}

async function handleApply(req: Request) {
  const body = await readBody(req);
  const proposalId = typeof body.proposalId === 'string' ? body.proposalId : '';
  const proposal = proposals.get(proposalId);
  if (!proposal) return json({ error: 'No pending proposal found' }, 404);
  if (AGENT_READONLY) return json({ error: 'Write kill switch is enabled' }, 403);
  if (isImmutableSourcePath(proposal.normalizedPath)) return json({ error: 'Sources/ is immutable by default' }, 403);

  const { item } = await resolveItem(proposal.itemId);
  const before = await Bun.file(proposal.fullPath).text();
  if (hash(before) !== proposal.expectedHash) {
    proposals.delete(proposalId);
    return json({ error: 'File changed since diff was proposed; regenerate a fresh diff' }, 409);
  }

  await Bun.write(proposal.fullPath, before + proposal.appendText);
  proposals.delete(proposalId);
  return json({
    context: contextFor(item),
    labels: labelsFor('APPLIED', false),
    renderState: 'stale',
    status: 'applied',
    reply: 'Applied to the vault working tree. Dashboard render is now stale; rebuild/deploy locally when ready. No commit or deploy was run.',
    changedFiles: [proposal.path],
  });
}

if (!existsSync(DASHBOARD_DATA_PATH)) {
  throw new Error(`Dashboard manifest missing: ${DASHBOARD_DATA_PATH}. Run bun run dashboard:generate first.`);
}

Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    try {
      const url = new URL(req.url);
      if (url.pathname === '/health') return json({ status: 'healthy', service: 'vault-dashboard-agent', readonly: AGENT_READONLY });
      if (url.pathname === '/dashboard/agent/context') return await handleContext(req);
      if (url.pathname === '/dashboard/agent/chat') return await handleChat(req);
      if (url.pathname === '/dashboard/agent/apply') return await handleApply(req);
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      if (error instanceof HttpError) return json(error.payload, error.status);
      console.error(JSON.stringify({ level: 'error', message: error instanceof Error ? error.message : 'Unexpected agent error' }));
      return json({ error: 'Unexpected agent error' }, 500);
    }
  },
});

console.log(JSON.stringify({ level: 'info', message: 'vault-dashboard-agent started', host: HOST, port: PORT, readonly: AGENT_READONLY }));
