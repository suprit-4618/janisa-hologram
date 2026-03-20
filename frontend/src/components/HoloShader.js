import * as THREE from "three";

/**
 * Advanced Hologram Shader
 * Includes: 
 * - Scanlines (animated)
 * - Fresnel (rim light)
 * - Glitch/Flicker (signal noise)
 * - Opacity modulation
 */
export const HoloShader = {
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xffcc00) },
        uOpacity: { value: 0.8 },
        uGlowIntensity: { value: 0.5 },
        uScanSpeed: { value: 1.2 },
        uScanDensity: { value: 30.0 },
        uFlickerStrength: { value: 0.05 },
        uMap: { value: null },
        uUseTexture: { value: 0.0 },
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        varying vec3 vViewPosition;

        void main() {
            vNormal = normalize(normalMatrix * normal);
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vPosition = worldPosition.xyz;
            
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uGlowIntensity;
        uniform float uScanSpeed;
        uniform float uScanDensity;
        uniform float uFlickerStrength;
        uniform sampler2D uMap;
        uniform float uUseTexture;

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        varying vec3 vViewPosition;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        void main() {
            // 1. Texture Sampling
            vec3 texColor = uColor;
            if (uUseTexture > 0.5) {
                texColor = texture2D(uMap, vUv).rgb;
            }

            // 2. Fresnel Effect (Rim Light)
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            float fresnel = pow(1.0 - dot(viewDir, normal), 3.0);
            
            // 3. Scanlines
            float scanline = sin(vPosition.y * uScanDensity - uTime * uScanSpeed) * 0.5 + 0.5;
            scanline = pow(scanline, 2.0); // Sharpen lines
            
            // 4. Flicker
            float flicker = 1.0 - (random(vec2(uTime * 0.1, 0.0)) * uFlickerStrength);
            
            // 5. Combine
            float alpha = uOpacity * (fresnel * uGlowIntensity + scanline * 0.6 + 0.1);
            alpha *= flicker;
            
            // Subtle color modulation - mix original texture with hologram glow
            vec3 finalColor = mix(texColor, uColor, 0.15) + fresnel * 0.4;
            
            if (alpha < 0.05) discard;

            gl_FragColor = vec4(finalColor, alpha);
        }
    `,
};

export default HoloShader;
