// src/pages/Recruiterdashboard.jsx
 
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
import { FileText, Clock, Target } from "lucide-react";
 
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";
import GlobalHeader from "../components/sidebar/GlobalHeader";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
 
const Recruiterdashboard = () => {
  const navigate = useNavigate();
 
  const [collapsed, setCollapsed] = useState(false);
  const [cpdData, setCpdData] = useState([]);
  const [expData, setExpData] = useState([]);
  const [skillData, setSkillData] = useState([]);
  const [loading, setLoading] = useState(true);
 
  const [totalResumes, setTotalResumes] = useState(0);
  const [avgExperience, setAvgExperience] = useState(0);
  const [topCPD, setTopCPD] = useState(0);
 
  const COLORS = ["#0F394D", "#21B0BE", "#4DD0E1", "#0097A7", "#56C6C8", "#2B8F97"];
 
  // Fetch analytics
  useEffect(() => {
    fetch(`${API_BASE_URL}/analytics/`)
      .then((r) => r.json())
      .then((data) => {
        const cpdArray = Object.entries(data.cpd_levels || {}).map(([level, count]) => ({
          name: `Level ${level}`,
          value: count,
          raw: level,
        }));
        setCpdData(cpdArray);
 
        const expArray = Object.entries(data.experience || {}).map(([range, count]) => ({
          name: range,
          value: count,
        }));
        setExpData(expArray);
 
        const skillsArray = Object.entries(data.skills || {}).map(([skill, count]) => ({
          name: skill,
          value: count,
        }));
        setSkillData(skillsArray);
 
        const total = Object.values(data.cpd_levels || {}).reduce((a, b) => a + b, 0);
        setTotalResumes(total);
 
        setTopCPD(
          cpdArray.reduce((max, curr) => (curr.value > max.value ? curr : max), { value: 0, raw: 0 })
            .raw || 4
        );
 
        // Avg experience calculation
        const expWeights = { "0-2 yrs": 1, "3-5 yrs": 4, "6-10 yrs": 8, "10+ yrs": 12 };
        let totalExp = 0;
        let totalCount = 0;
 
        expArray.forEach((item) => {
          const weight = expWeights[item.name] || 0;
          totalExp += weight * item.value;
          totalCount += item.value;
        });
 
        setAvgExperience(totalCount > 0 ? (totalExp / totalCount).toFixed(1) : 0);
      })
      .finally(() => setLoading(false));
  }, []);
 
  const hasData = cpdData.length || expData.length || skillData.length;
 
  const handleDrill = (type, payload) => {
    navigate("/analytics-details", { state: { type, ...payload } });
  };
 
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-800">{payload[0].name}</p>
          <p className="text-teal-600 font-bold">{payload[0].value} candidates</p>
        </div>
      );
    }
    return null;
  };
 
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#F8FAFC] via-[#E9F1F4] to-[#E4EEF4]">
 
      {/* FIXED HEADER */}
      <GlobalHeader />
 
      {/* CONTENT BELOW HEADER */}
      <div className="flex flex-1 mt-[72px]">
       
        <RecruiterSidebar active="Dashboard" setCollapsed={setCollapsed} />
 
        <main
          className={`flex-1 p-10 overflow-y-auto transition-all duration-300 ${
            collapsed ? "ml-20" : "ml-72"
          }`}
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-4xl font-bold text-[#0D1F29]">Analytics Overview</h1>
              <p className="text-gray-600 mt-1">Monitor your recruitment metrics and insights</p>
            </div>
          </div>
 
          {loading ? (
            <div className="flex justify-center items-center mt-32">
              <div className="w-16 h-16 border-4 border-[#21B0BE] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !hasData ? (
            <div className="text-center text-gray-500 mt-32">
              <FileText size={64} className="mx-auto mb-4 text-gray-400" />
              <p className="text-xl">No analytics data available</p>
              <p className="text-sm mt-2">Upload resumes to see insights</p>
            </div>
          ) : (
            <>
              {/* METRIC CARDS — 3 ONLY NOW */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
               
                <MetricCard
                  icon={<FileText size={28} />}
                  value={totalResumes}
                  label="Total Resumes"
                  color="from-[#0F394D] to-[#21B0BE]"
                />
 
                <MetricCard
                  icon={<Clock size={28} />}
                  value={`${avgExperience} yrs`}
                  label="Avg Experience"
                  color="from-[#21B0BE] to-[#4DD0E1]"
                />
 
                <MetricCard
                  icon={<Target size={28} />}
                  value={`Level ${topCPD}`}
                  label="Top CPD Level"
                  color="from-[#4DD0E1] to-[#56C6C8]"
                />
              </div>
 
              {/* PIE + BAR CHARTS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
 
                <ChartCard title="CPD Level Distribution" subtitle={`${totalResumes} Total Candidates`}>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={cpdData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        onClick={(data) => data?.payload && handleDrill("cpd", data.payload)}
                        cursor="pointer"
                      >
                        {cpdData.map((e, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} className="hover:opacity-80" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
 
                <ChartCard title="Experience Distribution" subtitle="Candidates by Experience">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={expData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fill: "#6B7280", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="value"
                        fill="url(#expGradient)"
                        radius={[8, 8, 0, 0]}
                        cursor="pointer"
                        onClick={(data) => data?.payload && handleDrill("experience", data.payload)}
                      />
 
                      <defs>
                        <linearGradient id="expGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#21B0BE" />
                          <stop offset="100%" stopColor="#4DD0E1" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
 
              {/* SKILL CHART */}
              <ChartCard
                title="All Skills Overview"
                subtitle={`${skillData.length} unique skills`}
              >
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={skillData} margin={{ top: 20, right: 30, left: -10, bottom: 80 }}>
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      interval={0}
                      tick={{ fill: "#6B7280", fontSize: 11 }}
                    />
                    <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
 
                    <Bar
                      dataKey="value"
                      fill="url(#skillGradient)"
                      radius={[8, 8, 0, 0]}
                      cursor="pointer"
                      onClick={(data) => data?.payload && handleDrill("skill", data.payload)}
                    />
 
                    <defs>
                      <linearGradient id="skillGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0F394D" />
                        <stop offset="100%" stopColor="#21B0BE" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
 
const MetricCard = ({ icon, value, label, color }) => (
  <div
    className={`bg-gradient-to-br ${color} rounded-2xl shadow-lg p-6 text-white hover:shadow-2xl hover:scale-105 transition-all duration-300`}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-3xl font-bold mb-1">{value}</p>
        <p className="text-sm opacity-90">{label}</p>
      </div>
      <div className="bg-white/20 p-3 rounded-xl backdrop-blur">{icon}</div>
    </div>
  </div>
);
 
const ChartCard = ({ title, subtitle, children }) => (
  <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-[#0D1F29]">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
    {children}
  </div>
);
 
export default Recruiterdashboard;
 
 