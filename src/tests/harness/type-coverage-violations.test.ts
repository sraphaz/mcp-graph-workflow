import { describe, it, expect } from 'vitest';
import { scanTypeCoverage } from '../../core/harness/type-coverage-scanner.js';
import type { ViolationDetail } from '../../core/harness/violation-detail.js';

describe('Type Coverage Scanner — file-level violations', () => {
  it('should detect any_usage with correct line number', () => {
    const files = [{
      path: 'src/core/store.ts',
      content: 'const x = 1;\nconst y: any = 2;\nconst z = 3;',
    }];
    const result = scanTypeCoverage(files, { collectViolations: true });
    expect(result.violations).toBeDefined();
    expect(result.violations!.length).toBe(1);

    const v = result.violations![0];
    expect(v.file).toBe('src/core/store.ts');
    expect(v.line).toBe(2);
    expect(v.dimension).toBe('types');
    expect(v.violationType).toBe('any_usage');
    expect(v.confidence).toBe(1.0);
    expect(v.evidence).toContain('any');
  });

  it('should detect as_any_cast with correct line number', () => {
    const files = [{
      path: 'src/core/utils.ts',
      content: 'const a = 1;\nconst b = value as any;\nconst c = 3;',
    }];
    const result = scanTypeCoverage(files, { collectViolations: true });
    expect(result.violations).toBeDefined();

    const v = result.violations!.find((v: ViolationDetail) => v.violationType === 'as_any_cast');
    expect(v).toBeDefined();
    expect(v!.line).toBe(2);
    expect(v!.confidence).toBe(1.0);
  });

  it('should detect multiple violations across files', () => {
    const files = [
      { path: 'a.ts', content: 'const x: any = 1;\nconst y: any = 2;' },
      { path: 'b.ts', content: 'const z = value as any;' },
    ];
    const result = scanTypeCoverage(files, { collectViolations: true });
    expect(result.violations!.length).toBe(3);
    expect(result.violations!.filter((v: ViolationDetail) => v.file === 'a.ts').length).toBe(2);
    expect(result.violations!.filter((v: ViolationDetail) => v.file === 'b.ts').length).toBe(1);
  });

  it('should return no violations field when collectViolations is false (backward compat)', () => {
    const files = [{ path: 'a.ts', content: 'const x: any = 1;' }];
    const result = scanTypeCoverage(files);
    expect(result.violations).toBeUndefined();
    // Score should still work
    expect(result.typeScore).toBe(0);
    expect(result.anyCount).toBe(1);
  });

  it('should return no violations field when collectViolations option omitted (backward compat)', () => {
    const files = [{ path: 'a.ts', content: 'const x: any = 1;' }];
    const result = scanTypeCoverage(files, {});
    expect(result.violations).toBeUndefined();
  });

  it('should produce deterministic output (same input 2x = same output)', () => {
    const files = [
      { path: 'a.ts', content: 'const x: any = 1;\nconst y = value as any;' },
      { path: 'b.ts', content: 'const z: any = 3;' },
    ];
    const result1 = scanTypeCoverage(files, { collectViolations: true });
    const result2 = scanTypeCoverage(files, { collectViolations: true });
    expect(JSON.stringify(result1.violations)).toBe(JSON.stringify(result2.violations));
  });

  it('should return empty violations for clean files', () => {
    const files = [{ path: 'clean.ts', content: 'const x: string = "hello";' }];
    const result = scanTypeCoverage(files, { collectViolations: true });
    expect(result.violations).toBeDefined();
    expect(result.violations!.length).toBe(0);
  });

  it('should preserve aggregate score when collecting violations', () => {
    const files = [
      { path: 'a.ts', content: 'const x: any = 1;' },
      { path: 'b.ts', content: 'const y: string = "ok";' },
    ];
    const withViolations = scanTypeCoverage(files, { collectViolations: true });
    const without = scanTypeCoverage(files);
    expect(withViolations.typeScore).toBe(without.typeScore);
    expect(withViolations.anyCount).toBe(without.anyCount);
    expect(withViolations.filesWithAny).toBe(without.filesWithAny);
  });
});
