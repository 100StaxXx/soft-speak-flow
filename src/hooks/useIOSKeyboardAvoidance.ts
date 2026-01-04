import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface UseIOSKeyboardAvoidanceOptions {
  enabled?: boolean;
  offsetBuffer?: number;
  animationDuration?: number;
}

interface UseIOSKeyboardAvoidanceReturn {
  // State
  keyboardHeight: number;
  isKeyboardVisible: boolean;
  safeAreaBottom: number;
  totalOffset: number;
  
  // Platform info
  isIOS: boolean;
  isNative: boolean;
  
  // Style helpers
  containerStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  
  // Utilities
  scrollInputIntoView: (ref: React.RefObject<HTMLElement>) => void;
  dismissKeyboard: () => void;
}

// Platform detection utilities
const getIsIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const getIsNative = (): boolean => {
  return typeof (window as any).Capacitor !== 'undefined';
};

// Read safe area inset from CSS environment
const getSafeAreaBottom = (): number => {
  if (typeof document === 'undefined') return 0;
  try {
    const div = document.createElement('div');
    div.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
    document.body.appendChild(div);
    const safeArea = parseInt(getComputedStyle(div).paddingBottom) || 0;
    document.body.removeChild(div);
    return safeArea;
  } catch {
    return 0;
  }
};

export function useIOSKeyboardAvoidance(
  options: UseIOSKeyboardAvoidanceOptions = {}
): UseIOSKeyboardAvoidanceReturn {
  const { 
    enabled = true, 
    offsetBuffer = 0,
    animationDuration = 200 
  } = options;

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [safeAreaBottom, setSafeAreaBottom] = useState(0);
  const isUpdatingRef = useRef(false);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Platform detection (memoized)
  const isIOS = useMemo(() => getIsIOS(), []);
  const isNative = useMemo(() => getIsNative(), []);

  // Derived state
  const isKeyboardVisible = keyboardHeight > 0;
  const totalOffset = enabled ? keyboardHeight + offsetBuffer : 0;

  // Update keyboard height from visualViewport
  const updateKeyboardHeight = useCallback(() => {
    if (!enabled || !window.visualViewport || isUpdatingRef.current) return;
    
    isUpdatingRef.current = true;
    
    const viewportHeight = window.visualViewport.height;
    const windowHeight = window.innerHeight;
    const offsetTop = window.visualViewport.offsetTop;
    
    const height = Math.max(0, windowHeight - viewportHeight - offsetTop);
    
    setKeyboardHeight(prevHeight => {
      // Only update if there's a meaningful change (> 50px threshold for debounce)
      if (Math.abs(prevHeight - height) > 10 || height === 0) {
        return height;
      }
      return prevHeight;
    });
    
    isUpdatingRef.current = false;
  }, [enabled]);

  // Schedule multiple delayed updates for reliable iOS detection
  const scheduleUpdates = useCallback(() => {
    // Clear any pending timeouts
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
    
    // Schedule multiple checks to catch keyboard animation
    const delays = [50, 150, 300, 500];
    delays.forEach(delay => {
      const timeout = setTimeout(updateKeyboardHeight, delay);
      timeoutsRef.current.push(timeout);
    });
  }, [updateKeyboardHeight]);

  // Initialize safe area reading
  useEffect(() => {
    setSafeAreaBottom(getSafeAreaBottom());
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (!enabled || !window.visualViewport) return;

    // Direct viewport listeners
    window.visualViewport.addEventListener('resize', updateKeyboardHeight);
    window.visualViewport.addEventListener('scroll', updateKeyboardHeight);
    
    // Focus listeners for immediate response
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        scheduleUpdates();
      }
    };
    
    const handleFocusOut = () => {
      // Delay to allow for field-to-field focus changes
      setTimeout(() => {
        if (!document.activeElement || 
            (document.activeElement.tagName !== 'INPUT' && 
             document.activeElement.tagName !== 'TEXTAREA')) {
          setKeyboardHeight(0);
        }
      }, 100);
    };
    
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    
    // Initial check
    updateKeyboardHeight();

    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardHeight);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardHeight);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      timeoutsRef.current.forEach(t => clearTimeout(t));
    };
  }, [enabled, updateKeyboardHeight, scheduleUpdates]);

  // Scroll input into view utility
  const scrollInputIntoView = useCallback((ref: React.RefObject<HTMLElement>) => {
    if (!ref.current) return;
    
    setTimeout(() => {
      ref.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }, 300);
  }, []);

  // Dismiss keyboard utility
  const dismissKeyboard = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  // Pre-computed style objects
  const containerStyle: React.CSSProperties = useMemo(() => ({
    bottom: totalOffset > 0 ? `${totalOffset}px` : '0px',
    transition: `bottom ${animationDuration}ms ease-out`,
  }), [totalOffset, animationDuration]);

  const inputStyle: React.CSSProperties = useMemo(() => ({
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  }), []);

  return {
    keyboardHeight,
    isKeyboardVisible,
    safeAreaBottom,
    totalOffset,
    isIOS,
    isNative,
    containerStyle,
    inputStyle,
    scrollInputIntoView,
    dismissKeyboard,
  };
}

// Re-export simple hook for backward compatibility
export function useKeyboardHeight(): number {
  const { keyboardHeight } = useIOSKeyboardAvoidance();
  return keyboardHeight;
}
