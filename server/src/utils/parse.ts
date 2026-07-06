export function toNullableDate(value: unknown) {
  if (value == null || value === '') return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export function entitySnapshot<T>(value: T) {
  return JSON.parse(JSON.stringify(value)) as T
}
