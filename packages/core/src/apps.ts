import type { AppStore } from "@groxbot/adapter-kit";
import type { TemplateId } from "@groxbot/contracts";
import { newId } from "./ids.js";

function titledSlide(slide: Record<string, unknown>, title: string) {
  const next: Record<string, unknown> = { ...slide, title };
  if (!Array.isArray(slide.blocks)) return next;
  next.blocks = slide.blocks.map((block) => {
    if (!block || typeof block !== "object") return block;
    const item = block as Record<string, unknown>;
    if (item.type !== "title") return block;
    const props =
      item.props && typeof item.props === "object"
        ? (item.props as Record<string, unknown>)
        : {};
    return { ...item, props: { ...props, text: title } };
  });
  return next;
}

/** Seed the Gadget facet with the title from the chat card. */
export function applyAppTitle(
  templateId: TemplateId,
  state: unknown,
  title: string,
): unknown {
  if (!state || typeof state !== "object") {
    if (templateId === "docs") return { title, html: "<p></p>" };
    if (templateId === "slides") {
      return { slides: [{ id: "s1", title, body: "" }] };
    }
    return state;
  }
  if (templateId === "docs") return { ...state, title };
  if (templateId === "slides" && "slides" in state) {
    const slides = Array.isArray(state.slides)
      ? state.slides.map((slide, index) => {
          if (index !== 0 || !slide || typeof slide !== "object") return slide;
          return titledSlide(slide as Record<string, unknown>, title);
        })
      : [{ id: "s1", title, body: "" }];
    return { ...state, slides };
  }
  return state;
}

/** Create the App Durable Object. Identity lives on the DO + chat card, not Postgres. */
export async function stampApp(opts: {
  store: AppStore;
  workspaceId: string;
  templateId: TemplateId;
  title: string;
}): Promise<{ id: string; templateId: TemplateId; title: string }> {
  const title = opts.title.trim() || "Untitled";
  const id = newId();
  await opts.store.init(id, opts.templateId, {
    workspaceId: opts.workspaceId,
    title,
  });
  return { id, templateId: opts.templateId, title };
}
