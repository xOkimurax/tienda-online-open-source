import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main() {
  await prisma.brandingConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, nombre: 'Tienda Online' },
  });
  await prisma.bankInfo.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      banco: 'Banco Itaú',
      tipoCuenta: 'Cuenta corriente',
      numero: '2003-456789-1',
      titular: 'Tienda Online S.A.',
      identificacion: '80045123-9',
    },
  });
  await prisma.aboutContent.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      historia:
        'Empezamos en un pequeño local de barrio con la idea de ofrecer ropa y accesorios de calidad a precios justos. Con el tiempo fuimos creciendo gracias a la confianza de nuestros clientes.',
      anioFundacion: '2019',
      direccion: 'Av. España 1234, Asunción, Paraguay',
      telefono: '021 555 0000',
      emailContacto: 'contacto@tienda.com.py',
    },
  });

  const categoriesData = [
    { id: 'ropa', nombre: 'Ropa', subcategorias: ['Remeras', 'Pantalones', 'Camperas'] },
    { id: 'calzado', nombre: 'Calzado', subcategorias: ['Zapatillas', 'Botas', 'Sandalias'] },
    { id: 'accesorios', nombre: 'Accesorios', subcategorias: ['Bolsos', 'Gorras', 'Lentes'] },
  ];
  const categoryIdByKey: Record<string, string> = {};
  const subcategoryIdByKey: Record<string, string> = {};
  for (const c of categoriesData) {
    const category = await prisma.category.upsert({
      where: { id: c.id },
      update: { nombre: c.nombre },
      create: { id: c.id, nombre: c.nombre },
    });
    categoryIdByKey[c.id] = category.id;
    for (const sub of c.subcategorias) {
      const subcategory = await prisma.subcategory.upsert({
        where: { categoryId_nombre: { categoryId: category.id, nombre: sub } },
        update: {},
        create: { categoryId: category.id, nombre: sub },
      });
      subcategoryIdByKey[`${c.id}:${sub}`] = subcategory.id;
    }
  }

  const suppliersData = [
    { id: 'sup1', nombre: 'Textil del Este SRL', contacto: 'ventas@textileste.com.py', telefono: '021 555 1234' },
    { id: 'sup2', nombre: 'Calzados Ñandutí', contacto: 'pedidos@nanduti.com.py', telefono: '0981 222 333' },
    { id: 'sup3', nombre: 'Importadora Sur', contacto: 'contacto@importsur.com.py', telefono: '061 444 555' },
  ];
  const supplierIdByKey: Record<string, string> = {};
  for (const s of suppliersData) {
    const supplier = await prisma.supplier.upsert({
      where: { id: s.id },
      update: { nombre: s.nombre, contacto: s.contacto, telefono: s.telefono },
      create: s,
    });
    supplierIdByKey[s.id] = supplier.id;
  }

  const productsData = [
    { id: 'p1', nombre: 'Remera Oversize Algodón', categoria: 'ropa', subcategoria: 'Remeras', precio: 89000, precioCosto: 52000, stock: 42, icon: 'camisa', proveedor: 'sup1', requiereVerificacion: false, variantes: { talla: ['S', 'M', 'L', 'XL'], color: ['Blanco', 'Negro', 'Terracota'] }, destacado: true, marca: 'Basics Co.', descripcion: 'Remera de algodón peinado con corte oversize y caída relajada, ideal para el uso diario.', ventaConjunto: { activo: true, unidades: 3 } },
    { id: 'p2', nombre: 'Campera de Jean Clásica', categoria: 'ropa', subcategoria: 'Camperas', precio: 245000, precioCosto: 150000, stock: 15, icon: 'camisa', proveedor: 'sup1', requiereVerificacion: false, variantes: { talla: ['M', 'L', 'XL'], color: ['Azul', 'Negro'] }, destacado: true, marca: 'Denim Studio', descripcion: 'Campera de jean con lavado clásico y forro interior liviano.', ventaConjunto: { activo: false, unidades: 1 } },
    { id: 'p3', nombre: 'Pantalón Cargo', categoria: 'ropa', subcategoria: 'Pantalones', precio: 178000, precioCosto: 105000, stock: 6, icon: 'camisa', proveedor: 'sup1', requiereVerificacion: true, variantes: { talla: ['S', 'M', 'L'], color: ['Verde', 'Beige'] }, destacado: false, marca: 'Basics Co.', descripcion: 'Pantalón cargo de gabardina resistente, con bolsillos laterales.', ventaConjunto: { activo: false, unidades: 1 } },
    { id: 'p4', nombre: 'Zapatillas Urban Runner', categoria: 'calzado', subcategoria: 'Zapatillas', precio: 389000, precioCosto: 240000, stock: 3, icon: 'zapato', proveedor: 'sup2', requiereVerificacion: true, variantes: { talla: ['38', '39', '40', '41', '42'], color: ['Blanco', 'Gris'] }, destacado: true, marca: 'Urban Runner', descripcion: 'Zapatillas urbanas con entresuela amortiguada y malla transpirable.', ventaConjunto: { activo: false, unidades: 1 } },
    { id: 'p5', nombre: 'Botas de Cuero', categoria: 'calzado', subcategoria: 'Botas', precio: 520000, precioCosto: 330000, stock: 8, icon: 'zapato', proveedor: 'sup2', requiereVerificacion: false, variantes: { talla: ['39', '40', '41', '42', '43'], color: ['Marrón', 'Negro'] }, destacado: false, marca: 'Cuero Sur', descripcion: 'Botas de cuero genuino con suela de goma antideslizante.', ventaConjunto: { activo: false, unidades: 1 } },
    { id: 'p6', nombre: 'Sandalias Verano', categoria: 'calzado', subcategoria: 'Sandalias', precio: 96000, precioCosto: 55000, stock: 30, icon: 'zapato', proveedor: 'sup2', requiereVerificacion: false, variantes: { talla: ['36', '37', '38', '39'], color: ['Beige', 'Negro'] }, destacado: false, marca: 'Urban Runner', descripcion: 'Sandalias livianas de tiras cruzadas, con plantilla acolchada.', ventaConjunto: { activo: false, unidades: 1 } },
    { id: 'p7', nombre: 'Bolso Tote Tejido', categoria: 'accesorios', subcategoria: 'Bolsos', precio: 135000, precioCosto: 78000, stock: 12, icon: 'bolso', proveedor: 'sup3', requiereVerificacion: false, variantes: { color: ['Natural', 'Terracota', 'Sage'] }, destacado: true, marca: 'Tejidos Ñu', descripcion: 'Bolso tote tejido a mano con asas reforzadas.', ventaConjunto: { activo: false, unidades: 1 } },
    { id: 'p8', nombre: 'Gorra Bordada', categoria: 'accesorios', subcategoria: 'Gorras', precio: 65000, precioCosto: 38000, stock: 0, icon: 'gorra', proveedor: 'sup3', requiereVerificacion: true, variantes: { color: ['Beige', 'Negro', 'Verde'] }, destacado: false, marca: 'Basics Co.', descripcion: 'Gorra de algodón con bordado frontal y cierre ajustable trasero.', ventaConjunto: { activo: false, unidades: 1 } },
    { id: 'p9', nombre: 'Lentes de Sol Redondos', categoria: 'accesorios', subcategoria: 'Lentes', precio: 112000, precioCosto: 64000, stock: 20, icon: 'lentes', proveedor: 'sup3', requiereVerificacion: false, variantes: { color: ['Carey', 'Negro'] }, destacado: false, marca: 'Óptica Sol', descripcion: 'Lentes de sol con protección UV400 y marco liviano de acetato.', ventaConjunto: { activo: true, unidades: 2 } },
    { id: 'p10', nombre: 'Reloj Analógico Minimal', categoria: 'accesorios', subcategoria: 'Bolsos', precio: 298000, precioCosto: 175000, stock: 5, icon: 'reloj', proveedor: 'sup3', requiereVerificacion: false, variantes: { color: ['Cuero marrón', 'Acero'] }, destacado: true, marca: 'Tiempo', descripcion: 'Reloj analógico de esfera minimalista con correa de cuero genuino.', ventaConjunto: { activo: false, unidades: 1 } },
  ];

  const productIdByKey: Record<string, string> = {};
  for (const [index, p] of productsData.entries()) {
    const product = await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        codigo: `PRD-${String(index + 1).padStart(4, '0')}`,
        nombre: p.nombre,
        marca: p.marca,
        descripcion: p.descripcion,
        precio: p.precio,
        precioCosto: p.precioCosto,
        stock: p.stock,
        icon: p.icon,
        requiereVerificacion: p.requiereVerificacion,
        destacado: p.destacado,
        ventaConjuntoActivo: p.ventaConjunto.activo,
        ventaConjuntoUnidades: p.ventaConjunto.unidades,
        categoryId: categoryIdByKey[p.categoria],
        subcategoryId: subcategoryIdByKey[`${p.categoria}:${p.subcategoria}`],
        supplierId: supplierIdByKey[p.proveedor],
        variantes: {
          create: Object.entries(p.variantes).map(([tipo, valores]) => ({ tipo, valores })),
        },
      },
    });
    productIdByKey[p.id] = product.id;
  }

  await prisma.coupon.upsert({
    where: { codigo: 'BIENVENIDA10' },
    update: {},
    create: { codigo: 'BIENVENIDA10', tipo: 'PORCENTAJE', valor: 10, activo: true, usos: 34, alcance: 'TODOS' },
  });
  await prisma.coupon.upsert({
    where: { codigo: 'ENVIOGRATIS' },
    update: {},
    create: { codigo: 'ENVIOGRATIS', tipo: 'ENVIO_GRATIS', valor: 0, activo: true, usos: 12, alcance: 'TODOS' },
  });
  const verano = await prisma.coupon.upsert({
    where: { codigo: 'VERANO50K' },
    update: {},
    create: { codigo: 'VERANO50K', tipo: 'MONTO_FIJO', valor: 50000, activo: false, usos: 8, alcance: 'PRODUCTOS' },
  });
  for (const productId of ['p4', 'p5']) {
    await prisma.couponProduct.upsert({
      where: { couponId_productId: { couponId: verano.id, productId } },
      update: {},
      create: { couponId: verano.id, productId },
    });
  }

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@tienda.com';
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'CambiarEsta123!';
  await prisma.adminUser.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      nombre: 'Valentina Ortiz',
      email: superAdminEmail,
      passwordHash: await hashPassword(superAdminPassword),
      rol: 'SUPER_ADMIN',
      activo: true,
    },
  });

  console.log('Seed completo. Super Admin:', superAdminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
