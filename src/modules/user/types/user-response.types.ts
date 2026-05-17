import { Role } from '../../../common/decorators/roles.decorator';
import { UserAccountState } from '../entities/user-account-state.enum';
import { DoctorStatus } from '../entities/doctor-profile.schema';

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
  avatarUrl?: string;
  farmName?: string;
  farmLocation?: string;
  farmSizeHectares?: number;
  assignedDoctorId?: string;
  userFileUrls?: string[];
  adminFileUrls?: string[];
  settings?: UserSettingsResponse;
  doctorProfile?: DoctorProfileResponse;
}
