import { useState, useEffect, useCallback } from 'react';

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const updateKeyboardHeight = useCallback(() => {
    if (!window.visualViewport) return;
    
    const viewportHeight = window.visualViewport.height;
    const windowHeight = window.innerHeight;
    const offsetTop = window.visualViewport.offsetTop;
    
    const height = Math.max(0, windowHeight - viewportHeight - offsetTop);
    setKeyboardHeight(height);
  }, []);

  useEffect(() => {
    if (!window.visualViewport) return;

    // Listen to both resize and scroll for more reliable detection
    window.visualViewport.addEventListener('resize', updateKeyboardHeight);
    window.visualViewport.addEventListener('scroll', updateKeyboardHeight);
    
    // Listen to focus events for immediate updates on keyboard open
    const handleFocus = () => {
      // Multiple delayed checks to catch keyboard appearing
      setTimeout(updateKeyboardHeight, 50);
      setTimeout(updateKeyboardHeight, 150);
      setTimeout(updateKeyboardHeight, 300);
    };
    
    document.addEventListener('focusin', handleFocus);
    
    updateKeyboardHeight();

    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardHeight);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardHeight);
      document.removeEventListener('focusin', handleFocus);
    };
  }, [updateKeyboardHeight]);

  return keyboardHeight;
}
