import { Router } from 'express';
import { requireAdmin } from '@/middleware/adminAuth';
import { adminAuthRouter } from './auth.routes';
import { adminDashboardRouter } from './dashboard.routes';
import { adminProductsRouter } from './products.routes';
import { adminCategoriesRouter } from './categories.routes';
import { adminSuppliersRouter } from './suppliers.routes';
import { adminOrdersRouter } from './orders.routes';
import { adminCouponsRouter } from './coupons.routes';
import { adminUsersRouter } from './users.routes';
import { adminConfigRouter } from './config.routes';
import { adminRestocksRouter } from './restocks.routes';
import { adminReportRouter } from './report.routes';
import { adminReportsRouter } from './reports.routes';

export const adminRouter = Router();

adminRouter.use('/auth', adminAuthRouter);

// Everything below requires a valid admin session.
adminRouter.use(requireAdmin);
adminRouter.use('/dashboard', adminDashboardRouter);
adminRouter.use('/products', adminProductsRouter);
adminRouter.use('/categories', adminCategoriesRouter);
adminRouter.use('/suppliers', adminSuppliersRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/coupons', adminCouponsRouter);
adminRouter.use('/users', adminUsersRouter);
adminRouter.use('/config', adminConfigRouter);
adminRouter.use('/restocks', adminRestocksRouter);
adminRouter.use('/config/report', adminReportRouter);
adminRouter.use('/reports', adminReportsRouter);
