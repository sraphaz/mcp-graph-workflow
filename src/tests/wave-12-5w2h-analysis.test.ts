import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';

/**
 * 5W2H Analysis Schema for Wave-12 Sandbox Build
 * Validates strategic planning dimensions with Zod v4
 */

// Test 1: Schema validation for Why dimension
describe('Wave-12 5W2H Analysis - Why Dimension', () => {
  const WhySchema = z.object({
    rationale: z.string().min(10, 'Why rationale must be at least 10 characters'),
    benefits: z.array(z.string()).min(1, 'Must have at least 1 benefit'),
    risks_mitigated: z.array(z.string()).optional(),
  });

  it('should validate strategic rationale for Why', () => {
    const validWhy = {
      rationale: 'Faster feedback loops reduce CI/CD cycle time from hours to minutes',
      benefits: [
        'Lower cost per iteration',
        'Increased local confidence before push',
        'Deterministic gate before remote CI',
      ],
      risks_mitigated: ['Late-stage test failures', 'CI resource waste'],
    };

    const result = WhySchema.safeParse(validWhy);
    expect(result.success).toBe(true);
  });

  it('should reject Why with empty rationale', () => {
    const invalidWhy = {
      rationale: '',
      benefits: ['Some benefit'],
    };

    const result = WhySchema.safeParse(invalidWhy);
    expect(result.success).toBe(false);
  });

  it('should reject Why with no benefits', () => {
    const invalidWhy = {
      rationale: 'Valid reason for sandbox',
      benefits: [],
    };

    const result = WhySchema.safeParse(invalidWhy);
    expect(result.success).toBe(false);
  });
});

// Test 2: Schema validation for What dimension
describe('Wave-12 5W2H Analysis - What Dimension', () => {
  const WhatSchema = z.object({
    artifact: z.string().min(5),
    deliverables: z.array(z.string()).min(1),
    scope: z.enum(['cli-tool', 'docker-podman', 'process-isolation', 'hybrid']),
  });

  it('should validate artifact and deliverables for What', () => {
    const validWhat = {
      artifact: 'Sandbox CLI tool with Docker/Podman/Process fallback',
      deliverables: [
        'Command: sandbox resolve (dependency resolution)',
        'Command: sandbox build (compilation)',
        'Command: sandbox test (test execution)',
        'Command: sandbox lint (linting)',
        'Command: sandbox report (reporting)',
      ],
      scope: 'hybrid',
    };

    const result = WhatSchema.safeParse(validWhat);
    expect(result.success).toBe(true);
  });

  it('should enforce valid scope enum', () => {
    const invalidWhat = {
      artifact: 'Sandbox tool',
      deliverables: ['Something'],
      scope: 'invalid-scope',
    };

    const result = WhatSchema.safeParse(invalidWhat);
    expect(result.success).toBe(false);
  });
});

// Test 3: Schema validation for Who dimension
describe('Wave-12 5W2H Analysis - Who Dimension', () => {
  const StakeholderSchema = z.object({
    role: z.string(),
    responsibilities: z.array(z.string()),
    count_estimate: z.number().int().positive().optional(),
  });

  const WhoSchema = z.object({
    primary_stakeholders: z.array(StakeholderSchema).min(1),
    secondary_stakeholders: z.array(StakeholderSchema).optional(),
  });

  it('should validate stakeholder roles and responsibilities', () => {
    const validWho = {
      primary_stakeholders: [
        {
          role: 'AI Developers',
          responsibilities: ['Use start_task/finish_task', 'Debug sandbox failures'],
          count_estimate: 15,
        },
        {
          role: 'QA Engineers',
          responsibilities: ['Validate sandbox outputs', 'Report regressions'],
          count_estimate: 5,
        },
      ],
      secondary_stakeholders: [
        {
          role: 'Infra Teams',
          responsibilities: ['Monitor sandbox resource usage', 'Tune isolation configs'],
        },
      ],
    };

    const result = WhoSchema.safeParse(validWho);
    expect(result.success).toBe(true);
  });

  it('should require at least 1 primary stakeholder', () => {
    const invalidWho = {
      primary_stakeholders: [],
    };

    const result = WhoSchema.safeParse(invalidWho);
    expect(result.success).toBe(false);
  });
});

