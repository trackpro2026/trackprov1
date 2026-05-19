import { generateJson, isGeminiConfigured } from './gemini.util';

export type VetLanguage = 'en' | 'pcm' | 'ha' | 'yo' | 'ig';

export type VetAssistantInput = {
  message: string;
  language: VetLanguage;
  context?: Record<string, unknown>;
};

export type VetAssistantResult = {
  response: string;
  urgent: boolean;
  suggestedAction: string;
  language: VetLanguage;
  source: 'ai' | 'fallback';
};

type AiVetPayload = Pick<VetAssistantResult, 'response' | 'urgent' | 'suggestedAction'>;

const LANGUAGE_LABELS: Record<VetLanguage, string> = {
  en: 'English',
  pcm: 'Nigerian Pidgin',
  ha: 'Hausa',
  yo: 'Yoruba',
  ig: 'Igbo',
};

const SYSTEM_PROMPT = `You are Trackpro Vet Assistant for Nigerian farmers and veterinarians.
Reply in the requested language. Be practical, calm, and safety-focused.
Respond ONLY with JSON:
{
  "response": string,
  "urgent": boolean,
  "suggestedAction": string
}
Flag urgent=true for bleeding, difficulty breathing, collapse, suspected contagious outbreak, or poison ingestion.`;

function fallback(input: VetAssistantInput): VetAssistantResult {
  const lang = LANGUAGE_LABELS[input.language] ?? 'English';
  return {
    response: `I could not reach the AI vet right now. Please contact a licensed veterinarian. (Language: ${lang})`,
    urgent: false,
    suggestedAction: 'Book a vet visit or call your nearest veterinary officer.',
    language: input.language,
    source: 'fallback',
  };
}

export async function vetAssistant(input: VetAssistantInput): Promise<VetAssistantResult> {
  if (!input.message?.trim()) {
    return {
      ...fallback(input),
      response: 'Please send a message describing the animal health concern.',
    };
  }

  if (!isGeminiConfigured()) {
    return fallback(input);
  }

  try {
    const parsed = await generateJson<AiVetPayload>(SYSTEM_PROMPT, {
      message: input.message,
      language: input.language,
      languageLabel: LANGUAGE_LABELS[input.language],
      context: input.context ?? {},
    });

    if (!parsed?.response) {
      return fallback(input);
    }

    return {
      response: parsed.response,
      urgent: Boolean(parsed.urgent),
      suggestedAction: parsed.suggestedAction ?? 'Monitor the animal and log updates in Trackpro.',
      language: input.language,
      source: 'ai',
    };
  } catch {
    return fallback(input);
  }
}
