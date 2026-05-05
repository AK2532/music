import { useEffect } from 'react';

export function useAccentColor(imageUrl) {
  useEffect(() => {
    if (!imageUrl) return undefined;

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      const size = 48;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      context.drawImage(image, 0, 0, size, size);
      const data = context.getImageData(0, 0, size, size).data;
      let r = 0, g = 0, b = 0, count = 0;

      for (let i = 0; i < data.length; i += 16) {
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        if (max - min > 35 && max > 60) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count += 1;
        }
      }

      if (count === 0) return;
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      // SimpMusic inspired dark/vibrant processing
      // We want vivid, saturated colors for the dark theme
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luma < 40) { r += 40; g += 40; b += 40; } // Boost if too dark
      if (luma > 200) { r *= 0.8; g *= 0.8; b *= 0.8; } // Dim if too bright
      
      // Secondary color (slightly lighter/shifted for gradients)
      let r2 = Math.min(255, Math.round(r * 1.2));
      let g2 = Math.min(255, Math.round(g * 1.2));
      let b2 = Math.min(255, Math.round(b * 1.2 + 20));

      const root = document.documentElement;
      root.style.setProperty('--accent', `rgb(${r}, ${g}, ${b})`);
      root.style.setProperty('--accent-2', `rgb(${r2}, ${g2}, ${b2})`);
      root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
      root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
      root.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.12)`);
    };

    image.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);
}
