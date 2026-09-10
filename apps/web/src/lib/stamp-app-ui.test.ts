import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StampAppSurface } from "../components/StampAppToolUI";
import { OfficeAppActionsContext } from "./office-app-actions";

describe("stamped app card", () => {
  it("renders Open for a CRM card", () => {
    const html = renderToStaticMarkup(
      createElement(
        OfficeAppActionsContext.Provider,
        { value: { open: () => undefined } },
        createElement(StampAppSurface, {
          args: { appId: "app_1", templateId: "crm", title: "Acme" },
        }),
      ),
    );
    expect(html).toContain("app-card");
    expect(html).toContain("Acme");
    expect(html).toContain("CRM");
    expect(html).toContain("Open");
  });

  it("renders Open for a custom gadget card", () => {
    const html = renderToStaticMarkup(
      createElement(
        OfficeAppActionsContext.Provider,
        { value: { open: () => undefined } },
        createElement(StampAppSurface, {
          args: { appId: "app_2", templateId: "app", title: "Todo" },
        }),
      ),
    );
    expect(html).toContain("app-card");
    expect(html).toContain("Todo");
    expect(html).toContain("App");
    expect(html).toContain("Open");
  });
});
