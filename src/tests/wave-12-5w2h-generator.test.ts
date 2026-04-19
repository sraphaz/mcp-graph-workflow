import { describe, it, expect } from 'vitest';
import {
  generateWave125W2HAnalysis,
  validate5W2HAnalysis,
  format5W2HForDisplay,
} from '../core/analyzer/wave-12-5w2h-generator.js';

describe('Wave-12 5W2H Generator', () => {
  it('should generate complete 5W2H analysis with all dimensions', () => {
    const analysis = generateWave125W2HAnalysis();

    expect(analysis.initiative_id).toBe('wave-12-sandbox-build');
    expect(analysis.initiative_name).toBe('Wave-12: Sandbox Build (Local CI/CD Isolation)');
    expect(analysis.created_at).toBeDefined();
    expect(analysis.last_updated).toBeDefined();
  });

  it('should populate Why dimension', () => {
    const analysis = generateWave125W2HAnalysis();

    expect(analysis.why.rationale.length).toBeGreaterThan(10);
    expect(analysis.why.benefits.length).toBeGreaterThan(0);
    expect(analysis.why.risks_mitigated?.length).toBeGreaterThan(0);
  });

  it('should populate What dimension with deliverables', () => {
    const analysis = generateWave125W2HAnalysis();

    expect(analysis.what.artifact.length).toBeGreaterThan(5);
    expect(analysis.what.deliverables.length).toBeGreaterThan(5);
    expect(analysis.what.scope).toBe('hybrid');
  });

  it('should populate Who dimension with stakeholders', () => {
    const analysis = generateWave125W2HAnalysis();

    expect(analysis.who.primary_stakeholders.length).toBeGreaterThan(0);
    expect(analysis.who.primary_stakeholders[0].role).toBeDefined();
    expect(analysis.who.primary_stakeholders[0].responsibilities.length).toBeGreaterThan(0);
  });

  it('should populate When dimension with phases', () => {
    const analysis = generateWave125W2HAnalysis();

    expect(analysis.when.timeline_phases.length).toBeGreaterThan(0);
    expect(analysis.when.total_duration_weeks).toBeGreaterThan(0);
    expect(analysis.when.critical_milestone).toBeDefined();
  });

  it('should populate Where dimension with environments', () => {
    const analysis = generateWave125W2HAnalysis();

    expect(analysis.where.execution_environments.length).toBeGreaterThan(0);
    expect(analysis.where.primary_environment).toBe('local');
  });

  it('should populate How dimension with architecture', () => {
    const analysis = generateWave125W2HAnalysis();

    expect(analysis.how.approach.length).toBeGreaterThan(0);
    expect(analysis.how.architecture_tiers.length).toBe(3); // Resolver, Builder, Reporter
    expect(analysis.how.key_mechanisms.length).toBeGreaterThan(0);
  });

  it('should populate How Much dimension with cost estimates', () => {
    const analysis = generateWave125W2HAnalysis();

    expect(analysis.how_much.cost_summary.development_effort_person_weeks).toBe(8);
    expect(analysis.how_much.team_size.developers).toBe(2);
    expect(analysis.how_much.incremental_phases.length).toBe(4); // MVP, V1, V2, V3
  });

  it('should validate generated analysis', () => {
    const analysis = generateWave125W2HAnalysis();
    const result = validate5W2HAnalysis(analysis);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.initiative_id).toBe('wave-12-sandbox-build');
    }
  });

  it('should reject invalid analysis', () => {
    const invalid = {
      initiative_id: 'short',
      initiative_name: 'Test',
      created_at: 'invalid-date',
      last_updated: 'invalid-date',
      why: { benefits: [] }, // Invalid: empty benefits array
      what: { artifact: 'test', deliverables: [], scope: 'invalid' },
      who: { primary_stakeholders: [] }, // Invalid: empty stakeholders
      when: { timeline_phases: [], total_duration_weeks: 1, critical_milestone: 'test' },
      where: { execution_environments: [], primary_environment: 'local' },
      how: {
        approach: 'test',
        architecture_tiers: [],
        key_mechanisms: [],
      },
      how_much: {
        cost_summary: { development_effort_person_weeks: 1, maintenance_effort_percent: 10 },
        team_size: { developers: 0, qa_engineers: 0, devops_infra: 0 },
        resource_requirements: { compute_hours_per_week: 40, storage_gb: 5, concurrent_executions: 1 },
        incremental_phases: [],
      },
    };

    const result = validate5W2HAnalysis(invalid);
    expect(result.valid).toBe(false);
  });

  it('should format analysis for display', () => {
    const analysis = generateWave125W2HAnalysis();
    const formatted = format5W2HForDisplay(analysis);

    expect(formatted).toContain('WHY (Strategic Rationale)');
    expect(formatted).toContain('WHAT (Artifacts & Deliverables)');
    expect(formatted).toContain('WHO (Stakeholders)');
    expect(formatted).toContain('WHEN (Timeline)');
    expect(formatted).toContain('WHERE (Environments)');
    expect(formatted).toContain('HOW (Technical Approach)');
    expect(formatted).toContain('HOW MUCH (Cost & Effort)');
    expect(formatted).toContain(analysis.initiative_name);
  });

  it('should include all stakeholders in formatted output', () => {
    const analysis = generateWave125W2HAnalysis();
    const formatted = format5W2HForDisplay(analysis);

    expect(formatted).toContain('AI Developers');
    expect(formatted).toContain('QA Engineers');
  });

  it('should include all deliverables in formatted output', () => {
    const analysis = generateWave125W2HAnalysis();
    const formatted = format5W2HForDisplay(analysis);

    expect(formatted).toContain('sandbox resolve');
    expect(formatted).toContain('sandbox build');
    expect(formatted).toContain('sandbox test');
    expect(formatted).toContain('sandbox lint');
    expect(formatted).toContain('sandbox report');
  });

  it('should include all phases in formatted output', () => {
    const analysis = generateWave125W2HAnalysis();
    const formatted = format5W2HForDisplay(analysis);

    expect(formatted).toContain('ANALYZE');
    expect(formatted).toContain('DESIGN');
    expect(formatted).toContain('PLAN');
    expect(formatted).toContain('IMPLEMENT');
  });

  it('should include incremental phases in formatted output', () => {
    const analysis = generateWave125W2HAnalysis();
    const formatted = format5W2HForDisplay(analysis);

    expect(formatted).toContain('MVP');
    expect(formatted).toContain('V1');
    expect(formatted).toContain('V2');
    expect(formatted).toContain('V3');
  });
});