// Test 4: Schema validation for When dimension
describe('Wave-12 5W2H Analysis - When Dimension', () => {
  const PhaseSchema = z.object({
    phase_name: z.enum([
      'ANALYZE',
      'DESIGN',
      'PLAN',
      'IMPLEMENT',
      'VALIDATE',
      'REVIEW',
      'HANDOFF',
      'DEPLOY',
      'LISTENING',
    ]),
    duration_weeks: z.number().positive(),
    dependencies: z.array(z.string()).optional(),
  });

  const WhenSchema = z.object({
    timeline_phases: z.array(PhaseSchema).min(1),
    total_duration_weeks: z.number().positive(),
    critical_milestone: z.string(),
  });

  it('should validate timeline phases', () => {
    const validWhen = {
      timeline_phases: [
        {
          phase_name: 'ANALYZE',
          duration_weeks: 1,
          dependencies: [],
        },
        {
          phase_name: 'DESIGN',
          duration_weeks: 1,
          dependencies: ['ANALYZE'],
        },
        {
          phase_name: 'PLAN',
          duration_weeks: 1,
          dependencies: ['DESIGN'],
        },
        {
          phase_name: 'IMPLEMENT',
          duration_weeks: 2,
          dependencies: ['PLAN'],
        },
      ],
      total_duration_weeks: 5,
      critical_milestone: 'MVP release at end of IMPLEMENT phase',
    };

    const result = WhenSchema.safeParse(validWhen);
    expect(result.success).toBe(true);
  });

  it('should reject invalid phase names', () => {
    const invalidWhen = {
      timeline_phases: [
        {
          phase_name: 'INVALID_PHASE',
          duration_weeks: 1,
        },
      ],
      total_duration_weeks: 1,
      critical_milestone: 'Some milestone',
    };

    const result = WhenSchema.safeParse(invalidWhen);
    expect(result.success).toBe(false);
  });
});

// Test 5: Schema validation for Where dimension
describe('Wave-12 5W2H Analysis - Where Dimension', () => {
  const EnvironmentSchema = z.object({
    name: z.enum(['local', 'ci-pipeline', 'team-machines', 'cloud-sandbox']),
    purpose: z.string(),
    access_requirements: z.array(z.string()).optional(),
  });

  const WhereSchema = z.object({
    execution_environments: z.array(EnvironmentSchema).min(1),
    primary_environment: z.enum(['local', 'ci-pipeline', 'team-machines', 'cloud-sandbox']),
  });

  it('should validate execution environments', () => {
    const validWhere = {
      execution_environments: [
        {
          name: 'local',
          purpose: 'Developer pre-push validation',
          access_requirements: ['Docker or Podman installed', 'npm >= 18'],
        },
        {
          name: 'ci-pipeline',
          purpose: 'Automated sandbox execution in CI',
          access_requirements: ['CI runner with sandbox binary'],
        },
      ],
      primary_environment: 'local',
    };

    const result = WhereSchema.safeParse(validWhere);
    expect(result.success).toBe(true);
  });
});

// Test 6: Schema validation for How dimension
describe('Wave-12 5W2H Analysis - How Dimension', () => {
  const ComponentSchema = z.object({
    name: z.string(),
    responsibility: z.string(),
    technology_stack: z.array(z.string()),
  });

  const HowSchema = z.object({
    approach: z.string(),
    architecture_tiers: z.array(ComponentSchema).min(1),
    key_mechanisms: z.array(z.string()).min(1),
    fallback_strategies: z.array(z.string()).optional(),
  });

  it('should validate approach and architecture tiers', () => {
    const validHow = {
      approach:
        '3-tier isolation with caching and deterministic fingerprinting for reproducibility',
      architecture_tiers: [
        {
          name: 'Resolver',
          responsibility: 'Dependency resolution with lockfile pinning',
          technology_stack: ['npm ci', 'package-lock.json'],
        },
        {
          name: 'Builder',
          responsibility: 'Compilation and artifact generation',
          technology_stack: ['TypeScript', 'tsc', 'Vite'],
        },
        {
          name: 'Reporter',
          responsibility: 'Test results and diagnostics',
          technology_stack: ['Vitest', 'JSON output format'],
        },
      ],
      key_mechanisms: [
        'Deterministic execution via fixed seed',
        'Content addressable caching by fingerprint',
        'Isolation via Docker/Podman containers or process namespaces',
      ],
      fallback_strategies: [
        'Process isolation fallback if Docker unavailable',
        'Local temp directory if no containerization',
      ],
    };

    const result = HowSchema.safeParse(validHow);
    expect(result.success).toBe(true);
  });

  it('should require at least 1 key mechanism', () => {
    const invalidHow = {
      approach: 'Some approach',
      architecture_tiers: [
        {
          name: 'Tier1',
          responsibility: 'Do something',
          technology_stack: ['Tech1'],
        },
      ],
      key_mechanisms: [],
    };

    const result = HowSchema.safeParse(invalidHow);
    expect(result.success).toBe(false);
  });
});

