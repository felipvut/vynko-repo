import { useEffect } from "react";

/**
 * Pushes a history state when `open` becomes true, and calls `onClose`
 * when the user presses the hardware/browser back button instead of
 * navigating away from the current page.
 */
export function useBackButton(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;

    // Push a fake history entry so back button pops it
    const tag = `sheet-${Date.now()}`;
    window.history.pushState({ sheet: tag }, "");

    const handlePop = () => {
      // The back button was pressed – close the sheet
      onClose();
    };

    window.addEventListener("popstate", handlePop);

    return () => {
      window.removeEventListener("popstate", handlePop);
      // If sheet closed programmatically (not via back), remove the extra entry
      if (window.history.state?.sheet === tag) {
        window.history.back();
      }
    };
  }, [open, onClose]);
}
