'use client'

import { useState, useEffect, useCallback, useRef } from 'react';

const useWindowScroll = (wait: number = 0) => {
  const [scrollY, setScrollY] = useState(0);
  const throttleTimeout = useRef<NodeJS.Timeout | null>(null);

  const callBack = useCallback(() => {
    setScrollY(window.pageYOffset);
    throttleTimeout.current = null;
  }, []);

  useEffect(() => {
    const updatePosition = () => {
      if (wait) {
        if (!throttleTimeout.current) throttleTimeout.current = setTimeout(callBack, wait);
      } else {
        callBack();
      }
    };

    window.addEventListener('scroll', updatePosition);
    updatePosition();

    return () => window.removeEventListener('scroll', updatePosition);
  }, [callBack, throttleTimeout, wait]);

  return { scrollY, isScrolled: scrollY > 0};
};

export default useWindowScroll;