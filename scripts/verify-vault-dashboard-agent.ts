import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type AgentProcess = ReturnType<typeof Bun.spawn>;

const PORT = 33104;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function request(path: string, body: Record<string, unknown>, status = 200) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://vault.dyallo.se' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status !== status) {
    throw new Error(`${path} expected ${status}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return data as Record<string, any>;
}

async function waitForHealth(process: AgentProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) return;
    } catch {
      // Service may not have bound the port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const exitCode = await Promise.race([process.exited, new Promise((resolve) => setTimeout(() => resolve(null), 0))]);
  if (exitCode !== null) throw new Error(`vault-dashboard-agent exited before becoming healthy: ${exitCode}`);
  throw new Error('vault-dashboard-agent did not become healthy');
}

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), 'vault-agent-test-'));
  const vaultDir = join(tempRoot, 'vault');
  const dataPath = join(tempRoot, 'vault-dashboard.json');
  const knowledgePath = join(vaultDir, 'Knowledge/Test Note.md');
  const sourcePath = join(vaultDir, 'sources/Source Note.md');
  let agent: AgentProcess | null = null;

  try {
    await mkdir(join(vaultDir, 'Knowledge'), { recursive: true });
    await mkdir(join(vaultDir, 'sources'), { recursive: true });
    await writeFile(knowledgePath, '# Test Note\n\nOriginal body.\n', 'utf8');
    await writeFile(sourcePath, '# Source Note\n\nImmutable body.\n', 'utf8');
    await writeFile(
      dataPath,
      `${JSON.stringify({
        items: [
          { id: 'knowledge-test-note', title: 'Test Note', subtitle: 'Knowledge fixture', path: 'Knowledge/Test Note.md', excerpt: 'Original body.' },
          { id: 'source-test-note', title: 'Source Note', subtitle: 'Source fixture', path: 'sources/Source Note.md', excerpt: 'Immutable body.' },
        ],
      })}\n`,
      'utf8',
    );

    agent = Bun.spawn(['bun', 'scripts/vault-dashboard-agent.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VAULT_DASHBOARD_AGENT_PORT: String(PORT),
        VAULT_DASHBOARD_AGENT_HOST: '127.0.0.1',
        VAULT_DASHBOARD_VAULT: vaultDir,
        VAULT_DASHBOARD_DATA_PATH: dataPath,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await waitForHealth(agent);

    await request('/dashboard/agent/context', { itemId: 'knowledge-test-note' });

    const diff = await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'append: verified temp apply' });
    if (!diff.proposal?.id || !String(diff.proposal.diff || '').includes('verified temp apply')) throw new Error('diff proposal missing expected content');
    const applied = await request('/dashboard/agent/apply', { proposalId: diff.proposal.id });
    if (applied.renderState !== 'stale' || !applied.changedFiles?.includes('Knowledge/Test Note.md')) throw new Error('apply did not report stale changed file');
    const appliedContent = await readFile(knowledgePath, 'utf8');
    if (!appliedContent.includes('verified temp apply')) throw new Error('apply did not mutate temp knowledge note');

    const drift = await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'append: should drift conflict' });
    await writeFile(knowledgePath, `${await readFile(knowledgePath, 'utf8')}\nExternal edit.\n`, 'utf8');
    await request('/dashboard/agent/apply', { proposalId: drift.proposal.id }, 409);

    await request('/dashboard/agent/chat', { itemId: 'source-test-note', message: 'append: reject source write' }, 403);
    const sourceContent = await readFile(sourcePath, 'utf8');
    if (sourceContent.includes('reject source write')) throw new Error('source note was mutated');

    await request('/dashboard/agent/context', { itemId: '../etc/passwd' }, 404);

    const csrfResponse = await fetch(`${BASE_URL}/dashboard/agent/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Origin: 'https://evil.example' },
      body: JSON.stringify({ itemId: 'knowledge-test-note' }),
    });
    if (csrfResponse.status !== 415) throw new Error(`expected CSRF/content-type probe 415, got ${csrfResponse.status}`);

    console.log('Vault dashboard agent temp-vault probes passed.');
  } finally {
    agent?.kill();
    await agent?.exited.catch(() => undefined);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
