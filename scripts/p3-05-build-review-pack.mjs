#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  P3_05_EXPECTED_CANDIDATE_COUNT,
  buildP305ReviewPack,
  validateP305ReviewPack,
} from '../src/core/p3-05-review-pack.js';
import { createEmptyP305PlaytestRecord } from '../src/core/p3-05-playtest-record.js';

function readArguments(argv) {
  const options = {
    outputDirectory: 'review-output/p3-05',
    requireCount: P3_05_EXPECTED_CANDIDATE_COUNT,
    checkPack: null,
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--out-dir') options.outputDirectory = argv[++index];
    else if (argument === '--require-count') options.requireCount = Number(argv[++index]);
    else if (argument === '--check-pack') options.checkPack = argv[++index];
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new TypeError(`Unknown argument: ${argument}`);
  }
  if (!options.outputDirectory) throw new TypeError('--out-dir is required');
  if (!Number.isInteger(options.requireCount) || options.requireCount < 1) {
    throw new TypeError('--require-count must be an integer >= 1');
  }
  return options;
}

function csvCell(value) {
  if (value == null) return '';
  const text = Array.isArray(value) ? value.join('|') : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function buildPlaytestCsv(pack) {
  const columns = [
    'reviewId', 'templateId', 'profileId', 'puzzleId', 'boardHash', 'structureHash',
    'optimalSwipes', 'usesLanes', 'reviewer', 'device', 'browser', 'playedAt',
    'attemptCount', 'clearCount', 'bestTimeMs', 'bestSwipeCount',
    'enjoyment', 'clarity', 'difficulty', 'distinctiveness', 'fairness',
    'knownDeadlocks', 'notes', 'decision', 'decisionReason',
  ];
  const lines = [columns.join(',')];
  for (const candidate of pack.candidates) {
    const record = createEmptyP305PlaytestRecord(candidate);
    const row = {
      reviewId: candidate.reviewId,
      templateId: candidate.templateId,
      profileId: candidate.profileId,
      puzzleId: candidate.puzzleId,
      boardHash: candidate.boardHash,
      structureHash: candidate.structureHash,
      optimalSwipes: candidate.optimalSwipes,
      usesLanes: candidate.variant.usesLanes,
      reviewer: record.reviewer,
      device: record.device,
      browser: record.browser,
      playedAt: record.playedAt,
      attemptCount: record.attemptCount,
      clearCount: record.clearCount,
      bestTimeMs: record.bestTimeMs,
      bestSwipeCount: record.bestSwipeCount,
      enjoyment: record.ratings.enjoyment,
      clarity: record.ratings.clarity,
      difficulty: record.ratings.difficulty,
      distinctiveness: record.ratings.distinctiveness,
      fairness: record.ratings.fairness,
      knownDeadlocks: record.knownDeadlocks,
      notes: record.notes,
      decision: record.decision,
      decisionReason: record.decisionReason,
    };
    lines.push(columns.map((column) => csvCell(row[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function buildSummary(pack) {
  const profileRows = pack.profiles.map((profile) => (
    `| \`${profile.profileId}\` | ${profile.boxCount} | ${profile.colorCount} | ${profile.expectedOptimalSwipes} | ${profile.candidateCount} |`
  )).join('\n');
  const laneCount = pack.candidates.filter((candidate) => candidate.variant.usesLanes).length;
  const proofModes = {};
  for (const candidate of pack.candidates) {
    const key = candidate.proof.proofMode ?? 'component';
    proofModes[key] = (proofModes[key] ?? 0) + 1;
  }

  return `# HAKODASE P3-05 試遊候補パック\n\n## 状態\n\nこのファイルは人間試遊前の候補一覧です。候補はまだ公式問題ではありません。\n\n\`\`\`text\nschemaVersion: ${pack.schemaVersion}\npackVersion: ${pack.packVersion}\ngeneratorVersion: ${pack.generatorVersion}\ncandidateCount: ${pack.candidateCount}\noptimalSwipes: ${pack.minOptimalSwipes}-${pack.maxOptimalSwipes}\nusesLanes: ${laneCount}\nproofModes: ${JSON.stringify(proofModes)}\n\`\`\`\n\n## profile別\n\n| profile | 箱 | 色 | 厳密最短 | 候補数 |\n| --- | ---: | ---: | ---: | ---: |\n${profileRows}\n\n## 出力\n\n\`\`\`text\nreview-pack.json\nplaytest-records.json\nplaytest-sheet.csv\nsummary.md\n\`\`\`\n\n各候補には、盤面データ、厳密最短、代表解法、生成版、ルール版、boardHash、structureHash、自動品質指標を含めています。\n\n人間の試遊結果は\`playtest-records.json\`または\`playtest-sheet.csv\`へ記録します。\`accept\`には少なくとも1回のクリア、評価5項目、採用理由が必要です。\n`;
}

async function comparePack(pathname, generatedText) {
  const existing = await readFile(pathname, 'utf8');
  if (existing.trimEnd() !== generatedText.trimEnd()) {
    throw new Error(`Generated P3-05 review pack differs from ${pathname}`);
  }
}

function printHelp() {
  console.log(`Usage: node scripts/p3-05-build-review-pack.mjs [options]\n\nOptions:\n  --out-dir <path>       Output directory\n  --require-count <n>    Required candidate count (default: ${P3_05_EXPECTED_CANDIDATE_COUNT})\n  --check-pack <path>    Compare generated review-pack.json with a committed file\n`);
}

async function main() {
  const options = readArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const pack = buildP305ReviewPack();
  const validation = validateP305ReviewPack(pack);
  if (!validation.valid) throw new Error(`Invalid P3-05 review pack: ${validation.errors.join(', ')}`);
  if (pack.candidateCount !== options.requireCount) {
    throw new Error(`Expected ${options.requireCount} P3-05 candidates, got ${pack.candidateCount}`);
  }

  const records = pack.candidates.map(createEmptyP305PlaytestRecord);
  // 候補パックは機械読取用のため1行JSONにして、リポジトリ差分と公開物サイズを抑える。
  const packText = `${JSON.stringify(pack)}\n`;
  const recordsText = `${JSON.stringify({
    schemaVersion: 'hakodase.playtest-record-set/1',
    packVersion: pack.packVersion,
    records,
  }, null, 2)}\n`;

  if (options.checkPack) await comparePack(options.checkPack, packText);

  const outputDirectory = path.resolve(options.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'review-pack.json'), packText, 'utf8'),
    writeFile(path.join(outputDirectory, 'playtest-records.json'), recordsText, 'utf8'),
    writeFile(path.join(outputDirectory, 'playtest-sheet.csv'), buildPlaytestCsv(pack), 'utf8'),
    writeFile(path.join(outputDirectory, 'summary.md'), buildSummary(pack), 'utf8'),
  ]);

  console.log(JSON.stringify({
    outputDirectory,
    candidateCount: pack.candidateCount,
    profileCounts: Object.fromEntries(pack.profiles.map((profile) => [profile.profileId, profile.candidateCount])),
    minOptimalSwipes: pack.minOptimalSwipes,
    maxOptimalSwipes: pack.maxOptimalSwipes,
    uniqueBoardHashes: new Set(pack.candidates.map((candidate) => candidate.boardHash)).size,
    uniqueStructureHashes: new Set(pack.candidates.map((candidate) => candidate.structureHash)).size,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
