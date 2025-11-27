import { API_BASE_URL } from "../config";
import React, { useRef, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import {
  FileText,
  Clock,
  BarChart,
  Users,
  Briefcase,
  Star,
  CheckCircle,
  Edit,
  XCircle,
  Info,
} from "lucide-react";

// ------ Country-City-Currency data for Preview ------
const locations = [
  { country: "Ireland", city: "Dublin", currency: "EUR" },
  { country: "Ireland", city: "Cork", currency: "EUR" },
  { country: "United Kingdom", city: "London", currency: "GBP" },
  { country: "United Kingdom", city: "Belfast", currency: "GBP" },
  { country: "United Kingdom", city: "Birmingham", currency: "GBP" },
  { country: "United Kingdom", city: "Edinburgh", currency: "GBP" },
  { country: "India", city: "Bengaluru", currency: "INR" },
  { country: "India", city: "Pune", currency: "INR" },
  { country: "Spain", city: "Malaga", currency: "EUR" },
  { country: "Slovenia", city: "Trzin", currency: "EUR" },
  { country: "Australia", city: "Sydney (Chatswood, NSW)", currency: "AUD" },
  { country: "United States", city: "New York", currency: "USD" },
];
const getCurrencyForLocation = (locationStr) => {
  const entry = locations.find(
    (loc) => `${loc.country} - ${loc.city}` === locationStr
  );
  return entry ? entry.currency : "";
};

const Preview = ({ jdData: jdDataFromProp, setJdData: setJdDataFromProp }) => {
  const navigate = useNavigate();
  const printRef = useRef();
  const location = useLocation();

  const [jdData, setJdData] = useState(
    jdDataFromProp || location.state?.jdData || null
  );

  // Modal State
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  useEffect(() => {
    if (jdDataFromProp) {
      setJdData(jdDataFromProp);
    }
  }, [jdDataFromProp]);

  useEffect(() => {
    if (setJdDataFromProp) {
      setJdDataFromProp(jdData);
    }
  }, [jdData, setJdDataFromProp]);

  // Download PDF
  const handleDownloadPDF = useReactToPrint({
    contentRef: printRef,
    documentTitle: jdData?.jobTitle || "Job_Description",
  });

  if (!jdData)
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#F5F5F5]">
        <p className="text-[#0D1F29] text-lg mb-4">
          No JD data found. Please fill the description first.
        </p>
        <button
          onClick={() => navigate("/description")}
          className="px-6 py-3 bg-[#21B0BE] text-white rounded-md hover:bg-[#0F394D]"
        >
          Go to Description
        </button>
      </div>
    );

  // ⭐⭐⭐ BACKEND CONNECTED — Save JD Draft
  const handleSaveDraft = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user || !user.email) {
        setModalState({
          isOpen: true,
          title: "Error",
          message: "User not logged in. Please log in first.",
          type: "error",
        });
        return;
      }
      const res = await fetch(`${API_BASE_URL}/jd/draft/save/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: jdData.id,
          email: user.email,
          data: jdData,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to save draft");
      }
      const data = await res.json();
      setJdData((prev) => ({ ...prev, id: data.draft_id }));
      setModalState({
        isOpen: true,
        title: "Draft Saved",
        message: "Your Job Description has been saved to drafts.",
        type: "success",
      });
    } catch (error) {
      console.error("Error saving draft:", error);
      setModalState({
        isOpen: true,
        title: "Error",
        message: "Failed to save draft. Please try again.",
        type: "error",
      });
    }
  };

  // =====================================================
  // ✅ MODIFIED: Publish JD (Stays on page)
  // =====================================================
  const handlePublish = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/save/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jdData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to publish");
      }
      const publishedJDs = JSON.parse(localStorage.getItem("publishedJDs") || "[]");
      publishedJDs.push({ ...jdData, id: Date.now() });
      localStorage.setItem("publishedJDs", JSON.stringify(publishedJDs));
      setModalState({
        isOpen: true,
        title: "Success!",
        message: "Job Description published successfully!",
        type: "success",
        onCloseCallback: null,
      });
    } catch (error) {
      console.error("Publish error:", error);
      setModalState({
        isOpen: true,
        title: "Publish Failed",
        message: `Error: ${error.message}`,
        type: "error",
        onCloseCallback: null
      });
    }
  };

  // Edit Section Navigation
  const handleEditSection = (sectionIndex) => {
    navigate("/description", { state: { editSection: sectionIndex } });
  };

  // Section Grouping
  const sections = [
    {
      title: "Basic Information",
      fields: [
        "jobTitle",
        "department",
        "jobType",
        "location",
        "experience",
        "salary",
        "openings",
      ],
    },
    {
      title: "Role Overview",
      fields: ["summary", "responsibilities", "requiredSkills", "preferredSkills"],
    },
    {
      title: "Qualifications",
      fields: ["education", "specialization"],
    },
    {
      title: "Company & Contact",
      fields: ["companyName", "companyDescription","hiringManagerName", "contactEmail"],
    },
    {
      title: "Additional Settings",
      fields: ["postingDate", "deadline", "workMode", "status"],
    },
  ];

  return (
    <>
      <div className="min-h-screen flex flex-col items-center py-10 px-10 bg-[#F5F5F5]">
        <h1 className="text-4xl font-bold mb-10 text-[#0D1F29]">
          Job Description Preview
        </h1>
        <div className="w-full max-w-[95%] bg-white rounded-2xl shadow-lg border border-gray-200 p-10 flex">
          {/* Left Side (Screen View - Unchanged) */}
          <div className="flex-1 bg-[#FAFAFA] rounded-lg shadow-inner p-8 overflow-y-auto h-[75vh]">
            {sections.map((section, i) => (
              <div key={i} className="mb-10 border-b pb-6">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-2xl font-semibold text-[#0D1F29]">
                    {section.title}
                  </h2>
                  <button
                    onClick={() => handleEditSection(i)}
                    className="text-[#21B0BE] font-medium hover:text-[#0F394D]"
                  >
                    ✏️ Edit
                  </button>
                </div>
                {section.fields.map(
                  (field) =>
                    jdData[field] && (
                      <p
                        key={field}
                        className="text-[#0D1F29] mb-2 leading-relaxed"
                        style={{ whiteSpace: "pre-wrap", display: "flex", alignItems: "center" }}
                      >
                        <strong>
                          {field.replace(/([A-Z])/g, " $1").trim()}:
                        </strong>{" "}
                        {/* --- Professional Currency Display for Salary --- */}
                        {field === "salary" ? (
                          <>
                            {jdData[field]}
                            {jdData.location && (
                              <span
                                style={{
                                  marginLeft: 10,
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  background: "#F2F6F9",
                                  color: "#0F394D",
                                  fontWeight: 600,
                                  fontSize: "1rem",
                                  border: "1px solid #e4e7ea"
                                }}
                              >
                                {getCurrencyForLocation(jdData.location)}
                              </span>
                            )}
                          </>
                        ) : (
                          jdData[field]
                        )}
                      </p>
                    )
                )}
              </div>
            ))}
          </div>
          {/* Right Side (Action Buttons) */}
          <div className="w-[250px] flex flex-col justify-center items-center ml-10 gap-6">
            <button
              onClick={handleDownloadPDF}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#0F394D] to-[#21B0BE] hover:opacity-90 transition"
            >
              📄 Download PDF
            </button>
            <button
              onClick={handleSaveDraft}
              className="w-full py-3 rounded-xl font-semibold text-white bg-[#21B0BE] hover:bg-[#0F394D] transition"
            >
              💾 Save Draft
            </button>
            <button
              onClick={handlePublish}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#0F394D] to-[#21B0BE] hover:opacity-90 transition"
            >
              🚀 Publish JD
            </button>
          </div>
        </div>
        {/* ================================================================= */}
        {/* ✅ HIDDEN PRINT TEMPLATE (Formal Style + Uppercase Subheadings) */}
        {/* ================================================================= */}
        <div style={{ display: "none" }}>
          <div 
            ref={printRef} 
            className="p-12 bg-white text-black"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            <div className="text-center border-b-2 border-black pb-6 mb-8">
              <h1 className="text-4xl font-bold capitalize tracking-wide text-black">
                {jdData.jobTitle || "Job Description"}
              </h1>
              <h2 className="text-2xl mt-3 font-semibold text-gray-800">
                {jdData.companyName}
              </h2>
              <div className="flex justify-center gap-6 mt-4 text-base text-gray-700">
                {jdData.location && <span>📍 {jdData.location}</span>}
                {jdData.jobType && <span>💼 {jdData.jobType}</span>}
                {jdData.experience && <span>⏳ {jdData.experience} Exp.</span>}
              </div>
            </div>
            <div className="space-y-8">
              {sections.map((section, i) => {
                const hasData = section.fields.some(f => jdData[f]);
                if (!hasData) return null;
                return (
                  <div key={i} className="mb-6">
                    <h3 className="text-xl font-bold border-b border-gray-400 mb-4 pb-2 capitalize text-black">
                      {section.title}
                    </h3>
                    <div className="pl-1">
                      {section.fields.map((field) => 
                        jdData[field] ? (
                          <div key={field} className="mb-4">
                            <span className="font-bold text-black block mb-1 text-sm uppercase tracking-wide">
                              {field.replace(/([A-Z])/g, " $1").trim()}:
                            </span>
                            {/* --- Print template also shows currency for salary --- */}
                            <p className="text-gray-900 text-base leading-relaxed whitespace-pre-wrap" style={{ display: "flex", alignItems: "center" }}>
                              {field === "salary" ? (
                                <>
                                  {jdData[field]}
                                  {jdData.location && (
                                    <span
                                      style={{
                                        marginLeft: 8,
                                        padding: "2px 8px",
                                        borderRadius: "6px",
                                        background: "#F2F6F9",
                                        color: "#0F394D",
                                        fontWeight: 600,
                                        fontSize: "1rem",
                                        border: "1px solid #e4e7ea"
                                      }}
                                    >
                                      {getCurrencyForLocation(jdData.location)}
                                    </span>
                                  )}
                                </>
                              ) : (
                                jdData[field]
                              )}
                            </p>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {/* Custom Modal Component */}
      <CustomAlertModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />
    </>
  );
};

const CustomAlertModal = ({ isOpen, title, message, type = "info", onClose }) => {
  if (!isOpen) return null;
  const icons = {
    success: <CheckCircle className="w-12 h-12 text-green-500" />,
    error: <XCircle className="w-12 h-12 text-red-500" />,
    info: <Info className="w-12 h-12 text-[#21B0BE]" />,
  };
  const buttonStyles = {
    info: "bg-gradient-to-r from-[#0F394D] to-[#21B0BE] hover:opacity-90",
    success: "bg-gradient-to-r from-[#0F394D] to-[#21B0BE] hover:opacity-90",
    error: "bg-red-600 hover:bg-red-700",
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md p-6 bg-white rounded-2xl shadow-xl border border-gray-200 m-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          {icons[type]}
        </div>
        <div className="mt-4 text-center">
          <h3 className="text-xl font-semibold leading-6 text-[#0F394D]">
            {title}
          </h3>
          <div className="mt-2">
            <p className="text-sm text-gray-600 whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <button
            type="button"
            className={`w-full inline-flex justify-center rounded-lg shadow-sm px-4 py-2 text-base font-medium text-white transition ${buttonStyles[type]}`}
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default Preview;
