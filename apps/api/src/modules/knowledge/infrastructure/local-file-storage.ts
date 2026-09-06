import { Inject, Injectable } from "@nestjs/common";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { KNOWLEDGE_CONFIG, KnowledgeConfig } from "../application/knowledge-config";
import { FileStoragePort, PdfStorageTarget } from "../domain/file-storage.port";

@Injectable()
export class LocalFileStorage implements FileStoragePort {
  private readonly root: string;

  constructor(@Inject(KNOWLEDGE_CONFIG) config: KnowledgeConfig) {
    this.root = resolve(config.storageRoot);
  }

  async putPdf(target: PdfStorageTarget, content: Buffer): Promise<string> {
    const key = this.pdfKey(target);
    const targetPath = this.resolveKey(key);
    await mkdir(dirname(targetPath), { recursive: true, mode: 0o750 });
    await this.assertNoSymbolicLinks(dirname(targetPath));
    const temporary = `${targetPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, content, { flag: "wx", mode: 0o640 });
      await rename(temporary, targetPath);
      return key;
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  async read(organizationId: string, key: string): Promise<Buffer> {
    const targetPath = this.resolveOrganizationKey(organizationId, key);
    await this.assertNoSymbolicLinks(dirname(targetPath));
    return readFile(targetPath);
  }

  async remove(organizationId: string, key: string): Promise<void> {
    const targetPath = this.resolveOrganizationKey(organizationId, key);
    await this.assertNoSymbolicLinks(dirname(targetPath));
    await rm(targetPath, { force: true });
  }

  private pdfKey(target: PdfStorageTarget): string {
    if (![target.organizationId, target.familyId, target.versionId].every((value) => this.isUuid(value))) {
      throw new Error("Invalid PDF storage target");
    }
    return `organizations/${target.organizationId}/knowledge/${target.familyId}/versions/${target.versionId}.pdf`;
  }

  private resolveOrganizationKey(organizationId: string, key: string): string {
    if (!this.isUuid(organizationId)) throw new Error("Invalid organization storage scope");
    const expectedPrefix = `organizations/${organizationId}/`;
    if (!key.startsWith(expectedPrefix)) throw new Error("Storage key does not belong to the organization");
    return this.resolveKey(key);
  }

  private async assertNoSymbolicLinks(directory: string): Promise<void> {
    let current = directory;
    while (current !== this.root) {
      if ((await lstat(current)).isSymbolicLink()) throw new Error("Symbolic links are not allowed in storage paths");
      current = dirname(current);
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private resolveKey(key: string): string {
    if (!key || isAbsolute(key) || key.includes("\0")) throw new Error("Invalid storage key");
    const target = resolve(this.root, key);
    const pathFromRoot = relative(this.root, target);
    if (!pathFromRoot || pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
      throw new Error("Storage key escapes the configured root");
    }
    return target;
  }
}
