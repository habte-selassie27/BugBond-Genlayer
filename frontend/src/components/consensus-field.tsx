import { useEffect, useRef } from "react";

const NODE_COUNT = 190;
const LINK_DISTANCE = 168;

type Rgb = [number, number, number];

/* Reads a custom property off :root and parses it to RGB, so the field inherits
   the active theme's palette instead of hardcoding one. */
function cssColor(name: string, fallback: Rgb): Rgb {
  if (typeof window === "undefined") return fallback;
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;

  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return [parseInt(digits.slice(0, 2), 16), parseInt(digits.slice(2, 4), 16), parseInt(digits.slice(4, 6), 16)];
  }

  const fn = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const channels = fn[1].split(",").map((part) => parseFloat(part));
    if (channels.length >= 3 && channels.slice(0, 3).every((n) => Number.isFinite(n))) {
      return [channels[0], channels[1], channels[2]];
    }
  }

  return fallback;
}

export function ConsensusField() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 860px)");
    const coarse = window.matchMedia("(pointer: coarse)");
    if (reduced.matches || narrow.matches || coarse.matches) return;

    let renderer: import("three").WebGLRenderer;
    let frame = 0;
    let disposed = false;

    const boot = async () => {
      const THREE = await import("three");
      if (disposed || !host.current) return;

      const width = host.current.clientWidth;
      const height = host.current.clientHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 400);
      camera.position.set(0, 0, 165);

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      container.appendChild(renderer.domElement);

      const positions = new Float32Array(NODE_COUNT * 3);
      for (let i = 0; i < NODE_COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * width * 0.92;
        positions[i * 3 + 1] = (Math.random() - 0.5) * height * 1.05;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 150 - 20;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const nodeColor = cssColor("--cyan", [79, 209, 197]);
      const linkColor = cssColor("--line", [47, 111, 122]);

      const nodeMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(nodeColor[0] / 255, nodeColor[1] / 255, nodeColor[2] / 255),
        size: 2.1,
        transparent: true,
        opacity: 0.72,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(geometry, nodeMaterial);
      scene.add(points);

      const linkPositions: number[] = [];
      const linkGeometry = new THREE.BufferGeometry();
      linkGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linkPositions), 3));
      const linkMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(linkColor[0] / 255, linkColor[1] / 255, linkColor[2] / 255),
        transparent: true,
        opacity: 0.34,
      });
      const links = new THREE.LineSegments(linkGeometry, linkMaterial);
      scene.add(links);

      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      const onMove = (event: PointerEvent) => {
        pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
        pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const drawLinks = () => {
        const arr = linkGeometry.getAttribute("position") as import("three").BufferAttribute;
        let n = 0;
        for (let i = 0; i < NODE_COUNT; i++) {
          for (let j = i + 1; j < NODE_COUNT; j++) {
            const dx = positions[i * 3] - positions[j * 3];
            const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
            const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
            if (dx * dx + dy * dy + dz * dz > LINK_DISTANCE * LINK_DISTANCE) continue;
            arr.array[n * 3] = positions[i * 3];
            arr.array[n * 3 + 1] = positions[i * 3 + 1];
            arr.array[n * 3 + 2] = positions[i * 3 + 2];
            arr.array[n * 3 + 3] = positions[j * 3];
            arr.array[n * 3 + 4] = positions[j * 3 + 1];
            arr.array[n * 3 + 5] = positions[j * 3 + 2];
            n++;
          }
        }
        linkGeometry.setDrawRange(0, n * 2);
        arr.needsUpdate = true;
      };
      drawLinks();

      const resize = () => {
        if (!host.current) return;
        const w = host.current.clientWidth;
        const h = host.current.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", resize);

      let running = true;
      const onVisibility = () => { running = document.visibilityState === "visible"; };
      const onReduce = () => { running = !reduced.matches && document.visibilityState === "visible"; };
      document.addEventListener("visibilitychange", onVisibility);
      reduced.addEventListener("change", onReduce);

      const clock = new THREE.Clock();
      const tick = () => {
        if (disposed) return;
        frame = requestAnimationFrame(tick);
        if (!running) return;

        const t = clock.getElapsedTime();
        pointer.x += (pointer.tx - pointer.x) * 0.045;
        pointer.y += (pointer.ty - pointer.y) * 0.045;

        points.rotation.y = t * 0.045 + pointer.x * 0.28;
        points.rotation.x = Math.sin(t * 0.22) * 0.05 - pointer.y * 0.16;
        links.rotation.copy(points.rotation);
        camera.position.x = pointer.x * 9;
        camera.position.y = -pointer.y * 6;
        camera.lookAt(0, 0, 0);

        const pulse = 0.62 + Math.sin(t * 1.15) * 0.14;
        nodeMaterial.opacity = pulse;
        renderer.render(scene, camera);
      };
      tick();

      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVisibility);
        reduced.removeEventListener("change", onReduce);
        geometry.dispose();
        nodeMaterial.dispose();
        linkGeometry.dispose();
        linkMaterial.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    let teardown: (() => void) | undefined;
    void boot().then((fn) => { if (typeof fn === "function") { teardown = fn; if (disposed) teardown(); } });

    return () => {
      disposed = true;
      teardown?.();
    };
  }, []);

  return <div className="consensus-field" ref={host} aria-hidden="true" />;
}