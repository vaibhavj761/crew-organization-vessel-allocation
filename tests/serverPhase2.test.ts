import { describe, expect, it } from 'vitest'
import { canWrite, canAdmin } from '../server/src/auth/context'
import { allocationSchema, organizationSchema, personSchema, vesselSchema } from '../server/src/validation/schemas'
import { toNullableDate } from '../server/src/utils/parse'
import { adminCreateUserSchema } from '../server/src/routes/accessRequests'

describe('Phase 2 backend helpers', () => {
  it('enforces write and admin roles', () => {
    expect(canWrite('ADMIN')).toBe(true)
    expect(canWrite('EDITOR')).toBe(true)
    expect(canWrite('VIEWER')).toBe(false)
    expect(canAdmin('ADMIN')).toBe(true)
    expect(canAdmin('EDITOR')).toBe(false)
  })

  it('validates organization and people payloads', () => {
    expect(organizationSchema.safeParse({ name: 'Acme', title: 'Crew Operations Organization Chart', effectiveDate: null, footerText: 'Internal' }).success).toBe(true)
    expect(personSchema.safeParse({ organizationId: 'org-1', name: 'A', designation: 'Boss', workflowRole: 'CREW_DIRECTOR' }).success).toBe(true)
  })

  it('validates vessel and allocation payloads', () => {
    expect(vesselSchema.safeParse({ organizationId: 'org-1', name: 'MV Alpha', vesselType: 'Bulk Carrier', crewManagerId: 'cm-1', vesselStatus: 'IN_MANAGEMENT', managementType: 'FULL_MANAGED' }).success).toBe(true)
    expect(vesselSchema.safeParse({ organizationId: 'org-1', name: '  ', vesselType: 'Bulk Carrier', crewManagerId: 'cm-1', vesselStatus: 'IN_MANAGEMENT', managementType: 'FULL_MANAGED' }).success).toBe(false)
    expect(vesselSchema.safeParse({ organizationId: 'org-1', name: 'MV Alpha', vesselType: 'Bulk Carrier', crewManagerId: '   ', vesselStatus: 'IN_MANAGEMENT', managementType: 'FULL_MANAGED' }).success).toBe(false)
    expect(allocationSchema.safeParse({ crewManagerId: 'cm-1', assignedAssistantId: '' }).success).toBe(true)
    expect(allocationSchema.safeParse({ crewManagerId: '   ', assignedAssistantId: '' }).success).toBe(false)
  })

  it('parses dates safely', () => {
    expect(toNullableDate('2026-07-01T00:00:00.000Z')).toBeInstanceOf(Date)
    expect(toNullableDate('')).toBeNull()
    expect(toNullableDate('not-a-date')).toBeNull()
  })

  it('validates and normalizes admin-created user details', () => {
    const result = adminCreateUserSchema.safeParse({ name: '  New User  ', email: '  NEW.USER@EXAMPLE.COM ', role: 'EDITOR' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'New User', email: 'new.user@example.com', role: 'EDITOR' })
    }
    expect(adminCreateUserSchema.safeParse({ name: '   ', email: 'valid@example.com', role: 'VIEWER' }).success).toBe(false)
    expect(adminCreateUserSchema.safeParse({ name: 'User', email: 'invalid', role: 'VIEWER' }).success).toBe(false)
  })
})
