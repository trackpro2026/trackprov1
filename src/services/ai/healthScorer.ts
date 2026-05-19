import { generateJson, isGeminiConfigured } from './gemini.util';

export type HealthScorerInput = {
  animalId: string;
  species: string;
  ageMonths?: number;
  location?: string;
  vaccinations?: Array<{ vaccineName: string; date?: string; administeredAt?: string }>;
  healthHistory?: Array<{
    type?: string;
    diagnosis?: string;
    visitDate?: string;
    vaccineName?: string;
  }>;
  currentHealthStatus?: string;
  weightKg?: number;
};

export type HealthScorerResult = {
  animalId: string;
  score: number;
  trend: 'improving' | 'declining' | 'stable';
  factors: string[];
  recommendations: string[];
  source: 'ai' | 'fallback';
};

type AiScorerPayload = Omit<HealthScorerResult, 'source' | 'animalId'>;

const SYSTEM_PROMPT = `You score livestock health from 0-100 for Nigerian farms.
Consider vaccinations, visit history, age, location risks, and current status.
Respond ONLY with JSON:
{
  "score": number,
  "trend": "improving" | "declining" | "stable",
  "factors": string[],
  "recommendations": string[]
}
score must be 0-100.`;

function heuristicScore(input: HealthScorerInput): HealthScorerResult {
  let score = 70;
  const factors: string[] = [];

  const vaxCount = input.vaccinations?.length ?? 0;
  if (vaxCount >= 2) {
    score += 10;
    factors.push('Vaccination records on file');
  } else {
    score -= 15;
    factors.push('Limited vaccination history');
  }

  const emergencies =
    input.healthHistory?.filter((h) =>
      ['emergency', 'surgery'].includes((h.type ?? '').toLowerCase()),
    ).length ?? 0;
  if (emergencies > 0) {
    score -= 10 * Math.min(emergencies, 3);
    factors.push('Recent emergency or surgery visits');
  }

  if (input.currentHealthStatus === 'sick') {
    score -= 20;
    factors.push('Currently marked sick');
  } else if (input.currentHealthStatus === 'healthy') {
    score += 5;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    animalId: input.animalId,
    score,
    trend: score >= 75 ? 'stable' : score >= 50 ? 'declining' : 'declining',
    factors: factors.length ? factors : ['Baseline score from available records'],
    recommendations: [
      'Keep vaccination dates current',
      'Log weight and location changes in Trackpro',
    ],
    source: 'fallback',
  };
}

export async function healthScorer(input: HealthScorerInput): Promise<HealthScorerResult> {
  if (!input.animalId?.trim() || !input.species?.trim()) {
    return {
      ...heuristicScore({ ...input, animalId: input.animalId || 'unknown' }),
      factors: ['animalId and species are required'],
    };
  }

  if (!isGeminiConfigured()) {
    return heuristicScore(input);
  }

  try {
    const parsed = await generateJson<AiScorerPayload>(SYSTEM_PROMPT, input);
    if (!parsed || typeof parsed.score !== 'number') {
      return heuristicScore(input);
    }

    return {
      animalId: input.animalId,
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      trend: parsed.trend ?? 'stable',
      factors: Array.isArray(parsed.factors) ? parsed.factors : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      source: 'ai',
    };
  } catch {
    return heuristicScore(input);
  }
}
