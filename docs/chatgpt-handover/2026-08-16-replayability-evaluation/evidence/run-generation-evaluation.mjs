import { generateBoard, DIFFICULTIES } from '../../../../src/core/generator.js';

const SAMPLE_SIZE = 200;
const result = {};

for (const difficulty of Object.keys(DIFFICULTIES)) {
  const rows = [];
  for (let i = 0; i < SAMPLE_SIZE; i += 1) {
    const meta = generateBoard({ difficulty, seed: `evaluation-${difficulty}-${i}` });
    rows.push({
      seed: meta.seed,
      optimalSwipes: meta.optimalSwipes,
      shortestDistanceCells: meta.shortestDistanceCells,
      fromFallback: meta.fromFallback,
      walls: meta.board.walls.size,
      blocks: meta.board.blocks.length,
    });
  }

  const summary = (key) => {
    const values = rows.map((row) => row[key]);
    const distribution = Object.fromEntries(
      [...new Set(values)]
        .sort((a, b) => a - b)
        .map((value) => [value, values.filter((candidate) => candidate === value).length]),
    );
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
      distribution,
    };
  };

  result[difficulty] = {
    label: DIFFICULTIES[difficulty].label,
    sampleSize: SAMPLE_SIZE,
    fallbackCount: rows.filter((row) => row.fromFallback).length,
    optimalSwipes: summary('optimalSwipes'),
    shortestDistanceCells: summary('shortestDistanceCells'),
    rows,
  };
}

console.log(JSON.stringify(result, null, 2));
