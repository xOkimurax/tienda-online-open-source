'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { storeFetch, storeJson, ApiError } from '@/lib/storeApi';
import { useCart } from '@/lib/CartContext';
import { useStoreAuth } from '@/lib/StoreAuthContext';
import { useToast } from '@/lib/ToastContext';
import { formatGs } from '@/lib/format';
import { ComprobanteUploader } from '@/components/ComprobanteUploader';
import { BankInfo, CouponType, CustomerAddress, Order, TipoEntrega } from '@/lib/types';

type PayMethod = 'tarjeta' | 'transferencia';
type AppliedCoupon = { codigo: string; tipo: CouponType; valor: number };
type NewAddressForm = { nombre: string; ci: string; celular: string; ciudad: string; barrio: string; esPredeterminada: boolean };
const EMPTY_ADDRESS_FORM: NewAddressForm = { nombre: '', ci: '', celular: '', ciudad: '', barrio: '', esPredeterminada: false };

function discountedTotal(subtotal: number, coupon: AppliedCoupon | null) {
  if (!coupon) return subtotal;
  if (coupon.tipo === 'PORCENTAJE') return Math.round(subtotal * (1 - coupon.valor / 100));
  if (coupon.tipo === 'MONTO_FIJO') return Math.max(0, subtotal - coupon.valor);
  return subtotal; // ENVIO_GRATIS doesn't discount the product subtotal
}

// Shared by both checkout flows below — the admin can disable either
// payment method from Configuración (at least one always stays active,
// enforced server-side), so the storefront can't just hardcode both
// options as always available.
function usePaymentMethods() {
  // Starts with both "on" and `loading: true` — NOT a real default, just a
  // shape to render nothing sensible from before the real config arrives.
  // Callers must gate on `loading` themselves, otherwise a method the admin
  // disabled still flashes visible for a moment on every page load.
  const [methods, setMethods] = useState({ tarjetaActivo: true, transferenciaActivo: true, loading: true });
  useEffect(() => {
    storeJson<{ pagoTarjetaActivo: boolean; pagoTransferenciaActivo: boolean }>('/api/store/content/branding', 'GET')
      .then((data) => setMethods({ tarjetaActivo: data.pagoTarjetaActivo, transferenciaActivo: data.pagoTransferenciaActivo, loading: false }))
      .catch(() => setMethods((m) => ({ ...m, loading: false })));
  }, []);
  return methods;
}

// Only used by CartCheckout — explains, in concrete terms, how long a
// verification-required item stays payable once confirmed before it needs
// re-verification (see backend lib/verificationCron.ts).
function useVerificationTolerance() {
  const [horas, setHoras] = useState<number | null>(null);
  useEffect(() => {
    storeJson<{ toleranciaHoras: number }>('/api/store/content/verification-settings', 'GET')
      .then((data) => setHoras(data.toleranciaHoras))
      .catch(() => {});
  }, []);
  return horas;
}

