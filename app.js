// My Checklist
//
// The whole app follows one rule: `items` is the single source of truth.
// Every action changes `items`, then calls render(). Nothing else touches
// the page directly. That keeps the screen and the data from drifting apart.

const STORAGE_KEY = 'checklist.items.v1';

// Grab the elements once, up front, instead of re-finding them on every click.
const form = document.getElementById('add-form');
const input = document.getElementById('new-item');
const list = document.getElementById('items');
const progress = document.getElementById('progress');
const emptyMessage = document.getElementById('empty');
const footer = document.querySelector('.app-footer');
const clearDoneButton = document.getElementById('clear-done');

/** @type {{id: string, text: string, done: boolean}[]} */
let items = load();

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

// localStorage keeps data in *this* browser on *this* machine, and survives
// refreshes and restarts. It is not a server: your list does not follow you
// to your phone. (That would need a backend — a good future lesson.)

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Never trust stored data blindly; it may be from an older version
    // of the app, or hand-edited.
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => item && typeof item.text === 'string'
    ).map((item) => ({
      id: typeof item.id === 'string' ? item.id : makeId(),
      text: item.text,
      done: Boolean(item.done),
    }));
  } catch {
    // Corrupt JSON, or storage blocked (private browsing). Start clean
    // rather than crashing the whole page.
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Out of quota or storage disabled. The app still works for this
    // session; it just will not remember.
  }
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Rendering
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

  // Using a <label> tied to the checkbox means clicking the text toggles it,
  // and screen readers announce the two together.
  const label = document.createElement('label');
  label.className = 'item-text';
  label.htmlFor = checkbox.id;
  // .textContent, not .innerHTML — so text like "<b>buy milk" shows up as
  // typed instead of being run as HTML. This is how you avoid XSS bugs.
  label.textContent = item.text;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete';
  remove.dataset.action = 'delete';
  remove.textContent = '×'; // multiplication sign, a cleaner × than "x"
  remove.setAttribute('aria-label', `Delete "${item.text}"`);

  li.append(checkbox, label, remove);
  return li;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function addItem(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  items.push({ id: makeId(), text: trimmed, done: false });
  save();
  render();
}

function toggleItem(id) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return;

  item.done = !item.done;
  save();
  render();
}

function deleteItem(id) {
  items = items.filter((item) => item.id !== id);
  save();
  render();
}

function clearCompleted() {
  items = items.filter((item) => !item.done);
  save();
  render();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

form.addEventListener('submit', (event) => {
  // Without this, the browser reloads the page on submit — the default
  // behavior from the era before JavaScript.
  event.preventDefault();
  addItem(input.value);
  input.value = '';
  input.focus();
});

// One listener on the list, rather than two per row. Clicks bubble up from
// the element that was hit, so we ask "what was clicked?" here. This is
// called event delegation, and it keeps working as rows come and go.
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
  if (row) toggleItem(row.dataset.id);
});

clearDoneButton.addEventListener('click', clearCompleted);

// Draw the initial screen from whatever was in storage.
render();
