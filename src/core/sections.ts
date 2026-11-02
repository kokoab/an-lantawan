/** Rules for the section tree: top-level sections (News, Opinion…) and one level below them. */

export interface SectionNode {
  id: number;
  parentId: number | null;
}

/**
 * Why a section can't sit under the chosen parent, or null when it can. Only top-level
 * sections take subsections, and a section with subsections of its own stays top level.
 */
export function parentProblem(
  sectionId: number | null,
  parentId: number | null,
  all: readonly SectionNode[],
): string | null {
  if (parentId === null) return null;
  if (parentId === sectionId) return 'A section can’t sit under itself.';
  const parent = all.find((s) => s.id === parentId);
  if (!parent) return 'Choose a section from the list.';
  if (parent.parentId !== null)
    return 'Choose a top-level section. Subsections can’t have their own.';
  if (sectionId !== null && all.some((s) => s.parentId === sectionId)) {
    return 'This section has subsections, so it has to stay top level.';
  }
  return null;
}
