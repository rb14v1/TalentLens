import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const Preview = ({ jdData, setJdData }) => {
  const navigate = useNavigate();
  const pdfRef = useRef();

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

  // ✅ Save as PDF
  const handleDownloadPDF = async () => {
    const input = pdfRef.current;
    const canvas = await html2canvas(input, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${jdData.jobTitle || "Job_Description"}.pdf`);
  };

  // ✅ Save Draft
  const handleSaveDraft = () => {
    const drafts = JSON.parse(localStorage.getItem("jdDrafts") || "[]");
    const updatedDrafts = [...drafts, { ...jdData, id: Date.now() }];
    localStorage.setItem("jdDrafts", JSON.stringify(updatedDrafts));
    alert("JD saved as draft successfully!");
  };

  // ✅ Publish JD
  const handlePublish = () => {
    const publishedJDs = JSON.parse(localStorage.getItem("publishedJDs") || "[]");
    publishedJDs.push({ ...jdData, id: Date.now() });
    localStorage.setItem("publishedJDs", JSON.stringify(publishedJDs));
    setJdData(null);
    navigate("/dashboard");
  };

  // ✅ Edit Section Navigation
  const handleEditSection = (sectionIndex) => {
    navigate("/description", { state: { editSection: sectionIndex } });
  };

  // ✅ Section Grouping (for better layout)
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
      fields: ["companyName", "companyDescription", "contactEmail"],
    },
    {
      title: "Additional Settings",
      fields: ["postingDate", "deadline", "workMode", "status"],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-10 bg-[#F5F5F5]">
      <h1 className="text-4xl font-bold mb-10 text-[#0D1F29]">
        Job Description Preview
      </h1>

      <div className="w-full max-w-[95%] bg-white rounded-2xl shadow-lg border border-gray-200 p-10 flex">
        {/* Left Side (Preview Content) */}
        <div
          ref={pdfRef}
          className="flex-1 bg-[#FAFAFA] rounded-lg shadow-inner p-8 overflow-y-auto h-[75vh]"
        >
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
                    <p key={field} className="text-[#0D1F29] mb-2 leading-relaxed">
                      <strong>
                        {field.replace(/([A-Z])/g, " $1").trim()}:
                      </strong>{" "}
                      {jdData[field]}
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
    </div>
  );
};

export default Preview;
