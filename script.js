"use strict";

/*
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const USERNAME = "git2358";

const CACHE_VERSION = "2026-09-24-01";

const CACHE_KEY = `git2358-repositories-${CACHE_VERSION}`;
const CACHE_TIME_KEY = `git2358-repositories-time-${CACHE_VERSION}`;

const CACHE_DURATION = 5 * 60 * 1000;


/*
 * ============================================================
 * DOM
 * ============================================================
 */

const avatar = document.getElementById("avatar");
const profileName = document.getElementById("profileName");
const profileUsername = document.getElementById("profileUsername");
const profileBio = document.getElementById("profileBio");
const followers = document.getElementById("followers");
const following = document.getElementById("following");
const repoCount = document.getElementById("repoCount");
const projectsCount = document.getElementById("projectsCount");

const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const reposContainer = document.getElementById("repos");


/*
 * ============================================================
 * STATE
 * ============================================================
 */

let repositories = [];
let currentRepositorySignature = "";


/*
 * ============================================================
 * LANGUAGE COLOURS
 * ============================================================
 */

const LANGUAGE_COLORS = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    HTML: "#e34c26",
    CSS: "#563d7c",
    SCSS: "#c6538c",
    PHP: "#4F5D95",
    Python: "#3572A5",
    Java: "#b07219",
    Kotlin: "#A97BFF",
    Swift: "#F05138",
    C: "#555555",
    "C++": "#f34b7d",
    "C#": "#178600",
    Shell: "#89e051",
    PowerShell: "#012456",
    Ruby: "#701516",
    Go: "#00ADD8",
    Rust: "#dea584",
    Lua: "#000080",
    Dart: "#00B4AB",
    Vue: "#41b883",
    Svelte: "#ff3e00"
};


/*
 * ============================================================
 * GITHUB FETCH
 * ============================================================
 *
 * cache: "no-store" prevents the browser's own HTTP cache
 * from making the GitHub API response unnecessarily stale.
 */

async function githubFetch(url) {
    const response = await fetch(url, {
        cache: "no-store",
        headers: {
            Accept: "application/vnd.github+json"
        }
    });

    if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
    }

    return response.json();
}


/*
 * ============================================================
 * AVATAR / ICON UPDATE
 * ============================================================
 */

function updateAvatarIcons(avatarUrl) {
    if (!avatarUrl) {
        return;
    }

    avatar.src = avatarUrl;

    const favicon = document.querySelector('link[rel="icon"]');
    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');

    if (favicon) {
        favicon.href = avatarUrl;
    }

    if (appleIcon) {
        appleIcon.href = avatarUrl;
    }
}


/*
 * ============================================================
 * PROFILE
 * ============================================================
 */

async function loadProfile() {
    try {
        const profile = await githubFetch(
            `https://api.github.com/users/${USERNAME}`
        );

        if (profile.name) {
            profileName.textContent = profile.name;
        } else {
            profileName.textContent = USERNAME;
        }

        profileUsername.textContent = `@${profile.login || USERNAME}`;

        profileBio.textContent =
            profile.bio ||
            "GitHub projects";

        followers.textContent =
            Number(profile.followers || 0).toLocaleString();

        following.textContent =
            Number(profile.following || 0).toLocaleString();

        updateAvatarIcons(profile.avatar_url);

    } catch (error) {
        console.warn("Could not load GitHub profile:", error);
    }
}


/*
 * ============================================================
 * REPOSITORY FILTERING / VALIDATION
 * ============================================================
 *
 * This is deliberately stricter than simply trusting whatever
 * the API returns.
 */

function processRepositories(data) {
    if (!Array.isArray(data)) {
        return [];
    }

    const result = [];
    const seen = new Set();

    for (const repo of data) {
        if (!repo || typeof repo !== "object") {
            continue;
        }

        if (
            !repo.owner ||
            typeof repo.owner.login !== "string"
        ) {
            continue;
        }

        if (
            repo.owner.login.toLowerCase() !==
            USERNAME.toLowerCase()
        ) {
            continue;
        }

        if (repo.fork === true) {
            continue;
        }

        if (
            repo.full_name &&
            typeof repo.full_name === "string" &&
            !repo.full_name
                .toLowerCase()
                .startsWith(`${USERNAME.toLowerCase()}/`)
        ) {
            continue;
        }

        const uniqueKey =
            repo.id ||
            repo.full_name ||
            repo.name;

        if (!uniqueKey || seen.has(uniqueKey)) {
            continue;
        }

        seen.add(uniqueKey);
        result.push(repo);
    }

    return result;
}


