import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import { scanTypeCoverage } from '../src/core/harness/type-coverage-scanner.js';
import { scanTestCoverage } from '../src/core/harness/test-coverage-scanner.js';
import { scanDocsCoverage } from '../src/core/harness/docs-coverage-scanner.js';
import { computeHarnessabilityScore } from '../src/core/harness/harnessability-score.js';
import { checkDependencyDirection, checkCircularDependencies, checkBarrelIntegrity } from '../src/core/harness/fitness-functions.js';

async function runScan() {
  console.log('🚀 Iniciando Harnessability Scan v7.0...\n');

  // 1. Type Coverage
  const tsFiles = globSync('src/**/*.ts', { ignore: ['src/**/*.test.ts', 'src/**/*.bench.ts', 'src/types/**'] });
  const typeFiles = tsFiles.map(p => ({
    path: p,
    content: fs.readFileSync(p, 'utf-8')
  }));
  const typeResult = scanTypeCoverage(typeFiles);

  // 2. Test Coverage
  const modules = globSync('src/**/*.ts', { ignore: ['src/**/*.test.ts', 'src/**/*.bench.ts', 'src/index.ts'] })
    .map(p => path.basename(p, '.ts'));
  const testFiles = globSync('src/tests/**/*.test.ts').map(p => ({
    name: path.basename(p),
    hasAssertions: fs.readFileSync(p, 'utf-8').includes('expect(')
  }));
  const testResult = scanTestCoverage(modules, testFiles);

  // 3. Docs Coverage
  const docsInput = {
    hasClaudeMd: fs.existsSync('CLAUDE.md'),
    hasReadme: fs.existsSync('README.md'),
    rulesCount: globSync('.claude/rules/*.md').length,
    srcDirsCount: fs.readdirSync('src', { withFileTypes: true }).filter(d => d.isDirectory()).length,
    hasDocsDir: fs.existsSync('docs')
  };
  const docsResult = scanDocsCoverage(docsInput);

  // 4. Fitness Score
  const allSrcFiles = globSync('src/**/*.ts').map(p => ({
    path: p,
    content: fs.readFileSync(p, 'utf-8')
  }));
  const fitnessResults = [
    checkDependencyDirection(allSrcFiles),
    checkCircularDependencies(allSrcFiles),
    checkBarrelIntegrity(fs.readdirSync('src', { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => ({
        path: `src/${d.name}`,
        files: fs.readdirSync(`src/${d.name}`),
        indexContent: fs.existsSync(`src/${d.name}/index.ts`) ? fs.readFileSync(`src/${d.name}/index.ts`, 'utf-8') : null
      }))
    )
  ];
  const passedFitness = fitnessResults.filter(r => r.passed).length;
  const fitnessScore = Math.round((passedFitness / fitnessResults.length) * 100);

  // 5. Final Score
  const finalResult = computeHarnessabilityScore({
    typeScore: typeResult.typeScore,
    testScore: testResult.testScore,
    docsScore: docsResult.docsScore,
    fitnessScore: fitnessScore
  });

  // Output
  console.log('=========================================');
  console.log(`NOTA FINAL: ${finalResult.grade} (${finalResult.score}/100)`);
  console.log('=========================================');
  console.log(`\n[Dimensões]`);
  console.log(`- Type Coverage:    ${typeResult.typeScore}% (Files: ${typeResult.totalFiles}, Any: ${typeResult.filesWithAny})`);
  console.log(`- Test Coverage:    ${testResult.testScore}% (Modules: ${testResult.totalModules}, Tested: ${testResult.testedModules})`);
  console.log(`- Docs Coverage:    ${docsResult.docsScore}% (Claude.md: ${docsInput.hasClaudeMd}, Rules: ${docsInput.rulesCount})`);
  console.log(`- Architecture Fitness: ${fitnessScore}% (Checks: ${passedFitness}/${fitnessResults.length})`);

  if (finalResult.grade === 'A') {
    console.log('\n✅ PROJETO PRONTO PARA AGENTES (ELITE)');
  } else if (finalResult.grade === 'B') {
    console.log('\n⚠️ PROJETO BOM, MAS COM PONTOS DE ATENÇÃO');
  } else {
    console.log('\n❌ PROJETO COM BAIXO HARNESS (RISCO DE ALUCINAÇÃO)');
  }

  // Fitness details if failed
  fitnessResults.forEach(r => {
    if (!r.passed) {
      console.log(`\n[Falha em Fitness: ${r.name}]`);
      r.violations.slice(0, 3).forEach(v => console.log(`  - ${v.file}:${v.line} -> ${v.rule}`));
    }
  });
}

runScan().catch(err => {
  console.error('Falha no Scan:', err);
  process.exit(1);
});
