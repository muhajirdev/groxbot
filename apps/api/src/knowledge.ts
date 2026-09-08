import type {
  ComputerDownload,
  KnowledgeFile,
  KnowledgeGraph,
  KnowledgeImportInput,
  KnowledgeImportResult,
  KnowledgeList,
  KnowledgeSearch,
  KnowledgeWrite,
  SkillsStoreSearch,
} from "@groxbot/contracts";
import {
  KnowledgeFileError,
  KnowledgePathError,
  KnowledgeWriteError,
  SkillImportError,
  downloadKnowledge,
  importOfficeSkills,
  listKnowledge,
  listKnowledgeBacklinks,
  listKnowledgeGraph,
  readKnowledge,
  removeKnowledge,
  searchKnowledge,
  searchSkillsStore,
  writeKnowledge,
  type KnowledgeConvert,
  type KnowledgeDisk,
  type SkillImportHttp,
} from "@groxbot/core";

export type KnowledgeAccess = {
  list(workspaceId: string): Promise<KnowledgeList>;
  search(
    workspaceId: string,
    query: string,
    limit?: number,
  ): Promise<KnowledgeSearch>;
  searchSkills(
    query: string,
    opts?: { limit?: number; owner?: string; category?: string | null },
  ): Promise<SkillsStoreSearch>;
  read(workspaceId: string, path: string): Promise<KnowledgeFile>;
  download(workspaceId: string, path: string): Promise<ComputerDownload>;
  backlinks(workspaceId: string, path: string): Promise<{ sources: string[] }>;
  graph(workspaceId: string): Promise<KnowledgeGraph>;
  write(
    workspaceId: string,
    input: KnowledgeWrite,
  ): Promise<{ path: string }>;
  importSkill(
    workspaceId: string,
    input: KnowledgeImportInput,
  ): Promise<KnowledgeImportResult>;
  remove(workspaceId: string, path: string): Promise<void>;
};

export function knowledgeAccess(
  disk: KnowledgeDisk,
  http?: SkillImportHttp,
  convert?: KnowledgeConvert,
): KnowledgeAccess {
  return {
    list: (workspaceId) => listKnowledge(disk, workspaceId),
    search: (workspaceId, query, limit) =>
      searchKnowledge(disk, workspaceId, query, limit),
    searchSkills: (query, opts) => searchSkillsStore(query, opts),
    read: (workspaceId, path) =>
      readKnowledge(disk, workspaceId, path, { convert }),
    download: (workspaceId, path) => downloadKnowledge(disk, workspaceId, path),
    backlinks: async (workspaceId, path) => ({
      sources: await listKnowledgeBacklinks(disk, workspaceId, path),
    }),
    graph: (workspaceId) => listKnowledgeGraph(disk, workspaceId),
    write: (workspaceId, input) =>
      writeKnowledge(disk, workspaceId, input, { convert }),
    importSkill: (workspaceId, input) => {
      if (!http) {
        throw new SkillImportError("Could not fetch that skill.");
      }
      return importOfficeSkills(disk, workspaceId, input, http);
    },
    remove: (workspaceId, path) => removeKnowledge(disk, workspaceId, path),
  };
}

export function emptyKnowledgeAccess(): KnowledgeAccess {
  return {
    async list() {
      return { entries: [], truncated: false };
    },
    async search() {
      return { hits: [], truncated: false };
    },
    async searchSkills(query, opts) {
      return searchSkillsStore(query, opts);
    },
    async read() {
      throw new KnowledgeFileError("Knowledge is not configured.");
    },
    async download() {
      throw new KnowledgeFileError("Knowledge is not configured.");
    },
    async backlinks() {
      return { sources: [] };
    },
    async graph() {
      return { paths: [], out: [] };
    },
    async write() {
      throw new KnowledgeWriteError("Knowledge is not configured.");
    },
    async importSkill() {
      throw new SkillImportError("Knowledge is not configured.");
    },
    async remove() {
      throw new KnowledgePathError("Knowledge is not configured.");
    },
  };
}
