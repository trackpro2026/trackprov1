/** Shared Swagger copy — imported by controllers via @ApiOperation({ description: ... }) */

export const LIVESTOCK_TAG =
  'Livestock herd registry (Figma). Ear tag, species, weight, health status, assigned vet.';

export const VETERINARY_VISITS_TAG =
  'Veterinary visits (Figma). Checkups, vaccinations, treatments, emergencies; reason and status.';

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
