// HoloViewer.jsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import startHandTracking from "./HandTracker";
import computeGesture from "./GestureEngine";

// Use the local uploaded file path as demo model (developer asked to use uploaded path)
const LOCAL_TEST_MODEL = "/mnt/data/2.mp4"; // replace with a GLB URL for real model

export default function HoloViewer({ modelURL = LOCAL_TEST_MODEL }) {
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // Three setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        camera.position.set(0, 0, 4.5);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.outputEncoding = THREE.sRGBEncoding;
        mount.appendChild(renderer.domElement);

        // Lighting + hologram rim light (glow)
        const hemi = new THREE.HemisphereLight(0x88dfff, 0x0a0a12, 1.6);
        scene.add(hemi);
        const dir = new THREE.DirectionalLight(0xffffff, 1.8);
        dir.position.set(5, 8, 6);
        scene.add(dir);

        // rim/emissive shader basic: we emulate glow by adding an emissive copy
        const group = new THREE.Group();
        scene.add(group);

        let obj = null;
        let glowMesh = null;

        // loader: accept GLB or other; if a video file is given it'll just create a plane with the video as texture
        const loader = new GLTFLoader();
        const isVideo = typeof modelURL === "string" && modelURL.endsWith(".mp4");

        if (isVideo) {
            // create a plane showing the video (useful for demo)
            const video = document.createElement("video");
            video.src = modelURL;
            video.loop = true;
            video.muted = true;
            video.autoplay = true;
            video.playsInline = true;
            video.crossOrigin = "anonymous";
            video.style.display = "none";
            document.body.appendChild(video);
            video.play().catch(() => { });

            const tex = new THREE.VideoTexture(video);
            tex.encoding = THREE.sRGBEncoding;
            const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.15, roughness: 0.4 });
            const geom = new THREE.PlaneGeometry(2.2, 1.2);
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(0, 0, 0);
            obj = mesh;
            group.add(obj);

            // glow mesh (slightly larger, emissive)
            const glowMat = new THREE.MeshBasicMaterial({ color: 0x00eaff, transparent: true, opacity: 0.06 });
            glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), glowMat);
            glowMesh.position.copy(mesh.position);
            glowMesh.renderOrder = 0;
            group.add(glowMesh);
        } else {
            // try to load gltf
            loader.load(
                modelURL,
                (gltf) => {
                    obj = gltf.scene;
                    // auto-fit model: compute bounding box and scale to nice hologram size
                    const box = new THREE.Box3().setFromObject(obj);
                    const size = new THREE.Vector3();
                    box.getSize(size);
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const desired = 1.4; // target size
                    const s = desired / (maxDim || 1);
                    obj.scale.setScalar(s);
                    obj.position.set(0, -0.35, 0);
                    group.add(obj);

                    // glow copy: clone mesh but use emissive-like material for subtle rim
                    glowMesh = obj.clone();
                    glowMesh.traverse((n) => {
                        if (n.isMesh) {
                            n.material = n.material.clone();
                            n.material.emissive = new THREE.Color(0x00d6ff);
                            n.material.emissiveIntensity = 0.02;
                            n.material.transparent = true;
                        }
                    });
                    glowMesh.scale.multiplyScalar(1.03);
                    group.add(glowMesh);
                },
                undefined,
                (err) => console.error("GLTF load error", err)
            );
        }

        // Gesture control state
        let smooth = { rotX: 0, rotY: 0, targetRotX: 0, targetRotY: 0, scale: 1, targetScale: 1, pos: new THREE.Vector3(0, 0, 0), targetPos: new THREE.Vector3(0, 0, 0) };
        let prev = {}; // prev state for gesture engine

        // helper damping function (frame-rate independent)
        function damp(current, target, lambda, dt) {
            return current + (target - current) * (1 - Math.exp(-lambda * dt));
        }

        // start tracker
        startHandTracking((frame) => {
            // compute gestures based on frame and previous state
            const gesture = computeGesture(frame, prev || {});
            prev = gesture; // store last gesture as prev for next call

            // write targets
            smooth.targetRotX = gesture.rotTarget.x;
            smooth.targetRotY = gesture.rotTarget.y;
            smooth.targetScale = gesture.scaleTarget;
            smooth.targetPos = new THREE.Vector3(gesture.posTarget.x, gesture.posTarget.y, gesture.posTarget.z || 0);

            // reset requested -> gently animate to default transform
            if (gesture.reset) {
                smooth.targetRotX = 0;
                smooth.targetRotY = 0;
                smooth.targetScale = 1;
                smooth.targetPos.set(0, 0, 0);
            }

            // glow intensity used to modulate glowMesh opacity / emissive
            const glow = gesture.glow || 0;
            if (glowMesh) {
                // clamp and smooth
                const g = Math.min(Math.max(glow, 0), 1);
                // increase emissive intensity slightly
                glowMesh.traverse((n) => {
                    if (n.isMesh && n.material) {
                        if (n.material.emissive) n.material.emissiveIntensity = 0.02 + g * 0.25;
                        if (n.material.opacity !== undefined) n.material.opacity = 0.06 + g * 0.25;
                    }
                });
            }
        });

        // animation loop
        let last = performance.now();
        function animate() {
            requestAnimationFrame(animate);
            const now = performance.now();
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;

            // interpolate rotation & scale & pos
            smooth.rotX = damp(smooth.rotX || 0, smooth.targetRotX || 0, 8.0, dt);
            smooth.rotY = damp(smooth.rotY || 0, smooth.targetRotY || 0, 8.0, dt);
            smooth.scale = damp(smooth.scale || 1, smooth.targetScale || 1, 6.0, dt);
            smooth.pos = new THREE.Vector3(
                damp(smooth.pos.x || 0, (smooth.targetPos && smooth.targetPos.x) || 0, 6.0, dt),
                damp(smooth.pos.y || 0, (smooth.targetPos && smooth.targetPos.y) || 0, 6.0, dt),
                0
            );

            if (obj) {
                obj.rotation.x = smooth.rotX;
                obj.rotation.y = smooth.rotY;
                obj.scale.lerp(new THREE.Vector3(smooth.scale, smooth.scale, smooth.scale), 0.12);
                obj.position.lerp(smooth.pos, 0.12);
            }
            if (glowMesh && obj) {
                glowMesh.position.copy(obj.position);
                glowMesh.rotation.copy(obj.rotation);
                glowMesh.scale.copy(obj.scale).multiplyScalar(1.03);
            }
            renderer.render(scene, camera);
        }

        animate();

        // cleanup
        return () => {
            if (mount && renderer && renderer.domElement) {
                mount.removeChild(renderer.domElement);
            }
        };
    }, [modelURL]);

    return <div ref={mountRef} style={{ width: "100%", height: "80vh", background: "#000" }} />;
}
