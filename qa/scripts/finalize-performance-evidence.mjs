import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const allowedRoot = path.join(repoRoot, 'artifacts', 'qa', 'performance');
const evidenceDir = path.resolve(process.env.PERF_EVIDENCE_DIR || '');
const expectedSamples = Number(process.env.PERF_EXPECTED_SAMPLES || 1);
const expectedScenarios = ['desktop-chart', 'mobile-chart'];

if (!process.env.PERF_EVIDENCE_DIR) throw new Error('PERF_EVIDENCE_DIR is required');
if (evidenceDir !== allowedRoot && !evidenceDir.startsWith(`${allowedRoot}${path.sep}`)) {
  throw new Error(`Evidence directory must be under ${allowedRoot}`);
}
if (!Number.isInteger(expectedSamples) || expectedSamples < 1) throw new Error('PERF_EXPECTED_SAMPLES must be a positive integer');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function round(value, digits = 3) {
  return Number(Number(value).toFixed(digits));
}

function percentile(values, quantile) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}

function compare(actual, operator, threshold) {
  return operator === '<=' ? actual <= threshold : actual < threshold;
}

async function listFiles(root, relative = '') {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) results.push(...await listFiles(root, child));
    else if (entry.isFile()) results.push(child);
    else throw new Error(`Unsupported evidence entry type: ${child}`);
  }
  return results;
}

const files = await listFiles(evidenceDir);
const metricPaths = files.filter((file) => file.endsWith(`${path.sep}metrics.json`) || file === 'metrics.json').sort();
if (!metricPaths.length) throw new Error('No performance metrics.json files found');

const samples = await Promise.all(metricPaths.map(async (relativePath) => {
  const source = await fs.readFile(path.join(evidenceDir, relativePath), 'utf8');
  return { relativePath, sha256: sha256(source), evidence: JSON.parse(source) };
}));

const scenarioGroups = samples.reduce((groups, sample) => {
  const key = sample.evidence.scenario;
  (groups[key] ||= []).push(sample);
  return groups;
}, {});
for (const scenario of expectedScenarios) {
  const count = scenarioGroups[scenario]?.length || 0;
  if (count !== expectedSamples) throw new Error(`${scenario} has ${count} samples; expected ${expectedSamples}`);
}
const unexpectedScenarios = Object.keys(scenarioGroups).filter((scenario) => !expectedScenarios.includes(scenario));
if (unexpectedScenarios.length) throw new Error(`Unexpected scenarios: ${unexpectedScenarios.join(', ')}`);

const identities = ['baseline', 'commit', 'sourceFingerprint', 'runId'];
for (const identity of identities) {
  const values = new Set(samples.map((sample) => sample.evidence[identity]));
  if (values.size !== 1) throw new Error(`Inconsistent ${identity} values across samples`);
}

const gitleaksPath = path.join(evidenceDir, 'gitleaks.json');
const gitleaks = JSON.parse(await fs.readFile(gitleaksPath, 'utf8'));
if (!Array.isArray(gitleaks)) throw new Error('gitleaks.json must contain a JSON array');
if (gitleaks.length) throw new Error(`gitleaks reported ${gitleaks.length} findings`);

const scenarios = {};
let overallPass = true;
for (const scenario of expectedScenarios) {
  const scenarioSamples = scenarioGroups[scenario].sort((a, b) => a.evidence.sampleId.localeCompare(b.evidence.sampleId));
  const gateNames = scenarioSamples[0].evidence.gates.checks.map((gate) => gate.metric);
  const aggregateGates = gateNames.map((metric) => {
    const checks = scenarioSamples.map((sample) => sample.evidence.gates.checks.find((gate) => gate.metric === metric));
    if (checks.some((check) => !check || typeof check.actual !== 'number')) throw new Error(`Missing ${metric} value for ${scenario}`);
    const values = checks.map((check) => check.actual);
    const definition = checks[0];
    if (checks.some((check) => check.operator !== definition.operator || check.threshold !== definition.threshold)) {
      throw new Error(`Inconsistent ${metric} budget for ${scenario}`);
    }
    const p75 = percentile(values, 0.75);
    const pass = compare(p75, definition.operator, definition.threshold);
    overallPass &&= pass && checks.every((check) => check.pass);
    return {
      metric,
      sampleValues: values,
      min: round(Math.min(...values)),
      median: round(percentile(values, 0.5)),
      labP75: round(p75),
      max: round(Math.max(...values)),
      operator: definition.operator,
      threshold: definition.threshold,
      unit: definition.unit,
      allSamplesPass: checks.every((check) => check.pass),
      labP75Pass: pass,
      result: pass && checks.every((check) => check.pass) ? 'PASS' : 'FAIL',
    };
  });

  const sampleResults = scenarioSamples.map((sample) => ({
    sampleId: sample.evidence.sampleId,
    relativePath: sample.relativePath,
    metricsSha256: sample.sha256,
    result: sample.evidence.result,
    gateResult: sample.evidence.gates.result,
  }));
  overallPass &&= sampleResults.every((sample) => sample.result === 'PASS' && sample.gateResult === 'PASS');
  scenarios[scenario] = { sampleCount: scenarioSamples.length, samples: sampleResults, aggregateGates };
}

const first = samples[0].evidence;
const summary = {
  schemaVersion: 1,
  classification: 'deterministic Chromium lab regression',
  fieldCoreWebVitalsEquivalent: false,
  fieldEquivalenceWarning: 'labP75 is only the nearest-rank p75 of this small synthetic repeat set; it is not RUM or a field Core Web Vitals p75.',
  baseline: first.baseline,
  commit: first.commit,
  sourceFingerprint: first.sourceFingerprint,
  runId: first.runId,
  result: overallPass ? 'PASS' : 'FAIL',
  expectedSamplesPerScenario: expectedSamples,
  scenarios,
  securityScan: { tool: 'gitleaks', report: 'gitleaks.json', findingCount: gitleaks.length, result: 'PASS' },
  integrityManifest: 'SHA256SUMS',
};

await fs.writeFile(path.join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

const checksumFiles = (await listFiles(evidenceDir)).filter((file) => file !== 'SHA256SUMS').sort();
const checksumLines = await Promise.all(checksumFiles.map(async (relativePath) => {
  const value = await fs.readFile(path.join(evidenceDir, relativePath));
  return `${sha256(value)}  ${relativePath}`;
}));
await fs.writeFile(path.join(evidenceDir, 'SHA256SUMS'), `${checksumLines.join('\n')}\n`, 'utf8');

if (!overallPass) throw new Error('Performance evidence contains a failed sample or aggregate gate');

process.stdout.write(`${JSON.stringify({ evidenceDir, result: summary.result, sampleCount: samples.length, checksumCount: checksumLines.length })}\n`);
