// Simple hash-based SPA router

const routes = {};
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigateTo(path) {
  window.location.hash = path;
}

export function getCurrentPath() {
  return window.location.hash.slice(1) || '/';
}

export function initRouter() {
  async function handleRoute() {
    const path = getCurrentPath();

    // Clean up previous page
    if (currentCleanup && typeof currentCleanup === 'function') {
      currentCleanup();
      currentCleanup = null;
    }

    // Find matching route
    let handler = null;
    let params = {};

    for (const [pattern, h] of Object.entries(routes)) {
      const match = matchRoute(pattern, path);
      if (match) {
        handler = h;
        params = match;
        break;
      }
    }

    if (handler) {
      const app = document.getElementById('app');
      currentCleanup = await handler(app, params);
    } else {
      // 404 - redirect to landing
      navigateTo('/');
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function matchRoute(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// Auth guard
export function requireAuth() {
  const token = localStorage.getItem('nexuslink_token');
  if (!token) {
    navigateTo('/auth');
    return false;
  }
  return true;
}

export function getUser() {
  const userStr = localStorage.getItem('nexuslink_user');
  return userStr ? JSON.parse(userStr) : null;
}

export function setAuth(token, user) {
  localStorage.setItem('nexuslink_token', token);
  localStorage.setItem('nexuslink_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('nexuslink_token');
  localStorage.removeItem('nexuslink_user');
}

export function getToken() {
  return localStorage.getItem('nexuslink_token');
}
