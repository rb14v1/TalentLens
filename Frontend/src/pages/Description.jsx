import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { CheckCircle } from "lucide-react"; // ✅ 1. ADD THIS IMPORT
 
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
 
  // ✅ 2. NEW STATE FOR SUCCESS MODAL
  const [showSuccessModal, setShowSuccessModal] = useState(false);
 
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
      companyName: "",
      companyDescription: "",
      hiringManagerName: "",
      contactEmail: "",
      postingDate: "",
      deadline: "",
      workMode: "",
      status: "Open",
    }
  );
 
  // Fetch Data from Qdrant when editing
  useEffect(() => {
    const initEdit = async () => {
        if (location.state?.isEdit && location.state?.jobData) {
            setIsEdit(true);
            const job = location.state.jobData;
            setEditId(job.id);
 
            try {
                const res = await fetch(`${API_BASE_URL}/jobs/details/${job.id}/`, { credentials: "include" });
               
                if(res.ok) {
                    const data = await res.json();
                   
                    setFormData({
                        jobTitle: data.jobTitle || data.job_title || data.title || "",
                        department: data.department || data.dept || "",
                        jobType: data.jobType || data.job_type || data.type || "",
                        location: data.location || "",
                        salaryCurrency: getCurrencyForLocation(data.location || "") || "",
                        summary: data.summary || data.job_description || data.description || "",
                        experience: data.experience || data.experience_required || data.exp || "",
                        requiredSkills: Array.isArray(data.requiredSkills) ? data.requiredSkills.join(", ") :
                                       (Array.isArray(data.skills) ? data.skills.join(", ") :
                                       (Array.isArray(data.skills_required) ? data.skills_required.join(", ") :
                                       (data.requiredSkills || data.skills || data.skills_required || ""))),
                        salary: data.salary || "",
                        openings: data.openings || "",
                        responsibilities: data.responsibilities || "",
                        preferredSkills: data.preferredSkills || "",
                        education: data.education || "",
                        specialization: data.specialization || "",
                        companyName: data.companyName || data.company || "",
                        companyDescription: data.companyDescription || "",
                        hiringManagerName: data.hiringManagerName || data.hiring_manager || "",
                        contactEmail: data.contactEmail || data.contact_email || data.email || "",
                        postingDate: data.postingDate || data.posting_date || "",
                        deadline: data.deadline || "",
                        workMode: data.workMode || data.work_mode || "",
                        status: data.status || "Open",
                    });
                }
            } catch (e) {
                console.error("Error fetching job details:", e);
                setFormData(prev => ({
                    ...prev,
                    jobTitle: job.title || "",
                    department: job.department || "",
                    location: job.location || ""
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
 
  const handleNext = () => {
    if (sectionIndex < sections.length - 1) {
      setSectionIndex(sectionIndex + 1);
    } else {
      setJdData(formData);
      navigate("/preview", { state: { jdData: formData } });
    }
  };
 
  // ✅ 3. MODIFIED UPDATE FUNCTION (Shows Modal instead of Alert)
  const handleUpdate = async () => {
    if (!editId) return;
 
    const skillsArray = formData.requiredSkills.split(",").map(s => s.trim()).filter(Boolean);
 
    const payload = {
        ...formData,
        job_title: formData.jobTitle,      
        job_description: formData.summary,
        experience_required: formData.experience,
        skills: skillsArray
    };
 
    try {
        const res = await fetch(`${API_BASE_URL}/jobs/update/${editId}/`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });
 
        if (!res.ok) throw new Error("Update failed");
 
        // Show Custom Modal instead of Browser Alert
        setShowSuccessModal(true);
       
    } catch (e) {
        alert("Update failed: " + e.message);
    }
  };
 
  const renderField = (label, name, type = "text") => {
    if (name === "location") {
      return (
        <div className="flex items-center justify-between gap-6 w-full mb-4">
          <label className="text-base font-semibold text-[#0D1F29] w-1/5 text-right">
            {label}
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
            {label}
          </label>
          <div className="flex-1 flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-[#21B0BE]">
            {formData.salaryCurrency && (
              <span className="px-3 py-2 bg-gray-100 text-[#0D1F29] font-semibold border-r border-gray-300">
                {formData.salaryCurrency}
              </span>
            )}
            <input
              type="number"
              name="salary"
              value={formData.salary}
              onChange={handleChange}
              placeholder={formData.salaryCurrency ? "Enter amount" : "Select location first"}
              className="flex-1 p-2 text-[#0D1F29] outline-none bg-transparent"
            />
          </div>
        </div>
      );
    }
 
    const isDropdown = ["department", "jobType", "education", "workMode", "status"].includes(name);
 
    return (
      <div className="flex items-center justify-between gap-6 w-full mb-4">
        <label className="text-base font-semibold text-[#0D1F29] w-1/5 text-right">
          {label}
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
      ["Summary", "summary"],
      ["Responsibilities", "responsibilities"],
      ["Required Skills", "requiredSkills"],
      ["Preferred Skills", "preferredSkills"],
    ],
    [["Education", "education"], ["Specialization", "specialization"]],
    [
      ["Company Name", "companyName"],
      ["Company Description", "companyDescription"],
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
          ) : (
             isEdit ? (
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
             )
          )}
        </div>
      </div>
 
      {/* ✅ 4. CUSTOM SUCCESS POPUP (Matches App Colors) */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 transform transition-all scale-100 border border-gray-100">
            <div className="flex flex-col items-center text-center">
              {/* Icon Container */}
              <div className="bg-[#E0F7FA] p-4 rounded-full mb-4 ring-4 ring-[#E0F7FA]/50">
                <CheckCircle className="text-[#21B0BE]" size={40} strokeWidth={2.5} />
              </div>
             
              {/* Text */}
              <h3 className="text-2xl font-bold text-[#0F394D] mb-2">Success!</h3>
              <p className="text-gray-500 mb-8 font-medium">
                The job description has been updated successfully.
              </p>
             
              {/* Button */}
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
 