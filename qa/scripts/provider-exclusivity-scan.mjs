#!/usr/bin/env node

import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const REQUIRED_FRONTEND_SERVICES = Object.freeze([
  'admin-frontend',
  'frontend-prochart',
  'user-frontend',
]);

export const APPROVED_PROVIDERS = Object.freeze({
  exchanges: ['LBank'],
  brokers: ['OneRoyal'],
  internalDeparturePaths: ['/go/lbank', '/go/oneroyal'],
});

const PROVIDER_RULES = Object.freeze([
  // Exchanges. Short ticker-like aliases are deliberately omitted unless the
  // provider brand has an unambiguous boundary-safe spelling.
  ['Binance', 'exchange', '\\bbinance\\b', 'giu'],
  ['Coinbase', 'exchange', '\\bcoinbase\\b', 'giu'],
  ['Kraken', 'exchange', '\\bkraken\\b', 'giu'],
  ['Bybit', 'exchange', '\\bbybit\\b', 'giu'],
  ['OKX', 'exchange', '\\bokx\\b', 'giu'],
  ['KuCoin', 'exchange', '\\bkucoin\\b', 'giu'],
  ['MEXC', 'exchange', '\\bmexc\\b', 'giu'],
  ['Gate.io', 'exchange', '\\bgate(?:\\s*\\.\\s*|\\s+)io\\b', 'giu'],
  ['Bitget', 'exchange', '\\bbitget\\b', 'giu'],
  ['BingX', 'exchange', '\\bbingx\\b', 'giu'],
  ['Huobi', 'exchange', '\\bhuobi\\b', 'giu'],
  ['HTX', 'exchange', '\\bhtx\\b', 'giu'],
  ['Crypto.com', 'exchange', '\\bcrypto\\s*\\.\\s*com\\b', 'giu'],
  ['Gemini', 'exchange', '\\bgemini\\b', 'giu'],
  ['Bitfinex', 'exchange', '\\bbitfinex\\b', 'giu'],
  ['Bitstamp', 'exchange', '\\bbitstamp\\b', 'giu'],
  ['WhiteBIT', 'exchange', '\\bwhitebit\\b', 'giu'],
  ['CoinEx', 'exchange', '\\bcoinex\\b', 'giu'],
  ['BitMart', 'exchange', '\\bbitmart\\b', 'giu'],
  ['Phemex', 'exchange', '\\bphemex\\b', 'giu'],
  ['Upbit', 'exchange', '\\bupbit\\b', 'giu'],
  ['Bithumb', 'exchange', '\\bbithumb\\b', 'giu'],

  // Brokers and broker brands.
  ['Exness', 'broker', '\\bexness\\b', 'giu'],
  ['XM Global', 'broker', '\\bxm\\s+global\\b', 'giu'],
  ['Pepperstone', 'broker', '\\bpepperstone\\b', 'giu'],
  ['IC Markets', 'broker', '\\bic\\s+markets\\b', 'giu'],
  ['FXTM', 'broker', '\\bfxtm\\b', 'giu'],
  ['HotForex', 'broker', '\\bhot\\s*forex\\b', 'giu'],
  ['Alpari', 'broker', '\\balpari\\b', 'giu'],
  ['FXPro', 'broker', '\\bfxpro\\b', 'giu'],
  ['RoboForex', 'broker', '\\brobo\\s*forex\\b', 'giu'],
  ['AvaTrade', 'broker', '\\bava\\s*trade\\b', 'giu'],
  ['eToro', 'broker', '\\betoro\\b', 'giu'],
  ['OANDA', 'broker', '\\boanda\\b', 'giu'],
  ['Forex.com', 'broker', '\\bforex\\s*\\.\\s*com\\b', 'giu'],
  ['Interactive Brokers', 'broker', '\\binteractive\\s+brokers\\b', 'giu'],
  ['FBS', 'broker', '\\bfbs\\b', 'giu'],
  ['Octa', 'broker', '\\bocta(?:fx)?\\b', 'giu'],
  ['Tickmill', 'broker', '\\btickmill\\b', 'giu'],
  ['Admiral Markets', 'broker', '\\badmiral\\s+markets\\b', 'giu'],
  ['Saxo', 'broker', '\\bsaxo(?:\\s+bank)?\\b', 'giu'],
  ['CMC Markets', 'broker', '\\bcmc\\s+markets\\b', 'giu'],
  ['IG Markets', 'broker', '\\big\\s+markets\\b', 'giu'],
  ['XTB', 'broker', '\\bxtb\\b', 'giu'],
  ['Deriv', 'broker', '\\bderiv\\b', 'giu'],
  ['Windsor Brokers', 'broker', '\\bwindsor\\s+brokers\\b', 'giu'],
  ['Orbex', 'broker', '\\borbex\\b', 'giu'],
  ['LiteFinance', 'broker', '\\blite\\s*finance\\b', 'giu'],
  ['AMarkets', 'broker', '\\bamarkets\\b', 'giu'],
  ['NordFX', 'broker', '\\bnordfx\\b', 'giu'],
  ['Vantage', 'broker', '\\bvantage(?:\\s+markets)?\\b', 'giu'],
  ['ThinkMarkets', 'broker', '\\bthink\\s*markets\\b', 'giu'],
  ['TradeYar', 'broker', '\\btradeyar\\b', 'giu'],

  // Approved providers must still leave frontend surfaces through the internal
  // audited routes; raw referral destinations are backend-only policy data.
  ['LBank direct referral URL', 'direct-referral', 'https?:\\/\\/(?:www\\.)?lbank\\.com\\/ref(?:\\/|\\b)', 'giu'],
  ['OneRoyal direct referral URL', 'direct-referral', 'https?:\\/\\/vc\\.cabinet\\.oneroyal\\.com(?:\\/|\\b)', 'giu'],

  // OneRoyal operational controls are forbidden on every shipping source and
  // compiled bundle while the product contract is referral-only. Disabled
  // explanatory copy is allowed; these patterns target callable routes/state.
  ['OneRoyal operational account-link API', 'oneroyal-operational', '\\/user\\/account\\/link\\b', 'giu'],
  ['OneRoyal operational copy API', 'oneroyal-operational', '\\/user\\/copy(?:-config|-status|\\/(?:stop|close-all))\\b', 'giu'],
  ['OneRoyal operational admin EA API', 'oneroyal-operational', '\\/admin\\/ea-(?:config|status|close-all|account)\\b', 'giu'],
  ['OneRoyal operational MT5 activation state', 'oneroyal-operational', `\\bkind\\s*={2,3}\\s*["']mt5["']`, 'giu'],
].map(([provider, category, source, flags]) => Object.freeze({ provider, category, source, flags })));

