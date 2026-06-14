// storage.js — single access point for all Ground Floor data
// Every read and write goes through here.
// If storage ever changes (IndexedDB, cloud, etc), only this file changes.

const Storage = {

  // Read all GF data in one call
  getAll() {
    return new Promise((resolve) => {
      const keys = ["gf_entries", "gf_notes", "gf_readers", "gf_themes"];
      const tryRead = (attempt) => {
        if (attempt > 15) { resolve({}); return; }
        if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
          setTimeout(() => tryRead(attempt + 1), 300);
          return;
        }
        try {
          chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              setTimeout(() => tryRead(attempt + 1), 400);
              return;
            }
            resolve(result || {});
          });
        } catch(e) {
          setTimeout(() => tryRead(attempt + 1), 400);
        }
      };
      setTimeout(() => tryRead(1), 150);
    });
  },

  // Read a single key
  get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(result[key] || null);
      });
    });
  },

  // Write a single key
  set(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  },

  // Returns author settings — handle saved explicitly by the user
  getSettings() { return this.get("gf_settings").then(s => ({ handle: s?.handle || null })); },

  // Convenience accessors — named so callers don't need to know key strings
  getEntries()  { return this.get("gf_entries").then(v => v || []); },
  getNotes()    { return this.get("gf_notes"); },
  getReaders()  { return this.get("gf_readers"); },
  getThemes()   { return this.get("gf_themes").then(v => v || []); },

  saveThemes(themes)   { return this.set("gf_themes", themes); },
  saveReaders(readers) { return this.set("gf_readers", readers); },
  saveNotes(notes)     { return this.set("gf_notes", notes); },
  clearReaders()       { return new Promise(resolve => chrome.storage.local.remove("gf_readers", resolve)); },

};
