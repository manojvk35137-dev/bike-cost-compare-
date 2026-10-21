
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
  if (!q) return [];

  const direct = bikes.filter((bike) =>
    normalize(bike.name).includes(q)
  );

  if (direct.length) return direct.slice(0, 8);

  const queryWords = q.split(" ");
  const ranked: { bike: Bike; score: number }[] = [];

  for (const bike of bikes) {
    const bikeWords = normalize(bike.name).split(" ");
    let score = 0;
    let matchedAll = true;

    for (const word of queryWords) {
      let best = Infinity;

      for (const candidate of bikeWords) {
        if (candidate === word || candidate.startsWith(word)) {
          best = 0;
          break;
        }

        if (word.length < 4) continue;

        const distance = editDistance(word, candidate);
        const allowed = word.length >= 6 ? 2 : 1;

        if (distance <= allowed) best = Math.min(best, distance);
      }

      if (!Number.isFinite(best)) {
        matchedAll = false;
        break;
      }

      score += best;
    }

    if (matchedAll) ranked.push({ bike, score });
  }

  return ranked
    .sort((a, b) => a.score - b.score)
    .slice(0, 8)
    .map((item) => item.bike);
}

const specifications = (value?: number, unit = "") =>
  value == null ? "Not available" : `${value}${unit}`;

type Photo = {
  url: string;
  page: string;
  credit: string;
  license: string;
};

