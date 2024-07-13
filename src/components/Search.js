import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import EnhancedPagination from "./EnhancedPagination";
import ThemeToggle from "./ThemeToggle";
import ErrorMessage from "./ErrorMessage";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function Search() {
  const query = useQuery();
  const navigate = useNavigate();
  const searchQuery = query.get("q");
  const turnstileToken = query.get("token");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ results: 0, total: 0, timeTaken: {} });
  const [page, setPage] = useState(1);
  const resultsPerPage = 10;
  const requestInProgress = useRef(false);
  const requestSucceeded = useRef(false);
  const turnstileRef = useRef(null);

  const fetchResults = useCallback(async () => {
    if (!turnstileToken) {
      setError("We couldn't confirm if you were human. Please try searching again from the home page.");
      return;
    }

    if (requestInProgress.current || requestSucceeded.current) {
      return;
    }

    setLoading(true);
    setError(null);
    requestInProgress.current = true;

    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASEURL}?q=${encodeURIComponent(searchQuery)}&results=200&token=${encodeURIComponent(turnstileToken)}&links=true`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        if (data.error === "Invalid Turnstile token") {
          throw new Error("We couldn't confirm if you were human. Please try again.");
        } else {
          throw new Error(data.error);
        }
      }

      const sortedResults = rankResults(data.results);
      setResults(sortedResults);
      setStats({
        results: sortedResults.length,
        total: data.matching_webpages,
        timeTaken: data.time_taken,
      });
      requestSucceeded.current = true;

      if (typeof window.turnstile !== "undefined") {
        window.turnstile.render("#turnstile-widget", {
          sitekey: process.env.REACT_APP_SITEKEY,
          callback: function (token) {
            const newUrl = new URL(window.location);
            newUrl.searchParams.set("token", token);
            window.history.replaceState({}, "", newUrl);
          },
        });
      }
    } catch (error) {
      console.error("Error:", error);
      setError(`An error occurred while fetching search results: ${error.message}`);
      setResults([]);
    } finally {
      setLoading(false);
      requestInProgress.current = false;
    }
  }, [searchQuery, turnstileToken]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

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
        const newUrl = new URL(window.location);
        newUrl.searchParams.set("token", token);
        window.history.replaceState({}, "", newUrl);
      },
    });
  };

  const rankResults = (results) => {
    const groupedResults = results.reduce((acc, result) => {
      acc[result.score] = acc[result.score] || [];
      acc[result.score].push(result);
      return acc;
    }, {});

    const sortedScores = Object.keys(groupedResults).sort((a, b) => b - a);

    const calculateRankingScore = (result) => {
      const incomingLinks = result.links_from ? result.links_from.length : 0;
      const externalLinks = result.links_from ? result.links_from.filter((link) => !isSameDomain(link, result.url)).length : 0;
      const internalLinks = incomingLinks - externalLinks;

      const linkScore = Math.log(externalLinks + 1) * 1000 + Math.log(internalLinks + 1) * 500;
      const websiteRankFactor = 1000 / (1 + Math.log(result.top_website_rank || 1));
      return linkScore + websiteRankFactor;
    };

    const isSameDomain = (url1, url2) => {
      url1 = url1.link;
      const domain1 = new URL(url1).hostname;
      const domain2 = new URL(url2).hostname;
      return domain1 === domain2;
    };

    const rankedResults = sortedScores.flatMap((score) => groupedResults[score].sort((a, b) => calculateRankingScore(b) - calculateRankingScore(a)));

    return rankedResults;
  };

  const handlePageChange = (newPage) => {
    const totalPages = Math.ceil(stats.results / resultsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const newToken = new URLSearchParams(window.location.search).get("token");
    window.location.href = `/search?q=${encodeURIComponent(searchQuery)}&token=${encodeURIComponent(newToken)}`;
  };

  const getFaviconUrl = (url) => {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  };

  const shortenUrl = (url) => {
    try {
      const urlObj = new URL(url);
      let path = urlObj.pathname;
      if (path.length > 20) {
        path = path.substring(0, 20) + "...";
      }
      return `${urlObj.hostname}${path}`;
    } catch (e) {
      console.error("Invalid URL:", url);
      return url;
    }
  };

  const paginatedResults = results.slice((page - 1) * resultsPerPage, page * resultsPerPage);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 dark:text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Search Results</h1>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <button
              onClick={() => navigate("/")}
              className="bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
        <div className="mb-6">
          <form onSubmit={handleSearch} className="flex">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => navigate(`/search?q=${encodeURIComponent(e.target.value)}&token=${encodeURIComponent(turnstileToken)}`)}
              required
              className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white py-2 px-4 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </form>
        </div>
        <div id="turnstile-widget" className="mb-4"></div>
        {loading && (
          <div className="flex justify-center items-center">
            <div className="spinner"></div>
          </div>
        )}

        {!loading && (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                About {stats.total} results | Time: {stats.timeTaken && stats.timeTaken.total_request}
              </p>
            </div>
            <div id="search-results" className="space-y-6">
              {paginatedResults.length > 0 ? (
                paginatedResults.map((result, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow transition-colors">
                    <div className="flex items-center mb-2">
                      <img src={getFaviconUrl(result.url)} alt="Favicon" className="w-4 h-4 mr-2" />
                      <a
                        href={result.url}
                        className="text-xl font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {result.title}
                      </a>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-500 mt-1">{shortenUrl(result.url)}</p>
                    <p className="mt-2 text-gray-700 dark:text-gray-300">{result.description}</p>
                  </div>
                ))
              ) : (
                <>
                  {error && <ErrorMessage message={error} />}
                  {!error && <ErrorMessage message="No results found." />}
                </>
              )}
            </div>
          </>
        )}
        <div className="mt-8 flex justify-center">
          <EnhancedPagination currentPage={page} totalPages={Math.ceil(stats.results / resultsPerPage)} onPageChange={handlePageChange} />
        </div>
      </div>
    </div>
  );
}

export default Search;
