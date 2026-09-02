import type {
  ComputerDownload,
  KnowledgeFile,
  KnowledgeGraph,
  KnowledgeImportInput,
  KnowledgeImportResult,
  KnowledgeList,
  KnowledgeWrite,
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
  writeKnowledge,
  type KnowledgeDisk,
  type SkillImportHttp,
} from "@groxbot/core";

export type KnowledgeAccess = {
  list(workspaceId: string): Promise<KnowledgeList>;
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
): KnowledgeAccess {
  return {
    list: (workspaceId) => listKnowledge(disk, workspaceId),
    read: (workspaceId, path) => readKnowledge(disk, workspaceId, path),
    download: (workspaceId, path) => downloadKnowledge(disk, workspaceId, path),
    backlinks: async (workspaceId, path) => ({
      sources: await listKnowledgeBacklinks(disk, workspaceId, path),
    }),
    graph: (workspaceId) => listKnowledgeGraph(disk, workspaceId),
    write: (workspaceId, input) => writeKnowledge(disk, workspaceId, input),
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
