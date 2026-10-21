
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import "./style.css";

type Bike = {
  name: string;
  mileage?: number;
  tank?: number;
  price?: number;
};

const sampleBikes: Bike[] = [
  { name: "Royal Enfield Bullet 350", mileage: 35, tank: 13, price: 175000 },
  { name: "Royal Enfield Classic 350", mileage: 35, tank: 13, price: 195000 },
  { name: "Royal Enfield Hunter 350", mileage: 36, tank: 13, price: 150000 },
  { name: "Honda SP 125", mileage: 60, tank: 11, price: 95000 },
  { name: "Honda Shine 125", mileage: 55, tank: 10.5, price: 85000 },
  { name: "Honda Unicorn", mileage: 50, tank: 13, price: 110000 },
  { name: "Honda Activa 125", mileage: 45, tank: 5.3, price: 95000 },
  { name: "TVS Apache RTR 160", mileage: 45, tank: 12, price: 125000 },
  { name: "TVS Raider 125", mileage: 55, tank: 10, price: 100000 },
  { name: "TVS Jupiter", mileage: 48, tank: 5.1, price: 85000 },
  { name: "Bajaj Pulsar 150", mileage: 45, tank: 15, price: 115000 },
  { name: "Bajaj Pulsar NS200", mileage: 35, tank: 12, price: 160000 },
  { name: "Yamaha R15", mileage: 45, tank: 11, price: 190000 },
  { name: "Yamaha MT-15", mileage: 45, tank: 10, price: 170000 },
  { name: "Suzuki Access 125", mileage: 45, tank: 5.3, price: 90000 },
  { name: "Hero Splendor Plus", mileage: 60, tank: 9.8, price: 80000 },
];

const money = (value: number) =>
  "₹" + value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = old;
    }
  }

  return row[b.length];
}

function getBikeSuggestions(query: string, bikes: Bike[]): Bike[] {
  const q = normalize(query);
  if (!q) return bikes.slice(0, 10);

  const directMatches = bikes.filter((bike) =>
    normalize(bike.name).includes(q)
  );
  if (directMatches.length) return directMatches.slice(0, 10);

  const queryWords = q.split(" ").filter(Boolean);
  if (!queryWords.length) return [];

  const ranked: Array<{ bike: Bike; score: number }> = [];

  for (const bike of bikes) {
    const bikeWords = normalize(bike.name).split(" ").filter(Boolean);
    let totalScore = 0;
    let allWordsMatched = true;

    for (const queryWord of queryWords) {
      let bestScore = Infinity;

      for (const bikeWord of bikeWords) {
        if (bikeWord === queryWord || bikeWord.startsWith(queryWord)) {
          bestScore = 0;
          break;
        }

        if (queryWord.length <= 3) continue;

        const distance = editDistance(queryWord, bikeWord);
        const allowedDistance = queryWord.length >= 5 ? 2 : 1;

        if (distance <= allowedDistance && distance < bestScore) {
          bestScore = distance;
        }
      }

      if (!Number.isFinite(bestScore)) {
        allWordsMatched = false;
        break;
      }

      totalScore += bestScore;
    }

    if (allWordsMatched) ranked.push({ bike, score: totalScore });
  }

  return ranked
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .map((item) => item.bike);
}

function specifications(value?: number, unit = "") {
  return value == null ? "Not available" : `${value}${unit}`;
}

/* -------------------------------------------------------
   BIKE PHOTO GALLERY
   Wikimedia Commons + Wikipedia image search.
   Multiple images are displayed when available.
------------------------------------------------------- */

type Photo = {
  url: string;
  page: string;
  credit: string;
  license: string;
  title: string;
};

