
import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import { motion, useReducedMotion } from 'framer-motion';
import ProductViewer from './ProductViewer';
import { getProducts, addToCart } from '../api';
import './Products3D.css';

function HeroScene() {
  const group = useRef();
  const reducedMotion = useReducedMotion();

  useFrame((state, delta) => {
    if (!group.current || reducedMotion) return;

    group.current.rotation.y += delta * 0.12;
    group.current.rotation.x =
      Math.sin(state.clock.elapsedTime * 0.25) * 0.08;
  });

  return (
    <>
      <ambientLight intensity={1.2} />
      <pointLight position={[3, 4, 5]} intensity={35} color="#a58aff" />
      <pointLight position={[-4, -2, 3]} intensity={22} color="#528bff" />

      <group ref={group}>
        <Float speed={reducedMotion ? 0 : 1.3} floatIntensity={0.45}>
          <mesh rotation={[0.6, 0.2, 0.2]}>
            <torusGeometry args={[1.55, 0.012, 12, 160]} />
            <meshStandardMaterial
              color="#a58aff"
              emissive="#7954ff"
              emissiveIntensity={2}
              metalness={0.8}
              roughness={0.25}
            />
          </mesh>

          <mesh rotation={[1.1, 0.5, -0.5]} scale={0.82}>
            <torusGeometry args={[1.55, 0.009, 10, 128]} />
            <meshStandardMaterial
              color="#68a6ff"
              emissive="#427cff"
              emissiveIntensity={2}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        </Float>
      </group>

      <Sparkles
        count={70}
        scale={5}
        size={2}
        speed={0.25}
        color="#c7b7ff"
        opacity={0.75}
      />
    </>
  );
}

