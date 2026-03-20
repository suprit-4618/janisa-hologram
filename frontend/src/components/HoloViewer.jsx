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
import { HoloShader } from "./HoloShader";

export default function HoloViewer({ modelURL = null, command = null, onGesture = null }) {
    const mountRef = useRef(null);
    const smoothRef = useRef({ 
        rotX: 0, rotY: 0, targetRotX: 0, targetRotY: 0, 
        scale: 1, targetScale: 1, 
        pos: new THREE.Vector3(0, 0, 0), targetPos: new THREE.Vector3(0, 0, 0),
        // Add separate voice offsets to avoid being overwritten by hand tracker
        vRotX: 0, vRotY: 0, vScale: 1, vPos: new THREE.Vector3(0, 0, 0)
    });

    // 1. Handle Voice Commands (Updates vOffsets)
    useEffect(() => {
        if (!command) return;
        const smooth = smoothRef.current;
        const parts = command.text.toLowerCase().split(" ");
        const action = parts[0];
        const value = parseFloat(parts[parts.length - 1]) || 0;

        switch (action) {
            case "rotate":
                const direction = parts[1];
                const angle = THREE.MathUtils.degToRad(value || 90);
                if (direction === "left") smooth.vRotY -= angle;
                if (direction === "right") smooth.vRotY += angle;
                if (direction === "up") smooth.vRotX -= angle;
                if (direction === "down") smooth.vRotX += angle;
                break;
            case "scale":
                smooth.vScale = value || 1;
                break;
            case "move":
            case "position":
                const axis = parts[1];
                const offset = value || 0.5;
                if (axis === "x" || parts.includes("left")) smooth.vPos.x -= offset;
                if (axis === "x" || parts.includes("right")) smooth.vPos.x += offset;
                if (axis === "y") smooth.vPos.y += offset;
                break;
            case "reset":
                smooth.vRotX = smooth.vRotY = 0;
                smooth.vScale = 1;
                smooth.vPos.set(0, 0, 0);
                break;
        }
    }, [command]);

    // 2. Main Three.js Scene
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount || !modelURL) return;

        const smooth = smoothRef.current;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        camera.position.set(0, 0, 4.5);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        mount.appendChild(renderer.domElement);

        const hemi = new THREE.HemisphereLight(0xffcc00, 0x0a0a12, 1.6);
        scene.add(hemi);
        const dir = new THREE.DirectionalLight(0xffffff, 1.8);
        dir.position.set(5, 8, 6);
        scene.add(dir);

        const group = new THREE.Group();
        scene.add(group);

        let obj = null;
        let scanPlane = null;
        let shaderMaterial = null;

        // Bounding Box / Scan Plane setup
        const planeGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.02, 32, 1, true);
        const planeMat = new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            blending: THREE.NormalBlending
        });
        scanPlane = new THREE.Mesh(planeGeom, planeMat);
        group.add(scanPlane);

        // Loaders
        const fileExtension = modelURL.split('.').pop().toLowerCase();
        let loader;
        if (fileExtension === 'gltf' || fileExtension === 'glb') loader = new GLTFLoader();
        else if (fileExtension === 'obj') loader = new OBJLoader();
        else if (fileExtension === 'fbx') loader = new FBXLoader();
        else if (fileExtension === 'stl') loader = new STLLoader();
        else if (fileExtension === 'ply') loader = new PLYLoader();
        else if (fileExtension === '3ds') loader = new TDSLoader();
        else {
            loader = new GLTFLoader(); // fallback
        }

        const holoMaterials = [];

        if (loader) {
            loader.load(modelURL, (loaded) => {
                obj = (fileExtension === 'gltf' || fileExtension === 'glb') ? loaded.scene : loaded;

                // Center and scale
                const box = new THREE.Box3().setFromObject(obj);
                const center = new THREE.Vector3();
                box.getCenter(center);
                obj.position.sub(center);
                
                const size = new THREE.Vector3();
                box.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z);
                const s = 1.4 / (maxDim || 1);
                obj.scale.setScalar(s);
                obj.position.y -= 0.2;

                obj.traverse((n) => {
                    if (n.isMesh) {
                        const originalMap = n.material.map || n.material.emissiveMap;
                        const mat = new THREE.ShaderMaterial({
                            uniforms: THREE.UniformsUtils.clone(HoloShader.uniforms),
                            vertexShader: HoloShader.vertexShader,
                            fragmentShader: HoloShader.fragmentShader,
                            transparent: true,
                            side: THREE.DoubleSide,
                            blending: THREE.NormalBlending,
                            depthWrite: true
                        });
                        
                        if (originalMap) {
                            mat.uniforms.uMap.value = originalMap;
                            mat.uniforms.uUseTexture.value = 1.0;
                        }
                        
                        n.material = mat;
                        holoMaterials.push(mat);
                    }
                });
                group.add(obj);
            }, undefined, (e) => console.error("Load error:", e));
        }

        // Damping
        function damp(c, t, l, d) { return c + (t - c) * (1 - Math.exp(-l * d)); }

        // Start Gestures
        let prev = {};
        startHandTracking((frame) => {
            const gesture = computeGesture(frame, prev);
            prev = gesture;
            smooth.targetRotX = gesture.rotTarget.x;
            smooth.targetRotY = gesture.rotTarget.y;
            smooth.targetScale = gesture.scaleTarget;
            smooth.targetPos.set(gesture.posTarget.x, gesture.posTarget.y, 0);

            if (gesture.reset) {
                smooth.targetRotX = smooth.targetRotY = 0;
                smooth.targetScale = 1;
                smooth.targetPos.set(0,0,0);
            }

            const g = Math.min(Math.max(gesture.glow || 0, 0), 1);
            holoMaterials.forEach(m => {
                m.uniforms.uGlowIntensity.value = 0.4 + g * 0.8;
                m.uniforms.uOpacity.value = 0.6 + g * 0.4;
            });

            if (onGesture) {
                const hands = frame.hands || [];
                const firstHand = hands[0] || { wrist: { x: 0.5, y: 0.5 } };
                onGesture(gesture.gestureName, firstHand.wrist, hands.length > 0);
            }
        });

        // Animation loop
        let last = performance.now();
        function animate() {
            requestAnimationFrame(animate);
            const now = performance.now();
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;

            smooth.rotX = damp(smooth.rotX || 0, smooth.targetRotX || 0, 5, dt);
            smooth.rotY = damp(smooth.rotY || 0, smooth.targetRotY || 0, 5, dt);
            smooth.scale = damp(smooth.scale || 1, smooth.targetScale || 1, 4, dt);
            smooth.pos.x = damp(smooth.pos.x, smooth.targetPos.x, 4, dt);
            smooth.pos.y = damp(smooth.pos.y, smooth.targetPos.y, 4, dt);

            if (obj) {
                // COMBINE: Hand tracking rotation + Voice command rotation
                obj.rotation.x = smooth.rotX + smooth.vRotX;
                obj.rotation.y = smooth.rotY + smooth.vRotY;
                obj.scale.setScalar(smooth.scale * smooth.vScale);
                obj.position.x = smooth.pos.x + smooth.vPos.x;
                obj.position.y = (smooth.pos.y + smooth.vPos.y) - 0.2;

                holoMaterials.forEach(m => {
                    m.uniforms.uTime.value = now / 1000;
                });
                if (scanPlane) {
                    scanPlane.position.y = Math.sin(now / 800) * 0.8;
                    scanPlane.material.opacity = 0.1 + Math.cos(now / 800) * 0.1;
                }
            }
            renderer.render(scene, camera);
        }
        animate();

        return () => {
            if (mount && renderer.domElement) mount.removeChild(renderer.domElement);
            renderer.dispose();
        };
    }, [modelURL]);

    return <div ref={mountRef} style={{ width: "100%", height: "80vh", background: "#000" }} />;
}
