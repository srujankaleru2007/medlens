import { describe, expect, it } from "vitest";
import { patientInputSchema } from "./patient";

describe("patient intake validation", () => {
  it("requires a name and date of birth", () => {
    const result = patientInputSchema.safeParse({ displayName: "", dateOfBirth: "", sex: "NOT_DISCLOSED", symptoms: "", conditions: "", allergies: "", medications: "", surgeries: "", familyHistory: "" });
    expect(result.success).toBe(false);
  });
  it("accepts a complete minimum profile", () => {
    const result = patientInputSchema.safeParse({ displayName: "Asha Rao", dateOfBirth: "1990-04-12", sex: "FEMALE", symptoms: "", conditions: "", allergies: "", medications: "", surgeries: "", familyHistory: "" });
    expect(result.success).toBe(true);
  });
});
