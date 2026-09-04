import { describe, expect, it } from "vitest";
import {
  executeCodeFromInput,
  isNpmPackageName,
  splitExecuteNpmImports,
} from "./execute-imports.js";

describe("isNpmPackageName", () => {
  it("accepts bare and scoped packages", () => {
    expect(isNpmPackageName("unpdf")).toBe(true);
    expect(isNpmPackageName("@unpdf/pdfjs")).toBe(true);
  });

  it("rejects paths and builtins", () => {
    expect(isNpmPackageName("./unpdf")).toBe(false);
    expect(isNpmPackageName("cloudflare:workers")).toBe(false);
    expect(isNpmPackageName("node:fs")).toBe(false);
    expect(isNpmPackageName("https://example.com/x.js")).toBe(false);
  });
});

describe("splitExecuteNpmImports", () => {
  it("hoists a named import and leaves the body", () => {
    const split = splitExecuteNpmImports(
      `import { extractText, getDocumentProxy } from "unpdf";\nconst bytes = await knowledge.read({ path: "inbox/a.pdf" });\nreturn extractText;`,
    );
    expect(split.dependencies).toEqual({ unpdf: "latest" });
    expect(split.importSource).toContain('from "unpdf"');
    expect(split.body).not.toMatch(/import /);
    expect(split.body).toMatch(/knowledge\.read/);
  });

  it("hoists an import from inside an async function", () => {
    const split = splitExecuteNpmImports(`async () => {
  import { extractText } from "unpdf";
  return extractText;
}`);
    expect(split.dependencies).toEqual({ unpdf: "latest" });
    expect(split.importSource).toContain('from "unpdf"');
    expect(split.body).not.toMatch(/import \{ extractText/);
    expect(split.body).toMatch(/return extractText/);
  });

  it("hoists a multiline import", () => {
    const split = splitExecuteNpmImports(`import {
  extractText,
  getDocumentProxy,
} from "unpdf";
return 1;`);
    expect(split.dependencies.unpdf).toBe("latest");
    expect(split.body.trim()).toBe("return 1;");
  });

  it("records dynamic import() without stripping it", () => {
    const split = splitExecuteNpmImports(
      `const { extractText } = await import("unpdf");\nreturn extractText;`,
    );
    expect(split.dependencies).toEqual({ unpdf: "latest" });
    expect(split.body).toMatch(/import\("unpdf"\)/);
    expect(split.importSource).toBe("");
  });

  it("leaves relative imports in the body", () => {
    const split = splitExecuteNpmImports(
      `import { x } from "./local.js";\nreturn x;`,
    );
    expect(split.dependencies).toEqual({});
    expect(split.body).toMatch(/from "\.\/local.js"/);
  });
});

describe("executeCodeFromInput", () => {
  it("prefers code over command", () => {
    expect(
      executeCodeFromInput({
        code: "return await knowledge.search({ query: \"x\" })",
        command: "ls",
      }),
    ).toBe('return await knowledge.search({ query: "x" })');
  });

  it("accepts command as the Code Mode alias", () => {
    expect(
      executeCodeFromInput({
        command: "return await routines.list()",
      }),
    ).toBe("return await routines.list()");
  });

  it("returns empty when neither field is a string", () => {
    expect(executeCodeFromInput({})).toBe("");
    expect(executeCodeFromInput({ command: 1 })).toBe("");
    expect(executeCodeFromInput(null)).toBe("");
  });
});
