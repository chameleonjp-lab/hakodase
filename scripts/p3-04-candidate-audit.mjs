#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  P3_04_AUDIT_DEFAULTS,
  runCandidateAuditV2,
} from '../src/core/candidate-audit-v2.js';

function readArguments(argv) {
  const options = {
    count: P3_04_AUDIT_DEFAULTS.candidateCount,
    outputDirectory: 'audit-output/p3-04',
    seedPrefix: P3_04_AUDIT_DEFAULTS.seedPrefix,
    requireP303R: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--count') options.count = Number(argv[++index]);
    else if (argument === '--out-dir') options.outputDirectory = argv[++index];
    else if (argument === '--seed-prefix') options.seedPrefix = argv[++index];
    else if (argument === '--require-p3-03r') options.requireP303R = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new TypeError(`Unknown argument: ${argument}`);
  }

  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new TypeError('--count must be an integer >= 1');
  }
  if (!options.outputDirectory) throw new TypeError('--out-dir is required');
  if (!options.seedPrefix) throw new TypeError('--seed-prefix is required');
  return options;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  return Number(value).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function counterLines(counter) {
  const entries = Object.entries(counter).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'en'));
  if (entries.length === 0) return '- なし';
  return entries.map(([name, count]) => `- \`${name}\`: ${count}`).join('\n');
}

function buildMarkdown(report) {
  const summary = report.summary;
  const acceptance = report.acceptance;
  const acceptanceFailures = acceptance.failures.length === 0
    ? 'failures: none'
    : `failures: ${acceptance.failures.join(' | ')}`;
  const profileRows = summary.profiles.map((profile) => (
    `| \`${profile.profileId}\` | ${profile.attempted} | ${profile.generated} | ${profile.candidate} | ${profile.review} | ${profile.reject} | ${profile.eligibleUniqueStructureHashes} | ${profile.uniqueBoardHashes} | ${profile.uniqueStructureHashes} | ${formatNumber(profile.initialLegalActions.mean)} | ${formatNumber(profile.initialDirectExitBlocks.mean)} | ${formatPercent(profile.decisionStepRate.mean)} | ${formatPercent(profile.wallUtilizationRate.mean)} |`
  )).join('\n');

  return `# HAKODASE P3-04 候補監査結果

## 実行条件

\`\`\`text
auditVersion: ${report.auditVersion}
generatorVersion: ${report.generatorVersion}
seedPrefix: ${report.seedPrefix}
requested: ${summary.requestedCandidateCount}
inspected: ${summary.inspectedCandidateCount}
durationMs: ${Math.round(report.durationMs)}
\`\`\`

この監査はP3-03候補の機械検査です。ここで\`candidate\`になっても、P3-05の人間試遊を通過するまでは公式問題ではありません。

## 全体集計

| 指標 | 値 |
| --- | ---: |
| 生成成功 | ${summary.generatedCount} |
| 生成失敗 | ${summary.generationFailureCount} |
| candidate | ${summary.candidateCount} |
| review | ${summary.reviewCount} |
| reject | ${summary.rejectCount} |
| hard rule通過 | ${summary.eligibleCount} |
| 通過後の一意structureHash | ${summary.eligibleUniqueStructureHashCount} |
| 一意boardHash | ${summary.uniqueBoardHashCount} |
| boardHash重複 | ${summary.duplicateBoardHashCount} |
| boardHash一意率 | ${formatPercent(summary.boardHashUniqueRatio)} |
| 一意structureHash | ${summary.uniqueStructureHashCount} |
| 構造同型重複 | ${summary.structuralDuplicateCount} |
| 構造一意率 | ${formatPercent(summary.structureUniqueRatio)} |
| 初手合法操作 平均 | ${formatNumber(summary.initialLegalActions.mean)} |
| 初期直行箱 平均 | ${formatNumber(summary.initialDirectExitBlocks.mean)} |
| 解法中の判断手率 平均 | ${formatPercent(summary.decisionStepRate.mean)} |
| 壁利用率 平均 | ${formatPercent(summary.wallUtilizationRate.mean)} |
| 即時詰み代替率 平均 | ${formatPercent(summary.immediateDeadEndAlternativeRate.mean)} |
| 同箱連続率 平均 | ${formatPercent(summary.sameBlockRepeatRate.mean)} |
| 最大方向偏り 平均 | ${formatPercent(summary.dominantDirectionRate.mean)} |
| 最大色偏り 平均 | ${formatPercent(summary.dominantColorRate.mean)} |
| ソルバーノード 平均 | ${formatNumber(summary.solverNodes.mean)} |
| ソルバー時間ms 平均 | ${formatNumber(summary.solverDurationMs.mean)} |

## profile別

| profile | 試行 | 成功 | candidate | review | reject | 通過後一意構造 | 一意board | 一意構造 | 初手平均 | 直行箱平均 | 判断手率 | 壁利用率 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${profileRows}

## hard reject理由

${counterLines(summary.hardRejectReasonCounts)}

## review flag

${counterLines(summary.reviewFlagCounts)}

## 生成失敗理由

${counterLines(summary.generationFailureReasonCounts)}

## 判定の意味

- \`candidate\`: 暫定screeningでhard rejectとreview flagがない。
- \`review\`: 自動排除はしないが、人間試遊前に確認すべき偏りがある。
- \`reject\`: 初期直行箱など、現段階のhard ruleへ違反する。
- \`structureHash\`: 色番号、箱ID、左右・上下反転、180度回転を正規化した構造識別子。
- 誤手・詰み指標は、代表解法の各状態で代表手以外を1手だけ試し、直後に合法手0件となる割合である。将来まで探索した完全詰み率ではない。

## P3-03R受け入れ判定

\`\`\`text
passed: ${acceptance.passed}
${acceptanceFailures}
\`\`\`

## 次の扱い

この結果を根拠にP3-03生成器を補修するか、P3-05へ渡す候補の選別条件を固定する。1000件以上の監査結果と人間試遊を混同しない。
`;
}

