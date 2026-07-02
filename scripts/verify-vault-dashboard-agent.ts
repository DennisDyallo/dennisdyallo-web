import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

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
  const inferencePath = join(tempRoot, 'mock-inference.ts');
  const knowledgePath = join(vaultDir, 'Knowledge/Test Note.md');
  const deployNotesPath = join(vaultDir, 'Knowledge/deploy notes.md');
  const movePath = join(vaultDir, 'Projects/Move Me.md');
  const moveToPath = join(vaultDir, 'Projects/How to Cook.md');
  const sourcePath = join(vaultDir, 'sources/Source Note.md');
  let agent: AgentProcess | null = null;

  try {
    await mkdir(join(vaultDir, 'Knowledge'), { recursive: true });
    await mkdir(join(vaultDir, 'Projects'), { recursive: true });
    await mkdir(join(vaultDir, 'sources'), { recursive: true });
    await writeFile(knowledgePath, '# Test Note\n\nOriginal body.\n', 'utf8');
    await writeFile(deployNotesPath, '# Deploy Notes\n\nDeployment checklist.\n', 'utf8');
    await writeFile(movePath, '# Move Me\n\nMove body.\n', 'utf8');
    await writeFile(moveToPath, '# How to Cook\n\nMove body with to in filename.\n', 'utf8');
    await writeFile(sourcePath, '# Source Note\n\nImmutable body.\n', 'utf8');
    await writeFile(
      inferencePath,
      `export async function callInference(_system, user) {\n  const nonce = user.match(/NONCE_[a-z0-9-]+/)?.[0];\n  return nonce ? \`MOCK_LLM_\${nonce}\` : 'MOCK_LLM_REPLY';\n}\n`,
      'utf8',
    );
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
        VAULT_DASHBOARD_INFERENCE_MODULE: inferencePath,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await waitForHealth(agent);

    await request('/dashboard/agent/context', { itemId: 'knowledge-test-note' });

    const nonce = `NONCE_${randomUUID()}`;
    const llm = await request('/dashboard/agent/chat', {
      itemId: 'knowledge-test-note',
      message: `Reply with this nonce if live inference is active: ${nonce}`,
    });
    if (llm.reply !== `MOCK_LLM_${nonce}`) throw new Error(`read-only chat did not use inference: ${llm.reply}`);

    const found = await request('/dashboard/agent/chat', { message: 'find: Test Note' });
    if (!found.results?.some((item: any) => item.path === 'Knowledge/Test Note.md')) throw new Error('explicit find did not return fixture');
    const deployFound = await request('/dashboard/agent/chat', { message: 'find: deploy notes' });
    if (!deployFound.results?.some((item: any) => item.path === 'Knowledge/deploy notes.md')) {
      throw new Error('explicit find was blocked by deploy keyword gate');
    }

    const read = await request('/dashboard/agent/chat', { message: 'read: Knowledge/Test Note.md' });
    if (!read.file?.hash || !String(read.reply).includes('Original body')) throw new Error('explicit read did not return content/hash');

    const replace = await request('/dashboard/agent/chat', { message: 'replace in Knowledge/Test Note.md: Original body => Changed body' });
    if (!replace.proposal?.id || !String(replace.proposal.diff || '').includes('+Changed body')) throw new Error('explicit replace proposal missing diff');
    if ((await readFile(knowledgePath, 'utf8')).includes('Changed body')) throw new Error('explicit replace mutated before apply');
    const appliedReplace = await request('/dashboard/agent/apply', { proposalId: replace.proposal.id });
    if (!appliedReplace.changedFiles?.includes('Knowledge/Test Note.md')) throw new Error('explicit replace apply did not report changed file');
    if (!(await readFile(knowledgePath, 'utf8')).includes('Changed body')) throw new Error('explicit replace did not mutate after apply');

    const literalDollar = await request('/dashboard/agent/chat', { message: 'replace in Knowledge/Test Note.md: Changed body => Literal $& replacement' });
    if (!literalDollar.proposal?.id || !String(literalDollar.proposal.diff || '').includes('+Literal $& replacement')) {
      throw new Error('explicit replace dollar proposal missing literal diff');
    }
    await request('/dashboard/agent/apply', { proposalId: literalDollar.proposal.id });
    const dollarContent = await readFile(knowledgePath, 'utf8');
    if (!dollarContent.includes('Literal $& replacement')) throw new Error('explicit replace did not preserve literal dollar replacement');
    if (dollarContent.includes('Literal Changed body replacement')) throw new Error('explicit replace interpreted dollar replacement tokens');
    await writeFile(knowledgePath, `${await readFile(knowledgePath, 'utf8')}\nRepeat me. Repeat me.\n`, 'utf8');
    await request('/dashboard/agent/chat', { message: 'replace in Knowledge/Test Note.md: Repeat me => Once' }, 409);

    const move = await request('/dashboard/agent/chat', { message: 'move Projects/Move Me.md to Archive/Move Me.md' });
    if (!move.proposal?.id || !String(move.proposal.diff || '').includes('rename to Archive/Move Me.md')) throw new Error('explicit move proposal missing diff');
    const appliedMove = await request('/dashboard/agent/apply', { proposalId: move.proposal.id });
    if (!appliedMove.changedFiles?.includes('Archive/Move Me.md')) throw new Error('explicit move apply did not report destination');
    if (!(await readFile(join(vaultDir, 'Archive/Move Me.md'), 'utf8')).includes('Move body')) throw new Error('explicit move destination missing content');

    const moveWithTo = await request('/dashboard/agent/chat', { message: 'move Projects/How to Cook.md to Archive/Cooked.md' });
    if (!moveWithTo.proposal?.id || !String(moveWithTo.proposal.diff || '').includes('rename from Projects/How to Cook.md')) {
      throw new Error('explicit move misparsed source path containing " to "');
    }

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
    await request('/dashboard/agent/chat', { message: 'replace in sources/Source Note.md: Immutable => Mutated' }, 403);
    await request('/dashboard/agent/chat', { message: 'move sources/Source Note.md to Knowledge/Source Note.md' }, 403);
    await request('/dashboard/agent/chat', { message: 'move Knowledge/Test Note.md to Sources/Test Note.md' }, 403);
    await request('/dashboard/agent/chat', { message: 'move Knowledge/Test Note.md to ../outside.md' }, 403);
    const sourceContent = await readFile(sourcePath, 'utf8');
    if (sourceContent.includes('reject source write')) throw new Error('source note was mutated');

    await request('/dashboard/agent/chat', { message: 'rm -rf Knowledge' }, 400);
    await request('/dashboard/agent/chat', { message: 'find: ../outside' }, 403);
    await request('/dashboard/agent/chat', { message: 'read: ../outside.md' }, 403);
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
