import { navigateTo, getToken } from '../lib/router.js';

export function renderLanding(app) {
  // If already logged in, go to dashboard
  if (getToken()) {
    navigateTo('/dashboard');
    return;
  }

  app.innerHTML = `
    <div class="landing-page">
      <div class="landing-bg">
        <div class="dot-grid"></div>
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="blob blob-3"></div>
      </div>

      <nav class="landing-nav" id="landing-nav">
        <div class="nav-logo">
          <div class="nav-logo-icon">N</div>
          NexusLink
        </div>
        <div class="nav-actions">
          <a href="#/auth" class="btn btn-ghost">Log in</a>
          <a href="#/auth?mode=register" class="btn btn-primary">Get Started</a>
        </div>
      </nav>

      <section class="hero">
        <div class="hero-eyebrow">
          <span style="font-size: 14px;">&#9889;</span>
          Real-time collaboration, redefined
        </div>
        <h1>
          Connect. Collaborate.<br/>
          <span class="accent">Create Together.</span>
        </h1>
        <p>
          Video conferencing, screen sharing, file exchange, and a collaborative whiteboard — 
          all in one secure platform with end-to-end encryption.
        </p>
        <div class="hero-actions">
          <a href="#/auth?mode=register" class="btn btn-primary btn-lg">
            Start for Free
            <span style="font-size: 18px;">&#8594;</span>
          </a>
          <a href="#features" class="btn btn-secondary btn-lg" id="learn-more-btn">
            Learn More
          </a>
        </div>
      </section>

      <section class="features-section" id="features">
        <h2>Everything you need</h2>
        <p class="section-sub">Powerful features for seamless remote collaboration</p>

        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon violet">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </div>
            <h3>HD Video Calling</h3>
            <p>Crystal-clear video calls with up to 6 participants. Adaptive quality ensures smooth streaming on any connection.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon coral">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <h3>Screen Sharing</h3>
            <p>Share your entire screen or a specific window. Perfect for presentations, code reviews, and demos.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon teal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                <path d="M2 2l7.586 7.586"/>
                <circle cx="11" cy="11" r="2"/>
              </svg>
            </div>
            <h3>Live Whiteboard</h3>
            <p>Collaborative drawing canvas with pens, shapes, and colors. Changes sync instantly across all participants.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon amber">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
            </div>
            <h3>File Sharing</h3>
            <p>Share documents, images, and files up to 50MB. Everyone in the room can download shared files instantly.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h3>End-to-End Encryption</h3>
            <p>All messages are encrypted with AES-256-GCM before transmission. Your conversations stay private.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3>Secure Auth</h3>
            <p>JWT-based authentication with bcrypt password hashing. Your account is protected with industry standards.</p>
          </div>
        </div>
      </section>

      <footer class="landing-footer">
        <p>Built with WebRTC, Socket.IO, and Web Crypto API &mdash; NexusLink &copy; 2024</p>
      </footer>
    </div>
  `;

  // Scroll-based nav shadow
  const nav = document.getElementById('landing-nav');
  const onScroll = () => {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', onScroll);

  return () => {
    window.removeEventListener('scroll', onScroll);
  };
}
