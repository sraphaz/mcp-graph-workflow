import { memo, useCallback } from "react";
import { Minimize2 } from "lucide-react";
import { useFullscreen } from "../../hooks/use-fullscreen";

interface FullscreenOverlayProps {
  tabName: string;
}

/**
 * Overlay toolbar shown at the top of the screen during fullscreen mode.
 * - Fades in on hover (opacity-0 → opacity-100)
 * - Shows tab name + "Exit fullscreen" button
 * - role="toolbar" + aria-label
 * - Only renders when isFullscreen is true
 */
export const FullscreenOverlay = memo(function FullscreenOverlay({
  tabName,
}: FullscreenOverlayProps) {
  const { isFullscreen, exitFullscreen } = useFullscreen();

  const handleExit = useCallback(() => {
    void exitFullscreen();
  }, [exitFullscreen]);

  if (!isFullscreen) return null;

  return (
    <div
      role="toolbar"
      aria-label={`${tabName} fullscreen toolbar`}
      className="
        fixed top-0 left-0 right-0 z-[60]
        flex items-center justify-between
        px-4 py-2
        bg-surface-alt/90 backdrop-blur-sm border-b border-edge
        opacity-0 hover:opacity-100
        transition-opacity duration-200
        pointer-events-auto
      "
      style={{ pointerEvents: "auto" }}
    >
      <span className="text-sm font-medium text-foreground">
        {tabName}
      </span>

      <button
        onClick={handleExit}
        aria-label="Exit fullscreen"
        className="
          flex items-center gap-1.5 px-2.5 py-1 rounded-lg
          text-xs font-medium text-muted
          hover:text-foreground hover:bg-surface-elevated
          transition-colors duration-150
        "
      >
        <Minimize2 className="w-3.5 h-3.5" />
        <span>Exit fullscreen</span>
      </button>
    </div>
  );
});
