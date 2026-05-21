/** Shared Swagger copy — imported by controllers via @ApiOperation({ description: ... }) */

export const LIVESTOCK_TAG =
  'Livestock herd registry (Figma: Livestock). Ear tag, species, weight, assigned vet. Same data as `/animals`.';

export const ANIMALS_TAG = LIVESTOCK_TAG;

export const VETERINARY_VISITS_TAG =
  'Veterinary visits module (Figma). Checkups, vaccinations, treatments, emergencies. Same data as `/health-records`.';

export const HEALTH_RECORDS_TAG = VETERINARY_VISITS_TAG;

export const TRACKING_TAG =
  'Weight, location, and feeding logs over time. Farmers log events; weight entries also update the animal’s current weightKg.';

export const AUTH_TAG =
  'Registration, login, email verification, and password reset. Use Bearer JWT from signup/login on protected routes.';

export const USERS_TAG = 'Farmer profile, farm details, notification settings, and password change.';

export const DOCTORS_PUBLIC_TAG = 'Public directory of approved veterinarians (no login required).';

export const DOCTOR_PORTAL_TAG = 'Veterinarian onboarding — complete clinic profile after signup.';

export const DASHBOARD_TAG = 'Role-based summaries: herd stats (farmer) or assigned animals & visits (doctor).';

export const ADMIN_TAG = 'Platform administration — list users, approve vets, view analytics.';

export const UPLOAD_TAG = 'Cloudinary file uploads; URLs saved to farmer, doctor, or admin profile when applicable.';

export const AI_TAG =
  'Gemini-powered livestock AI: photo triage, multilingual vet chat, outbreak detection, health scoring, vaccination scheduling, and surveillance reports. Requires GEMINI_API_KEY.';

export const SLAUGHTERHOUSE_TAG =
  'Slaughterhouse module (Figma). Licensed facilities and per-animal slaughter scheduling, ante/post-mortem inspection, and certificates.';
