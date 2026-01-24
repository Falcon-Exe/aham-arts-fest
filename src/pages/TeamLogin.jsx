import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { Helmet } from "react-helmet-async";
import "./TeamLogin.css";

export default function TeamLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate("/register");
        } catch (err) {
            console.error("Login failed:", err.code);
            if (err.code === "auth/invalid-credential") {
                setError("Invalid email or password.");
            } else if (err.code === "auth/too-many-requests") {
                setError("Too many attempts. Try again later.");
            } else {
                setError("Failed to login. Please check your connection.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="team-login-container">
            <Helmet>
                <title>Team Lead Login | AHAM Arts Fest</title>
            </Helmet>

            <div className="login-card">
                <div className="login-header">
                    <h2>Team Lead Access</h2>
                    <p>Please login to register candidates.</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            placeholder="e.g. pyra@aham.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <div className="error-message">⚠️ {error}</div>}

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? "Verifying..." : "Login to Register ➜"}
                    </button>
                </form>

                <div className="login-footer">
                    <button onClick={() => navigate("/")} className="back-link">
                        ← Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}
