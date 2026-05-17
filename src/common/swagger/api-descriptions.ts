/** Shared Swagger copy — imported by controllers via @ApiOperation({ description: ... }) */

export const ANIMALS_TAG =
  'Register and manage livestock on a farm (ear tag, species, weight, assigned vet). Full CRUD for farmers; vets see assigned animals; admins see all.';

export const HEALTH_RECORDS_TAG =
  'Veterinary visits, vaccinations, and treatments linked to an animal. Doctors create and maintain records; farmers can read records for their herd.';

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
