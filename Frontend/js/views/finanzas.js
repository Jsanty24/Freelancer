/**
 * Freelancer — Vista de facturas, aprobación por cliente y resúmenes imprimibles
 */

const FinanzasView = {
  render() {
    const container = document.getElementById('viewFinanzas');
    if (!container) return;

    const facturas = window.State.data.facturas || [];
    const usuarios = window.State.data.usuarios || [];
    const trabajadores = window.State.data.trabajadores || [];
    const registrosTiempo = window.State.data.registrosTiempo || [];
    const usuarioActivo = window.State.data.usuarioActivo;
    const esTrabajador = usuarioActivo && usuarioActivo.rol === 'TRABAJADOR';
    const esCliente = usuarioActivo && usuarioActivo.rol === 'CLIENTE';
    const esAdmin = usuarioActivo && usuarioActivo.rol === 'ADMIN';
    const puedeGestionarFactura = esCliente || esAdmin;

    const horasAprobadasListas = registrosTiempo
      .filter(r => r.estado === 'APROBADO' && !r.factura_id)
      .reduce((acc, r) => acc + (Number(r.horas) || 0), 0);

    let totalPagadoRegistrado = 0;
    let totalPendiente = 0;
    let saldoTotal = 0;

    facturas.forEach(f => {
      const val = Number(f.valor_total) || 0;
      saldoTotal += val;
      if (f.estado_factura === 'PAGADA') {
        totalPagadoRegistrado += val;
      } else if (f.estado_factura === 'PENDIENTE' || f.estado_factura === 'APROBADA') {
        totalPendiente += val;
      }
    });

    container.innerHTML = `
      <!-- Header Finanzas -->
      <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-emerald-200 dark:border-emerald-800">
            <span class="material-symbols-outlined text-[15px]">receipt_long</span> Registro y aprobación de facturas
          </span>
          <h2 class="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Facturación</h2>
          <p class="text-slate-500 text-sm mt-1 max-w-2xl">
            Consulta, emite y aprueba las facturas registradas. Estos importes no representan dinero recibido, saldo disponible ni fondos en custodia.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          ${esTrabajador ? `
            <button onclick="FinanzasView.generarFactura()" class="btn-primary text-xs">
              <span class="material-symbols-outlined text-[16px]">receipt_long</span> Facturar horas aprobadas${horasAprobadasListas > 0 ? ` (${horasAprobadasListas.toFixed(2)} h)` : ''}
            </button>
          ` : ''}
          ${puedeGestionarFactura ? `
            <span class="text-xs text-slate-500 font-mono">Modo ${esAdmin ? 'Admin' : 'Cliente'}: Aprobación de Facturas</span>
          ` : ''}
        </div>
      </div>

      <div class="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        Esta plataforma no tiene una pasarela de pago ni un proveedor de custodia conectado. No procesa pagos, depósitos ni retiros; los estados de las facturas no verifican transacciones.
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div class="fl-card p-6 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-800 dark:to-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Facturas marcadas como pagadas</span>
            <span class="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 material-symbols-outlined text-[22px]">payments</span>
          </div>
          <div class="text-3xl sm:text-4xl font-bold text-emerald-800 dark:text-emerald-300 font-mono tracking-tight">
            $${totalPagadoRegistrado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div class="mt-3 border-t border-emerald-100 pt-3 text-xs text-slate-500 dark:border-emerald-900/40">Estado registrado; no confirma la recepción de fondos.</div>
        </div>

        <div class="fl-card p-6 bg-gradient-to-br from-white to-amber-50/50 dark:from-slate-800 dark:to-amber-950/20 border-amber-200/60 dark:border-amber-800/40">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Facturas pendientes / aprobadas</span>
            <span class="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 material-symbols-outlined text-[22px]">lock_clock</span>
          </div>
          <div class="text-3xl sm:text-4xl font-bold text-amber-900 dark:text-amber-300 font-mono tracking-tight">
            $${totalPendiente.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div class="mt-3 border-t border-amber-100 pt-3 text-xs text-slate-500 dark:border-amber-900/40">No están depositadas ni protegidas por custodia.</div>
        </div>

        <div class="fl-card p-6 bg-gradient-to-br from-white to-violet-50/50 dark:from-slate-800 dark:to-violet-950/20 border-violet-200/60 dark:border-emerald-800/40">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-violet-800 dark:text-violet-300 uppercase tracking-wider">Total registrado en facturas</span>
            <span class="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 material-symbols-outlined text-[22px]">savings</span>
          </div>
          <div class="text-3xl sm:text-4xl font-bold text-violet-900 dark:text-violet-300 font-mono tracking-tight">
            $${saldoTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div class="flex items-center justify-between mt-3 pt-3 border-t border-violet-100 dark:border-violet-900/40 text-xs">
            <span class="text-slate-500">${facturas.length} comprobantes</span>
            <span class="text-violet-700 dark:text-violet-400 font-mono font-semibold">Sin verificación de pago</span>
          </div>
        </div>
      </div>

      <!-- Tabla de Facturas -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-violet-700">receipt</span> Historial de facturas
          </h3>
          <span class="text-xs font-mono text-slate-500">${facturas.length} facturas emitidas</span>
        </div>

        ${facturas.length === 0 ? `
          <!-- Empty State Ilustrado -->
          <div class="p-12 bg-white dark:bg-slate-800/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
            <div class="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[36px]">receipt_long</span>
            </div>
            <h4 class="text-base font-bold text-slate-800 dark:text-white">No hay facturas registradas</h4>
            <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Las facturas generadas a partir de horas aprobadas aparecerán aquí. La plataforma no emite comprobantes fiscales.
            </p>
          </div>
        ` : `
          <div class="fl-card overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
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
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  ${facturas.map(fac => {
                    const cliente = usuarios.find(u => u.id === fac.cliente_id) ||
                      (usuarioActivo && usuarioActivo.id === fac.cliente_id ? usuarioActivo : null);
                    const trabajador = usuarios.find(u => u.id === fac.trabajador_id) ||
                      trabajadores.find(t => (t.usuario_id || t.id) === fac.trabajador_id) ||
                      (usuarioActivo && usuarioActivo.id === fac.trabajador_id ? usuarioActivo : null);
                    const nombreCli = cliente ? cliente.nombre : `Cliente #${fac.cliente_id}`;
                    const nombreTrab = trabajador ? trabajador.nombre : `Especialista #${fac.trabajador_id}`;
                    const fechaStr = fac.fecha_emision ? window.App.escapeHTML(new Date(fac.fecha_emision).toLocaleDateString()) : 'N/A';

                    let badge = 'badge-warning';
                    if (fac.estado_factura === 'PAGADA') badge = 'badge-success';
                    if (fac.estado_factura === 'APROBADA') badge = 'badge-tech';
                    if (fac.estado_factura === 'RECHAZADA') badge = 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-full px-2 py-0.5';

                    return `
                      <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td class="py-3 px-4 text-violet-700 dark:text-violet-400 font-bold">INV-${String(fac.id).padStart(4, '0')}</td>
                        <td class="py-3 px-4 font-sans font-medium text-slate-900 dark:text-white max-w-[180px] truncate" title="${window.App.escapeHTML(nombreCli)}">
                          ${window.App.escapeHTML(nombreCli)}
                        </td>
                        <td class="py-3 px-4 font-sans text-slate-600 dark:text-slate-300 max-w-[180px] truncate" title="${window.App.escapeHTML(nombreTrab)}">
                          ${window.App.escapeHTML(nombreTrab)}
                        </td>
                        <td class="py-3 px-4 text-slate-500">${fechaStr}</td>
                        <td class="py-3 px-4 font-bold text-slate-900 dark:text-white text-sm">
                          $${Number(fac.valor_total).toFixed(2)} <span class="text-[10px] text-slate-400 font-sans">USD</span>
                        </td>
                        <td class="py-3 px-4 font-sans">
                          <span class="${badge} text-[10px] uppercase font-bold">${window.App.escapeHTML(fac.estado_factura)}</span>
                        </td>
                        <td class="py-3 px-4 text-right font-sans">
                          <div class="inline-flex flex-wrap items-center justify-end gap-1.5">
                            ${puedeGestionarFactura && fac.estado_factura === 'PENDIENTE' ? `
                              <button onclick="FinanzasView.aprobarFactura(${Number(fac.id)})" class="btn-primary text-xs py-1 px-2.5">
                                <span class="material-symbols-outlined text-[14px]">check_circle</span> Aprobar
                              </button>
                              <button onclick="FinanzasView.cambiarEstadoFactura(${Number(fac.id)}, 'RECHAZADA')" class="px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-all">
                                Rechazar
                              </button>
                            ` : ''}
                            ${puedeGestionarFactura && fac.estado_factura === 'APROBADA' ? `
                              <button onclick="FinanzasView.cambiarEstadoFactura(${Number(fac.id)}, 'PAGADA')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 transition-all">
                                <span class="material-symbols-outlined text-[14px]">paid</span> Marcar Pagada
                              </button>
                            ` : ''}
                            <button onclick="FinanzasView.descargarRecibo(${Number(fac.id)})" class="btn-secondary text-xs py-1 px-2.5">
                              <span class="material-symbols-outlined text-[14px]">receipt</span> Resumen
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `}
      </div>
    `;
  },

  async aprobarFactura(facturaId) {
    return this.cambiarEstadoFactura(facturaId, 'APROBADA');
  },

  async cambiarEstadoFactura(facturaId, nuevoEstado) {
    try {
      window.App.mostrarToast(`Actualizando factura #${facturaId} a ${nuevoEstado}...`, 'info');
      await window.API.actualizarEstadoFactura(facturaId, nuevoEstado);
      window.App.mostrarToast(
        nuevoEstado === 'RECHAZADA'
          ? `Factura #${facturaId} rechazada. Las horas asociadas fueron liberadas a estado APROBADO.`
          : `Factura #${facturaId} actualizada a ${nuevoEstado}.`,
        'success'
      );
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`No se pudo actualizar la factura: ${error.message}`, 'error');
    }
  },

  /* ================= RESUMEN IMPRIMIBLE DE FACTURA ================= */
  descargarRecibo(facturaId) {
    const facturas = window.State.data.facturas || [];
    const usuarios = window.State.data.usuarios || [];
    const trabajadores = window.State.data.trabajadores || [];
    const usuarioActivo = window.State.data.usuarioActivo;

    const fac = facturas.find(f => f.id === Number(facturaId));
    if (!fac) {
      window.App.mostrarToast('No se encontró la factura solicitada', 'error');
      return;
    }

    const cliente = usuarios.find(u => u.id === fac.cliente_id) ||
      (usuarioActivo && usuarioActivo.id === fac.cliente_id ? usuarioActivo : null);
    const trabajador = usuarios.find(u => u.id === fac.trabajador_id) ||
      trabajadores.find(t => (t.usuario_id || t.id) === fac.trabajador_id) ||
      (usuarioActivo && usuarioActivo.id === fac.trabajador_id ? usuarioActivo : null);
    const nombreCli = cliente ? cliente.nombre : `Cliente #${fac.cliente_id}`;
    const nombreTrab = trabajador ? trabajador.nombre : `Especialista #${fac.trabajador_id}`;
    const numFactura = `INV-${String(fac.id).padStart(4, '0')}`;
    const fechaEmision = fac.fecha_emision ? new Date(fac.fecha_emision).toLocaleDateString() : new Date().toLocaleDateString();
    const monto = Number(fac.valor_total).toFixed(2);
    const nombreCliSeguro = window.App.escapeHTML(nombreCli);
    const nombreTrabSeguro = window.App.escapeHTML(nombreTrab);
    const fechaEmisionSegura = window.App.escapeHTML(fechaEmision);
    const estadoFacturaSeguro = window.App.escapeHTML(fac.estado_factura);

    // Abrir una ventana limpia con formato de factura oficial lista para imprimir / PDF
    const ventana = window.open('', '_blank', 'width=850,height=950');
    if (!ventana) {
      window.App.mostrarToast('Permite las ventanas emergentes para generar el comprobante fiscal', 'warning');
      return;
    }

    ventana.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8"/>
        <title>Resumen de factura - ${numFactura}</title>
        <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet"/>
        <style>
          body { font-family: 'Google Sans', sans-serif; margin: 40px; color: #0b1c30; background: #fff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #5842f5; padding-bottom: 24px; margin-bottom: 30px; }
          .logo { font-size: 26px; font-weight: 800; color: #3e1cde; }
          .badge { background: #fff7ed; color: #9a3412; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: bold; border: 1px solid #fed7aa; display: inline-block; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; font-size: 13px; }
          .card { background: #f8f9ff; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; }
          .card h4 { margin: 0 0 8px 0; color: #5842f5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
          th { background: #eff4ff; text-align: left; padding: 10px 14px; font-weight: 700; color: #3e1cde; border-bottom: 1px solid #dce9ff; }
          td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; }
          .total-box { margin-top: 30px; display: flex; justify-content: flex-end; }
          .total-card { width: 280px; background: #f8f9ff; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: right; }
          .total-amount { font-size: 26px; font-weight: bold; color: #006c47; font-family: 'JetBrains Mono', monospace; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #64748b; }
          .btn-print { background: #3e1cde; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-bottom: 20px; }
          @media print {
            .btn-print { display: none; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar en PDF</button>

        <div class="header">
          <div>
            <div class="logo">Freelancer</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Resumen no fiscal de factura</div>
            <div style="font-size: 11px; color: #94a3b8;">Este documento no demuestra que se haya realizado un pago.</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 20px; font-weight: 800; font-family: 'JetBrains Mono', monospace;">${numFactura}</div>
            <div style="font-size: 12px; color: #64748b; margin: 4px 0;">Fecha: ${fechaEmisionSegura}</div>
            <span class="badge">ESTADO REGISTRADO: ${estadoFacturaSeguro}</span>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <h4>Emisor / Especialista</h4>
            <div style="font-weight: bold; font-size: 15px;">${nombreTrabSeguro}</div>
            <div style="color: #64748b; font-size: 12px; margin-top: 4px;">Trabajador registrado • Plataforma Freelancer</div>
          </div>

          <div class="card">
            <h4>Cliente Facturado</h4>
            <div style="font-weight: bold; font-size: 15px;">${nombreCliSeguro}</div>
            <div style="color: #64748b; font-size: 12px; margin-top: 4px;">Cliente asociado a la factura</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Concepto / Hito de Contrato</th>
              <th>Horas / Unidad</th>
              <th>Tarifa Aplicada</th>
              <th style="text-align: right;">Total USD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Servicios Profesionales de Desarrollo & Consultoría</strong><br/>
                <span style="font-size: 11px; color: #64748b;">Hito validado y auditado mediante registros de tiempo y entrega de software</span>
              </td>
              <td>1 Hito</td>
              <td>1 factura</td>
              <td style="text-align: right; font-weight: bold; font-family: 'JetBrains Mono', monospace;">$${monto}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-box">
          <div class="total-card">
            <div style="font-size: 12px; color: #64748b;">Importe registrado:</div>
            <div style="font-size: 12px; font-weight: bold; text-transform: uppercase;">Total facturado:</div>
            <div class="total-amount">$${monto} USD</div>
          </div>
        </div>

        <div class="footer">
          <div style="margin-top: 10px;">
            Resumen informativo. No es comprobante fiscal, recibo de pago, saldo disponible ni constancia de fondos en custodia.
          </div>
        </div>
      </body>
      </html>
    `);

    ventana.document.close();
    window.App.mostrarToast('Resumen de factura generado. No es comprobante de pago ni documento fiscal.', 'info');
  },

  async generarFactura() {
    const usuario = window.State.data.usuarioActivo;
    if (!usuario || usuario.rol !== 'TRABAJADOR') {
      window.App.mostrarToast('Solo un trabajador autenticado puede facturar sus horas aprobadas.', 'warning');
      return;
    }

    const registrosTiempo = window.State.data.registrosTiempo || [];
    const asignaciones = window.State.data.asignaciones || [];
    const proyectos = window.State.data.proyectos || [];

    const aprobadosSinFactura = registrosTiempo.filter(r => r.estado === 'APROBADO' && !r.factura_id);
    const clientesConHoras = [...new Set(
      aprobadosSinFactura
        .map(reg => {
          const asig = asignaciones.find(a => a.id === reg.asignacion_id);
          const proy = asig ? proyectos.find(p => p.id === asig.proyecto_id) : null;
          return proy ? Number(proy.cliente_id) : null;
        })
        .filter(Boolean)
    )];

    try {
      window.App.mostrarToast('Generando factura a partir de tus horas aprobadas...', 'info');
      if (clientesConHoras.length > 1) {
        for (const clienteId of clientesConHoras) {
          await window.API.crearFactura({
            trabajador_id: Number(usuario.id),
            cliente_id: Number(clienteId)
          });
        }
      } else {
        await window.API.crearFactura({ trabajador_id: Number(usuario.id) });
      }
      window.App.mostrarToast('Factura creada y registros de tiempo congelados.', 'success');
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`No se pudo generar la factura: ${error.message}`, 'error');
    }
  }
};

window.FinanzasView = FinanzasView;
