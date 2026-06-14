// background.js — service worker

// Open dashboard tab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    if (msg.action === "openDashboard") {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
        return;
    }

    // Return all stored data to dashboard
    if (msg.action === "getData") {
        chrome.storage.local.get(["gf_entries", "gf_notes", "gf_readers"], (result) => {
            sendResponse({ ok: true, data: result });
        });
        return true;
    }

    // Return the substack.sid cookie — called by scraper before API calls
    if (msg.action === "getCookie") {
        chrome.cookies.get(
            { url: "https://substack.com", name: "substack.sid" },
            (cookie) => {
                sendResponse({ cookie: cookie ? cookie.value : null });
            }
        );
        return true; // keep channel open for async response
    }

    // Fetch a Substack API URL with auth headers — avoids CORS issues
    if (msg.action === "fetchAPI") {
        // First get the session cookie to attach explicitly
        chrome.cookies.get({ url: "https://substack.com", name: "substack.sid" }, (cookie) => {
            const headers = {
                "Accept": "application/json",
                "Content-Type": "application/json"
            };
            if (cookie) {
                headers["Cookie"] = `substack.sid=${cookie.value}`;
            }
            console.log("fetch api message url: ", msg.url);
            fetch(msg.url, {
                method: "GET",
                credentials: "include",
                headers,
            })
                .then(response => {
                    console.log("fetchAPI response: ", response);

                    //FIX: the response type is not JSON 
                    const ct = response.headers.get("content-type") || "";
                    if (!ct.includes("application/json")) {
                        return sendResponse({ ok: false, error: `Non-JSON response (${response.status}): ${ct}` });
                    }
                    return response.json().then(data => sendResponse({ ok: true, data }));
                })
                .catch(err => {
                    console.log("Response Error:", err);
                    sendResponse({ ok: false, error: err.message })
                });
        });
        return true;
    }

});
