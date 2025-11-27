// src/components/sidebar/RecruiterSidebar.jsx

import React, { useEffect, useState, useRef } from "react";
import {
  Upload,
  Search,
  LayoutDashboard,
  FileText,
  SearchCheck,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Pencil,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../config";

const RecruiterSidebar = ({ setCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  // Detect active item in sidebar
  const getActive = () => {
    if (location.pathname.includes("upload")) return "Upload";
    if (location.pathname.includes("retrieve")) return "Retrieve";
    if (location.pathname.includes("recruiterdashboard")) return "Dashboard";
    if (location.pathname.includes("manageresume")) return "Manage Resume";
    if (location.pathname.includes("jobdescriptionmatch")) return "JD Matcher";
    return "";
  };

  const [active, setActive] = useState(getActive);
  const [collapsed, setLocalCollapsed] = useState(false);

  const [user, setUser] = useState({
    name: "",
    email: "",
    role: "",
    profile_image: "",
  });

  // Load profile data
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user"));
    if (stored) {
      setUser({
        name: stored.name || "",
        email: stored.email || "",
        role: stored.role || "Recruiter",
        profile_image: stored.profile_image || "",
      });
    }
  }, []);

  // Upload profile image
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;

      setUser((prev) => ({ ...prev, profile_image: base64 }));

      const stored = JSON.parse(localStorage.getItem("user")) || {};
      stored.profile_image = base64;
      localStorage.setItem("user", JSON.stringify(stored));

      await fetch(`${API_BASE_URL}/upload-profile-image/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: stored.email,
          image: base64,
        }),
      });
    };
    reader.readAsDataURL(file);
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Sidebar button item
  const SidebarItem = ({ icon, label, link }) => {
    const isActive = active === label;

    return (
      <button
        onClick={() => {
          setActive(label);
          navigate(link);
        }}
        title={collapsed ? label : ""}
        className={`flex items-center gap-4 px-4 py-3 w-full text-lg font-medium rounded-xl transition-all
          ${isActive ? "text-[#FFFFFF]" : "text-white"}
          ${collapsed ? "justify-center" : ""}
        `}
      >
        <div
          className={`relative flex items-center justify-center transition-all
            ${collapsed ? "p-2" : ""}
            ${isActive ? "bg-white/20 rounded-xl" : "hover:bg-white/15 rounded-xl"}
          `}
          style={{ width: collapsed ? 44 : 32, height: collapsed ? 44 : 32 }}
        >
          <div
            className={`absolute left-0 w-[4px] h-full rounded-r-lg transition-all
              ${isActive ? "bg-white" : "bg-transparent"}`}
          />
          {React.cloneElement(icon, { size: 22, color: "#ffffff" })}
        </div>

        {!collapsed && label}
      </button>
    );
  };

  const toggleSidebar = () => {
    const nextState = !collapsed;
    setLocalCollapsed(nextState);
    if (setCollapsed) setCollapsed(nextState);
  };

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-full flex flex-col bg-gradient-to-b
          from-[#073C4D] to-[#19A8B6] text-white shadow-xl transition-all duration-300
          ${collapsed ? "w-20" : "w-72"}
        `}
      >
        {/* Arrow collapse */}
        <div className={`p-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <h3 className="uppercase text-teal-200 font-semibold tracking-wide text-2xl">
              Navigation
            </h3>
          )}

          <button
            onClick={toggleSidebar}
            className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-lg transition"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
          </button>
        </div>

        {/* Navigation */}
        <div className="px-5 flex-1 space-y-3">
          <SidebarItem label="Upload" icon={<Upload />} link="/upload" />
          <SidebarItem label="Retrieve" icon={<Search />} link="/retrieve" />
          <SidebarItem label="Dashboard" icon={<LayoutDashboard />} link="/recruiterdashboard" />
          <SidebarItem label="Manage Resume" icon={<FileText />} link="/manageresume" />
          <SidebarItem label="JD Matcher" icon={<SearchCheck />} link="/jobdescriptionmatch" />
        </div>

        {/* Profile section */}
        <div
          className={`p-5 border-t border-white/10 bg-[#0A4C5E]/90 flex items-center gap-3 transition-all
            ${collapsed ? "justify-center" : ""}
          `}
        >
          <div className="relative">
            <img
              src={user.profile_image || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
              className="w-11 h-11 rounded-full border-2 border-white/80 shadow-lg object-cover"
              alt="profile"
            />
            {!collapsed && (
              <button
                onClick={() => fileInputRef.current.click()}
                className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-md"
              >
                <Pencil size={14} className="text-red-500" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          {!collapsed && (
            <div className="flex-1">
              <p className="font-semibold text-white">
                {user.name || "Loading..."}
              </p>
              <p className="text-xs text-teal-100">{user.role || "Recruiter"}</p>
            </div>
          )}
          <LogOut
            size={20}
            className="opacity-80 hover:opacity-100 cursor-pointer"
            onClick={() => setShowLogoutConfirm(true)}
          />
        </div>
      </aside>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-80 text-center">
            <h2 className="text-lg font-semibold mb-3 text-gray-800">Confirm Logout</h2>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to logout?</p>
            <div className="flex gap-4">
              <button
                className="w-1/2 bg-gray-300 py-2 rounded-lg"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="w-1/2 bg-red-600 text-white py-2 rounded-lg"
                onClick={() => {
                  localStorage.clear();
                  navigate("/login");
                }}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RecruiterSidebar;
