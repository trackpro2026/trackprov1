import { generateJson, isGeminiConfigured } from './gemini.util';

export type VaccinationRecord = {
  vaccineName: string;
  administeredAt?: string;
};

export type VaccinationSchedulerInput = {
  animalId: string;
  species: 'cattle' | 'goat' | 'sheep' | 'poultry' | string;
  ageMonths?: number;
  vaccinations?: VaccinationRecord[];
};

export type ScheduledVaccination = {
  vaccineName: string;
  dueDate: string;
  reason: string;
  priority: 'routine' | 'overdue' | 'upcoming';
};

export type VaccinationSchedulerResult = {
  animalId: string;
  species: string;
  schedule: ScheduledVaccination[];
  notes: string[];
  source: 'ai' | 'fallback';
};

type AiSchedulePayload = Pick<VaccinationSchedulerResult, 'schedule' | 'notes'>;

/** Nigerian livestock vaccination baselines (simplified). */
const NIGERIA_BASELINES: Record<string, ScheduledVaccination[]> = {
  cattle: [
    {
      vaccineName: 'CBPP (Contagious Bovine Pleuropneumonia)',
      dueDate: addMonthsIso(0),
      reason: 'Annual booster typical in Nigeria',
      priority: 'routine',
    },
    {
      vaccineName: 'FMD (Foot and Mouth Disease)',
      dueDate: addMonthsIso(6),
      reason: 'Semi-annual schedule in high-risk zones',
      priority: 'upcoming',
    },
  ],
  goat: [
    {
      vaccineName: 'PPR (Peste des Petits Ruminants)',
      dueDate: addMonthsIso(0),
      reason: 'Core Nigerian small ruminant vaccine',
      priority: 'routine',
    },
    {
      vaccineName: 'CCPP (Contagious Caprine Pleuropneumonia)',
      dueDate: addMonthsIso(12),
      reason: 'Annual booster',
      priority: 'upcoming',
    },
  ],
  sheep: [
    {
      vaccineName: 'PPR (Peste des Petits Ruminants)',
      dueDate: addMonthsIso(0),
      reason: 'Core Nigerian small ruminant vaccine',
      priority: 'routine',
    },
    {
      vaccineName: 'Anthrax',
      dueDate: addMonthsIso(12),
      reason: 'Annual where endemic',
      priority: 'upcoming',
    },
  ],
  poultry: [
    {
      vaccineName: 'Newcastle Disease',
      dueDate: addMonthsIso(0),
      reason: 'Primary broiler/layer schedule',
      priority: 'routine',
    },
    {
      vaccineName: 'Gumboro (IBD)',
      dueDate: addMonthsIso(2),
      reason: 'Follow-on broiler schedule',
      priority: 'upcoming',
    },
  ],
};

function addMonthsIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function normalizeSpecies(species: string): string {
  const s = species.toLowerCase();
  if (s.includes('cattle') || s === 'cow') return 'cattle';
  if (s.includes('goat')) return 'goat';
  if (s.includes('sheep')) return 'sheep';
  if (s.includes('poultry') || s.includes('chicken')) return 'poultry';
  return s;
}

function fallbackSchedule(input: VaccinationSchedulerInput): VaccinationSchedulerResult {
  const key = normalizeSpecies(input.species);
  const base = NIGERIA_BASELINES[key] ?? NIGERIA_BASELINES.cattle;

  const administered = new Set(
    (input.vaccinations ?? []).map((v) => v.vaccineName.toLowerCase()),
  );

  const schedule = base.map((item) => {
    const already = [...administered].some((name) =>
      item.vaccineName.toLowerCase().includes(name.split(' ')[0]),
    );
    return {
      ...item,
      priority: already ? ('routine' as const) : ('upcoming' as const),
      reason: already
        ? `${item.reason} — last dose on record; confirm booster timing with your vet`
        : item.reason,
    };
  });

  return {
    animalId: input.animalId,
    species: input.species,
    schedule,
    notes: [
      'Schedule based on common Nigerian livestock vaccination practices.',
      'Confirm with your state veterinary service before administering vaccines.',
    ],
    source: 'fallback',
  };
}

const SYSTEM_PROMPT = `You predict next vaccination due dates for Nigerian livestock (cattle, goats, sheep, poultry).
Use standard Nigerian veterinary schedules. Respond ONLY with JSON:
{
  "schedule": [{ "vaccineName": string, "dueDate": "YYYY-MM-DD", "reason": string, "priority": "routine"|"overdue"|"upcoming" }],
  "notes": string[]
}`;

export async function vaccinationScheduler(
  input: VaccinationSchedulerInput,
): Promise<VaccinationSchedulerResult> {
  if (!input.animalId?.trim() || !input.species?.trim()) {
    return {
      ...fallbackSchedule({ ...input, animalId: input.animalId || 'unknown', species: 'cattle' }),
      notes: ['animalId and species are required'],
    };
  }

  if (!isGeminiConfigured()) {
    return fallbackSchedule(input);
  }

  try {
    const parsed = await generateJson<AiSchedulePayload>(SYSTEM_PROMPT, input);
    if (!parsed?.schedule?.length) {
      return fallbackSchedule(input);
    }

    return {
      animalId: input.animalId,
      species: input.species,
      schedule: parsed.schedule,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      source: 'ai',
    };
  } catch {
    return fallbackSchedule(input);
  }
}
