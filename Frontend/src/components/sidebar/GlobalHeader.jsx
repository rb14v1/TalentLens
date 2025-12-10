// src/components/sidebar/GlobalHeader.jsx
 
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import Version1Logo from "../../assets/Version1.png";
import { API_BASE_URL } from "../../config";
 
const GlobalHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(null);
 
  // login-like pages to ignore when building history / when going back
  const loginPages = ["/login", "/recruiter-login", "/manager-login"];
 
  // ----- Navigation stack stored in sessionStorage under this key -----
  const NAV_STACK_KEY = "app_nav_stack_v1";
 
  // ----- Helper: push current path into sessionStorage stack (avoid login pages) -----
  useEffect(() => {
    try {
      // load stack or start fresh
      const raw = sessionStorage.getItem(NAV_STACK_KEY);
      const stack = raw ? JSON.parse(raw) : [];
 
      const current = location.pathname;
 
      // Avoid recording login pages
      if (loginPages.includes(current)) {
        // still update storage with existing stack (no-op)
        sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
        return;
      }
 
      // Avoid consecutive duplicates
      if (stack.length === 0 || stack[stack.length - 1] !== current) {
        stack.push(current);
        sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
      }
    } catch (e) {
      // silently fail — stack is optional
      console.warn("nav stack error:", e);
    }
  }, [location.pathname]); // run on every route change
 
  // ----- Pop-from-stack navigation logic for Back button -----
  const handleBack = () => {
    try {
      const raw = sessionStorage.getItem(NAV_STACK_KEY);
      const stack = raw ? JSON.parse(raw) : [];
 
      // Remove current page (top of stack) if it matches current pathname
      if (stack.length && stack[stack.length - 1] === location.pathname) {
        stack.pop();
      }
 
      // Find the most recent previous page that is not a login page
      let prev = null;
      while (stack.length) {
        const candidate = stack.pop();
        if (!loginPages.includes(candidate)) {
          prev = candidate;
          break;
        }
      }
 
      // Save the trimmed stack back
      sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
 
      if (prev) {
        // Navigate to the previous route we found
        navigate(prev);
        return;
      }
    } catch (e) {
      console.warn("back navigation via stack failed:", e);
    }
 
    // If stack-based approach didn't yield a previous page, try browser referrer
    try {
      const ref = document.referrer || "";
      if (ref && !ref.includes("/login")) {
        // attempt to go back one step in history
        // this may work if the referrer is in history
        navigate(-1);
        return;
      }
    } catch (e) {
      // ignore
    }
 
    // Final fallback: go to role-based home (never navigate to login)
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
        navigate("/");
    }
  };
 
  // -----------------------------
  // Fetch User Role (unchanged)
  // -----------------------------
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/profile/`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setRole(data.role);
        }
      } catch (e) {
        console.error("Failed to fetch user role:", e);
      }
    };
    fetchUserRole();
  }, []);
 
  // -----------------------------
  // Home Navigation (unchanged)
  // -----------------------------
  const handleHomeClick = () => {
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
        navigate("/");
    }
  };
 
  return (
    <>
      {/* ---------------- HEADER ---------------- */}
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
 
        </button>
      </header>
 
      {/* ---------------- BACK BUTTON BELOW HEADER (teal gradient, right) ---------------- */}
      <div
        className="
    fixed top-[80px]
    right-6
    z-40
  "
      >
        <button
          onClick={handleBack}
          className="
      flex items-center gap-2
      text-[#0BB4C3] font-semibold
      px-3 py-1
      rounded-full
      bg-transparent
      transition-all duration-200
      hover:shadow-[0_0_12px_3px_rgba(11,180,195,0.35)]
      hover:scale-[1.05]
    "
        >
          <ArrowLeft size={18} strokeWidth={2.5} className="text-[#0BB4C3]" />
          <span>Back</span>
        </button>
      </div>
    </>
  );
};
 
export default GlobalHeader;
 
 