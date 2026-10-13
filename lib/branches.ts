// Canonical BearFit branch identifiers. Keep the database value unchanged.
export const BEARFIT_BRANCHES=[
 {id:"Malingap Branch",name:"Malingap",services:[] as string[]},
 {id:"E. Rodriguez Branch",name:"E. Rodriguez",services:[] as string[]},
 {id:"Primark Cainta",name:"Primark Cainta",services:["Pilates","Strength & Conditioning"]},
] as const
export type BearFitBranch=typeof BEARFIT_BRANCHES[number]["id"]
export const BRANCH_IDS=BEARFIT_BRANCHES.map(branch=>branch.id)
export function findBranch(value:string|null|undefined){
 return BEARFIT_BRANCHES.find(branch=>branch.id===value)
}
