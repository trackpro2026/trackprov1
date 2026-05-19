import { generateJson, isGeminiConfigured } from './gemini.util';

export type HealthCheckInput = {
  image: string;
  animalType: string;
  animalId: string;
};

export type PossibleDisease = {
  name: string;
  confidence: number;
};

export type HealthCheckResult = {
  animalId: string;
  animalType: string;
  symptoms: string[];
  possibleDiseases: PossibleDisease[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  nextSteps: string[];
  disclaimer: string;
  source: 'ai' | 'fallback';
};

type AiHealthCheckPayload = Omit<HealthCheckResult, 'source' | 'disclaimer' | 'animalId' | 'animalType'>;

const SYSTEM_PROMPT = `You are a veterinary triage assistant for Nigerian livestock farmers.
Analyze the animal photo and metadata. Respond ONLY with valid JSON matching this shape:
{
  "symptoms": string[],
  "possibleDiseases": [{ "name": string, "confidence": number }],
  "urgency": "low" | "medium" | "high" | "critical",
  "nextSteps": string[]
}
confidence is 0-1. Focus on common Nigerian livestock diseases. This is not a definitive diagnosis.`;

function fallback(input: HealthCheckInput): HealthCheckResult {
  return {
    animalId: input.animalId,
    animalType: input.animalType,
    symptoms: ['Unable to analyze image automatically'],
    possibleDiseases: [],
    urgency: 'medium',
    nextSteps: [
      'Contact a licensed veterinarian for an in-person examination',
      'Isolate the animal if you notice contagious signs',
      'Keep vaccination and treatment records up to date in Trackpro',
    ],
    disclaimer:
      'AI-assisted triage only. Always confirm with a qualified veterinarian before treatment.',
    source: 'fallback',
  };
}

export async function healthCheck(input: HealthCheckInput): Promise<HealthCheckResult> {
  if (!input.image?.trim() || !input.animalType?.trim() || !input.animalId?.trim()) {
    return {
      ...fallback(input),
      nextSteps: ['Provide image (base64), animalType, and animalId'],
    };
  }

  if (!isGeminiConfigured()) {
    return fallback(input);
  }

  try {
    const parsed = await generateJson<AiHealthCheckPayload>(
      SYSTEM_PROMPT,
      { animalType: input.animalType, animalId: input.animalId },
      { imageBase64: input.image },
    );

    if (!parsed) {
      return fallback(input);
    }

    return {
      animalId: input.animalId,
      animalType: input.animalType,
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
      possibleDiseases: Array.isArray(parsed.possibleDiseases) ? parsed.possibleDiseases : [],
      urgency: parsed.urgency ?? 'medium',
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
      disclaimer:
        'AI-assisted triage only. Always confirm with a qualified veterinarian before treatment.',
      source: 'ai',
    };
  } catch {
    return fallback(input);
  }
}