// Test 7: Schema validation for How Much dimension
describe('Wave-12 5W2H Analysis - How Much Dimension', () => {
  const HowMuchSchema = z.object({
    cost_summary: z.object({
      development_effort_person_weeks: z.number().positive(),
      infrastructure_cost_usd_monthly: z.number().nonnegative().optional(),
      maintenance_effort_percent: z.number().min(0).max(100),
    }),
    team_size: z.object({
      developers: z.number().int().nonnegative(),
      qa_engineers: z.number().int().nonnegative(),
      devops_infra: z.number().int().nonnegative(),
    }),
    resource_requirements: z.object({
      compute_hours_per_week: z.number().positive(),
      storage_gb: z.number().positive(),
      concurrent_executions: z.number().int().positive(),
    }),
    incremental_phases: z.array(
      z.object({
        phase: z.string(),
        effort_weeks: z.number().positive(),
        scope: z.string(),
      })
    ),
  });

  it('should validate cost and effort estimates', () => {
    const validHowMuch = {
      cost_summary: {
        development_effort_person_weeks: 8,
        infrastructure_cost_usd_monthly: 150,
        maintenance_effort_percent: 15,
      },
      team_size: {
        developers: 2,
        qa_engineers: 1,
        devops_infra: 1,
      },
      resource_requirements: {
        compute_hours_per_week: 40,
        storage_gb: 10,
        concurrent_executions: 5,
      },
      incremental_phases: [
        {
          phase: 'MVP (Phase 1)',
          effort_weeks: 2,
          scope: 'Basic resolve + build + test on local Docker',
        },
        {
          phase: 'V1 (Phase 2)',
          effort_weeks: 2,
          scope: 'Add lint + report + caching',
        },
        {
          phase: 'V2 (Phase 3)',
          effort_weeks: 2,
          scope: 'CI/CD pipeline integration',
        },
        {
          phase: 'V3 (Phase 4)',
          effort_weeks: 2,
          scope: 'Advanced features: multi-env, fingerprinting, analytics',
        },
      ],
    };

    const result = HowMuchSchema.safeParse(validHowMuch);
    expect(result.success).toBe(true);
  });

  it('should reject negative effort estimates', () => {
    const invalidHowMuch = {
      cost_summary: {
        development_effort_person_weeks: -5,
        maintenance_effort_percent: 10,
      },
      team_size: { developers: 0, qa_engineers: 0, devops_infra: 0 },
      resource_requirements: { compute_hours_per_week: 40, storage_gb: 10, concurrent_executions: 1 },
      incremental_phases: [],
    };

    const result = HowMuchSchema.safeParse(invalidHowMuch);
    expect(result.success).toBe(false);
  });
});

