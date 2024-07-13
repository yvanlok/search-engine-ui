import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

function Home() {
  const [query, setQuery] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof window.turnstile === "undefined") {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);

      script.onload = renderTurnstile;
    } else {
      renderTurnstile();
    }

    return () => {
      if (turnstileRef.current) {
        window.turnstile.remove(turnstileRef.current);
      }
    };
  }, []);

  const renderTurnstile = () => {
    if (turnstileRef.current) {
      window.turnstile.remove(turnstileRef.current);
    }

    turnstileRef.current = window.turnstile.render("#turnstile-widget", {
      sitekey: process.env.REACT_APP_SITEKEY,
      callback: function (token) {
        setTurnstileToken(token);
      },
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!turnstileToken) {
      alert("Please complete the CAPTCHA challenge.");
      return;
    }
    navigate(`/search?q=${encodeURIComponent(query)}&token=${encodeURIComponent(turnstileToken)}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center items-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-gray-200">Search Engine</h1>
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label htmlFor="query" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Query:
            </label>
            <input
              type="text"
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div id="turnstile-widget" className="flex justify-center"></div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Search
          </button>
        </form>
      </div>
    </div>
  );
}

export default Home;