/*
 * ============================================================
 * REPOSITORY SIGNATURE
 * ============================================================
 *
 * Sorting by ID makes the signature deterministic even if
 * GitHub changes the order of repositories between requests.
 */

function createRepositorySignature(data) {
    const processed = processRepositories(data);

    const signatureData = processed
        .map(repo => ({
            id: repo.id || null,
            full_name: repo.full_name || "",
            name: repo.name || "",
            fork: repo.fork === true,
            updated_at: repo.updated_at || "",
            created_at: repo.created_at || "",
            description: repo.description || "",
            topics: Array.isArray(repo.topics)
                ? [...repo.topics].sort()
                : [],
            language: repo.language || "",
            stargazers_count: Number(repo.stargazers_count || 0),
            forks_count: Number(repo.forks_count || 0)
        }))
        .sort((a, b) => {
            const aId = String(a.id || a.full_name || a.name);
            const bId = String(b.id || b.full_name || b.name);

            return aId.localeCompare(bId);
        });

    return JSON.stringify(signatureData);
}


/*
 * ============================================================
 * CACHE CLEANUP
 * ============================================================
 */

function cleanOldCache() {
    try {
        /*
         * Remove the original File 1 cache keys.
         */
        localStorage.removeItem("git2358-repositories");
        localStorage.removeItem("git2358-repositories-time");

        /*
         * Remove previous versioned caches.
         */
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);

            if (!key) {
                continue;
            }

            if (
                key.startsWith("git2358-repositories-") &&
                key !== CACHE_KEY &&
                key !== CACHE_TIME_KEY
            ) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });

    } catch (error) {
        console.warn("Could not clean old cache:", error);
    }
}


/*
 * ============================================================
 * CACHE LOADING
 * ============================================================
 */

function loadCachedRepositories() {
    try {
        const savedTime = Number(
            localStorage.getItem(CACHE_TIME_KEY)
        );

        if (!Number.isFinite(savedTime)) {
            return false;
        }

        const age = Date.now() - savedTime;

        /*
         * Reject future timestamps as well as expired caches.
         */
        if (age < 0 || age > CACHE_DURATION) {
            return false;
        }

        const cached = JSON.parse(
            localStorage.getItem(CACHE_KEY) || "null"
        );

        if (!Array.isArray(cached)) {
            return false;
        }

        const cleaned = processRepositories(cached);

        if (!cleaned.length && cached.length) {
            return false;
        }

        repositories = cleaned;

        currentRepositorySignature =
            createRepositorySignature(repositories);

        updateRepositoryStats();
        renderRepositories();

        return true;

    } catch (error) {
        console.warn("Could not load cached repositories:", error);
        return false;
    }
}


/*
 * ============================================================
 * CACHE SAVING
 * ============================================================
 */

function saveRepositoryCache(data) {
    try {
        const cleaned = processRepositories(data);

        localStorage.setItem(
            CACHE_KEY,
            JSON.stringify(cleaned)
        );

        localStorage.setItem(
            CACHE_TIME_KEY,
            String(Date.now())
        );

    } catch (error) {
        console.warn("Could not save repository cache:", error);
    }
}


/*
 * ============================================================
 * REPOSITORY COUNT
 * ============================================================
 */

function updateRepositoryStats() {
    const count = repositories.length.toLocaleString();

    repoCount.textContent = count;
    projectsCount.textContent = `(${count})`;
}


/*
 * ============================================================
 * LOAD REPOSITORIES
 * ============================================================
 *
 * IMPORTANT:
 *
 * Page 1 is rendered immediately.
 *
 * Additional pages are then fetched afterwards.
 *
 * This is the key speed improvement from File 1.
 */

