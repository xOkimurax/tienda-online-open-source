import { Router } from 'express';
import { storeAuthRouter } from './auth.routes';
import { storeProductsRouter } from './products.routes';
import { storeContentRouter } from './content.routes';
import { storeCheckoutRouter } from './checkout.routes';
import { storeOrdersRouter } from './orders.routes';
import { storeCouponsRouter } from './coupons.routes';
import { storeAddressesRouter } from './addresses.routes';
import { storeFavoritesRouter } from './favorites.routes';
import { storeCartRouter } from './cart.routes';

export const storeRouter = Router();

storeRouter.use('/auth', storeAuthRouter);
storeRouter.use('/products', storeProductsRouter);
storeRouter.use('/content', storeContentRouter);
storeRouter.use('/checkout', storeCheckoutRouter);
storeRouter.use('/orders', storeOrdersRouter);
storeRouter.use('/coupons', storeCouponsRouter);
storeRouter.use('/addresses', storeAddressesRouter);
storeRouter.use('/favorites', storeFavoritesRouter);
storeRouter.use('/cart', storeCartRouter);
