// scraper.js — Substack Notes API scraper
// Ports the Python script logic into browser JS
// Runs in the context of dashboard.html (has access to chrome.runtime)

const BATCH_SIZE = 25;

// ── API helpers ──────────────────────────────────────────────────────────────

function apiCall(url) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "fetchAPI", url }, (resp) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!resp || !resp.ok) return reject(new Error(resp?.error || "API call failed"));
            resolve(resp.data);
        });
    });
}

// ── Step 1: resolve user ID from handle ─────────────────────────────────────

async function resolveUserId(handle) {
    const url = `https://substack.com/api/v1/user/${handle}/public_profile`;
    const data = await apiCall(url);
    if (!data?.id) throw new Error(`Could not resolve user ID for handle: ${handle}`);
    return { userId: data.id, name: data.name || handle, photoUrl: data.photo_url };
}

// ── Step 2: paginate through all notes ──────────────────────────────────────

async function fetchAllNotes(userId, onProgress) {
    const authorsListOfNotes = [];
    let cursor = null;
    let page = 0;

    while (true) {
        let url = `https://substack.com/api/v1/reader/feed/profile/${userId}?limit=${BATCH_SIZE}`;
        if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

        const data = await apiCall(url);
        const items = data?.items || [];

        if (items.length === 0) break;

        // Filter only notes (type === "comment" in Substack's feed means a Note)
        const notes = items.filter(item =>
            item?.context?.type === "feed_item" ||
            item?.type === "comment" ||
            item?.comment !== undefined ||
            item?.entity_key !== undefined
        );
        console.log("Fetched and filtered notes:", notes);

        // allItems.push(...items);
        authorsListOfNotes.push(...notes);
        page++;

        if (onProgress) onProgress({ fetched: authorsListOfNotes.length, page });

        // Check for next cursor
        cursor = data?.nextCursor || data?.next_cursor || null;
        if (!cursor || items.length < BATCH_SIZE) break;

        // Polite delay — don't hammer the API
        await new Promise(r => setTimeout(r, 300));
    }

    return authorsListOfNotes;
}

// ── Step 2b: extract comments embedded in feed items ────────────────────────

function extractCommentsFromFeedItem(raw) {
    // Substack embeds replies in the feed item itself
    const comment = raw?.comment || raw;
    const children = comment?.children || raw?.children || [];
    const replies = comment?.replies || raw?.replies || [];
    return [...children, ...replies].filter(c => c && (c.author || c.user || c.name));
}

// ── Step 3: parse a raw feed item into a clean note object ───────────────────

function stripHtml(html) {
    if (!html) return "";
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function detectMediaType(item) {
    const body = item?.comment?.body || item?.body || "";
    const attachments = item?.comment?.attachments || item?.attachments || [];
    if (attachments.some(a => a.type === "image" || a.image_url)) return "image";
    if (attachments.some(a => a.type === "link" || a.url)) return "link";
    if (body && body.length > 10) return "text";
    return "text";
}

function parseNote(raw) {
    // Substack feed items have varying shapes — handle both
    const comment = raw?.comment || raw;

    // Likes — try all known field names
    const reactions = raw?.reaction_count ?? comment?.reaction_count ??
        raw?.reactions ?? comment?.reactions ?? 0;

    // Restacks — Substack uses multiple field names across API versions
    const restacks = raw?.restack_count ?? comment?.restack_count ??
        raw?.restacks ?? comment?.restacks ??
        raw?.share_count ?? comment?.share_count ??
        raw?.num_restacks ?? comment?.num_restacks ?? 0;

    // Replies
    const replies = raw?.children_count ?? comment?.children_count ??
        raw?.reply_count ?? comment?.reply_count ??
        raw?.replies ?? comment?.replies ?? 0;

    // Views — Notes often don't expose views; fall back to 0 gracefully
    const views = raw?.view_count ?? comment?.view_count ??
        raw?.views ?? comment?.views ??
        raw?.impressions ?? comment?.impressions ?? 0;

    const bodyHtml = comment?.body || raw?.body || "";
    const bodyText = stripHtml(bodyHtml);
    const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

    const dateStr = comment?.date || raw?.date || raw?.created_at || null;
    const date = dateStr ? new Date(dateStr) : null;

    // Engagement rate: if views available use standard formula
    // If views = 0 (common for Notes), show total interactions as the signal
    const totalInteractions = reactions + restacks + replies;
    const engRate = views > 0
        ? ((totalInteractions / views) * 100).toFixed(2)
        : totalInteractions > 0
            ? totalInteractions.toString()  // show raw interactions when views unavailable
            : "0";

    const noteId = comment?.id || raw?.id || raw?.entity_key || null;
    const url = noteId
        ? `https://substack.com/note/${noteId}`
        : (comment?.canonical_url || raw?.canonical_url || "");

    return {
        id: String(noteId || Math.random()),
        date: date ? date.toISOString() : null,
        dateLabel: date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
        dayOfWeek: date ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()] : "—",
        hour: date ? date.getHours() : null,
        wordCount,
        mediaType: detectMediaType(raw),
        likes: reactions,
        restacks,
        replies,
        views,
        engRate: parseFloat(engRate),
        bodyPreview: bodyText.slice(0, 120) + (bodyText.length > 120 ? "…" : ""),
        url,
        raw: undefined // don't store full raw
    };
}

