"use client";
import { useEffect, useRef } from "react";
import type { TripDay } from "@/lib/planning";
import { Icon } from "./icon";

type Props = {
  name: string;
  itemId: string;
  dayId: string;
  days: TripDay[];
  first: boolean;
  last: boolean;
  busy: boolean;
  onUp: () => Promise<boolean>;
  onDown: () => Promise<boolean>;
  onMove: (id: string) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
  onDrag: (target: string | null) => void;
  onDrop: (target: string) => void;
};

/** Native disclosure keeps click/keyboard actions available alongside hold-to-drag. */
export function PlannerStopActions(props: Props) {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const gesture = useRef<{
    pointer: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    scroll: number;
    active: boolean;
    target: string;
    element: HTMLElement;
    capture: HTMLElement;
    frame: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const suppressClick = useRef(false);
  const finish = (commit: boolean) => {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    clearTimeout(current.timer);
    cancelAnimationFrame(current.frame);
    current.element.style.removeProperty("--stop-drag-offset");
    if (current.capture.hasPointerCapture(current.pointer))
      current.capture.releasePointerCapture(current.pointer);
    if (current.active) {
      props.onDrag(null);
      if (commit && current.target !== props.itemId)
        props.onDrop(current.target);
    }
  };
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (
        details.current?.open &&
        !details.current.contains(event.target as Node)
      )
        details.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (gesture.current) finish(false);
      if (details.current?.open) {
        event.preventDefault();
        details.current.open = false;
        summary.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    const cancel = () => finish(false);
    window.addEventListener("blur", cancel);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("blur", cancel);
      const current = gesture.current;
      if (current) {
        clearTimeout(current.timer);
        cancelAnimationFrame(current.frame);
        current.element.style.removeProperty("--stop-drag-offset");
      }
    };
    // The mounted stop owns the pointer lifecycle; mutations unmount or disable it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const run = async (action: () => Promise<boolean>) => {
    if (await action()) {
      if (details.current) details.current.open = false;
      summary.current?.focus();
    }
  };
  return (
    <details className="p2-stop-actions" ref={details}>
      <summary
        ref={summary}
        aria-label={`Options for ${props.name}`}
        aria-disabled={props.busy}
        tabIndex={props.busy ? -1 : 0}
        data-drag-handle
        data-tooltip="Stop options · Hold and drag to reorder"
        onClick={(event) => {
          if (props.busy || suppressClick.current) {
            event.preventDefault();
            suppressClick.current = false;
          }
        }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (props.busy || event.button !== 0 || !event.isPrimary) return;
          suppressClick.current = false;
          const capture = event.currentTarget;
          const element = capture.closest<HTMLElement>("[data-planner-stop]")!;
          capture.setPointerCapture(event.pointerId);
          const current = {
            pointer: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            startX: event.clientX,
            startY: event.clientY,
            scroll: window.scrollY,
            active: false,
            target: props.itemId,
            element,
            capture,
            frame: 0,
            timer: setTimeout(() => {}, 0),
          };
          clearTimeout(current.timer);
          current.timer = setTimeout(() => {
            current.active = true;
            suppressClick.current = true;
            if (details.current) details.current.open = false;
            props.onDrag(props.itemId);
            const track = () => {
              if (gesture.current !== current) return;
              const edge = 72;
              const scroll =
                current.y < edge
                  ? -10
                  : current.y > innerHeight - edge
                    ? 10
                    : 0;
              if (scroll) window.scrollBy(0, scroll);
              // The dragged card ignores hit testing, leaving destination rows reachable.
              const target = document
                .elementFromPoint(current.x, current.y)
                ?.closest<HTMLElement>("[data-planner-stop]")
                ?.dataset.plannerStop;
              if (target && target !== current.target) {
                current.target = target;
                props.onDrag(target);
              }
              element.style.setProperty(
                "--stop-drag-offset",
                `${current.y - current.startY + window.scrollY - current.scroll}px`,
              );
              current.frame = requestAnimationFrame(track);
            };
            current.frame = requestAnimationFrame(track);
          }, 350);
          gesture.current = current;
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current || current.pointer !== event.pointerId) return;
          if (
            !current.active &&
            Math.hypot(
              event.clientX - current.startX,
              event.clientY - current.startY,
            ) > 10
          ) {
            suppressClick.current = true;
            finish(false);
            return;
          }
          current.x = event.clientX;
          current.y = event.clientY;
          if (current.active) event.preventDefault();
        }}
        onPointerUp={(event) => {
          const current = gesture.current;
          const target = current?.active
            ? document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<HTMLElement>("[data-planner-stop]")?.dataset
                .plannerStop
            : null;
          if (current && target) current.target = target;
          finish(Boolean(target));
        }}
        onPointerCancel={() => finish(false)}
        onLostPointerCapture={() => finish(false)}
      >
        <Icon name="Menu" size={25} />
      </summary>
      <div className="p2-stop-action-panel">
        <p>Arrange destination</p>
        <button
          type="button"
          disabled={props.busy || props.first}
          onClick={() => void run(props.onUp)}
        >
          Move up
        </button>
        <button
          type="button"
          disabled={props.busy || props.last}
          onClick={() => void run(props.onDown)}
        >
          Move down
        </button>
        <label>
          Move to day
          <select
            aria-label={`Move to another day: ${props.name}`}
            value={props.dayId}
            disabled={props.busy || props.days.length < 2}
            onChange={(event) =>
              void run(() => props.onMove(event.target.value))
            }
          >
            {props.days.map((day) => (
              <option key={day.id} value={day.id}>
                Day {day.day_number}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="p2-stop-remove"
          disabled={props.busy}
          onClick={() => void run(props.onRemove)}
        >
          Remove destination
        </button>
        <small>Hold the three lines, then drag to reorder.</small>
      </div>
    </details>
  );
}
