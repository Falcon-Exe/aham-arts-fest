import React, { useState, useEffect } from 'react';

const AnimatedCounter = ({ value, duration = 1000 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    let animationFrameId;
    const startValue = count;
    const endValue = value;
    
    if (startValue === endValue) return;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      // Easing function: easeOutQuart
      const easeOut = 1 - Math.pow(1 - percentage, 4);
      
      setCount(Math.round(startValue + (endValue - startValue) * easeOut));

      if (percentage < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setCount(endValue);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return <span>{count}</span>;
};

export default AnimatedCounter;
