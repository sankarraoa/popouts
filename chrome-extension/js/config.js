// Centralized configuration for the extension.
// Set POPOUTS_ENV to 'production' to use Railway URLs,
// or 'development' (default) for localhost.

const ENV_KEY = 'popouts_env';

const ENVIRONMENTS = {
  development: {
    LLM_SERVICE_URL: 'http://localhost:8000',
    LICENSE_SERVICE_URL: 'http://localhost:8001',
    WEBSITE_URL: 'http://localhost:8080',
  },
  production: {
    LLM_SERVICE_URL: 'https://llm-service-production-22b1.up.railway.app',
    LICENSE_SERVICE_URL: 'https://license-service-production.up.railway.app',
    WEBSITE_URL: 'https://www.popouts.app',
  },
};

// Resolve the current environment.  Priority:
// 1. Value previously stored in chrome.storage.local (set via Settings page)
// 2. Fallback to 'production' so shipped extensions always hit the live server
let _currentEnv = 'production';
let _resolved = false;

async function resolveEnv() {
  if (_resolved) return;
  try {
    const stored = await chrome.storage.local.get(ENV_KEY);
    if (stored[ENV_KEY] && ENVIRONMENTS[stored[ENV_KEY]]) {
      _currentEnv = stored[ENV_KEY];
    }
  } catch (e) {
    // chrome.storage may not be available in all contexts
  }
  _resolved = true;
}

export async function getConfig() {
  await resolveEnv();
  return { ...ENVIRONMENTS[_currentEnv], env: _currentEnv };
}

export async function setEnv(env) {
  if (!ENVIRONMENTS[env]) throw new Error(`Unknown environment: ${env}`);
  _currentEnv = env;
  _resolved = true;
  await chrome.storage.local.set({ [ENV_KEY]: env });
  // Notify listeners so cached URLs get busted
  _changeListeners.forEach(fn => fn(env));
}

const _changeListeners = [];
export function onEnvChange(fn) {
  _changeListeners.push(fn);
}

export async function getEnv() {
  await resolveEnv();
  return _currentEnv;
}