type CommonsPage = {
  title: string;
  imageinfo?: Array<{
    thumburl?: string;
    url?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

function BikePhoto({ name }: { name: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const clean = (value?: string) =>
      (value ?? "")
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#160;/g, " ")
        .trim();

    const ignoredWords = new Set([
      "royal", "enfield", "honda", "tvs", "bajaj",
      "yamaha", "suzuki", "hero", "motorcycle",
      "motorcycles", "motorbike", "bike", "india",
      "the", "and",
    ]);

    const modelWords = normalize(name)
      .split(" ")
      .filter((word) => word.length > 1 && !ignoredWords.has(word));

    async function loadPhotos() {
      setLoading(true);
      setPhotos([]);
      setSelected(0);

      const found = new Map<string, Photo>();

      try {
        // Source 1: Wikimedia Commons.
        // Try different search terms to improve photo discovery.
        const queries = [
          `"${name}" motorcycle`,
          `"${name}"`,
          `${name} bike`,
          `${name} side view`,
        ];

        for (const query of queries) {
          if (cancelled || found.size >= 8) break;

          const params = new URLSearchParams({
            action: "query",
            generator: "search",
            gsrsearch: `filetype:bitmap ${query}`,
            gsrnamespace: "6",
            gsrlimit: "40",
            prop: "imageinfo",
            iiprop: "url|extmetadata",
            iiextmetadatafilter: "Artist|Credit|LicenseShortName",
            iiurlwidth: "1000",
            format: "json",
            origin: "*",
          });

          try {
            const response = await fetch(
              `https://commons.wikimedia.org/w/api.php?${params}`,
              { signal: controller.signal }
            );

            if (!response.ok) continue;

            const data = await response.json();
            const pages = Object.values(
              data.query?.pages ?? {}
            ) as CommonsPage[];

            const ranked = pages
              .map((page) => {
                const title = normalize(page.title);
                const titleWords = title.split(" ");
                const matched = modelWords.filter((word) =>
                  titleWords.includes(word)
                ).length;

                const exactPhrase = title.includes(normalize(name));
                const info = page.imageinfo?.[0];
                const url = info?.thumburl ?? info?.url;

                return {
                  page,
                  matched,
                  exactPhrase,
                  url,
                };
              })
              .filter((item) => {
                if (!item.url || modelWords.length === 0) return false;

                // Require meaningful model-name overlap.
                const requiredMatches = Math.max(
                  1,
                  Math.ceil(modelWords.length * 0.6)
                );

                return (
                  item.exactPhrase ||
                  item.matched >= requiredMatches
                );
              })
              .sort((a, b) => {
                if (a.exactPhrase !== b.exactPhrase) {
                  return a.exactPhrase ? -1 : 1;
                }
                return b.matched - a.matched;
              });

            for (const item of ranked) {
              const info = item.page.imageinfo?.[0];
              if (!info) continue;

              const url = info.thumburl ?? info.url;
              if (!url || found.has(url)) continue;

              const metadata = info.extmetadata ?? {};

              found.set(url, {
                url,
                page:
                  info.descriptionurl ??
                  "https://commons.wikimedia.org/",
                credit: clean(
                  metadata.Artist?.value ?? metadata.Credit?.value
                ),
                license: clean(metadata.LicenseShortName?.value),
                title: item.page.title,
              });

              if (found.size >= 8) break;
            }
          } catch (error) {
            if (
              error instanceof Error &&
              error.name === "AbortError"
            ) {
              return;
            }
          }
        }

        // Source 2: Wikipedia article images.
        // Search even when Commons has results, so both sources can
        // contribute when the Wikipedia image is relevant.
        if (!cancelled && found.size < 8) {
          const params = new URLSearchParams({
            action: "query",
            generator: "search",
            gsrsearch: name,
            gsrnamespace: "0",
            gsrlimit: "15",
            prop: "pageimages|info",
            piprop: "thumbnail",
            pithumbsize: "1000",
            inprop: "url",
            format: "json",
            origin: "*",
          });

          try {
            const response = await fetch(
              `https://en.wikipedia.org/w/api.php?${params}`,
              { signal: controller.signal }
            );

            if (response.ok) {
              const data = await response.json();

              const pages = Object.values(
                data.query?.pages ?? {}
              ) as Array<{
                title: string;
                thumbnail?: { source?: string };
                fullurl?: string;
              }>;

              const ranked = pages
                .map((page) => {
                  const titleWords = normalize(page.title).split(" ");
                  const matched = modelWords.filter((word) =>
                    titleWords.includes(word)
                  ).length;

                  return { page, matched };
                })
                .filter(({ page, matched }) => {
                  if (!page.thumbnail?.source) return false;

                  const requiredMatches = Math.max(
                    1,
                    Math.ceil(modelWords.length * 0.6)
                  );

                  return matched >= requiredMatches;
                })
                .sort((a, b) => b.matched - a.matched);

              for (const item of ranked) {
                const page = item.page;
                const url = page.thumbnail?.source;
                if (!url || found.has(url)) continue;

                found.set(url, {
                  url,
                  page:
                    page.fullurl ??
                    "https://en.wikipedia.org/",
                  credit: "Wikipedia article image",
                  license: "Check source page for reuse terms",
                  title: page.title,
                });

                if (found.size >= 8) break;
              }
            }
          } catch (error) {
            if (
              error instanceof Error &&
              error.name === "AbortError"
            ) {
              return;
            }
          }
        }

        if (!cancelled) {
          setPhotos(Array.from(found.values()));
          setSelected(0);
        }
      } catch (error) {
        if (
          !(error instanceof Error && error.name === "AbortError")
        ) {
          console.error("Bike photo search error:", error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPhotos();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [name]);

  const current = photos[selected];

  const removeBrokenPhoto = (url: string) => {
    setPhotos((old) => {
      const updated = old.filter((photo) => photo.url !== url);
      setSelected((index) => Math.min(index, Math.max(0, updated.length - 1)));
      return updated;
    });
  };

  return (
    <div className="bike-photo">
      {current ? (
        <>
          <a
            href={current.page}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open source for ${name} photo`}
          >
            <img
              src={current.url}
              alt={`${name} - ${current.title}`}
              loading="lazy"
              onError={() => removeBrokenPhoto(current.url)}
              style={{
                display: "block",
                width: "100%",
                maxHeight: "360px",
                objectFit: "contain",
                borderRadius: "12px",
              }}
            />
          </a>

          {photos.length > 1 && (
            <div
              className="bike-photo-gallery"
              aria-label={`${name} photo gallery`}
              style={{
                display: "flex",
                gap: "8px",
                overflowX: "auto",
                padding: "10px 0",
              }}
            >
              {photos.map((photo, index) => (
                <button
                  type="button"
                  key={photo.url}
                  onClick={() => setSelected(index)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-pressed={selected === index}
                  style={{
                    flex: "0 0 76px",
                    padding: "3px",
                    borderRadius: "8px",
                    border:
                      selected === index
                        ? "2px solid #2563eb"
                        : "1px solid #cbd5e1",
                    background: "transparent",
                  }}
                >
                  <img
                    src={photo.url}
                    alt={`${name} thumbnail ${index + 1}`}
                    loading="lazy"
                    onError={() => removeBrokenPhoto(photo.url)}
                    style={{
                      display: "block",
                      width: "68px",
                      height: "56px",
                      objectFit: "cover",
                      borderRadius: "5px",
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          <a
            className="photo-credit"
            href={current.page}
            target="_blank"
            rel="noreferrer"
          >
            {current.credit || "View photo source"}
            {current.license ? ` · ${current.license}` : ""}
          </a>

          <small className="muted">
            Photo {selected + 1} of {photos.length}
          </small>
        </>
      ) : (
        <div className="bike-photo-placeholder">
          <span>🏍️</span>
          <small>
            {loading ? "Searching photo sources..." : "No matching photo found"}
          </small>

          {!loading && (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <a
                href={`https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=${encodeURIComponent(name + " motorcycle")}`}
                target="_blank"
                rel="noreferrer"
              >
                Search Wikimedia photos
              </a>
              <a
                href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`}
                target="_blank"
                rel="noreferrer"
              >
                Search Wikipedia
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   MAIN APP
------------------------------------------------------- */

function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("bike-app-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });

  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem("bike-app-theme", theme);
    } catch {
      // Theme still works during this session if storage is unavailable.
    }
  }, [theme]);

  const [bikes, setBikes] = useState<Bike[]>(sampleBikes);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbMessage, setDbMessage] = useState("Loading bike catalogue...");

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [search, setSearch] = useState("");
  const [first, setFirst] = useState(sampleBikes[0].name);
  const [second, setSecond] = useState(sampleBikes[1].name);
  const [petrol, setPetrol] = useState("106");
  const [dailyKm, setDailyKm] = useState("30");
  const [days, setDays] = useState("30");
  const [tab, setTab] = useState("search");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Load online bike-name catalogue.
  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalogue() {
      try {
        const response = await fetch(
          "https://cdn.jsdelivr.net/gh/vehiclesdb/vehiclesdb@latest/dist/vehicles.json",
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error("Catalogue request failed");

        const data = (await response.json()) as {
          makes?: Array<{
            name?: string;
            models?: Array<{ name?: string; kind?: string }>;
          }>;
        };

        const unique = new Map<string, Bike>();
        sampleBikes.forEach((bike) =>
          unique.set(normalize(bike.name), bike)
        );

        for (const make of data.makes ?? []) {
          for (const model of make.models ?? []) {
            if (
              !model.name ||
              !["motorcycle", "moped"].includes(model.kind ?? "")
            ) {
              continue;
            }

            const makeName = make.name?.trim() ?? "";
            const modelName = model.name.trim();

            const name =
              makeName &&
              normalize(modelName).startsWith(normalize(makeName))
                ? modelName
                : makeName
                  ? `${makeName} ${modelName}`
                  : modelName;

            const key = normalize(name);
            if (!unique.has(key)) unique.set(key, { name });
          }
        }

        if (!controller.signal.aborted) {
          const catalogue = Array.from(unique.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          );

          setBikes(catalogue);
          setDbMessage(
            `${catalogue.length.toLocaleString("en-IN")} bike and moped names loaded.`
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Bike database error:", error);
          setDbMessage(
            "Online catalogue load aayilla. Sample bikes available aanu."
          );
        }
      } finally {
        if (!controller.signal.aborted) setDbLoading(false);
      }
    }

    void loadCatalogue();
    return () => controller.abort();
  }, []);

  // Firebase authentication status.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
      },
      (error) => {
        console.error("Authentication state error:", error);
        setMessage("Login status load cheyyaan pattiyilla.");
        setAuthLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const handleAuth = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setMessage("Emailum passwordum enter cheyyu.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password minimum 6 characters venam.");
      return;
    }

    setSending(true);
    setMessage("");

    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
        setMessage("Account create cheythu! ❤️");
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        setMessage("Login successful!");
      }
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";

      const errors: Record<string, string> = {
        "auth/email-already-in-use":
          "Ee email-inu account already undu. Login cheyyu.",
        "auth/invalid-email": "Valid email address enter cheyyu.",
        "auth/weak-password": "Password minimum 6 characters venam.",
        "auth/invalid-credential":
          "Email allenkil password correct alla.",
        "auth/wrong-password":
          "Email allenkil password correct alla.",
        "auth/user-not-found":
          "Email allenkil password correct alla.",
        "auth/too-many-requests":
          "Kurachu kazhinju veendum try cheyyu.",
        "auth/network-request-failed":
          "Internet connection check cheyyu.",
        "auth/operation-not-allowed":
          "Firebase-il Email/Password sign-in enable cheyyanam.",
      };

      setMessage(
        errors[code] ??
          "Authentication failed. Firebase settings check cheyyu."
      );
    } finally {
      setSending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPassword("");
      setEmail("");
      setAuthMode("login");
      setMessage("Logout successful.");
    } catch (error) {
      console.error(error);
      setMessage("Logout cheyyaan pattiyilla. Veendum try cheyyu.");
    }
  };

  const bikeA = bikes.find((bike) => bike.name === first) ?? bikes[0];
  const bikeB =
    bikes.find((bike) => bike.name === second) ?? bikes[1] ?? bikes[0];

  const suggestions = useMemo(
    () => getBikeSuggestions(search, bikes),
    [bikes, search]
  );

  const price = Math.max(0, Number(petrol) || 0);
  const km = Math.max(0, Number(dailyKm) || 0);
  const numberOfDays = Math.max(0, Number(days) || 0);
  const totalKm = km * numberOfDays;

  const costFor = (bike: Bike): number | null =>
    bike.mileage != null && bike.mileage > 0
      ? (totalKm / bike.mileage) * price
      : null;

  const SettingsButton = () => (
    <section className="settings-panel">
      <button
        className="secondary settings-button"
        type="button"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((open) => !open)}
      >
        ⚙️ Settings
        <span>{settingsOpen ? " ▲" : " ▼"}</span>
      </button>

      {settingsOpen && (
        <div className="settings-content">
          <h3>Appearance</h3>
          <p className="muted">Choose your preferred app theme.</p>

          <div className="theme-options">
            <button
              type="button"
              className={
                theme === "light"
                  ? "theme-choice theme-selected"
                  : "theme-choice"
              }
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              ☀️ Light Mode {theme === "light" ? " ✓" : ""}
            </button>

            <button
              type="button"
              className={
                theme === "dark"
                  ? "theme-choice theme-selected"
                  : "theme-choice"
              }
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              🌙 Dark Mode {theme === "dark" ? " ✓" : ""}
            </button>
          </div>
        </div>
      )}
    </section>
  );

  if (authLoading) {
    return (
      <main className="app">
        <section className="panel">Loading...</section>
      </main>
    );
  }

  // Login / signup screen.
  if (!user) {
    return (
      <main className="app">
        <header>
          <div className="logo">🏍️</div>
          <div>
            <h1>Bike Cost Compare</h1>
            <p>Simple, smart bike comparison.</p>
          </div>
        </header>

        <SettingsButton />

        <section className="panel">
          <h2>
            🔐 {authMode === "login" ? "Welcome Back" : "Create Account"}
          </h2>

          <p>
            {authMode === "login"
              ? "Emailum passwordum use cheythu login cheyyu."
              : "Puthiya account create cheyyuka."}
          </p>

          <form onSubmit={handleAuth}>
            <label htmlFor="loginEmail">Email address</label>
            <input
              id="loginEmail"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="loginPassword">Password</label>
            <input
              id="loginPassword"
              type="password"
              autoComplete={
                authMode === "login"
                  ? "current-password"
                  : "new-password"
              }
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />

            <button
              className="primary"
              type="submit"
              disabled={sending}
            >
              {sending
                ? "Please wait..."
                : authMode === "login"
                  ? "Login"
                  : "Create Account"}
            </button>
          </form>

          <p className="muted">
            {authMode === "login"
              ? "Account illenkil Create Account select cheyyu."
              : "Account already undenkil Login select cheyyu."}
          </p>

          <button
            className="secondary"
            type="button"
            disabled={sending}
            onClick={() => {
              setAuthMode(authMode === "login" ? "signup" : "login");
              setMessage("");
            }}
          >
            {authMode === "login"
              ? "Create New Account"
              : "Already have an account? Login"}
          </button>

          {message && (
            <p role="status" className="muted">{message}</p>
          )}
        </section>

        <footer>Created by Nidhin ❤️</footer>
      </main>
    );
  }

  // Main app.
  return (
    <main className="app">
      <header>
        <div className="logo">🏍️</div>
        <div>
          <h1>Bike Cost Compare</h1>
          <p>Find your bike. Calculate your fuel cost.</p>
        </div>
      </header>

      <SettingsButton />

      <section className="account-panel">
        <details>
          <summary>👤 Account</summary>
          <p>
            Logged in as <strong>{user.email}</strong>
          </p>
          <button
            className="secondary"
            type="button"
            onClick={handleLogout}
          >
            Log out
          </button>
          {message && (
            <p role="status" className="muted">{message}</p>
          )}
        </details>
      </section>

      <nav className="nav">
        <button
          className={tab === "search" ? "nav-active" : ""}
          onClick={() => setTab("search")}
        >
          Bike Search
        </button>

        <button
          className={tab === "compare" ? "nav-active" : ""}
          onClick={() => setTab("compare")}
        >
          Bike Comparison
        </button>

        <button
          className={tab === "petrol" ? "nav-active" : ""}
          onClick={() => setTab("petrol")}
        >
          Petrol Comparison
        </button>
      </nav>

      {tab === "search" && (
        <>
          <section className="panel">
            <h2>🔎 Find a bike</h2>

            <p className="muted">
              {dbLoading
                ? "Loading online bike catalogue..."
                : dbMessage}
            </p>

            <label htmlFor="bikeSearch">Bike name</label>
            <input
              id="bikeSearch"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type bike name or spelling..."
              autoComplete="off"
              spellCheck={false}
            />

            <p className="muted">
              Tip: Bullet, Pulsar, Honda SP 125, or even a small spelling
              mistake try cheyyu.
            </p>

            <div className="suggestions">
              {suggestions.map((bike) => (
                <div className="suggestion-item" key={bike.name}>
                  <BikePhoto name={bike.name} />

                  <button
                    type="button"
                    className="suggestion"
                    onClick={() => {
                      setFirst(bike.name);
                      setSearch(bike.name);
                      setTab("compare");
                    }}
                  >
                    <span>{bike.name}</span>
                    <small>
                      {specifications(bike.mileage, " km/L")}
                    </small>
                  </button>
                </div>
              ))}

              {!suggestions.length && (
                <p className="muted">
                  Match kandethiyilla. Kurachu different spelling try cheyyu.
                </p>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>Selected bike</h2>
            <BikePhoto name={bikeA.name} />
            <h3>{bikeA.name}</h3>

            <div className="stats">
              <div>
                <span>Estimated mileage</span>
                <strong>{specifications(bikeA.mileage, " km/L")}</strong>
              </div>

              <div>
                <span>Fuel tank</span>
                <strong>{specifications(bikeA.tank, " L")}</strong>
              </div>

              <div>
                <span>Indicative price</span>
                <strong>
                  {bikeA.price == null
                    ? "Not available"
                    : `${money(bikeA.price)}*`}
                </strong>
              </div>
            </div>

            <p className="muted">
              *Existing 16-bike specifications are sample estimates,
              not verified current prices.
            </p>
          </section>
        </>
      )}

      {tab === "compare" && (
        <section className="panel">
          <h2>🏁 Bike comparison</h2>

          <label htmlFor="bikeA">First bike</label>
          <select
            id="bikeA"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          >
            {bikes.map((bike) => (
              <option key={bike.name} value={bike.name}>
                {bike.name}
              </option>
            ))}
          </select>

          <label htmlFor="bikeB">Second bike</label>
          <select
            id="bikeB"
            value={second}
            onChange={(e) => setSecond(e.target.value)}
          >
            {bikes.map((bike) => (
              <option key={bike.name} value={bike.name}>
                {bike.name}
              </option>
            ))}
          </select>

          <div className="compare-grid">
            {[bikeA, bikeB].map((bike, index) => (
              <div
                className="compare-card"
                key={`${bike.name}-${index}`}
              >
                <BikePhoto name={bike.name} />
                <h3>{bike.name}</h3>

                <p>
                  <span>Estimated mileage</span>
                  <strong>{specifications(bike.mileage, " km/L")}</strong>
                </p>

                <p>
                  <span>Fuel tank</span>
                  <strong>{specifications(bike.tank, " L")}</strong>
                </p>

                <p>
                  <span>Indicative price</span>
                  <strong>
                    {bike.price == null
                      ? "Not available"
                      : `${money(bike.price)}*`}
                  </strong>
                </p>

                <p>
                  <span>Fuel cost per km</span>
                  <strong>
                    {bike.mileage == null || bike.mileage <= 0
                      ? "Not available"
                      : money(price / bike.mileage)}
                  </strong>
                </p>
              </div>
            ))}
          </div>

          <p className="muted">
            Catalogue model names are not proof of current Indian
            availability. Confirm model year and dealer specifications.
          </p>
        </section>
      )}

      {tab === "petrol" && (
        <section className="panel">
          <h2>⛽ Petrol cost comparison</h2>

          <label htmlFor="petrol">Petrol price (₹/litre)</label>
          <input
            id="petrol"
            type="number"
            min="0"
            step="0.01"
            value={petrol}
            onChange={(e) => setPetrol(e.target.value)}
          />

          <p className="muted">
            Current petrol rate manually enter cheyyuka. Live feed alla.
          </p>

          <label htmlFor="dailyKm">Daily distance (km)</label>
          <input
            id="dailyKm"
            type="number"
            min="0"
            step="0.1"
            value={dailyKm}
            onChange={(e) => setDailyKm(e.target.value)}
          />

          <label htmlFor="days">Number of days</label>
          <input
            id="days"
            type="number"
            min="0"
            step="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />

          <div className="compare-grid">
            {[bikeA, bikeB].map((bike, index) => {
              const cost = costFor(bike);

              return (
                <div
                  className="compare-card"
                  key={`${bike.name}-${index}`}
                >
                  <BikePhoto name={bike.name} />
                  <h3>{bike.name}</h3>

                  <p>
                    <span>Estimated total fuel cost</span>
                    <strong>
                      {cost == null ? "Not available" : money(cost)}
                    </strong>
                  </p>

                  <p>
                    <span>Estimated fuel required</span>
                    <strong>
                      {bike.mileage == null || bike.mileage <= 0
                        ? "Not available"
                        : `${(totalKm / bike.mileage).toFixed(2)} L`}
                    </strong>
                  </p>

                  <p>
                    <span>Daily cost</span>
                    <strong>
                      {bike.mileage == null || bike.mileage <= 0
                        ? "Not available"
                        : money((km / bike.mileage) * price)}
                    </strong>
                  </p>
                </div>
              );
            })}
          </div>

          <div className="result">
            <span>Estimated difference over {numberOfDays} days</span>

            <strong>
              {costFor(bikeA) == null || costFor(bikeB) == null
                ? "Not available"
                : money(Math.abs(costFor(bikeA)! - costFor(bikeB)!))}
            </strong>

            <p>
              {bikeA.mileage == null ||
              bikeB.mileage == null ||
              bikeA.mileage <= 0 ||
              bikeB.mileage <= 0
                ? "Accurate comparison-inu randu bikes-inte mileage data venam."
                : bikeA.mileage === bikeB.mileage
                  ? "Both bikes have the same listed mileage."
                  : `${bikeA.mileage > bikeB.mileage ? bikeA.name : bikeB.name} has the higher listed mileage.`}
            </p>
          </div>
        </section>
      )}

      <footer>
        Bike model catalogue:{" "}
        <a
          href="https://vehiclesdb.com"
          target="_blank"
          rel="noreferrer"
        >
          VehiclesDB
        </a>
        {" "}· CC BY 4.0.

        <p>
          Catalogue provides model names, not verified prices or specifications.
        </p>

        Photos load from Wikimedia Commons and Wikipedia when relevant
        images are available.

        <p>Created by Nidhin ❤️</p>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