async function loadRepositories() {
    try {
        const allRepositories = [];

        let page = 1;
        let firstPageRendered = false;

        while (true) {
            const url =
                `https://api.github.com/users/${USERNAME}/repos` +
                `?type=owner` +
                `&per_page=100` +
                `&page=${page}` +
                `&sort=updated`;

            const pageData = await githubFetch(url);

            if (!Array.isArray(pageData)) {
                throw new Error("GitHub returned invalid repository data.");
            }

            const processedPage =
                processRepositories(pageData);

            allRepositories.push(...processedPage);

            /*
             * ====================================================
             * FIRST PAGE:
             * Render immediately.
             * ====================================================
             */

            if (!firstPageRendered) {
                const firstPageRepositories =
                    processRepositories(processedPage);

                repositories = firstPageRepositories;

                currentRepositorySignature =
                    createRepositorySignature(repositories);

                updateRepositoryStats();
                renderRepositories();

                firstPageRendered = true;
            }

            /*
             * GitHub returned fewer than 100 records.
             * Therefore there are no more pages.
             */
            if (pageData.length < 100) {
                break;
            }

            page++;
        }

        /*
         * Final safety filtering and duplicate removal.
         */
        const filtered =
            processRepositories(allRepositories);

        const uniqueRepositories = [];
        const seenIds = new Set();

        for (const repo of filtered) {
            const key =
                repo.id ||
                repo.full_name ||
                repo.name;

            if (seenIds.has(key)) {
                continue;
            }

            seenIds.add(key);
            uniqueRepositories.push(repo);
        }

        const finalSignature =
            createRepositorySignature(uniqueRepositories);

        /*
         * Only re-render if the final complete repository set
         * differs from what is currently displayed.
         *
         * If page 1 contained everything, this means no
         * unnecessary second render.
         */
        if (
            finalSignature !== currentRepositorySignature
        ) {
            repositories = uniqueRepositories;
            currentRepositorySignature = finalSignature;

            updateRepositoryStats();
            renderRepositories();
        } else {
            /*
             * Keep the complete data even if the signature happens
             * to match what was already displayed.
             */
            repositories = uniqueRepositories;
            updateRepositoryStats();
        }

        /*
         * Store the complete, cleaned repository list.
         */
        saveRepositoryCache(uniqueRepositories);

    } catch (error) {
        console.warn("Could not load repositories:", error);

        /*
         * If cached repositories are already displayed,
         * leave them on screen rather than replacing them
         * with an error.
         */
        if (!repositories.length) {
            reposContainer.innerHTML = `
                <div class="empty">
                    Unable to load projects.
                </div>
            `;
        }
    }
}


/*
 * ============================================================
 * RENDER REPOSITORIES
 * ============================================================
 */

function renderRepositories() {
    const query =
        searchInput.value
            .trim()
            .toLowerCase();

    const validRepositories =
        processRepositories(repositories);

    let filtered =
        validRepositories.filter(repo => {
            if (!query) {
                return true;
            }

            const name =
                String(repo.name || "").toLowerCase();

            const description =
                String(repo.description || "").toLowerCase();

            const topics =
                Array.isArray(repo.topics)
                    ? repo.topics.join(" ").toLowerCase()
                    : "";

            return (
                name.includes(query) ||
                description.includes(query) ||
                topics.includes(query)
            );
        });

    const sort = sortSelect.value;

    if (sort === "updated") {
        filtered.sort((a, b) => {
            return (
                new Date(b.updated_at || 0) -
                new Date(a.updated_at || 0)
            );
        });
    }

    if (sort === "created") {
        filtered.sort((a, b) => {
            return (
                new Date(b.created_at || 0) -
                new Date(a.created_at || 0)
            );
        });
    }

    if (sort === "name") {
        filtered.sort((a, b) => {
            return String(a.name || "")
                .localeCompare(
                    String(b.name || ""),
                    undefined,
                    { sensitivity: "base" }
                );
        });
    }

    if (sort === "stars") {
        filtered.sort((a, b) => {
            return (
                Number(b.stargazers_count || 0) -
                Number(a.stargazers_count || 0)
            );
        });
    }

    if (!filtered.length) {
        reposContainer.innerHTML = `
            <div class="empty">
                No projects found.
            </div>
        `;

        return;
    }

    /*
     * Use a DocumentFragment rather than repeatedly modifying
     * the live DOM.
     */
    const fragment = document.createDocumentFragment();

    for (const repo of filtered) {
        const wrapper = document.createElement("div");

        wrapper.innerHTML =
            createRepositoryCard(repo);

        const card = wrapper.firstElementChild;

        if (card) {
            fragment.appendChild(card);
        }
    }

    reposContainer.replaceChildren(fragment);
}


/*
 * ============================================================
 * REPOSITORY CARD
 * ============================================================
 */

