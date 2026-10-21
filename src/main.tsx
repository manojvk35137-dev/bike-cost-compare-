
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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

function App() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Bike | null>(bikes[0]);
  const [petrol, setPetrol] = useState("106");
  const [dailyKm, setDailyKm] = useState("30");
  const [days, setDays] = useState("30");
  const [customMileage, setCustomMileage] = useState("");

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bikes.slice(0, 8);
    return bikes
      .filter((b) => b.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search]);

  const price = Math.max(0, Number(petrol) || 0);
  const km = Math.max(0, Number(dailyKm) || 0);
  const numberOfDays = Math.max(0, Number(days) || 0);
  const mileage = Math.max(
    0,
    Number(customMileage) || selected?.mileage || 0
  );
  const litres = mileage > 0 ? (km * numberOfDays) / mileage : 0;
  const totalCost = litres * price;

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
              className={
                selected?.name === bike.name ? "suggestion active" : "suggestion"
              }
              key={bike.name}
              onClick={() => {
                setSelected(bike);
                setSearch(bike.name);
                setCustomMileage("");
              }}
            >
              <span>{bike.name}</span>
              <small>{bike.mileage} km/L*</small>
            </button>
          ))}
          {suggestions.length === 0 && (
            <p className="muted">
              No exact match. Check the spelling or try a shorter name.
              This starter version has a limited bike list.
            </p>
          )}
        </div>
      </section>

      {selected && (
        <section className="panel">
          <h2>🏁 Selected bike</h2>
          <h3>{selected.name}</h3>
          <div className="stats">
            <div><span>Estimated mileage</span><strong>{selected.mileage} km/L*</strong></div>
            <div><span>Fuel tank</span><strong>{selected.tank} L*</strong></div>
            <div><span>Indicative price</span><strong>₹{selected.price.toLocaleString("en-IN")}*</strong></div>
          </div>
          <p className="muted">
            *Approximate sample values, not verified current specifications or
            on-road prices. Real mileage and price vary by model, year and location.
          </p>
        </section>
      )}

      <section className="panel">
        <h2>⛽ Petrol cost calculator</h2>

        <label htmlFor="petrol">Petrol price (₹/litre)</label>
        <input
          id="petrol"
          type="number"
          min="0"
          step="0.01"
          value={petrol}
          onChange={(e) => setPetrol(e.target.value)}
        />

        <label htmlFor="mileage">Your bike mileage (km/litre)</label>
        <input
          id="mileage"
          type="number"
          min="0"
          step="0.1"
          value={customMileage || String(selected?.mileage ?? "")}
          onChange={(e) => setCustomMileage(e.target.value)}
        />

        <label htmlFor="dailyKm">Daily distance (km)</label>
        <input
          id="dailyKm"
          type="number"
          min="0"
          value={dailyKm}
          onChange={(e) => setDailyKm(e.target.value)}
        />

        <label htmlFor="days">Number of days</label>
        <input
          id="days"
          type="number"
          min="0"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />

        <div className="result">
          <span>Estimated total petrol cost</span>
          <strong>₹{totalCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
          <p>{litres.toFixed(2)} litres needed for {km * numberOfDays} km</p>
        </div>

        <div className="stats">
          <div>
            <span>Daily cost</span>
            <strong>₹{(km / (mileage || 1) * price).toFixed(2)}</strong>
          </div>
          <div>
            <span>Cost per km</span>
            <strong>₹{(price / (mileage || 1)).toFixed(2)}</strong>
          </div>
        </div>
      </section>

      <footer>
        Fuel estimates only. Confirm specifications and prices with the
        manufacturer or authorised dealer before making a purchase.
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
