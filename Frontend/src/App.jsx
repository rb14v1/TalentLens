import { Routes, Route } from "react-router-dom";
import RecruiterHome from "./pages/RecruiterHome";
import Upload from "./pages/Upload";
import Retrieve from "./pages/Retrieve";
import Manageresume from "./pages/Manageresume";
import Recruiterdashboard from "./pages/Recruiterdashboard";
import AnalyticsDetails from "./pages/Analyticsdetails";
import ViewResume from "./pages/ViewResume";

function App() {
  return (
    <Routes>
      <Route path="/" element={<RecruiterHome />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/retrieve" element={<Retrieve />} />
      <Route path="/manageresume" element={<Manageresume />} />
      <Route path="/recruiterdashboard" element={<Recruiterdashboard />} />
      <Route path="/analytics-details" element={<AnalyticsDetails />} />
      <Route path="/viewresume" element={<ViewResume/>} />

    </Routes>
  );
}

export default App;
