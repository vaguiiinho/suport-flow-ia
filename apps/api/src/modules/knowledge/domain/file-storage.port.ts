export const FILE_STORAGE = Symbol("FILE_STORAGE");

export interface FileStoragePort {
  put(key: string, content: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
