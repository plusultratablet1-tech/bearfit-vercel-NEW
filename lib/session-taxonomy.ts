export const SESSION_TAXONOMY = [
  { label: "Strength Training", category: "fitness" },
  { label: "Weight Training", category: "fitness" },
  { label: "Boxing", category: "fitness" },
  { label: "Conditioning", category: "fitness" },
  { label: "Cardio", category: "fitness" },
  { label: "Group Fitness", category: "fitness" },
  { label: "Pilates Group", category: "pilates_group" },
  { label: "Pilates 1-on-1", category: "pilates_1on1" },
] as const

export type SessionLabel = typeof SESSION_TAXONOMY[number]["label"]
export type SessionServiceCategory = typeof SESSION_TAXONOMY[number]["category"]

export function categoryForSessionLabel(label: string): SessionServiceCategory | null {
  return SESSION_TAXONOMY.find((item) => item.label === label)?.category ?? null
}

export function labelForServiceFallback(category: string | null | undefined) {
  if (category === "fitness") return "Fitness Session"
  if (category === "pilates_group") return "Pilates Group"
  if (category === "pilates_1on1") return "Pilates 1-on-1"
  return "Training Session"
}

export function displaySessionLabel(label: string | null | undefined, category: string | null | undefined) {
  return label?.trim() || labelForServiceFallback(category)
}