const DEFAULT_EXCLUDED_DIRECTORIES = Object.freeze([
  '.git',
  '.vite',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);

const TEXT_EXTENSIONS = new Set([
  '.cjs', '.conf', '.css', '.gradle', '.htm', '.html', '.java', '.js', '.json', '.json5',
  '.jsx', '.kt', '.less', '.mjs', '.md', '.pro', '.properties', '.sass', '.scss', '.svg',
  '.ts', '.tsx', '.txt', '.webmanifest', '.xml', '.yaml', '.yml',
]);
const TEXT_BASENAMES = new Set(['.dockerignore', '.gitignore', 'Dockerfile']);
const SEMANTIC_SKIP_BASENAMES = new Set(['package-lock.json']);
const BLOCKING_SURFACES = new Set(['bundle', 'edge', 'fixture', 'source']);
const SURFACE_NAMES = Object.freeze(['source', 'fixture', 'bundle', 'edge', 'test', 'qa', 'legacy', 'builder']);

function slash(value) {
  return value.split(path.sep).join('/');
}

function blankExceptNewlines(value) {
  return value.replace(/[^\r\n]/g, ' ');
}

/**
 * Removes non-shipping comments without touching quoted product strings.
 * It is intentionally conservative: template bodies remain searchable because
 * they can render text, while line/block/HTML comments are blanked in place so
 * finding line numbers remain stable.
 */
export function stripNonShippingComments(source, extension = '') {
  const ext = extension.toLowerCase();
  if (['.json', '.json5', '.txt', '.md', '.svg', '.xml', '.yaml', '.yml'].includes(ext)) return source;

  let output = '';
  let index = 0;
  let quote = null;
  let escaped = false;
  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];

    if (quote) {
      output += current;
      if (escaped) escaped = false;
      else if (current === '\\') escaped = true;
      else if (current === quote) quote = null;
      index += 1;
      continue;
    }

    if (current === '"' || current === "'" || current === '`') {
      quote = current;
      output += current;
      index += 1;
      continue;
    }

    if (current === '/' && next === '/') {
      const end = source.indexOf('\n', index + 2);
      const stop = end === -1 ? source.length : end;
      output += blankExceptNewlines(source.slice(index, stop));
      index = stop;
      continue;
    }

    if (current === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      output += blankExceptNewlines(source.slice(index, stop));
      index = stop;
      continue;
    }

    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      const stop = end === -1 ? source.length : end + 3;
      output += blankExceptNewlines(source.slice(index, stop));
      index = stop;
      continue;
    }

    output += current;
    index += 1;
  }
  return output;
}

