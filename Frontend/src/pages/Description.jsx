import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

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
  const [formData, setFormData] = useState(
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
      status: "",
    }
  );

  useEffect(() => {
    if (location.state?.editSection !== undefined) {
      setSectionIndex(location.state.editSection);
    }
  }, [location.state]);

  const sections = [
    { id: 1, name: "Basic Information" },
    { id: 2, name: "Role Overview" },
    { id: 3, name: "Qualifications" },
    { id: 4, name: "Company & Contact" },
    { id: 5, name: "Additional Settings" },
  ];

  // Department dropdown options
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
    status: ["Active", "Closed", "Draft"],
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

  const renderField = (label, name, type = "text") => {
    // --- Custom: Location Dropdown ---
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
              <option
                key={idx}
                value={`${loc.country} - ${loc.city}`}
              >
                {loc.country} - {loc.city}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // --- Custom: Salary field with currency ---
    // --- Custom: Salary field with currency (Professional styling) ---
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


    // --- Dropdowns for other fields ---
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
        Manual Job Description
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
          <button
            onClick={handleNext}
            className="px-5 py-2 rounded-full text-white font-semibold bg-gradient-to-r from-[#0F394D] to-[#21B0BE]"
          >
            {sectionIndex < sections.length - 1 ? "Next" : "Preview"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Description;
