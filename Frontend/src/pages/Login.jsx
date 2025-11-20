import React, { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";
 
function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
 
  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });
 
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
 
    try {
      const res = await axios.post(`${API_BASE_URL}/login/`, form);
      const role = res.data.role;
 
      // Your custom redirection
      if (role === "manager") {
        window.location.href = "/HiringManagerPage";
      } else if (role === "recruiter") {
        window.location.href = "/";
      } else if (role === "hiring_manager") {
        window.location.href = "/Managerpage";
      }
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials.");
    }
  };
 
  return (
    <div className="flex h-screen w-full">
     
      {/* LEFT GRADIENT PANEL */}
      <div className="hidden md:flex w-1/3 bg-gradient-to-b from-[#004e92] via-[#015f72] to-[#00A8A8] text-white flex-col justify-center px-10">
        <h1 className="text-5xl font-bold">ProMatch</h1>
        <p className="text-lg mt-3 opacity-90">Smart Hiring Platform</p>
      </div>
 
      {/* RIGHT LOGIN FORM */}
      <div className="flex w-full md:w-2/3 justify-center items-center bg-gray-100">
        <div className="bg-white w-96 p-8 rounded-xl shadow-xl">
 
          <h2 className="text-3xl font-bold mb-1">Welcome Back 👋</h2>
          <p className="text-gray-500 mb-4">Login to continue</p>
 
          {error && (
            <p className="text-red-600 font-semibold mb-3">{error}</p>
          )}
 
          <form onSubmit={handleLogin}>
 
            <label className="font-semibold">Email</label>
            <input
              type="email"
              name="email"
              className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring focus:ring-blue-300"
              placeholder="example@gmail.com"
              onChange={handleChange}
              required
            />
 
            <label className="font-semibold mt-4 block">Password</label>
            <input
              type="password"
              name="password"
              className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring focus:ring-blue-300"
              placeholder="Enter password"
              onChange={handleChange}
              required
            />
 
            <button
              type="submit"
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition"
            >
              Login
            </button>
          </form>
 
          <p className="text-center mt-4 text-sm">
            Don’t have an account?{" "}
            <a href="/register" className="text-blue-600 font-semibold">
              Register
            </a>
          </p>
 
        </div>
      </div>
    </div>
  );
}
 
export default Login;
 
 
 