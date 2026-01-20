const apiURL = import.meta.env.VITE_API_URL;

import { useState } from "react";
import axios from "axios";
import { Anchor, Users, Zap } from "lucide-react";

export default function ShipsLanding() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [gameUrl, setGameUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const generateGameLobby = () => {
    setIsGenerating(true);
    setError(null);

    axios
      .post<{ url: string }>(
        apiURL + "/api/lobby/create",
        {},
        { withCredentials: true },
      )
      .then((response) => {
        console.log("Success:", response.data);
        console.log("Request URL:", response.config.url);
        console.log("Base URL:", response.config.baseURL);
        setGameUrl(response.data.url);
        setIsGenerating(false);
      })
      .catch((error) => {
        console.error("Error:", error);
        setError(
          error.response?.data?.error ||
            "Failed to create lobby. Please try again.",
        );
        setIsGenerating(false);
      });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gameUrl);
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-slate-900 to-slate-800 relative overflow-hidden">
        {/* Background effect */}
        <div className="absolute inset-0 bg-gradient-radial from-sky-500/10 via-transparent to-transparent animate-pulse"></div>

        <div className="max-w-4xl w-full text-center relative z-10">
          {/* Icon */}
          <div className="flex justify-center mb-8 animate-bounce">
            <div className="bg-gradient-to-br from-sky-400 to-cyan-500 p-4 rounded-2xl shadow-2xl">
              <Anchor className="w-16 h-16 text-white" />
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-slate-50">
            Battle on the{" "}
            <span className="bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent">
              High Seas
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl mb-12 max-w-2xl mx-auto text-slate-400">
            Challenge your friends in the classic game of Battleship. Create a
            lobby, share the link, and sink their fleet!
          </p>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto">
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-xl border border-slate-700">
              <Users className="w-8 h-8 mx-auto mb-3 text-sky-400" />
              <h3 className="font-semibold mb-2 text-slate-50">Multiplayer</h3>
              <p className="text-sm text-slate-400">
                Play with friends anywhere
              </p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-xl border border-slate-700">
              <Zap className="w-8 h-8 mx-auto mb-3 text-cyan-400" />
              <h3 className="font-semibold mb-2 text-slate-50">
                Instant Setup
              </h3>
              <p className="text-sm text-slate-400">No registration required</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-xl border border-slate-700">
              <Anchor className="w-8 h-8 mx-auto mb-3 text-amber-400" />
              <h3 className="font-semibold mb-2 text-slate-50">Classic Fun</h3>
              <p className="text-sm text-slate-400">Timeless naval strategy</p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-900/30 border border-red-500 text-red-200 p-4 rounded-lg max-w-2xl mx-auto">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* CTA Button */}
          {!gameUrl ? (
            <button
              onClick={generateGameLobby}
              disabled={isGenerating}
              className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-bold text-lg px-10 py-5 rounded-full shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-100"
            >
              {isGenerating ? (
                <span className="flex items-center gap-3">
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating Lobby...
                </span>
              ) : (
                "Create Game Lobby"
              )}
            </button>
          ) : (
            <div className="bg-slate-800/70 backdrop-blur border border-slate-700 rounded-2xl p-8 max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold mb-4 text-slate-50">
                🎉 Lobby Created!
              </h3>
              <p className="mb-4 text-slate-400">
                Share this link with your opponent:
              </p>
              <div className="flex gap-3 items-center justify-center flex-wrap">
                <div className="bg-slate-900 px-6 py-3 rounded-lg border border-slate-600 font-mono text-sm break-all text-sky-400">
                  {gameUrl}
                </div>
                <button
                  onClick={copyToClipboard}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Copy Link
                </button>
              </div>
              <button
                onClick={() => {
                  setGameUrl("");
                  setError(null);
                }}
                className="mt-6 text-sm underline text-slate-400 hover:text-slate-300 transition-colors"
              >
                Create another lobby
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
