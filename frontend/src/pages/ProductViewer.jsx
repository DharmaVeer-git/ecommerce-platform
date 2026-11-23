import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Html, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import './ProductViewer.css';

/* ---------- Catches model load errors so the page never goes blank ---------- */
class ViewerBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn('3D model failed to load, showing photo instead:', err?.message);
    this.props.onFail?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ---------- Model: auto-centred and auto-scaled to fill the frame ---------- */
function FittedModel({ url }) {
  const { scene } = useGLTF(url);

  const { object, scale, offset } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return {
      object: clone,
      scale: 2.4 / maxDim, // every model ends up ~2.4 units wide
      offset: center.multiplyScalar(-1),
    };
  }, [scene]);

  return (
    <group scale={scale}>
      <primitive object={object} position={offset} />
    </group>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="pv-loader">Loading 3D…</div>
    </Html>
  );
}

/* ---------- Optional photo-based 360 spin (drag left/right) ---------- */
function PhotoSpin({ images, name }) {
  const [index, setIndex] = useState(0);
  const drag = useRef(null);

  const onDown = (e) => {
    drag.current = { x: e.clientX, i: index };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const steps = Math.round((e.clientX - drag.current.x) / 12);
    const n = images.length;
    setIndex((((drag.current.i - steps) % n) + n) % n);
  };
  const onUp = () => (drag.current = null);

  return (
    <div className="pv-photo" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
      <img src={images[index]} alt={name} draggable={false} />
    </div>
  );
}

/* ---------- Main component ---------- */
export default function ProductViewer({ image, images360, model3d, name = 'Product' }) {
  const rootRef = useRef(null);
  const controlsRef = useRef(null);
  const hasModel = Boolean(model3d);
  const [mode, setMode] = useState(hasModel ? '3d' : 'photo');
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  // If the product changes, reset the viewer state
  useEffect(() => {
    setFailed(false);
    setMode(model3d ? '3d' : 'photo');
  }, [model3d]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const show3D = hasModel && !failed && mode === '3d';
  const spinImages = Array.isArray(images360) && images360.length > 1 ? images360 : null;

  const zoomBy = (factor) => {
    const c = controlsRef.current;
    if (!c) return;
    const cam = c.object;
    const dir = cam.position.clone().sub(c.target).multiplyScalar(factor);
    const dist = THREE.MathUtils.clamp(dir.length(), c.minDistance, c.maxDistance);
    cam.position.copy(c.target).add(dir.setLength(dist));
    c.update();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) rootRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div ref={rootRef} className={`pv-root ${fullscreen ? 'pv-full' : ''}`}>
      <div className="pv-tabs">
        {hasModel && !failed && (
          <button
            type="button"
            className={mode === '3d' ? 'pv-tab active' : 'pv-tab'}
            onClick={() => setMode('3d')}
          >
            3D Model
          </button>
        )}
        <button
          type="button"
          className={mode === 'photo' || !show3D ? 'pv-tab active' : 'pv-tab'}
          onClick={() => setMode('photo')}
        >
          Photo
        </button>
      </div>

      <div className="pv-stage">
        {show3D ? (
          <ViewerBoundary onFail={() => setFailed(true)}>
            <Canvas
              dpr={[1, 2]}
              camera={{ position: [0, 0.4, 5], fov: 38 }}
              gl={{ antialias: true }}
            >
              <ambientLight intensity={0.8} />
              <directionalLight position={[4, 6, 5]} intensity={2.2} />
              <directionalLight position={[-5, 2, -4]} intensity={1} color="#a58aff" />

              {/* Offline studio lighting (no network request needed) */}
              <Environment resolution={256}>
                <Lightformer form="rect" intensity={3} position={[0, 5, -6]} scale={[10, 4, 1]} />
                <Lightformer form="rect" intensity={2} position={[-6, 1, 3]} scale={[4, 6, 1]} />
                <Lightformer form="rect" intensity={2} position={[6, 1, 3]} scale={[4, 6, 1]} />
              </Environment>

              <Suspense fallback={<Loader />}>
                <FittedModel url={model3d} />
              </Suspense>

              <OrbitControls
                ref={controlsRef}
                makeDefault
                enableZoom
                enablePan={false}
                enableDamping
                dampingFactor={0.08}
                autoRotate={autoRotate}
                autoRotateSpeed={2.2}
                minDistance={2}
                maxDistance={9}
                onStart={() => setAutoRotate(false)}
              />
            </Canvas>

            <div className="pv-controls">
              <button type="button" onClick={() => zoomBy(0.8)} aria-label="Zoom in">+</button>
              <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom out">−</button>
              <button
                type="button"
                onClick={() => setAutoRotate((v) => !v)}
                aria-label="Toggle auto rotate"
                title="Toggle 360° spin"
              >
                ⟳
              </button>
              <button type="button" onClick={toggleFullscreen} aria-label="Fullscreen" title="Fullscreen">
                ⛶
              </button>
            </div>
            <div className="pv-hint">Drag to rotate · Scroll or +/− to zoom</div>
          </ViewerBoundary>
        ) : spinImages ? (
          <>
            <PhotoSpin images={spinImages} name={name} />
            <div className="pv-hint">Drag left/right to spin</div>
          </>
        ) : (
          <div className="pv-photo">
            <img src={image} alt={name} draggable={false} />
          </div>
        )}
      </div>
    </div>
  );
}