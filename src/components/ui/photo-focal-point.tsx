"use client";
import { useId, useState } from "react";
import { ContentImage } from "./content-image";
import {
  centeredFocalPoint,
  focalPosition,
  type FocalPoint,
  stripFocalPoint,
} from "@/lib/focal-point";
export function PhotoFocalPoint({
  src,
  value = centeredFocalPoint,
  onChange,
  disabled = false,
  aspect = "4 / 3",
}: {
  src: string;
  value?: FocalPoint;
  onChange: (point: FocalPoint) => void;
  disabled?: boolean;
  aspect?: string;
}) {
  const help = useId();
  const [ratio, setRatio] = useState(4 / 3);
  const imageWidth = Math.min(1, ratio / (4 / 3)),
    imageHeight = Math.min(1, 4 / 3 / ratio);
  const pick = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.currentTarget.matches(":disabled")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const image = event.currentTarget.querySelector("img");
    const actualRatio =
      image?.naturalWidth && image.naturalHeight
        ? image.naturalWidth / image.naturalHeight
        : ratio;
    const width = bounds.width * Math.min(1, actualRatio / (4 / 3)),
      height = bounds.height * Math.min(1, 4 / 3 / actualRatio);
    onChange({
      x: Math.round(
        Math.max(
          0,
          Math.min(
            100,
            ((event.clientX - bounds.left - (bounds.width - width) / 2) /
              width) *
              100,
          ),
        ),
      ),
      y: Math.round(
        Math.max(
          0,
          Math.min(
            100,
            ((event.clientY - bounds.top - (bounds.height - height) / 2) /
              height) *
              100,
          ),
        ),
      ),
    });
  };
  return (
    <details className="photo-focal-editor">
      <summary>Adjust photo crop</summary>
      <p id={help}>
        Tap the subject to keep it visible. Use arrow keys to move the focus, or
        Home to center it.
      </p>
      <div className="photo-focal-workspace">
        <button
          type="button"
          className="photo-focal-canvas"
          aria-label={`Photo focal point: ${value.x}% across, ${value.y}% down`}
          aria-describedby={help}
          disabled={disabled}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pick(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              pick(event);
          }}
          onKeyDown={(event) => {
            const delta = event.shiftKey ? 10 : 2;
            const moves: Record<string, FocalPoint> = {
              ArrowLeft: { x: Math.max(0, value.x - delta), y: value.y },
              ArrowRight: { x: Math.min(100, value.x + delta), y: value.y },
              ArrowUp: { x: value.x, y: Math.max(0, value.y - delta) },
              ArrowDown: { x: value.x, y: Math.min(100, value.y + delta) },
              Home: centeredFocalPoint,
            };
            if (moves[event.key]) {
              event.preventDefault();
              onChange(moves[event.key]);
            }
          }}
          onClick={(event) => {
            if (event.detail === 0) onChange(centeredFocalPoint);
          }}
        >
          <ContentImage
            src={stripFocalPoint(src)}
            alt="Choose the part of this photo to keep visible"
            sizes="320px"
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalHeight)
                setRatio(image.naturalWidth / image.naturalHeight);
            }}
          />
          <span
            className="photo-focal-marker"
            aria-hidden="true"
            style={{
              left: `${((1 - imageWidth) / 2 + (imageWidth * value.x) / 100) * 100}%`,
              top: `${((1 - imageHeight) / 2 + (imageHeight * value.y) / 100) * 100}%`,
            }}
          />
        </button>
        <div>
          <span className="photo-focal-preview-label">Card preview</span>
          <div className="photo-focal-preview" style={{ aspectRatio: aspect }}>
            <ContentImage
              src={stripFocalPoint(src)}
              alt="Photo crop preview"
              sizes="240px"
              style={{ objectPosition: focalPosition(value) }}
            />
          </div>
          <p role="status">
            Focus: {value.x}% across · {value.y}% down
          </p>
        </div>
      </div>
      <button
        type="button"
        className="p2-button p2-button--quiet"
        disabled={disabled || (value.x === 50 && value.y === 50)}
        onClick={() => onChange(centeredFocalPoint)}
      >
        Reset to center
      </button>
    </details>
  );
}
