// HoloViewer.jsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";
import { TDSLoader } from "three/examples/jsm/loaders/TDSLoader";
import startHandTracking from "./HandTracker";
import computeGesture from "./GestureEngine";

export default function HoloViewer({ modelURL = null, command = null }) {
    const mountRef = useRef(null);
    const smoothRef = useRef({ rotX: 0, rotY: 0, targetRotX: 0, targetRotY: 0, scale: 1, targetScale: 1, pos: new THREE.Vector3(0, 0, 0), targetPos: new THREE.Vector3(0, 0, 0) });

    useEffect(() => {
        if (!command) return;
        const smooth = smoothRef.current;
        const parts = command.text.toLowerCase().split(" ");
        const action = parts[0];
        const value = parseFloat(parts[parts.length - 1]);

        switch (action) {
            case "rotate":
                const direction = parts[1];
                const angle = THREE.MathUtils.degToRad(value || 90);
                if (direction === "left") smooth.targetRotY -= angle;
                if (direction === "right") smooth.targetRotY += angle;
                if (direction === "up") smooth.targetRotX -= angle;
                if (direction === "down") smooth.targetRotX += angle;
                break;
            case "scale":
                smooth.targetScale = value;
                break;
            case "position":
                const axis = parts[1];
                if (axis === "x") smooth.targetPos.x = value;
                if (axis === "y") smooth.targetPos.y = value;
                break;
            case "reset":
                smooth.targetRotX = 0;
                smooth.targetRotY = 0;
                smooth.targetScale = 1;
                smooth.targetPos.set(0, 0, 0);
                break;
        }
    }, [command]);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount || !modelURL) return;

        const smooth = smoothRef.current;

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

        // loader: accept GLB or other
        const fileExtension = modelURL.split('.').pop().toLowerCase();
        let loader;

        if (fileExtension === 'gltf' || fileExtension === 'glb') {
            loader = new GLTFLoader();
        } else if (fileExtension === 'obj') {
            loader = new OBJLoader();
        } else if (fileExtension === 'fbx') {
            loader = new FBXLoader();
        } else if (fileExtension === 'stl') {
            loader = new STLLoader();
        } else if (fileExtension === 'ply') {
            loader = new PLYLoader();
        } else if (fileExtension === '3ds') {
            loader = new TDSLoader();
        } else {
            console.error("Unsupported file format:", fileExtension);
            return;
        }
        
        // try to load gltf
        loader.load(
            modelURL,
            (loadedObject) => {
                if (fileExtension === 'gltf' || fileExtension === 'glb') {
                    obj = loadedObject.scene;
                } else if (fileExtension === 'stl' || fileExtension === 'ply') {
                    const material = new THREE.MeshNormalMaterial();
                    obj = new THREE.Mesh(loadedObject, material);
                } else {
                    obj = loadedObject;
                }

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
            (err) => console.error("Model load error", err)
        );

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
            smooth.targetPos = new THREE.Vector3(gesture.posTarget.x, gesture.posPos.y, gesture.posTarget.z || 0);

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
            smooth.rotX = damp(smooth.rotX || 0, smooth.targetRotX || 0, 5.0, dt);
            smooth.rotY = damp(smooth.rotY || 0, smooth.targetRotY || 0, 5.0, dt);
            smooth.scale = damp(smooth.scale || 1, smooth.targetScale || 1, 4.0, dt);
            smooth.pos = new THREE.Vector3(
                damp(smooth.pos.x || 0, (smooth.targetPos && smooth.targetPos.x) || 0, 4.0, dt),
                damp(smooth.pos.y || 0, (smooth.targetPos && smooth.targetPos.y) || 0, 4.0, dt),
                0
            );

            if (obj) {
                obj.rotation.x = smooth.rotX;
                obj.rotation.y = smooth.rotY;
                obj.scale.lerp(new THREE.Vector3(smooth.scale, smooth.scale, smooth.scale), 0.08);
                obj.position.lerp(smooth.pos, 0.08);
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
