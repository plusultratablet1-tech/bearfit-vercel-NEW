/** Malingap-only weights sharing; independent of other branch capacity policies. */
const MALINGAP_WEIGHT_LABELS = ["Strength Training", "Weight Training", "Strength & Conditioning"] as const

export function malingapWeightTraining(branch: string, label: string | null | undefined) {
  return branch === "Malingap Branch" && MALINGAP_WEIGHT_LABELS.some(item=>item===label)
}

/** Maximum simultaneous clients used for the Admin form's default capacity. */
export function coachSuggestedCapacity(branch: string, label: string | null | undefined): number {
  if (malingapWeightTraining(branch,label)) return 3
  // Existing S&C rule remains unchanged outside Malingap.
  return label === "Strength & Conditioning" ? 3 : 1
}
