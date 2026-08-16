import { generateBoard } from '../../../../src/core/generator.js';
import { quickSolvable, solveOptimalSwipes } from '../../../../src/core/solver.js';

const cases = [
  { difficulty: 'hard', seed: 'evaluation-hard-0' },
  { difficulty: 'expert', seed: 'evaluation-expert-0' },
  { difficulty: 'expert', seed: 'evaluation-expert-1' },
];

for (const testCase of cases) {
  let seed = testCase.seed;
  let meta = generateBoard({ difficulty: testCase.difficulty, seed });

  for (let i = 0; meta.optimalSwipes !== -1 && i < 200; i += 1) {
    seed = `evaluation-${testCase.difficulty}-${i}`;
    meta = generateBoard({ difficulty: testCase.difficulty, seed });
  }

  const output = {
    difficulty: testCase.difficulty,
    seed,
    generatorClaim: {
      optimalSwipes: meta.optimalSwipes,
      exact: meta.exact,
      fromFallback: meta.fromFallback,
      shortestDistanceCells: meta.shortestDistanceCells,
    },
    quickSolvable: quickSolvable(meta.board),
    runs: [20000, 100000, 400000, 1000000].map((maxNodes) => {
      const result = solveOptimalSwipes(meta.board, { maxNodes });
      return {
        maxNodes,
        solved: result.solved,
        optimalSwipes: result.optimalSwipes,
        reason: result.reason ?? null,
        nodes: result.nodes,
      };
    }),
  };

  console.log(JSON.stringify(output));
}
