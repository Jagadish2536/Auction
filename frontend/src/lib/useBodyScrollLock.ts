import { useEffect } from 'react';

let lockCount = 0;
const originalStyles = {
  position: '',
  top: '',
  width: '',
  scrollY: 0,
};

/**
 * Custom hook to safely lock body scroll on mobile/iOS devices when a modal is open.
 * Uses a global count to prevent layout jumps or premature unlocks when nesting multiple modals.
 * Leaves overflow style management to the dialog library to prevent race conditions.
 * 
 * @param isOpen Whether the modal or overlay is open.
 */
export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    // Check if on a mobile viewport
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) return;

    lockCount++;

    // Only apply the scroll lock styling on the first opened modal to capture the true window scroll Y
    if (lockCount === 1) {
      const currentPosition = document.body.style.position;
      const currentTop = document.body.style.top;
      const currentWidth = document.body.style.width;

      // Filter out already locked states if captured due to race conditions
      originalStyles.position = currentPosition === 'fixed' ? '' : currentPosition;
      originalStyles.top = currentTop === '0px' ? '' : currentTop;
      originalStyles.width = currentWidth;
      originalStyles.scrollY = window.scrollY;

      document.body.style.position = 'fixed';
      document.body.style.top = `-${originalStyles.scrollY}px`;
      document.body.style.width = '100%';
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);

      // Only restore styling when the last modal has closed
      if (lockCount === 0) {
        // Defer execution using setTimeout to let the Dialog manager finish its cleanup first
        setTimeout(() => {
          if (lockCount === 0) {
            document.body.style.position = originalStyles.position;
            document.body.style.top = originalStyles.top;
            document.body.style.width = originalStyles.width;
            window.scrollTo(0, originalStyles.scrollY);
          }
        }, 0);
      }
    };
  }, [isOpen]);
}





