import type { TemplateId } from "@groxbot/contracts";

export type DocsState = {
  title: string;
  html: string;
};

export type Slide = { id: string; title: string; body: string };

export type SlidesState = {
  slides: Slide[];
};

export type SheetsState = {
  cells: Record<string, string>;
};

export type AppState = DocsState | SlidesState | SheetsState;

export function initialState(templateId: TemplateId): AppState {
  if (templateId === "docs") {
    return { title: "Untitled", html: "<p></p>" };
  }
  if (templateId === "slides") {
    return {
      slides: [
        {
          id: "s1",
          title: "Untitled deck",
          body: "Add talking points. Ask your teammate to fill this in.",
        },
      ],
    };
  }
  return { cells: { A1: "Item", B1: "Amount", A2: "", B2: "" } };
}
