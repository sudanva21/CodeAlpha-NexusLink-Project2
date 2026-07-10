import { navigateTo, getToken } from '../lib/router.js';
import { gsap } from 'gsap';

export function renderLanding(app) {
  // If already logged in, go to dashboard
  if (getToken()) {
    navigateTo('/dashboard');
    return;
  }

  app.innerHTML = `
    <div class="landing-page">
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
          <span class="split-text-target">Connect.</span> <span class="split-text-target">Collaborate.</span><br/>
          <div class="true-focus-container" id="true-focus-container">
            <span class="focus-word accent">Create</span>
            <span class="focus-word accent">Together.</span>
            <div class="focus-frame" id="focus-frame">
              <span class="corner top-left"></span>
              <span class="corner top-right"></span>
              <span class="corner bottom-left"></span>
              <span class="corner bottom-right"></span>
            </div>
          </div>
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
        <div class="features-content">
          <div class="features-text">
            <h2>Everything you need</h2>
            <p class="section-sub">Powerful features for seamless remote collaboration</p>
          </div>

        <div class="card-swap-wrapper">
          <div class="card-swap-container" id="card-swap-container">
            <div class="feature-card card">
            <div class="feature-icon violet">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </div>
            <h3>HD Video Calling</h3>
            <p>Crystal-clear video calls with up to 6 participants. Adaptive quality ensures smooth streaming on any connection.</p>
          </div>

          <div class="feature-card card">
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

          <div class="feature-card card">
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

          <div class="feature-card card">
            <div class="feature-icon amber">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
            </div>
            <h3>File Sharing</h3>
            <p>Share documents, images, and files up to 50MB. Everyone in the room can download shared files instantly.</p>
          </div>

          <div class="feature-card card">
            <div class="feature-icon green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h3>End-to-End Encryption</h3>
            <p>All messages are encrypted with AES-256-GCM before transmission. Your conversations stay private.</p>
          </div>

          <div class="feature-card card">
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

  // SplitText Animation for Hero Section
  const splitTargets = app.querySelectorAll('.split-text-target');
  
  splitTargets.forEach(target => {
    const text = target.textContent;
    target.textContent = ''; // clear original text
    
    // Split into characters and wrap in spans
    const chars = text.split('').map(char => {
      const span = document.createElement('span');
      span.textContent = char;
      // Preserve spaces
      if (char === ' ') {
        span.innerHTML = '&nbsp;';
      }
      span.style.display = 'inline-block';
      span.style.willChange = 'transform, opacity';
      target.appendChild(span);
      return span;
    });

    // Apply the GSAP stagger animation
    gsap.fromTo(chars, 
      { opacity: 0, y: 40 }, 
      { 
        opacity: 1, 
        y: 0, 
        duration: 0.6, 
        ease: 'power3.out', 
        stagger: 0.1, 
        force3D: true,
        delay: 0.2 
      }
    );
  });

  // CardSwap Animation Logic
  const swapContainer = document.getElementById('card-swap-container');
  const cards = Array.from(swapContainer.querySelectorAll('.card'));
  
  const cardDistance = 60;
  const verticalDistance = 70;
  const delay = 3000;
  const skewAmount = 6;
  
  const config = {
    ease: 'power3.inOut',
    durDrop: 0.8,
    durMove: 0.8,
    durReturn: 0.8,
    promoteOverlap: 0.8,
    returnDelay: 0.1
  };

  const makeSlot = (i, distX, distY, total) => ({
    x: i * distX,
    y: -i * distY,
    z: -i * distX * 1.5,
    zIndex: total - i
  });

  const placeNow = (el, slot, skew) =>
    gsap.set(el, {
      x: slot.x,
      y: slot.y,
      z: slot.z,
      xPercent: -50,
      yPercent: -50,
      skewY: skew,
      transformOrigin: 'center center',
      zIndex: slot.zIndex,
      force3D: true
    });

  let order = Array.from({ length: cards.length }, (_, i) => i);
  let tl;
  
  const total = cards.length;
  cards.forEach((card, i) => placeNow(card, makeSlot(i, cardDistance, verticalDistance, total), skewAmount));

  const swap = () => {
    if (order.length < 2) return;
    const [front, ...rest] = order;
    const elFront = cards[front];
    
    tl = gsap.timeline();

    tl.to(elFront, {
      y: '+=500',
      duration: config.durDrop,
      ease: config.ease
    });

    tl.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`);
    rest.forEach((idx, i) => {
      const el = cards[idx];
      const slot = makeSlot(i, cardDistance, verticalDistance, cards.length);
      tl.set(el, { zIndex: slot.zIndex }, 'promote');
      tl.to(
        el,
        {
          x: slot.x,
          y: slot.y,
          z: slot.z,
          duration: config.durMove,
          ease: config.ease
        },
        `promote+=${i * 0.15}`
      );
    });

    const backSlot = makeSlot(cards.length - 1, cardDistance, verticalDistance, cards.length);
    tl.addLabel('return', `promote+=${config.durMove * config.returnDelay}`);
    tl.call(
      () => {
        gsap.set(elFront, { zIndex: backSlot.zIndex });
      },
      undefined,
      'return'
    );
    tl.to(
      elFront,
      {
        x: backSlot.x,
        y: backSlot.y,
        z: backSlot.z,
        duration: config.durReturn,
        ease: config.ease
      },
      'return'
    );

    tl.call(() => {
      order = [...rest, front];
    });
  };

  swap();
  
  // Clean up any existing interval before creating a new one
  if (window.landingSwapInterval) clearInterval(window.landingSwapInterval);
  window.landingSwapInterval = setInterval(swap, delay);

  // Initialize TrueFocus for hero section for "Create Together."
  const tfContainer = document.getElementById('true-focus-container');
  const tfWords = tfContainer.querySelectorAll('.focus-word');
  const tfFrame = document.getElementById('focus-frame');
  
  let currentIndex = 0;
  const blurAmount = 5;
  const animationDuration = 2;
  const pauseBetweenAnimations = 1;
  const manualMode = false;
  
  tfContainer.style.setProperty('--border-color', 'red');
  tfContainer.style.setProperty('--glow-color', 'rgba(255, 0, 0, 0.6)');
  
  function updateFocus() {
    if (!tfWords[currentIndex]) return;
    const parentRect = tfContainer.getBoundingClientRect();
    const activeRect = tfWords[currentIndex].getBoundingClientRect();
    
    tfFrame.style.opacity = '1';
    tfFrame.style.transform = `translate(${activeRect.left - parentRect.left}px, ${activeRect.top - parentRect.top}px)`;
    tfFrame.style.width = `${activeRect.width}px`;
    tfFrame.style.height = `${activeRect.height}px`;
    tfFrame.style.transition = `transform ${animationDuration}s ease, width ${animationDuration}s ease, height ${animationDuration}s ease, opacity ${animationDuration}s ease`;
    
    tfWords.forEach((word, idx) => {
      const isActive = idx === currentIndex;
      word.classList.toggle('active', isActive && !manualMode);
      word.style.filter = isActive ? `blur(0px)` : `blur(${blurAmount}px)`;
      word.style.transition = `filter ${animationDuration}s ease`;
    });
  }
  
  // Initial frame calc
  requestAnimationFrame(updateFocus);
  
  let tfInterval;
  if (!manualMode) {
    tfInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % tfWords.length;
      updateFocus();
    }, (animationDuration + pauseBetweenAnimations) * 1000);
  }
  
  const tfResizeHandler = () => {
    updateFocus();
  };
  window.addEventListener('resize', tfResizeHandler);

  return () => {
    window.removeEventListener('scroll', onScroll);
    if (tfInterval) clearInterval(tfInterval);
    window.removeEventListener('resize', tfResizeHandler);
  };
}
