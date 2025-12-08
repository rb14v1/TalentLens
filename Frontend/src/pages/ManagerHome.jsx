// src/pages/ManagerHome.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import GlobalHeader from "../components/sidebar/GlobalHeader";


import {
  Briefcase,
  Users,
  ArrowRight,
  FileText,
  UserCheck,
  Pencil,
} from "lucide-react";

import { API_BASE_URL } from "../config";

const ManagerHome = () => {
  const navigate = useNavigate();

  // ===================== USER STATE =====================
  const [user, setUser] = useState({
    name: "",
    role: "",
    email: "",
    profile_image: "",
    loading: true,
  });

  // Try to hydrate from localStorage first for instant UI
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user"));
      if (stored && (stored.name || stored.email || stored.profile_image)) {
        setUser((prev) => ({
          ...prev,
          name: stored.name || prev.name,
          role: stored.role || prev.role,
          email: stored.email || prev.email,
          profile_image: stored.profile_image || prev.profile_image,
          loading: false,
        }));
      }
    } catch (err) {
      // ignore parse errors
      console.warn("Could not read user from localStorage", err);
    }
  }, []);

  // ===================== FETCH USER (refresh / canonical) =====================
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/manager/profile/`, {
          // include credentials if your API requires session cookies
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();

        // Persist to localStorage for fast next-load
        try {
          const stored = JSON.parse(localStorage.getItem("user")) || {};
          stored.name = data.name || stored.name;
          stored.role = data.role || stored.role;
          stored.email = data.email || stored.email;
          if (data.profile_image) stored.profile_image = data.profile_image;
          localStorage.setItem("user", JSON.stringify(stored));
        } catch (err) {
          // ignore storage errors
        }

        setUser({
          name: data.name || "",
          role: data.role || "No Role",
          email: data.email || "",
          profile_image: data.profile_image || "",
          loading: false,
        });
      } catch (err) {
        console.error("Failed to fetch user:", err);
        // if we already had localStorage data, keep it; otherwise just set loading false
        setUser((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchUser();
  }, []);

  // Helper: pick avatar source
  const avatarSrc = () => {
    if (user.profile_image) return user.profile_image; // assume absolute URL or base64
    if (user.name) {
      // ui-avatars (URL-encoded name)
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user.name
      )}&background=073C4D&color=fff`;
    }
    return "/assets/default-avatar.png";
  };

  return (
  <div className="min-h-screen bg-[#E9F1F4]">
    {/* GLOBAL HEADER */}
    <GlobalHeader />

    {/* Main Page Content - Added padding top for header */}
    <div className="pt-[90px]">
      
      {/* -------------------- PAGE TITLE -------------------- */}
      <div className="w-full pt-4 pb-3 flex justify-center">
        <h1 className="text-4xl font-bold text-[#0D1F29]">Manager Dashboard</h1>
      </div>

      {/* -------------------- CONTENT WRAPPER -------------------- */}
      <div className="px-6 pt-4 pb-28 flex justify-center">
        <div className="w-full max-w-6xl">
          <h2 className="text-xl font-semibold text-[#0D1F29] mb-4">
            Access Your Roles
          </h2>

          {/* -------------------- ROLE CARDS -------------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* -------------------- HIRING MANAGER CARD -------------------- */}
            <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-200 hover:-translate-y-1">
              <div className="flex items-center gap-4">
                <div className="bg-[#E3EEF2] p-3 rounded-full shadow-inner">
                  <Briefcase className="text-[#073C4D]" size={28} />
                </div>
                <h3 className="text-xl font-semibold text-[#0D1F29]">
                  Hiring Manager Role
                </h3>
              </div>

              <p className="text-gray-600 mt-4 leading-relaxed">
                Create JDs, track applicants, and monitor hiring pipeline.
              </p>

              <div className="mt-5 space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[#073C4D]" />
                  View / Create Job Descriptions
                </div>
                <div className="flex items-center gap-2">
                  <UserCheck size={16} className="text-[#073C4D]" />
                  Review Applicants
                </div>
              </div>

              <button
                onClick={() => navigate("/managerpage")}
                className="mt-6 w-full text-white py-2.5 rounded-lg flex items-center justify-center gap-2
                  bg-gradient-to-r from-[#073C4D] to-[#19A8B6]
                  hover:opacity-95 shadow-md hover:shadow-lg transition-all"
              >
                Go to Hiring Manager Dashboard <ArrowRight size={18} />
              </button>
            </div>

            {/* -------------------- RECRUITER CARD -------------------- */}
            <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-200 hover:-translate-y-1">
              <div className="flex items-center gap-4">
                <div className="bg-[#E3EEF2] p-3 rounded-full shadow-inner">
                  <Users className="text-[#073C4D]" size={28} />
                </div>
                <h3 className="text-xl font-semibold text-[#0D1F29]">
                  Recruiter Role
                </h3>
              </div>

              <p className="text-gray-600 mt-4 leading-relaxed">
                Upload resumes, match candidates with JDs, and manage pipeline.
              </p>

              <div className="mt-5 space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <UserCheck size={16} className="text-[#073C4D]" />
                  Upload &amp; Manage Resumes
                </div>
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[#073C4D]" />
                  Match JD with Candidate Profile
                </div>
              </div>

              <button
                onClick={() => navigate("/home")}
                className="mt-6 w-full text-white py-2.5 rounded-lg flex items-center justify-center gap-2
                  bg-gradient-to-r from-[#073C4D] to-[#19A8B6]
                  hover:opacity-95 shadow-md hover:shadow-lg transition-all"
              >
                Go to Recruiter Dashboard <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* -------------------- BOTTOM-LEFT PROFILE CARD -------------------- */}
    <div className="fixed bottom-6 left-6 bg-white shadow-xl rounded-2xl px-5 py-4 flex items-center justify-between gap-4 border border-gray-200 w-[340px] z-50">
      {/* Avatar + Edit */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <img
            src={avatarSrc()}
            alt="profile"
            className="w-14 h-14 rounded-full border-2 border-white shadow-md object-cover"
          />

          {/* Edit icon */}
          <button className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow hover:bg-gray-100">
            <Pencil size={16} className="text-[#073C4D]" />
          </button>
        </div>

        {/* User Details: role + name + email */}
        <div className="flex flex-col leading-snug overflow-hidden">
          <span className="text-sm text-gray-500 truncate">
            {user.loading ? "Loading…" : user.role || "No Role Assigned"}
          </span>
          <span className="text-base font-semibold text-gray-900 truncate">
            {user.loading ? "Loading…" : user.name || "Unknown User"}
          </span>

          <span className="text-xs text-gray-500 mt-1 truncate">
            {user.loading ? "Fetching…" : user.email || "No Email"}
          </span>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={() => navigate("/")}
        className="p-2 rounded-full hover:bg-gray-100 transition"
        title="Logout"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      </button>
    </div>
  </div>
);
};

export default ManagerHome;
