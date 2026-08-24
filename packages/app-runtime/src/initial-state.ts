import type { TemplateId } from "@groxbot/contracts";

export type DocsState = {
  title: string;
  html: string;
};

export type SlideBlock = {
  id: string;
  type: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  props: Record<string, unknown>;
};

export type Slide = {
  id: string;
  title?: string;
  background?: Record<string, unknown>;
  blocks?: SlideBlock[];
  body?: string;
};

export type SlidesState = {
  themeVersion?: string;
  slides: Slide[];
};

export type SheetsState = {
  cells: Record<string, string>;
};

export type AppState = DocsState | SlidesState | SheetsState;

function coverSlide(title: string): Slide {
  return {
    id: "s1",
    title,
    background: { color: "#F6821F", inset: false, coverOrange: true },
    blocks: [
      { id: "b_logo", type: "logo", x: 36, y: 56, w: 267, props: {} },
      {
        id: "b_title",
        type: "title",
        x: 33,
        y: 197,
        w: 687,
        props: {
          text: title,
          fontSize: 58,
          weight: 700,
          color: "#FFFFFF",
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          highlight: "",
        },
      },
      {
        id: "b_sub",
        type: "subtitle",
        x: 36,
        y: 533,
        w: 553,
        props: {
          text: "Press E to edit, F to present.",
          fontSize: 17,
          weight: 600,
          color: "#FFFFFF",
          lineHeight: 1.5,
        },
      },
    ],
  };
}

export function initialState(templateId: TemplateId): AppState {
  if (templateId === "docs") {
    return { title: "Untitled", html: "<p></p>" };
  }
  if (templateId === "slides") {
    return {
      themeVersion: "workspace.1",
      slides: [coverSlide("Untitled deck")],
    };
  }
  return { cells: { A1: "Item", B1: "Amount", A2: "", B2: "" } };
}
