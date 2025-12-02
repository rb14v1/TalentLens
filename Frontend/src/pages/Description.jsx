import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { CheckCircle } from "lucide-react";
 
// ----- DEFAULTS -----
const DEFAULT_COMPANY_NAME = "Version 1";
const DEFAULT_COMPANY_DESC = "Version 1 is an Irish technology company founded in 1996, specializing in international management consulting, software asset management, software development, cloud computing, and outsourcing services. The company is known for its strategic partnerships with technology leaders such as Oracle, Microsoft, and AWS, and focuses on delivering technology-enabled solutions that transform businesses. Version 1 has a strong commitment to customer success, empowered people, and a strong organization, guided by core values that emphasize truthfulness, accountability, and resilience.";
 
// ----- Country-City-Currency location data -----
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
 
const getCurrencyForLocation = (locStr) => {
  const entry = locations.find(
    (loc) => `${loc.country} - ${loc.city}` === locStr
  );
  return entry ? entry.currency : "";
};
 
const Description = ({ setJdData, jdData }) => {
  const navigate = useNavigate();
  const location = useLocation();
 
  const [sectionIndex, setSectionIndex] = useState(0);
 
  // Edit Mode State
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
 
  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
 
  // Simple validation error message
  const [validationError, setValidationError] = useState("");
 
  const [formData, setFormData] = useState(
    location.state?.jdData ||
      jdData || {
        jobTitle: "",
        department: "",
        jobType: "",
        location: "",
        experience: "",
        salary: "",
        salaryCurrency: "",
        openings: "",
        summary: "",
        responsibilities: "",
        requiredSkills: "",
        preferredSkills: "",
        education: "",
        specialization: "",
        companyName: DEFAULT_COMPANY_NAME, // was ""
        companyDescription: DEFAULT_COMPANY_DESC, // was ""
        hiringManagerName: "",
        contactEmail: "",
        postingDate: new Date().toISOString().split('T')[0],        deadline: "",
        workMode: "",
        status: "Open",
      }
  );
 
  // Fetch Data from Qdrant when editing
  useEffect(() => {
    const initEdit = async () => {
        if (location.state?.isEdit && location.state?.jobData) {
            setIsEdit(true);
            const job = location.state.jobData; // Data from the dashboard card
            setEditId(job.id);
 
            try {
                const res = await fetch(`${API_BASE_URL}/jobs/details/${job.id}/`, { credentials: "include" });
               
                if(res.ok) {
                    const data = await res.json();
                   
                    setFormData({
                        // ✅ FIX: Add '|| job.title' etc. as fallbacks
                        jobTitle: data.jobTitle || data.job_title || data.title || job.title || "",
                        department: data.department || data.dept || job.department || "",
                        jobType: data.jobType || data.job_type || data.type || job.type || "",
                        location: data.location || job.location || "",
                        salaryCurrency: getCurrencyForLocation(data.location || job.location || "") || "",
                       
                        summary: data.summary || data.job_description || data.description || job.description || "",
                        experience: data.experience || data.experience_required || data.exp || "",
                       
                        requiredSkills: Array.isArray(data.requiredSkills) ? data.requiredSkills.join(", ") :
                                       (Array.isArray(data.skills) ? data.skills.join(", ") :
                                       (Array.isArray(data.skills_required) ? data.skills_required.join(", ") :
                                       (data.requiredSkills || data.skills || data.skills_required || ""))),
                       
                        salary: data.salary || job.salary || "",
                        openings: data.openings || job.openings || "",
                       
                        responsibilities: data.responsibilities || "",
                        preferredSkills: data.preferredSkills || "",
                        education: data.education || "",
                        specialization: data.specialization || "",
                       
                        hiringManagerName: data.hiringManagerName || data.hiring_manager || job.creator_name || "",
                        contactEmail: data.contactEmail || data.contact_email || data.email || job.email || "",
                       
                        postingDate: data.postingDate || data.posting_date || new Date().toISOString().split('T')[0],
                        deadline: data.deadline || "",
                        workMode: data.workMode || data.work_mode || "",
                       
                        // Status fallback to ensure it doesn't revert
                        status: data.status || job.status || "Open",
 
                        // Company Defaults
                        companyName: data.companyName || data.company || DEFAULT_COMPANY_NAME,
                        companyDescription: data.companyDescription || DEFAULT_COMPANY_DESC,
                    });
                }
            } catch (e) {
          console.error("Error fetching job details:", e);
          setFormData((prev) => ({
            ...prev,
            jobTitle: job.title || "",
            department: job.department || "",
            location: job.location || "",
          }));
        }
      }
 
      if (location.state?.editSection !== undefined) {
        setSectionIndex(location.state.editSection);
      }
    };
 
    initEdit();
  }, [location.state]);
 
  const sections = [
    { id: 1, name: "Basic Information" },
    { id: 2, name: "Role Overview" },
    { id: 3, name: "Qualifications" },
    { id: 4, name: "Company & Contact" },
    { id: 5, name: "Additional Settings" },
  ];
 
  const dropdownOptions = {
    department: [
      "Engineering / IT",
      "Human Resources",
      "Sales & Marketing",
      "Finance & Accounting",
    ],
    jobType: ["Full-time", "Part-time", "Contract", "Internship"],
    education: ["Bachelor’s", "Master’s", "PhD"],
    workMode: ["On-site", "Hybrid", "Remote"],
    status: ["Open", "Closed", "Draft"],
  };
 
  const handleChange = (e) => {
    const { name, value } = e.target;
    setValidationError(""); // clear error as user types
 
    if (name === "location") {
      const currency = getCurrencyForLocation(value);
      setFormData((prev) => ({
        ...prev,
        location: value,
        salaryCurrency: currency,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };
 
  // ─── Validation helpers ────────────────────────────────────────────────
 
  const sectionFields = [
    [
      ["Job Title", "jobTitle"],
      ["Department", "department"],
      ["Job Type", "jobType"],
      ["Location", "location"],
      ["Experience", "experience"],
      ["Salary", "salary"],
      ["Openings", "openings"],
    ],
    [
      ["Summary", "summary", "textarea"],
      ["Responsibilities", "responsibilities", "textarea"], // 👈 Added "textarea"
      ["Required Skills", "requiredSkills", "textarea"],    // 👈 Added "textarea"
      ["Preferred Skills", "preferredSkills", "textarea"],  // 👈 Added "textarea"
    ],
    [["Education", "education"], ["Specialization", "specialization"]],
    [
      ["Company Name", "companyName"],
      ["Company Description", "companyDescription", "textarea"],
      ["Hiring Manager Name", "hiringManagerName"],
      ["Contact Email", "contactEmail"],
    ],
    [
      ["Posting Date", "postingDate", "date"],
      ["Deadline", "deadline", "date"],
      ["Work Mode", "workMode"],
      ["Status", "status"],
    ],
  ];
 
  const validateSection = (index) => {
    const fields = sectionFields[index];
    for (const [label, name] of fields) {
      if (["openings", "responsibilities", "preferredSkills", "specialization"].includes(name)) continue;
      const value = (formData[name] ?? "").toString().trim();
      if (!value) {
        setValidationError(`${label} is required.`);
        return false;
      }
    }
    setValidationError("");
    return true;
  };
 
  const validateAll = () => {
    for (let i = 0; i < sectionFields.length; i++) {
      if (!validateSection(i)) {
        setSectionIndex(i); // jump to first invalid section
        return false;
      }
    }
    return true;
  };
 
  const handleNext = () => {
    if (!validateSection(sectionIndex)) return;
 
    if (sectionIndex < sections.length - 1) {
      setSectionIndex(sectionIndex + 1);
    } else {
      setJdData(formData);
      navigate("/preview", { state: { jdData: formData } });
    }
  };
 
  const handleUpdate = async () => {
    if (!editId) return;
 
    // all sections must be valid before update
    if (!validateAll()) return;
 
    const skillsArray = formData.requiredSkills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
 
    const payload = {
      ...formData,
      job_title: formData.jobTitle,
      job_description: formData.summary,
      experience_required: formData.experience,
      skills: skillsArray,
    };
 
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/update/${editId}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
 
      if (!res.ok) throw new Error("Update failed");
 
      setShowSuccessModal(true);
    } catch (e) {
      alert("Update failed: " + e.message);
    }
  };
 
  const renderField = (label, name, type = "text") => {
    // if (type === "textarea") {
    //   return (
    //     <div className="flex items-start justify-between gap-6 w-full mb-4">
    //       <label className="text-base font-semibold text-[#0D1F29] w-1/5 text-right mt-3">
    //         {label}
    //         {!["responsibilities", "preferredSkills", "companyDescription"].includes(name) && (
    //             <span className="text-red-500"> *</span>
    //         )}
    //       </label>
    //       <textarea
    //         name={name}
    //         value={formData[name]}
    //         onChange={handleChange}
    //         placeholder={`Enter ${label.toLowerCase()}...`}
    //         className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#21B0BE] h-48 bg-white resize-y shadow-sm"
    //       />
    //     </div>
    //   );
    // }
    if (name === "location") {
      return (
        <div className="flex items-center justify-between gap-6 w-full mb-4">
          <label className="text-base font-semibold text-[#0D1F29] w-1/5 text-right">
            {label}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="flex-1 border border-gray-300 rounded-md p-2 bg-white text-[#0D1F29] focus:outline-none focus:ring-2 focus:ring-[#21B0BE]"
          >
            <option value="">Select Location</option>
            {locations.map((loc, idx) => (
              <option key={idx} value={`${loc.country} - ${loc.city}`}>
                {loc.country} - {loc.city}
              </option>
            ))}
          </select>
        </div>
      );
    }
 
    if (name === "salary") {
      return (
        <div className="flex items-center justify-between gap-6 w-full mb-4">
          <label className="text-base font-semibold text-[#0D1F29] w-1/5 text-right">
              {label} <span className="text-red-500">*</span> {/* ✅ Added Asterisk */}
          </label>
          <div className="flex-1 flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-[#21B0BE]">
            {formData.salaryCurrency && (
              <span className="px-3 py-2 bg-gray-100 text-[#0D1F29] font-semibold border-r border-gray-300">
                {formData.salaryCurrency}
              </span>
            )}
            <input
              type="text" // ✅ CHANGED from "number" to "text"
              name="salary"
              value={formData.salary}
              onChange={handleChange}
              // ✅ UPDATED placeholder to suggest a range
              placeholder={formData.salaryCurrency ? "e.g. 50,000 - 70,000" : "Select location first"}
              className="flex-1 p-2 text-[#0D1F29] outline-none bg-transparent"
            />
          </div>
        </div>
      );
    }
 
    const isDropdown = [
      "department",
      "jobType",
      "education",
      "workMode",
      "status",
    ].includes(name);
 
    return (
      <div className="flex items-center justify-between gap-6 w-full mb-4">
        <label className="text-base font-semibold text-[#0D1F29] w-1/5 text-right">
          {label}
         
          {/* ✅ FIX: Add ALL your optional fields to this list */}
          {![
              "openings",
              "specialization",
              "responsibilities",
              "preferredSkills",
            ].includes(name) && <span className="text-red-500"> *</span>}
        </label>
        {isDropdown ? (
          <select
            name={name}
            value={formData[name]}
            onChange={handleChange}
            className="flex-1 border border-gray-300 rounded-md p-2 bg-white text-[#0D1F29] focus:outline-none focus:ring-2 focus:ring-[#21B0BE]"
          >
            <option value="">Select {label}</option>
            {dropdownOptions[name].map((option, idx) => (
              <option key={idx} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            name={name}
            value={formData[name]}
            onChange={handleChange}
            className="flex-1 border border-gray-300 rounded-md p-2 text-[#0D1F29] focus:outline-none focus:ring-2 focus:ring-[#21B0BE] bg-white"
          />
        )}
      </div>
    );
  };
 
  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-10 bg-[#F5F5F5]">
      <h1 className="text-4xl font-bold mb-10 text-[#0D1F29]">
        {isEdit ? "Edit Job Description" : "Manual Job Description"}
      </h1>
 
      <div className="w-full max-w-[95%] bg-white rounded-2xl shadow-lg p-12 border border-gray-200">
        <div className="flex justify-between mb-10">
          {sections.map((section, i) => (
            <button
              key={section.id}
              onClick={() => setSectionIndex(i)}
              className={`flex-1 py-3 mx-1 font-semibold text-white rounded-md transition-all ${
                sectionIndex === i
                  ? "bg-gradient-to-r from-[#0F394D] to-[#21B0BE]"
                  : "bg-[#21B0BE] hover:bg-[#0F394D]"
              }`}
            >
              {section.name}
            </button>
          ))}
        </div>
 
        <h2 className="text-2xl font-semibold mb-6 text-[#0D1F29]">
          {sections[sectionIndex].name}
        </h2>
 
        <div className="space-y-5">
          {sectionFields[sectionIndex].map(([label, name, type]) =>
            renderField(label, name, type)
          )}
        </div>
 
        {validationError && (
          <p className="mt-4 text-red-600 font-medium">{validationError}</p>
        )}
 
        <div className="flex justify-end gap-4 mt-10">
          {sectionIndex > 0 && (
            <button
              onClick={() => setSectionIndex(sectionIndex - 1)}
              className="px-5 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
            >
              Previous
            </button>
          )}
 
          {sectionIndex < sections.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-full text-white font-semibold bg-gradient-to-r from-[#0F394D] to-[#21B0BE]"
            >
              Next
            </button>
          ) : isEdit ? (
            <button
              onClick={handleUpdate}
              className="px-6 py-2 rounded-full text-white font-bold bg-blue-600 hover:bg-blue-700 shadow-lg"
            >
              Update Job
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-full text-white font-semibold bg-gradient-to-r from-[#0F394D] to-[#21B0BE]"
            >
              Preview
            </button>
          )}
        </div>
      </div>
 
      {/* Success popup */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 border border-gray-100">
            <div className="flex flex-col items-center text-center">
              <div className="bg-[#E0F7FA] p-4 rounded-full mb-4 ring-4 ring-[#E0F7FA]/50">
                <CheckCircle
                  className="text-[#21B0BE]"
                  size={40}
                  strokeWidth={2.5}
                />
              </div>
 
              <h3 className="text-2xl font-bold text-[#0F394D] mb-2">
                Success!
              </h3>
              <p className="text-gray-500 mb-8 font-medium">
                The job description has been updated successfully.
              </p>
 
              <button
                onClick={() => navigate("/published-jds")}
                className="w-full py-3 rounded-xl bg-[#0F394D] text-white font-bold hover:bg-[#092532] shadow-lg shadow-gray-200 transition transform hover:scale-[1.02]"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
 
export default Description;
 
 
 