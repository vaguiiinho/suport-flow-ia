import { Inject, Injectable } from "@nestjs/common";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { KNOWLEDGE_CONFIG, KnowledgeConfig } from "../application/knowledge-config";
import { FileStoragePort } from "../domain/file-storage.port";

@Injectable()
export class LocalFileStorage implements FileStoragePort {
  private readonly root: string;

  constructor(@Inject(KNOWLEDGE_CONFIG) config: KnowledgeConfig) {
    this.root = resolve(config.storageRoot);
  }

  async put(key: string, content: Buffer): Promise<void> {
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true, mode: 0o750 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, content, { flag: "wx", mode: 0o640 });
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
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
