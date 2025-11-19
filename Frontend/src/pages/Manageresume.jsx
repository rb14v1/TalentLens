import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Trash2,
  Eye,
  Settings,
  Grid,
  User,
  Plus,
  Loader,
  XCircle, // <-- ADDED for error/confirm
  Info,      // <-- ADDED for info
  CheckCircle, // <-- ADDED for success
} from "lucide-react";
import { API_BASE_URL } from "../config";
import { useNavigate } from "react-router-dom";

const Manageresume = () => {
  const [resumes, setResumes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileRef = useRef(null);
  const navigate = useNavigate();

  // --- ✅ NEW: State for our custom modal ---
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info", // 'info', 'success', 'error', or 'confirm'
    onConfirm: () => {}, // Function to run if "Yes" is clicked
  });
  // ------------------------------------------

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

  // --- (Upload functions are unchanged) ---
  const handleUpload = () => fileRef.current?.click();

  const handleFileChange = async (e) => {
    // ... (rest of your function)
  };
  
  const handleRemoveFile = (index) => {
    // ... (rest of your function)
  };


  // =====================================================
  // 🔥 MODIFIED: Delete functions now use the custom modal
  // =====================================================
  
  // This new function runs the actual delete
  const confirmDelete = async (id) => {
    setModalState({ ...modalState, isOpen: false }); // Close the modal first

    try {
      await fetch(`${API_BASE_URL}/resumes/delete/${id}/`, {
        method: "DELETE",
      });

      // Show success pop-up
      setModalState({
        isOpen: true,
        title: "Deleted!",
        message: "The resume has been successfully deleted.",
        type: "success",
      });
      fetchResumes(); // Refresh the list

    } catch (err) {
      console.error("Delete failed:", err);
      // Show error pop-up
      setModalState({
        isOpen: true,
        title: "Delete Failed",
        message: "An error occurred while trying to delete the resume.",
        type: "error",
      });
    }
  };
  
  // This function OPENS the modal
  const handleDelete = (id) => {
    setModalState({
      isOpen: true,
      title: "Delete Resume",
      message: "Are you sure you want to delete this resume? This action cannot be undone.",
      type: "confirm", // This will show "Yes" and "No" buttons
      onConfirm: () => confirmDelete(id), // Set the function to run on "Yes"
    });
  };

  // -------------------------------------------------
  // Full View (Unchanged)
  // -------------------------------------------------
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
    <> {/* <-- ✅ WRAPPED in a Fragment */}
      <div className="min-h-screen flex bg-[#E9F1F4]">
        {/* Sidebar (Unchanged) */}
        <aside className="w-80 bg-gradient-to-b from-[#0F394D] to-[#21B0BE] text-white flex flex-col shadow-lg">
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-semibold">Manager Panel</h2>
          </div>
          <div className="flex-1 p-4 space-y-2">
            <div className="p-3 hover:bg-white/10 rounded-lg flex items-center gap-3 cursor-pointer">
              <Grid size={18} /> Dashboard
            </div>
            <div
              onClick={() => navigate("/retrieve")}
              className="p-3 hover:bg-white/10 rounded-lg flex items-center gap-3 cursor-pointer"
            >
              Retrieve
            </div>
            <div
              onClick={() => navigate("/manageresume")}
              className="p-3 bg-white/10 rounded-lg flex items-center gap-3 cursor-pointer"
            >
              Manage Resume
            </div>
            <div className="p-3 hover:bg-white/10 rounded-lg flex items-center gap-3 cursor-pointer">
              <Settings size={18} /> Settings
            </div>
          </div>
          <div className="p-5 border-t border-white/20 flex gap-3 items-center">
            <img
              src="https://randomuser.me/api/portraits/men/65.jpg"
              className="w-10 h-10 rounded-full border"
              alt="profile"
            />
            <div>
              <p className="font-semibold">Alex Green</p>
              <p className="text-sm text-teal-100">Engineering Manager</p>
            </div>
            <User size={18} />
          </div>
        </aside>

        {/* Main Content (Unchanged) */}
        <main className="flex-1 p-10">
          <button
            onClick={() => navigate("/")}
            className="absolute top-8 right-8 bg-gradient-to-r from-[#0F394D] to-[#21B0BE] text-white px-5 py-2 rounded-full shadow-md hover:opacity-90 transition-all flex items-center gap-2 z-30"
          >
            Back
          </button>

          <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-bold text-[#0D1F29]">
                Manage Resumes
              </h1>
              <p className="text-gray-600">View, upload, and manage resumes.</p>
            </div>
          </div>

          {/* Resume Cards (Loading logic is unchanged) */}
          {isLoading ? (
            <div className="flex justify-center items-center mt-20">
              <Loader className="w-12 h-12 text-[#21B0BE] animate-spin" />
            </div>
          ) : resumes.length === 0 ? (
            <p className="text-center text-gray-500 mt-20">No resumes found.</p>
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
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md flex items-center justify-center gap-2 text-sm hover:bg-gray-50 transition"
                    >
                      <Eye size={16} /> Full View
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)} // This now opens the modal
                      className="flex-1 px-3 py-2 border border-red-500 text-red-600 rounded-md flex items-center justify-center gap-2 text-sm hover:bg-red-50 transition"
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

      {/* --- ✅ NEW: Add the Modal component here --- */}
      <CustomAlertModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onConfirm={modalState.onConfirm}
      />
    </>
  );
};

// =====================================================
// ✅ NEW: THE CUSTOM MODAL COMPONENT (with confirm)
// =====================================================
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
    confirm: <XCircle className="w-12 h-12 text-red-500" />, // Use red icon for delete confirm
  };

  const isConfirm = type === "confirm";

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Modal Panel */}
      <div className="relative w-full max-w-md p-6 bg-white rounded-2xl shadow-xl border border-gray-200 m-4">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          {icons[type]}
        </div>

        {/* Content */}
        <div className="mt-4 text-center">
          <h3 className="text-xl font-semibold leading-6 text-[#0F394D]" id="modal-title">
            {title}
          </h3>
          <div className="mt-2">
            <p className="text-sm text-gray-600 whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className={`mt-6 ${isConfirm ? "flex gap-3" : ""}`}>
          {isConfirm ? (
            <>
              <button
                type="button"
                className="flex-1 inline-flex justify-center rounded-lg shadow-sm px-4 py-2 text-base font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 inline-flex justify-center rounded-lg shadow-sm px-4 py-2 text-base font-medium text-white bg-red-600 hover:bg-red-700 transition"
                onClick={onConfirm}
              >
                Yes, Delete
              </button>
            </>
          ) : (
            <button
              type="button"
              className={`w-full inline-flex justify-center rounded-lg shadow-sm px-4 py-2 text-base font-medium text-white transition ${
                type === "error" ? "bg-red-600 hover:bg-red-700" : "bg-gradient-to-r from-[#0F394D] to-[#21B0BE] hover:opacity-90"
              }`}
              onClick={onClose}
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