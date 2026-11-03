'use client';

import { useEffect, useState } from 'react';
import { storeJson } from '@/lib/storeApi';
import { useFavorites } from '@/lib/FavoritesContext';
import { ProductCard } from '@/components/ProductCard';
import { Paginated, Product } from '@/lib/types';

export default function FavoritosPage() {
  const favorites = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    // Favorites are matched client-side against the full catalog by id, so
    // this needs every product, not just one page's worth.
    storeJson<Paginated<Product>>('/api/store/products?pageSize=500', 'GET').then((data) => setProducts(data.items));
  }, []);

  const favoriteProducts = products.filter((p) => favorites.ids.includes(p.id));

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 var(--space-4)' }}>Favoritos</h1>
      {favoriteProducts.length === 0 && <p style={{ opacity: 0.6 }}>Todavía no marcaste productos como favoritos.</p>}
      <div className="grid-products">
        {favoriteProducts.map((p) => (
          <ProductCard key={p.id} product={p} showFavButton />
        ))}
      </div>
    </div>
  );
}
