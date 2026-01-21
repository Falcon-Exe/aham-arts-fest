import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function NotFound() {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "80vh",
            textAlign: "center",
            color: "#fff",
            padding: "20px"
        }}>
            <Helmet>
                <title>Page Not Found | AHAM Arts Fest</title>
            </Helmet>

            <h1 style={{
                fontSize: "6rem",
                margin: "0",
                background: "linear-gradient(45deg, #e63946, #bbb)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
            }}>404</h1>

            <h2 style={{ marginBottom: "20px", color: "#888" }}>Page Not Found</h2>

            <p style={{ maxWidth: "400px", marginBottom: "30px", lineHeight: "1.6", color: "#aaa" }}>
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>

            <Link to="/" style={{
                padding: "12px 30px",
                background: "#e63946",
                color: "#fff",
                textDecoration: "none",
                borderRadius: "50px",
                fontWeight: "600",
                transition: "transform 0.2s"
            }}>
                Go Home
            </Link>
        </div>
    );
}