// ── Main entry point ─────────────────────────────────────────────────────────

async function scrapeNotes(handle, onProgress) {
    console.log("Scraping notes has started!");
    if (!handle || !handle.trim()) throw new Error("Substack handle is required");
    handle = handle.trim().replace(/^@/, "");

    onProgress({ stage: "resolving", message: `Finding @${handle}…` });
    const { userId, name, photoUrl } = await resolveUserId(handle);
    console.log("Substack writers data:", userId, name);

    onProgress({ stage: "fetching", message: `Fetching notes for ${name}…`, fetched: 0 });
    const authorsListOfNotes = await fetchAllNotes(userId, ({ fetched, page }) => {
        onProgress({ stage: "fetching", message: `Fetched ${fetched} items (page ${page})…`, fetched });
    });

    console.log("Result of fetch all notes:", authorsListOfNotes);

    onProgress({ stage: "parsing", message: "Parsing notes…" });
    //FIX: This chain of map filter sort is returning empty value.
    const notes = authorsListOfNotes
        .map(parseNote)
        .filter(n => n.date !== null) // drop malformed
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // newest first

    console.log("Parsed notes:", notes);

    const result = {
        handle,
        name,
        photoUrl,
        userId,
        scrapedAt: new Date().toISOString(),
        totalNotes: notes.length,
        notes
    };


    // Persist to chrome.storage
    await new Promise((resolve, reject) => {
        chrome.storage.local.set({ gf_notes: result }, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else { console.log('Handle saved successfully'); resolve(); }
        });
    });

    // Save engagement snapshot for velocity tracking on next scrape
    await saveEngagementSnapshot(notes);

    onProgress({ stage: "done", message: `${notes.length} notes loaded.` });
    return result;
}

// Load saved notes from storage
function loadSavedNotes() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["gf_notes"], (r) => resolve(r.gf_notes || null));
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// READERS SCRAPER — based on newsletter posts (not Notes)
// ═══════════════════════════════════════════════════════════════════════════

// Fetch all published posts from the author's publication
async function fetchPublishedPosts(handle, onProgress) {
    console.log("Running fn fetchPublishedPosts");
    try {
        const writersPublishedPosts = [];
        let offset = 0;
        const limit = 25;

        while (true) {
            // const url = `https://${handle}.substack.com/api/v1/posts?limit=${limit}&offset=${offset}`;
            const url = `https://theslowai.substack.com/api/v1/posts?limit=${limit}&offset=${offset}`;
            try {
                const usersPostsApiResponse = await apiCall(url);
                console.log("usersPostsApiResponse:", usersPostsApiResponse);

                const posts = usersPostsApiResponse?.posts || usersPostsApiResponse || [];
                if (!Array.isArray(posts) || posts.length === 0) break;

                writersPublishedPosts.push(...posts);
                if (onProgress) onProgress({ stage: "posts", message: `Found ${writersPublishedPosts.length} posts…` });
                if (posts.length < limit) break;
                offset += limit;
                await new Promise(r => setTimeout(r, 300));
            } catch (e) {
                console.error("Failed to fetch published posts: ", e);
                break;
            }
        }
        return writersPublishedPosts;
    } catch (e) {
        return [];
    }
}

// Fetch comments for a single post
async function fetchCommentsOfPost(handle, postId) {
    try {
        // const url = `https://${handle}.substack.com/api/v1/post/${postId}/comments?all_comments=true&sort=best_first`;
        const url = `https://theslowai.substack.com/api/v1/post/${postId}/comments?all_comments=true&sort=best_first`;
        const writersCommentsApiResponse = await apiCall(url);
        const listOfComments = writersCommentsApiResponse?.comments || [];
        console.log("Post comments:", postId, "->", listOfComments.length);
        return listOfComments;
    } catch (e) {
        return [];
    }
}

// Fetch a user's public profile to get follower count
async function fetchUserProfile(handle) {
    try {
        const url = `https://substack.com/api/v1/user/${handle}/public_profile`;
        const data = await apiCall(url);
        return {
            followerCount: data?.follower_count || data?.subscriberCount || 0,
            name: data?.name || handle,
            photoUrl: data?.photo_url || null,
            bio: data?.bio || ""
        };
    } catch (e) {
        return { followerCount: 0, name: handle, photoUrl: null, bio: "" };
    }
}

// Check if a reader has their own Substack publication via the profile posts URL
async function fetchReaderPosts(handle) {
    try {
        const url = `https://substack.com/@${handle}/posts`;
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000));
        const data = await Promise.race([apiCall(url), timeout]);
        const posts = data?.posts || (Array.isArray(data) ? data : []);
        return Array.isArray(posts) ? posts : [];
    } catch (e) {
        return [];
    }
}

