import { Role } from '../../../common/decorators/roles.decorator';
import { UserAccountState } from '../entities/user-account-state.enum';
import { DoctorStatus } from '../entities/doctor-profile.schema';
import { SlaughterhouseOperatorStatus } from '../entities/slaughterhouse-profile.schema';

export interface SlaughterhouseProfileResponse {
  facilityName?: string;
  location?: string;
  state?: string;
  licenseNumber?: string;
  contactPhone?: string;
  documentUrls?: string[];
  profileImageUrl?: string;
  status?: SlaughterhouseOperatorStatus;
  facilityId?: string;
}

export interface DoctorProfileResponse {
  clinicName?: string;
  licenseNumber?: string;
  location?: string;
  specialties?: string[];
  speciesTreated?: string[];
  bio?: string;
  isVerified?: boolean;
  status?: DoctorStatus;
  documentUrls?: string[];
  profileImageUrl?: string;
}

export interface UserSettingsResponse {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  healthAlerts?: boolean;
  language?: string;
  timezone?: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  userState: UserAccountState;
  isEmailVerified?: boolean;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  avatarUrl?: string;
  farmName?: string;
  farmLocation?: string;
  farmSizeHectares?: number;
  assignedDoctorId?: string;
  userFileUrls?: string[];
  adminFileUrls?: string[];
  settings?: UserSettingsResponse;
  doctorProfile?: DoctorProfileResponse;
  slaughterhouseProfile?: SlaughterhouseProfileResponse;
}