function locationFor(text, index) {
  const before = text.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

function excerpt(text, index, length) {
  return text
    .slice(Math.max(0, index - 50), Math.min(text.length, index + length + 50))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export function findForbiddenProviders(text, {
  relativePath = '<memory>',
  surface = 'source',
  matchKind = 'content',
} = {}) {
  const findings = [];
  const seen = new Set();
  for (const rule of PROVIDER_RULES) {
    const pattern = new RegExp(rule.source, rule.flags);
    for (const match of text.matchAll(pattern)) {
      const key = `${rule.provider}\0${match.index}\0${matchKind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const location = locationFor(text, match.index);
      findings.push({
        provider: rule.provider,
        category: rule.category,
        matchKind,
        surface,
        relativePath: slash(relativePath),
        line: matchKind === 'content' ? location.line : null,
        column: matchKind === 'content' ? location.column : null,
        match: match[0],
        excerpt: excerpt(text, match.index, match[0].length),
        index: match.index,
      });
    }
  }
  return findings.sort((left, right) => (
    left.index - right.index
    || left.provider.localeCompare(right.provider, 'en')
    || left.matchKind.localeCompare(right.matchKind, 'en')
  ));
}

function classifySurface(relativePath, kind) {
  if (kind !== 'source') return kind;
  const segments = slash(relativePath).split('/');
  const lower = segments.map((part) => part.toLowerCase());
  const basename = lower.at(-1);

  if (lower.includes('src.bak') || lower.some((part) => part.endsWith('.bak'))) return 'legacy';
  if (lower.some((part) => ['test', 'tests', '__tests__'].includes(part)) || /\.(?:spec|test)\.[^.]+$/.test(basename)) return 'test';
  if (lower.some((part) => ['fixture', 'fixtures', 'mock', 'mocks', 'seed', 'seeds'].includes(part))) return 'fixture';
  if (lower.some((part) => ['www', 'roadmap'].includes(part))) return 'builder';
  return 'source';
}

function semanticPathAllowed(relativePath) {
  const normalized = slash(relativePath).toLowerCase();
  return !normalized.startsWith('public/crypto-icons/');
}

function shouldScanContents(relativePath, bytes) {
  const basename = path.basename(relativePath);
  if (SEMANTIC_SKIP_BASENAMES.has(basename)) return false;
  if (bytes.length > 20 * 1024 * 1024) return false;
  return TEXT_EXTENSIONS.has(path.extname(basename).toLowerCase())
    || TEXT_BASENAMES.has(basename)
    || /^Dockerfile(?:\.|$)/.test(basename);
}

function initialSurfaces() {
  return Object.fromEntries(SURFACE_NAMES.map((name) => [name, { files: 0, bytes: 0, findings: 0 }]));
}

function findingSort(left, right) {
  return left.relativePath.localeCompare(right.relativePath, 'en')
    || (left.index ?? -1) - (right.index ?? -1)
    || left.provider.localeCompare(right.provider, 'en')
    || left.matchKind.localeCompare(right.matchKind, 'en');
}

export async function scanTree(root, {
  kind = 'source',
  excludeDirectories = new Set(),
} = {}) {
  const absoluteRoot = path.resolve(root);
  const rootStat = await stat(absoluteRoot);
  if (!rootStat.isDirectory()) throw new Error(`scan root is not a directory: ${absoluteRoot}`);

  const excluded = new Set([...DEFAULT_EXCLUDED_DIRECTORIES, ...excludeDirectories]);
  if (kind === 'bundle') excluded.delete('dist');
  const files = [];
  const skippedDirectories = [];

  async function visit(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (excluded.has(entry.name)) skippedDirectories.push(relative);
        else await visit(absolute, relative);
      } else {
        files.push({ absolute, relative, dirent: entry });
      }
    }
  }
  await visit(absoluteRoot);

  const digest = crypto.createHash('sha256');
  const allFindings = [];
  const surfaces = initialSurfaces();
  let semanticFilesScanned = 0;
  let semanticFilesSkipped = 0;
  let bytesScanned = 0;

  for (const file of files) {
    const surface = classifySurface(file.relative, kind);
    let bytes;
    if (file.dirent.isSymbolicLink()) bytes = Buffer.from(`symlink:${await readlink(file.absolute)}`);
    else {
      const fileStat = await lstat(file.absolute);
      if (!fileStat.isFile()) continue;
      bytes = await readFile(file.absolute);
    }

    digest.update(file.relative).update('\0').update(bytes).update('\0');
    bytesScanned += bytes.length;
    surfaces[surface].files += 1;
    surfaces[surface].bytes += bytes.length;

    if (semanticPathAllowed(file.relative)) {
      allFindings.push(...findForbiddenProviders(file.relative, {
        relativePath: file.relative,
        surface,
        matchKind: 'path',
      }));
    }

    if (!shouldScanContents(file.relative, bytes)) {
      semanticFilesSkipped += 1;
      continue;
    }
    semanticFilesScanned += 1;
    const extension = path.extname(file.relative).toLowerCase();
    const raw = bytes.toString('utf8');
    const searchable = ['source', 'fixture', 'edge'].includes(surface)
      ? stripNonShippingComments(raw, extension)
      : raw;
    allFindings.push(...findForbiddenProviders(searchable, {
      relativePath: file.relative,
      surface,
      matchKind: 'content',
    }));
  }

  allFindings.sort(findingSort);
  for (const finding of allFindings) surfaces[finding.surface].findings += 1;
  const findings = allFindings.filter(({ surface }) => BLOCKING_SURFACES.has(surface));
  const nonBlockingFindings = allFindings.filter(({ surface }) => !BLOCKING_SURFACES.has(surface));

  return {
    kind,
    result: findings.length === 0 ? 'PASS' : 'FAIL',
    treeSha256: digest.digest('hex'),
    filesScanned: files.length,
    semanticFilesScanned,
    semanticFilesSkipped,
    bytesScanned,
    skippedDirectories: skippedDirectories.sort((left, right) => left.localeCompare(right, 'en')),
    surfaces,
    findings,
    nonBlockingFindings,
  };
}

export function selectFrontendContexts(composeConfig, repoRoot) {
  const services = composeConfig?.services || {};
  const absoluteRepo = path.resolve(repoRoot);
  return REQUIRED_FRONTEND_SERVICES.map((service) => {
    const definition = services[service];
    if (!definition) throw new Error(`missing required compose service: ${service}`);
    if (!definition.build) throw new Error(`required compose service has no build context: ${service}`);
    const build = typeof definition.build === 'string' ? { context: definition.build } : definition.build;
    const absoluteContext = path.resolve(absoluteRepo, build.context);
    const relative = path.relative(absoluteRepo, absoluteContext);
    if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`frontend build context escapes repository root: ${service} -> ${build.context}`);
    }
    return {
      service,
      context: slash(relative),
      dockerfile: slash(build.dockerfile || 'Dockerfile'),
    };
  }).sort((left, right) => left.service.localeCompare(right.service, 'en'));
}

async function composeContexts(repoRoot, composeFile) {
  const composePath = path.resolve(repoRoot, composeFile);
  const { stdout } = await execFileAsync(
    'docker',
    ['compose', '-f', composePath, 'config', '--format', 'json'],
    { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 },
  );
  return selectFrontendContexts(JSON.parse(stdout), repoRoot);
}

async function isGitIgnored(repoRoot, relativePath) {
  try {
    await execFileAsync('git', ['check-ignore', '-q', '--', relativePath], { cwd: repoRoot });
    return true;
  } catch (error) {
    if (error.code === 1) return false;
    throw error;
  }
}

function combineResult(scans) {
  const findings = [];
  const nonBlockingFindings = [];
  for (const { label, scan } of scans) {
    findings.push(...scan.findings.map((finding) => ({ label, ...finding })));
    nonBlockingFindings.push(...scan.nonBlockingFindings.map((finding) => ({ label, ...finding })));
  }
  findings.sort((left, right) => left.label.localeCompare(right.label, 'en') || findingSort(left, right));
  nonBlockingFindings.sort((left, right) => left.label.localeCompare(right.label, 'en') || findingSort(left, right));
  return { findings, nonBlockingFindings };
}

export async function scanRepository({
  repoRoot,
  composeFile = 'docker-compose.prochart.yml',
  includeBundles = true,
  includeQaInventory = true,
  bundleRoots = {},
} = {}) {
  const absoluteRepo = path.resolve(repoRoot || process.cwd());
  const contexts = await composeContexts(absoluteRepo, composeFile);
  const services = [];
  const aggregate = [];

  for (const context of contexts) {
    const sourceRoot = path.join(absoluteRepo, context.context);
    const source = await scanTree(sourceRoot, { kind: 'source' });
    const item = {
      ...context,
      gitIgnored: await isGitIgnored(absoluteRepo, context.context),
      source,
    };
    aggregate.push({ label: `${context.service}:source`, scan: source });
    if (includeBundles) {
      const configuredBundle = bundleRoots[context.service];
      const bundleRoot = configuredBundle
        ? path.resolve(absoluteRepo, configuredBundle)
        : path.join(sourceRoot, 'dist');
      try {
        item.bundle = await scanTree(bundleRoot, { kind: 'bundle' });
      } catch (error) {
        throw new Error(`fresh bundle is required for ${context.service}: ${error.message}`);
      }
      item.bundleRoot = slash(path.relative(absoluteRepo, bundleRoot));
      aggregate.push({ label: `${context.service}:bundle`, scan: item.bundle });
    }
    services.push(item);
  }

  const edge = await scanTree(path.join(absoluteRepo, 'nginx'), { kind: 'edge' });
  aggregate.push({ label: 'runtime-edge', scan: edge });

  let qa = null;
  if (includeQaInventory) {
    qa = await scanTree(path.join(absoluteRepo, 'qa'), { kind: 'qa' });
    aggregate.push({ label: 'qa-internal', scan: qa });
  }

  const combined = combineResult(aggregate);
  const sourceFiles = services.reduce((sum, service) => sum + service.source.filesScanned, 0);
  const bundleFiles = services.reduce((sum, service) => sum + (service.bundle?.filesScanned || 0), 0);
  const report = {
    schemaVersion: 1,
    policy: {
      ...APPROVED_PROVIDERS,
      forbiddenProviderRuleCount: PROVIDER_RULES.length,
      blockingSurfaces: [...BLOCKING_SURFACES].sort(),
      nonBlockingSurfaces: ['builder', 'legacy', 'qa', 'test'],
    },
    composeFile: slash(path.relative(absoluteRepo, path.resolve(absoluteRepo, composeFile))),
    services,
    edge,
    qa,
    totals: {
      services: services.length,
      sourceFiles,
      bundleFiles,
      edgeFiles: edge.filesScanned,
      qaFiles: qa?.filesScanned || 0,
      blockingFindings: combined.findings.length,
      nonBlockingFindings: combined.nonBlockingFindings.length,
    },
    findings: combined.findings,
    nonBlockingFindings: combined.nonBlockingFindings,
    result: combined.findings.length === 0 ? 'PASS' : 'FAIL',
  };
  return report;
}

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    composeFile: 'docker-compose.prochart.yml',
    includeBundles: true,
    includeQaInventory: true,
    bundleRoots: {},
    output: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--repo-root') options.repoRoot = argv[++index];
    else if (value === '--compose') options.composeFile = argv[++index];
    else if (value === '--output') options.output = argv[++index];
    else if (value === '--bundle') {
      const assignment = argv[++index] || '';
      const separator = assignment.indexOf('=');
      if (separator < 1 || separator === assignment.length - 1) {
        throw new Error(`invalid --bundle assignment: ${assignment}`);
      }
      const service = assignment.slice(0, separator);
      if (!REQUIRED_FRONTEND_SERVICES.includes(service)) throw new Error(`unknown bundle service: ${service}`);
      options.bundleRoots[service] = assignment.slice(separator + 1);
    }
    else if (value === '--source-only') options.includeBundles = false;
    else if (value === '--skip-qa-inventory') options.includeQaInventory = false;
    else throw new Error(`unknown argument: ${value}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await scanRepository(options);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) {
    const output = path.resolve(options.repoRoot, options.output);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, serialized, 'utf8');
  } else process.stdout.write(serialized);
  process.exitCode = report.result === 'PASS' ? 0 : 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 2;
  });
}
