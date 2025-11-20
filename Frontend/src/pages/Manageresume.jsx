import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Trash2,
  Eye,
  Loader,
  XCircle,
  Info,
  CheckCircle,
  Upload,
  Search,
  LayoutDashboard,
  FileText as FileIcon,
  SearchCheck,
} from "lucide-react";
 
import { API_BASE_URL } from "../config";
import { useNavigate } from "react-router-dom";
 
const Manageresume = () => {
  const [resumes, setResumes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileRef = useRef(null);
  const navigate = useNavigate();
 
  // ================= ACTIVE SIDEBAR STATE =================
  const [active, setActive] = useState("Manage Resume");
 
  // ================= USER DATA =================
  const [user, setUser] = useState({
    name: "",
    role: "",
    profile_image: "",
  });
 
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/user/profile/", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.log("Error fetching user:", err);
      }
    };
    fetchUser();
  }, []);
 
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
 
  // ================= DELETE MODAL =================
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
    onConfirm: () => {},
  });
 
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
    <>
      <div className="min-h-screen flex bg-[#E9F1F4]">
 
        {/* ========================================================= */}
        {/*                  FIXED SIDEBAR (UPDATED)                */}
        {/* ========================================================= */}
        <aside className="w-70 fixed left-0 top-0 h-full bg-gradient-to-b
                          from-[#073C4D] to-[#19A8B6] text-white shadow-xl flex flex-col">
 
          {/* Header */}
          <div className="p-7 border-b border-white/10">
            <h2 className="text-2xl font-bold tracking-wide">Recruiter Panel</h2>
            <p className="text-sm text-teal-100 mt-1">Quick Navigation</p>
          </div>
 
          {/* Sidebar Menu */}
          <div className="p-6 flex-1 space-y-3">
 
            <SidebarItem
              icon={<Upload size={18} />}
              label="Upload"
              active={active}
              onClick={() => {
                setActive("Upload");
                navigate("/upload");
              }}
            />
 
            <SidebarItem
              icon={<Search size={18} />}
              label="Retrieve"
              active={active}
              onClick={() => {
                setActive("Retrieve");
                navigate("/retrieve");
              }}
            />
 
            <SidebarItem
              icon={<LayoutDashboard size={18} />}
              label="Dashboard"
              active={active}
              onClick={() => {
                setActive("Dashboard");
                navigate("/recruiterdashboard");
              }}
            />
 
            <SidebarItem
              icon={<FileIcon size={18} />}
              label="Manage Resume"
              active={active}
              onClick={() => {
                setActive("Manage Resume");
                navigate("/manageresume");
              }}
            />
 
            <SidebarItem
              icon={<SearchCheck size={18} />}
              label="JD Matcher"
              active={active}
              onClick={() => {
                setActive("JD Matcher");
                navigate("/jobdescriptionmatch");
              }}
            />
          </div>
 
          {/* Profile */}
          <div className="p-5 border-t border-white/10 flex items-center gap-4
                          bg-gradient-to-r from-[#073C4D] to-[#19A8B6] shadow-inner">
 
            <div className="w-12 h-12 rounded-full border-2 border-white/70 shadow-lg
                            flex items-center justify-center bg-white/10 overflow-hidden">
              {user.profile_image ? (
                <img
                  src={user.profile_image}
                  alt="User"
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
 
            <div>
              <p className="font-semibold">{user.name || "Loading..."}</p>
              <p className="text-sm text-teal-100">{user.role || "Fetching role..."}</p>
            </div>
          </div>
        </aside>
 
        {/* ===================== MAIN CONTENT ===================== */}
        <main className="flex-1 ml-72 p-10">
 
          <button
            onClick={() => navigate("/")}
            className="absolute top-8 right-8 bg-gradient-to-r from-[#073C4D] to-[#19A8B6]
                       text-white px-5 py-2 rounded-full shadow-md hover:opacity-90"
          >
            Back
          </button>
 
          <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-bold text-[#0D1F29]">Manage Resumes</h1>
              <p className="text-gray-600">View, upload, and manage resumes.</p>
            </div>
          </div>
 
          {/* Resume Cards */}
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
    </>
  );
};
 
/* ===============================================================
                      SIDEBAR ITEM COMPONENT
   =============================================================== */
const SidebarItem = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-4 p-3 w-full text-lg font-medium rounded-xl transition-all
      ${
        active === label
          ? "bg-white text-[#073C4D] shadow-lg"
          : "hover:bg-white/20 text-white"
      }
    `}
  >
    {icon}
    {label}
  </button>
);
 
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
 
 