function createRepositoryCard(repo) {
    const name =
        String(repo.name || "Unnamed repository");

    const description =
        repo.description ||
        "No description provided.";

    const topics =
        Array.isArray(repo.topics)
            ? repo.topics
            : [];

    const language =
        repo.language ||
        "";

    const languageColor =
        getLanguageColor(language);

    const stars =
        Number(repo.stargazers_count || 0);

    const forks =
        Number(repo.forks_count || 0);

    const githubUrl =
        repo.html_url ||
        `https://github.com/${USERNAME}/${encodeURIComponent(name)}`;

    const liveUrl =
        `https://${USERNAME}.github.io/${encodeURIComponent(name)}/`;

    /*
     * GitHub OpenGraph preview.
     *
     * encodeURIComponent is retained from File 1 so repository
     * names containing special characters do not break the URL.
     */
    const previewUrl =
        `https://opengraph.githubassets.com/1/` +
        `${USERNAME}/${encodeURIComponent(name)}`;

    const topicsHTML =
        topics
            .map(topic => {
                return `
                    <span class="topic">
                        ${escapeHTML(topic)}
                    </span>
                `;
            })
            .join("");

    const languageHTML =
        language
            ? `
                <span class="repo-meta-item">
                    <span
                        class="language-dot"
                        style="background-color:${escapeHTML(languageColor)}"
                    ></span>
                    ${escapeHTML(language)}
                </span>
            `
            : "";

    return `
        <article class="repo-card">

            <a
                class="repo-preview-link"
                href="${escapeHTML(githubUrl)}"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open ${escapeHTML(name)} on GitHub"
            >
                <img
                    class="repo-preview"
                    src="${escapeHTML(previewUrl)}"
                    alt="${escapeHTML(name)} preview"
                    loading="lazy"
                    decoding="async"
                >
            </a>

            <div class="repo-content">

                <h3 class="repo-name">
                    ${escapeHTML(name)}
                </h3>

                <p class="repo-description">
                    ${escapeHTML(description)}
                </p>

                ${
                    topicsHTML
                        ? `
                            <div class="repo-topics">
                                ${topicsHTML}
                            </div>
                        `
                        : ""
                }

                <div class="repo-meta">

                    ${languageHTML}

                    <span class="repo-meta-item">
                        ★ ${stars.toLocaleString()}
                    </span>

                    <span class="repo-meta-item">
                        ⑂ ${forks.toLocaleString()}
                    </span>

                    <span class="repo-meta-item">
                        Updated ${formatDate(repo.updated_at)}
                    </span>

                </div>

                <div class="repo-actions">

                    <a
                        class="repo-button primary"
                        href="${escapeHTML(githubUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        GitHub
                    </a>

                    <a
                        class="repo-button"
                        href="${escapeHTML(liveUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Live Site
                    </a>

                </div>

            </div>
        </article>
    `;
}


/*
 * ============================================================
 * LANGUAGE COLOUR
 * ============================================================
 */

function getLanguageColor(language) {
    return (
        LANGUAGE_COLORS[language] ||
        "#8b949e"
    );
}


/*
 * ============================================================
 * DATE FORMAT
 * ============================================================
 */

function formatDate(dateString) {
    if (!dateString) {
        return "Unknown";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "Unknown";
    }

    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


/*
 * ============================================================
 * HTML ESCAPING
 * ============================================================
 */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/*
 * ============================================================
 * SEARCH
 * ============================================================
 */

searchInput.addEventListener(
    "input",
    renderRepositories
);


/*
 * ============================================================
 * SORT
 * ============================================================
 */

const savedSort =
    localStorage.getItem("git2358-sort");

const validSorts = [
    "updated",
    "created",
    "name",
    "stars"
];

if (validSorts.includes(savedSort)) {
    sortSelect.value = savedSort;
}

sortSelect.addEventListener("change", () => {
    localStorage.setItem(
        "git2358-sort",
        sortSelect.value
    );

    renderRepositories();
});


/*
 * ============================================================
 * STARTUP
 * ============================================================
 *
 * Order is important:
 *
 * 1. Remove stale cache versions.
 * 2. Display valid cache immediately.
 * 3. Load profile independently.
 * 4. Refresh repositories from GitHub.
 *
 * This means a returning visitor can see projects while the
 * GitHub API request is still happening.
 */

cleanOldCache();

loadCachedRepositories();

loadProfile();

loadRepositories();
