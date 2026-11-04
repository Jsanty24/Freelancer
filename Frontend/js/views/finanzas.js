/**
 * Freelancer — Vista Finanzas, Billetera Multidivisa y Facturación
 */

const FinanzasView = {
  render() {
    const container = document.getElementById('viewFinanzas');
    if (!container) return;

    const facturas = window.State.data.facturas || [];
    const usuarios = window.State.data.usuarios || [];

    // Calcular saldos
    let saldoDisponible = 0;
    let saldoEnEscrow = 0;
    let saldoTotal = 0;

    facturas.forEach(f => {
      const val = Number(f.valor_total) || 0;
      saldoTotal += val;
      if (f.estado_factura === 'PAGADA') {
        saldoDisponible += val;
      } else if (f.estado_factura === 'PENDIENTE' || f.estado_factura === 'APROBADA') {
        saldoEnEscrow += val;
      }
    });

    container.innerHTML = `
      <!-- Header Finanzas -->
      <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-2 border border-emerald-200">
            <span class="material-symbols-outlined text-[15px]">account_balance_wallet</span> Kinetic Escrow Ledger
          </span>
          <h2 class="text-3xl font-bold text-slate-900 tracking-tight">Finanzas & Billetera Multidivisa</h2>
          <p class="text-slate-500 text-sm mt-1 max-w-2xl">
            Monitorea tus ingresos liberados, fondos retenidos en garantía por contratos y emite nuevas facturas fiscales con trazabilidad en microservicios.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button onclick="FinanzasView.abrirModalNuevaFactura()" class="btn-primary text-xs">
            <span class="material-symbols-outlined text-[16px]">receipt_long</span> + Emitir Nueva Factura
          </button>
        </div>
      </div>

      <!-- Tarjetas de Saldo -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div class="fl-card p-6 bg-gradient-to-br from-white to-emerald-50/50 border-emerald-200/60">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-emerald-800 uppercase tracking-wider">Saldo Disponible</span>
            <span class="p-2 rounded-xl bg-emerald-100 text-emerald-700 material-symbols-outlined text-[22px]">payments</span>
          </div>
          <div class="text-3xl sm:text-4xl font-bold text-emerald-800 font-mono tracking-tight">
            $${saldoDisponible.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div class="flex items-center justify-between mt-3 pt-3 border-t border-emerald-100 text-xs">
            <span class="text-slate-500">Listo para retiro</span>
            <button onclick="FinanzasView.retirarFondos()" class="text-emerald-700 font-bold hover:underline flex items-center gap-1">
              Retirar <span class="material-symbols-outlined text-[14px]">arrow_outward</span>
            </button>
          </div>
        </div>

        <div class="fl-card p-6 bg-gradient-to-br from-white to-amber-50/50 border-amber-200/60">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-amber-800 uppercase tracking-wider">En Custodia (Escrow)</span>
            <span class="p-2 rounded-xl bg-amber-100 text-amber-700 material-symbols-outlined text-[22px]">lock_clock</span>
          </div>
          <div class="text-3xl sm:text-4xl font-bold text-amber-900 font-mono tracking-tight">
            $${saldoEnEscrow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div class="flex items-center justify-between mt-3 pt-3 border-t border-amber-100 text-xs">
            <span class="text-slate-500">Pendiente de liberación</span>
            <span class="text-amber-800 font-mono font-semibold">100% garantizado</span>
          </div>
        </div>

        <div class="fl-card p-6 bg-gradient-to-br from-white to-violet-50/50 border-violet-200/60">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-violet-800 uppercase tracking-wider">Total Facturado Histórico</span>
            <span class="p-2 rounded-xl bg-violet-100 text-violet-700 material-symbols-outlined text-[22px]">savings</span>
          </div>
          <div class="text-3xl sm:text-4xl font-bold text-violet-900 font-mono tracking-tight">
            $${saldoTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div class="flex items-center justify-between mt-3 pt-3 border-t border-violet-100 text-xs">
            <span class="text-slate-500">${facturas.length} comprobantes</span>
            <span class="text-violet-700 font-mono font-semibold">Auditoría MySQL</span>
          </div>
        </div>
      </div>

      <!-- Tabla de Facturas -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-violet-700">receipt</span> Historial de Facturas & Comprobantes
          </h3>
          <span class="text-xs font-mono text-slate-500">${facturas.length} facturas emitidas</span>
        </div>

        <div class="fl-card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th class="py-3 px-4">Factura</th>
                  <th class="py-3 px-4">Cliente Facturado</th>
                  <th class="py-3 px-4">Especialista / Emisor</th>
                  <th class="py-3 px-4">Fecha Emisión</th>
                  <th class="py-3 px-4">Monto Total</th>
                  <th class="py-3 px-4">Estado</th>
                  <th class="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-mono">
                ${facturas.map(fac => {
                  const cliente = usuarios.find(u => u.id === fac.cliente_id);
                  const trabajador = usuarios.find(u => u.id === fac.trabajador_id);
                  const nombreCli = cliente ? cliente.nombre : `Cliente #${fac.cliente_id}`;
                  const nombreTrab = trabajador ? trabajador.nombre : `Especialista #${fac.trabajador_id}`;
                  const fechaStr = fac.fecha_emision ? new Date(fac.fecha_emision).toLocaleDateString() : 'N/A';

                  let badge = 'badge-warning';
                  if (fac.estado_factura === 'PAGADA') badge = 'badge-success';
                  if (fac.estado_factura === 'APROBADA') badge = 'badge-tech';

                  return `
                    <tr class="hover:bg-slate-50/80 transition-colors">
                      <td class="py-3 px-4 text-violet-700 font-bold">INV-${String(fac.id).padStart(4, '0')}</td>
                      <td class="py-3 px-4 font-sans font-medium text-slate-900 max-w-[180px] truncate" title="${nombreCli}">
                        ${nombreCli}
                      </td>
                      <td class="py-3 px-4 font-sans text-slate-600 max-w-[180px] truncate" title="${nombreTrab}">
                        ${nombreTrab}
                      </td>
                      <td class="py-3 px-4 text-slate-500">${fechaStr}</td>
                      <td class="py-3 px-4 font-bold text-slate-900 text-sm">
                        $${Number(fac.valor_total).toFixed(2)} <span class="text-[10px] text-slate-400 font-sans">USD</span>
                      </td>
                      <td class="py-3 px-4 font-sans">
                        <span class="${badge} text-[10px] uppercase font-bold">${fac.estado_factura}</span>
                      </td>
                      <td class="py-3 px-4 text-right font-sans">
                        ${fac.estado_factura !== 'PAGADA' ? `
                          <button onclick="FinanzasView.pagarFactura(${fac.id})" class="btn-primary text-xs py-1 px-3">
                            <span class="material-symbols-outlined text-[14px]">credit_card</span> Pagar Factura
                          </button>
                        ` : `
                          <button onclick="FinanzasView.descargarRecibo(${fac.id})" class="btn-secondary text-xs py-1 px-2.5">
                            <span class="material-symbols-outlined text-[14px]">download</span> Recibo
                          </button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async pagarFactura(facturaId) {
    if (!confirm(`¿Confirmas el pago y liberación de fondos para la Factura INV-${String(facturaId).padStart(4, '0')}?`)) {
      return;
    }

    try {
      window.App.mostrarToast(`Procesando pago de la Factura INV-${facturaId}...`, 'info');
      await window.API.pagarFactura(facturaId);
      window.App.mostrarToast(`¡Factura INV-${facturaId} pagada exitosamente! Fondos transferidos.`, 'success');
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`Error al pagar factura: ${error.message}`, 'error');
    }
  },

  descargarRecibo(facturaId) {
    window.App.mostrarToast(`Descargando comprobante fiscal INV-${String(facturaId).padStart(4, '0')} en PDF...`, 'info');
    setTimeout(() => {
      window.App.mostrarToast('¡Comprobante generado correctamente!', 'success');
    }, 800);
  },

  retirarFondos() {
    window.App.mostrarToast('Módulo de retiro: Selecciona transferencia bancaria ACH o wallet cripto USDC.', 'info');
  },

  abrirModalNuevaFactura() {
    const usuarios = window.State.data.usuarios || [];
    const clientes = usuarios.filter(u => u.rol === 'CLIENTE');
    const trabajadores = usuarios.filter(u => u.rol === 'TRABAJADOR');

    const modalBody = document.getElementById('genericModalContent');
    const modalTitle = document.getElementById('genericModalTitle');

    if (modalTitle) modalTitle.textContent = 'Emitir Nueva Factura';
    if (modalBody) {
      modalBody.innerHTML = `
        <form id="formNuevaFactura" onsubmit="FinanzasView.guardarNuevaFactura(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1">Cliente a Facturar</label>
            <select id="facClienteSelect" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-violet-600">
              ${clientes.map(c => `<option value="${c.id}">${c.nombre} (Cliente #${c.id})</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1">Especialista / Emisor</label>
            <select id="facTrabajadorSelect" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-violet-600">
              ${trabajadores.map(t => `<option value="${t.id}">${t.nombre} (Especialista #${t.id})</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1">Monto Total a Cobrar (USD)</label>
            <input id="facMontoInput" type="number" step="0.5" min="10" value="1500.00" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-violet-600 font-mono"/>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1">Concepto o Hitos Facturados</label>
            <input id="facConceptoInput" type="text" placeholder="Ej. Hito 02: Entrega de API Gateway y Pruebas Unitarias" class="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-violet-600"/>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <button type="button" onclick="window.App.cerrarModalGenerico()" class="btn-secondary text-xs">Cancelar</button>
            <button type="submit" class="btn-primary text-xs">Crear Factura en MySQL</button>
          </div>
        </form>
      `;
    }

    window.App.abrirModalGenerico();
  },

  async guardarNuevaFactura(event) {
    event.preventDefault();
    const clienteId = document.getElementById('facClienteSelect').value;
    const trabajadorId = document.getElementById('facTrabajadorSelect').value;
    const monto = document.getElementById('facMontoInput').value;

    try {
      window.App.mostrarToast('Emitiendo factura en microservicio Express (:3000)...', 'info');
      await window.API.crearFactura({
        cliente_id: Number(clienteId),
        trabajador_id: Number(trabajadorId),
        valor_total: Number(monto),
        estado_factura: 'PENDIENTE'
      });

      window.App.cerrarModalGenerico();
      window.App.mostrarToast('¡Factura emitida exitosamente en MySQL!', 'success');
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`Error al emitir factura: ${error.message}`, 'error');
    }
  }
};

window.FinanzasView = FinanzasView;
