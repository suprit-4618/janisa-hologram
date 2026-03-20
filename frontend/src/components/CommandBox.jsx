import { useState } from "react";

export default function CommandBox({ onCommand }) {
    const [command, setCommand] = useState("");

    function handleSubmit(e) {
        e.preventDefault();
        if (command.trim()) {
            onCommand(command.trim());
            setCommand("");
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ marginTop: "10px" }}>
            <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Enter command..."
                style={{
                    background: "rgba(0, 0, 0, 0.5)",
                    border: "1px solid #ffcc00",
                    color: "#ffcc00",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    marginRight: "10px",
                    outline: "none",
                    fontFamily: "inherit"
                }}
            />
            <button
                type="submit"
                style={{
                    background: "#ffcc00",
                    border: "none",
                    color: "#000",
                    padding: "7px 20px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "700",
                    transition: "all 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#ffaa00'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffcc00'}
            >
                Execute
            </button>
        </form>
    );
}
