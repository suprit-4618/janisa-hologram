import { useState, useEffect, useRef } from "react";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function parseCommand(transcript) {
    const text = transcript.toLowerCase();
    if (text.includes("rotate left")) return "rotate left 90";
    if (text.includes("rotate right")) return "rotate right 90";
    if (text.includes("rotate up")) return "rotate up 90";
    if (text.includes("rotate down")) return "rotate down 90";
    if (text.includes("scale up")) return "scale 2";
    if (text.includes("scale down")) return "scale 0.5";
    if (text.includes("reset")) return "reset";
    return null;
}

export default function VoiceCommand({ onCommand }) {
    const [status, setStatus] = useState("idle"); // idle, listening, processing
    const recognitionRef = useRef(null);

    useEffect(() => {
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
            setStatus("processing");
            let final_transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                }
            }

            if (final_transcript) {
                const commandText = parseCommand(final_transcript);
                if (commandText) {
                    onCommand(commandText);
                }
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setStatus("idle");
        };
        
        recognition.onend = () => {
            setStatus("idle");
        };

        recognitionRef.current = recognition;

    }, [onCommand]);

    function toggleListening() {
        if (status === "listening") {
            recognitionRef.current.stop();
            setStatus("idle");
        } else {
            try {
                recognitionRef.current.start();
                setStatus("listening");
            } catch (error) {
                console.error("Could not start speech recognition:", error);
            }
        }
    }

    if (!SpeechRecognition) {
        return <div style={{ marginTop: "10px", color: "#aaa" }}>Voice commands not supported in this browser.</div>;
    }
    
    const getButtonText = () => {
        switch (status) {
            case "listening":
                return "Listening...";
            case "processing":
                return "Processing...";
            default:
                return "Voice Command";
        }
    }

    return (
        <div style={{ marginTop: "10px" }}>
            <button
                onClick={toggleListening}
                disabled={status === "processing"}
                style={{
                    background: status === "listening" ? "#ff4136" : "#00eaff",
                    border: "none",
                    color: "#000",
                    padding: "7px 15px",
                    borderRadius: "4px",
                    cursor: status === "processing" ? "default" : "pointer",
                    opacity: status === "processing" ? 0.7 : 1,
                }}
            >
                {getButtonText()}
            </button>
        </div>
    );
}
