export function toggleInArray<T extends string>(current: T[], value: T, exclusive?: T): T[] {
  // Selecting the exclusive option (e.g. "none") replaces everything
  if (exclusive && value === exclusive) {
    return current.includes(exclusive) ? [] : [exclusive]
  }
  // Already selected → deselect
  if (current.includes(value)) {
    return current.filter((v) => v !== value)
  }
  // Add it, dropping exclusive if it was selected
  return exclusive
    ? [...current.filter((v) => v !== exclusive), value]
    : [...current, value]
}
