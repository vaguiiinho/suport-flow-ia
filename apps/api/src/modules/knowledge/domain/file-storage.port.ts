export const FILE_STORAGE = Symbol("FILE_STORAGE");

export interface PdfStorageTarget {
  organizationId: string;
  familyId: string;
  versionId: string;
}

export interface FileStoragePort {
  putPdf(target: PdfStorageTarget, content: Buffer): Promise<string>;
  read(organizationId: string, key: string): Promise<Buffer>;
  remove(organizationId: string, key: string): Promise<void>;
}
