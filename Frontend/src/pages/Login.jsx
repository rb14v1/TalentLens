import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post(`${API_BASE_URL}/login/`, form, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true, // keep session cookie
      });

      // 1. Get data from response
      const { role, name, department } = res.data;

      // 2. Save to localStorage
      localStorage.setItem(
        "user",
        JSON.stringify({
          name: name || "User",
          email: form.email,
          role: role,
          department: department || "",
        })
      );

      // ✅ NEW: store userEmail separately for JD Matcher
      localStorage.setItem("userEmail", form.email);

      // 3. Redirect based on role
      if (role === "manager") {
        navigate("/HiringManagerPage");
      } else if (role === "recruiter") {
        navigate("/home");
      } else if (role === "hiring_manager") {
        navigate("/managerpage");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials.");
    }
  };

  return (
    <div className="flex h-screen w-full">
      {/* LEFT GRADIENT PANEL */}
      <div className="hidden md:flex w-1/3 bg-gradient-to-b from-[#0F394D] to-[#21B0BE] items-center justify-center text-white p-8">
        <div>
          <h1 className="text-4xl font-bold mb-4">Welcome Back!</h1>
          <p className="text-lg text-teal-100">
            Manage your recruitment process efficiently.
          </p>
        </div>
      </div>

      {/* RIGHT LOGIN FORM */}
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
          <h2 className="text-3xl font-bold text-[#0F394D] mb-2">Login</h2>
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
            Don't have an account?{" "}
            <a
              href="/register"
              className="text-blue-600 font-semibold hover:underline"
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
