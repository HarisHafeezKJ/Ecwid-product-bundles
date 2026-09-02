import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export interface UnsavedChangesGuard {
  navigationBlocked: boolean;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
}

/** Guards both in-app navigation (router blocker) and tab close/reload (beforeunload). */
export function useUnsavedChangesGuard(dirty: boolean): UnsavedChangesGuard {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return {
    navigationBlocked: blocker.state === 'blocked',
    confirmNavigation: () => blocker.proceed?.(),
    cancelNavigation: () => blocker.reset?.(),
  };
}
