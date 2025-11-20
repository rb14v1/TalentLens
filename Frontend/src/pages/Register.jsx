import React, { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";
 
function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "recruiter",
  });
 
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
 
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
 
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
 
    try {
      await axios.post(`${API_BASE_URL}/register/`, form);
      setSuccess("Registration successful. Redirecting to login...");
 
        setTimeout(() => {
        window.location.href = "/login";
        }, 1200);
 
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    }
  };
 
  return (
    <div className="flex h-screen w-full">
     
      {/* LEFT PANEL */}
      <div className="hidden md:flex w-1/3 bg-gradient-to-b from-[#004e92] via-[#015f72] to-[#00A8A8] text-white flex-col justify-center px-10">
        <h1 className="text-5xl font-bold">ProMatch</h1>
        <p className="text-lg mt-3 opacity-90">Smart Hiring Platform</p>
      </div>
 
      {/* RIGHT FORM */}
      <div className="flex w-full md:w-2/3 justify-center items-center bg-gray-100">
        <div className="bg-white w-96 p-8 rounded-xl shadow-xl">
 
          <h2 className="text-3xl font-bold mb-1">Create Account</h2>
          <p className="text-gray-500 mb-4">Register to continue</p>
 
          {error && <p className="text-red-600 font-semibold mb-3">{error}</p>}
          {success && <p className="text-green-600 font-semibold mb-3">{success}</p>}
 
          <form onSubmit={handleRegister}>
 
            {/* NAME FIELD */}
            <label className="font-semibold">Full Name</label>
            <input
              type="text"
              name="name"
              className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring focus:ring-blue-300"
              placeholder="Enter your full name"
              value={form.name}
              onChange={handleChange}
              required
            />
 
            <label className="font-semibold mt-4 block">Email</label>
            <input
              type="email"
              name="email"
              className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring focus:ring-blue-300"
              placeholder="example@gmail.com"
              value={form.email}
              onChange={handleChange}
              required
            />
 
            <label className="font-semibold mt-4 block">Password</label>
            <input
              type="password"
              name="password"
              className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring focus:ring-blue-300"
              placeholder="Enter strong password"
              value={form.password}
              onChange={handleChange}
              required
            />
 
            <label className="font-semibold mt-4 block">Select Role</label>
            <select
              name="role"
              className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring focus:ring-blue-300"
              value={form.role}
              onChange={handleChange}
            >
              <option value="recruiter">Recruiter</option>
              <option value="manager">Manager</option>
              <option value="hiring_manager">Hiring Manager</option>
            </select>
 
            <button
              type="submit"
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold"
            >
              Register
            </button>
          </form>
 
          <p className="text-center mt-4 text-sm">
            Already have an account?{" "}
            <a href="/login" className="text-blue-600 font-semibold">
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
 
export default Register;