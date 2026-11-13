import { test } from "node:test";
import assert from "node:assert/strict";
import { getCatalog, loadContent } from "../src/lib/content.ts";
import { getNotesDataResponse } from "../src/lib/notes-data.ts";
import { resolveNoteUrl } from "../src/lib/note-markdown.ts";

test("notes payload is content-addressed and revalidates cached responses", async () => {
  const request = new Request("http://localhost/api/notes?level=N5");
  const response = getNotesDataResponse(request);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  const etag = response.headers.get("etag");
  assert.ok(etag);
  const payload = await response.json();
  assert.deepEqual(payload.notes, JSON.parse(JSON.stringify(loadContent().notes.filter((note) => note.level === "N5"))));

  const cachedResponse = getNotesDataResponse(new Request(request, { headers: { "If-None-Match": etag } }));
  assert.equal(cachedResponse.status, 304);
  assert.equal(cachedResponse.headers.get("etag"), etag);

  const staleResponse = getNotesDataResponse(new Request(request, { headers: { "If-None-Match": '"stale"' } }));
  assert.equal(staleResponse.status, 200);
  assert.equal(staleResponse.headers.get("etag"), etag);

  const note = loadContent().notes[0];
  assert.ok(note);
  assert.equal(resolveNoteUrl(note, "../../../../private.png", getCatalog().notes), "");
  assert.equal(resolveNoteUrl(note, "https://example.com", getCatalog().notes), "https://example.com");
});