// Test 8: Full 5W2H Analysis Schema
describe('Wave-12 5W2H Complete Analysis', () => {
  const Wave125W2HSchema = z.object({
    initiative_id: z.string().min(5),
    initiative_name: z.string(),
    created_at: z.string().datetime(),
    last_updated: z.string().datetime(),
    why: z.object({
      rationale: z.string().min(10),
      benefits: z.array(z.string()).min(1),
      risks_mitigated: z.array(z.string()).optional(),
    }),
    what: z.object({
      artifact: z.string().min(5),
      deliverables: z.array(z.string()).min(1),
      scope: z.enum(['cli-tool', 'docker-podman', 'process-isolation', 'hybrid']),
    }),
    who: z.object({
      primary_stakeholders: z
        .array(
          z.object({
            role: z.string(),
            responsibilities: z.array(z.string()),
            count_estimate: z.number().int().positive().optional(),
          })
        )
        .min(1),
      secondary_stakeholders: z
        .array(
          z.object({
            role: z.string(),
            responsibilities: z.array(z.string()),
            count_estimate: z.number().int().positive().optional(),
          })
        )
        .optional(),
    }),
    when: z.object({
      timeline_phases: z
        .array(
          z.object({
            phase_name: z.enum([
              'ANALYZE',
              'DESIGN',
              'PLAN',
              'IMPLEMENT',
              'VALIDATE',
              'REVIEW',
              'HANDOFF',
              'DEPLOY',
              'LISTENING',
            ]),
            duration_weeks: z.number().positive(),
            dependencies: z.array(z.string()).optional(),
          })
        )
        .min(1),
      total_duration_weeks: z.number().positive(),
      critical_milestone: z.string(),
    }),
    where: z.object({
      execution_environments: z
        .array(
          z.object({
            name: z.enum(['local', 'ci-pipeline', 'team-machines', 'cloud-sandbox']),
            purpose: z.string(),
            access_requirements: z.array(z.string()).optional(),
          })
        )
        .min(1),
      primary_environment: z.enum(['local', 'ci-pipeline', 'team-machines', 'cloud-sandbox']),
    }),
    how: z.object({
      approach: z.string(),
      architecture_tiers: z
        .array(
          z.object({
            name: z.string(),
            responsibility: z.string(),
            technology_stack: z.array(z.string()),
          })
        )
        .min(1),
      key_mechanisms: z.array(z.string()).min(1),
      fallback_strategies: z.array(z.string()).optional(),
    }),
    how_much: z.object({
      cost_summary: z.object({
        development_effort_person_weeks: z.number().positive(),
        infrastructure_cost_usd_monthly: z.number().nonnegative().optional(),
        maintenance_effort_percent: z.number().min(0).max(100),
      }),
      team_size: z.object({
        developers: z.number().int().nonnegative(),
        qa_engineers: z.number().int().nonnegative(),
        devops_infra: z.number().int().nonnegative(),
      }),
      resource_requirements: z.object({
        compute_hours_per_week: z.number().positive(),
        storage_gb: z.number().positive(),
        concurrent_executions: z.number().int().positive(),
      }),
      incremental_phases: z.array(
        z.object({
          phase: z.string(),
          effort_weeks: z.number().positive(),
          scope: z.string(),
        })
      ),
    }),
  });

  type Wave125W2H = z.infer<typeof Wave125W2HSchema>;

  it('should validate complete 5W2H analysis document', () => {
    const now = new Date().toISOString();
    const complete5W2H: Wave125W2H = {
      initiative_id: 'wave-12-sandbox-build',
      initiative_name: 'Wave-12: Sandbox Build (Local CI/CD Isolation)',
      created_at: now,
      last_updated: now,
      why: {
        rationale: 'Faster feedback loops reduce CI/CD cycle time from hours to minutes',
        benefits: [
          'Lower cost per iteration',
          'Increased local confidence before push',
          'Deterministic gate before remote CI',
        ],
        risks_mitigated: ['Late-stage test failures', 'CI resource waste'],
      },
      what: {
        artifact: 'Sandbox CLI tool with Docker/Podman/Process fallback',
        deliverables: [
          'Command: sandbox resolve',
          'Command: sandbox build',
          'Command: sandbox test',
          'Command: sandbox lint',
          'Command: sandbox report',
        ],
        scope: 'hybrid',
      },
      who: {
        primary_stakeholders: [
          {
            role: 'AI Developers',
            responsibilities: ['Use start_task/finish_task', 'Debug sandbox failures'],
            count_estimate: 15,
          },
          {
            role: 'QA Engineers',
            responsibilities: ['Validate sandbox outputs', 'Report regressions'],
            count_estimate: 5,
          },
        ],
        secondary_stakeholders: [
          {
            role: 'Infra Teams',
            responsibilities: ['Monitor sandbox resource usage'],
            count_estimate: 2,
          },
        ],
      },
      when: {
        timeline_phases: [
          {
            phase_name: 'ANALYZE',
            duration_weeks: 1,
            dependencies: [],
          },
          {
            phase_name: 'DESIGN',
            duration_weeks: 1,
            dependencies: ['ANALYZE'],
          },
          {
            phase_name: 'PLAN',
            duration_weeks: 1,
            dependencies: ['DESIGN'],
          },
          {
            phase_name: 'IMPLEMENT',
            duration_weeks: 2,
            dependencies: ['PLAN'],
          },
        ],
        total_duration_weeks: 5,
        critical_milestone: 'MVP release at end of IMPLEMENT phase',
      },
      where: {
        execution_environments: [
          {
            name: 'local',
            purpose: 'Developer pre-push validation',
            access_requirements: ['Docker or Podman installed', 'npm >= 18'],
          },
          {
            name: 'ci-pipeline',
            purpose: 'Automated sandbox execution in CI',
            access_requirements: ['CI runner with sandbox binary'],
          },
        ],
        primary_environment: 'local',
      },
      how: {
        approach:
          '3-tier isolation with caching and deterministic fingerprinting for reproducibility',
        architecture_tiers: [
          {
            name: 'Resolver',
            responsibility: 'Dependency resolution with lockfile pinning',
            technology_stack: ['npm ci', 'package-lock.json'],
          },
          {
            name: 'Builder',
            responsibility: 'Compilation and artifact generation',
            technology_stack: ['TypeScript', 'tsc', 'Vite'],
          },
          {
            name: 'Reporter',
            responsibility: 'Test results and diagnostics',
            technology_stack: ['Vitest', 'JSON output format'],
          },
        ],
        key_mechanisms: [
          'Deterministic execution via fixed seed',
          'Content addressable caching by fingerprint',
          'Isolation via Docker/Podman containers or process namespaces',
        ],
        fallback_strategies: [
          'Process isolation fallback if Docker unavailable',
          'Local temp directory if no containerization',
        ],
      },
      how_much: {
        cost_summary: {
          development_effort_person_weeks: 8,
          infrastructure_cost_usd_monthly: 150,
          maintenance_effort_percent: 15,
        },
        team_size: {
          developers: 2,
          qa_engineers: 1,
          devops_infra: 1,
        },
        resource_requirements: {
          compute_hours_per_week: 40,
          storage_gb: 10,
          concurrent_executions: 5,
        },
        incremental_phases: [
          {
            phase: 'MVP (Phase 1)',
            effort_weeks: 2,
            scope: 'Basic resolve + build + test on local Docker',
          },
          {
            phase: 'V1 (Phase 2)',
            effort_weeks: 2,
            scope: 'Add lint + report + caching',
          },
          {
            phase: 'V2 (Phase 3)',
            effort_weeks: 2,
            scope: 'CI/CD pipeline integration',
          },
          {
            phase: 'V3 (Phase 4)',
            effort_weeks: 2,
            scope: 'Advanced features: multi-env, fingerprinting, analytics',
          },
        ],
      },
    };

    const result = Wave125W2HSchema.safeParse(complete5W2H);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.initiative_id).toBe('wave-12-sandbox-build');
      expect(result.data.why.benefits.length).toBe(3);
      expect(result.data.what.deliverables.length).toBe(5);
      expect(result.data.who.primary_stakeholders.length).toBe(2);
      expect(result.data.when.timeline_phases.length).toBe(4);
      expect(result.data.where.execution_environments.length).toBe(2);
      expect(result.data.how.architecture_tiers.length).toBe(3);
      expect(result.data.how_much.incremental_phases.length).toBe(4);
      expect(result.data.how_much.team_size.developers).toBe(2);
    }
  });

  it('should provide proper TypeScript inference from Zod schema', () => {
    type Inferred = z.infer<typeof Wave125W2HSchema>;
    const obj: Inferred = {
      initiative_id: 'test',
      initiative_name: 'Test Initiative',
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      why: {
        rationale: 'This is a valid rationale',
        benefits: ['benefit1'],
      },
      what: {
        artifact: 'test artifact',
        deliverables: ['deliverable1'],
        scope: 'cli-tool',
      },
      who: {
        primary_stakeholders: [
          {
            role: 'Role1',
            responsibilities: ['resp1'],
          },
        ],
      },
      when: {
        timeline_phases: [
          {
            phase_name: 'ANALYZE',
            duration_weeks: 1,
          },
        ],
        total_duration_weeks: 1,
        critical_milestone: 'milestone',
      },
      where: {
        execution_environments: [
          {
            name: 'local',
            purpose: 'testing',
          },
        ],
        primary_environment: 'local',
      },
      how: {
        approach: 'test approach',
        architecture_tiers: [
          {
            name: 'tier1',
            responsibility: 'resp1',
            technology_stack: ['tech1'],
          },
        ],
        key_mechanisms: ['mech1'],
      },
      how_much: {
        cost_summary: {
          development_effort_person_weeks: 1,
          maintenance_effort_percent: 10,
        },
        team_size: {
          developers: 1,
          qa_engineers: 0,
          devops_infra: 0,
        },
        resource_requirements: {
          compute_hours_per_week: 40,
          storage_gb: 5,
          concurrent_executions: 1,
        },
        incremental_phases: [
          {
            phase: 'Phase 1',
            effort_weeks: 1,
            scope: 'test scope',
          },
        ],
      },
    };

    expect(obj.initiative_id).toBeDefined();
    expect(obj.why.benefits).toBeDefined();
  });
});
