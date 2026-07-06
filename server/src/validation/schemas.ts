import { z } from 'zod'

export const organizationSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  effectiveDate: z.string().datetime().optional().nullable(),
  footerText: z.string().optional().nullable(),
})

export const personSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1),
  designation: z.string().min(1),
  workflowRole: z.enum(['CREW_DIRECTOR', 'OPERATIONS_MANAGER', 'CREW_MANAGER', 'ASSISTANT']),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const vesselSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1),
  vesselType: z.string().optional().nullable(),
  vesselDoc: z.string().optional().nullable(),
  deadweightTonnage: z.string().optional().nullable(),
  ownerPool: z.string().optional().nullable(),
  ownerName: z.string().optional().nullable(),
  marineSuperintendent: z.string().optional().nullable(),
  vesselManager: z.string().optional().nullable(),
  takeoverDate: z.string().datetime().optional().nullable(),
  handoverDate: z.string().datetime().optional().nullable(),
  vesselStatus: z.enum(['IN_MANAGEMENT', 'UPCOMING', 'OUT_OF_MANAGEMENT']),
  managementType: z.enum(['FULL_MANAGED', 'CREW_MANAGED']),
  notes: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
})

export const allocationSchema = z.object({
  crewManagerId: z.string().min(1),
  assignedAssistantId: z.string().min(1).optional().nullable().or(z.literal('')),
})
