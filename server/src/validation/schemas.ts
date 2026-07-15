import { z } from 'zod'

const trimmedRequiredString = (message: string) => z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z.string().min(1, message),
)

const trimmedOptionalString = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z.string().optional().nullable().or(z.literal('')),
)

export const organizationSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  effectiveDate: z.string().datetime().optional().nullable(),
  footerText: z.string().optional().nullable(),
})

export const personSchema = z.object({
  organizationId: z.string().min(1),
  name: trimmedRequiredString('Name is required.'),
  designation: trimmedRequiredString('Designation is required.'),
  workflowRole: z.enum(['CREW_DIRECTOR', 'OPERATIONS_MANAGER', 'DEPUTY_MANAGER', 'CREW_MANAGER', 'ASSISTANT']),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
})

export const vesselSchema = z.object({
  organizationId: z.string().min(1),
  name: trimmedRequiredString('Vessel name is required.'),
  vesselType: trimmedRequiredString('Vessel type is required.'),
  crewManagerId: trimmedRequiredString('Assignment is required.'),
  assignedAssistantId: trimmedOptionalString,
  vesselDoc: trimmedOptionalString,
  deadweightTonnage: trimmedOptionalString,
  ownerPool: trimmedOptionalString,
  ownerName: trimmedOptionalString,
  marineSuperintendent: trimmedOptionalString,
  vesselManager: trimmedOptionalString,
  takeoverDate: z.string().datetime().optional().nullable(),
  handoverDate: z.string().datetime().optional().nullable(),
  vesselStatus: z.enum(['IN_MANAGEMENT', 'UPCOMING', 'OUT_OF_MANAGEMENT']),
  managementType: z.enum(['FULL_MANAGED', 'CREW_MANAGED']),
  notes: trimmedOptionalString,
  sortOrder: z.number().int().optional(),
})

export const allocationSchema = z.object({
  crewManagerId: trimmedRequiredString('Assignment is required.'),
  assignedAssistantId: trimmedOptionalString,
})
