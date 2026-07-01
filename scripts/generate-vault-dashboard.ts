import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, relative } from 'node:path';

type ActivityType =
  | 'sias-lens'
  | 'ingestion'
  | 'journal'
  | 'dream'
  | 'conversation'
  | 'project'
  | 'knowledge'
  | 'daemon-update'
  | 'daemon-status';

type SearchFields = {
  title: string;
  headings: string;
  bold: string;
  tags: string;
  path: string;
  body: string;
};

type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  timestamp: string;
  path: string;
  tags: string[];
  excerpt: string;
  content: string;
  html: string;
  obsidianUrl: string;
  sourceUrl: string;
  person?: 'oren' | 'watashi';
  status?: 'ok' | 'stale' | 'unknown' | 'down';
  summary: SummaryBrief;
  search: SearchFields;
};

type SummaryBrief = {
  status: 'cached' | 'generated' | 'error';
  summary: string;
  key_points: string[];
  action_items: string[];
  tags: string[];
  updated_at: string;
};

const VAULT_DIR = process.env.VAULT_DASHBOARD_VAULT ?? join(homedir(), 'Documents/Sunthings_AppStorage_EU_e2e');
const OUT_FILE = join(process.cwd(), 'src/data/vault-dashboard.json');
const SUMMARY_DIR = process.env.VAULT_DASHBOARD_SUMMARY_DIR ?? join(process.cwd(), 'src/data/vault-dashboard-summaries');
const VAULT_NAME = 'Sunthings_AppStorage_EU_e2e';
const SUMMARY_VERSION = 1;

const LIMITS: Record<ActivityType, number> = {
  'sias-lens': 30,
  ingestion: 90,
  journal: 90,
  dream: 60,
  conversation: 80,
  project: 90,
  knowledge: 90,
  'daemon-update': 80,
  'daemon-status': 40,
};

