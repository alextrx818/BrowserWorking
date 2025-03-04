import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import TennisData from './TennisData';
import MatchDetail from './MatchDetail';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Live Sports Alerts</h1>
          <nav>
            <ul>
              <li>
                <Link to="/">Tennis</Link>
              </li>
            </ul>
          </nav>
        </header>
        
        <main className="App-main">
          <Routes>
            <Route path="/" element={<TennisData />} />
            <Route path="/match/:id" element={<MatchDetail />} />
          </Routes>
        </main>
        
        <footer className="App-footer">
          <p>&copy; {new Date().getFullYear()} Live Sports Alerts</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
