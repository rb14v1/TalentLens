// src/components/sidebar/HiringManagerSidebar.jsx
 
import React, { useState, useEffect, useRef } from "react";
 
import {
  Grid,
  Layers,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Pencil,
} from "lucide-react";
 
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../config";

 
const HiringManagerSidebar = ({ setCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
 
  const getActive = () => {
    if (location.pathname.includes("managerdashboard")) return "JD Dashboard";
    if (location.pathname.includes("description")) return "Manual JD Create";
    if (location.pathname.includes("drafts")) return "Draft";
    if (location.pathname.includes("published-jds")) return "Published JDs";
    if (location.pathname.includes("matchedresume")) return "Matched Resume";
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
 
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user"));
    if (stored) {
      setUser({
        name: stored.name || "",
        email: stored.email || "",
        role: stored.role || "Hiring Manager",
        profile_image: stored.profile_image || "",
        department: stored.department || "", // ✅ FIXED
      });
    }
  }, []);
 
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
 
  const SidebarBtn = ({ label, icon, link }) => {
    const isActive = active === label;
 
    return (
      <button
        onClick={() => {
          setActive(label);
          navigate(link);
        }}
        title={collapsed ? label : ""}
        className={`flex items-center gap-4 px-4 py-3 w-full text-lg font-medium transition-all duration-200 rounded-xl
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
              ${isActive ? "bg-white" : "bg-transparent"}
            `}
          />
          {React.cloneElement(icon, {
            size: 22,
            color: isActive ? "#ffffff" : "#ffffffB3",
          })}
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
        className={`
          fixed top-0 left-0 h-full flex flex-col
          bg-gradient-to-b from-[#073C4D] to-[#19A8B6]
          text-white shadow-xl overflow-y-auto transition-all duration-300
          ${collapsed ? "w-20" : "w-72"}
        `}
      >
 
        {/* ✅ FIXED HEADER — arrow moved to far right */}
        <div className={`p-4 flex items-center
  ${collapsed ? "justify-center" : "justify-between"}
`}>
 
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
 
        <div className="px-5 flex-1 space-y-3">
          <SidebarBtn label="JD Dashboard" icon={<Grid />} link="/managerdashboard" />
          <SidebarBtn label="Manual JD Create" icon={<Layers />} link="/description" />
          <SidebarBtn label="Draft" icon={<Briefcase />} link="/drafts" />
          <SidebarBtn label="Published JDs" icon={<Briefcase size={20} />} link="/published-jds" />
          <SidebarBtn label="Matched Resume" icon={<Briefcase size={20} />} link="/matchedresume"/>
        </div>
 
        {/* PROFILE SECTION */}
        <div
          className={`p-5 border-t border-white/10 bg-[#0A4C5E]/90 flex items-center gap-3 transition-all
            ${collapsed ? "justify-center" : ""}
          `}
        >
          <div className="relative">
            <img
              src={
                user.profile_image ||
                "https://cdn-icons-png.flaticon.com/512/149/149071.png"
              }
              className="w-11 h-11 rounded-full border-2 border-white/80 shadow-lg object-cover"
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
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
 
          {!collapsed && (
            <div>
              <p className="font-semibold">{user.name || "Loading..."}</p>
              <p className="text-xs text-teal-200 truncate">
                {user.department || "No Department"}
              </p>
            </div>
          )}
 
          <LogOut
            size={20}
            className={`${collapsed ? "" : "ml-auto"} opacity-80 hover:opacity-100 cursor-pointer`}
            onClick={() => setShowLogoutConfirm(true)}
          />
        </div>
      </aside>
 
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-80 text-center">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Confirm Logout</h2>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to logout?</p>
 
            <div className="flex justify-between gap-4">
              <button
                className="w-1/2 bg-gray-300 text-gray-800 py-2 rounded-lg"
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
 
export default HiringManagerSidebar;
 
 