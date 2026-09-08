import { Combobox } from "@base-ui/react/combobox";
import type { ModelCatalogItem } from "@groxbot/contracts";
import {
  CUSTOM_MODEL_SENTINEL,
  PROVIDER_ORDER,
  catalogGroupLabel,
} from "@groxbot/contracts";
import { useMemo } from "react";
import { cn } from "../ui";
import { CheckIcon } from "./Icons";

export type ModelPickerItem = {
  id: string;
  label: string;
  available?: boolean;
  group?: string;
};

export type ModelPickerGroup = {
  value: string;
  label?: string;
  items: ModelPickerItem[];
};

export function modelPickerGroups(input: {
  catalog: readonly ModelCatalogItem[];
  inherit?: { label: string };
}): ModelPickerGroup[] {
  const groups: ModelPickerGroup[] = [];
  if (input.inherit) {
    groups.push({
      value: "__inherit",
      items: [
        {
          id: "",
          label: `Workspace default (${input.inherit.label})`,
        },
      ],
    });
  }
  for (const provider of PROVIDER_ORDER) {
    const items = input.catalog.filter((item) => item.provider === provider);
    if (items.length === 0) continue;
    const group = catalogGroupLabel(provider);
    groups.push({
      value: provider,
      label: group,
      items: items.map((item) => ({
        id: item.id,
        label: item.label,
        available: item.available,
        group,
      })),
    });
  }
  groups.push({
    value: "__custom",
    items: [{ id: CUSTOM_MODEL_SENTINEL, label: "Custom…" }],
  });
  return groups;
}

export function modelPickerItemMatches(
  item: ModelPickerItem,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    item.label,
    item.id,
    item.group,
    item.available === false ? "needs key" : "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function sameModel(a: ModelPickerItem, b: ModelPickerItem) {
  return a.id === b.id;
}

export function ModelField(props: {
  value: string;
  onChange: (value: string) => void;
  catalog: readonly ModelCatalogItem[];
  inherit?: { label: string };
  "aria-label"?: string;
  className?: string;
}) {
  const inheritLabel = props.inherit?.label;
  const groups = useMemo(
    () =>
      modelPickerGroups({
        catalog: props.catalog,
        inherit: inheritLabel ? { label: inheritLabel } : undefined,
      }),
    [props.catalog, inheritLabel],
  );
  const selected = useMemo(() => {
    for (const group of groups) {
      const match = group.items.find((item) => item.id === props.value);
      if (match) return match;
    }
    return {
      id: props.value,
      label: props.value || props.inherit?.label || "Model",
    };
  }, [groups, props.inherit?.label, props.value]);

  return (
    <Combobox.Root
      autoHighlight
      items={groups}
      value={selected}
      onValueChange={(value) => {
        if (value && typeof value === "object" && "id" in value) {
          props.onChange(value.id);
        }
      }}
      isItemEqualToValue={sameModel}
      itemToStringLabel={(item) => item.label}
      filter={modelPickerItemMatches}
    >
      <Combobox.InputGroup
        className={cn(
          "flex w-full items-center rounded-[12px] border border-line bg-card px-3 py-2.5",
          "focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40",
          props.className,
        )}
      >
        <Combobox.Input
          aria-label={props["aria-label"] ?? "Model"}
          placeholder="Search models"
          className="combobox-field-input w-full border-0 bg-transparent p-0 text-[14px] text-ink outline-none placeholder:text-muted"
        />
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner
          className="z-50 outline-none"
          side="bottom"
          sideOffset={4}
          align="start"
        >
          <Combobox.Popup className="popover-popup max-h-[min(240px,var(--available-height))] w-[var(--anchor-width)] overflow-auto rounded-[10px] border border-line bg-card py-1 outline-none">
            <Combobox.Empty>
              <div className="px-3 py-2 text-[13px] text-muted">
                No models match.
              </div>
            </Combobox.Empty>
            <Combobox.List>
              {(group: ModelPickerGroup) => (
                <Combobox.Group
                  key={group.value}
                  items={group.items}
                  className="block"
                >
                  {group.label ? (
                    <Combobox.GroupLabel className="px-2.5 py-1.5 text-[11px] text-muted select-none">
                      {group.label}
                    </Combobox.GroupLabel>
                  ) : null}
                  <Combobox.Collection>
                    {(item: ModelPickerItem) => (
                      <Combobox.Item
                        key={item.id || item.label}
                        value={item}
                        className="flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-[13px] text-ink outline-none select-none data-highlighted:bg-hover"
                      >
                        <span className="min-w-0 truncate">
                          {item.label}
                          {item.available === false ? (
                            <span className="text-muted"> — needs key</span>
                          ) : null}
                        </span>
                        <Combobox.ItemIndicator className="text-muted">
                          <CheckIcon className="size-3.5" />
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