// Parse a comment into a reader engagement record
// Substack post comments have all author fields directly on the comment object
function parseComment(comment, postId, postDate, postTitle) {
    const handle = comment?.handle || comment?.user_slug || null;
    const name = comment?.name || handle || "Unknown";
    const photo = comment?.photo_url || null;

    const body = comment?.body || comment?.text || "";
    const bodyText = stripHtml(typeof body === "string" ? body : "").slice(0, 140);

    const date = comment?.date || comment?.edited_at || postDate;

    return {
        handle,
        name,
        photo,
        commentText: bodyText,
        commentDate: date,
        postId,
        postTitle,
        likes: comment?.reaction_count || 0,
        restacks: comment?.restacks || 0
    };
}

// Main readers scraper — uses newsletter posts for comment data
async function scrapeReaders(notes, onProgress, _handle) {
    if (!_handle) throw new Error("Substack handle required to fetch post comments.");

    const storedSettings = await new Promise(resolve =>
        chrome.storage.local.get("gf_settings", result => resolve(result.gf_settings || {}))
    );
    const authorHandle = storedSettings.handle || _handle;

    await Storage.clearReaders();
    console.log('Starting scrapeReaders for handle:', authorHandle);

    const readerMap = {};

    // Step 1: fetch published posts
    onProgress && onProgress({ stage: "posts", message: "Fetching your posts…", scanned: 0, total: 1 });
    const writersPublishedPosts = await fetchPublishedPosts(authorHandle, onProgress);
    console.log('Posts fetched running fn scrap:', writersPublishedPosts.length);

    if (!writersPublishedPosts.length) {
        throw new Error(`No posts found at ${authorHandle}.substack.com`);
    }

    // Step 2: fetch comments for each post (cap at 30 most recent)
    const postsToScan = writersPublishedPosts.slice(0, 30);
    let scanned = 0;

    for (const post of postsToScan) {
        const postId = post.id;
        if (!postId) { scanned++; continue; }

        const ListOfComments = await fetchCommentsOfPost(authorHandle, postId);
        scanned++;

        onProgress && onProgress({
            stage: "scanning",
            message: `Scanning post ${scanned} of ${postsToScan.length}… (${ListOfComments.length} comments)`,
            scanned,
            total: postsToScan.length
        });

        for (const comment of ListOfComments) {
            const parsed = parseComment(comment, postId, post.post_date || post.updated_at, post.title);
            if (!parsed.handle) continue;

            if (!readerMap[parsed.handle]) {
                readerMap[parsed.handle] = {
                    handle: parsed.handle,
                    name: parsed.name,
                    photo: parsed.photo,
                    followerCount: 0,
                    comments: [],
                    commentCount: 0,
                    likeCount: 0,
                    restackCount: 0,
                    firstSeen: parsed.commentDate,
                    lastSeen: parsed.commentDate,
                    engagementScore: 0
                };
            }

            const r = readerMap[parsed.handle];
            r.commentCount++;
            if (parsed.commentText) {
                r.comments.push({ text: parsed.commentText, date: parsed.commentDate, postId, postTitle: parsed.postTitle });
            }
            if (parsed.commentDate && parsed.commentDate > r.lastSeen) r.lastSeen = parsed.commentDate;
            if (parsed.commentDate && parsed.commentDate < r.firstSeen) r.firstSeen = parsed.commentDate;
        }

        await new Promise(r => setTimeout(r, 300));
    }

    // Step 3: fetch follower counts for top 20 readers
    const readers = Object.values(readerMap);
    const topReaders = [...readers].sort((a, b) => b.commentCount - a.commentCount).slice(0, 20);

    let profiled = 0;
    for (const reader of topReaders) {
        if (!reader.handle) continue;
        const profile = await fetchUserProfile(reader.handle);
        reader.followerCount = profile.followerCount;
        reader.bio = profile.bio;

        const readerPosts = await fetchReaderPosts(reader.handle);
        reader.hasPublication = readerPosts.length > 0;

        profiled++;

        onProgress && onProgress({
            stage: "profiling",
            message: `Fetching reader profiles… ${profiled} of ${topReaders.length}`,
            scanned: profiled,
            total: topReaders.length
        });

        await new Promise(r => setTimeout(r, 200));
    }

    // Step 4: score and sort
    for (const reader of readers) {
        reader.engagementScore = (reader.commentCount * 2) + (reader.restackCount * 3) + (reader.likeCount * 1);
        reader.comments = reader.comments
            .sort((a, b) => (b.date || "") > (a.date || "") ? 1 : -1)
            .slice(0, 3);
    }

    const sorted = readers
        .filter(r => r.commentCount > 0)
        .sort((a, b) => b.engagementScore - a.engagementScore);

    const result = {
        scrapedAt: new Date().toISOString(),
        totalReaders: sorted.length,
        handle: authorHandle,
        readers: sorted
    };

    await new Promise((resolve, reject) => {
        chrome.storage.local.set({ gf_readers: result }, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
        });
    });

    onProgress && onProgress({ stage: "done", message: `${sorted.length} readers mapped.` });
    return result;
}

// Load saved readers from storage
function loadSavedReaders() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["gf_readers"], (r) => resolve(r.gf_readers || null));
    });
}
