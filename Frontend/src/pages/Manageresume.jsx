// src/pages/Manageresume.jsx
 
import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Trash2,
  Eye,
  Loader,
  XCircle,
  Info,
  CheckCircle,
} from "lucide-react";
 
import { API_BASE_URL } from "../config";
import { useNavigate } from "react-router-dom";
 
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";
import GlobalHeader from "../components/sidebar/GlobalHeader";
 
const Manageresume = () => {
  const [resumes, setResumes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileRef = useRef(null);
  const navigate = useNavigate();
 
  // ================= DELETE MODAL =================
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
    onConfirm: () => {},
  });
 
  // ================= FETCH RESUMES =================
  const fetchResumes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/resumes/`);
      const data = await res.json();
      const list =
        data.results ??
        data.data ??
        data.items ??
        (Array.isArray(data) ? data : []);
      setResumes(list);
    } catch (err) {
      console.error("Error fetching resumes:", err);
    } finally {
      setIsLoading(false);
    }
  };
 
  useEffect(() => {
    fetchResumes();
  }, []);
 
  const confirmDelete = async (id) => {
    setModalState({ ...modalState, isOpen: false });
 
    try {
      await fetch(`${API_BASE_URL}/resumes/delete/${id}/`, {
        method: "DELETE",
      });
 
      setModalState({
        isOpen: true,
        title: "Deleted!",
        message: "The resume has been successfully deleted.",
        type: "success",
      });
 
      fetchResumes();
    } catch (err) {
      setModalState({
        isOpen: true,
        title: "Delete Failed",
        message: "An error occurred while deleting the resume.",
        type: "error",
      });
    }
  };
 
  const handleDelete = (id) => {
    setModalState({
      isOpen: true,
      title: "Delete Resume",
      message: "Are you sure you want to delete this resume?",
      type: "confirm",
      onConfirm: () => confirmDelete(id),
    });
  };
 
  const openFullView = (resume) => {
    let fileName =
      resume.file_name ||
      resume.readable_file_name ||
      resume.s3_url?.split("/").pop();
 
    if (!fileName) {
      alert("Cannot open: Missing file name");
      return;
    }
 
    const viewUrl = `${API_BASE_URL}/view_resume/?file_name=${encodeURIComponent(
      fileName
    )}`;
    window.open(viewUrl, "_blank");
  };
 
  return (
    <div className="min-h-screen flex flex-col bg-[#E9F1F4]">
 
      {/* ⭐ GLOBAL HEADER */}
      <GlobalHeader />
 
      {/* ⭐ BODY BELOW HEADER */}
      <div className="flex flex-1 pt-[24px]">
 
        {/* ⭐ SIDEBAR */}
        <RecruiterSidebar active="Manage Resume" />
 
        {/* ===================== MAIN CONTENT ===================== */}
        <main className="flex-1 p-10 transition-all duration-300 ml-72 relative">
 
          {/* BACK BUTTON BELOW HEADER
          <button
            onClick={() => navigate("/")}
            className="absolute top-[96px] right-8 bg-gradient-to-r from-[#073C4D] to-[#19A8B6]
                       text-white px-5 py-2 rounded-full shadow-md hover:opacity-90 transition-all z-10"
          >
            Back
          </button> */}
 
          {/* PAGE HEADER */}
          <div className="flex justify-between items-center mb-10 mt-12">
            <div>
              <h1 className="text-3xl font-bold text-[#0D1F29]">
                Manage Resumes
              </h1>
              <p className="text-gray-600">
                View, upload, and manage resumes.
              </p>
            </div>
          </div>
 
          {/* Resume Cards */}
          {isLoading ? (
            <div className="flex justify-center items-center mt-20">
              <Loader className="w-12 h-12 text-[#21B0BE] animate-spin" />
            </div>
          ) : resumes.length === 0 ? (
            <p className="text-center text-gray-500 mt-20">
              No resumes found.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resumes.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl p-6 shadow hover:shadow-xl transition"
                >
                  <div className="flex gap-3 mb-3">
                    <FileText size={28} className="text-[#0F394D]" />
                    <div>
                      <h3 className="text-lg font-semibold">
                        {r.candidate_name || r.name}
                      </h3>
                      <p className="text-sm text-gray-600">{r.email}</p>
                    </div>
                  </div>
 
                  <p className="text-sm text-gray-700">
                    <b>Experience:</b> {r.experience_years} yrs
                  </p>
                  <p className="text-sm text-gray-700">
                    <b>CPD Level:</b> {r.cpd_level}
                  </p>
                  <p className="text-sm text-gray-700">
                    <b>File:</b> {r.file_name}
                  </p>
 
                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => openFullView(r)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md
                                 flex items-center justify-center gap-2 text-sm hover:bg-gray-50"
                    >
                      <Eye size={16} /> Full View
                    </button>
 
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="flex-1 px-3 py-2 border border-red-500 text-red-600 rounded-md
                                 flex items-center justify-center gap-2 text-sm hover:bg-red-50"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
 
      {/* ======================== MODAL ======================== */}
      <CustomAlertModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onConfirm={modalState.onConfirm}
      />
    </div>
  );
};
 
/* ===============================================================
                          MODAL COMPONENT
   =============================================================== */
const CustomAlertModal = ({
  isOpen,
  title,
  message,
  type = "info",
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;
 
  const icons = {
    success: <CheckCircle className="w-12 h-12 text-green-500" />,
    error: <XCircle className="w-12 h-12 text-red-500" />,
    info: <Info className="w-12 h-12 text-[#21B0BE]" />,
    confirm: <XCircle className="w-12 h-12 text-red-500" />,
  };
 
  const isConfirm = type === "confirm";
 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 rounded-2xl bg-white shadow-xl">
 
        <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-gray-100">
          {icons[type]}
        </div>
 
        <h3 className="text-xl font-semibold text-center mt-4">{title}</h3>
 
        <p className="text-sm text-gray-600 text-center mt-2 whitespace-pre-line">
          {message}
        </p>
 
        <div className={`mt-6 ${isConfirm ? "flex gap-3" : ""}`}>
          {isConfirm ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Yes, Delete
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className={`w-full px-4 py-2 text-white rounded-lg ${
                type === "error"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gradient-to-r from-[#073C4D] to-[#19A8B6] hover:opacity-90"
              }`}
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
 
export default Manageresume;
 
 