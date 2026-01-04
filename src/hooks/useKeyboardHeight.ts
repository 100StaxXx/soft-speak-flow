import { useState, useEffect } from 'react';

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      const height = window.innerHeight - window.visualViewport!.height;
      setKeyboardHeight(Math.max(0, height));
    };

    window.visualViewport.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  return keyboardHeight;
}
