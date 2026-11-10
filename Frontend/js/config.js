window.FREELANCER_API_BASE = '';

if (typeof window.tailwind !== 'undefined') {
  window.tailwind.config = {
    darkMode: 'class'
  };
}

/**
 * Delegador global de eventos por atributos data-csp-* (100% compatible con CSP script-src 'self' sin 'unsafe-inline')
 * Escucha click, submit, change e input en document y despacha hacia los controladores registrados en window.
 */
(function inicializarDelegadorCSPSeguro() {
  function parsearArgumentos(rawArgs, event, elemento) {
    const resultado = [];
    let actual = '';
    let enComillas = false;
    let caracterComilla = '';

    for (let i = 0; i < rawArgs.length; i++) {
      const ch = rawArgs[i];
      if (enComillas) {
        if (ch === caracterComilla && rawArgs[i - 1] !== '\\') {
          enComillas = false;
        }
        actual += ch;
      } else if (ch === "'" || ch === '"') {
        enComillas = true;
        caracterComilla = ch;
        actual += ch;
      } else if (ch === ',') {
        resultado.push(evaluarTokenArgumento(actual.trim(), event, elemento));
        actual = '';
      } else {
        actual += ch;
      }
    }
    if (actual.trim().length > 0) {
      resultado.push(evaluarTokenArgumento(actual.trim(), event, elemento));
    }
    return resultado;
  }

  function evaluarTokenArgumento(token, event, elemento) {
    if (token === 'event') return event;
    if (token === 'this') return elemento;
    if (token === 'this.value') return elemento ? elemento.value : '';
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'null') return null;
    if (token === 'undefined') return undefined;
    if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
      return token.slice(1, -1);
    }
    const num = Number(token);
    if (!Number.isNaN(num)) return num;
    return token;
  }

  function ejecutarSentenciaSegura(sentencia, event, elemento) {
    const limpia = String(sentencia || '').trim();
    if (!limpia) return;

    if (limpia === 'event.stopPropagation()') {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      return;
    }
    if (limpia === 'event.preventDefault()') {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      return;
    }

    const idxParen = limpia.indexOf('(');
    if (idxParen < 0 || !limpia.endsWith(')')) return;

    const rutaMetodo = limpia.slice(0, idxParen).trim();
    const rawArgs = limpia.slice(idxParen + 1, -1).trim();
    const partes = rutaMetodo.split('.').filter(Boolean);
    if (partes[0] === 'window') {
      partes.shift();
    }

    let contexto = window;
    for (let i = 0; i < partes.length - 1; i++) {
      if (!contexto) return;
      contexto = contexto[partes[i]];
    }
    const nombreFuncion = partes[partes.length - 1];
    const fn = contexto ? contexto[nombreFuncion] : null;
    if (typeof fn === 'function') {
      const args = rawArgs ? parsearArgumentos(rawArgs, event, elemento) : [];
      fn.apply(contexto, args);
    }
  }

  function ejecutarExpresionSegura(expresion, event, elemento) {
    if (!expresion) return;
    const sentencias = String(expresion).split(';');
    for (const s of sentencias) {
      if (s.trim()) {
        ejecutarSentenciaSegura(s, event, elemento);
      }
    }
  }

  document.addEventListener('click', (event) => {
    let actual = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-csp-click]')
      : null;
    while (actual && actual !== document) {
      if (actual.dataset && actual.dataset.cspClick) {
        ejecutarExpresionSegura(actual.dataset.cspClick, event, actual);
        if (event.cancelBubble) break;
      }
      actual = actual.parentElement ? actual.parentElement.closest('[data-csp-click]') : null;
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-csp-submit]')
      : null;
    if (form && form.dataset && form.dataset.cspSubmit) {
      ejecutarExpresionSegura(form.dataset.cspSubmit, event, form);
    }
  });

  document.addEventListener('change', (event) => {
    const el = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-csp-change]')
      : null;
    if (el && el.dataset && el.dataset.cspChange) {
      ejecutarExpresionSegura(el.dataset.cspChange, event, el);
    }
  });

  document.addEventListener('input', (event) => {
    const el = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-csp-input]')
      : null;
    if (el && el.dataset && el.dataset.cspInput) {
      ejecutarExpresionSegura(el.dataset.cspInput, event, el);
    }
  });
})();
