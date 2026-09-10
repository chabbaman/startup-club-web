"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Drawer, Tooltip, useOverlayState } from "@heroui/react";

const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 420;
const MAX_WIDTH_FRACTION = 0.85;

function PanelIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  );
}

/**
 * Toggle button plus a right-side, resizable drawer for the shared club workspace.
 * Drag the left edge of the panel to change its width.
 */
export function ClubPanel() {
  const state = useOverlayState();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);

  const clamp = useCallback((w: number) => {
    const max = Math.floor(window.innerWidth * MAX_WIDTH_FRACTION);
    return Math.min(Math.max(w, MIN_WIDTH), max);
  }, []);

  useEffect(() => {
    if (!state.isOpen) return;
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      setWidth(clamp(window.innerWidth - e.clientX));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [state.isOpen, clamp]);

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onHandleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 80 : 20;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setWidth((w) => clamp(w + step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setWidth((w) => clamp(w - step));
    }
  };

  return (
    <>
      <Tooltip>
        <Tooltip.Trigger>
          <Button
            isIconOnly
            variant="ghost"
            aria-label={state.isOpen ? "Close club panel" : "Open club panel"}
            aria-expanded={state.isOpen}
            onPress={state.toggle}
          >
            <PanelIcon />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>Club panel</Tooltip.Content>
      </Tooltip>

      <Drawer state={state}>
        <Drawer.Backdrop variant="transparent">
          <Drawer.Content placement="right">
            <Drawer.Dialog
              className="border-l border-border pl-3"
              style={{ width, maxWidth: `${MAX_WIDTH_FRACTION * 100}vw` }}
            >
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize club panel"
                aria-valuenow={width}
                aria-valuemin={MIN_WIDTH}
                tabIndex={0}
                onPointerDown={startDrag}
                onKeyDown={onHandleKeyDown}
                className="group absolute inset-y-0 left-0 flex w-3 cursor-col-resize items-center justify-center outline-none focus-visible:bg-accent/10"
              >
                <div className="h-10 w-1 rounded-full bg-border transition-colors group-hover:bg-accent group-focus-visible:bg-accent" />
              </div>
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Drawer.Heading>Club workspace</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-3 text-sm text-muted">
                <p>
                  This is where the whole club will work on our shared startup
                  together. Notes, tasks, and decisions will live here.
                </p>
                <p>
                  Nothing to see yet. Drag the left edge to resize this panel.
                </p>
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}
