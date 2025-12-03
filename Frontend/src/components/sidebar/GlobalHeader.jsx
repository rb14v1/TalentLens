// src/components/sidebar/GlobalHeader.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Home, LogOut } from "lucide-react";
import Version1Logo from "../../assets/Version1.png";
import { API_BASE_URL } from "../../config"; // ✅ Import API URL

const GlobalHeader = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);

  // ✅ 1. Fetch User Role on Load
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/profile/`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setRole(data.role); // "recruiter", "hiring_manager", or "manager"
        }
      } catch (e) {
        console.error("Failed to fetch user role:", e);
      }
    };
    fetchUserRole();
  }, []);

  // ✅ 2. Dynamic Navigation Function
  const handleHomeClick = () => {
    if (!role) {
      navigate("/login"); // Fallback if not logged in
      return;
    }

    switch (role) {
      case "recruiter":
        navigate("/home");
        break;
      case "hiring_manager":
        navigate("/managerpage");
        break;
      case "manager":
        navigate("/managerhome");
        break;
      default:
        navigate("/"); // Default landing
    }
  };

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
      {/* LEFT — LOGO (Clicking goes to Home) */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={handleHomeClick}
      >
        <img
          src={Version1Logo}
          alt="Version1 Logo"
          className="w-40 h-auto select-none"
        />
      </div>

      {/* RIGHT — HOME BUTTON */}
      <button
        onClick={handleHomeClick}
        className="
          flex items-center gap-2
          bg-gradient-to-r from-[#073C4D] to-[#0BB4C3]
          text-white font-semibold
          px-5 py-2
          rounded-full
          shadow-md hover:shadow-lg hover:scale-[1.03]
          transition-all duration-200
        "
      >
        <Home size={18} strokeWidth={2.5} />
        <span>Home</span>
      </button>
    </header>
  );
};

export default GlobalHeader;