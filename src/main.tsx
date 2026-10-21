
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import "./style.css";

type Bike = {
  name: string;
  mileage: number;
  tank: number;
  price: number;
};

const bikes: Bike[] = [
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

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [search, setSearch] = useState("");
  const [first, setFirst] = useState(bikes[0].name);
  const [second, setSecond] = useState(bikes[1].name);
  const [petrol, setPetrol] = useState("106");
  const [dailyKm, setDailyKm] = useState("30");
  const [days, setDays] = useState("30");
  const [tab, setTab] = useState("search");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    async function finishEmailLogin() {
      if (!isSignInWithEmailLink(auth, window.location.href)) return;

      let savedEmail = window.localStorage.getItem("bikeLoginEmail");

      if (!savedEmail) {
        savedEmail = window.prompt(
          "Enter the email address where you received the sign-in link:"
        );
      }

      if (!savedEmail) {
        setMessage("Login complete cheyyaan email address venam.");
        return;
      }

      try {
        await signInWithEmailLink(
          auth,
          savedEmail.trim(),
          window.location.href
        );
        window.localStorage.removeItem("bikeLoginEmail");
        window.history.replaceState({}, document.title, window.location.pathname);
        setMessage("Login successful!");
      } catch {
        setMessage(
          "Login link invalid or expired. App-il puthiya sign-in link request cheyyu."
        );
      }
    }

    void finishEmailLogin();
  }, []);

  const sendLoginLink = async () => {
    const cleanEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setMessage("Valid email address enter cheyyu.");
      return;
    }

    setSending(true);
    setMessage("");

    try {
      await sendSignInLinkToEmail(auth, cleanEmail, {
        url: window.location.origin + window.location.pathname,
        handleCodeInApp: true,
      });

      window.localStorage.setItem("bikeLoginEmail", cleanEmail);
      setMessage("Email-il sign-in link ayachittundu. Inbox check cheyyu!");
    } catch (error) {
      console.error(error);
      setMessage(
        "Link send aayilla. Firebase Email link settingsum Authorized domainsum check cheyyu."
      );
    } finally {
      setSending(false);
    }
  };

  const bikeA = bikes.find((b) => b.name === first) ?? bikes[0];
  const bikeB = bikes.find((b) => b.name === second) ?? bikes[1];

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bikes
      .filter((bike) => !q || bike.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [search]);

  const price = Math.max(0, Number(petrol) || 0);
  const km = Math.max(0, Number(dailyKm) || 0);
  const numberOfDays = Math.max(0, Number(days) || 0);
  const totalKm = km * numberOfDays;

  const costFor = (bike: Bike) =>
    bike.mileage > 0 ? (totalKm / bike.mileage) * price : 0;

  if (authLoading) {
    return <main className="app"><section className="panel">Loading...</section></main>;
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

        <section className="panel">
          <h2>🔐 Passwordless login</h2>
          <p>Enter your email. We will send you a secure sign-in link.</p>
          <label htmlFor="loginEmail">Email address</label>
          <input
            id="loginEmail"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="primary" onClick={sendLoginLink} disabled={sending}>
            {sending ? "Sending..." : "Send sign-in link"}
          </button>
          {message && <p role="status" className="muted">{message}</p>}
          <p className="muted">
            Check your inbox and spam folder. Open the link in the same app or
            browser where you started login.
          </p>
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

      <section className="panel">
        <p>Logged in as <strong>{user.email}</strong></p>
        <button className="secondary" onClick={() => signOut(auth)}>
          Log out
        </button>
      </section>

      <nav className="nav">
        <button className={tab === "search" ? "nav-active" : ""} onClick={() => setTab("search")}>Bike search</button>
        <button className={tab === "compare" ? "nav-active" : ""} onClick={() => setTab("compare")}>Bike comparison</button>
        <button className={tab === "petrol" ? "nav-active" : ""} onClick={() => setTab("petrol")}>Petrol comparison</button>
      </nav>

      {tab === "search" && (
        <>
          <section className="panel">
            <h2>🔎 Find a bike</h2>
            <label htmlFor="bikeSearch">Bike name</label>
            <input
              id="bikeSearch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type e.g. Bullet 350"
              autoComplete="off"
            />
            <div className="suggestions">
              {suggestions.map((bike) => (
                <button
                  className="suggestion"
                  key={bike.name}
                  onClick={() => {
                    setFirst(bike.name);
                    setSearch(bike.name);
                    setTab("compare");
                  }}
                >
                  <span>{bike.name}</span>
                  <small>{bike.mileage} km/L*</small>
                </button>
              ))}
              {suggestions.length === 0 && (
                <p className="muted">
                  No match in the current sample list. Try a shorter spelling.
                </p>
              )}
            </div>
          </section>
          <section className="panel">
            <h2>Selected bike</h2>
            <h3>{bikeA.name}</h3>
            <div className="stats">
              <div><span>Estimated mileage</span><strong>{bikeA.mileage} km/L*</strong></div>
              <div><span>Fuel tank</span><strong>{bikeA.tank} L*</strong></div>
              <div><span>Indicative price</span><strong>{money(bikeA.price)}*</strong></div>
            </div>
            <p className="muted">*Sample estimates, not verified current specifications or on-road prices.</p>
          </section>
        </>
      )}

      {tab === "compare" && (
        <section className="panel">
          <h2>🏁 Bike comparison</h2>
          <label htmlFor="bikeA">First bike</label>
          <select id="bikeA" value={first} onChange={(e) => setFirst(e.target.value)}>
            {bikes.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>

          <label htmlFor="bikeB">Second bike</label>
          <select id="bikeB" value={second} onChange={(e) => setSecond(e.target.value)}>
            {bikes.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>

          <div className="compare-grid">
            {[bikeA, bikeB].map((bike) => (
              <div className="compare-card" key={bike.name}>
                <h3>{bike.name}</h3>
                <p><span>Estimated mileage</span><strong>{bike.mileage} km/L*</strong></p>
                <p><span>Fuel tank</span><strong>{bike.tank} L*</strong></p>
                <p><span>Indicative price</span><strong>{money(bike.price)}*</strong></p>
                <p><span>Cost per km</span><strong>{money(price / bike.mileage)}</strong></p>
              </div>
            ))}
          </div>
          <p className="muted">*Approximate sample data. Confirm model year and local dealer prices.</p>
        </section>
      )}

      {tab === "petrol" && (
        <section className="panel">
          <h2>⛽ Petrol cost comparison</h2>
          <label htmlFor="petrol">Petrol price (₹/litre)</label>
          <input id="petrol" type="number" min="0" step="0.01" value={petrol} onChange={(e) => setPetrol(e.target.value)} />
          <p className="muted">Enter the current rate yourself. This is not a live petrol-price feed.</p>

          <label htmlFor="dailyKm">Daily distance (km)</label>
          <input id="dailyKm" type="number" min="0" value={dailyKm} onChange={(e) => setDailyKm(e.target.value)} />

          <label htmlFor="days">Number of days</label>
          <input id="days" type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} />

          <div className="compare-grid">
            {[bikeA, bikeB].map((bike) => (
              <div className="compare-card" key={bike.name}>
                <h3>{bike.name}</h3>
                <p><span>Estimated total fuel cost</span><strong>{money(costFor(bike))}</strong></p>
                <p><span>Estimated fuel required</span><strong>{(totalKm / bike.mileage).toFixed(2)} L</strong></p>
                <p><span>Daily cost</span><strong>{money((km / bike.mileage) * price)}</strong></p>
              </div>
            ))}
          </div>

          <div className="result">
            <span>Estimated savings over {numberOfDays} days</span>
            <strong>{money(Math.abs(costFor(bikeA) - costFor(bikeB)))}</strong>
            <p>{bikeA.mileage >= bikeB.mileage ? bikeA.name : bikeB.name} has the higher listed sample mileage.</p>
          </div>
        </section>
      )}

      <footer>
        Bike data in this version is a small sample list, not an online API.
        Fuel costs are estimates. Created by Nidhin ❤️
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
