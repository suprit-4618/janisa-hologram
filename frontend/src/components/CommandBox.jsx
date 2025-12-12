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
                    border: "1px solid #00eaff",
                    color: "#00eaff",
                    padding: "6px 10px",
                    borderRadius: "4px",
                    marginRight: "10px",
                }}
            />
            <button
                type="submit"
                style={{
                    background: "#00eaff",
                    border: "none",
                    color: "#000",
                    padding: "7px 15px",
                    borderRadius: "4px",
                    cursor: "pointer",
                }}
            >
                Execute
            </button>
        </form>
    );
}
