-- addItem() in app.js inserts only { text: ... } -- no user_id. This default
-- fills it in server-side from the request's own verified session, which a
-- client cannot forge. (If a client insists on sending its own user_id
-- anyway, the "insert own items" policy's WITH CHECK still rejects it
-- unless it happens to match -- this default just means the common case
-- never needs to think about it at all.)
alter table items alter column user_id set default auth.uid();
