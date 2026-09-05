import { z } from "zod";

export const patientInputSchema = z.object({
  displayName: z.string().trim().min(2, "Enter the patient's name.").max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth.").refine(value => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= new Date().toISOString().slice(0, 10);
  }, "Enter a valid date of birth that is not in the future."),
  sex: z.enum(["FEMALE", "MALE", "INTERSEX", "NOT_DISCLOSED"]),
  bloodGroup: z.string().trim().max(20).optional(),
  symptoms: z.string().trim().max(2000),
  conditions: z.string().trim().max(2000),
  allergies: z.string().trim().max(2000),
  medications: z.string().trim().max(2000),
  surgeries: z.string().trim().max(2000),
  familyHistory: z.string().trim().max(2000),
  lifestyle: z.string().trim().max(2000).optional(),
  emergencyNotes: z.string().trim().max(2000).optional(),
  additionalNotes: z.string().trim().max(2000).optional()
});

export type PatientInput = z.infer<typeof patientInputSchema>;
