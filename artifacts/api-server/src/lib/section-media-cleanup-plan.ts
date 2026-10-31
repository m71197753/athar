export const SECTION_MEDIA_RETENTION_DAYS = 30;
export type CleanupAsset = { id: string; objectPath: string; status: string; createdAt: Date };
export type CleanupObject = { objectPath: string; timeCreated?: string; updated?: string; size?: string | number };

const objectId = /(?:^|\/)section-assets\/([a-f0-9-]{36})(?:-confirmed-[a-f0-9-]{36})?$/i;

export function selectSectionMediaCleanupCandidates(
  assets: CleanupAsset[],
  referencedIds: Set<string>,
  objects: CleanupObject[],
  now = Date.now(),
) {
  const cutoff = now - SECTION_MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const oldUnlinked = assets.filter(asset =>
    (asset.status === "uploading" || asset.status === "ready") &&
    asset.createdAt.getTime() < cutoff &&
    !referencedIds.has(asset.id.toLowerCase()));
  const oldUploads = oldUnlinked.filter(asset => asset.status === "uploading");
  const eligiblePaths = new Set(oldUnlinked.map(asset => asset.objectPath));
  const candidates = objects.filter(object => {
    const match = objectId.exec(object.objectPath);
    if (!match) return false;
    const owner = assets.find(asset => asset.objectPath === object.objectPath);
    if (owner && !eligiblePaths.has(owner.objectPath)) return false;
    const updatedAt = Date.parse(object.timeCreated ?? object.updated ?? "");
    return Number.isFinite(updatedAt) && updatedAt < cutoff;
  });
  const candidatePaths = new Set(candidates.map(object => object.objectPath));
  const expiredUploads = oldUploads.filter(asset =>
    !objects.some(object => object.objectPath === asset.objectPath) || candidatePaths.has(asset.objectPath));
  const unlinkedAssets = oldUnlinked.filter(asset => asset.status === "ready" &&
    (!objects.some(object => object.objectPath === asset.objectPath) || candidatePaths.has(asset.objectPath)));
  return { expiredUploads, unlinkedAssets, candidates };
}
