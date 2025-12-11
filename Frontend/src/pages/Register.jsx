import React, { useState } from "react";

import axios from "axios";

import { API_BASE_URL } from "../config";

import version1Banner from "../assets/version1-banner.png"; // ⭐ ADD IMAGE
 
function Register() {

  const [form, setForm] = useState({

    name: "",

    email: "",

    password: "",

    role: "",

    department: "",

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
 
    const payload = {

      name: form.name,

      email: form.email,

      password: form.password,

      role: form.role,

      department: form.role === "hiring_manager" ? form.department : null,

    };
 
    try {

      await axios.post(`${API_BASE_URL}/register/`, payload);
 
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

      {/* ⭐ LEFT SIDE IMAGE PANEL */}
<div className="hidden md:flex w-1/2 items-center justify-center bg-[#0A1E28]">
<img

          src={version1Banner}

          alt="Version1 Banner"

          className="w-[85%] object-contain"

        />
</div>
 
      {/* RIGHT SIDE REGISTER FORM */}
<div className="flex w-full md:w-1/2 justify-center items-center bg-gray-100">
<div className="bg-white w-96 p-8 rounded-xl shadow-xl">
<h2 className="text-3xl font-bold mb-1 text-[#0F394D]">Create Account</h2>
<p className="text-gray-500 mb-4">Register to continue</p>
 
          {error && <p className="text-red-600 font-semibold mb-3">{error}</p>}

          {success && <p className="text-green-600 font-semibold mb-3">{success}</p>}
 
          <form onSubmit={handleRegister}>

            {/* NAME */}
<label className="font-semibold">Full Name</label>
<input

              type="text"

              name="name"

              className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring focus:ring-[#14D3D3]"

              placeholder="Enter your full name"

              value={form.name}

              onChange={handleChange}

              required

            />
 
            {/* EMAIL */}
<label className="font-semibold mt-4 block">Email</label>
<input

              type="email"

              name="email"

              className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring focus:ring-[#14D3D3]"

              placeholder="example@gmail.com"

              value={form.email}

              onChange={handleChange}

              required

            />
 
            {/* PASSWORD */}
<label className="font-semibold mt-4 block">Password</label>
<input

              type="password"

              name="password"

              className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring focus:ring-[#14D3D3]"

              placeholder="Enter strong password"

              value={form.password}

              onChange={handleChange}

              required

            />
 
            {/* ROLE */}
<label className="font-semibold mt-4 block">Select Role</label>
<select

              name="role"

              className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring focus:ring-[#14D3D3]"

              value={form.role}

              onChange={handleChange}

              required
>
<option value="">Select a role</option>
<option value="recruiter">Recruiter</option>
<option value="manager">Manager</option>
<option value="hiring_manager">Hiring Manager</option>
</select>
 
            {/* DEPARTMENT - ONLY IF HIRING MANAGER */}

            {form.role === "hiring_manager" && (
<>
<label className="font-semibold mt-4 block">Department</label>
<select

                  name="department"

                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring focus:ring-[#14D3D3]"

                  value={form.department}

                  onChange={handleChange}

                  required
>
<option value="">Select Department</option>
<option value="engineering_it">Engineering / IT</option>
<option value="hr">Human Resources</option>
<option value="sales_marketing">Sales & Marketing</option>
<option value="finance_accounting">Finance & Accounting</option>
</select>
</>

            )}
 
            {/* SUBMIT BUTTON WITH YOUR TEAL BRAND COLOR */}
<button

              type="submit"

              className="w-full mt-6 bg-[#14D3D3] hover:bg-[#11BFC0] text-white py-2 rounded-lg font-semibold transition"
>

              Register
</button>
</form>
 
          <p className="text-center mt-4 text-sm">

            Already have an account?{" "}
<a href="/login" className="text-[#14D3D3] font-semibold hover:underline">

              Login
</a>
</p>
</div>
</div>
</div>

  );

}
 
export default Register;

 