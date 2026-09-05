export type Role = "PATIENT" | "REVIEWER" | "ADMIN";
export type SourceType = "USER_PROVIDED" | "REPORT_EXTRACTED" | "AI_GENERATED" | "HUMAN_CORRECTED" | "REVIEWER_VERIFIED";

export interface FieldProvenance {
  sourceType: SourceType;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  verificationStatus: "UNVERIFIED" | "VERIFIED" | "CORRECTED";
}

export interface PatientProfile {
  id: string;
  ownerId: string;
  displayName: string;
  dateOfBirth: string;
  sex: "FEMALE" | "MALE" | "INTERSEX" | "NOT_DISCLOSED";
  bloodGroup?: string;
  symptoms: string;
  conditions: string;
  allergies: string;
  medications: string;
  surgeries: string;
  familyHistory: string;
  lifestyle?: string;
  emergencyNotes?: string;
  additionalNotes?: string;
  fieldProvenance: Record<string, FieldProvenance>;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser { uid: string; email: string; displayName: string; role: Role; }
