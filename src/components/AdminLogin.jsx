import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate(); // Hook

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous
    try {
      const user = await signInWithEmailAndPassword(auth, email, password);
      console.log("Admin logged in:", user.user.email);
      navigate("/dashboard");
    } catch (err) {
      console.error("Login failed:", err.code);
      if (err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Try again later.");
      } else {
        setError("Failed to login. Please check your connection.");
      }
    }
  };

  return (
    <div className="admin-login-page">
      <div className="login-card">
        <h2>Admin Authentication</h2>
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <input
              type="email"
              placeholder="Admin Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-submit-btn">Continue to Dashboard ➜</button>
          {error && <div className="login-error-badge">{error}</div>}
        </form>
        <button onClick={() => navigate("/")} className="back-to-site">← Back to Site</button>
      </div>
    </div>
  );
}