function ProductCard({ product, index, onAdd, adding }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const reducedMotion = useReducedMotion();

  function handlePointerMove(event) {
    if (reducedMotion) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    setTilt({
      x: (0.5 - y) * 9,
      y: (x - 0.5) * 11,
    });
  }

  function resetTilt() {
    setTilt({ x: 0, y: 0 });
  }

  return (
    <motion.article
      className="lux-product-card"
      initial={reducedMotion ? false : { opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.07, 0.4),
        ease: 'easeOut',
      }}
      style={{
        '--card-rotate-x': `${tilt.x}deg`,
        '--card-rotate-y': `${tilt.y}deg`,
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
    >
      <div className="lux-product-visual">
        <div className="lux-product-number">
          OBJECT / {String(index + 1).padStart(2, '0')}
        </div>

        <div className="lux-product-glow" />

        <ProductViewer
          image={product.image || ''}
          images360={Array.isArray(product.images360) ? product.images360 : []}
          model3d={product.model3d || ''}
          name={product.name || 'Product'}
        />

        <span className="lux-product-orbit" />
      </div>

      <div className="lux-product-info">
        <div className="lux-product-category">
          SHOP EASY · COLLECTION
        </div>

        <h3>{product.name || 'Untitled Product'}</h3>

        <p>{product.description || 'Discover this item from our collection.'}</p>

        <div className="lux-product-bottom">
          <div className="lux-product-price">
            <span>PRICE</span>
            <strong>
              {Number.isFinite(Number(product.price))
                ? `₹${Number(product.price).toLocaleString('en-IN')}`
                : 'Price unavailable'}
            </strong>
          </div>

          <button
            type="button"
            className="lux-add-button"
            onClick={() => onAdd(product._id)}
            disabled={adding}
          >
            {adding ? 'ADDING…' : 'ADD TO BAG'}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingId, setAddingId] = useState(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    let active = true;

    getProducts()
      .then((res) => {
        if (active) {
          setProducts(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch((err) => {
        console.error('Unable to load products:', err);
        if (active) {
          setError('Unable to load products. Please try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleAddToCart = async (productId) => {
    const token = localStorage.getItem('token');

    if (!token) {
      setMessage('Please log in before adding products to your bag.');
      return;
    }

    if (addingId) return;

    setAddingId(productId);
    setMessage('');

    try {
      await addToCart({ productId, quantity: 1 }, token);
      setMessage('✓ Added to your bag successfully.');
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          'Unable to add this item. Try again.'
      );
    } finally {
      setAddingId(null);
    }
  };

  const categories = [
    'ALL',
    ...new Set(
      products
        .map((p) => p.category)
        .filter(
          (category) =>
            typeof category === 'string' && category.trim()
        )
    ),
  ];

  const visibleProducts =
    filter === 'ALL'
      ? products
      : products.filter((p) => p.category === filter);

  return (
    <main className="lux-store">
      <section className="lux-hero">
        <div className="lux-hero-noise" />

        <div className="lux-hero-copy">
          <div className="lux-eyebrow">
            <span /> THE NEXT DIMENSION OF SHOPPING
          </div>

          <h1>
            Beyond
            <br />
            <span>ordinary.</span>
          </h1>

          <p>
            Objects worth discovering.
            <br />
            Design that makes you look twice.
          </p>

          <a href="#collection" className="lux-explore-button">
            EXPLORE THE COLLECTION <span>↓</span>
          </a>

          <div className="lux-hero-caption">
            SHOPEASY STUDIO <span>—</span> DESIGNED TO DISCOVER
          </div>
        </div>

        <div className="lux-hero-art" aria-hidden="true">
          <div className="lux-scene-ring ring-a" />
          <div className="lux-scene-ring ring-b" />

          <Canvas
            camera={{ position: [0, 0, 6], fov: 42 }}
            dpr={[1, 1.5]}
            gl={{ alpha: true, antialias: true }}
            fallback={null}
          >
            <Suspense fallback={null}>
              <HeroScene />
            </Suspense>
          </Canvas>

          {products[0]?.image && (
            <motion.img
              className="lux-hero-product"
              src={products[0].image}
              alt=""
              fetchPriority="high"
              initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          )}

          <div className="lux-hero-tag">
            <span>01 / FEATURED OBJECT</span>
            <strong>
              {products[0]?.name || 'DISCOVER SOMETHING NEW'}
            </strong>
          </div>
        </div>

        <div className="lux-hero-index">01 — 03</div>
      </section>

      <section className="lux-collection" id="collection">
        <div className="lux-collection-heading">
          <div>
            <div className="lux-eyebrow">
              <span /> THE CURATED EDIT
            </div>

            <h2>
              Find your next <span>favorite.</span>
            </h2>

            <p>
              Explore the collection, selected for curious minds.
            </p>
          </div>

          <div className="lux-collection-count">
            <strong>
              {products.length.toString().padStart(2, '0')}
            </strong>
            <span>OBJECTS</span>
          </div>
        </div>

        {message && (
          <div className="lux-message" role="status">
            {message}
            <button
              type="button"
              onClick={() => setMessage('')}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {categories.length > 1 && (
          <div className="lux-filters" aria-label="Filter products">
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                className={filter === category ? 'active' : ''}
                onClick={() => setFilter(category)}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="lux-loading" role="status">
            <span className="lux-loader" />
            Preparing your collection…
          </div>
        )}

        {error && !loading && (
          <div className="lux-message" role="alert">
            {error}
            <button
              type="button"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && visibleProducts.length === 0 && (
          <div className="lux-empty">
            No products in this collection yet.
          </div>
        )}

        <div className="lux-product-grid">
          {visibleProducts.map((product, index) => (
            <ProductCard
              key={product._id}
              product={product}
              index={index}
              onAdd={handleAddToCart}
              adding={addingId === product._id}
            />
          ))}
        </div>

        <footer className="lux-store-footer">
          <span>SHOPEASY®</span>
          <span>DISCOVER DIFFERENTLY.</span>
        </footer>
      </section>
    </main>
  );
}