function BikePhoto({ name }: { name: string }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
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
        .trim();

    async function findPhoto() {
      setLoading(true);
      setPhoto(null);

      try {
        const params = new URLSearchParams({
          action: "query",
          generator: "search",
          gsrsearch: `filetype:bitmap "${name}"`,
          gsrnamespace: "6",
          gsrlimit: "25",
          prop: "imageinfo",
          iiprop: "url|extmetadata",
          iiextmetadatafilter: "Artist|Credit|LicenseShortName",
          iiurlwidth: "900",
          format: "json",
          origin: "*",
        });

        try {
          const response = await fetch(
            `https://commons.wikimedia.org/w/api.php?${params}`,
            { signal: controller.signal }
          );

          if (response.ok) {
            const data = await response.json();
            const pages = Object.values(
              data.query?.pages ?? {}
            ) as Array<{
              title: string;
              imageinfo?: Array<{
                thumburl?: string;
                url?: string;
                descriptionurl?: string;
                extmetadata?: Record<string, { value?: string }>;
              }>;
            }>;

            const wanted = normalize(name);
            const ignored = new Set([
              "royal", "enfield", "honda", "tvs", "bajaj",
              "yamaha", "suzuki", "hero", "motorcycle",
              "motorcycles", "bike", "india", "the", "and",
            ]);

            const words = wanted
              .split(" ")
              .filter((word) => word.length > 1 && !ignored.has(word));

            const candidates = pages
              .map((page) => {
                const title = normalize(page.title);
                const titleWords = title.split(" ");
                const matched = words.filter((word) =>
                  titleWords.includes(word)
                ).length;

                return {
                  page,
                  matched,
                  exact: title.includes(wanted),
                };
              })
              .filter(({ page, matched, exact }) => {
                const info = page.imageinfo?.[0];
                const url = info?.thumburl ?? info?.url;
                const required = Math.max(1, Math.ceil(words.length * 0.6));

                return Boolean(url) && (exact || matched >= required);
              })
              .sort((a, b) =>
                Number(b.exact) - Number(a.exact) ||
                b.matched - a.matched
              );

            const match = candidates[0]?.page;
            const info = match?.imageinfo?.[0];
            const url = info?.thumburl ?? info?.url;

            if (info && url && !cancelled) {
              setPhoto({
                url,
                page: info.descriptionurl ??
                  "https://commons.wikimedia.org/",
                credit: clean(
                  info.extmetadata?.Artist?.value ??
                  info.extmetadata?.Credit?.value
                ),
                license: clean(
                  info.extmetadata?.LicenseShortName?.value
                ),
              });
              return;
            }
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.name === "AbortError"
          ) return;
        }

        if (cancelled) return;

        const wikiParams = new URLSearchParams({
          action: "query",
          generator: "search",
          gsrsearch: name,
          gsrnamespace: "0",
          gsrlimit: "12",
          prop: "pageimages|info",
          piprop: "thumbnail",
          pithumbsize: "900",
          inprop: "url",
          format: "json",
          origin: "*",
        });

        const response = await fetch(
          `https://en.wikipedia.org/w/api.php?${wikiParams}`,
          { signal: controller.signal }
        );

        if (!response.ok) return;

        const data = await response.json();
        const pages = Object.values(
          data.query?.pages ?? {}
        ) as Array<{
          title: string;
          thumbnail?: { source?: string };
          fullurl?: string;
        }>;

        const words = normalize(name).split(" ").filter(Boolean);

        const candidates = pages
          .map((page) => {
            const titleWords = normalize(page.title).split(" ");
            const matched = words.filter((word) =>
              titleWords.includes(word)
            ).length;

            return { page, matched };
          })
          .filter(({ page, matched }) =>
            Boolean(page.thumbnail?.source) &&
            matched >= Math.max(1, Math.ceil(words.length * 0.6))
          )
          .sort((a, b) => b.matched - a.matched);

        const match = candidates[0]?.page;
        const url = match?.thumbnail?.source;

        if (match && url && !cancelled) {
          setPhoto({
            url,
            page: match.fullurl ?? "https://en.wikipedia.org/",
            credit: "Wikipedia image",
            license: "Check source page for reuse terms",
          });
        }
      } catch (error) {
        if (
          !(error instanceof Error && error.name === "AbortError")
        ) {
          console.error("Bike photo error:", error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void findPhoto();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [name]);

  return (
    <div className="bike-photo">
      {photo ? (
        <>
          <a
            href={photo.page}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open photo source for ${name}`}
          >
            <img
              className="bike-photo-image"
              src={photo.url}
              alt={name}
              loading="lazy"
              onError={() => setPhoto(null)}
            />
          </a>
          <small className="photo-credit">
            <a href={photo.page} target="_blank" rel="noreferrer">
              {photo.credit || "View photo source"}
              {photo.license ? ` · ${photo.license}` : ""}
            </a>
          </small>
        </>
      ) : (
        <div className="bike-photo-placeholder">
          <span className="bike-photo-icon">🏍️</span>
          <small>
            {loading ? "Finding bike photo..." : "Photo unavailable"}
          </small>
          {!loading && (
            <a
              href={`https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=${encodeURIComponent(name + " motorcycle")}`}
              target="_blank"
              rel="noreferrer"
            >
              Search photos
            </a>
          )}
        </div>
      )}
    </div>
  );
}

type BikeAutocompleteProps = {
  id: string;
  label: string;
  value: string;
  bikes: Bike[];
  onSelect: (name: string) => void;
};

function BikeAutocomplete({
  id,
  label,
  value,
  bikes,
  onSelect,
}: BikeAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const suggestions = useMemo(
    () => getBikeSuggestions(query, bikes),
    [query, bikes]
  );

  function chooseBike(bike: Bike) {
    setQuery(bike.name);
    onSelect(bike.name);
    setFocused(false);
  }

  return (
    <div className="autocomplete-field">
      <label htmlFor={id}>{label}</label>

      <input
        id={id}
        type="text"
        value={query}
        placeholder="Type bike name..."
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setFocused(false), 150);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setFocused(true);
          onSelect("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && suggestions.length > 0) {
            event.preventDefault();
            chooseBike(suggestions[0]);
          }

          if (event.key === "Escape") {
            setFocused(false);
          }
        }}
      />

      {focused && query.trim() && (
        <div className="suggestions autocomplete-suggestions">
          {suggestions.length > 0 ? (
            <>
              <p className="muted">Matching bikes — tap to select:</p>
              {suggestions.map((bike) => (
                <button
                  type="button"
                  className="suggestion"
                  key={bike.name}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseBike(bike)}
                >
                  <span>{bike.name}</span>
                  <small>{specifications(bike.mileage, " km/L")}</small>
                </button>
              ))}
            </>
          ) : (
            <p className="muted suggestion-empty">
              Matching bike illa. Spelling check cheyyu.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [searchMessage, setSearchMessage] = useState("");
  const [first, setFirst] = useState(sampleBikes[0].name);
  const [second, setSecond] = useState(sampleBikes[1].name);
  const [petrol, setPetrol] = useState("106");
  const [dailyKm, setDailyKm] = useState("30");
  const [days, setDays] = useState("30");
  const [tab, setTab] = useState("search");

  // Custom mileage overrides are shared between both comparison tabs.
  // An empty value means use the catalogue mileage.
  const [customMileage, setCustomMileage] = useState<Record<string, string>>(
    {}
  );

  function updateCustomMileage(bikeName: string, value: string) {
    setCustomMileage((current) => ({
      ...current,
      [bikeName]: value,
    }));
  }

  function resetCustomMileage(bikeName: string) {
    setCustomMileage((current) => ({
      ...current,
      [bikeName]: "",
    }));
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem("bike-app-theme", theme);
    } catch {
      // Theme remains available for the current session.
    }
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalogue() {
      try {
        const response = await fetch(
          "https://cdn.jsdelivr.net/gh/vehiclesdb/vehiclesdb@latest/dist/vehicles.json",
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error("Catalogue request failed");

        const data = await response.json() as {
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
            ) continue;

            const makeName = make.name?.trim() ?? "";
            const modelName = model.name.trim();

            const name =
              makeName &&
              normalize(modelName).startsWith(normalize(makeName))
                ? modelName
                : makeName
                  ? `${makeName} ${modelName}`
                  : modelName;

            if (name.trim() && !unique.has(normalize(name))) {
              unique.set(normalize(name), { name });
            }
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
          console.error("Bike catalogue error:", error);
          setDbMessage(
            "Online catalogue unavailable. Sample bikes are ready."
          );
        }
      } finally {
        if (!controller.signal.aborted) setDbLoading(false);
      }
    }

    void loadCatalogue();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
      },
      (error) => {
        console.error("Auth state error:", error);
        setMessage("Login status load cheyyaan pattiyilla.");
        setAuthLoading(false);
      }
    );
  }, []);

  const suggestions = useMemo(
    () => getBikeSuggestions(search, bikes),
    [search, bikes]
  );

  const bikeA = bikes.find((bike) => bike.name === first);
  const bikeB = bikes.find((bike) => bike.name === second);

  const price = Math.max(0, Number(petrol) || 0);
  const km = Math.max(0, Number(dailyKm) || 0);
  const numberOfDays = Math.max(0, Number(days) || 0);
  const totalKm = km * numberOfDays;

  // Custom mileage overrides catalogue mileage when valid.
  // Clearing the field returns to the original catalogue value.
  function effectiveMileage(bike: Bike | undefined): number | null {
    if (!bike) return null;

    const customValue = customMileage[bike.name] ?? "";

    if (customValue.trim() !== "") {
      const entered = Number(customValue);

      return Number.isFinite(entered) && entered > 0 && entered <= 200
        ? entered
        : null;
    }

    return bike.mileage != null && bike.mileage > 0
      ? bike.mileage
      : null;
  }

  const mileageA = effectiveMileage(bikeA);
  const mileageB = effectiveMileage(bikeB);

  const costFor = (mileage: number | null): number | null =>
    mileage != null ? (totalKm / mileage) * price : null;

  const costA = costFor(mileageA);
  const costB = costFor(mileageB);

  function runSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const query = search.trim();

    if (!query) {
      setSearchMessage("Bike name type cheythu Search amarthu.");
      return;
    }

    const results = getBikeSuggestions(query, bikes);

    if (!results.length) {
      setSearchMessage(
        "Matching bike kandethiyilla. Spelling check cheythu veendum try cheyyu."
      );
      return;
    }

    const exact = bikes.find(
      (bike) => normalize(bike.name) === normalize(query)
    );
    const selected = exact ?? results[0];

    setFirst(selected.name);
    setSearch(selected.name);
    setSearchMessage(
      exact ? "Bike found." : `Closest match: ${selected.name}`
    );
  }

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
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
        "auth/email-already-in-use": "Ee email-inu account already undu. Login cheyyu.",
        "auth/invalid-email": "Valid email address enter cheyyu.",
        "auth/weak-password": "Password minimum 6 characters venam.",
        "auth/invalid-credential": "Email allenkil password correct alla.",
        "auth/wrong-password": "Email allenkil password correct alla.",
        "auth/user-not-found": "Email allenkil password correct alla.",
        "auth/too-many-requests": "Kurachu kazhinju veendum try cheyyu.",
        "auth/network-request-failed": "Internet connection check cheyyu.",
        "auth/operation-not-allowed": "Firebase-il Email/Password sign-in enable cheyyanam.",
      };

      setMessage(
        errors[code] ??
          "Authentication failed. Firebase settings check cheyyu."
      );
    } finally {
      setSending(false);
    }
  }

  async function handleLogout() {
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
  }

  function SettingsButton() {
    return (
      <section className="settings-panel">
        <button
          className="secondary settings-button"
          type="button"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          ⚙️ Settings <span>{settingsOpen ? "▲" : "▼"}</span>
        </button>

        {settingsOpen && (
          <div className="settings-content">
            <h3>Appearance</h3>
            <div className="theme-options">
              <button
                type="button"
                className={
                  theme === "light"
                    ? "theme-choice theme-selected"
                    : "theme-choice"
                }
                onClick={() => setTheme("light")}
              >
                ☀️ Light Mode
              </button>
              <button
                type="button"
                className={
                  theme === "dark"
                    ? "theme-choice theme-selected"
                    : "theme-choice"
                }
                onClick={() => setTheme("dark")}
              >
                🌙 Dark Mode
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (authLoading) {
    return (
      <main className="app">
        <section className="panel">Loading...</section>
      </main>
    );
  }

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
                authMode === "login" ? "current-password" : "new-password"
              }
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />

            <button className="primary" type="submit" disabled={sending}>
              {sending
                ? "Please wait..."
                : authMode === "login"
                  ? "Login"
                  : "Create Account"}
            </button>
          </form>

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
          <p>Logged in as <strong>{user.email}</strong></p>
          <button className="secondary" type="button" onClick={handleLogout}>
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

            <form onSubmit={runSearch}>
              <label htmlFor="bikeSearch">Bike name</label>
              <input
                id="bikeSearch"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchMessage("");
                }}
                placeholder="Type bike name, e.g. Honda SP 125"
                autoComplete="off"
                spellCheck={false}
              />

              <button className="primary" type="submit">
                🔍 Search bike
              </button>
            </form>

            <p className="muted">
              Enter key അമർത്തിയും search ചെയ്യാം. Suggestions optional ആണ്.
            </p>

            {searchMessage && (
              <p role="status" className="muted">{searchMessage}</p>
            )}

            {search.trim() && suggestions.length > 0 && (
              <div className="suggestions">
                <p className="muted">Suggestions — tap to select:</p>
                {suggestions.map((bike) => (
                  <button
                    type="button"
                    className="suggestion"
                    key={bike.name}
                    onClick={() => {
                      setFirst(bike.name);
                      setSearch(bike.name);
                      setSearchMessage("Bike selected.");
                    }}
                  >
                    <span>{bike.name}</span>
                    <small>{specifications(bike.mileage, " km/L")}</small>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Selected bike</h2>
            {bikeA ? (
              <>
                <BikePhoto name={bikeA.name} />
                <h3>{bikeA.name}</h3>

                <div className="stats">
                  <div>
                    <span>Original estimated mileage</span>
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

                <button
                  className="secondary"
                  type="button"
                  onClick={() => setTab("compare")}
                >
                  Compare this bike
                </button>
                <p className="muted">
                  *Sample estimates only; not verified current dealer prices.
                </p>
              </>
            ) : (
              <p className="muted">Select a bike to see its details.</p>
            )}
          </section>
        </>
      )}

      {(tab === "compare" || tab === "petrol") && (
        <section className="panel">
          <h2>
            {tab === "compare" ? "🏁 Bike comparison" : "⛽ Petrol cost comparison"}
          </h2>

          <p className="muted">
            Bike name type cheythu suggestions-il ninnu select cheyyu.
            Mileage edit cheythaal randu comparison tabs-ilum update aakum.
          </p>

          <BikeAutocomplete
            id="bikeA"
            label="First bike"
            value={first}
            bikes={bikes}
            onSelect={setFirst}
          />

          <BikeAutocomplete
            id="bikeB"
            label="Second bike"
            value={second}
            bikes={bikes}
            onSelect={setSecond}
          />

          {tab === "petrol" && (
            <>
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
                Petrol price manually enter cheyyuka. This is not a live rate feed.
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

              <div className="result">
                <span>Total travel distance</span>
                <strong>{totalKm.toLocaleString("en-IN")} km</strong>
              </div>
            </>
          )}

          <div className="compare-grid">
            {[
              { bike: bikeA, mileage: mileageA, cost: costA, label: "First bike" },
              { bike: bikeB, mileage: mileageB, cost: costB, label: "Second bike" },
            ].map((item) => {
              const { bike, mileage, cost, label } = item;
              if (!bike) return null;

              const customValue = customMileage[bike.name] ?? "";
              const isCustom = customValue.trim() !== "";

              return (
                <div className="compare-card" key={label}>
                  <BikePhoto name={bike.name} />
                  <h3>{bike.name}</h3>

                  <p>
                    <span>Original database mileage</span>
                    <strong>{specifications(bike.mileage, " km/L")}</strong>
                  </p>

                  <div className="manual-mileage">
                    <label htmlFor={`mileage-${label}`}>
                      ✏️ Your mileage (km/L)
                    </label>
                    <input
                      id={`mileage-${label}`}
                      type="number"
                      min="0.1"
                      max="200"
                      step="0.1"
                      inputMode="decimal"
                      placeholder={
                        bike.mileage != null
                          ? `Default: ${bike.mileage} km/L`
                          : "Enter mileage, e.g. 35"
                      }
                      value={customValue}
                      onChange={(e) =>
                        updateCustomMileage(bike.name, e.target.value)
                      }
                    />

                    <small className="muted">
                      {isCustom
                        ? "Custom mileage active."
                        : "Using original database mileage."}
                    </small>

                    {isCustom && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => resetCustomMileage(bike.name)}
                      >
                        ↩ Reset to original mileage
                      </button>
                    )}
                  </div>

                  <p>
                    <span>Used mileage</span>
                    <strong>
                      {mileage == null ? "Enter a valid mileage" : `${mileage} km/L`}
                    </strong>
                  </p>

                  {tab === "compare" ? (
                    <>
                      <p>
                        <span>Fuel cost per km</span>
                        <strong>
                          {mileage == null
                            ? "Not available"
                            : money(price / mileage)}
                        </strong>
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
                    </>
                  ) : (
                    <>
                      <p>
                        <span>Estimated fuel required</span>
                        <strong>
                          {mileage == null
                            ? "Not available"
                            : `${(totalKm / mileage).toFixed(2)} L`}
                        </strong>
                      </p>
                      <p>
                        <span>Estimated total fuel cost</span>
                        <strong>{cost == null ? "Not available" : money(cost)}</strong>
                      </p>
                      <p>
                        <span>Daily fuel cost</span>
                        <strong>
                          {mileage == null
                            ? "Not available"
                            : money((km / mileage) * price)}
                        </strong>
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {tab === "compare" && bikeA && bikeB && (
            <div className="result">
              <span>Comparison summary</span>
              <p>
                {bikeA.name === bikeB.name
                  ? "Randilum same bike aanu select cheythirikkunnath."
                  : mileageA == null || mileageB == null
                    ? "Valid mileage values enter cheyyu."
                    : mileageA === mileageB
                      ? "Randinum same mileage value aanu."
                      : `${mileageA > mileageB ? bikeA.name : bikeB.name} has the higher mileage value.`}
              </p>
            </div>
          )}

          {tab === "petrol" && (
            <div className="result">
              <span>Estimated fuel-cost difference over {numberOfDays} days</span>
              <strong>
                {costA == null || costB == null
                  ? "Enter valid mileage for both bikes"
                  : money(Math.abs(costA - costB))}
              </strong>

              <p>
                {mileageA == null || mileageB == null
                  ? "Comparison-inu randu bikes-inum valid mileage venam."
                  : mileageA === mileageB
                    ? "Both bikes have the same mileage value."
                    : `${mileageA > mileageB ? bikeA?.name : bikeB?.name} has the higher mileage value entered.`}
              </p>
            </div>
          )}

          <p className="muted">
            Database values are estimates, not guaranteed real-world mileage.
            Custom mileage is used in both comparison tabs. Values reset if the
            app is refreshed because custom mileage is currently session-only.
          </p>
        </section>
      )}

      <footer>
        Bike model catalogue:{" "}
        <a href="https://vehiclesdb.com" target="_blank" rel="noreferrer">
          VehiclesDB
        </a>.
        <p>Catalogue model names are not verified prices or specifications.</p>
        <p>Photos are sourced from Wikimedia Commons or Wikipedia when available.</p>
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
