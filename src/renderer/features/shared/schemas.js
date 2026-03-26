import { z } from "zod";

/**
 * Zod schema for Engine Constants validation.
 * Ensures safety and logical consistency before burning to ECU.
 */
export const engineConstantsSchema = z.object({
  nCylinders: z.coerce.number().min(1, "Number of Cylinders must be at least 1").max(8, "Max 8 cylinders supported"),
  nInjectors: z.coerce.number().min(1).max(8),
  engineType: z.coerce.number().min(0).max(255),
  stoich: z.coerce.number().min(8.0).max(20.0, "Stoich must be between 8.0 and 20.0"),
  reqFuel: z.coerce.number().min(0).max(25.5, "ReqFuel exceeds 8-bit limit (Max 25.5ms)"),
});

/**
 * Validation schema for Trigger Setup (primarily Page 4 constants)
 */
export const triggerSetupSchema = z.object({
  TrigPattern: z.coerce.number().min(0).max(31),
  numTeeth: z.coerce.number().min(1, "Primary base teeth must be at least 1").max(255),
  TrigSpeed: z.coerce.number().min(0).max(1),
  missingTeeth: z.coerce.number().min(0).max(255),
  TrigAngMul: z.coerce.number().min(0).max(88),
  TrigAng: z.coerce.number().min(-360, "Trigger Angle must be between -360 and 360").max(360),
  SkipCycles: z.coerce.number().min(0).max(255),
  TrigEdge: z.coerce.number().min(0).max(1),
  TrigEdgeSec: z.coerce.number().min(0).max(1),
  trigPatternSec: z.coerce.number().min(0).max(127),
  TrigFilter: z.coerce.number().min(0).max(3),
  useResync: z.coerce.number().min(0).max(1),
});

/**
 * Validate engine constants and return errors if any.
 */
export const validateEngineConstants = (constants) => {
  try {
    engineConstantsSchema.parse(constants);
    return { success: true, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.flatten().fieldErrors
      };
    }
    return { success: false, errors: { unknown: ["Validation failed"] } };
  }
};

/**
 * Comprehensive schema for 8 programmable rules
 */
const ruleFields = {};
for (let i = 0; i < 8; i++) {
  ruleFields[`outputInverted${i}`] = z.coerce.number().min(0).max(1);
  ruleFields[`kindOfLimiting${i}`] = z.coerce.number().min(0).max(1);
  ruleFields[`outputPin${i}`] = z.coerce.number().min(0).max(255);
  ruleFields[`outputDelay${i}`] = z.coerce.number().min(0).max(255);
  ruleFields[`firstDataIn${i}`] = z.coerce.number().min(0).max(255);
  ruleFields[`secondDataIn${i}`] = z.coerce.number().min(0).max(255);
  ruleFields[`outputTimeLimit${i}`] = z.coerce.number().min(0).max(255);
  ruleFields[`firstTarget${i}`] = z.coerce.number().min(-32768).max(32767);
  ruleFields[`secondTarget${i}`] = z.coerce.number().min(-32768).max(32767);
  ruleFields[`firstCompType${i}`] = z.coerce.number().min(0).max(7);
  ruleFields[`secondCompType${i}`] = z.coerce.number().min(0).max(7);
  ruleFields[`bitwise${i}`] = z.coerce.number().min(0).max(3);
}

export const programmableOutputsSchema = z.object(ruleFields);

/**
 * Validation for Injector Characteristics.
 * Spans Page 1 and Page 2.
 */
export const injectorCharacteristicsSchema = z.object({
  dutyLim: z.coerce.number().min(0).max(100, "Duty limit must be 0-100%"),
  injOpen: z.coerce.number().min(0, "Open time cannot be negative").max(10, "Open time exceeds 10ms limit"),
  injVoltageBins: z.array(z.number()).length(9).refine(
    (arr) => arr.every((val, i) => i === 0 || val >= arr[i - 1]),
    { message: "Voltage bins must be in increasing order" }
  ),
  injBatRates: z.array(z.number()).length(9),
  injAngRPM: z.array(z.number()).length(4).refine(
    (arr) => arr.every((val, i) => i === 0 || val >= arr[i - 1]),
    { message: "Timing RPM bins must be in increasing order" }
  ),
  injAng: z.array(z.number()).length(4),
});

/**
 * Validation for IAT/Density correction
 */
export const iatCorrectionSchema = z.object({
  airDenBins: z.array(z.number()).length(9).refine(
    (arr) => arr.every((val, i) => i === 0 || val >= arr[i - 1]),
    { message: "Temperature bins must be in increasing order" }
  ),
  airDenRates: z.array(z.number()).length(9),
});
