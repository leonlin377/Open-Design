"use client";

/**
 * Studio resource popover — WARM-SHELL-001.
 *
 * Floating compact popover (400px wide, max 600px tall) that replaces the
 * deleted right rail. Triggered from the two icon buttons at the bottom-left
 * of the chat column.
 *
 *   group="design"  → tabs: Layers | Design System | Palette
 *   group="history" → tabs: Versions | Export | Comments
 *
 * The popover positions itself above the icon button (the caller wraps this
 * component in a relative parent so CSS `bottom`/`left` anchoring works).
 *
 * Composition: tabs rendered with `<Tabs>` + `<TabsList>` + `<TabsTrigger>`
 * + `<TabsPanel>` from `@opendesign/ui`; close affordance rendered as a
 * ghost `<Button>`; bodies wrapped in `<Stack>` so raw panel content
 * inherits consistent vertical rhythm.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  Stack,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTrigger
} from "@opendesign/ui";
import { useT } from "../../../../lib/i18n";

type Group = "design" | "history";
type DesignTab = "layers" | "system" | "palette";
type HistoryTab = "versions" | "export" | "comments";
type AnyTab = DesignTab | HistoryTab;

type StudioResourcePopoverProps = {
  group: Group;
  onClose: () => void;
  layersPanel: ReactNode;
  designSystemPanel: ReactNode;
  palettePanel: ReactNode;
  versionsPanel: ReactNode;
  exportPanel: ReactNode;
  commentsPanel: ReactNode;
};

export function StudioResourcePopover({
  group,
  onClose,
  layersPanel,
  designSystemPanel,
  palettePanel,
  versionsPanel,
  exportPanel,
  commentsPanel
}: StudioResourcePopoverProps) {
  const t = useT();

  const designTabs: ReadonlyArray<{ id: DesignTab; label: string }> = [
    { id: "layers", label: t("studio.rail.scene") },
    { id: "system", label: t("studio.library.system") },
    { id: "palette", label: t("studio.library.palette") }
  ];

  const historyTabs: ReadonlyArray<{ id: HistoryTab; label: string }> = [
    { id: "versions", label: t("studio.review.versions") },
    { id: "export", label: t("studio.review.export") },
    { id: "comments", label: t("studio.review.comments") }
  ];

  const tabs: ReadonlyArray<{ id: AnyTab; label: string }> =
    group === "design" ? designTabs : historyTabs;

  const [active, setActive] = useState<AnyTab>(tabs[0].id);

  // Reset tab selection whenever the group changes so we always land on the
  // group's first tab.
  useEffect(() => {
    setActive(tabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const ariaLabel =
    group === "design" ? t("studio.rail.library") : t("studio.rail.review");

  return (
    <div
      className="studio-resource-popover"
      role="dialog"
      aria-label={ariaLabel}
    >
      <Tabs
        value={active}
        onValueChange={(next) => setActive(next as AnyTab)}
        style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
      >
        <div className="studio-resource-popover-head">
          <TabsList
            aria-label={ariaLabel}
            className="studio-rail-tabs"
          >
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={
                  tab.id === active
                    ? "studio-rail-tab is-active"
                    : "studio-rail-tab"
                }
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            variant="ghost"
            size="sm"
            className="studio-resource-popover-close"
            aria-label={t("studio.rail.collapse")}
            onClick={onClose}
            style={{
              width: 24,
              height: 24,
              minHeight: 24,
              padding: 0,
              borderRadius: 6
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Button>
        </div>
        <div className="studio-resource-popover-body">
          {group === "design" ? (
            <>
              <TabsPanel value="layers" className="studio-rail-tabpanel">
                <Stack gap={3}>{layersPanel}</Stack>
              </TabsPanel>
              <TabsPanel value="system" className="studio-rail-tabpanel">
                <Stack gap={3}>{designSystemPanel}</Stack>
              </TabsPanel>
              <TabsPanel value="palette" className="studio-rail-tabpanel">
                <Stack gap={3}>{palettePanel}</Stack>
              </TabsPanel>
            </>
          ) : (
            <>
              <TabsPanel value="versions" className="studio-rail-tabpanel">
                <Stack gap={3}>{versionsPanel}</Stack>
              </TabsPanel>
              <TabsPanel value="export" className="studio-rail-tabpanel">
                <Stack gap={3}>{exportPanel}</Stack>
              </TabsPanel>
              <TabsPanel value="comments" className="studio-rail-tabpanel">
                <Stack gap={3}>{commentsPanel}</Stack>
              </TabsPanel>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
