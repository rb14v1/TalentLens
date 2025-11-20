// Frontend/src/pages/Recruiterdashboard.jsx
import React, { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard,
  Upload,
  Search,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
 
const Recruiterdashboard = () => {
  const navigate = useNavigate();
 
  const [cpdData, setCpdData] = useState([]);
  const [expData, setExpData] = useState([]);
  const [skillData, setSkillData] = useState([]);
  const [loading, setLoading] = useState(true);
 
  const COLORS = ["#0F394D", "#21B0BE", "#4DD0E1", "#0097A7", "#56C6C8", "#2B8F97"];
 
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/analytics/`);
        const data = await res.json();

        // 1. Transform CPD Data
        const cpdArr = Object.entries(data.cpd_levels || {}).map(
          ([level, count]) => ({
            name: `Level ${level}`,
            value: count,
            raw: level,
          })
        );

        // 2. Transform Experience Data (FIXED)
        // Ensure specific order and correct mapping
        const expOrder = ["0-2 yrs", "3-5 yrs", "6-10 yrs", "10+ yrs"];
        const rawExp = data.experience || {};
        
        const expArr = expOrder.map(key => ({
          name: key,
          value: rawExp[key] || 0 // Default to 0 if key is missing
        }));

        // 3. Transform Skill Data
        const skillArr = Object.entries(data.skills || {}).map(
          ([skill, count]) => ({
            name: skill,
            value: count,
          })
        );

        setCpdData(cpdArr);
        setExpData(expArr);
        setSkillData(skillArr);
      } catch (err) {
        console.error("Error fetching analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);
 
  const hasData = cpdData.length > 0 || expData.length > 0 || skillData.length > 0;
 
  const handleCpdClick = (payload) => {
    const lvl = payload?.payload?.raw ?? payload?.name;
    if (!lvl) return;
    const lvlNum = String(lvl).replace("Level ", "");
    navigate(`/analytics-details?cpd_level=${encodeURIComponent(lvlNum)}`);
  };
 
  const handleExpClick = (payload) => {
    const range = payload?.payload?.name ?? payload?.name;
    if (!range) return;
    navigate(`/analytics-details?experience=${encodeURIComponent(range)}`);
  };
 
  const handleSkillClick = (payload) => {
    const name = payload?.payload?.name ?? payload?.name;
    if (!name) return;
    navigate(`/analytics-details?skill=${encodeURIComponent(name)}`);
  };
 
  return (
    <div className="min-h-screen flex bg-[#F5F5F5]">
      {/* ===== Sidebar ===== */}
      <aside className="w-72 bg-gradient-to-b from-[#0F394D] to-[#21B0BE] text-white flex flex-col shadow-lg">
        <div className="p-6 border-b border-[#1CA9A3]/30">
          <h2 className="text-2xl font-semibold tracking-wide">Recruiter Dashboard</h2>
          <p className="text-sm text-teal-100 mt-1">Overview of recruitment analytics</p>
        </div>
 
        <nav className="flex-1 p-5 space-y-3">
          <button
            className="flex items-center gap-3 p-2 w-full rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            onClick={() => navigate("/recruiterdashboard")}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>
 
          <button
            className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-white/20 transition-all"
            onClick={() => navigate("/upload")}
          >
            <Upload size={18} /> Upload
          </button>
 
          <button
            className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-white/20 transition-all"
            onClick={() => navigate("/retrieve")}
          >
            <Search size={18} /> Retrieve
          </button>
 
          <button
            className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-white/20 transition-all"
            onClick={() => navigate("/manageresume")}
          >
            <FileText size={18} /> Manage Resume
          </button>
 
          <button
            className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-white/20 transition-all"
            onClick={() => navigate("/settings")}
          >
            <Settings size={18} /> Settings
          </button>
        </nav>
 
        <div className="p-5 border-t border-[#1CA9A3]/30 flex items-center gap-3">
          <img
            src="https://randomuser.me/api/portraits/women/68.jpg"
            alt="Recruiter"
            className="w-10 h-10 rounded-full border-2 border-white/70"
          />
          <div>
            <p className="font-semibold">Emma Johnson</p>
            <p className="text-sm text-teal-100">Recruiter</p>
          </div>
        </div>
 
        <div className="p-5 border-t border-[#1CA9A3]/30">
          <button className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 py-2 w-full rounded-lg transition-all">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>
 
      {/* ===== Main Content ===== */}
      <main className="flex-1 p-10 overflow-y-auto">
 
        {/* === Title + Back Button in SAME ROW === */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-[#0D1F29]">Analytics Overview</h1>
 
          <button
            onClick={() => navigate("/")}
            className="
              px-6 py-2
              text-white font-medium
              bg-gradient-to-r from-[#0F394D] to-[#21B0BE]
              rounded-full shadow-md
              hover:opacity-90
              transition-all duration-300
            "
          >
            Back
          </button>
        </div>
 
        {loading ? (
          <div className="text-center text-gray-500 mt-20 text-lg">Loading dashboard data...</div>
        ) : !hasData ? (
          <div className="text-center text-gray-500 mt-20 text-lg">
            No analytics data available.
            <br />
            Please ensure backend is returning analytics.
          </div>
        ) : (
 
          /* ******************************************************
             🔥 FIXED: Only 2 cards per row — third wraps below
             ****************************************************** */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-10">
            {/* CPD Level */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-[#0D1F29] mb-4">
                CPD Level Distribution
              </h2>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={cpdData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label
                    onClick={(e) => handleCpdClick(e)}
                    cursor="pointer"
                  >
                    {cpdData.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
 
            {/* Experience */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-[#0D1F29] mb-4">
                Experience Distribution
              </h2>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={expData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="value"
                    fill="#21B0BE"
                    cursor="pointer"
                    onClick={(e) => handleExpClick(e)}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
 
            {/* Skill */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-[#0D1F29] mb-4">
                Top Skill Distribution
              </h2>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={skillData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="value"
                    fill="#0F394D"
                    cursor="pointer"
                    onClick={(e) => handleSkillClick(e)}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
 
          </div>
        )}
      </main>
    </div>
  );
};
 
export default Recruiterdashboard;
 
 