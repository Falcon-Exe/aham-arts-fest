// import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// import Navbar from "./components/Navbar";
// import Home from "./pages/Home";
// import Events from "./pages/Events";
// import Schedule from "./pages/Schedule";
// import Results from "./pages/Results";
// import Participants from "./pages/Participants";

// function App() {
//   return (
//     <Router>
//       {/* <Navbar /> */}
//       <Routes>
//         <Route path="/Home" element={<Home />} />
//         <Route path="/events" element={<Events />} />
//         <Route path="/schedule" element={<Schedule />} />
//         <Route path="/results" element={<Results />} />
//         <Route path="/participants" element={<Participants />} />
//       </Routes>
//     </Router>
//   );
// }


// export default App;
import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Events from "./pages/Events";
import Schedule from "./pages/Schedule";
import Results from "./pages/Results";
import Participants from "./pages/Participants";
import Register from "./pages/Register";




export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="loader">
        <img src="/pwa-192x192.png" alt="AHAM Logo" />
        <p>Loading AHAM Arts Fest...</p>
      </div>
    );
  }

  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<Events />} />
        <Route path="/schedule" element={<Schedule />} />
         <Route path="/register" element={<Register />} />
        <Route path="/results" element={<Results />} />
        <Route path="/participants" element={<Participants />} />
      </Routes>
    </Router>
  );
}