const TYPE_LABELS: Record<ActivityType, string> = {
  'sias-lens': "Sia's Lens",
  ingestion: 'Vault Ingestion',
  journal: 'Journal',
  dream: 'Dream Journal',
  conversation: 'Conversation',
  project: 'Project Work',
  knowledge: 'Knowledge Update',
  'daemon-update': 'Daemon Update',
  'daemon-status': 'Daemon Status',
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

function stripMarkdown(markdown: string): string {
  return stripFrontmatter(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '$2$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(input: string, max = 220): string {
  const clean = input.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function contentHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function summarySidecarPath(vaultPath: string, hash: string): string {
  const id = createHash('sha256').update(`${vaultPath}\0${hash}`).digest('hex').slice(0, 24);
  return join(SUMMARY_DIR, `${id}.json`);
}

function splitSentences(input: string): string[] {
  return input
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 24);
}

function cleanSummaryLine(input: string): string {
  return stripMarkdown(input).replace(/\s+/g, ' ').trim();
}

function extractSummarySection(markdown: string): string {
  const body = stripFrontmatter(markdown);
  const match = body.match(/^##\s+Summary\s*\n([\s\S]*?)(?=^##\s+|\s*$)/im);
  return match ? cleanSummaryLine(match[1]) : '';
}

function extractActionItems(markdown: string): string[] {
  return stripFrontmatter(markdown)
    .split('\n')
    .map((line) => cleanSummaryLine(line.replace(/^[-*]\s+/, '')))
    .filter((line) => /\b(action|todo|to do|next|follow[- ]?up|pending|awaiting|needs?|should|must)\b/i.test(line))
    .slice(0, 5);
}

function deriveSummary(markdown: string, tags: string[]): Omit<SummaryBrief, 'status' | 'updated_at'> {
  const fm = extractFrontmatter(markdown);
  const frontmatterSummary = typeof fm.summary === 'string' ? cleanSummaryLine(fm.summary) : '';
  const summarySection = extractSummarySection(markdown);
  const body = stripMarkdown(markdown);
  const sentences = splitSentences(body);
  const summary = truncate(frontmatterSummary || summarySection || sentences.slice(0, 2).join(' ') || body, 520);
  const headings = extractHeadings(markdown).filter((heading) => !/^summary$/i.test(heading)).slice(0, 5);
  const key_points = (headings.length ? headings : sentences.slice(0, 5)).map((point) => truncate(point, 180));
  const action_items = extractActionItems(markdown).map((item) => truncate(item, 180));

  return {
    summary,
    key_points: key_points.length ? key_points : [truncate(body || 'No readable text extracted.', 180)],
    action_items,
    tags: tags.slice(0, 8),
  };
}

function isSummarySidecar(value: unknown, hash: string): value is SummaryBrief & { content_hash: string; version: number } {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === SUMMARY_VERSION &&
    record.content_hash === hash &&
    typeof record.summary === 'string' &&
    Array.isArray(record.key_points) &&
    Array.isArray(record.action_items) &&
    Array.isArray(record.tags) &&
    typeof record.updated_at === 'string'
  );
}

function loadOrCreateSummary(vaultPath: string, markdown: string, tags: string[]): SummaryBrief {
  const hash = contentHash(markdown);
  const sidecarPath = summarySidecarPath(vaultPath, hash);
  try {
    if (existsSync(sidecarPath)) {
      const parsed = JSON.parse(readFileSync(sidecarPath, 'utf8'));
      if (isSummarySidecar(parsed, hash)) {
        return {
          status: 'cached',
          summary: parsed.summary,
          key_points: parsed.key_points,
          action_items: parsed.action_items,
          tags: parsed.tags,
          updated_at: parsed.updated_at,
        };
      }
    }

    const derived = deriveSummary(markdown, tags);
    const updated_at = new Date().toISOString();
    mkdirSync(SUMMARY_DIR, { recursive: true });
    writeFileSync(
      sidecarPath,
      `${JSON.stringify({ version: SUMMARY_VERSION, path: vaultPath, content_hash: hash, updated_at, ...derived }, null, 2)}\n`,
      'utf8',
    );
    return { status: 'generated', updated_at, ...derived };
  } catch {
    return { status: 'error', updated_at: new Date().toISOString(), ...deriveSummary(markdown, tags) };
  }
}

function extractFrontmatter(markdown: string): Record<string, string | string[]> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const values: Record<string, string | string[]> = {};
  const lines = match[1].split('\n');
  let activeArray: string | null = null;
  for (const line of lines) {
    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyValue) {
      activeArray = null;
      const [, key, rawValue] = keyValue;
      const value = rawValue.trim().replace(/^['"]|['"]$/g, '');
      if (value === '') {
        values[key] = [];
        activeArray = key;
      } else if (value.startsWith('[') && value.endsWith(']')) {
        values[key] = value
          .slice(1, -1)
          .split(',')
          .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      } else {
        values[key] = value;
      }
      continue;
    }
    const arrayItem = line.match(/^\s*-\s*(.*)$/);
    if (arrayItem && activeArray) {
      const current = values[activeArray];
      if (Array.isArray(current)) current.push(arrayItem[1].trim().replace(/^['"]|['"]$/g, ''));
    }
  }
  return values;
}

function extractHeadings(markdown: string): string[] {
  return [...stripFrontmatter(markdown).matchAll(/^#{1,3}\s+(.+)$/gm)].map((match) => match[1].trim());
}

function extractBold(markdown: string): string[] {
  return [...markdown.matchAll(/\*\*([^*]+)\*\*/g)].map((match) => match[1].trim());
}

function markdownToHtml(markdown: string): string {
  const lines = stripFrontmatter(markdown).split('\n');
  const html: string[] = [];
  let inList = false;
  let inCode = false;
  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };
  const inline = (value: string) =>
    escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1');

  for (const line of lines) {
    if (line.startsWith('```')) {
      closeList();
      if (inCode) html.push('</code></pre>');
      else html.push('<pre><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (listItem) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inline(listItem[1])}</li>`);
      continue;
    }
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      closeList();
      html.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }
    if (line.trim() === '') {
      closeList();
      continue;
    }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  if (inCode) html.push('</code></pre>');
  return html.join('\n');
}

function dateFromText(input: string): string | null {
  const compact = input.match(/(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/);
  if (!compact) return null;
  const [, year, month, day] = compact;
  return `${year}-${month}-${day}T12:00:00.000Z`;
}

async function safeRead(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

async function walkMarkdown(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(fullPath)));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      files.push(fullPath);
    }
  }
  return files;
}

function obsidianUrl(path: string): string {
  return `obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}&file=${encodeURIComponent(path)}`;
}

function sourceUrl(id: string): string {
  return `/dashboard/item/${id}`;
}

function makeItem(input: {
  type: ActivityType;
  title: string;
  subtitle?: string;
  timestamp: string;
  path: string;
  markdown: string;
  tags?: string[];
  person?: 'oren' | 'watashi';
  status?: 'ok' | 'stale' | 'unknown' | 'down';
  idSeed?: string;
}): ActivityItem {
  const headings = extractHeadings(input.markdown);
  const bold = extractBold(input.markdown);
  const body = stripMarkdown(input.markdown);
  const title = input.title || headings[0] || basename(input.path, '.md');
  const subtitle = input.subtitle || headings.find((heading) => heading !== title) || TYPE_LABELS[input.type];
  const tags = input.tags ?? [];
  const id = slugify(`${input.type}-${input.timestamp}-${input.idSeed ?? input.path}-${title}`);
  return {
    id,
    type: input.type,
    title,
    subtitle,
    timestamp: input.timestamp,
    path: input.path,
    tags,
    excerpt: truncate(body),
    content: stripFrontmatter(input.markdown),
    html: markdownToHtml(input.markdown),
    obsidianUrl: obsidianUrl(input.path),
    sourceUrl: sourceUrl(id),
    person: input.person,
    status: input.status,
    summary: loadOrCreateSummary(input.path, input.markdown, tags),
    search: {
      title,
      headings: headings.join(' '),
      bold: bold.join(' '),
      tags: tags.join(' '),
      path: input.path.replace(/[/-]/g, ' '),
      body,
    },
  };
}

async function fileItem(type: ActivityType, fullPath: string, fallbackSubtitle?: string): Promise<ActivityItem> {
  const markdown = await safeRead(fullPath);
  const relPath = relative(VAULT_DIR, fullPath);
  const fm = extractFrontmatter(markdown);
  const fileStats = await stat(fullPath);
  const timestamp = dateFromText(relPath) ?? fileStats.mtime.toISOString();
  const title = typeof fm.title === 'string' ? fm.title : extractHeadings(markdown)[0] || basename(fullPath, '.md');
  const tags = Array.isArray(fm.tags) ? fm.tags : [];
  const summary = typeof fm.summary === 'string' ? fm.summary : undefined;
  return makeItem({
    type,
    title,
    subtitle: summary ?? fallbackSubtitle,
    timestamp,
    path: relPath,
    markdown,
    tags,
  });
}

async function collectFiles(type: ActivityType, root: string, subtitle?: string): Promise<ActivityItem[]> {
  const files = await walkMarkdown(root);
  const items = await Promise.all(files.map((file) => fileItem(type, file, subtitle)));
  return newest(items).slice(0, LIMITS[type]);
}

function newest(items: ActivityItem[]): ActivityItem[] {
  return items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

async function collectLogItems(): Promise<ActivityItem[]> {
  const fullPath = join(VAULT_DIR, '_System/log.md');
  const markdown = await safeRead(fullPath);
  const relPath = relative(VAULT_DIR, fullPath);
  const sections = markdown.split(/^## \[(\d{4}-\d{2}-\d{2})\]\s+([^|\n]+)\|\s*(.+)$/gm);
  const items: ActivityItem[] = [];
  for (let index = 1; index < sections.length; index += 4) {
    const date = sections[index];
    const operation = sections[index + 1]?.trim() ?? 'log';
    const title = sections[index + 2]?.trim() ?? 'Vault log entry';
    const body = sections[index + 3] ?? '';
    const type: ActivityType = operation.includes('ingest') ? 'ingestion' : operation.includes('daemon') ? 'daemon-update' : 'ingestion';
    items.push(
      makeItem({
        type,
        title,
        subtitle: `${operation} entry from _System/log.md`,
        timestamp: `${date}T12:00:00.000Z`,
        path: relPath,
        markdown: `# ${title}\n\n${body.trim()}`,
        tags: [operation, 'system-log'],
        idSeed: `${date}-${operation}-${index}`,
      }),
    );
  }
  return newest(items).slice(0, LIMITS.ingestion);
}

async function collectConversation(person: 'oren' | 'watashi'): Promise<ActivityItem[]> {
  const fullPath = join(VAULT_DIR, `_System/Daemons/${person}/journal.md`);
  const markdown = await safeRead(fullPath);
  const relPath = relative(VAULT_DIR, fullPath);
  const parts = markdown.split(/^##\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*$/gm);
  const items: ActivityItem[] = [];
  for (let index = 1; index < parts.length; index += 2) {
    const stamp = parts[index];
    const body = parts[index + 1]?.trim() ?? '';
    const timestamp = `${stamp.replace(' ', 'T')}:00.000Z`;
    const firstIn = body.match(/^In:\s*(.+)$/m)?.[1];
    const firstOut = body.match(/^Out:\s*(.+)$/m)?.[1];
    const title = `${person === 'oren' ? 'Oren' : 'Watashi'} conversation`;
    const subtitle = truncate(firstIn ?? firstOut ?? 'Persona journal entry', 120);
    items.push(
      makeItem({
        type: 'conversation',
        title,
        subtitle,
        timestamp,
        path: relPath,
        markdown: `# ${title}\n\n${body}`,
        tags: ['conversation', person, 'persona'],
        person,
        idSeed: `${person}-${stamp}-${index}`,
      }),
    );
  }
  return newest(items).slice(0, LIMITS.conversation);
}

async function collectDaemonStatus(): Promise<ActivityItem[]> {
  const registryPath = join(VAULT_DIR, '_System/CLAUDE.md');
  const registry = await safeRead(registryPath);
  const relPath = relative(VAULT_DIR, registryPath);
  const rows = [...registry.matchAll(/^\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm)];
  const now = new Date().toISOString();
  const launchctlText = readLaunchctlList();
  return rows
    .filter((row) => row[1] !== 'Daemon')
    .map((row, index) => {
      const name = row[1].trim();
      const label = row[2].trim();
      const kind = row[3].trim();
      const schedule = row[4].trim();
      const status = daemonStatus(label, kind, schedule, launchctlText);
      return makeItem({
        type: 'daemon-status',
        title: name,
        subtitle: `${statusLabel(status)} · ${kind} · checked ${now.slice(11, 16)}Z`,
        timestamp: now,
        path: relPath,
        markdown: `# ${name}\n\n**Label:** \`${label}\`\n\n**Type:** ${kind}\n\n**Schedule:** ${schedule}`,
        tags: ['daemon', kind.toLowerCase().replace(/\s+/g, '-')],
        status,
        idSeed: `daemon-${index}-${name}`,
      });
    })
    .slice(0, LIMITS['daemon-status']);
}

function readLaunchctlList(): string {
  try {
    return execFileSync('launchctl', ['list'], { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function daemonStatus(label: string, kind: string, schedule: string, launchctlText: string): 'ok' | 'stale' | 'unknown' | 'down' {
  const normalizedKind = kind.toLowerCase();
  const normalizedSchedule = schedule.toLowerCase();
  if (normalizedKind.includes('retired')) return 'stale';
  if (normalizedKind.includes('cli') || normalizedSchedule.includes('not loaded')) return 'unknown';
  if (!launchctlText) return 'unknown';

  const line = launchctlText.split('\n').find((entry) => entry.trim().split(/\s+/)[2] === label);
  if (!line) return 'down';
  const [pid, exitCode] = line.trim().split(/\s+/);
  if (pid && pid !== '-') return 'ok';
  if (normalizedKind.includes('calendar') || normalizedKind.includes('interval')) {
    return exitCode && exitCode !== '-' && exitCode !== '0' ? 'down' : 'ok';
  }
  return exitCode === '0' ? 'stale' : 'down';
}

function statusLabel(status: 'ok' | 'stale' | 'unknown' | 'down'): string {
  return { ok: 'OK', stale: 'STALE', unknown: 'UNKNOWN', down: 'DOWN' }[status];
}

async function main() {
  if (!existsSync(VAULT_DIR)) {
    throw new Error(`Vault directory does not exist: ${VAULT_DIR}`);
  }
  const [lens, journals, dreams, projects, knowledge, logItems, oren, watashi, daemonStatus] = await Promise.all([
    collectFiles('sias-lens', join(VAULT_DIR, '_System/Daemons/sias-lens/reports'), "Sia's recurring synthesis report"),
    collectFiles('journal', join(VAULT_DIR, 'Sources/Journal'), 'Promoted journal source'),
    collectFiles('dream', join(VAULT_DIR, 'Sources/DreamJournal'), 'Dream journal source'),
    collectFiles('project', join(VAULT_DIR, 'Projects'), 'Active project note'),
    collectFiles('knowledge', join(VAULT_DIR, 'Knowledge'), 'Compiled Knowledge page'),
    collectLogItems(),
    collectConversation('oren'),
    collectConversation('watashi'),
    collectDaemonStatus(),
  ]);

  const items = newest([...lens, ...journals, ...dreams, ...projects, ...knowledge, ...logItems, ...oren, ...watashi, ...daemonStatus]);
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});

  const generatedAt = new Date().toISOString();
  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(
    OUT_FILE,
    `${JSON.stringify({ generatedAt, vault: VAULT_NAME, vaultPath: VAULT_DIR, counts, items }, null, 2)}\n`,
    'utf8',
  );
  console.log(`Generated ${items.length} dashboard activity items at ${relative(process.cwd(), OUT_FILE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
