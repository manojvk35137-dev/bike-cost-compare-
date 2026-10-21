import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <main style={{
      fontFamily: 'Arial, sans-serif',
      padding: '24px',
      maxWidth: '600px',
      margin: 'auto'
    }}>
      <h1>Bike Cost Compare 🏍️</h1>
      <p>Compare bike fuel costs easily.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
