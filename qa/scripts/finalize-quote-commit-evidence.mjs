import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const allowedRoot = path.join(repoRoot, 'artifacts', 'qa', 'quote-commit');
const evidenceDir = path.resolve(process.env.QUOTE_COMMIT_EVIDENCE_DIR || '');
const previewSourceDir = path.resolve(process.env.QUOTE_COMMIT_PREVIEW_SOURCE_DIR || '');
const expectedSamples = Number(process.env.QUOTE_COMMIT_EXPECTED_SAMPLES || 3);

if (!process.env.QUOTE_COMMIT_EVIDENCE_DIR) throw new Error('QUOTE_COMMIT_EVIDENCE_DIR is required');
if (!process.env.QUOTE_COMMIT_PREVIEW_SOURCE_DIR) throw new Error('QUOTE_COMMIT_PREVIEW_SOURCE_DIR is required');
if (evidenceDir !== allowedRoot && !evidenceDir.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`Evidence directory must be under ${allowedRoot}`);
if (!Number.isInteger(expectedSamples) || expectedSamples < 1) throw new Error('QUOTE_COMMIT_EXPECTED_SAMPLES must be a positive integer');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const round = (value, digits = 3) => Number(Number(value).toFixed(digits));

function percentile(values, quantile) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}

function aggregate(values) {
  return {
    sampleCount: values.length,
    minMs: round(Math.min(...values)),
    medianMs: round(percentile(values, 0.5)),
    p95Ms: round(percentile(values, 0.95)),
    maxMs: round(Math.max(...values)),
    sampleP95ValuesMs: values.map((value) => round(value)),
  };
}

async function listFiles(root, relative = '') {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) results.push(...await listFiles(root, child));
    else if (entry.isFile()) results.push(child);
    else throw new Error(`Unsupported evidence entry: ${child}`);
  }
  return results;
}

async function listFingerprintFiles(root, relative = '') {
  const excludedDirectories = new Set(['node_modules', 'dist', 'www', 'android']);
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (excludedDirectories.has(entry.name)) continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) results.push(...await listFingerprintFiles(root, child));
    else if (entry.isFile()) results.push(child);
    else if (!entry.isSymbolicLink()) throw new Error(`Unsupported source entry: ${child}`);
  }
  return results;
}

const files = await listFiles(evidenceDir);
const metricPaths = files.filter((file) => file.endsWith(`${path.sep}metrics.json`)).sort();
if (metricPaths.length !== expectedSamples) throw new Error(`Found ${metricPaths.length} samples; expected ${expectedSamples}`);

const samples = await Promise.all(metricPaths.map(async (relativePath) => {
  const source = await fs.readFile(path.join(evidenceDir, relativePath), 'utf8');
  return { relativePath, sha256: sha256(source), evidence: JSON.parse(source) };
}));
for (const field of ['baseline', 'commit', 'sourceFingerprint', 'runId', 'scenario']) {
  const values = new Set(samples.map((sample) => sample.evidence[field]));
  if (values.size !== 1) throw new Error(`Inconsistent ${field}`);
}

const gitleaks = JSON.parse(await fs.readFile(path.join(evidenceDir, 'gitleaks.json'), 'utf8'));
if (!Array.isArray(gitleaks)) throw new Error('gitleaks report must be an array');
if (gitleaks.length) throw new Error(`gitleaks reported ${gitleaks.length} findings`);

const measured = samples.every((sample) => sample.evidence.measurementStatus === 'MEASURED_UNGATED');
const metricNames = ['quoteToCanvasText', 'canvasTextToNextRaf', 'quoteToNextRafAfterCanvas'];
const aggregates = Object.fromEntries(metricNames.map((metric) => {
  const sampleP95 = samples.map((sample) => sample.evidence.metrics[metric]?.p95Ms).filter(Number.isFinite);
  return [metric, sampleP95.length === expectedSamples ? aggregate(sampleP95) : null];
}));

const first = samples[0].evidence;
const sourceFiles = (await listFingerprintFiles(previewSourceDir)).sort();
const sourceChecksumLines = await Promise.all(sourceFiles.map(async (relativePath) => {
  const value = await fs.readFile(path.join(previewSourceDir, relativePath));
  return `${sha256(value)}  ./${relativePath}`;
}));
const observedSourceFingerprint = sha256(`${sourceChecksumLines.join('\n')}\n`);
if (observedSourceFingerprint !== first.sourceFingerprint) {
  throw new Error(`Preview source fingerprint mismatch: ${observedSourceFingerprint} != ${first.sourceFingerprint}`);
}

