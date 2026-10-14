// My Checklist -- now with accounts.
//
// Two layers, kept deliberately separate:
//   1. Auth      -- who is signed in, via Supabase Auth.
//   2. Checklist -- the state+render loop from before, except `items` is now
//                   loaded from and saved to a Postgres table instead of
//                   localStorage. Which rows a signed-in user can even see
//                   is enforced by the Row Level Security policies on the
//                   `items` table (see supabase/migrations/) -- this file
//                   never has to check "is this my row?" itself.
//
// `type="module"` on the <script> tag (see index.html) is what makes
// `import` work in a browser with no build step.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

const loadingScreen = document.getElementById('loading-screen');
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');

const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authSubmit = document.getElementById('auth-submit');
const authToggleText = document.getElementById('auth-toggle-text');
const authToggleModeButton = document.getElementById('auth-toggle-mode');
const authMessage = document.getElementById('auth-message');

const signOutButton = document.getElementById('sign-out');
const userEmailLabel = document.getElementById('user-email');

const form = document.getElementById('add-form');
const input = document.getElementById('new-item');
const list = document.getElementById('items');
const progress = document.getElementById('progress');
const emptyMessage = document.getElementById('empty');
const footer = document.querySelector('.app-footer');
const clearDoneButton = document.getElementById('clear-done');

/** @type {{id: string, text: string, done: boolean}[]} */
let items = [];

// 'signin' or 'signup' -- which action the auth form currently submits.
let authMode = 'signin';

// ---------------------------------------------------------------------------
// Screen switching
// ---------------------------------------------------------------------------

function showScreen(name) {
  loadingScreen.hidden = true;
  authScreen.hidden = name !== 'auth';
  appScreen.hidden = name !== 'app';
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function setAuthMode(mode) {
  authMode = mode;
  authPasswordInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';

  if (mode === 'signup') {
    authSubmit.textContent = 'Create account';
    authToggleText.textContent = 'Already have an account?';
    authToggleModeButton.textContent = 'Sign in';
  } else {
    authSubmit.textContent = 'Sign in';
    authToggleText.textContent = "Don't have an account?";
    authToggleModeButton.textContent = 'Sign up';
  }
}

function setAuthMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.classList.toggle('auth-message-error', isError);
}

authToggleModeButton.addEventListener('click', () => {
  setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
  setAuthMessage('');
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  authSubmit.disabled = true;
  setAuthMessage('');

  try {
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthMessage(error.message, true);
        return;
      }
      // With email confirmations on, signUp succeeds but returns no
      // session yet -- the account exists but can't sign in until the
      // confirmation link in that email is clicked.
      if (!data.session) {
        setAuthMessage('Check your email for a confirmation link, then sign in.');
        setAuthMode('signin');
        authPasswordInput.value = '';
      }
      // If a session WAS returned (confirmations off), onAuthStateChange
      // below handles moving to the app screen -- nothing more to do here.
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthMessage(error.message, true);
        return;
      }
      authPasswordInput.value = '';
      // onAuthStateChange below does the rest.
    }
  } finally {
    authSubmit.disabled = false;
  }
});

signOutButton.addEventListener('click', () => {
  supabase.auth.signOut();
});

// Fires once immediately with whatever session already exists (or null),
// and again on every future sign-in, sign-out, or token refresh. That one
// registration covers both "initial load" and "state changed later".
supabase.auth.onAuthStateChange((_event, session) => {
  handleAuthChange(session);
});

async function handleAuthChange(session) {
  if (session) {
    userEmailLabel.textContent = session.user.email;
    showScreen('app');
    await loadItems();
  } else {
    items = [];
    render();
    authForm.reset();
    showScreen('auth');
  }
}

// ---------------------------------------------------------------------------
// Checklist data -- Postgres via Supabase instead of localStorage.
//
// None of these functions filter by "whose row is this" -- the Row Level
// Security policies on the `items` table do that automatically, using the
// signed-in user's id from their session token. A query here simply cannot
// see or change another user's rows, no matter what it asks for.
// ---------------------------------------------------------------------------

async function loadItems() {
  const { data, error } = await supabase
    .from('items')
    .select('id, text, done')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load items:', error.message);
    items = [];
  } else {
    items = data;
  }
  render();
}

async function addItem(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  // No user_id here -- the column defaults to auth.uid() on the server,
  // read from the request's own session. The client never gets to assert
  // whose item this is.
  const { error } = await supabase.from('items').insert({ text: trimmed });
  if (error) {
    console.error('Failed to add item:', error.message);
    return;
  }
  await loadItems();
}

async function toggleItem(id, done) {
  const { error } = await supabase.from('items').update({ done }).eq('id', id);
  if (error) {
    console.error('Failed to update item:', error.message);
    await loadItems(); // re-sync in case the checkbox now shows the wrong state
    return;
  }
  await loadItems();
}

async function deleteItem(id) {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete item:', error.message);
    return;
  }
  await loadItems();
}

async function clearCompleted() {
  const { error } = await supabase.from('items').delete().eq('done', true);
  if (error) {
    console.error('Failed to clear completed items:', error.message);
    return;
  }
  await loadItems();
}

// ---------------------------------------------------------------------------
// Rendering (same state+render pattern as the localStorage version)
// ---------------------------------------------------------------------------

function render() {
  list.replaceChildren(...items.map(createItemElement));

  const total = items.length;
  const done = items.filter((item) => item.done).length;

  progress.textContent = total === 0
    ? 'Nothing here yet'
    : `${done} of ${total} done`;

  emptyMessage.hidden = total > 0;
  footer.hidden = done === 0;
}

function createItemElement(item) {
  const li = document.createElement('li');
  li.className = item.done ? 'item done' : 'item';
  li.dataset.id = item.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = item.done;
  checkbox.id = `cb-${item.id}`;

  const label = document.createElement('label');
  label.className = 'item-text';
  label.htmlFor = checkbox.id;
  // .textContent, not .innerHTML -- text is always shown as typed, never
  // run as HTML.
  label.textContent = item.text;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete';
  remove.dataset.action = 'delete';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Delete "${item.text}"`);

  li.append(checkbox, label, remove);
  return li;
}

// ---------------------------------------------------------------------------
// Checklist wiring
// ---------------------------------------------------------------------------

form.addEventListener('submit', (event) => {
  event.preventDefault();
  addItem(input.value);
  input.value = '';
  input.focus();
});

// One listener on the list, rather than one per row -- clicks bubble up
// from whatever was hit, so we ask "what was clicked?" here instead.
list.addEventListener('click', (event) => {
  const row = event.target.closest('.item');
  if (!row) return;

  if (event.target.dataset.action === 'delete') {
    deleteItem(row.dataset.id);
  }
});

list.addEventListener('change', (event) => {
  if (event.target.type !== 'checkbox') return;

  const row = event.target.closest('.item');
  if (row) toggleItem(row.dataset.id, event.target.checked);
});

clearDoneButton.addEventListener('click', clearCompleted);

setAuthMode('signin');
