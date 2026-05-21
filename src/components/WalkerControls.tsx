import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { observer } from "mobx-react";
import { createPortal } from "react-dom";
import { Network as NetworkModel, Rate } from "../model";
import Button from "./Button";

interface Props {
  network: NetworkModel;
  rate: Rate;
  showOptimized: boolean;
  showLinkWeights: boolean;
  onStartWalk: () => void;
  onToggleRate: () => void;
  onToggleLinkWeights: () => void;
  onToggleSolution: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

interface ControlHintProps {
  enabled: boolean;
  hint: string;
  children: ReactNode;
}

interface TooltipPosition {
  left: number;
  top: number;
}

const TOOLTIP_GAP = 10;
const VIEWPORT_PADDING = 12;

function ControlHint({ enabled, hint, children }: ControlHintProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({
    left: 0,
    top: 0,
  });

  useEffect(() => {
    if (!enabled) {
      setIsOpen(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isOpen || typeof window === "undefined") {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const centeredLeft =
        triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      const left = Math.max(
        VIEWPORT_PADDING,
        Math.min(
          centeredLeft,
          window.innerWidth - tooltipRect.width - VIEWPORT_PADDING,
        ),
      );
      const preferredTop = triggerRect.top - tooltipRect.height - TOOLTIP_GAP;
      const top =
        preferredTop >= VIEWPORT_PADDING
          ? preferredTop
          : triggerRect.bottom + TOOLTIP_GAP;

      setPosition({ left, top });
    };

    const frameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [enabled, hint, isOpen]);

  return (
    <>
      <div
        ref={triggerRef}
        aria-describedby={enabled && isOpen ? tooltipId : undefined}
        className="shrink-0"
        onMouseEnter={() => enabled && setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => enabled && setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      >
        {children}
      </div>
      {enabled &&
        isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none fixed z-50 max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-xs leading-relaxed text-gray-700 shadow-lg"
            style={{
              left: position.left,
              top: position.top,
            }}
          >
            {hint}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Observed control buttons that update when walker state changes.
 * Isolated to prevent Main component from re-rendering.
 */
const WalkerControls = observer(function WalkerControls({
  network,
  rate,
  showOptimized,
  showLinkWeights,
  onStartWalk,
  onToggleRate,
  onToggleLinkWeights,
  onToggleSolution,
  speed,
  onSpeedChange,
}: Props) {
  const { walker } = network;
  const compactButtonStyle = {
    padding: "0.4rem 0.8rem",
    fontSize: "0.9rem",
    textAlign: "center",
    justifyContent: "center",
  } as const;
  const walkButtonStyle = { ...compactButtonStyle, width: "6.8rem" } as const;
  const visitsButtonStyle = {
    ...compactButtonStyle,
    width: "7.1rem",
  } as const;
  const linkFlowButtonStyle = {
    ...compactButtonStyle,
    width: "8.5rem",
  } as const;
  const teleportationButtonStyle = {
    ...compactButtonStyle,
    width: "9.2rem",
  } as const;
  const solutionButtonStyle = {
    ...compactButtonStyle,
    width: "11.4rem",
  } as const;

  return (
    <>
      <div className="mt-10 mb-10 flex flex-row flex-nowrap items-center justify-start gap-3 overflow-x-auto px-2 xl:justify-center">
        <ControlHint
          enabled
          hint="Reset the random walk, clear the printed code traces, and return the walker to the starting state."
        >
          <Button
            className="button whitespace-nowrap shrink-0"
            style={compactButtonStyle}
            onClick={() => walker.reset()}
          >
            Reset
          </Button>
        </ControlHint>
        <ControlHint
          enabled
          hint="Advance the random walker by exactly one step."
        >
          <Button
            className="button whitespace-nowrap shrink-0"
            style={compactButtonStyle}
            onClick={() => walker.step()}
          >
            Step
          </Button>
        </ControlHint>
        <ControlHint
          enabled
          hint={
            walker.isStarted
              ? "Stop the automatic random walk."
              : "Start the automatic random walk."
          }
        >
          <Button
            className={`button whitespace-nowrap shrink-0 ${!walker.isStarted ? "button--primary" : ""}`}
            style={walkButtonStyle}
            onClick={() => (walker.isStarted ? walker.stop() : onStartWalk())}
          >
            {walker.isStarted ? "Stop Walk" : "Start Walk"}
          </Button>
        </ControlHint>
        <ControlHint
          enabled
          hint={
            rate === Rate.Visits
              ? "Hide the visit-rate view and return to uniform node sizing."
              : "Show the visit-rate view so node size reflects how often the walker visits each node."
          }
        >
          <Button
            className={`button whitespace-nowrap shrink-0 ${rate === Rate.Visits ? "button--primary" : ""}`}
            style={visitsButtonStyle}
            onClick={onToggleRate}
          >
            {rate === Rate.Visits ? "Hide Visits" : "Show Visits"}
          </Button>
        </ControlHint>
        <ControlHint
          enabled
          hint={
            showLinkWeights
              ? "Switch back to uniform link widths."
              : "Scale the links so thicker links show larger flow."
          }
        >
          <Button
            className={`button whitespace-nowrap shrink-0 ${showLinkWeights ? "button--primary" : ""}`}
            style={linkFlowButtonStyle}
            onClick={onToggleLinkWeights}
          >
            {showLinkWeights ? "Uniform Links" : "Show Link Flow"}
          </Button>
        </ControlHint>
        <ControlHint
          enabled
          hint={
            walker.teleportationEnabled
              ? "Keep random teleportation enabled, so the walker can occasionally jump to a different node."
              : "Disable random teleportation, so the walker only follows network links."
          }
        >
          <Button
            className={`button whitespace-nowrap shrink-0 ${walker.teleportationEnabled ? "button--primary" : ""}`}
            style={teleportationButtonStyle}
            onClick={() => walker.toggleRandomTeleportation()}
          >
            {walker.teleportationEnabled
              ? "Teleportation off"
              : "Teleportation on"}
          </Button>
        </ControlHint>
        <ControlHint
          enabled
          hint={
            showOptimized
              ? "Switch to a deliberately worse partition so you can compare it with the optimized one."
              : "Switch back to the optimized partition."
          }
        >
          <Button
            className="button whitespace-nowrap shrink-0"
            style={solutionButtonStyle}
            onClick={onToggleSolution}
          >
            {showOptimized ? "Bad Solution" : "Optimal Solution"}
          </Button>
        </ControlHint>
        <div className="flex w-32 shrink-0 flex-col items-center">
          <input
            type="range"
            id="walkerSpeed"
            min={1}
            max={10}
            step={1}
            value={speed}
            onChange={(e) => onSpeedChange(+e.target.value)}
            className="w-full"
          />
          <label htmlFor="walkerSpeed" className="text-sm whitespace-nowrap">
            {speed} steps per second
          </label>
        </div>
      </div>
    </>
  );
});

export default WalkerControls;
