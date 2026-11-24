(() => {
  "use strict";

  // Fallback dataset so the app also works if opened directly via file://
  const FALLBACK_DECK = [
    {
      id: 1,
      category: "Software Architecture",
      front: "What is the Single Responsibility Principle (SRP)?",
      back: "A class or module should have one, and only one, reason to change—meaning it should encapsulate a single well-defined responsibility.",
      hint: "The 'S' in SOLID design principles."
    },
    {
      id: 2,
      category: "Web & HTTP",
      front: "What is the difference between HTTP PUT and PATCH?",
      back: "PUT replaces the entire target resource with the request payload (idempotent), whereas PATCH applies a partial modification to the resource.",
      hint: "Full replacement vs. partial update."
    },
    {
      id: 3,
      category: "Version Control",
      front: "How does `git rebase` differ from `git merge`?",
      back: "`git merge` joins two branch histories with a new merge commit, preserving branch structure. `git rebase` replays commits from one branch onto another, creating a linear history.",
      hint: "Merge commit vs. linear commit history."
    },
    {
      id: 4,
      category: "Software Testing",
      front: "What is the Testing Pyramid?",
      back: "A strategy recommending many fast, isolated unit tests at the base, fewer integration tests in the middle, and a small number of end-to-end UI tests at the top.",
      hint: "Balances speed, cost, and confidence."
    },
    {
      id: 5,
      category: "Databases",
      front: "What do the ACID properties stand for in database transactions?",
      back: "Atomicity (all-or-nothing), Consistency (valid state transitions), Isolation (concurrent transactions don't interfere), and Durability (committed data persists).",
      hint: "Four guarantees of reliable relational transactions."
    },
    {
      id: 6,
      category: "Algorithms",
      front: "What is the time complexity of Binary Search, and what prerequisite does it require?",
      back: "O(log n) in the worst and average cases. It requires the input collection to be sorted beforehand.",
      hint: "Halves the search space on each comparison."
    },
    {
      id: 7,
      category: "Web Security",
      front: "What is Cross-Site Scripting (XSS) and how is it prevented?",
      back: "XSS injects malicious scripts into trusted web pages viewed by other users. Prevent it by escaping/sanitizing untrusted output, avoiding raw HTML injection, and using a strict Content Security Policy (CSP).",
      hint: "Never trust unescaped user input in the DOM."
    },
    {
      id: 8,
      category: "Agile & MDS",
      front: "What is the purpose of a Sprint Retrospective in Scrum?",
      back: "The team reflects on how the last sprint went regarding people, processes, and tools, and agrees on concrete improvements to apply in the next sprint.",
      hint: "Focuses on process improvement, not the product demo."
    },
    {
      id: 9,
      category: "Frontend Engineering",
      front: "What is Event Delegation in JavaScript?",
      back: "Attaching a single event listener to a common ancestor element instead of multiple child elements, relying on event bubbling to inspect `event.target`.",
      hint: "Saves memory and automatically supports dynamically added elements."
    },
    {
      id: 10,
      category: "APIs & Networking",
      front: "What makes an HTTP request idempotent?",
      back: "Making the same request multiple times produces the same server state as making it once. GET, PUT, and DELETE are idempotent; POST is generally not.",
      hint: "Safe to retry without creating duplicate side effects."
    }
  ];

  // Application State
  const state = {
    fullDeck: [],
    activeDeck: [],
    currentIndex: 0,
    isFlipped: false,
    statuses: new Map(), // cardId -> "known" | "review"
    isReviewMode: false,
    isSummaryOpen: false,
    isTransitioning: false
  };

  // DOM References
  const dom = {
    studyView: document.getElementById("studyView"),
    summaryView: document.getElementById("summaryView"),

    cardCounter: document.getElementById("cardCounter"),
    deckModeBadge: document.getElementById("deckModeBadge"),
    liveKnownCount: document.getElementById("liveKnownCount"),
    liveReviewCount: document.getElementById("liveReviewCount"),
    progressTrack: document.getElementById("progressTrack"),
    progressFill: document.getElementById("progressFill"),

    flashcard: document.getElementById("flashcard"),
    frontCategory: document.getElementById("frontCategory"),
    backCategory: document.getElementById("backCategory"),
    frontStatusBadge: document.getElementById("frontStatusBadge"),
    backStatusBadge: document.getElementById("backStatusBadge"),
    frontText: document.getElementById("frontText"),
    backText: document.getElementById("backText"),
    hintText: document.getElementById("hintText"),

    markReviewBtn: document.getElementById("markReviewBtn"),
    markKnownBtn: document.getElementById("markKnownBtn"),
    prevBtn: document.getElementById("prevBtn"),
    flipBtn: document.getElementById("flipBtn"),
    nextBtn: document.getElementById("nextBtn"),

    shuffleBtn: document.getElementById("shuffleBtn"),
    headerRestartBtn: document.getElementById("headerRestartBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    sunIcon: document.getElementById("sunIcon"),
    moonIcon: document.getElementById("moonIcon"),

    summaryHeadline: document.getElementById("summaryHeadline"),
    summarySubtext: document.getElementById("summarySubtext"),
    ringProgress: document.getElementById("ringProgress"),
    summaryPercent: document.getElementById("summaryPercent"),
    summaryKnownCount: document.getElementById("summaryKnownCount"),
    summaryReviewCount: document.getElementById("summaryReviewCount"),
    summaryTotalCount: document.getElementById("summaryTotalCount"),
    restartBtn: document.getElementById("restartBtn"),
    reviewOnlyBtn: document.getElementById("reviewOnlyBtn"),
    reviewOnlyCount: document.getElementById("reviewOnlyCount"),
    shuffleRestartBtn: document.getElementById("shuffleRestartBtn"),
    breakdownList: document.getElementById("breakdownList"),

    toast: document.getElementById("toast")
  };

  let toastTimer = null;

  // Helpers
  function fisherYatesShuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    // Guarantee a visibly different order when deck has at least 2 cards
    if (copy.length > 1 && copy.every((item, idx) => item.id === items[idx].id)) {
      [copy[0], copy[1]] = [copy[1], copy[0]];
    }
    return copy;
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    requestAnimationFrame(() => {
      dom.toast.classList.add("is-visible");
    });

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.classList.remove("is-visible");
      setTimeout(() => {
        if (!dom.toast.classList.contains("is-visible")) {
          dom.toast.hidden = true;
        }
      }, 220);
    }, 2000);
  }

  function getCounts() {
    let known = 0;
    let review = 0;
    for (const card of state.activeDeck) {
      const status = state.statuses.get(card.id);
      if (status === "known") known += 1;
      else if (status === "review") review += 1;
    }
    return { known, review, marked: known + review, total: state.activeDeck.length };
  }

  // Rendering
  function renderStatusBadge(el, status) {
    if (!status) {
      el.hidden = true;
      el.textContent = "";
      el.className = "status-badge";
      return;
    }
    el.hidden = false;
    if (status === "known") {
      el.textContent = "Known";
      el.className = "status-badge status-badge-known";
    } else {
      el.textContent = "To Review";
      el.className = "status-badge status-badge-review";
    }
  }

  function renderCard() {
    const card = state.activeDeck[state.currentIndex];
    if (!card) return;

    const status = state.statuses.get(card.id);

    dom.frontCategory.textContent = card.category;
    dom.backCategory.textContent = card.category;
    dom.frontText.textContent = card.front;
    dom.backText.textContent = card.back;

    if (card.hint) {
      dom.hintText.textContent = `Key takeaway: ${card.hint}`;
      dom.hintText.hidden = false;
    } else {
      dom.hintText.hidden = true;
    }

    renderStatusBadge(dom.frontStatusBadge, status);
    renderStatusBadge(dom.backStatusBadge, status);

    dom.flashcard.classList.toggle("is-flipped", state.isFlipped);
    dom.flashcard.setAttribute("aria-pressed", String(state.isFlipped));

    renderProgress();
    renderNavButtons();
  }

  function renderProgress() {
    const { known, review, marked, total } = getCounts();
    const displayIndex = Math.min(state.currentIndex + 1, total);
    const percent = total > 0 ? Math.round((marked / total) * 100) : 0;

    dom.cardCounter.textContent = `Card ${displayIndex} of ${total}`;
    dom.deckModeBadge.hidden = !state.isReviewMode;
    dom.liveKnownCount.textContent = String(known);
    dom.liveReviewCount.textContent = String(review);

    dom.progressFill.style.width = `${percent}%`;
    dom.progressTrack.setAttribute("aria-valuenow", String(percent));
  }

  function renderNavButtons() {
    dom.prevBtn.disabled = state.currentIndex === 0;
    dom.nextBtn.disabled = state.currentIndex >= state.activeDeck.length - 1;
  }

  function renderSummary() {
    state.isSummaryOpen = true;
    dom.studyView.hidden = true;
    dom.summaryView.hidden = false;

    const { known, review, total } = getCounts();
    const percent = total > 0 ? Math.round((known / total) * 100) : 0;

    if (percent === 100) {
      dom.summaryHeadline.textContent = "Perfect score! You nailed the deck.";
      dom.summarySubtext.textContent = "Every single card was marked as known.";
    } else if (percent >= 70) {
      dom.summaryHeadline.textContent = "Strong progress! Almost mastered.";
      dom.summarySubtext.textContent = "Review the remaining cards to lock them in.";
    } else {
      dom.summaryHeadline.textContent = "Good warm-up! Keep practicing.";
      dom.summarySubtext.textContent = "Focus on the cards marked 'To Review' next.";
    }

    dom.summaryPercent.textContent = `${percent}%`;
    dom.summaryKnownCount.textContent = String(known);
    dom.summaryReviewCount.textContent = String(review);
    dom.summaryTotalCount.textContent = String(total);

    // Animate SVG progress ring
    const circumference = 2 * Math.PI * 60; // r = 60
    dom.ringProgress.style.strokeDasharray = `${circumference}`;
    dom.ringProgress.style.strokeDashoffset = `${circumference}`;
    requestAnimationFrame(() => {
      const offset = circumference * (1 - percent / 100);
      dom.ringProgress.style.strokeDashoffset = `${offset}`;
    });

    // Show "Practice To Review" button only if there are review cards
    if (review > 0) {
      dom.reviewOnlyBtn.hidden = false;
      dom.reviewOnlyCount.textContent = String(review);
    } else {
      dom.reviewOnlyBtn.hidden = true;
    }

    // Build breakdown list (To Review first so learner sees priorities immediately)
    dom.breakdownList.innerHTML = "";
    const sortedCards = [...state.activeDeck].sort((a, b) => {
      const aRev = state.statuses.get(a.id) === "review" ? 0 : 1;
      const bRev = state.statuses.get(b.id) === "review" ? 0 : 1;
      return aRev - bRev;
    });

    for (const card of sortedCards) {
      const status = state.statuses.get(card.id) || "review";
      const li = document.createElement("li");
      li.className = "breakdown-item";

      const questionSpan = document.createElement("span");
      questionSpan.className = "breakdown-question";
      questionSpan.textContent = card.front;

      const tagSpan = document.createElement("span");
      tagSpan.className =
        status === "known"
          ? "breakdown-tag breakdown-tag-known"
          : "breakdown-tag breakdown-tag-review";
      tagSpan.textContent = status === "known" ? "Known" : "To Review";

      li.append(questionSpan, tagSpan);
      dom.breakdownList.appendChild(li);
    }
  }

  function showStudyView() {
    state.isSummaryOpen = false;
    dom.summaryView.hidden = true;
    dom.studyView.hidden = false;
    renderCard();
  }

  // Core Actions
  function flipCard() {
    if (state.isSummaryOpen || state.isTransitioning) return;
    state.isFlipped = !state.isFlipped;
    dom.flashcard.classList.toggle("is-flipped", state.isFlipped);
    dom.flashcard.setAttribute("aria-pressed", String(state.isFlipped));
  }

  function transitionToIndex(nextIndex) {
    state.isTransitioning = true;
    dom.flashcard.classList.add("is-transitioning");

    setTimeout(() => {
      state.currentIndex = nextIndex;
      state.isFlipped = false;
      renderCard();
      dom.flashcard.classList.remove("is-transitioning");
      state.isTransitioning = false;
    }, 170);
  }

  function findNextUnmarkedIndex(afterIndex) {
    for (let i = afterIndex + 1; i < state.activeDeck.length; i++) {
      if (!state.statuses.has(state.activeDeck[i].id)) return i;
    }
    for (let i = 0; i < afterIndex; i++) {
      if (!state.statuses.has(state.activeDeck[i].id)) return i;
    }
    return -1;
  }

  function markCard(status) {
    if (state.isSummaryOpen || state.isTransitioning) return;
    const card = state.activeDeck[state.currentIndex];
    if (!card) return;

    state.statuses.set(card.id, status);
    renderProgress();

    // Check if all cards in activeDeck have been marked
    if (state.statuses.size >= state.activeDeck.length) {
      setTimeout(() => renderSummary(), 220);
      return;
    }

    // Otherwise advance to the next card (preferring immediate next, or first unmarked)
    if (state.currentIndex < state.activeDeck.length - 1) {
      transitionToIndex(state.currentIndex + 1);
    } else {
      const nextUnmarked = findNextUnmarkedIndex(state.currentIndex);
      if (nextUnmarked !== -1) {
        transitionToIndex(nextUnmarked);
      } else {
        setTimeout(() => renderSummary(), 220);
      }
    }
  }

  function goToPrevious() {
    if (state.isSummaryOpen || state.isTransitioning || state.currentIndex <= 0) return;
    transitionToIndex(state.currentIndex - 1);
  }

  function goToNext() {
    if (
      state.isSummaryOpen ||
      state.isTransitioning ||
      state.currentIndex >= state.activeDeck.length - 1
    ) {
      return;
    }
    transitionToIndex(state.currentIndex + 1);
  }

  function shuffleDeck() {
    state.activeDeck = fisherYatesShuffle(state.activeDeck);
    state.currentIndex = 0;
    state.isFlipped = false;
    state.statuses.clear();
    showStudyView();
    showToast("Deck shuffled!");
  }

  function restartFullDeck({ shuffle = false } = {}) {
    state.activeDeck = shuffle ? fisherYatesShuffle(state.fullDeck) : [...state.fullDeck];
    state.currentIndex = 0;
    state.isFlipped = false;
    state.statuses.clear();
    state.isReviewMode = false;
    showStudyView();
    showToast(shuffle ? "Deck shuffled & restarted!" : "Session restarted");
  }

  function startReviewOnlySession() {
    const toReviewCards = state.activeDeck.filter(
      (card) => state.statuses.get(card.id) === "review"
    );
    if (toReviewCards.length === 0) return;

    state.activeDeck = toReviewCards;
    state.currentIndex = 0;
    state.isFlipped = false;
    state.statuses.clear();
    state.isReviewMode = true;
    showStudyView();
    showToast(`Practicing ${toReviewCards.length} card${toReviewCards.length === 1 ? "" : "s"} to review`);
  }

  // Theme Handling
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    dom.sunIcon.hidden = isDark;
    dom.moonIcon.hidden = !isDark;
    dom.themeToggleBtn.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  function initTheme() {
    const saved = localStorage.getItem("flashcards-theme");
    if (saved === "dark" || saved === "light") {
      applyTheme(saved);
    } else {
      const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(prefersDark ? "dark" : "light");
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("flashcards-theme", next);
  }

  // Event Binding
  function bindEvents() {
    dom.flashcard.addEventListener("click", flipCard);
    dom.flashcard.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        flipCard();
      }
    });

    dom.flipBtn.addEventListener("click", flipCard);
    dom.markReviewBtn.addEventListener("click", () => markCard("review"));
    dom.markKnownBtn.addEventListener("click", () => markCard("known"));
    dom.prevBtn.addEventListener("click", goToPrevious);
    dom.nextBtn.addEventListener("click", goToNext);

    dom.shuffleBtn.addEventListener("click", shuffleDeck);
    dom.headerRestartBtn.addEventListener("click", () => restartFullDeck({ shuffle: false }));
    dom.themeToggleBtn.addEventListener("click", toggleTheme);

    dom.restartBtn.addEventListener("click", () => restartFullDeck({ shuffle: false }));
    dom.reviewOnlyBtn.addEventListener("click", startReviewOnlySession);
    dom.shuffleRestartBtn.addEventListener("click", () => restartFullDeck({ shuffle: true }));

    // Global keyboard shortcuts
    document.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (event.code === "Space" && !state.isSummaryOpen) {
        if (document.activeElement !== dom.flashcard) {
          event.preventDefault();
          flipCard();
        }
      } else if (event.key === "1" && !state.isSummaryOpen) {
        event.preventDefault();
        markCard("review");
      } else if (event.key === "2" && !state.isSummaryOpen) {
        event.preventDefault();
        markCard("known");
      } else if (event.key === "ArrowLeft" && !state.isSummaryOpen) {
        event.preventDefault();
        goToPrevious();
      } else if (event.key === "ArrowRight" && !state.isSummaryOpen) {
        event.preventDefault();
        goToNext();
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        shuffleDeck();
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        restartFullDeck({ shuffle: false });
      }
    });
  }

  // Initialization
  async function loadDeck() {
    try {
      const response = await fetch("./flashcards.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch {
      // Fall back to embedded deck when opened via file:// or offline
    }
    return FALLBACK_DECK;
  }

  async function init() {
    initTheme();
    bindEvents();
    const deck = await loadDeck();
    state.fullDeck = deck;
    state.activeDeck = [...deck];
    renderCard();
  }

  init();
})();
