// src/components/sidebar/GlobalHeader.jsx
 
import React from "react";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import Version1Logo from "../../assets/Version1.png";
 
const GlobalHeader = () => {
  const navigate = useNavigate();
 
  return (
    <header
      className="
        fixed top-0 left-0 z-50
        w-full
        bg-white
        shadow
        border-b
        flex items-center justify-between
        h-[72px]
        px-6
      "
    >
      {/* LEFT — LOGO */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => navigate("/recruiterdashboard")}
      >
        <img
          src={Version1Logo}
          alt="Version1 Logo"
          className="w-40 h-auto select-none"
        />
      </div>
 
      {/* RIGHT — HOME BUTTON */}
      <button
        onClick={() => navigate("/recruiterdashboard")}
        className="
          flex items-center gap-2
          bg-gradient-to-r from-[#073C4D] to-[#0BB4C3]
          text-white font-semibold
          px-5 py-2
          rounded-full
          shadow-md hover:shadow-lg hover:scale-[1.03]
          transition
        "
      >
        <Home size={18} />
        Home
      </button>
    </header>
  );
};
 
export default GlobalHeader;
 
 