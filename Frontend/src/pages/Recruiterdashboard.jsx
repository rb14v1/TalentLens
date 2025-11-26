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
 
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
 
const Recruiterdashboard = () => {
  const navigate = useNavigate();
  const [active] = useState("Dashboard");
 
  // =========== Profile ===========
  const [user, setUser] = useState({ name: "", role: "", profile_image: "" });
 
  useEffect(() => {
    fetch(`${API_BASE_URL}/user/profile/`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setUser(d))
      .catch(() => {});
  }, []);
 
  // =========== Analytics ===========
  const [cpdData, setCpdData] = useState([]);
  const [expData, setExpData] = useState([]);
  const [skillData, setSkillData] = useState([]);
  const [loading, setLoading] = useState(true);
 
  const COLORS = ["#0F394D", "#21B0BE", "#4DD0E1", "#0097A7", "#56C6C8", "#2B8F97"];
 
  useEffect(() => {
    fetch(`${API_BASE_URL}/analytics/`)
      .then((r) => r.json())
      .then((data) => {
        setCpdData(
          Object.entries(data.cpd_levels || {}).map(([level, count]) => ({
            name: `Level ${level}`,
            value: count,
            raw: level,
          }))
        );
 
        setExpData(
          Object.entries(data.experience || {}).map(([range, count]) => ({
            name: range,
            value: count,
          }))
        );
 
        setSkillData(
          Object.entries(data.skills || {}).map(([skill, count]) => ({
            name: skill,
            value: count,
          }))
        );
      })
      .finally(() => setLoading(false));
  }, []);
 
  const hasData = cpdData.length || expData.length || skillData.length;
 
  return (
    <div className="min-h-screen flex bg-[#F5F5F5]">
      {/* SIDEBAR */}
      <RecruiterSidebar active="Dashboard" />
 
      {/* MAIN CONTENT */}
      <main className="flex-1 ml-72 p-10 overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-[#0D1F29]">Analytics Overview</h1>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-gradient-to-r from-[#073C4D] to-[#19A8B6]
                       text-white rounded-full shadow hover:opacity-90 transition"
          >
            Back
          </button>
        </div>
 
        {loading ? (
          <div className="text-center text-gray-500 mt-20 text-lg">Loading dashboard...</div>
        ) : !hasData ? (
          <div className="text-center text-gray-500 mt-20 text-lg">No analytics data.</div>
        ) : (
          <>
            {/* TOP ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
              {/* CPD PIE */}
              <ChartCard title="CPD Level Distribution">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={cpdData} dataKey="value">
                      {cpdData.map((e, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
 
              {/* EXPERIENCE */}
              <ChartCard title="Experience Distribution">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={expData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#21B0BE" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
 
            {/* SKILLS */}
            <ChartCard title="Top Skills">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={skillData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#0F394D" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}
      </main>
    </div>
  );
};
 
const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-3xl shadow-lg border p-6">
    <h2 className="text-xl font-semibold text-[#0D1F29] mb-4">{title}</h2>
    {children}
  </div>
);
 
export default Recruiterdashboard;
 
 
 