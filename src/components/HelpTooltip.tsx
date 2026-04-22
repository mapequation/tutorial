import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface Props {
  content: ReactNode;
  label?: string;
  className?: string;
}

interface TooltipPosition {
  left: number;
  top: number;
}

const TOOLTIP_GAP = 10;
const VIEWPORT_PADDING = 12;

export default function HelpTooltip({
  content,
  label = "Show more information",
  className = "",
}: Props) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({
    left: 0,
    top: 0,
  });

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    const updatePosition = () => {
      const button = buttonRef.current;
      const tooltip = tooltipRef.current;
      if (!button || !tooltip) {
        return;
      }

      const buttonRect = button.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const centeredLeft =
        buttonRect.left + buttonRect.width / 2 - tooltipRect.width / 2;
      const left = Math.max(
        VIEWPORT_PADDING,
        Math.min(
          centeredLeft,
          window.innerWidth - tooltipRect.width - VIEWPORT_PADDING,
        ),
      );
      const preferredTop = buttonRect.top - tooltipRect.height - TOOLTIP_GAP;
      const top =
        preferredTop >= VIEWPORT_PADDING
          ? preferredTop
          : buttonRect.bottom + TOOLTIP_GAP;

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
  }, [content, isOpen]);

  useEffect(() => {
    if (!isPinned) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        buttonRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      ) {
        return;
      }

      setIsPinned(false);
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setIsPinned(false);
      setIsOpen(false);
      buttonRef.current?.blur();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPinned]);

  const openTooltip = () => setIsOpen(true);
  const closeTooltip = () => {
    if (!isPinned) {
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-pressed={isPinned}
        className={`pointer-events-auto inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-400 text-[10px] font-bold leading-none text-gray-500 align-middle ${className}`.trim()}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
        onMouseDown={openTooltip}
        onClick={() => {
          setIsOpen(true);
          setIsPinned((value) => !value);
        }}
        onTouchStart={() => {
          setIsOpen(true);
          setIsPinned(true);
        }}
      >
        ?
      </button>
      {isOpen &&
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
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