function csvCell(value) {
  if (value == null) return '';
  const text = Array.isArray(value) ? value.join('|') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function buildCsv(report) {
  const columns = [
    'index', 'seed', 'profileId', 'templateId', 'generationSuccess', 'generationReason', 'attempts',
    'boardHash', 'structureHash', 'boardHashDuplicateOf', 'structureHashDuplicateOf',
    'qualityStatus', 'hardRejectReasons', 'reviewFlags', 'optimalSwipes',
    'initialLegalActionCount', 'initialMovableBlockCount', 'initialDirectExitBlockCount',
    'solutionDecisionStepRate', 'solutionAverageBranching', 'wallUtilizationRate',
    'offRouteAlternativeCount', 'immediateDeadEndAlternativeRate', 'sameBlockRepeatRate',
    'maxSameBlockRun', 'dominantDirectionRate', 'dominantColorRate', 'solverNodes',
    'solverUniqueStates', 'solverDurationMs', 'transform', 'counts', 'colorPermutation',
  ];

  const lines = [columns.join(',')];
  for (const row of report.rows) {
    const metrics = row.metrics ?? {};
    const values = {
      ...row,
      optimalSwipes: metrics.optimalSwipes,
      initialLegalActionCount: metrics.initialLegalActionCount,
      initialMovableBlockCount: metrics.initialMovableBlockCount,
      initialDirectExitBlockCount: metrics.initialDirectExitBlockCount,
      solutionDecisionStepRate: metrics.solutionDecisionStepRate,
      solutionAverageBranching: metrics.solutionAverageBranching,
      wallUtilizationRate: metrics.wallUtilizationRate,
      offRouteAlternativeCount: metrics.offRouteAlternativeCount,
      immediateDeadEndAlternativeRate: metrics.immediateDeadEndAlternativeRate,
      sameBlockRepeatRate: metrics.sameBlockRepeatRate,
      maxSameBlockRun: metrics.maxSameBlockRun,
      dominantDirectionRate: metrics.dominantDirectionRate,
      dominantColorRate: metrics.dominantColorRate,
      solverNodes: row.solver?.nodesExpanded,
      solverUniqueStates: row.solver?.uniqueStates,
      solverDurationMs: row.solver?.durationMs,
      templateId: row.variant?.templateId,
      transform: row.variant?.transform,
      counts: row.variant?.counts,
      colorPermutation: row.variant?.colorPermutation,
    };
    lines.push(columns.map((column) => csvCell(values[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function printHelp() {
  console.log(`Usage: node scripts/p3-04-candidate-audit.mjs [options]\n\nOptions:\n  --count <n>         Candidate count (default: ${P3_04_AUDIT_DEFAULTS.candidateCount})\n  --out-dir <path>    Output directory (default: audit-output/p3-04)\n  --seed-prefix <s>   Deterministic seed prefix\n  --require-p3-03r    Exit non-zero unless P3-03R acceptance passes\n`);
}

async function main() {
  const options = readArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  console.log(`P3-04 audit start: ${options.count} candidates`);
  const report = runCandidateAuditV2({
    candidateCount: options.count,
    seedPrefix: options.seedPrefix,
    onProgress(progress) {
      console.log(`P3-04 audit progress: ${progress.completed}/${progress.total}`);
    },
  });

  const outputDirectory = path.resolve(options.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(path.join(outputDirectory, 'candidates.csv'), buildCsv(report), 'utf8'),
    writeFile(path.join(outputDirectory, 'summary.md'), buildMarkdown(report), 'utf8'),
  ]);

  console.log(`P3-04 audit complete: ${outputDirectory}`);
  console.log(JSON.stringify(report.summary, null, 2));

  if (report.summary.inspectedCandidateCount !== options.count
      || report.summary.generatedCount + report.summary.generationFailureCount !== options.count) {
    process.exitCode = 1;
  }
  if (options.requireP303R && !report.acceptance.passed) {
    console.error(`P3-03R acceptance failed: ${report.acceptance.failures.join(' | ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
