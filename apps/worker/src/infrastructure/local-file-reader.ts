import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { IngestionError } from "../ingestion/errors";

function isSafeIdentifier(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export class LocalFileReader {
  constructor(private readonly root: string) {}

  async readPdf(organizationId: string, storageKey: string): Promise<Buffer> {
    if (!isSafeIdentifier(organizationId)) {
      throw new IngestionError("STORAGE_KEY_INVALID", "The stored file key is invalid", false);
    }
    const expectedPrefix = `organizations/${organizationId}/knowledge/`;
    if (
      isAbsolute(storageKey) ||
      !storageKey.startsWith(expectedPrefix) ||
      storageKey.includes("\\") ||
      storageKey.split("/").some((segment) => segment === ".." || segment === "." || segment.length === 0)
    ) {
      throw new IngestionError("STORAGE_KEY_INVALID", "The stored file key is invalid", false);
    }

    const root = await realpath(this.root).catch(() => {
      throw new IngestionError("STORAGE_UNAVAILABLE", "The source file storage is unavailable", true);
    });
    const target = resolve(root, storageKey);
    if (relative(root, target).startsWith(`..${sep}`) || target === root) {
      throw new IngestionError("STORAGE_KEY_INVALID", "The stored file key is invalid", false);
    }
    try {
      const stat = await lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new IngestionError("STORAGE_FILE_INVALID", "The source file is unavailable", false);
      }
      return await readFile(target);
    } catch (error) {
      if (error instanceof IngestionError) throw error;
      throw new IngestionError("STORAGE_UNAVAILABLE", "The source file storage is unavailable", true);
    }
  }
}
