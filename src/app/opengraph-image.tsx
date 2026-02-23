import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Agentalk – Collaborative MCP Server for AI Agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#000",
                    padding: "80px 100px",
                    fontFamily: "sans-serif",
                }}
            >
                {/* Left side - Text */}
                <div style={{ display: "flex", flexDirection: "column", maxWidth: "600px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                        {/* Logo mark */}
                        <div
                            style={{
                                width: "56px",
                                height: "56px",
                                borderRadius: "14px",
                                backgroundColor: "#0a0a0a",
                                border: "2px solid #34d399",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                                <path d="M8 13 C8 10.5 10 9 13 9 L17 9 C19.5 9 21 10.5 21 13 L21 16 C21 18.5 19.5 19.5 17 19.5 L14.5 19.5 L12 22 L12.5 19.5 L11 19.5 C9.5 19.5 8 18.5 8 16 Z" fill="#34d399" opacity="0.9" />
                                <path d="M12 14 C12 11.8 13.8 10.5 16 10.5 L20 10.5 C22.5 10.5 24 11.8 24 14 L24 17 C24 19 22.5 20 20 20 L19.5 20 L20 22.5 L17.5 20 L16 20 C13.8 20 12 19 12 17 Z" fill="#0a0a0a" stroke="#34d399" strokeWidth="1.2" />
                                <circle cx="16.5" cy="15.5" r="1.2" fill="#34d399" />
                                <circle cx="19" cy="15.5" r="1.2" fill="#34d399" />
                                <circle cx="21.5" cy="15.5" r="1.2" fill="#34d399" />
                            </svg>
                        </div>
                    </div>

                    <h1
                        style={{
                            fontSize: "72px",
                            fontWeight: 700,
                            color: "#fff",
                            margin: 0,
                            lineHeight: 1.1,
                            letterSpacing: "-2px",
                        }}
                    >
                        Agentalk
                    </h1>
                    <p
                        style={{
                            fontSize: "28px",
                            color: "#888",
                            margin: "20px 0 0 0",
                            lineHeight: 1.4,
                        }}
                    >
                        Collaborative MCP Server for AI Agents
                    </p>

                    {/* Tags */}
                    <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
                        {["Real-time Sync", "OAuth 2.1", "MCP Protocol"].map((tag) => (
                            <div
                                key={tag}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "8px",
                                    border: "1px solid #1a1a1a",
                                    backgroundColor: "#0a0a0a",
                                    color: "#34d399",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                }}
                            >
                                {tag}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right side - Abstract illustration */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "300px",
                        height: "300px",
                        position: "relative",
                    }}
                >
                    {/* Outer ring */}
                    <div
                        style={{
                            width: "240px",
                            height: "240px",
                            borderRadius: "50%",
                            border: "1px solid #1a1a1a",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "absolute",
                        }}
                    />
                    {/* Inner ring */}
                    <div
                        style={{
                            width: "160px",
                            height: "160px",
                            borderRadius: "50%",
                            border: "1px solid #34d399",
                            opacity: 0.3,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "absolute",
                        }}
                    />
                    {/* Center dot */}
                    <div
                        style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            backgroundColor: "#34d399",
                            position: "absolute",
                        }}
                    />
                    {/* Agent nodes */}
                    {[0, 90, 180, 270].map((deg, i) => {
                        const rad = (deg * Math.PI) / 180;
                        const x = Math.cos(rad) * 100;
                        const y = Math.sin(rad) * 100;
                        const colors = ["#34d399", "#3b82f6", "#f59e0b", "#ec4899"];
                        return (
                            <div
                                key={i}
                                style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "50%",
                                    border: `2px solid ${colors[i]}`,
                                    backgroundColor: "#0a0a0a",
                                    position: "absolute",
                                    transform: `translate(${x}px, ${y}px)`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: colors[i],
                                    fontSize: "12px",
                                    fontWeight: 600,
                                }}
                            >
                                {["CC", "OC", "CX", "A4"][i]}
                            </div>
                        );
                    })}
                </div>
            </div>
        ),
        { ...size }
    );
}
