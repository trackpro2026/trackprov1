import { generateJson, isGeminiConfigured } from './gemini.util';

export type OutbreakCase = {
  animalId?: string;
  species?: string;
  diagnosis?: string;
  symptoms?: string[];
  location?: string;
  reportedAt?: string;
};

export type GuardianAgentInput = {
  recentCases: OutbreakCase[];
  region?: string;
  lookbackDays?: number;
};

export type GuardianAgentResult = {
  outbreakDetected: boolean;
  disease: string | null;
  confidence: number;
  severity: 'none' | 'watch' | 'alert' | 'emergency';
  recommendedActions: string[];
  summary: string;
  source: 'ai' | 'fallback';
};

type AiGuardianPayload = Omit<GuardianAgentResult, 'source'>;

const SYSTEM_PROMPT = `You are an epidemiology guardian for Nigerian livestock surveillance.
Given recent case reports, detect possible disease outbreaks.
Respond ONLY with JSON:
{
  "outbreakDetected": boolean,
  "disease": string | null,
  "confidence": number,
  "severity": "none" | "watch" | "alert" | "emergency",
  "recommendedActions": string[],
  "summary": string
}
confidence is 0-1. Consider geographic clustering and similar diagnoses.`;

function fallback(input: GuardianAgentInput): GuardianAgentResult {
  const count = input.recentCases?.length ?? 0;
  return {
    outbreakDetected: false,
    disease: null,
    confidence: 0,
    severity: count >= 3 ? 'watch' : 'none',
    recommendedActions: [
      'Continue logging cases with symptoms and location in Trackpro',
      'Notify your state veterinary officer if multiple similar cases appear',
    ],
    summary:
      count === 0
        ? 'No recent cases provided for outbreak analysis.'
        : `${count} case(s) logged; automated outbreak analysis unavailable.`,
    source: 'fallback',
  };
}

export async function guardianAgent(input: GuardianAgentInput): Promise<GuardianAgentResult> {
  const cases = input.recentCases ?? [];
  if (!cases.length) {
    return fallback(input);
  }

  if (!isGeminiConfigured()) {
    return fallback(input);
  }

  try {
    const parsed = await generateJson<AiGuardianPayload>(SYSTEM_PROMPT, {
      recentCases: cases,
      region: input.region,
      lookbackDays: input.lookbackDays ?? 14,
    });

    if (!parsed) {
      return fallback(input);
    }

    return {
      outbreakDetected: Boolean(parsed.outbreakDetected),
      disease: parsed.disease ?? null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      severity: parsed.severity ?? 'none',
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions
        : [],
      summary: parsed.summary ?? 'Outbreak analysis complete.',
      source: 'ai',
    };
  } catch {
    return fallback(input);
  }
}