// Shared by both the normal cart checkout and the "resume payment" flow —
// picking/adding a shipping address looks and behaves the same either way.
function AddressPicker({
  addresses,
  selectedAddressId,
  setSelectedAddressId,
  showNewAddressForm,
  setShowNewAddressForm,
  newAddressForm,
  setNewAddressForm,
  savingAddress,
  saveNewAddress,
}: {
  addresses: CustomerAddress[];
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string) => void;
  showNewAddressForm: boolean;
  setShowNewAddressForm: (v: boolean) => void;
  newAddressForm: NewAddressForm;
  setNewAddressForm: (f: NewAddressForm) => void;
  savingAddress: boolean;
  saveNewAddress: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {addresses.map((addr) => (
        <label
          key={addr.id}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12,
            border: `1px solid ${selectedAddressId === addr.id ? 'var(--color-accent-500)' : 'var(--color-divider)'}`,
            borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13,
          }}
        >
          <input type="radio" name="direccion" checked={selectedAddressId === addr.id} onChange={() => setSelectedAddressId(addr.id)} style={{ marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600 }}>
              {addr.nombre} {addr.esPredeterminada && <span className="tag tag-accent" style={{ fontSize: 10, marginLeft: 6 }}>Predeterminada</span>}
            </div>
            <div style={{ opacity: 0.6, marginTop: 2 }}>
              CI: {addr.ci} · Cel: {addr.celular} · {addr.barrio}, {addr.ciudad}
            </div>
          </div>
        </label>
      ))}

      {!showNewAddressForm ? (
        <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start', padding: '6px 10px', fontSize: 12.5 }} onClick={() => setShowNewAddressForm(true)}>
          + Añadir nueva dirección
        </button>
      ) : (
        <div style={{ padding: 12, border: '1px dashed var(--color-neutral-300)', borderRadius: 'var(--radius-md)' }}>
          <div className="grid-2">
            <div className="field">
              <label>Nombre<span className="field-required">*</span></label>
              <input className="input" value={newAddressForm.nombre} onChange={(e) => setNewAddressForm({ ...newAddressForm, nombre: e.target.value })} />
            </div>
            <div className="field">
              <label>CI<span className="field-required">*</span></label>
              <input className="input" value={newAddressForm.ci} onChange={(e) => setNewAddressForm({ ...newAddressForm, ci: e.target.value })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Celular<span className="field-required">*</span></label>
              <input className="input" value={newAddressForm.celular} onChange={(e) => setNewAddressForm({ ...newAddressForm, celular: e.target.value })} />
            </div>
            <div className="field">
              <label>Ciudad<span className="field-required">*</span></label>
              <input className="input" value={newAddressForm.ciudad} onChange={(e) => setNewAddressForm({ ...newAddressForm, ciudad: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Barrio<span className="field-required">*</span></label>
            <input className="input" value={newAddressForm.barrio} onChange={(e) => setNewAddressForm({ ...newAddressForm, barrio: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingAddress || !newAddressForm.nombre.trim() || !newAddressForm.ci.trim() || !newAddressForm.celular.trim() || !newAddressForm.ciudad.trim() || !newAddressForm.barrio.trim()}
              onClick={saveNewAddress}
              style={{ padding: '8px 14px', fontSize: 12.5 }}
            >
              {savingAddress ? 'Guardando…' : 'Guardar dirección'}
            </button>
            <button type="button" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 12.5 }} onClick={() => { setShowNewAddressForm(false); setNewAddressForm(EMPTY_ADDRESS_FORM); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {addresses.length === 0 && !showNewAddressForm && (
        <p style={{ fontSize: 12.5, opacity: 0.6, margin: 0 }}>Todavía no tenés direcciones guardadas — añadí una para continuar.</p>
      )}
    </div>
  );
}

function EntregaCard(props: {
  tipoEntrega: TipoEntrega;
  setTipoEntrega: (t: TipoEntrega) => void;
  addresses: CustomerAddress[];
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string) => void;
  showNewAddressForm: boolean;
  setShowNewAddressForm: (v: boolean) => void;
  newAddressForm: NewAddressForm;
  setNewAddressForm: (f: NewAddressForm) => void;
  savingAddress: boolean;
  saveNewAddress: () => void;
}) {
  const { tipoEntrega, setTipoEntrega, ...pickerProps } = props;
  return (
    <div className="card elev-sm">
      <div className="card-title">Entrega</div>
      <div className="seg" role="radiogroup" style={{ margin: 'var(--space-3) 0' }}>
        <label className="seg-opt">
          <input type="radio" name="tipoentrega" checked={tipoEntrega === 'RETIRO_LOCAL'} onChange={() => setTipoEntrega('RETIRO_LOCAL')} />
          Retirar en el local
        </label>
        <label className="seg-opt">
          <input type="radio" name="tipoentrega" checked={tipoEntrega === 'ENVIO_DOMICILIO'} onChange={() => setTipoEntrega('ENVIO_DOMICILIO')} />
          Enviar a domicilio
        </label>
      </div>
      {tipoEntrega === 'ENVIO_DOMICILIO' && <AddressPicker {...pickerProps} />}
    </div>
  );
}

// Shared hook: loads the customer's saved addresses and manages the
// "add new address" mini-form, used identically whether we're building a
// brand-new order or editing an existing pending one.
function useAddressSelection(initialAddressId: string | null = null) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(initialAddressId);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState<NewAddressForm>(EMPTY_ADDRESS_FORM);
  const [savingAddress, setSavingAddress] = useState(false);

  function loadAddresses() {
    storeJson<CustomerAddress[]>('/api/store/addresses', 'GET').then((data) => {
      setAddresses(data);
      setSelectedAddressId((current) => current ?? data.find((a) => a.esPredeterminada)?.id ?? data[0]?.id ?? null);
    });
  }
  useEffect(() => {
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveNewAddress() {
    if (savingAddress) return;
    setSavingAddress(true);
    try {
      const created = await storeJson<CustomerAddress>('/api/store/addresses', 'POST', newAddressForm);
      setNewAddressForm(EMPTY_ADDRESS_FORM);
      setShowNewAddressForm(false);
      const data = await storeJson<CustomerAddress[]>('/api/store/addresses', 'GET');
      setAddresses(data);
      setSelectedAddressId(created.id);
    } finally {
      setSavingAddress(false);
    }
  }

  return { addresses, selectedAddressId, setSelectedAddressId, showNewAddressForm, setShowNewAddressForm, newAddressForm, setNewAddressForm, savingAddress, saveNewAddress };
}

// Resuming payment for an order already created (e.g. from "Compras en
// proceso" → "Continuar con el pago"). Nothing has actually been charged
// yet while the order is PENDIENTE, so delivery and payment method stay
// fully editable here too — this isn't a read-only recap.
function ResumePaymentCheckout({ orderId }: { orderId: string }) {
  const router = useRouter();
  const flash = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>('tarjeta');
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('RETIRO_LOCAL');
  const addressSelection = useAddressSelection();
  const { tarjetaActivo, transferenciaActivo, loading: paymentMethodsLoading } = usePaymentMethods();

  useEffect(() => {
    storeJson<Order>(`/api/store/orders/${orderId}`, 'GET')
      .then((o) => {
        setOrder(o);
        setPayMethod(o.metodoPago === 'TRANSFERENCIA' ? 'transferencia' : 'tarjeta');
        setTipoEntrega(o.tipoEntrega);
      })
      .catch(() => setNotFound(true));
  }, [orderId]);

  useEffect(() => {
    storeJson<BankInfo>('/api/store/content/bank-info', 'GET').then(setBankInfo);
  }, []);

  // If the method this order was saved with (or the default) got disabled
  // meanwhile, fall back to whichever one is still active.
  useEffect(() => {
    if (payMethod === 'tarjeta' && !tarjetaActivo && transferenciaActivo) setPayMethod('transferencia');
    if (payMethod === 'transferencia' && !transferenciaActivo && tarjetaActivo) setPayMethod('tarjeta');
  }, [tarjetaActivo, transferenciaActivo, payMethod]);

  if (notFound) return <p style={{ opacity: 0.6 }}>No encontramos ese pedido.</p>;
  if (!order) return null;

  if (order.estado !== 'PENDIENTE') {
    return (
      <div className="card elev-sm" style={{ maxWidth: 560 }}>
        <p className="card-body">Este pedido ya no está pendiente de pago.</p>
        <button type="button" className="btn btn-secondary" onClick={() => router.push(`/pedidos/${order.id}`)}>
          Ver pedido
        </button>
      </div>
    );
  }

  const deliveryValid = tipoEntrega === 'RETIRO_LOCAL' || !!addressSelection.selectedAddressId;

  async function saveDelivery(metodoPago: PayMethod) {
    await storeJson(`/api/store/orders/${orderId}`, 'PATCH', {
      metodoPago,
      tipoEntrega,
      addressId: tipoEntrega === 'ENVIO_DOMICILIO' ? addressSelection.selectedAddressId ?? undefined : undefined,
    });
  }

  async function payWithCard() {
    setSubmitting(true);
    try {
      await saveDelivery('tarjeta');
      const data = await storeJson<{ checkoutUrl: string }>(`/api/store/orders/${orderId}/pay`, 'POST');
      window.location.href = data.checkoutUrl;
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo continuar con el pago', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitComprobante() {
    if (!comprobante) return;
    setSubmitting(true);
    try {
      await saveDelivery('transferencia');
      const form = new FormData();
      form.append('comprobante', comprobante);
      await storeFetch(`/api/store/orders/${orderId}/comprobante`, { method: 'POST', body: form });
      flash('Comprobante enviado — orden en revisión');
      router.push('/cuenta');
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo enviar el comprobante', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid-main-side">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <EntregaCard tipoEntrega={tipoEntrega} setTipoEntrega={setTipoEntrega} {...addressSelection} />

        <div className="card elev-sm">
          <div className="card-title">Método de pago</div>
          {paymentMethodsLoading ? (
            <p style={{ fontSize: 13, opacity: 0.55, margin: 'var(--space-3) 0' }}>Cargando métodos de pago…</p>
          ) : (
            <div className="seg" role="radiogroup" style={{ margin: 'var(--space-3) 0' }}>
              {tarjetaActivo && (
                <label className="seg-opt">
                  <input type="radio" name="paymethod" checked={payMethod === 'tarjeta'} onChange={() => setPayMethod('tarjeta')} />
                  Tarjeta (Stripe)
                </label>
              )}
              {transferenciaActivo && (
                <label className="seg-opt">
                  <input type="radio" name="paymethod" checked={payMethod === 'transferencia'} onChange={() => setPayMethod('transferencia')} />
                  Transferencia bancaria
                </label>
              )}
            </div>
          )}

          {!paymentMethodsLoading && payMethod === 'tarjeta' && tarjetaActivo && (
            <>
              <p style={{ fontSize: 12, opacity: 0.55 }}>
                Vas a ser redirigido a Stripe Checkout (modo de prueba) — no se realiza ningún cobro real.
              </p>
              <button type="button" className="btn btn-primary btn-block" disabled={submitting || !deliveryValid} onClick={payWithCard}>
                Pagar Gs. {formatGs(order.total)}
              </button>
            </>
          )}

          {!paymentMethodsLoading && payMethod === 'transferencia' && transferenciaActivo && bankInfo && (
            <>
              <div style={{ padding: 14, background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-md)', fontSize: 13.5, marginBottom: 'var(--space-3)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Datos para transferencia</div>
                {bankInfo.alias && <div>Alias: {bankInfo.alias}</div>}
                <div>Banco: {bankInfo.banco}</div>
                <div>Tipo de cuenta: {bankInfo.tipoCuenta}</div>
                <div>Número de cuenta: {bankInfo.numero}</div>
                <div>Titular: {bankInfo.titular}</div>
                <div>Identificación: {bankInfo.identificacion}</div>
              </div>
              <div className="field">
                <label>Comprobante</label>
                <ComprobanteUploader file={comprobante} onSelect={setComprobante} onRemove={() => setComprobante(null)} />
              </div>
              <button type="button" className="btn btn-primary btn-block" disabled={!comprobante || submitting || !deliveryValid} onClick={submitComprobante}>
                Enviar comprobante y confirmar pedido
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card elev-sm">
        <div className="card-title">Resumen</div>
        {order.items.map((it) => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-divider)', fontSize: 13.5 }}>
            <div>
              {it.nombre}
              <div style={{ fontSize: 11.5, opacity: 0.55 }}>
                {it.variante} × {it.cantidad}{it.tipoVenta === 'PAQUETE' ? ' paquetes' : ''}
              </div>
            </div>
            <div>Gs. {formatGs(it.precio * it.cantidad)}</div>
          </div>
        ))}
        {order.couponCode && (
          <div style={{ fontSize: 13, marginTop: 'var(--space-2)' }}>
            Cupón aplicado: <strong>{order.couponCode}</strong>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginTop: 'var(--space-3)' }}>
          <span>Total</span><span>Gs. {formatGs(order.total)}</span>
        </div>
      </div>
    </div>
  );
}

function CartCheckout() {
  const router = useRouter();
  const cart = useCart();
  const flash = useToast();
  const toleranciaHoras = useVerificationTolerance();
  const [payMethod, setPayMethod] = useState<PayMethod>('tarjeta');
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { tarjetaActivo, transferenciaActivo, loading: paymentMethodsLoading } = usePaymentMethods();

  useEffect(() => {
    if (payMethod === 'tarjeta' && !tarjetaActivo && transferenciaActivo) setPayMethod('transferencia');
    if (payMethod === 'transferencia' && !transferenciaActivo && tarjetaActivo) setPayMethod('tarjeta');
  }, [tarjetaActivo, transferenciaActivo, payMethod]);

  const [couponSectionVisible, setCouponSectionVisible] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('RETIRO_LOCAL');
  const addressSelection = useAddressSelection();

  useEffect(() => {
    storeJson<BankInfo>('/api/store/content/bank-info', 'GET').then(setBankInfo);
  }, []);

  // The coupon field only shows up if some product actually being bought
  // has a coupon assigned to it (store-wide or product-specific) — no point
  // showing an input that could never do anything.
  useEffect(() => {
    if (cart.items.length === 0) return;
    const productIds = cart.items.map((it) => it.productId).join(',');
    storeJson<{ applicable: boolean }>(`/api/store/coupons/applicable?productIds=${encodeURIComponent(productIds)}`, 'GET')
      .then((res) => setCouponSectionVisible(res.applicable))
      .catch(() => setCouponSectionVisible(false));
  }, [cart.items]);

  if (cart.items.length === 0) {
    return <p style={{ opacity: 0.6 }}>Tu carrito está vacío.</p>;
  }

  const verificationItems = cart.items.filter((it) => it.requiereVerificacion);
  const needsVerification = verificationItems.length > 0;
  const isMixedCart = needsVerification && verificationItems.length < cart.items.length;
  // Only a fully-verification cart hides the payment method card entirely —
  // a mixed cart still lets the customer pay for the rest right away; the
  // checkout split into two separate orders server-side takes care of the
  // verification-required items on their own.
  const allRequireVerification = needsVerification && !isMixedCart;

  function verificationFlashMessage() {
    return verificationItems.length === 1
      ? 'El producto que requería verificación se envió a revisión — te avisamos por email.'
      : `Los ${verificationItems.length} productos que requerían verificación se enviaron a revisión — te avisamos por email.`;
  }
  const checkoutItems = cart.items.map((it) => ({ productId: it.productId, cantidad: it.cantidad, variante: it.varianteLabel, tipoVenta: it.tipoVenta }));
  const total = discountedTotal(cart.total, appliedCoupon);
  // When the cart is mixed, only the non-verification items are actually
  // payable right now (the backend splits them into a separate order) — the
  // "Pagar" button has to reflect that subset's total, not the full cart's,
  // or the customer sees a bigger number than what actually gets charged.
  // The discount is approximated proportionally here for display only; the
  // backend is the source of truth for the real split amounts.
  const normalSubtotal = cart.items.filter((it) => !it.requiereVerificacion).reduce((sum, it) => sum + it.precio * it.cantidad, 0);
  const payNowTotal = isMixedCart && cart.total > 0 ? Math.round(normalSubtotal - (cart.total - total) * (normalSubtotal / cart.total)) : total;
  const deliveryValid = tipoEntrega === 'RETIRO_LOCAL' || !!addressSelection.selectedAddressId;
  const deliveryPayload = { tipoEntrega, addressId: tipoEntrega === 'ENVIO_DOMICILIO' ? addressSelection.selectedAddressId ?? undefined : undefined };

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const productIds = cart.items.map((it) => it.productId);
      const data = await storeJson<AppliedCoupon>('/api/store/coupons/validate', 'POST', { codigo: couponInput.trim(), productIds });
      setAppliedCoupon(data);
      flash('Cupón aplicado');
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err instanceof ApiError ? err.message : 'No se pudo aplicar el cupón');
    } finally {
      setApplyingCoupon(false);
    }
  }
  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  }

  // None of these three clear the cart — it's only cleared server-side once
  // an order's payment is actually confirmed (Stripe webhook, or an admin
  // confirming a bank transfer — see backend lib/orderStock.ts). Clearing it
  // here, before Stripe redirect or before an admin ever reviews anything,
  // meant a cancelled/failed payment still lost the customer's cart.
  async function placeVerificationOrder() {
    setSubmitting(true);
    try {
      await storeJson('/api/store/checkout', 'POST', { items: checkoutItems, metodoPago: 'transferencia', couponCode: appliedCoupon?.codigo, ...deliveryPayload });
      flash('Pedido enviado a verificación de existencia');
      router.push('/cuenta');
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo confirmar el pedido', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function payWithCard() {
    setSubmitting(true);
    try {
      const data = await storeJson<{ verificationOrder?: Order; normalOrder?: Order; checkoutUrl?: string }>('/api/store/checkout', 'POST', {
        items: checkoutItems,
        metodoPago: 'tarjeta',
        couponCode: appliedCoupon?.codigo,
        ...deliveryPayload,
      });
      if (data.checkoutUrl) {
        // Only a best-effort flash — the redirect below cuts it short, but
        // it's better than nothing for a cart that got split in two.
        if (data.verificationOrder) flash(verificationFlashMessage());
        window.location.href = data.checkoutUrl;
      } else {
        // No checkoutUrl means there was nothing left to actually charge —
        // either the whole cart needed verification, or something went
        // wrong creating the payable half.
        flash(data.verificationOrder ? 'Pedido enviado a verificación de existencia' : 'No se pudo procesar el pago', data.verificationOrder ? 'success' : 'error');
        router.push('/cuenta');
      }
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo procesar el pago', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTransferOrder() {
    if (!comprobante) return;
    setSubmitting(true);
    try {
      const data = await storeJson<{ verificationOrder?: Order; normalOrder?: Order }>('/api/store/checkout', 'POST', {
        items: checkoutItems,
        metodoPago: 'transferencia',
        couponCode: appliedCoupon?.codigo,
        ...deliveryPayload,
      });
      if (data.normalOrder) {
        const form = new FormData();
        form.append('comprobante', comprobante);
        await storeFetch(`/api/store/orders/${data.normalOrder.id}/comprobante`, { method: 'POST', body: form });
      }
      if (data.verificationOrder && data.normalOrder) {
        flash(`Comprobante enviado — orden en revisión. ${verificationFlashMessage()}`);
      } else if (data.normalOrder) {
        flash('Comprobante enviado — orden en revisión');
      } else {
        flash('Pedido enviado a verificación de existencia');
      }
      router.push('/cuenta');
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo enviar el comprobante', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const resumenCard = (
    <div className="card elev-sm">
      <div className="card-title">Resumen</div>
      {cart.items.map((it) => (
        <div key={it.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-divider)', fontSize: 13.5 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {it.nombre}
              {it.requiereVerificacion && (
                <span className="tag tag-outline" style={{ fontSize: 10 }}>Requiere verificación</span>
              )}
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.55 }}>
              {it.varianteLabel} × {it.cantidad}{it.tipoVenta === 'PAQUETE' ? ' paquetes' : ''}
            </div>
          </div>
          <div>Gs. {formatGs(it.precio * it.cantidad)}</div>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, margin: 'var(--space-3) 0' }}>
        <span>Subtotal</span><span>Gs. {formatGs(cart.total)}</span>
      </div>

      {couponSectionVisible && (
        <div style={{ margin: 'var(--space-3) 0', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-divider)' }}>
          {!appliedCoupon ? (
            <>
              <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 6 }}>¿Tenés un cupón?</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  placeholder="Código de cupón"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  style={{ padding: '8px 10px', fontSize: 13 }}
                />
                <button type="button" className="btn btn-secondary" disabled={applyingCoupon || !couponInput.trim()} onClick={applyCoupon} style={{ whiteSpace: 'nowrap', padding: '0 12px' }}>
                  {applyingCoupon ? '…' : 'Aplicar'}
                </button>
              </div>
              {couponError && <p style={{ fontSize: 12, color: 'var(--color-accent-700)', margin: '6px 0 0' }}>{couponError}</p>}
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
              <span>
                Cupón <strong>{appliedCoupon.codigo}</strong>{' '}
                {appliedCoupon.tipo === 'PORCENTAJE' && `(-${appliedCoupon.valor}%)`}
                {appliedCoupon.tipo === 'MONTO_FIJO' && `(-Gs. ${formatGs(appliedCoupon.valor)})`}
                {appliedCoupon.tipo === 'ENVIO_GRATIS' && '(envío gratis)'}
              </span>
              <button type="button" className="btn btn-ghost" onClick={removeCoupon} style={{ padding: '2px 6px', fontSize: 12 }}>Quitar</button>
            </div>
          )}
        </div>
      )}

      {appliedCoupon && appliedCoupon.tipo !== 'ENVIO_GRATIS' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--color-accent-700)' }}>
          <span>Descuento</span><span>-Gs. {formatGs(cart.total - total)}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginTop: 'var(--space-2)' }}>
        <span>Total</span><span>Gs. {formatGs(total)}</span>
      </div>
      {isMixedCart && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, opacity: 0.65, marginTop: 4 }}>
          <span>A pagar ahora (resto queda en revisión)</span><span>Gs. {formatGs(payNowTotal)}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid-main-side">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <EntregaCard tipoEntrega={tipoEntrega} setTipoEntrega={setTipoEntrega} {...addressSelection} />

        {needsVerification && (
          <div className="card elev-sm">
            <div className="card-title" style={{ marginBottom: 10 }}>
              {verificationItems.length === 1 ? 'Este producto requiere' : 'Estos productos requieren'} confirmación de existencia
            </div>
            <div style={{ margin: '0 0 var(--space-3)' }}>
              {verificationItems.map((it) => (
                <div key={it.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0', fontSize: 13 }}>
                  <span>
                    {it.nombre} <span style={{ opacity: 0.55 }}>({it.varianteLabel} × {it.cantidad})</span>
                  </span>
                  <button type="button" className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 12, flex: 'none' }} onClick={() => cart.remove(it.key)}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <p className="card-body">
              {isMixedCart
                ? 'Van a pasar a un pedido aparte, en revisión de disponibilidad — el resto de tu carrito lo podés pagar ahora mismo, más abajo.'
                : 'Te avisamos por email apenas el equipo confirme o rechace la disponibilidad — todavía no se te va a cobrar ni se muestran datos de pago.'}
              {toleranciaHoras != null && (
                <> Una vez confirmada la existencia, vas a tener {toleranciaHoras}hs para completar el pago antes de que el
                pedido vuelva a necesitar verificación.</>
              )}
            </p>
            {allRequireVerification && (
              <button type="button" className="btn btn-secondary" disabled={submitting || !deliveryValid} onClick={placeVerificationOrder}>
                Confirmar pedido para verificación
              </button>
            )}
          </div>
        )}

        {!allRequireVerification && (
          <div className="card elev-sm">
            <div className="card-title">Método de pago</div>
            {paymentMethodsLoading ? (
              <p style={{ fontSize: 13, opacity: 0.55, margin: 'var(--space-3) 0' }}>Cargando métodos de pago…</p>
            ) : (
              <div className="seg" role="radiogroup" style={{ margin: 'var(--space-3) 0' }}>
                {tarjetaActivo && (
                  <label className="seg-opt">
                    <input type="radio" name="paymethod" checked={payMethod === 'tarjeta'} onChange={() => setPayMethod('tarjeta')} />
                    Tarjeta (Stripe)
                  </label>
                )}
                {transferenciaActivo && (
                  <label className="seg-opt">
                    <input type="radio" name="paymethod" checked={payMethod === 'transferencia'} onChange={() => setPayMethod('transferencia')} />
                    Transferencia bancaria
                  </label>
                )}
              </div>
            )}

            {!paymentMethodsLoading && payMethod === 'tarjeta' && tarjetaActivo && (
              <>
                <p style={{ fontSize: 12, opacity: 0.55 }}>
                  Vas a ser redirigido a Stripe Checkout (modo de prueba) — no se realiza ningún cobro real.
                </p>
                <button type="button" className="btn btn-primary btn-block" disabled={submitting || !deliveryValid} onClick={payWithCard}>
                  Pagar Gs. {formatGs(payNowTotal)}
                </button>
              </>
            )}

            {!paymentMethodsLoading && payMethod === 'transferencia' && transferenciaActivo && bankInfo && (
              <>
                <div style={{ padding: 14, background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-md)', fontSize: 13.5, marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Datos para transferencia</div>
                  {bankInfo.alias && <div>Alias: {bankInfo.alias}</div>}
                  <div>Banco: {bankInfo.banco}</div>
                  <div>Tipo de cuenta: {bankInfo.tipoCuenta}</div>
                  <div>Número de cuenta: {bankInfo.numero}</div>
                  <div>Titular: {bankInfo.titular}</div>
                  <div>Identificación: {bankInfo.identificacion}</div>
                </div>
                <div className="field">
                  <label>Comprobante</label>
                  <ComprobanteUploader file={comprobante} onSelect={setComprobante} onRemove={() => setComprobante(null)} />
                </div>
                <button type="button" className="btn btn-primary btn-block" disabled={!comprobante || submitting || !deliveryValid} onClick={submitTransferOrder}>
                  Enviar comprobante y confirmar pedido
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {resumenCard}
    </div>
  );
}

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customer, loading } = useStoreAuth();
  const orderId = searchParams.get('orderId');

  useEffect(() => {
    if (!loading && !customer) router.replace(`/auth?redirect=${orderId ? `/checkout?orderId=${orderId}` : '/checkout'}`);
  }, [loading, customer, router, orderId]);

  if (loading || !customer) return null;

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 var(--space-4)' }}>Checkout</h1>
      {orderId ? <ResumePaymentCheckout orderId={orderId} /> : <CartCheckout />}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}
