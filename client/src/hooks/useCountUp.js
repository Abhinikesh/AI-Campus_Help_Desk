import { useState, useEffect } from 'react';

export function useCountUp(target, duration = 1500) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    // We aim for 60fps, so ~16ms per frame
    const step = target / (duration / 16);
    
    if (target === 0) {
      setCount(0);
      return;
    }

    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target, duration]);

  return count;
}