const indexPath = path.join(previewSourceDir, 'dist', 'index.html');
const indexSource = await fs.readFile(indexPath, 'utf8');
const entryAssetPaths = [...new Set([...indexSource.matchAll(/(?:src|href)="\/?(assets\/index-[^"]+\.(?:js|css))"/g)].map((match) => match[1]))].sort();
if (!entryAssetPaths.length) throw new Error('No built entry assets found in preview index.html');
const previewProvenance = {
  schemaVersion: 1,
  sourceRootLabel: path.basename(previewSourceDir),
  sourceFingerprintAlgorithm: "sha256 of sorted GNU sha256sum lines for files excluding node_modules, dist, www, and android",
  sourceFingerprintExpected: first.sourceFingerprint,
  sourceFingerprintObserved: observedSourceFingerprint,
  sourceFileCount: sourceFiles.length,
  buildEntrypoints: [
    { path: 'dist/index.html', sha256: sha256(indexSource) },
    ...await Promise.all(entryAssetPaths.map(async (relativePath) => ({
      path: `dist/${relativePath}`,
      sha256: sha256(await fs.readFile(path.join(previewSourceDir, 'dist', relativePath))),
    }))),
  ],
  verification: 'PASS',
};
await fs.writeFile(path.join(evidenceDir, 'preview-provenance.json'), `${JSON.stringify(previewProvenance, null, 2)}\n`, 'utf8');

const summary = {
  schemaVersion: 1,
  classification: 'deterministic synthetic quote-to-observable-chart-draw characterization',
  baseline: first.baseline,
  commit: first.commit,
  sourceFingerprint: first.sourceFingerprint,
  runId: first.runId,
  scenario: first.scenario,
  result: measured ? 'MEASURED_UNGATED' : 'NOT_MEASURED',
  interpretation: 'MEASURED_UNGATED confirms target-specific input-to-canvas correlation only. It is not a 60fps, threshold-pass, field-performance, or remediation claim.',
  expectedSamples,
  samples: samples.map((sample) => ({
    sampleId: sample.evidence.sampleId,
    relativePath: sample.relativePath,
    metricsSha256: sample.sha256,
    measurementStatus: sample.evidence.measurementStatus,
    quoteToCanvasTextP95Ms: sample.evidence.metrics.quoteToCanvasText.p95Ms,
    canvasTextToNextRafP95Ms: sample.evidence.metrics.canvasTextToNextRaf.p95Ms,
    quoteToNextRafAfterCanvasP95Ms: sample.evidence.metrics.quoteToNextRafAfterCanvas.p95Ms,
    longTaskCount: sample.evidence.metrics.longTasks.count,
    traceSha256: sample.evidence.trace.sha256,
  })),
  aggregates,
  metricSemantics: first.metricSemantics,
  thresholdProvenance: first.thresholdProvenance,
  securityScan: { tool: 'gitleaks', report: 'gitleaks.json', findingCount: 0, result: 'PASS' },
  previewProvenance: { file: 'preview-provenance.json', sourceFingerprintVerified: true, buildEntrypointCount: previewProvenance.buildEntrypoints.length },
  integrityManifest: 'SHA256SUMS',
};
await fs.writeFile(path.join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

const checksumFiles = (await listFiles(evidenceDir)).filter((file) => file !== 'SHA256SUMS').sort();
const checksumLines = await Promise.all(checksumFiles.map(async (relativePath) => {
  const value = await fs.readFile(path.join(evidenceDir, relativePath));
  return `${sha256(value)}  ${relativePath}`;
}));
await fs.writeFile(path.join(evidenceDir, 'SHA256SUMS'), `${checksumLines.join('\n')}\n`, 'utf8');

if (!measured) throw new Error('Quote-commit evidence is NOT_MEASURED');
process.stdout.write(`${JSON.stringify({ evidenceDir, result: summary.result, sampleCount: samples.length, checksumCount: checksumLines.length })}\n`);
