/**
 * Freelancer — Orquestador Principal de la Aplicación SPA
 * Incluye RBAC, Autenticación Real, Modo Oscuro, Chat Interno, Navegación Móvil y Seguridad XSS
 */

const App = {
  vistaActual: 'marketplace',
  chatPostulacionActivaId: null,
  usuarioAutenticado: null,

  async iniciar() {
    console.log('Iniciando Freelancer SPA...');

    // Configurar tema (Modo Oscuro / Claro) desde localStorage
    this.iniciarTema();

    window.State.subscribe(() => {
      this.actualizarUIUsuario();
      this.actualizarEstadoCarga();
      this.renderizarVistaActual();
    });

    if (window.API && typeof window.API.onTokenRotated === 'function') {
      window.API.onTokenRotated((meta, activo) => {
        this.actualizarBadgeToken();
        if (activo && meta && meta.rot > 1) {
          const jtiCorto = meta.jti ? String(meta.jti).slice(0, 8) : 'activo';
          this.mostrarToast(`Token rotado automáticamente (#${meta.rot} · JTI ${jtiCorto})`, 'info');
        }
      });
    }

    setInterval(() => this.actualizarBadgeToken(), 1000);
    this.iniciarMonitorInactividad();

    await this.verificarSesionGuardada();

    // Renderizar campos iniciales de formularios dinámicos
    this.renderizarCamposDinamicosProyecto('TECNOLOGIA');
    this.renderizarCamposRegistro('CLIENTE');

    // Cargar datos iniciales solo si existe sesión autenticada con token activo
    try {
      if (window.State.data.usuarioActivo && window.API && window.API.sesionActiva) {
        this.mostrarSkeleton('viewMarketplace', 'cards');
        const datos = await window.State.recargarTodo();
        const errores = Object.keys(datos.erroresServicios);
        this.mostrarToast(
          errores.length
            ? `Plataforma parcialmente disponible. Servicios con errores: ${errores.join(', ')}.`
            : 'Sesión verificada con Cookie HttpOnly + Token rotativo activo.',
          errores.length ? 'warning' : 'success'
        );
      } else {
        window.State.limpiarDatosPrivados();
      }
    } catch (error) {
      this.mostrarToast(`Error al sincronizar datos: ${error.message}`, 'error');
    }

    await this.actualizarEstadoServicios();

    // Inicializar Time Tracker del Running Dock
    if (window.Timer) {
      window.Timer.inicializar();
    }

    // Configurar router, vistas y selectores
    this.configurarRutas();
    this.renderizarVistaActual();
    this.actualizarUIUsuario();
  },

  actualizarEstadoCarga() {
    const banner = document.getElementById('serviceErrorBanner');
    if (!banner) return;

    const errores = Object.entries(window.State.data.erroresServicios || {});
    banner.classList.toggle('hidden', errores.length === 0);
    banner.innerHTML = errores.length === 0 ? '' : `
      <strong>No se pudieron cargar algunos datos.</strong>
      ${errores.map(([servicio, mensaje]) =>
        `<div>${this.escapeHTML(servicio)}: ${this.escapeHTML(mensaje)}</div>`
      ).join('')}
    `;
  },

  /* ================= SEGURIDAD & UTILIDADES ================= */
  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  debounce(func, wait = 250) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  /* ================= MODO OSCURO ================= */
  iniciarTema() {
    const temaGuardado = localStorage.getItem('freelancer_theme');
    const prefiereOscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (temaGuardado === 'dark' || (!temaGuardado && prefiereOscuro)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    this.actualizarIconoTema();
  },

  toggleModoOscuro() {
    const esOscuro = document.documentElement.classList.toggle('dark');
    localStorage.setItem('freelancer_theme', esOscuro ? 'dark' : 'light');
    this.actualizarIconoTema();
    this.mostrarToast(esOscuro ? 'Modo oscuro activado' : 'Modo claro activado', 'info');
  },

  actualizarIconoTema() {
    const esOscuro = document.documentElement.classList.contains('dark');
    const icono = document.getElementById('darkModeIcon');
    if (icono) {
      icono.textContent = esOscuro ? 'light_mode' : 'dark_mode';
    }
  },

  /* ================= MENÚ MÓVIL (RESPONSIVE) ================= */
  toggleMenuMovil() {
    const drawer = document.getElementById('mobileDrawerOverlay');
    if (drawer) drawer.classList.toggle('open');
  },

  cerrarMenuMovil() {
    const drawer = document.getElementById('mobileDrawerOverlay');
    if (drawer) drawer.classList.remove('open');
  },

  /* ================= ENRUTAMIENTO ================= */
  configurarRutas() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'admin' && !this.esAdministradorAutenticado()) {
      window.location.hash = 'marketplace';
    } else if (['marketplace', 'talento', 'workspace', 'contratos', 'finanzas', 'admin'].includes(hash)) {
      this.vistaActual = hash;
    }

    window.addEventListener('hashchange', () => {
      const nuevoHash = window.location.hash.replace('#', '').toLowerCase();
      if (['marketplace', 'talento', 'workspace', 'contratos', 'finanzas', 'admin'].includes(nuevoHash)) {
        this.cambiarVista(nuevoHash, false);
      }
    });
  },

  cambiarVista(nombreVista, actualizarHash = true) {
    if (nombreVista === 'admin' && !this.esAdministradorAutenticado()) {
      if (window.location.hash === '#admin') {
        window.location.hash = 'marketplace';
      }
      this.mostrarToast('Inicia sesión con una cuenta de administrador para acceder al panel.', 'warning');
      this.abrirModalAdminLogin();
      return;
    }

    this.vistaActual = nombreVista;
    if (actualizarHash) {
      window.location.hash = nombreVista;
    }

    // Actualizar tabs desktop
    document.querySelectorAll('.nav-link').forEach(btn => {
      if (btn.dataset.vista === nombreVista) {
        btn.classList.add('nav-link-active');
        btn.classList.remove('nav-link-inactive', 'text-slate-600', 'dark:text-slate-300');
      } else {
        btn.classList.remove('nav-link-active');
        btn.classList.add('nav-link-inactive', 'text-slate-600', 'dark:text-slate-300');
      }
    });

    // Actualizar paneles visibles
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const panelActivo = document.getElementById(`view${nombreVista.charAt(0).toUpperCase() + nombreVista.slice(1)}`);
    if (panelActivo) {
      panelActivo.classList.add('active');
    }

    this.renderizarVistaActual();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  renderizarVistaActual() {
    switch (this.vistaActual) {
      case 'marketplace':
        if (window.MarketplaceView) window.MarketplaceView.render();
        break;
      case 'talento':
        if (window.TalentoView) window.TalentoView.render();
        break;
      case 'workspace':
        if (window.WorkspaceView) window.WorkspaceView.render();
        break;
      case 'contratos':
        if (window.ContratosView) window.ContratosView.render();
        break;
      case 'finanzas':
        if (window.FinanzasView) window.FinanzasView.render();
        break;
      case 'admin':
        if (window.AdminView) window.AdminView.render();
        break;
    }
  },

  /* ================= CONTROL DE ACCESO (RBAC) & PERFIL ================= */
  esAdministradorAutenticado() {
    return Boolean(
      window.API.sesionActiva &&
      this.usuarioAutenticado &&
      this.usuarioAutenticado.rol === 'ADMIN'
    );
  },

  actualizarUIUsuario() {
    const usuario = window.State.data.usuarioActivo;
    const nameEl = document.getElementById('navUserName');
    const roleEl = document.getElementById('navUserRole');
    const avatarEl = document.getElementById('navUserAvatar');
    const mobNameEl = document.getElementById('mobileNavName');
    const mobRoleEl = document.getElementById('mobileNavRole');
    const mobAvatarEl = document.getElementById('mobileNavAvatar');
    const btnPublicarHeader = document.getElementById('btnPublicarProyectoHeader');
    const runningDock = document.getElementById('runningDock');
    const navBtnLogin = document.getElementById('navBtnLogin');
    const navBtnLogout = document.getElementById('navBtnLogout');
    const navLinkAdmin = document.getElementById('navLinkAdmin');
    const mobileNavLinkAdmin = document.getElementById('mobileNavLinkAdmin');
    const privateApiGate = document.getElementById('privateApiGate');
    const authViews = document.getElementById('authenticatedViewsContainer');
    const puedeAdministrar = this.esAdministradorAutenticado();

    if (navLinkAdmin) navLinkAdmin.classList.toggle('hidden', !puedeAdministrar);
    if (mobileNavLinkAdmin) mobileNavLinkAdmin.classList.toggle('hidden', !puedeAdministrar);
    if (privateApiGate) privateApiGate.classList.toggle('hidden', Boolean(usuario));
    if (authViews) authViews.classList.toggle('hidden', !usuario);
    this.actualizarBadgeToken();

    if (usuario) {
      const nombre = usuario.nombre || 'Usuario';
      const rol = (usuario.rol || 'TRABAJADOR').toUpperCase();
      const iniciales = nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

      if (nameEl) nameEl.textContent = nombre;
      if (roleEl) roleEl.textContent = rol;
      if (avatarEl) avatarEl.textContent = iniciales;

      if (mobNameEl) mobNameEl.textContent = nombre;
      if (mobRoleEl) mobRoleEl.textContent = rol;
      if (mobAvatarEl) mobAvatarEl.textContent = iniciales;

      // Botón Login / Logout
      if (navBtnLogin) navBtnLogin.classList.add('hidden');
      if (navBtnLogout) navBtnLogout.classList.remove('hidden');

      // RBAC: Visibilidad según Rol
      if (rol === 'CLIENTE') {
        // CLIENTE: Puede publicar proyectos, pero no usa el time tracker como contratista
        if (btnPublicarHeader) btnPublicarHeader.classList.remove('hidden');
        if (runningDock) {
          // Mostrar advertencia o esconder temporizador si es cliente
          runningDock.classList.add('opacity-75');
          const statusBadge = document.getElementById('trackerStatusBadge');
          if (statusBadge) {
            statusBadge.innerHTML = `<span class="material-symbols-outlined text-[14px]">shield_person</span> Modo Cliente`;
          }
        }
      } else {
        // TRABAJADOR: No publica proyectos (ocultar botón), usa activamente el Time Tracker
        if (btnPublicarHeader) btnPublicarHeader.classList.add('hidden');
        if (runningDock) {
          runningDock.classList.remove('opacity-75');
        }
      }
    } else {
      if (navBtnLogin) navBtnLogin.classList.remove('hidden');
      if (navBtnLogout) navBtnLogout.classList.add('hidden');
      if (btnPublicarHeader) btnPublicarHeader.classList.add('hidden');
      if (nameEl) nameEl.textContent = 'Invitado';
      if (roleEl) roleEl.textContent = 'SIN SESIÓN';
      if (avatarEl) avatarEl.textContent = '?';
      if (mobNameEl) mobNameEl.textContent = 'Invitado';
      if (mobRoleEl) mobRoleEl.textContent = 'SIN SESIÓN';
      if (mobAvatarEl) mobAvatarEl.textContent = '?';
      if (runningDock) runningDock.classList.remove('opacity-75');
    }
  },

  async verificarSesionGuardada() {
    try {
      let respuesta = null;
      try {
        respuesta = await window.API.getCurrentUser();
      } catch (err) {
        if (err && err.status === 401) {
          await window.API.rotarToken();
          respuesta = await window.API.getCurrentUser();
        } else {
          throw err;
        }
      }

      const usuario = respuesta && respuesta.data;
      if (!usuario || !usuario.rol) {
        throw new Error('El servidor devolvió una sesión incompleta.');
      }

      window.API.sesionActiva = true;
      if (!window.API.token) window.API.token = "httponly_cookie_session";
      window.API.iniciarRotacionAutomatica();
      this.usuarioAutenticado = usuario;
      window.State.setUsuarioActivo(usuario);
    } catch (error) {
      window.API.setToken(null);
      this.usuarioAutenticado = null;
      localStorage.removeItem('freelancer_active_user');
      window.State.setUsuarioActivo(null);
      this.actualizarUIUsuario();
    }
  },

  async actualizarEstadoServicios() {
    const label = document.getElementById('platformStatusLabel');
    const indicator = document.getElementById('platformStatusIndicator');
    if (!label || !indicator) return;

    try {
      const health = await window.API.getHealth();
      const servicios = health && health.services ? Object.values(health.services) : [];
      const estanActivos = health && health.gateway === 'ok' && servicios.every(estado => estado === 'ok');
      label.textContent = estanActivos ? 'Servicios operativos' : 'Servicios con incidencias';
      indicator.className = `w-2 h-2 rounded-full ${estanActivos ? 'bg-emerald-500' : 'bg-amber-500'}`;
    } catch (error) {
      const servicios = error.data && error.data.services ? Object.values(error.data.services) : [];
      const hayIncidencia = error.status === 503 || servicios.some(estado => estado !== 'ok');
      label.textContent = hayIncidencia ? 'Servicios con incidencias' : 'Estado no disponible';
      indicator.className = `w-2 h-2 rounded-full ${hayIncidencia ? 'bg-amber-500' : 'bg-slate-400'}`;
    }
  },

  /* ================= AUTENTICACIÓN REAL (LOGIN & REGISTRO) ================= */
  abrirModalLogin() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('open');
  },

  cerrarModalLogin() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('open');
  },

  abrirModalAdminLogin() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) modal.classList.add('open');
  },

  cerrarModalAdminLogin() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) modal.classList.remove('open');
  },

  async manejarLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmailInput').value.trim();
    const password = document.getElementById('loginPasswordInput').value;

    try {
      this.mostrarToast('Autenticando credenciales...', 'info');
      const res = await window.API.login(email, password);

      if (res && res.usuario && res.usuario.rol === 'ADMIN') {
        window.API.setToken(null);
        throw new Error('Utiliza el apartado de acceso exclusivo para administradores.');
      }

      if (res && res.usuario) {
        this.usuarioAutenticado = res.usuario;
        window.State.setUsuarioActivo(res.usuario);
        this.cerrarModalLogin();
        this.mostrarToast(`¡Bienvenido de nuevo, ${res.usuario.nombre}!`, 'success');
        await window.State.recargarTodo();
      } else {
        throw new Error('Respuesta de autenticación incompleta');
      }
    } catch (error) {
      this.mostrarToast(`Error de inicio de sesión: ${error.message}`, 'error');
    }
  },

  async manejarAdminLogin(event) {
    event.preventDefault();
    const email = document.getElementById('adminLoginEmailInput').value.trim();
    const password = document.getElementById('adminLoginPasswordInput').value;

    try {
      this.mostrarToast('Verificando credenciales de administrador...', 'info');
      const respuesta = await window.API.adminLogin(email, password);
      if (!window.API.sesionActiva || !respuesta || !respuesta.usuario || respuesta.usuario.rol !== 'ADMIN') {
        window.API.setToken(null);
        throw new Error('El servidor no confirmó una sesión de administrador.');
      }

      this.usuarioAutenticado = respuesta.usuario;
      window.State.setUsuarioActivo(respuesta.usuario);
      this.cerrarModalAdminLogin();
      document.getElementById('adminLoginPasswordInput').value = '';
      await window.State.recargarTodo();
      this.actualizarUIUsuario();
      this.cambiarVista('admin');
      this.mostrarToast('Sesión de administrador iniciada.', 'success');
    } catch (error) {
      this.mostrarToast(`No se pudo iniciar sesión como administrador: ${error.message}`, 'error');
    }
  },

  abrirModalRegistro() {
    const modal = document.getElementById('registroModal');
    if (modal) modal.classList.add('open');
    this.renderizarCamposRegistro('CLIENTE');
  },

  cerrarModalRegistro() {
    const modal = document.getElementById('registroModal');
    if (modal) modal.classList.remove('open');
  },

  renderizarCamposRegistro(rol) {
    const container = document.getElementById('regCamposDinamicos');
    if (!container) return;

    if (rol === 'CLIENTE') {
      container.innerHTML = `
        <span class="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400 block mb-1">
          Datos de Facturación Empresarial (Cliente)
        </span>
        <div>
          <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Razón Social / Empresa *</label>
          <input id="regRazonSocialInput" type="text" required placeholder="Ej. InnovaTech Solutions S.A.S." class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600"/>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Dirección de Facturación *</label>
          <input id="regDireccionInput" type="text" required placeholder="Ej. Av. Carrera 7 #100-20, Bogotá" class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600"/>
        </div>
      `;
    } else {
      container.innerHTML = `
        <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
          Perfil Profesional (Freelancer)
        </span>
        <div>
          <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Especialidad & Stack *</label>
          <input id="regEspecialidadInput" type="text" required placeholder="Ej. Ingeniero DevOps · AWS, Kubernetes, Terraform" class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600"/>
        </div>
        <div class="flex items-center gap-2 pt-1">
          <input id="regDisponibilidadInput" type="checkbox" checked class="rounded text-violet-600 focus:ring-violet-600"/>
          <label for="regDisponibilidadInput" class="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
            Disponible de inmediato para nuevos contratos
          </label>
        </div>
      `;
    }
  },

  async manejarRegistro(event) {
    event.preventDefault();
    const nombre = document.getElementById('regNombreInput').value.trim();
    const email = document.getElementById('regEmailInput').value.trim();
    const telefono = document.getElementById('regTelefonoInput').value.trim();
    const password = document.getElementById('regPasswordInput').value;

    const rolRadio = document.querySelector('input[name="regRolRadio"]:checked');
    const rol = rolRadio ? rolRadio.value : 'CLIENTE';

    const payload = {
      nombre,
      email,
      telefono: telefono || null,
      password,
      rol
    };

    if (rol === 'CLIENTE') {
      const razon = document.getElementById('regRazonSocialInput');
      const dir = document.getElementById('regDireccionInput');
      payload.razon_social = razon ? razon.value.trim() : 'Empresa';
      payload.direccion_facturacion = dir ? dir.value.trim() : 'Ciudad';
    } else {
      const esp = document.getElementById('regEspecialidadInput');
      const disp = document.getElementById('regDisponibilidadInput');
      payload.especialidad = esp ? esp.value.trim() : 'Desarrollador Freelance';
      payload.disponibilidad = disp ? disp.checked : true;
    }

    try {
      this.mostrarToast('Creando usuario y perfil en MySQL...', 'info');
      const res = await window.API.registro(payload);

      this.cerrarModalRegistro();
      this.mostrarToast('¡Cuenta registrada exitosamente!', 'success');

      if (res && res.usuario) {
        this.usuarioAutenticado = res.usuario;
        window.State.setUsuarioActivo(res.usuario);
      }

      await window.State.recargarTodo();
    } catch (error) {
      this.mostrarToast(`Error al registrarse: ${error.message}`, 'error');
    }
  },

  actualizarBadgeToken() {
    const badge = document.getElementById('tokenRotationBadge');
    const textEl = document.getElementById('tokenRotationText');
    if (!badge || !textEl) return;

    const autenticado = Boolean(window.State.data.usuarioActivo && window.API && window.API.sesionActiva);
    if (!autenticado) {
      badge.classList.add('hidden');
      badge.classList.remove('inline-flex');
      return;
    }

    badge.classList.remove('hidden');
    badge.classList.add('inline-flex');

    const meta = (window.API && window.API.tokenMeta) || {};
    const rot = Number(meta.rot) || 1;
    const jtiCorto = meta.jti ? String(meta.jti).slice(0, 6) : 'jwt';
    const intervalo = Number(meta.rotation_interval_seconds) || 30;
    const transcurrido = Math.floor((Date.now() - (meta.last_rotated_ms || Date.now())) / 1000);
    const restante = Math.max(1, intervalo - (transcurrido % intervalo));

    textEl.textContent = `HttpOnly #${rot} [${jtiCorto}] · ${restante}s`;
  },

  iniciarMonitorInactividad() {
    this.ultimaActividadMs = Date.now();
    const TIMEOUT_INACTIVIDAD_MS = 10 * 60 * 1000; // 10 minutos
    const registrarActividad = () => {
      this.ultimaActividadMs = Date.now();
    };
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(ev => {
      window.addEventListener(ev, registrarActividad, { passive: true });
    });
    setInterval(async () => {
      if (!window.State.data.usuarioActivo || !window.API || !window.API.sesionActiva) return;
      if (Date.now() - (this.ultimaActividadMs || Date.now()) > TIMEOUT_INACTIVIDAD_MS) {
        this.mostrarToast('Sesión bloqueada automáticamente por inactividad (protección anti-fuga).', 'warning');
        await this.cerrarSesion();
      }
    }, 15000);
  },

  async rotarTokenAhora(recargarModalSeguridad = false) {
    if (!window.API || !window.API.sesionActiva) return;
    try {
      const res = await window.API.rotarToken();
      this.actualizarBadgeToken();
      const jtiCorto = res && res.jti ? String(res.jti).slice(0, 8) : 'nuevo';
      this.mostrarToast(`Token rotado manualmente (#${res.rot || 1} · JTI ${jtiCorto}). El token anterior fue invalidado.`, 'success');
      if (recargarModalSeguridad) {
        await this.abrirModalCentroSeguridad();
      }
    } catch (error) {
      this.mostrarToast(`No se pudo rotar el token: ${error.message}`, 'error');
    }
  },

  async abrirModalCentroSeguridad() {
    if (!window.API || !window.API.sesionActiva) {
      this.abrirModalLogin();
      return;
    }

    const modalTitle = document.getElementById('genericModalTitle');
    const modalBody = document.getElementById('genericModalContent');
    if (modalTitle) modalTitle.textContent = 'Centro de Seguridad · Flujo de Tokens + Cookies HttpOnly';
    if (modalBody) {
      modalBody.innerHTML = `<div class="py-8 text-center text-xs text-slate-500">Consultando telemetría de seguridad en el API Gateway...</div>`;
    }
    this.abrirModalGenerico();

    try {
      const respuesta = await window.API.getSecurityStatus();
      const d = (respuesta && respuesta.data) || {};
      const tok = d.token_actual || {};
      const capas = Array.isArray(d.capas_activas) ? d.capas_activas : [];
      const eventos = Array.isArray(d.eventos_recientes) ? d.eventos_recientes : [];
      const stats = d.estadisticas || {};

      if (modalBody) {
        modalBody.innerHTML = `
          <div class="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <!-- Estado del Token Rotativo Actual -->
            <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
              <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-emerald-600 text-[22px]">sync_lock</span>
                  <div>
                    <div class="text-xs font-bold text-slate-900 dark:text-white">Flujo de Tokens en Cookie HttpOnly Activo (Ciclo #${Number(tok.rot) || 1})</div>
                    <div class="text-[11px] text-emerald-700 dark:text-emerald-300">Cookies HttpOnly; SameSite=Strict rotando cada ${Number(tok.rotation_interval_seconds) || 30}s · Invisibles a document.cookie y scripts XSS</div>
                  </div>
                </div>
                <button
                  data-csp-click="window.App.rotarTokenAhora(true)"
                  class="btn-primary py-1.5 px-3 text-xs bg-emerald-700 hover:bg-emerald-800">
                  <span class="material-symbols-outlined text-[15px]">autorenew</span> Rotar Token Ahora
                </button>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900">
                <div><span class="text-slate-400">JTI Actual:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${this.escapeHTML(tok.jti || 'N/A')}</span></div>
                <div><span class="text-slate-400">Huella Dispositivo:</span> <span class="font-bold text-violet-700 dark:text-violet-300">${this.escapeHTML(tok.fgp || 'Vinculada')}</span></div>
                <div><span class="text-slate-400">Token CSRF:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${this.escapeHTML(tok.csrf_token ? tok.csrf_token.slice(0, 16) + '...' : 'Activo')}</span></div>
                <div><span class="text-slate-400">Revocados en Blacklist:</span> <span class="font-bold text-rose-600">${Number(stats.tokens_revocados_en_lista_negra) || 0} tokens</span></div>
              </div>
            </div>

            <!-- 9 Capas de Seguridad Activas -->
            <div>
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Capas de Seguridad Activas (Backend APIs + Frontend)
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${capas.map(c => `
                  <div class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-start gap-2">
                    <span class="material-symbols-outlined text-emerald-600 text-[17px] mt-0.5">verified_user</span>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-slate-800 dark:text-slate-200">${this.escapeHTML(c.nombre)}</div>
                      <div class="text-[11px] text-slate-500 leading-snug">${this.escapeHTML(c.detalle)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Bitácora de Auditoría en Tiempo Real -->
            <div>
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Bitácora de Eventos de Seguridad en Tiempo Real (Gateway)
              </div>
              <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table class="w-full text-left text-[11px]">
                  <thead class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                    <tr>
                      <th class="py-2 px-2.5">Hora</th>
                      <th class="py-2 px-2.5">Evento</th>
                      <th class="py-2 px-2.5">Detalle</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    ${eventos.map(ev => `
                      <tr>
                        <td class="py-1.5 px-2.5 text-slate-400 whitespace-nowrap">${this.escapeHTML((ev.fecha || '').slice(11))}</td>
                        <td class="py-1.5 px-2.5 font-bold ${ev.severidad === 'CRITICO' ? 'text-rose-600' : (ev.severidad === 'WARN' ? 'text-amber-600' : 'text-emerald-700 dark:text-emerald-400')}">${this.escapeHTML(ev.tipo)}</td>
                        <td class="py-1.5 px-2.5 text-slate-600 dark:text-slate-300 font-sans">${this.escapeHTML(ev.detalle)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      }
    } catch (error) {
      if (modalBody) {
        modalBody.innerHTML = `<div class="p-4 text-xs text-rose-600">Error consultando estado de seguridad: ${this.escapeHTML(error.message)}</div>`;
      }
    }
  },

  async loginRapidoDemo(email, password) {
    try {
      this.mostrarToast(`Iniciando sesión segura (${email})...`, 'info');
      const res = await window.API.login(email, password);
      if (res && res.usuario) {
        this.usuarioAutenticado = res.usuario;
        window.State.setUsuarioActivo(res.usuario);
        this.cerrarModalLogin();
        await window.State.recargarTodo();
        this.actualizarUIUsuario();
        this.renderizarVistaActual();
        this.mostrarToast(`¡Sesión iniciada como ${res.usuario.nombre} (${res.usuario.rol}) con rotación de tokens activa!`, 'success');
      }
    } catch (error) {
      this.mostrarToast(`Error en acceso rápido: ${error.message}`, 'error');
    }
  },

  async loginRapidoAdminDemo() {
    try {
      this.mostrarToast('Iniciando sesión de Administrador...', 'info');
      const respuesta = await window.API.adminLogin('admin@freelancer.com', 'AdminFreelancer2026!');
      if (respuesta && respuesta.usuario) {
        this.usuarioAutenticado = respuesta.usuario;
        window.State.setUsuarioActivo(respuesta.usuario);
        this.cerrarModalAdminLogin();
        await window.State.recargarTodo();
        this.actualizarUIUsuario();
        this.cambiarVista('admin');
        this.mostrarToast('Sesión de Administrador iniciada con tokens rotativos.', 'success');
      }
    } catch (error) {
      this.mostrarToast(`Error en acceso Admin: ${error.message}`, 'error');
    }
  },

  async cerrarSesion() {
    await window.API.cerrarSesionRemota();
    this.usuarioAutenticado = null;
    localStorage.removeItem('freelancer_active_user');
    if (window.AdminView) window.AdminView.estadoSaludServicios = null;
    window.State.setUsuarioActivo(null);
    window.State.limpiarDatosPrivados();
    if (this.vistaActual === 'admin') this.cambiarVista('marketplace');
    this.mostrarToast('Sesión cerrada y tokens revocados en el servidor.', 'info');
    this.actualizarUIUsuario();
    this.renderizarVistaActual();
  },

  /* ================= FORMULARIO DINÁMICO DE PROYECTOS ================= */
  abrirModalPublicarProyecto() {
    const usuario = window.State.data.usuarioActivo;
    if (usuario && usuario.rol === 'TRABAJADOR') {
      this.mostrarToast('Acción reservada para Clientes. Cambia tu rol para publicar requerimientos.', 'warning');
      return;
    }

    const modal = document.getElementById('publicarProyectoModal');
    const fechaInput = document.getElementById('proyFechaInicioInput');
    if (fechaInput && !fechaInput.value) {
      fechaInput.value = new Date().toISOString().split('T')[0];
    }
    if (modal) modal.classList.add('open');
  },

  cerrarModalPublicarProyecto() {
    const modal = document.getElementById('publicarProyectoModal');
    if (modal) modal.classList.remove('open');
  },

  renderizarCamposDinamicosProyecto(tipo) {
    const container = document.getElementById('proyCamposDinamicos');
    if (!container) return;

    switch (tipo) {
      case 'TECNOLOGIA':
        container.innerHTML = `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Lenguaje / Stack Principal *</label>
              <input id="tecLenguajeInput" type="text" required placeholder="Ej. Python / React / Node.js" class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600"/>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Repositorio URL (Opcional)</label>
              <input id="tecRepoInput" type="url" placeholder="https://github.com/org/repo" class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600 font-mono"/>
            </div>
          </div>
        `;
        break;

      case 'DISENO':
        container.innerHTML = `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Software de Diseño *</label>
              <input id="disSoftwareInput" type="text" required placeholder="Ej. Figma, Adobe XD, Blender" class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600"/>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Formato de Entrega *</label>
              <input id="disFormatoInput" type="text" required placeholder="Ej. Archivo Figma + Assets SVG/PNG" class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600"/>
            </div>
          </div>
        `;
        break;

      case 'REDACCION':
        container.innerHTML = `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Cantidad de Palabras *</label>
              <input id="redPalabrasInput" type="number" min="50" step="50" value="1500" required class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600 font-mono"/>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Idioma del Contenido *</label>
              <input id="redIdiomaInput" type="text" required value="Español Neutro" placeholder="Ej. Español / Inglés C1" class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600"/>
            </div>
          </div>
        `;
        break;

      case 'MARKETING':
        container.innerHTML = `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Plataforma Objetivo *</label>
              <input id="mktPlataformaInput" type="text" required placeholder="Ej. Google Ads, Meta Ads, LinkedIn" class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600"/>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tipo de Campaña *</label>
              <input id="mktCampanaInput" type="text" required placeholder="Ej. Conversión B2B / Performance Marketing" class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600"/>
            </div>
          </div>
        `;
        break;

      case 'ASISTENCIA':
        container.innerHTML = `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Herramientas Requeridas *</label>
              <input id="asiHerramientasInput" type="text" required placeholder="Ej. Notion, Slack, Google Workspace, Jira" class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600"/>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Horas Semanales Requeridas *</label>
              <input id="asiHorasInput" type="number" min="1" max="168" value="20" required class="w-full p-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-violet-600 font-mono"/>
            </div>
          </div>
        `;
        break;
    }
  },

  async guardarNuevoProyecto(event) {
    event.preventDefault();
    const titulo = document.getElementById('proyTituloInput').value.trim();
    const descripcion = document.getElementById('proyDescInput').value.trim();
    const tipo = document.getElementById('proyTipoSelect').value;
    const fechaInicio = document.getElementById('proyFechaInicioInput').value || new Date().toISOString().split('T')[0];

    const usuario = window.State.data.usuarioActivo;
    const clienteId = (usuario && usuario.rol === 'CLIENTE') ? usuario.id : 1;

    // Payload tipado compatible con schemas.py de Python FastAPI
    const payload = {
      cliente_id: clienteId,
      nombre_proyecto: titulo,
      descripcion: descripcion,
      fecha_inicio: fechaInicio,
      tipo: tipo,
      tipo_proyecto: tipo,
      especificaciones: {}
    };

    if (tipo === 'TECNOLOGIA') {
      const lenguaje = document.getElementById('tecLenguajeInput').value.trim();
      const repo = document.getElementById('tecRepoInput').value.trim();
      payload.tecnologia = {
        lenguaje_principal: lenguaje,
        repositorio_url: repo || null
      };
      payload.especificaciones.lenguaje_principal = lenguaje;
      if (repo) payload.especificaciones.repositorio_url = repo;
    } else if (tipo === 'DISENO') {
      const software = document.getElementById('disSoftwareInput').value.trim();
      const formato = document.getElementById('disFormatoInput').value.trim();
      payload.diseno = {
        software_utilizado: software,
        formato_entrega: formato
      };
      payload.especificaciones.software_utilizado = software;
      payload.especificaciones.formato_entrega = formato;
    } else if (tipo === 'REDACCION') {
      const palabras = Number(document.getElementById('redPalabrasInput').value);
      const idioma = document.getElementById('redIdiomaInput').value.trim();
      payload.redaccion = {
        cantidad_palabras: palabras,
        idioma: idioma
      };
      payload.especificaciones.cantidad_palabras = palabras;
      payload.especificaciones.idioma = idioma;
    } else if (tipo === 'MARKETING') {
      const plataforma = document.getElementById('mktPlataformaInput').value.trim();
      const campana = document.getElementById('mktCampanaInput').value.trim();
      payload.marketing = {
        plataforma_objetivo: plataforma,
        tipo_campana: campana
      };
      payload.especificaciones.plataforma_objetivo = plataforma;
      payload.especificaciones.tipo_campana = campana;
    } else if (tipo === 'ASISTENCIA') {
      const herramientas = document.getElementById('asiHerramientasInput').value.trim();
      const horas = Number(document.getElementById('asiHorasInput').value);
      payload.asistencia = {
        herramientas_manejo: herramientas,
        horas_semanales_requeridas: horas
      };
      payload.especificaciones.herramientas_manejo = herramientas;
      payload.especificaciones.horas_semanales_requeridas = horas;
    }

    try {
      this.mostrarToast('Validando y publicando en Python FastAPI (:5000)...', 'info');
      await window.API.crearProyecto(payload);

      this.cerrarModalPublicarProyecto();
      this.mostrarToast('¡Proyecto publicado exitosamente con categoría validada!', 'success');
      await window.State.recargarTodo();
      this.cambiarVista('marketplace');
    } catch (error) {
      this.mostrarToast(`Error al publicar proyecto: ${error.message}`, 'error');
    }
  },

  /* ================= MODAL POSTULACIÓN ================= */
  cerrarModalPostulacion() {
    const modal = document.getElementById('postulacionModal');
    if (modal) modal.classList.remove('open');
  },

  async enviarPostulacion(event) {
    event.preventDefault();
    const proyectoId = document.getElementById('postulacionProyectoId').value;
    const tarifa = document.getElementById('postulacionTarifaInput').value;
    const mensaje = document.getElementById('postulacionMensajeInput').value;

    const usuario = window.State.data.usuarioActivo;

    try {
      if (!usuario || usuario.rol !== 'TRABAJADOR') {
        this.mostrarToast('Inicia sesión con una cuenta de trabajador para enviar una propuesta.', 'warning');
        this.abrirModalLogin();
        return;
      }

      this.mostrarToast('Registrando propuesta...', 'info');
      const res = await window.API.crearPostulacion(proyectoId, {
        trabajador_id: Number(usuario.id),
        tarifa_propuesta: Number(tarifa),
        mensaje: mensaje
      });

      // Crear primer mensaje en el chat interno
      if (res && res.id) {
        this.guardarMensajeChat(res.id, {
          remitente: usuario ? usuario.nombre : 'Trabajador',
          rol: 'TRABAJADOR',
          texto: mensaje,
          fecha: new Date().toISOString()
        });
      }

      this.cerrarModalPostulacion();
      this.mostrarToast('Propuesta enviada correctamente.', 'success');
      await window.State.recargarTodo();
      this.cambiarVista('contratos');
    } catch (error) {
      this.mostrarToast(`Error: ${error.message}`, 'error');
    }
  },

  /* ================= CANAL DE COMUNICACIÓN (CHAT ESCROW) ================= */
  abrirModalChat(postulacionId) {
    this.chatPostulacionActivaId = postulacionId;
    const postulaciones = window.State.data.postulaciones || [];
    const proyectos = window.State.data.proyectos || [];
    const usuarios = window.State.data.usuarios || [];

    const post = postulaciones.find(p => p.id === Number(postulacionId));
    if (!post) return;

    const proy = proyectos.find(p => p.id === post.proyecto_id);
    const trab = usuarios.find(u => u.id === post.trabajador_id);
    const cli = proy ? usuarios.find(u => u.id === proy.cliente_id) : null;

    const tituloEl = document.getElementById('chatModalTitulo');
    const subtituloEl = document.getElementById('chatModalSubtitulo');
    const inputHidden = document.getElementById('chatPostulacionIdInput');

    if (tituloEl) tituloEl.textContent = proy ? proy.nombre_proyecto : `Propuesta #${post.id}`;
    if (subtituloEl) {
      subtituloEl.textContent = `Cliente: ${(cli && cli.nombre) || 'Empresa'} • Freelancer: ${(trab && trab.nombre) || 'Especialista'}`;
    }
    if (inputHidden) inputHidden.value = postulacionId;

    this.renderizarMensajesChat(postulacionId, post.mensaje);

    const modal = document.getElementById('chatModal');
    if (modal) modal.classList.add('open');
  },

  cerrarModalChat() {
    this.chatPostulacionActivaId = null;
    const modal = document.getElementById('chatModal');
    if (modal) modal.classList.remove('open');
  },

  obtenerMensajesChat(postulacionId, mensajeInicial = '') {
    const clave = `freelancer_chat_${postulacionId}`;
    let mensajes = [];
    try {
      const guardado = localStorage.getItem(clave);
      if (guardado) {
        mensajes = JSON.parse(guardado);
      } else if (mensajeInicial) {
        mensajes = [
          {
            remitente: 'Freelancer',
            rol: 'TRABAJADOR',
            texto: mensajeInicial,
            fecha: new Date().toISOString()
          }
        ];
        localStorage.setItem(clave, JSON.stringify(mensajes));
      }
    } catch {
      mensajes = [];
    }
    return mensajes;
  },

  guardarMensajeChat(postulacionId, nuevoMsg) {
    const clave = `freelancer_chat_${postulacionId}`;
    const mensajes = this.obtenerMensajesChat(postulacionId);
    mensajes.push(nuevoMsg);
    try {
      localStorage.setItem(clave, JSON.stringify(mensajes));
    } catch (err) {
      console.warn('Error guardando mensaje:', err);
    }
  },

  renderizarMensajesChat(postulacionId, mensajeInicial = '') {
    const container = document.getElementById('chatMensajesList');
    if (!container) return;

    const mensajes = this.obtenerMensajesChat(postulacionId, mensajeInicial);
    const usuarioActivo = window.State.data.usuarioActivo;
    const rolActivo = usuarioActivo ? usuarioActivo.rol : 'CLIENTE';

    if (mensajes.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-xs text-slate-400">
          No hay mensajes en este hilo de negociación. Envía el primero para definir detalles antes de formalizar.
        </div>
      `;
      return;
    }

    container.innerHTML = mensajes.map(msg => {
      const esMio = (usuarioActivo && msg.remitente === usuarioActivo.nombre) || (msg.rol === rolActivo);
      const fechaStr = msg.fecha ? new Date(msg.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div class="flex flex-col ${esMio ? 'items-end' : 'items-start'}">
          <div class="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
            <span class="font-bold text-slate-700 dark:text-slate-300">${this.escapeHTML(msg.remitente)}</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] uppercase font-mono ${msg.rol === 'CLIENTE' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}">${msg.rol}</span>
            <span>•</span>
            <span>${fechaStr}</span>
          </div>
          <div class="max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
            esMio
              ? 'bg-violet-700 text-white rounded-br-none'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none'
          }">
            ${this.escapeHTML(msg.texto)}
          </div>
        </div>
      `;
    }).join('');

    // Auto-scroll al final
    container.scrollTop = container.scrollHeight;
  },

  enviarMensajeChat(event) {
    event.preventDefault();
    const input = document.getElementById('chatMensajeInput');
    const postulacionId = this.chatPostulacionActivaId;
    if (!input || !postulacionId) return;

    const texto = input.value.trim();
    if (!texto) return;

    const usuario = window.State.data.usuarioActivo;
    const nuevoMsg = {
      remitente: usuario ? usuario.nombre : 'Usuario',
      rol: usuario ? usuario.rol : 'CLIENTE',
      texto: texto,
      fecha: new Date().toISOString()
    };

    this.guardarMensajeChat(postulacionId, nuevoMsg);
    input.value = '';
    this.renderizarMensajesChat(postulacionId);
    this.mostrarToast('Mensaje enviado al hilo seguro', 'info');
  },

  /* ================= DIÁLOGOS NO BLOQUEANTES (CONFIRMACIÓN MODAL) ================= */
  confirmar({ titulo, mensaje, icono = 'help', textoBoton = 'Confirmar', tipoBoton = 'primary', onConfirm }) {
    const modalBody = document.getElementById('genericModalContent');
    const modalTitle = document.getElementById('genericModalTitle');

    if (modalTitle) modalTitle.textContent = titulo;
    if (modalBody) {
      const colorBoton = tipoBoton === 'danger' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'btn-primary';
      modalBody.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span class="material-symbols-outlined text-[28px] ${tipoBoton === 'danger' ? 'text-rose-600' : 'text-violet-700'}">${icono}</span>
            <p class="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">${this.escapeHTML(mensaje)}</p>
          </div>
          <div class="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button data-csp-click="window.App.cerrarModalGenerico()" class="btn-secondary text-xs">Cancelar</button>
            <button id="modalBtnConfirmarAccion" class="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${colorBoton}">
              ${this.escapeHTML(textoBoton)}
            </button>
          </div>
        </div>
      `;

      const btnConfirmar = document.getElementById('modalBtnConfirmarAccion');
      if (btnConfirmar) {
        btnConfirmar.onclick = async () => {
          this.cerrarModalGenerico();
          if (typeof onConfirm === 'function') {
            await onConfirm();
          }
        };
      }
    }

    this.abrirModalGenerico();
  },

  /* ================= MODAL GENÉRICO ================= */
  abrirModalGenerico() {
    const modal = document.getElementById('genericModal');
    if (modal) modal.classList.add('open');
  },

  cerrarModalGenerico() {
    const modal = document.getElementById('genericModal');
    if (modal) modal.classList.remove('open');
  },

  /* ================= ESTADOS DE CARGA (SKELETON SCREENS) ================= */
  mostrarSkeleton(containerId, tipo = 'cards') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (tipo === 'cards') {
      container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 py-6">
          ${[1, 2, 3, 4].map(() => `
            <div class="fl-card p-6 space-y-4">
              <div class="flex items-center justify-between">
                <div class="skeleton-box h-4 w-28"></div>
                <div class="skeleton-box h-4 w-16"></div>
              </div>
              <div class="skeleton-box h-6 w-3/4"></div>
              <div class="space-y-2">
                <div class="skeleton-box h-3 w-full"></div>
                <div class="skeleton-box h-3 w-5/6"></div>
              </div>
              <div class="skeleton-box h-12 w-full rounded-xl"></div>
              <div class="flex justify-between items-center pt-2">
                <div class="skeleton-box h-4 w-24"></div>
                <div class="skeleton-box h-8 w-28 rounded-lg"></div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  },

  /* ================= SISTEMA DE TOASTS ================= */
  mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    let bg = 'bg-slate-900 text-white';
    let icon = 'info';

    if (tipo === 'success') {
      bg = 'bg-emerald-900 text-emerald-100 border border-emerald-700/60';
      icon = 'check_circle';
    } else if (tipo === 'error') {
      bg = 'bg-rose-900 text-rose-100 border border-rose-700/60';
      icon = 'error';
    } else if (tipo === 'warning') {
      bg = 'bg-amber-900 text-amber-100 border border-amber-700/60';
      icon = 'warning';
    }

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-medium transition-all transform translate-y-2 opacity-0 ${bg}`;
    toast.innerHTML = `
      <span class="material-symbols-outlined text-[18px]">${icon}</span>
      <span class="flex-1">${this.escapeHTML(mensaje)}</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  window.App.iniciar();
});
