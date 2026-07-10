export function initBackground() {
  // Check if it already exists
  if (document.getElementById('nexuslink-animated-bg')) return;
  
  const bgWrapper = document.createElement('div');
  bgWrapper.id = 'nexuslink-animated-bg';
  bgWrapper.className = 'bg-theme-container';
  
  // Insert at the beginning of the body
  document.body.insertBefore(bgWrapper, document.body.firstChild);
}
