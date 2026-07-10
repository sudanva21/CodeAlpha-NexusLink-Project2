// Vanilla JS implementation of the React BackgroundPaths component

function createFloatingPaths(position) {
  const container = document.createElement('div');
  container.className = 'floating-bg-container';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'w-full h-full');
  svg.setAttribute('viewBox', '0 0 696 316');
  svg.setAttribute('fill', 'none');
  svg.style.width = '100%';
  svg.style.height = '100%';

  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = 'Background Paths';
  svg.appendChild(title);

  // Generate 36 paths exactly like the React component
  for (let i = 0; i < 36; i++) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    // React logic:
    // d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${...}`
    const p1x = 380 - i * 5 * position;
    const p1y = 189 + i * 6;
    const p2x = 312 - i * 5 * position;
    const p2y = 216 - i * 6;
    const p3x = 152 - i * 5 * position;
    const p3y = 343 - i * 6;
    const p4x = 616 - i * 5 * position;
    const p4y = 470 - i * 6;
    const p5x = 684 - i * 5 * position;
    const p5y = 875 - i * 6;
    
    const d = \`M-\${p1x} -\${p1y}C-\${p1x} -\${p1y} -\${p2x} \${p2y} \${p3x} \${p3y}C\${p4x} \${p4y} \${p5x} \${p5y} \${p5x} \${p5y}\`;
    
    const width = 0.5 + i * 0.03;
    const baseOpacity = 0.1 + i * 0.03;
    const duration = 20 + Math.random() * 10;
    
    path.setAttribute('d', d);
    path.setAttribute('class', 'floating-path');
    path.setAttribute('stroke-width', width);
    path.setAttribute('pathLength', '1'); // For stroke-dasharray animation
    
    // Set custom CSS variables for the animation
    path.style.setProperty('--duration', \`\${duration}s\`);
    path.style.setProperty('--base-opacity', baseOpacity);
    
    svg.appendChild(path);
  }
  
  container.appendChild(svg);
  return container;
}

export function initBackground() {
  // Check if it already exists
  if (document.getElementById('nexuslink-animated-bg')) return;
  
  const bgWrapper = document.createElement('div');
  bgWrapper.id = 'nexuslink-animated-bg';
  bgWrapper.className = 'bg-theme-container';
  
  const paths1 = createFloatingPaths(1);
  const paths2 = createFloatingPaths(-1);
  
  bgWrapper.appendChild(paths1);
  bgWrapper.appendChild(paths2);
  
  // Insert at the beginning of the body
  document.body.insertBefore(bgWrapper, document.body.firstChild);
}
