import { api } from '../lib/api.js';
import { navigateTo, setAuth, getToken } from '../lib/router.js';

export function renderAuth(app) {
  if (getToken()) {
    navigateTo('/dashboard');
    return;
  }

  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  let isLogin = params.get('mode') !== 'register';

  function render() {
    app.innerHTML = `
      <div class="auth-page">
        <div class="landing-bg">
          <div class="dot-grid"></div>
          <div class="blob blob-1"></div>
          <div class="blob blob-2"></div>
          <div class="blob blob-3"></div>
        </div>

        <a href="#/" class="auth-back btn btn-ghost">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </a>

        <div class="auth-container">
          <div class="auth-card">
            <div class="auth-header">
              <div class="nav-logo" style="justify-content: center; margin-bottom: 16px;">
                <div class="nav-logo-icon">N</div>
                NexusLink
              </div>
              <h1>${isLogin ? 'Welcome back' : 'Create account'}</h1>
              <p>${isLogin ? 'Sign in to your account to continue' : 'Get started with NexusLink for free'}</p>
            </div>

            <div id="auth-error" style="display:none;"></div>

            <form class="auth-form" id="auth-form">
              ${!isLogin ? `
                <div class="input-group">
                  <label for="username">Username</label>
                  <input type="text" id="username" class="input" placeholder="Choose a username" required minlength="3" autocomplete="username" />
                </div>
              ` : ''}

              <div class="input-group">
                <label for="email">Email</label>
                <input type="email" id="email" class="input" placeholder="you@example.com" required autocomplete="email" />
              </div>

              <div class="input-group">
                <label for="password">Password</label>
                <input type="password" id="password" class="input" placeholder="${isLogin ? 'Enter your password' : 'Create a password (min 6 chars)'}" required minlength="6" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />
              </div>

              <button type="submit" class="btn btn-primary btn-lg" id="auth-submit" style="width: 100%;">
                ${isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div class="auth-footer">
              ${isLogin
                ? `Don't have an account? <a href="#/auth?mode=register" id="toggle-auth">Sign up</a>`
                : `Already have an account? <a href="#/auth?mode=login" id="toggle-auth">Sign in</a>`
              }
            </div>
          </div>
        </div>
      </div>
    `;

    // Form submit
    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('auth-error');
      const submitBtn = document.getElementById('auth-submit');
      
      errorEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div> Please wait...';

      try {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        let result;
        if (isLogin) {
          result = await api.login({ email, password });
        } else {
          const username = document.getElementById('username').value.trim();
          result = await api.register({ username, email, password });
        }

        setAuth(result.token, result.user);
        
        let redirect = null;
        try {
          redirect = sessionStorage.getItem('redirect_after_login');
          if (redirect) sessionStorage.removeItem('redirect_after_login');
        } catch (e) {}

        if (redirect) {
          window.location.hash = redirect;
        } else {
          navigateTo('/dashboard');
        }
      } catch (err) {
        errorEl.className = 'auth-error';
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = isLogin ? 'Sign In' : 'Create Account';
      }
    });

    // Toggle auth mode
    const toggleBtn = document.getElementById('toggle-auth');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        render();
      });
    }
  }

  render();
}
