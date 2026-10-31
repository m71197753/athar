import { and, inArray, lt } from "drizzle-orm";
import {
  db, platformContentTable, platformMediaAssetsTable, platformSectionsTable, platformSettingsTable,
} from "@workspace/db";
import { assetFile, listSectionAssetObjects } from "./ad-storage";
import { SECTION_MEDIA_RETENTION_DAYS, selectSectionMediaCleanupCandidates, type CleanupObject } from "./section-media-cleanup-plan";

const retentionCutoff = () => new Date(Date.now() - SECTION_MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000);
const mediaIdInUrl = /\/api\/platform\/section-media\/([a-f0-9-]{36})(?:[/?#]|$)/ig;

async function snapshot() {
  const [assets, sections, content, settings, objects] = await Promise.all([
    db.select().from(platformMediaAssetsTable),
    db.select({ blocks: platformSectionsTable.blocks, courses: platformSectionsTable.courses }).from(platformSectionsTable),
    db.select().from(platformContentTable),
    db.select({ moduleSettings: platformSettingsTable.moduleSettings }).from(platformSettingsTable),
    listSectionAssetObjects(),
  ]);
  const referencedIds = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(mediaIdInUrl)) referencedIds.add(match[1].toLowerCase());
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(sections); visit(content); visit(settings);
  return { assets, referencedIds, objects };
}

async function oldObjects() {
  const state = await snapshot();
  const metadataByPath = new Map<string, (typeof state.objects)[number]["file"]["metadata"]>();
  const metadataObjects: CleanupObject[] = [];
  for (const entry of state.objects) {
    let metadata = entry.file.metadata;
    if (!metadata?.timeCreated && !metadata?.updated) {
      try { [metadata] = await entry.file.getMetadata(); } catch { continue; }
    }
    metadataByPath.set(entry.objectPath, metadata);
    metadataObjects.push({
      objectPath: entry.objectPath, timeCreated: metadata?.timeCreated, updated: metadata?.updated, size: metadata?.size,
    });
  }
  const selected = selectSectionMediaCleanupCandidates(state.assets, state.referencedIds, metadataObjects);
  const filesByPath = new Map(state.objects.map(entry => [entry.objectPath, entry.file]));
  const candidates = selected.candidates.map(object => {
    const size = Number(object.size ?? 0);
    return {
      objectPath: object.objectPath,
      file: filesByPath.get(object.objectPath)!,
      size: Number.isSafeInteger(size) && size > 0 ? size : 0,
      generation: metadataByPath.get(object.objectPath)?.generation,
    };
  });
  return { expiredUploads: selected.expiredUploads, unlinkedAssets: selected.unlinkedAssets, candidates };
}

export async function previewSectionMediaCleanup() {
  const { expiredUploads, unlinkedAssets, candidates } = await oldObjects();
  return {
    retentionDays: SECTION_MEDIA_RETENTION_DAYS,
    expiredUploads: expiredUploads.length,
    unlinkedAssets: unlinkedAssets.length,
    orphanFiles: candidates.length,
    reclaimableBytes: candidates.reduce((sum, file) => sum + file.size, 0),
  };
}

export async function cleanupSectionMedia() {
  const { expiredUploads, unlinkedAssets, candidates } = await oldObjects();
  let deletedFiles = 0, reclaimedBytes = 0;
  const removedPaths = new Set<string>();
  for (const candidate of candidates) {
    try {
      await candidate.file.delete({ ignoreNotFound: true });
      removedPaths.add(candidate.objectPath);
      deletedFiles++;
      reclaimedBytes += candidate.size;
    } catch (error) {
      // Do not remove the corresponding DB record if the object could not be deleted.
      if ((error as { code?: number }).code !== 404) throw error;
      removedPaths.add(candidate.objectPath);
    }
  }
  const removedAssets = unlinkedAssets.filter(asset => !asset.objectPath ||
    !candidates.some(candidate => candidate.objectPath === asset.objectPath) ||
    removedPaths.has(asset.objectPath));
  const removedUploads = expiredUploads.filter(asset => !asset.objectPath ||
    !candidates.some(candidate => candidate.objectPath === asset.objectPath) ||
    removedPaths.has(asset.objectPath));
  const removed = [...removedAssets, ...removedUploads];
  if (removed.length) {
    await db.delete(platformMediaAssetsTable).where(and(
      inArray(platformMediaAssetsTable.id, removed.map(asset => asset.id)),
      inArray(platformMediaAssetsTable.status, ["uploading", "ready"]),
      lt(platformMediaAssetsTable.createdAt, retentionCutoff()),
    ));
  }
  return {
    retentionDays: SECTION_MEDIA_RETENTION_DAYS,
    expiredUploads: removedUploads.length,
    removedAssets: removedAssets.length,
    deletedFiles, reclaimedBytes,
  };
}
